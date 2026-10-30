// API permission tests. They run against a local dev server, so nothing here
// can touch production:
//   npm run dev -- --port 5199
//   BASE_URL=http://localhost:5199 npm run test:api
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { before, describe, test } from "node:test";

const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const RUN = Date.now();
const PASSWORD = "correct-horse-battery";
let ipCounter = 0;

function sql(command) {
	execFileSync(
		"npx",
		["wrangler", "d1", "execute", "aidnova", "--local", "--command", command],
		{ stdio: "pipe" },
	);
}

class Client {
	constructor() {
		this.cookies = new Map();
		// Each client looks like a different address, so sign-in rate limits
		// only apply where a test exercises them on purpose.
		this.ip = `10.0.${RUN % 200}.${++ipCounter}`;
	}

	async request(path, { method = "GET", body, origin = BASE } = {}) {
		const headers = { "cf-connecting-ip": this.ip };
		if (method !== "GET") headers.origin = origin;
		if (body !== undefined) headers["content-type"] = "application/json";
		if (this.cookies.size) {
			headers.cookie = [...this.cookies]
				.map(([name, value]) => `${name}=${value}`)
				.join("; ");
		}
		const response = await fetch(`${BASE}${path}`, {
			method,
			headers,
			body: body === undefined ? undefined : JSON.stringify(body),
			redirect: "manual",
		});
		for (const cookie of response.headers.getSetCookie()) {
			const [pair] = cookie.split(";");
			const index = pair.indexOf("=");
			this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
		}
		const data = await response.json().catch(() => null);
		return { status: response.status, data };
	}

	async signUpAndIn(label) {
		const email = `${label}-${RUN}@example.test`;
		const signUp = await this.request("/api/auth/sign-up/email", {
			method: "POST",
			body: { name: label, email, password: PASSWORD },
		});
		assert.equal(signUp.status, 200, `sign-up failed for ${label}`);
		sql(`UPDATE user SET email_verified = 1 WHERE email = '${email}'`);
		const signIn = await this.request("/api/auth/sign-in/email", {
			method: "POST",
			body: { email, password: PASSWORD },
		});
		assert.equal(signIn.status, 200, `sign-in failed for ${label}`);
		const me = await this.request("/api/me");
		this.userId = me.data.user.id;
		this.email = email;
		return this;
	}

	createOrg(label) {
		return this.request("/api/organizations", {
			method: "POST",
			body: { name: label, slug: `${label}-${RUN}` },
		});
	}
}

function addMember(userId, organizationId, role) {
	sql(
		`INSERT INTO user_profiles (user_id, organization_id, role) VALUES ('${userId}', ${organizationId}, '${role}')`,
	);
}

describe("sign-in", () => {
	test("unverified accounts can't sign in", async () => {
		const client = new Client();
		const email = `unverified-${RUN}@example.test`;
		await client.request("/api/auth/sign-up/email", {
			method: "POST",
			body: { name: "Unverified", email, password: PASSWORD },
		});
		const signIn = await client.request("/api/auth/sign-in/email", {
			method: "POST",
			body: { email, password: PASSWORD },
		});
		assert.equal(signIn.status, 403);
	});

	test("repeated bad passwords are rate limited", async () => {
		const client = new Client();
		let last;
		for (let attempt = 0; attempt < 6; attempt++) {
			last = await client.request("/api/auth/sign-in/email", {
				method: "POST",
				body: { email: `nobody-${RUN}@example.test`, password: "wrong-password" },
			});
		}
		assert.equal(last.status, 429);
	});

	test("users can't make themselves superadmin at sign-up", async () => {
		const client = new Client();
		const email = `sneaky-${RUN}@example.test`;
		await client.request("/api/auth/sign-up/email", {
			method: "POST",
			body: { name: "Sneaky", email, password: PASSWORD, isSuperAdmin: true },
		});
		sql(`UPDATE user SET email_verified = 1 WHERE email = '${email}'`);
		await client.request("/api/auth/sign-in/email", {
			method: "POST",
			body: { email, password: PASSWORD },
		});
		const me = await client.request("/api/me");
		assert.equal(me.data.user.isSuperAdmin, false);
	});
});

