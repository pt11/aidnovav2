import { Hono } from "hono";
import { assistantRoutes } from "./assistant";
import { calendarRoutes } from "./calendar";
import { capacityRoutes } from "./capacity";
import { capacitySkillRoutes } from "./capacitySkills";
import { taskRoutes } from "./tasks";
import { courseRoutes } from "./courses";
import { createAuth } from "./auth";
import { requireSameOrigin, withDb, type AppEnv } from "./middleware";
import { fileRoutes } from "./files";
import { mediaRoutes } from "./media";
import { moduleRoutes } from "./modules";
import { peopleRoutes } from "./people";
import { planRoutes } from "./plans";
import { policyRoutes } from "./policies";
import { projectFileRoutes } from "./projectFiles";
import { projectInsightRoutes } from "./projectInsights";
import { projectReportRoutes } from "./projectReports";
import { projectRoutes } from "./projects";
import { api } from "./routes";
import { reportRoutes } from "./reports";
import { superadminRoutes } from "./superadmin";
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
app.route("/api", courseRoutes);
app.route("/api", mediaRoutes);
app.route("/api", calendarRoutes);
app.route("/api", capacityRoutes);
app.route("/api", capacitySkillRoutes);
app.route("/api", taskRoutes);
app.route("/api", projectInsightRoutes);
app.route("/api", projectFileRoutes);
app.route("/api", projectReportRoutes);
app.route("/api", projectRoutes);
app.route("/api", moduleRoutes);
app.route("/api", peopleRoutes);
app.route("/api", planRoutes);
app.route("/api", reportRoutes);
app.route("/api", superadminRoutes);

app.notFound((c) => c.json({ code: "NOT_FOUND", message: "Not found." }, 404));

app.onError((error, c) => {
	console.error(error);
	return c.json({ code: "SERVER_ERROR", message: "Something went wrong." }, 500);
});

export default app;
