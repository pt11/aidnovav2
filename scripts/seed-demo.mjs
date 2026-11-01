// Fills a LOCAL database with a made-up organization for demos and testing.
// Run with the dev server up:  DEMO_PASSWORD=... node scripts/seed-demo.mjs
// To fill an organization you already made, add DEMO_EXISTING_ORG="Its name". That
// only adds to it: nothing already there is changed, and its owner stays in charge.
// It refuses any other address because it adds people directly to the local database.
import { execFileSync } from "node:child_process";

const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const PASSWORD = process.env.DEMO_PASSWORD;
const EXISTING = process.env.DEMO_EXISTING_ORG;
const NAME = EXISTING ?? process.env.DEMO_ORG ?? "DEV-PT";
if (!/^http:\/\/(hub\.)?localhost(:\d+)?$/.test(BASE)) throw new Error("This script only runs against localhost.");
if (!PASSWORD || PASSWORD.length < 8) throw new Error("Set DEMO_PASSWORD (at least 8 characters).");

const run = Date.now().toString(36);
const DOMAIN = EXISTING ? `${NAME.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.example` : "dev-pt.example";
const sql = (command) => execFileSync("npx", ["wrangler", "d1", "execute", "aidnova", "--local", "--command", command], { stdio: "pipe" });
const rows = (command) => JSON.parse(execFileSync("npx", ["wrangler", "d1", "execute", "aidnova", "--local", "--json", "--command", command], { stdio: "pipe" }).toString())[0].results;
const problems = [];

function client() {
	const cookies = new Map();
	const request = async (path, body, method) => {
		const headers = { origin: BASE };
		if (body !== undefined) headers["content-type"] = "application/json";
		if (cookies.size) headers.cookie = [...cookies].map(([key, value]) => `${key}=${value}`).join("; ");
		const response = await fetch(`${BASE}/api${path}`, { method: method ?? (body === undefined ? "GET" : "POST"), headers, body: body === undefined ? undefined : JSON.stringify(body) });
		for (const cookie of response.headers.getSetCookie()) {
			const [pair] = cookie.split(";");
			const index = pair.indexOf("=");
			cookies.set(pair.slice(0, index), pair.slice(index + 1));
		}
		const data = await response.json().catch(() => null);
		if (!response.ok) problems.push(`${method ?? (body === undefined ? "GET" : "POST")} ${path}: ${response.status} ${data?.code ?? ""}`);
		return data;
	};
	request.cookie = () => [...cookies].map(([key, value]) => `${key}=${value}`).join("; ");
	return request;
}

async function person(name, slug) {
	sql("DELETE FROM rate_limit");
	const email = `${slug}.${run}@${DOMAIN}`;
	await client()("/auth/sign-up/email", { name, email, password: PASSWORD });
	sql(`UPDATE user SET email_verified = 1 WHERE email = '${email}'`);
	const api = client();
	await api("/auth/sign-in/email", { email, password: PASSWORD });
	const me = await api("/me");
	return { api, id: me.user.id, name, email, cookie: api.cookie };
}

const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

// Each run replaces the last demo, so there's only ever one.
if (!EXISTING) {
	sql(`DELETE FROM audit_log WHERE organization_id IN (SELECT id FROM organizations WHERE name = '${NAME}'); DELETE FROM organizations WHERE name = '${NAME}'; DELETE FROM session WHERE user_id IN (SELECT id FROM user WHERE email LIKE '%@${DOMAIN}'); DELETE FROM account WHERE user_id IN (SELECT id FROM user WHERE email LIKE '%@${DOMAIN}'); DELETE FROM user WHERE email LIKE '%@${DOMAIN}'`);
}
const target = EXISTING ? rows(`SELECT id, owner_id FROM organizations WHERE lower(name) = lower('${NAME.replace(/'/g, "''")}')`) : [];
if (EXISTING && target.length !== 1) throw new Error(`Expected one organization called ${NAME}, found ${target.length}.`);
if (EXISTING && rows(`SELECT id FROM user WHERE email LIKE '%@${DOMAIN}'`).length) throw new Error("Demo data is already in this organization.");

