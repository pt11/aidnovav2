import { Hono } from "hono";
import { createAuth } from "./auth";
import { requireSameOrigin, withDb, type AppEnv } from "./middleware";
import { api } from "./routes";

const app = new Hono<AppEnv>();

app.on(["GET", "POST"], "/api/auth/*", (c) =>
	createAuth(c.env, c.req.raw).handler(c.req.raw),
);

app.use("/api/*", withDb, requireSameOrigin);
app.route("/api", api);

app.notFound((c) => c.json({ code: "NOT_FOUND", message: "Not found." }, 404));

app.onError((error, c) => {
	console.error(error);
	return c.json({ code: "SERVER_ERROR", message: "Something went wrong." }, 500);
});

export default app;
