export async function readJson(
	request: Request,
): Promise<Record<string, unknown>> {
	const body = await request.json().catch(() => null);
	return body && typeof body === "object" && !Array.isArray(body)
		? (body as Record<string, unknown>)
		: {};
}

// Trims and removes control characters, keeping line breaks only when asked.
export function cleanText(value: unknown, { multiline = false } = {}): string {
	if (typeof value !== "string") return "";
	const pattern = multiline
		? // eslint-disable-next-line no-control-regex
			/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]/g
		: // eslint-disable-next-line no-control-regex
			/[\u0000-\u001f\u007f]/g;
	return value.replace(pattern, multiline ? "" : " ").trim();
}

export function isEmail(value: string): boolean {
	return (
		value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
	);
}

// Saved links are shown to other people, so only harmless schemes are allowed.
export function isSafeLink(value: string, protocols = ["http:", "https:"]) {
	if (value.length > 2000) return false;
	try {
		return protocols.includes(new URL(value).protocol);
	} catch {
		return false;
	}
}
