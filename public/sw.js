// The hub's service worker. It only ever keeps the app's own code and an offline
// page. API responses hold private organization data, so they're never stored.
const VERSION = "aidnova-hub-v1";
const OFFLINE_URL = "/offline.html";

// The host redirects /offline.html to /offline, and browsers refuse a stored
// redirect when opening a page, so this keeps a clean copy of the final page.
async function keepOfflinePage() {
	const response = await fetch(OFFLINE_URL);
	if (!response.ok) throw new Error("Offline page unavailable");
	const copy = new Response(await response.blob(), {
		headers: { "Content-Type": "text/html; charset=utf-8" },
	});
	const cache = await caches.open(VERSION);
	await cache.put(OFFLINE_URL, copy);
	await cache.add("/aidnova-logo.png");
}

self.addEventListener("install", (event) => {
	event.waitUntil(keepOfflinePage().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((names) =>
				Promise.all(names.filter((name) => name !== VERSION).map((name) => caches.delete(name))),
			)
			.then(() => self.clients.claim()),
	);
});

self.addEventListener("fetch", (event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (request.method !== "GET" || url.origin !== self.location.origin) return;
	if (url.pathname.startsWith("/api/")) return;

	// Pages always come fresh, so a new release shows straight away.
	if (request.mode === "navigate") {
		event.respondWith(
			fetch(request).catch(() => caches.match(OFFLINE_URL)),
		);
		return;
	}

	// Built files have their content in their names, so they never go stale.
	if (url.pathname.startsWith("/assets/") || url.pathname === "/aidnova-logo.png") {
		event.respondWith(
			caches.match(request).then(
				(cached) =>
					cached ??
					fetch(request).then((response) => {
						if (response.ok) {
							const copy = response.clone();
							caches.open(VERSION).then((cache) => cache.put(request, copy));
						}
						return response;
					}),
			),
		);
	}
});
