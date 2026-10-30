import { Hono } from "hono";
import { assistantRoutes } from "./assistant";
import { createAuth } from "./auth";
import { requireSameOrigin, withDb, type AppEnv } from "./middleware";
import { fileRoutes } from "./files";
import { policyRoutes } from "./policies";
import { api } from "./routes";
import { team } from "./team";
import { workspace } from "./workspace";

const app = new Hono<AppEnv>();

app.on(["GET", "POST"], "/api/auth/*", (c) =>
	createAuth(c.env, c.req.raw).handler(c.req.raw),
);

app.use("/api/*", withDb, requireSameOrigin);
app.route("/api", api);
app.route("/api", team);
app.route("/api", workspace);
app.route("/api", policyRoutes);
app.route("/api", fileRoutes);
app.route("/api", assistantRoutes);

app.notFound((c) => c.json({ code: "NOT_FOUND", message: "Not found." }, 404));

app.onError((error, c) => {
	console.error(error);
	return c.json({ code: "SERVER_ERROR", message: "Something went wrong." }, 500);
});

export default app;