const platform = await person("Local Platform", "platform");
sql(`UPDATE user SET is_super_admin = 1 WHERE id = '${platform.id}'`);
const MODULES = ["projects", "capacity_building", "people_directory"];
for (const key of MODULES) await platform.api(`/superadmin/modules/${key}`, { release: "pilot", paused: false }, "PATCH");

const admin = await person("PT Demo", "pt");
if (EXISTING) sql(`INSERT INTO user_profiles (user_id, organization_id, role) VALUES ('${admin.id}', ${target[0].id}, 'admin')`);
const org = EXISTING ? { id: target[0].id } : await admin.api("/organizations", { name: NAME, slug: `dev-pt-${run}` });
const projectOwner = EXISTING ? target[0].owner_id : admin.id;
const enabled = new Set(EXISTING ? (await admin.api("/me")).activeModules : []);
for (const key of MODULES) {
	if (enabled.has(key)) continue;
	if (key !== "projects") await admin.api(`/organizations/current/modules/${key}/review`, { date: day(-3), note: "Demo data, reviewed locally" });
	await admin.api(`/organizations/current/modules/${key}/enable`, {});
}
const department = {};
for (const [name, description] of [["Programs", "Field programs and community work"], ["Finance", "Budgets, payments and audits"], ["MEAL", "Monitoring, evaluation and learning"]]) {
	const already = EXISTING ? rows(`SELECT id FROM departments WHERE organization_id = ${org.id} AND lower(name) = lower('${name}')`)[0] : null;
	department[name] = already ? already.id : (await admin.api("/organizations/current/departments", { name, description })).id;
}
async function member(name, slug, role, team, position) {
	const someone = await person(name, slug);
	sql(`INSERT INTO user_profiles (user_id, organization_id, role, department_id, position) VALUES ('${someone.id}', ${org.id}, '${role}', ${department[team]}, '${position}')`);
	return someone;
}
const thura = await member("Thura Win", "thura", "manager", "Programs", "Programs Manager");
const moe = await member("Moe Thida", "moe", "manager", "MEAL", "MEAL Lead");
const sumon = await member("Su Mon", "sumon", "manager", "Finance", "Finance Manager");
const aye = await member("Aye Aye", "aye", "staff", "Programs", "Field Officer");
const komin = await member("Ko Min", "komin", "staff", "Programs", "Community Mobiliser");
const nilar = await member("Nilar", "nilar", "staff", "MEAL", "MEAL Officer");
const hnin = await member("Hnin Wai", "hnin", "staff", "Finance", "Finance Assistant");
const zaw = await member("Zaw Lin", "zaw", "staff", "Programs", "Field Officer");

await admin.api(`/capacity/reviewers/${department.Programs}`, { reviewerId: thura.id }, "PUT");
await admin.api(`/capacity/reviewers/${department.MEAL}`, { reviewerId: moe.id }, "PUT");
await admin.api(`/capacity/reviewers/${department.Finance}`, { reviewerId: sumon.id }, "PUT");

// Policies and news, so the rest of the app isn't empty around the modules.
const policy = (title, category, content, isMandatory = false) => admin.api("/policies", { title, category, content, status: "published", isMandatory });
await policy("Annual Leave Policy", "General", "Staff get 18 days of annual leave each year. Requests go to the line manager at least two weeks ahead.");
await policy("Safeguarding Policy", "General", "Everyone must report safeguarding concerns within 24 hours to the Safeguarding Focal Point.", true);
await policy("Field Travel Policy", "General", "Field travel needs a security check and approval from the Programs Manager.");
await admin.api("/announcements", { title: "Sample data for testing", content: "The projects, training and people added with this notice are made up, for demos and testing.", priority: "normal" });