describe("organizations and roles", () => {
	let admin, manager, staff, outsider, orgId, outsiderOrgId;

	before(async () => {
		admin = await new Client().signUpAndIn("admin");
		manager = await new Client().signUpAndIn("manager");
		staff = await new Client().signUpAndIn("staff");
		outsider = await new Client().signUpAndIn("outsider");

		orgId = (await admin.createOrg("alpha")).data.id;
		outsiderOrgId = (await outsider.createOrg("beta")).data.id;
		addMember(manager.userId, orgId, "manager");
		addMember(staff.userId, orgId, "staff");
	});

	test("signed-out requests are rejected", async () => {
		const { status } = await new Client().request(
			"/api/organizations/current/members",
		);
		assert.equal(status, 401);
	});

	test("the creator becomes admin with a 14-day trial", async () => {
		const { data } = await admin.request("/api/me");
		const org = data.memberships.find((m) => m.organizationId === orgId);
		assert.equal(org.role, "admin");
		assert.equal(org.subscriptionStatus, "trial");
		const days = (new Date(org.trialEndDate) - Date.now()) / 86_400_000;
		assert.ok(days > 13.9 && days <= 14);
	});

	test("one user can own only one organization", async () => {
		const { status, data } = await admin.createOrg("second");
		assert.equal(status, 409);
		assert.equal(data.code, "ALREADY_OWNER");
	});

	test("slugs are unique and validated", async () => {
		const client = await new Client().signUpAndIn("sluggish");
		const taken = await client.request("/api/organizations", {
			method: "POST",
			body: { name: "Copy", slug: `alpha-${RUN}` },
		});
		assert.equal(taken.data.code, "SLUG_TAKEN");
		const invalid = await client.request("/api/organizations", {
			method: "POST",
			body: { name: "Bad", slug: "Not Valid!" },
		});
		assert.equal(invalid.data.code, "INVALID_SLUG");
	});

	test("managers and admins can list members, staff can't", async () => {
		assert.equal((await admin.request("/api/organizations/current/members")).status, 200);
		assert.equal((await manager.request("/api/organizations/current/members")).status, 200);
		assert.equal((await staff.request("/api/organizations/current/members")).status, 403);
	});

	test("the member list only contains this organization", async () => {
		const { data } = await admin.request("/api/organizations/current/members");
		const ids = data.members.map((member) => member.userId);
		assert.ok(ids.includes(staff.userId));
		assert.ok(!ids.includes(outsider.userId));
	});

	const roleUrl = (userId) => `/api/organizations/current/members/${userId}/role`;

	test("only admins can change roles", async () => {
		const body = { role: "admin" };
		assert.equal((await manager.request(roleUrl(manager.userId), { method: "PATCH", body })).status, 403);
		assert.equal((await staff.request(roleUrl(staff.userId), { method: "PATCH", body })).status, 403);
	});

	test("admins can't change the owner's or their own role", async () => {
		const { status, data } = await admin.request(roleUrl(admin.userId), {
			method: "PATCH",
			body: { role: "staff" },
		});
		assert.equal(status, 403);
		assert.equal(data.code, "OWNER_ROLE_LOCKED");
	});

	test("admins can't change someone in another organization", async () => {
		const { status } = await admin.request(roleUrl(outsider.userId), {
			method: "PATCH",
			body: { role: "staff" },
		});
		assert.equal(status, 404);
		const { data } = await outsider.request("/api/me");
		assert.equal(data.memberships[0].role, "admin");
	});

	test("an admin's role change takes effect and is limited to valid roles", async () => {
		const invalid = await admin.request(roleUrl(staff.userId), {
			method: "PATCH",
			body: { role: "superadmin" },
		});
		assert.equal(invalid.status, 400);
		const promoted = await admin.request(roleUrl(staff.userId), {
			method: "PATCH",
			body: { role: "manager" },
		});
		assert.equal(promoted.status, 200);
		assert.equal((await staff.request("/api/organizations/current/members")).status, 200);
		await admin.request(roleUrl(staff.userId), {
			method: "PATCH",
			body: { role: "staff" },
		});
		assert.equal((await staff.request("/api/organizations/current/members")).status, 403);
	});

	test("you can't switch into an organization you don't belong to", async () => {
		const { status } = await admin.request("/api/organizations/switch", {
			method: "POST",
			body: { organizationId: outsiderOrgId },
		});
		assert.equal(status, 403);
	});

	test("a forged organization cookie can't reach another organization", async () => {
		const client = new Client();
		client.cookies = new Map(admin.cookies);
		client.ip = admin.ip;
		client.cookies.set("active-org-id", String(outsiderOrgId));
		const { data } = await client.request("/api/organizations/current/members");
		const ids = data.members.map((member) => member.userId);
		assert.ok(ids.includes(admin.userId));
		assert.ok(!ids.includes(outsider.userId));
	});

	test("someone in two organizations gets the right role in each", async () => {
		addMember(manager.userId, outsiderOrgId, "staff");
		await manager.request("/api/organizations/switch", {
			method: "POST",
			body: { organizationId: outsiderOrgId },
		});
		assert.equal((await manager.request("/api/organizations/current/members")).status, 403);
		await manager.request("/api/organizations/switch", {
			method: "POST",
			body: { organizationId: orgId },
		});
		assert.equal((await manager.request("/api/organizations/current/members")).status, 200);
	});

	test("a deactivated membership loses access", async () => {
		const client = await new Client().signUpAndIn("leaver");
		addMember(client.userId, orgId, "manager");
		assert.equal((await client.request("/api/organizations/current/members")).status, 200);
		sql(`UPDATE user_profiles SET is_active = 0 WHERE user_id = '${client.userId}'`);
		const { status, data } = await client.request("/api/organizations/current/members");
		assert.equal(status, 403);
		assert.equal(data.code, "NO_ORGANIZATION");
	});

	test("a disabled account is rejected", async () => {
		const client = await new Client().signUpAndIn("disabled");
		sql(`UPDATE user SET is_active = 0 WHERE id = '${client.userId}'`);
		const { status, data } = await client.request("/api/me");
		assert.equal(status, 403);
		assert.equal(data.code, "ACCOUNT_DISABLED");
	});

	test("an expired trial blocks the organization and is saved as suspended", async () => {
		const client = await new Client().signUpAndIn("expired");
		const id = (await client.createOrg("expired")).data.id;
		sql(`UPDATE organizations SET trial_end_date = 1000 WHERE id = ${id}`);
		const blocked = await client.request("/api/organizations/current/members");
		assert.equal(blocked.status, 403);
		assert.equal(blocked.data.code, "TRIAL_EXPIRED");
		const { data } = await client.request("/api/me");
		assert.equal(data.memberships[0].subscriptionStatus, "suspended");
		assert.equal(data.memberships[0].access, "blocked");
	});

	test("superadmin is a separate permission", async () => {
		assert.equal((await admin.request("/api/superadmin/stats")).status, 403);
		const client = await new Client().signUpAndIn("platform");
		sql(`UPDATE user SET is_super_admin = 1 WHERE id = '${client.userId}'`);
		assert.equal((await client.request("/api/superadmin/stats")).status, 200);
		// Having the flag doesn't grant access inside an organization.
		assert.equal((await client.request("/api/organizations/current/members")).status, 403);
	});

	test("writes from another site are rejected", async () => {
		const { status, data } = await admin.request("/api/organizations/switch", {
			method: "POST",
			body: { organizationId: orgId },
			origin: "https://evil.example",
		});
		assert.equal(status, 403);
		assert.equal(data.code, "BAD_ORIGIN");
	});
});
