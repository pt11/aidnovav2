import { useEffect, useState } from "react";

interface InstallEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let installEvent: InstallEvent | null = null;
const listeners = new Set<() => void>();

function addHeadTag(tag: "link" | "meta", attributes: Record<string, string>) {
	const element = document.createElement(tag);
	for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
	document.head.appendChild(element);
}

// Only the hub calls this, so the landing page and future public pages stay
// ordinary websites that can't be installed.
export function setUpHubApp() {
	addHeadTag("link", { rel: "manifest", href: "/hub.webmanifest" });
	addHeadTag("meta", { name: "theme-color", content: "#0066F5" });
	addHeadTag("meta", { name: "apple-mobile-web-app-capable", content: "yes" });
	addHeadTag("meta", { name: "apple-mobile-web-app-title", content: "AidNova" });
	addHeadTag("link", { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" });
	document
		.querySelector('meta[name="viewport"]')
		?.setAttribute("content", "width=device-width, initial-scale=1.0, viewport-fit=cover");

	window.addEventListener("beforeinstallprompt", (event) => {
		event.preventDefault();
		installEvent = event as InstallEvent;
		listeners.forEach((listener) => listener());
	});
	window.addEventListener("appinstalled", () => {
		installEvent = null;
		listeners.forEach((listener) => listener());
	});

	if (import.meta.env.PROD && "serviceWorker" in navigator) {
		window.addEventListener("load", () => {
			// The app works the same without it, so a failure here doesn't matter.
			navigator.serviceWorker.register("/sw.js").catch(() => undefined);
		});
	}
}

export function useInstallApp() {
	const [canPrompt, setCanPrompt] = useState(installEvent !== null);
	useEffect(() => {
		const update = () => setCanPrompt(installEvent !== null);
		listeners.add(update);
		return () => {
			listeners.delete(update);
		};
	}, []);
	const standalone =
		window.matchMedia("(display-mode: standalone)").matches ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true;
	const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
	return {
		installed: standalone,
		canPrompt,
		isIos,
		install: async () => {
			if (!installEvent) return;
			await installEvent.prompt();
			installEvent = null;
			setCanPrompt(false);
		},
	};
}