// Projects, in different states.
async function project(values) {
	return (await admin.api("/projects", { folderTemplate: "standard", visibility: "organization", budgetCurrency: "USD", ...values })).id;
}
const clean = await project({
	name: "Clean Water for Kayah Villages", code: "WASH-2026", category: "wash", priority: "high", status: "in_progress",
	description: "Rehabilitate water points and train village water committees in 12 villages.", objectives: "Safe water for 12 villages.\nTrained committees that can maintain their water points.",
	expectedOutcomes: "4,800 people use safe water all year.", startDate: day(-210), endDate: day(155), funder: "Riverside Trust", budgetAmount: 120000, beneficiaryTarget: 4800,
	locations: "Kayah State", sdg: 6, reportingFrequency: "monthly", ownerId: projectOwner, managerId: thura.id,
	members: [{ userId: aye.id, role: "member" }, { userId: komin.id, role: "member" }, { userId: nilar.id, role: "member" }, { userId: sumon.id, role: "viewer" }],
});
const school = await project({
	name: "Back to School Support", code: "EDU-2026", category: "education", priority: "medium", status: "in_progress",
	description: "Learning kits and catch-up classes for children who missed school.", objectives: "Children return to learning.", startDate: day(-120), endDate: day(240), funder: "Learning Fund",
	budgetAmount: 65000, beneficiaryTarget: 1500, locations: "Bago Region", sdg: 4, reportingFrequency: "quarterly", ownerId: projectOwner, managerId: moe.id,
	members: [{ userId: nilar.id, role: "member" }, { userId: zaw.id, role: "member" }],
});
const clinic = await project({
	name: "Mobile Health Clinics", code: "HEALTH-2026", category: "health", priority: "high", status: "in_progress",
	description: "Monthly mobile clinics in hard-to-reach communities.", objectives: "Regular primary care in 8 communities.", startDate: day(-300), endDate: day(60), funder: "Health Partners",
	budgetAmount: 90000, beneficiaryTarget: 3200, locations: "Shan State", sdg: 3, reportingFrequency: "monthly", ownerId: projectOwner, managerId: thura.id,
	members: [{ userId: zaw.id, role: "member" }, { userId: hnin.id, role: "viewer" }],
});
await project({ name: "Livelihoods Pilot", code: "LIV-2027", category: "livelihoods", priority: "low", status: "planned", description: "Small grants for women-led groups. Still being planned.", startDate: day(60), endDate: day(420), funder: "To be confirmed", budgetAmount: 40000, beneficiaryTarget: 300, reportingFrequency: "quarterly", ownerId: projectOwner, managerId: moe.id });

await admin.api(`/projects/${clean}/health`, { health: "needs_attention", reason: "Pump parts are delayed at the border, so two villages may slip a month." });
await admin.api(`/projects/${school}/health`, { health: "healthy", reason: "" });
await admin.api(`/projects/${clinic}/health`, { health: "at_risk", reason: "The clinic vehicle is out of service and August's visits were missed." });
for (const [id, title, due, done] of [
	[clean, "Baseline survey finished", -150, true], [clean, "Water committees formed", -90, true], [clean, "First 6 water points repaired", -20, false], [clean, "All 12 water points repaired", 90, false],
	[school, "Learning kits delivered", -60, true], [school, "Catch-up classes start", 15, false],
	[clinic, "Clinic schedule agreed", -250, true], [clinic, "Replace clinic vehicle", -10, false], [clinic, "Final report to funder", 75, false],
]) {
	const created = await admin.api(`/projects/${id}/milestones`, { title, dueDate: day(due) });
	if (done && created?.id) await admin.api(`/projects/${id}/milestones/${created.id}`, { completed: true, status: "done", done: true }, "PATCH");
}

for (const [name, text] of [
	["Water point tracker.csv", "Village,Water point,Status,Households\nDaw Ta Mi,Hand pump 1,Repaired,48\nHoya,Hand pump 2,Repaired,62\nLoikaw East,Well 3,Waiting for parts,55\n"],
	["Committee members.csv", "Village,Members,Trained\nDaw Ta Mi,5,5\nHoya,5,4\nLoikaw East,5,5\n"],
]) {
	const response = await fetch(`${BASE}/api/projects/${clean}/files?name=${encodeURIComponent(name)}`, { method: "POST", headers: { origin: BASE, cookie: admin.cookie(), "content-type": "text/csv" }, body: text });
	if (!response.ok) problems.push(`upload ${name}: ${response.status}`);
}

