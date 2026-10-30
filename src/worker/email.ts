export interface EmailMessage {
	to: string;
	subject: string;
	text: string;
}

// The only place that knows how email leaves the app, so the provider can be
// swapped without touching callers. Production has no provider yet and fails
// loudly rather than pretending a verification email was sent.
export async function sendEmail(env: Env, message: EmailMessage): Promise<void> {
	if (env.ENVIRONMENT === "development") {
		console.log(
			`[dev email] to=${message.to} subject=${message.subject}\n${message.text}`,
		);
		return;
	}
	throw new Error("Email delivery is not configured");
}
