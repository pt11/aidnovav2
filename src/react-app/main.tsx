import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";

// The landing page and the hub share a build but never each other's code, so
// visitors to the landing page don't download the app.
const isHub = window.location.hostname.startsWith("hub.");
const Root = lazy(() =>
	isHub ? import("./hub/HubApp") : import("./landing/Landing"),
);

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<Suspense fallback={null}>
			<Root />
		</Suspense>
	</StrictMode>,
);
