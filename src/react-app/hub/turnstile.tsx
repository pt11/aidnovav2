import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

const SCRIPT_URL =
	"https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
	render(
		container: HTMLElement,
		options: {
			sitekey: string;
			callback: (token: string) => void;
			"expired-callback": () => void;
		},
	): string;
	remove(widgetId: string): void;
}

declare global {
	interface Window {
		turnstile?: TurnstileApi;
	}
}

let scriptLoad: Promise<void> | undefined;

function loadScript(): Promise<void> {
	scriptLoad ??= new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = SCRIPT_URL;
		script.async = true;
		script.onload = () => resolve();
		script.onerror = () => reject(new Error("Turnstile didn't load"));
		document.head.append(script);
	});
	return scriptLoad;
}

function TurnstileWidget({
	siteKey,
	onToken,
}: {
	siteKey: string;
	onToken: (token: string) => void;
}) {
	const container = useRef<HTMLDivElement>(null);

	useEffect(() => {
		let widgetId: string | undefined;
		let cancelled = false;
		// If the script is blocked the form still submits, and the server's
		// rejection tells the person what went wrong.
		loadScript()
			.then(() => {
				if (cancelled || !container.current || !window.turnstile) return;
				widgetId = window.turnstile.render(container.current, {
					sitekey: siteKey,
					callback: onToken,
					"expired-callback": () => onToken(""),
				});
			})
			.catch(console.error);
		return () => {
			cancelled = true;
			if (widgetId) window.turnstile?.remove(widgetId);
		};
	}, [siteKey, onToken]);

	return <div ref={container} className="min-h-[65px]" />;
}

// Tokens work once, so call reset after any failed submit to get a new one.
export function useTurnstile() {
	const { data } = useQuery({
		queryKey: ["config"],
		staleTime: Infinity,
		queryFn: () => api<{ turnstileSiteKey: string | null }>("/config"),
	});
	const [token, setToken] = useState("");
	const [attempt, setAttempt] = useState(0);
	const siteKey = data?.turnstileSiteKey;

	return {
		fetchOptions: token
			? { headers: { "x-captcha-response": token } }
			: undefined,
		widget: siteKey ? (
			<TurnstileWidget key={attempt} siteKey={siteKey} onToken={setToken} />
		) : null,
		reset() {
			setToken("");
			setAttempt((value) => value + 1);
		},
	};
}
