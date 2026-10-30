export interface EmailMessage {
	to: string;
	subject: string;
	text: string;
}

// The only place that knows how email leaves the app, so the provider can be
// swapped without touching callers.
export async function sendEmail(env: Env, message: EmailMessage): Promise<void> {
	if (env.ENVIRONMENT === "development") {
		console.log(
			`[dev email] to=${message.to} subject=${message.subject}\n${message.text}`,
		);
		return;
	}
	await env.EMAIL.send({
		from: env.EMAIL_FROM,
		to: message.to,
		subject: message.subject,
		text: message.text,
	});
}