// Reports: approved, waiting for review, sent back, and a draft.
const month = (offset) => { const date = new Date(); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + offset); return date.toISOString().slice(0, 7); };
async function report(who, id, period, values, outcome) {
	const created = await who.api(`/projects/${id}/reports`, { type: "form", period, ...values });
	if (!created?.id || outcome === "draft") return;
	await who.api(`/projects/${id}/reports/${created.id}/submit`, {});
	if (outcome === "approved") await admin.api(`/projects/${id}/reports/${created.id}/decision`, { decision: "approve", comment: "Thanks, clear and complete." });
	if (outcome === "revise") await admin.api(`/projects/${id}/reports/${created.id}/decision`, { decision: "revise", comment: "Please add how many households each water point serves." });
}
await report(aye, clean, month(-3), { activities: "Finished the baseline survey in all 12 villages.", challenges: "Heavy rain delayed two visits.", nextPlan: "Form the water committees.", beneficiaries: 900, budgetSpent: 18000 }, "approved");
await report(aye, clean, month(-2), { activities: "Formed 12 water committees and trained 60 members.", challenges: "Some villages needed a second session.", nextPlan: "Start repairs.", beneficiaries: 1450, budgetSpent: 22500 }, "approved");
await report(aye, clean, month(-1), { activities: "Repaired 3 water points.", challenges: "Pump parts are delayed at the border.", nextPlan: "Repair 3 more when the parts arrive.", beneficiaries: 2100, budgetSpent: 26000 }, "revise");
await report(komin, clean, month(0), { activities: "Community meetings in 5 villages.", nextPlan: "Check the parts delivery." }, "draft");
await report(zaw, clinic, month(-2), { activities: "Ran 8 mobile clinics and saw 640 patients.", challenges: "Road access in two communities.", nextPlan: "Keep the monthly schedule.", beneficiaries: 640, budgetSpent: 15000 }, "approved");
await report(zaw, clinic, month(-1), { activities: "Clinic vehicle broke down, so only 3 clinics ran.", challenges: "No replacement vehicle yet.", nextPlan: "Hire a vehicle for next month.", beneficiaries: 210, budgetSpent: 9000 }, "submitted");
await report(nilar, school, `${new Date().getUTCFullYear()}-Q3`, { activities: "Delivered 1,200 learning kits.", challenges: "Some schools were closed.", nextPlan: "Start catch-up classes.", beneficiaries: 1200, budgetSpent: 21000 }, "submitted");

// Training, in every review state.
const training = (title, category, extra = {}) => ({ title, category, format: "in_person", startDate: day(-60), endDate: day(-58), durationValue: 3, durationUnit: "training_days", trainingStatus: "completed", objectives: "Build skills for field work.", provider: "Local training partner", language: "both", locationMode: "region", region: "Bago", reflection: "Useful, and I've started using it at work.", ...extra });
async function record(who, values, outcome, reviewer) {
	const created = await who.api("/capacity/records", values);
	if (!created?.id || outcome === "draft") return;
	await who.api(`/capacity/records/${created.id}/submit`, {});
	if (outcome === "submitted") return;
	const comments = { verified: "", changes: "Please add the dates on your certificate.", reject: "This training isn't related to your role." };
	await reviewer.api(`/capacity/reviews/${created.id}/decision`, { decision: outcome === "verified" ? "verify" : outcome, comment: comments[outcome], version: 1 });
}
await record(aye, training("Project Cycle Management", "project_management"), "verified", thura);
await record(aye, training("PSEA Essentials", "safeguarding"), "verified", thura);
await record(aye, training("Community Feedback Mechanisms", "community", { startDate: day(-30), endDate: day(-29), durationValue: 2 }), "submitted");
await record(komin, training("Facilitation Skills", "communication"), "verified", thura);
await record(komin, training("First Aid Refresher", "health", { durationValue: 8, durationUnit: "contact_hours" }), "changes", thura);
await record(zaw, training("Data Collection with Kobo", "meal"), "verified", thura);
await record(zaw, training("Road Safety for Field Staff", "safety"), "submitted");
await record(nilar, training("Survey Design", "meal"), "verified", moe);
await record(nilar, training("Data Analysis Basics", "meal", { startDate: day(20), endDate: day(22), trainingStatus: "applied", reflection: "" }), "draft");
await record(moe, training("Leadership for Team Leads", "leadership", { reviewerNote: "" }), "submitted");
await record(hnin, training("Budget Monitoring", "finance"), "verified", sumon);
await record(hnin, training("Excel for Finance", "digital", { format: "online", locationMode: "online" }), "reject", sumon);
await record(thura, training("Managing Donor Reports", "project_management", { startDate: day(25), endDate: day(26), trainingStatus: "applied", reflection: "" }), "draft");

