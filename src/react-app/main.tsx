import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { setUpHubApp } from "./hub/pwa";

// The landing page and the hub share a build but never each other's code, so
// visitors to the landing page don't download the app.
const isHub = window.location.hostname.startsWith("hub.");
if (isHub) setUpHubApp();
// Separate functions on purpose: in one expression the minifier merges the two
// imports, and both then preload the same CSS.
const loadHub = () => import("./hub/HubApp");
const loadLanding = () => import("./landing/Landing");
const Root = lazy(isHub ? loadHub : loadLanding);

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<Suspense fallback={null}>
			<Root />
		</Suspense>
	</StrictMode>,
);
