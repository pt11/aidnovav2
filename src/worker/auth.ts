import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { captcha } from "better-auth/plugins/captcha";
import { getDb } from "./db";
import * as schema from "./db/schema";
import { sendEmail } from "./email";

const scryptAsync = promisify(scrypt) as (
	password: string,
	salt: Buffer,
	keylen: number,
	options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 64;

// Runs natively through nodejs_compat, which uses far less Worker CPU than a
// JavaScript scrypt implementation.
export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const key = await scryptAsync(password, salt, KEY_LENGTH, SCRYPT);
	return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword({
	hash,
	password,
}: {
	hash: string;
	password: string;
}): Promise<boolean> {
	const [salt, key] = hash.split(":");
	if (!salt || !key) return false;
	const expected = Buffer.from(key, "hex");
	const actual = await scryptAsync(
		password,
		Buffer.from(salt, "hex"),
		expected.length,
		SCRYPT,
	);
	return timingSafeEqual(actual, expected);
}

// Local dev serves several hostnames and ports. Production always uses the
// configured address, so a forged Host header can't change emailed links.
export function getBaseUrl(env: Env, request: Request): string {
	return env.ENVIRONMENT === "development"
		? new URL(request.url).origin
		: env.HUB_URL;
}

// Covers the forms that send email to an address anyone can type in. Sign-in
// relies on rate limiting. Production always checks, so a missing secret
// blocks these forms instead of turning the check off.
function turnstilePlugins(env: Env) {
	if (env.ENVIRONMENT === "development" && !env.TURNSTILE_SECRET_KEY) return [];
	return [
		captcha({
			provider: "cloudflare-turnstile",
			secretKey: env.TURNSTILE_SECRET_KEY,
			endpoints: ["/sign-up/email", "/request-password-reset"],
		}),
	];
}

export function createAuth(env: Env, request: Request) {
	const baseURL = getBaseUrl(env, request);

	return betterAuth({
		appName: "AidNova",
		baseURL,
		basePath: "/api/auth",
		secret: env.BETTER_AUTH_SECRET,
		trustedOrigins: [baseURL],
		database: drizzleAdapter(getDb(env), { provider: "sqlite", schema }),
		plugins: turnstilePlugins(env),
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: true,
			minPasswordLength: 8,
			password: { hash: hashPassword, verify: verifyPassword },
			sendResetPassword: async ({ user, url }) => {
				await sendEmail(env, {
					to: user.email,
					subject: "Reset your AidNova password",
					text: `Use this link to choose a new password:\n\n${url}\n\nIf you didn't ask for this, you can ignore this email.`,
				});
			},
		},
		emailVerification: {
			sendOnSignUp: true,
			autoSignInAfterVerification: true,
			sendVerificationEmail: async ({ user, url }) => {
				await sendEmail(env, {
					to: user.email,
					subject: "Confirm your AidNova email",
					text: `Welcome to AidNova. Use this link to confirm your email:\n\n${url}`,
				});
			},
		},
		user: {
			additionalFields: {
				isSuperAdmin: {
					type: "boolean",
					input: false,
					required: false,
					defaultValue: false,
				},
				isActive: {
					type: "boolean",
					input: false,
					required: false,
					defaultValue: true,
				},
			},
		},
		// Stored in the database because Worker isolates don't share memory.
		rateLimit: { enabled: true, storage: "database", modelName: "rateLimit" },
		advanced: { ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] } },
	});
}