// Skills, assessments and the opt-in directory.
await admin.api("/capacity/skills/starter", {});
const rubric = ["Knows the basics of good questions", "Writes a short survey with help", "Designs and tests a survey alone", "Designs complex multi-site surveys", "Teaches others survey design"];
const skills = (await admin.api("/capacity/skills")).skills;
const skill = (name) => skills.find((item) => item.name === name);
const survey = skill("Survey design");
await admin.api(`/capacity/skills/${survey.id}`, { name: survey.name, category: survey.category, rubric, revalidateMonths: 24 }, "PUT");
async function assess(who, reviewer, name, level, evidence, feedback) {
	await who.api("/capacity/my-skills", { skillId: skill(name).id, level, evidence });
	if (!reviewer) return;
	const mine = (await who.api("/capacity/my-skills")).skills.find((item) => item.name === name);
	await reviewer.api(`/capacity/assessments/${mine.id}`, { level, feedback });
	await who.api(`/capacity/my-skills/${mine.id}/share`, { shared: true }, "PUT");
}
await assess(nilar, moe, "Survey design", 4, "Designed the baseline survey for 12 villages.", "Strong, well-tested work.");
await assess(nilar, moe, "Data analysis", 3, "Built the quarterly dashboards.", "Works independently.");
await assess(aye, thura, "Community mobilisation", 3, "Led village meetings for the water project.", "Communities trust her work.");
await assess(aye, null, "Report writing", 3, "Writes the monthly water project reports.");
await assess(komin, thura, "Facilitation", 4, "Ran committee training in 12 villages.", "Clear and well prepared.");
await assess(hnin, sumon, "Budget monitoring", 3, "Prepares the monthly budget tracking.", "Accurate every month.");
await assess(zaw, null, "Kobo / ODK data collection", 3, "Set up the clinic forms in Kobo.");
const card = (who, bio, extra = {}) => who.api("/directory/me", { listed: true, picture: "initials", showTitle: true, showTeam: true, bio, ...extra }, "PUT");
await admin.api("/directory/settings", { showTeams: true, allowPhotos: false, allowDisplayNames: true }, "PUT");
await card(nilar, "Ask me about surveys and data.");
await card(aye, "Happy to help with community meetings.");
await card(komin, "Facilitation and committee training.");
await card(hnin, "Budgets and donor financial rules.");
await card(zaw, "Keeps the clinics on the road.", { displayName: "River" });

// Something waiting for the owner, so reviewing can be tried from their own account.
if (EXISTING) {
	await admin.api(`/capacity/reviewers/${department.Finance}`, { reviewerId: projectOwner }, "PUT");
	await record(hnin, training("Procurement Basics", "finance", { startDate: day(-12), endDate: day(-11), durationValue: 2 }), "submitted");
	await assess(hnin, null, "Donor reporting", 3, "Prepared the Riverside Trust financial report.");
}

console.log(JSON.stringify({ organization: NAME, organizationId: org.id, password: "from DEMO_PASSWORD", logins: { admin: admin.email, programsManager: thura.email, mealLead: moe.email, staff: aye.email, staffNilar: nilar.email, staffKoMin: komin.email } }, null, 1));
console.log(problems.length ? `Problems:\n${problems.join("\n")}` : "No problems.");
