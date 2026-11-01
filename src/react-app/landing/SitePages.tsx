import { useEffect, useState, type ReactNode } from "react";
import { CONTACT_EMAIL, FACEBOOK_URL, HeroTiles, hubUrl, Icon, LOGO, SiteFooter, SiteNav, usePageMeta, type NavPage } from "./site";

import { POSTS, postHeadingId, readMinutes, type BlogPost } from "./blog-posts";
import { Float, FloatIcon, FloatText, PhoneShowcase, Reveal, Ring, Showcase, ShotImage, type Tone } from "./showcase";

type IconName = Parameters<typeof Icon>[0]["name"];

const SIGN_UP = hubUrl("/sign-up");

function earlyAccessLink(module: string) {
	return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`${module} early access`)}`;
}

function PageShell({
	title,
	seoTitle,
	description,
	page,
	children,
}: {
	title: string;
	seoTitle?: string;
	description: string;
	page?: NavPage;
	children: ReactNode;
}) {
	usePageMeta(seoTitle ?? `${title} | AidNova`, description);
	return (
		<div className="page">
			<SiteNav page={page} />
			<main>{children}</main>
			<SiteFooter />
		</div>
	);
}

function PageHero({
	eyebrow,
	chip,
	title,
	lead,
	actions,
	trust,
	note,
}: {
	eyebrow: string;
	chip?: string;
	violet?: boolean;
	title: string;
	lead: string;
	actions?: ReactNode;
	trust?: { icon: IconName; label: string }[];
	note?: string;
}) {
	return (
		<section className="section hero page-hero">
			{chip && <HeroTiles />}
			{chip ? (
				<span className="hero-badge">
					<span>{eyebrow}</span>
					{chip}
				</span>
			) : (
				<span className="eyebrow">{eyebrow}</span>
			)}
			<h1 className="hero-title">{title}</h1>
			<p className="hero-lead">{lead}</p>
			{actions && <div className="hero-actions">{actions}</div>}
			{note && <p className="page-hero-note">{note}</p>}
			{trust && (
				<ul className="trust-list">
					{trust.map((item) => (
						<li key={item.label}>
							<Icon name={item.icon} />
							{item.label}
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

function SectionHead({ eyebrow, title, lead }: { eyebrow?: string; title: string; lead?: string }) {
	return (
		<div className="section-center">
			{eyebrow && <span className="eyebrow">{eyebrow}</span>}
			<h2 className="section-title">{title}</h2>
			{lead && <p className="section-lead">{lead}</p>}
		</div>
	);
}

function CheckList({ items }: { items: string[] }) {
	return (
		<ul className="check-list">
			{items.map((item) => (
				<li key={item}>
					<Icon name="check" size={16} color="var(--primary)" />
					{item}
				</li>
			))}
		</ul>
	);
}

function Steps({ steps }: { steps: { title: string; text: string }[] }) {
	return (
		<ol className="steps" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(${steps.length > 3 ? 220 : 280}px, 100%), 1fr))` }}>
			{steps.map((step, index) => (
				<li key={step.title}>
					<span>Step {index + 1}</span>
					<h3>{step.title}</h3>
					<p>{step.text}</p>
				</li>
			))}
		</ol>
	);
}

function Questions({ items }: { items: { q: string; a: string }[] }) {
	return (
		<section className="section questions">
			<SectionHead eyebrow="FAQ" title="Common questions, clear answers" />
			<div className="question-list">
				{items.map((item, index) => (
					<details key={item.q} open={index === 0}>
						<summary>{item.q}</summary>
						<p>{item.a}</p>
					</details>
				))}
			</div>
		</section>
	);
}

function PageCta({ title, text, label, href = SIGN_UP }: { title: string; text: string; label: string; href?: string }) {
	return (
		<section className="section cta-section">
			<div className="cta">
				<img className="showcase-mark" src="/blog-mark.webp" alt="" />
				<h2>{title}</h2>
				<p>{text}</p>
				<a href={href} className="btn btn-white">
					{label}
				</a>
			</div>
		</section>
	);
}

function ShowRow({
	id,
	eyebrow,
	title,
	lead,
	points,
	flip = false,
	action,
	children,
}: {
	id?: string;
	eyebrow: string;
	title: string;
	lead: string;
	points?: string[];
	flip?: boolean;
	action?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section id={id} className="section show-section">
			<Reveal className={flip ? "show-row show-row-flip" : "show-row"}>
				<div className="show-copy">
					<span className="eyebrow">{eyebrow}</span>
					<h2 className="section-title">{title}</h2>
					<p>{lead}</p>
					{points && <CheckList items={points} />}
					{action}
				</div>
				<div className="show-visual">{children}</div>
			</Reveal>
		</section>
	);
}

function HeroShowcase({ children }: { children: ReactNode }) {
	return (
		<section className="section hero-showcase">
			<Reveal>{children}</Reveal>
			<p className="note">Illustrative data</p>
		</section>
	);
}

function FeaturesPage() {
	const anchors = [
		["policies", "Policies"],
		["learning", "Learning Hub"],
		["hub-files", "Employee Hub & files"],
		["announcements", "Announcements & calendar"],
		["team", "Team & access"],
		["reports", "Reports"],
		["modules", "New modules"],
	];
	return (
		<PageShell
			title="Features"
			seoTitle="NGO Policy Management and Staff Training Features | AidNova"
			page="features"
			description="Policies, training, files and team records in one secure place, in English and Myanmar, on any device."
		>
			<PageHero
				eyebrow="Features"
				chip="Everything in one workspace"
				title="Everything your team needs, nothing they don’t."
				lead="Policies, training, files and team records in one secure place — in English and Myanmar, on any device."
				actions={
					<>
						<a href={SIGN_UP} className="btn btn-primary">Start your free trial</a>
						<a href="/pricing" className="btn btn-outline">See pricing</a>
					</>
				}
				trust={[
					{ icon: "shield", label: "Role-based access" },
					{ icon: "lock", label: "PIN-protected files" },
					{ icon: "globe", label: "English and Myanmar" },
					{ icon: "phone", label: "Installs on phones" },
				]}
			/>
			<HeroShowcase>
				<Showcase wide name="dashboard" alt="The AidNova dashboard, with policy acknowledgment, course completion and what needs attention" tone="blue">
					<Float at="tl">
						<Ring value={86} />
						<FloatText title="Policy acknowledgment" text="36 of 42 staff" />
					</Float>
					<Float at="br">
						<FloatIcon name="star" tone="#22a076" />
						<FloatText title="Certificate issued" text="Field Safety Training" />
					</Float>
				</Showcase>
			</HeroShowcase>
			<nav className="anchor-pills" aria-label="On this page">
				{anchors.map(([id, label]) => (
					<a key={id} href={`#${id}`}>{label}</a>
				))}
			</nav>
			<ShowRow
				id="policies"
				eyebrow="Policies"
				title="Publish once. Know who has read it."
				lead="Upload a policy, choose who needs it, and track acknowledgments as they come in."
				points={["A new version asks everyone to acknowledge again", "Mandatory or optional, by department", "Send a reminder to people who haven’t acknowledged"]}
			>
				<Showcase name="policies" alt="The Policies page, with acknowledgment progress for each policy and a list of who is still pending" tone="blue">
					<Float at="bl">
						<FloatIcon name="check" tone="#22a076" />
						<FloatText title="Reminder sent" text="to 6 people" />
					</Float>
				</Showcase>
			</ShowRow>
			<ShowRow
				id="learning"
				flip
				eyebrow="Learning Hub"
				title="Courses staff actually finish."
				lead="Build courses from videos, PDFs and slides. Add a quiz, and issue a certificate when someone passes."
				points={["Lessons in order, with progress saved", "Quizzes with a pass mark", "Printable certificates"]}
			>
				<Showcase name="lesson" alt="A course lesson, with the lesson list on the left and the document on the right" tone="violet">
					<div className="float-shot float-br" aria-hidden="true">
						<ShotImage name="certificate" alt="" />
					</div>
				</Showcase>
			</ShowRow>
			<ShowRow
				id="hub-files"
				eyebrow="Employee Hub & files"
				title="One search for everything staff need."
				lead="Policies, courses, documents and useful links, all in one place."
				points={["Files limited to departments", "Sensitive files locked with a PIN", "Links to Google Drive folders alongside your own files"]}
				action={<a className="show-link" href="/employee-hub">See the Employee Hub →</a>}
			>
				<Showcase name="hub" alt="The Employee Hub search, showing an answer about annual leave and results from policies, courses and files" tone="green">
					<Float at="tr">
						<FloatIcon name="lock" tone="#0066f5" />
						<FloatText title="Only what you can access" />
					</Float>
				</Showcase>
			</ShowRow>
			<ShowRow
				id="announcements"
				flip
				eyebrow="Announcements & calendar"
				title="Tell everyone, at the right time."
				lead="Post urgent notices in the app, and keep trainings and meetings on one calendar."
				points={["Urgent, important and general announcements", "Trainings and meetings on a shared calendar", "Add events to Google or Outlook"]}
			>
				<Showcase name="calendar" alt="The team calendar for November, with trainings, meetings and deadlines" tone="amber">
					<Float at="bl">
						<span className="float-urgent">Urgent</span>
						<FloatText title="Fire drill — Friday 2 PM" />
					</Float>
				</Showcase>
			</ShowRow>
			<ShowRow
				id="team"
				eyebrow="Team & access"
				title="Everyone sees only what they should."
				lead="Set up departments and roles once. AidNova shows each person what fits their role."
				points={["Staff, manager and admin roles", "Departments for policies and files", "Open any person’s profile to see their progress"]}
			>
				<Showcase name="users" alt="The People page, listing staff with their role, department, policies and learning" tone="dark">
					<div className="float-shot float-br float-shot-wide" aria-hidden="true">
						<ShotImage name="profile" alt="" />
					</div>
				</Showcase>
			</ShowRow>
			<ShowRow
				id="reports"
				flip
				eyebrow="Reports"
				title="Ready when your donor asks."
				lead="See completion and acknowledgment at a glance, and export to CSV for donors and audits."
				points={["Policy acknowledgment reports", "Course completion reports", "CSV export any time"]}
			>
				<Showcase name="reports" alt="The Reports page, with acknowledgment and completion figures, a monthly chart and a table by department" tone="blue">
					<Float at="tr">
						<FloatIcon name="file" tone="#0066f5" />
						<FloatText title="Export CSV" text="Acknowledgments · Oct" />
					</Float>
				</Showcase>
			</ShowRow>
			<section id="modules" className="section">
				<SectionHead eyebrow="New modules" title="Growing with your organization." lead="Optional modules your admin can switch on." />
				<div className="module-links">
					{(
						[
							{ href: "/projects", tag: "Early access", title: "Projects", text: "Project files with versions, reports with approval, and dashboards from your spreadsheets.", shot: "project-overview", tone: "green" },
							{ href: "/capacity-building", tag: "Early access", title: "Capacity Building", text: "Staff training reports, reviews and skills — private by default.", shot: "cb-training", tone: "violet" },
							{ href: "/ai", tag: "In AidNova", title: "AI", text: "Answers from your own documents, with the source named.", shot: "hub", tone: "amber" },
						] as { href: string; tag: string; title: string; text: string; shot: string; tone: Tone }[]
					).map((module) => (
						<a key={module.title} href={module.href} className="module-link">
							<div className={`module-art showcase-${module.tone}`} aria-hidden="true">
								<ShotImage name={module.shot} alt="" />
							</div>
							<span className={`status-pill status-${module.tag === "In AidNova" ? "success" : "violet"}`}>{module.tag}</span>
							<h3>{module.title}</h3>
							<p>{module.text}</p>
							<span className="post-read">Learn more →</span>
						</a>
					))}
				</div>
			</section>
			<PageCta title="See it with your own team." text="14-day free trial. Set up in under an hour." label="Start your free trial" />
		</PageShell>
	);
}

function EmployeeHubPage() {
	return (
		<PageShell
			title="Employee Hub"
			seoTitle="Employee Hub for NGOs: Policies, Courses and Files | AidNova"
			page="hub"
			description="A secure home for your staff: policies, courses, files and announcements in one place, in English and Myanmar, on any phone."
		>
			<PageHero
				eyebrow="Employee Hub"
				chip="One place for your team"
				title="Everything your staff need, right where they look."
				lead="Give everyone a secure home for policies, courses, documents and useful links. One search, less chasing."
				actions={
					<>
						<a href={SIGN_UP} className="btn btn-primary">Start your free trial</a>
						<a href="#read" className="btn btn-outline">See how it works</a>
					</>
				}
				trust={[
					{ icon: "search", label: "One search" },
					{ icon: "shield", label: "Only what you can access" },
					{ icon: "globe", label: "English and Myanmar" },
					{ icon: "phone", label: "Installs on phones" },
				]}
			/>
			<HeroShowcase>
				<Showcase wide name="hub" alt="The Employee Hub search, showing an answer about annual leave and results from policies, courses and files" tone="blue">
					<Float at="tl">
						<FloatIcon name="spark" tone="#753ff3" />
						<FloatText title="Ask in English or မြန်မာ" text="Answers name the source" />
					</Float>
					<Float at="br">
						<FloatIcon name="lock" tone="#0066f5" />
						<FloatText title="Payroll calendar 2026" text="Finance only · PIN protected" />
					</Float>
				</Showcase>
			</HeroShowcase>
			<ShowRow
				id="phone"
				flip
				eyebrow="On any phone"
				title="Staff always know what’s next."
				lead="Everyone opens to their own list: the policies to read, the courses to finish, and what’s new. Add it to your phone’s home screen like an app."
				points={["What to do first, right at the top", "Announcements in one feed", "No new system to learn"]}
			>
				<PhoneShowcase name="mobile-staff" alt="AidNova on a phone, showing Aye Aye’s to-do list, announcements and what’s next" tone="violet">
					<Float at="tr">
						<FloatIcon name="phone" tone="#753ff3" />
						<FloatText title="Installs on phones" />
					</Float>
				</PhoneShowcase>
			</ShowRow>
			<ShowRow
				id="read"
				eyebrow="Policies"
				title="Read it. Confirm it. Done."
				lead="Staff read the policy in their language and confirm with one click. You get the record, without chasing replies."
				points={["Switch between English and Myanmar", "Open the signed PDF", "A saved record of each acknowledgment"]}
			>
				<Showcase name="policy-read" alt="A staff member reading the Safeguarding Policy, with the acknowledge button at the bottom" tone="blue" />
			</ShowRow>
			<ShowRow
				id="learn"
				flip
				eyebrow="Courses"
				title="Learning that’s easy to pick up."
				lead="Staff see their assigned courses and carry on where they left off. Pass the quiz, and the certificate is ready to print."
				points={["Progress saved as they go", "Quizzes with a pass mark", "Certificates kept on their profile"]}
			>
				<Showcase name="courses" alt="The course catalog, with progress on each course" tone="green">
					<div className="float-shot float-br" aria-hidden="true">
						<ShotImage name="certificate" alt="" />
					</div>
				</Showcase>
			</ShowRow>
			<ShowRow
				id="files"
				eyebrow="Files"
				title="The right files, for the right people."
				lead="Keep documents and links in shared folders, and limit each one to the departments that need it."
				points={["Files limited to departments", "Sensitive files locked with a PIN", "Links to Google Drive folders alongside your own files"]}
			>
				<Showcase name="files" alt="The Files page, with HR folders and who each file is shared with" tone="amber" />
			</ShowRow>
			<ShowRow
				id="ask"
				flip
				eyebrow="Ask AidNova"
				title="Ask instead of digging."
				lead="Staff can ask a question in English or Myanmar, and the assistant answers from your policies and files, and names the source."
				action={<a className="show-link" href="/ai">See how the AI works →</a>}
			>
				<PhoneShowcase name="mobile-ask" alt="The Ask AidNova assistant on a phone" tone="dark" />
			</ShowRow>
			<PageCta title="Give your team a better home." text="14-day free trial. Set up in under an hour." label="Start your free trial" />
		</PageShell>
	);
}

function Check({ label }: { label: string }) {
	return (
		<span role="img" aria-label={label}>
			<Icon name="check" size={18} color="var(--primary)" />
		</span>
	);
}

const COMPARE: { feature: string; basic: string | boolean; plus: string | boolean }[] = [
	{ feature: "Users", basic: "Up to 50", plus: "100 · add more in blocks of 25" },
	{ feature: "Policies and acknowledgments", basic: true, plus: true },
	{ feature: "Courses, quizzes and certificates", basic: true, plus: true },
	{ feature: "Hub, files and team calendar", basic: true, plus: true },
	{ feature: "Department access and PIN-protected files", basic: true, plus: true },
	{ feature: "English and Myanmar", basic: true, plus: true },
	{ feature: "AI assistant (beta)", basic: true, plus: true },
	{ feature: "Reports for donors and audits", basic: true, plus: true },
	{ feature: "Support", basic: "Email", plus: "Priority" },
	{ feature: "Projects", basic: "Early access", plus: "Early access" },
	{ feature: "Capacity Building", basic: "Early access", plus: "Early access" },
];

const MAX_BLOCKS = 8;
const CHIP_BLOCKS = [1, 2, 3, 4, 6, 8];

function money(value: number) {
	return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function UserCalculator() {
	const [blocks, setBlocks] = useState(2);
	const [yearly, setYearly] = useState(false);
	const custom = blocks > MAX_BLOCKS;
	const users = 100 + 25 * Math.min(blocks, MAX_BLOCKS);
	const monthly = 60 + 10 * Math.min(blocks, MAX_BLOCKS);
	const annual = monthly * 10;
	const perMonth = yearly ? annual / 12 : monthly;
	const saving = yearly ? users * 0.6 * 12 - annual : users * 0.6 - monthly;
	const quoteLink = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
		custom ? "Quotation for more than 300 users" : `Quotation for ${users} users`,
	)}`;
	return (
		<div className="calculator">
			<div className="calculator-input">
				<div className="calculator-top">
					<strong>How many people will use AidNova?</strong>
					<div className="segmented segmented-primary" role="group" aria-label="Billing period">
						<button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button>
						<button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>Yearly · 2 months free</button>
					</div>
				</div>
				<div className="calculator-stepper">
					<button type="button" aria-label="Fewer users" disabled={blocks === 0} onClick={() => setBlocks(blocks - 1)}>−</button>
					<div aria-live="polite">
						<strong>{custom ? "300+" : users}</strong>
						<span>
							users ·{" "}
							{custom ? "custom quotation" : blocks === 0 ? "Plus plan, no add-ons" : `Plus + ${25 * blocks} add-on users`}
						</span>
					</div>
					<button type="button" aria-label="More users" disabled={custom} onClick={() => setBlocks(blocks + 1)}>+</button>
				</div>
				<div className="calculator-chips">
					{CHIP_BLOCKS.map((value) => (
						<button key={value} type="button" aria-pressed={blocks === value} onClick={() => setBlocks(value)}>
							{100 + 25 * value}
						</button>
					))}
					<button type="button" aria-pressed={custom} onClick={() => setBlocks(MAX_BLOCKS + 1)}>300+</button>
				</div>
				<p>Add-ons are available on Plus. Basic teams upgrade to Plus first. Annual price is always 10× the monthly price.</p>
			</div>
			<div className="calculator-result">
				{custom ? (
					<>
						<strong className="calculator-custom">More than 300 users?</strong>
						<p>We’ll prepare a custom quotation with a lower volume rate for your organization.</p>
						<a href={quoteLink} className="btn btn-primary">Request a quotation</a>
					</>
				) : (
					<>
						<span>Your price</span>
						<p className="calculator-price">
							{money(yearly ? annual : monthly)}
							<small>{yearly ? " /year" : " /month"}</small>
						</p>
						<span>${(perMonth / users).toFixed(2)} per user per month</span>
						<dl>
							<div><dt>Plus plan · 100 users</dt><dd>$60</dd></div>
							<div>
								<dt>{blocks === 0 ? "No add-on users" : `Add-on · ${25 * blocks} users (${blocks} × 25 @ $10)`}</dt>
								<dd>{money(10 * blocks)}</dd>
							</div>
							<div className="calculator-total"><dt>Monthly total</dt><dd>{money(monthly)}</dd></div>
							<div><dt>Yearly (×10)</dt><dd>{money(annual)}</dd></div>
						</dl>
						<p className="calculator-saving">
							<Icon name="check" size={16} color="#14795a" />
							{saving > 0
								? `You save ${money(saving)} ${yearly ? "a year" : "a month"} compared with $0.60 per user`
								: "Add users to lower your cost per person"}
						</p>
						<a href={SIGN_UP} className="btn btn-primary">Start free trial</a>
						<a href={quoteLink} className="btn btn-outline">Get a written quotation</a>
					</>
				)}
			</div>
		</div>
	);
}

function PricingPage() {
	return (
		<PageShell
			title="Pricing"
			seoTitle="Pricing for NGOs: One Price per Organization | AidNova"
			page="pricing"
			description="One price per organization, not per person. Basic is $30 a month for up to 50 users and Plus is $60 a month for up to 100."
		>
			<PageHero
				eyebrow="Pricing"
				title="Simple, honest pricing."
				lead="One price per organization, not per person. Every workspace starts with a 14-day free trial of the full product."
			/>
			<section className="section plans-section">
				<div className="plans">
					<div className="plan-card">
						<h2>Basic</h2>
						<p>For growing organizations</p>
						<p className="plan-price">$30<small> /month</small></p>
						<p className="plan-year">or $300 /year — 2 months free</p>
						<strong>Up to 50 users</strong>
						<CheckList items={["Policies and acknowledgments", "Courses, quizzes and certificates", "Hub, files and team calendar", "AI assistant (beta)", "Email support"]} />
						<a href={SIGN_UP} className="btn btn-outline">Start free trial</a>
					</div>
					<div className="plan-card plan-featured">
						<span className="plan-flag">For larger teams</span>
						<h2>Plus</h2>
						<p>Everything your organization needs to scale</p>
						<p className="plan-price">$60<small> /month</small></p>
						<p className="plan-year">or $600 /year — 2 months free</p>
						<strong>Up to 100 users</strong>
						<CheckList items={["Everything in Basic", "English and Myanmar", "Reports for donors and audits", "Access by department and role", "Priority support"]} />
						<a href={SIGN_UP} className="btn btn-primary">Start free trial</a>
					</div>
				</div>
				<p className="note">
					Prices in USD per organization. Need more than 100 users? <a href="#add-users">Add users in blocks of 25</a>.
				</p>
			</section>
			<section className="section compare-section">
				<SectionHead title="Compare plans" />
				<div className="table-card compare-table">
					<table>
						<thead>
							<tr>
								<th scope="col">Feature</th>
								<th scope="col">Basic<small>$30 /month</small></th>
								<th scope="col">Plus<small>$60 /month</small></th>
							</tr>
						</thead>
						<tbody>
							{COMPARE.map((row) => (
								<tr key={row.feature}>
									<th scope="row">{row.feature}</th>
									{[row.basic, row.plus].map((value, index) => (
										<td key={index}>
											{value === true ? <Check label="Included" /> : value === false ? <span aria-label="Not included">—</span> : value}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<p className="note">Early-access modules are turned on per organization when they’re ready.</p>
			</section>
			<section className="section">
				<SectionHead eyebrow="How buying works" title="No sales calls. No surprises." lead="Upgrades are confirmed by our team, so you always know what you’re paying for." />
				<div className="cards-after-head">
					<Steps
						steps={[
							{ title: "Start your trial", text: "14 days of the full product. No card needed." },
							{ title: "Set up your team", text: "Add departments and staff, and publish your first policy." },
							{ title: "Request an upgrade", text: "From Plan & usage inside the app. We’ll confirm your plan and activate it." },
						]}
					/>
				</div>
			</section>
			<section id="add-users" className="section">
				<SectionHead
					eyebrow="More than 100 users"
					title="Add users as you grow."
					lead="Plus covers 100 users. Add more in blocks of 25 for $10 a month per block — $0.40 per extra user. The more you add, the lower your cost per person."
				/>
				<div className="cards-after-head">
					<UserCalculator />
				</div>
			</section>
			<Questions
				items={[
					{ q: "Is the price per user?", a: "No. The price is per organization. Basic covers up to 50 users and Plus up to 100." },
					{ q: "What happens when the trial ends?", a: "Request an upgrade from inside the app and we’ll activate your plan. Your policies, courses and records stay as you left them." },
					{ q: "Can I pay yearly?", a: "Yes. Yearly plans cost the same as 10 months: $300 for Basic and $600 for Plus." },
					{ q: "Can I change plans later?", a: "Yes. Ask for a different plan from Plan & usage in the app." },
					{ q: "Can we cancel?", a: "Yes. Give us 30 days’ notice. There’s no long-term contract." },
					{ q: "We have more than 100 staff.", a: "Add users to Plus in blocks of 25 for $10 a month per block. For more than 300 users, ask us for a custom quotation." },
					{ q: "When does a new user block start?", a: "From your next billing cycle after you accept. Your data, users and settings carry over with no interruption." },
				]}
			/>
			<PageCta title="Try everything free for 14 days." text="Set up your workspace in minutes. No card needed." label="Start your free trial" />
		</PageShell>
	);
}

const FAQ_GROUPS: { id: string; icon: IconName; title: string; items: { q: string; a: string }[] }[] = [
	{
		id: "getting-started",
		icon: "spark",
		title: "Getting started",
		items: [
			{ q: "How quickly can we get set up?", a: "Most teams are up and running in under an hour: create your workspace, add your staff, and publish your first policy." },
			{ q: "Do staff need training to use AidNova?", a: "Staff see a simple home with the policies to read, courses to take and files they can open. Most people find their way around in a few minutes." },
			{ q: "Can staff use it on their phones?", a: "Yes. AidNova works in the browser on phones and computers, and can be installed on a phone’s home screen." },
		],
	},
	{
		id: "pricing",
		icon: "chart",
		title: "Pricing & plans",
		items: [
			{ q: "How much does it cost?", a: "Basic is $30 a month for up to 50 users. Plus is $60 a month for up to 100 users. Yearly plans cost the same as 10 months." },
			{ q: "What happens when the trial ends?", a: "Request an upgrade from inside the app and we’ll activate your plan. Your policies, courses and records stay as you left them." },
			{ q: "We have more than 100 staff.", a: "Add users to Plus in blocks of 25 for $10 a month per block. For more than 300 users, email helloaidnova@gmail.com for a quotation." },
			{ q: "Can we cancel?", a: "Yes. Give us 30 days’ notice. There’s no long-term contract." },
		],
	},
	{
		id: "access",
		icon: "shield",
		title: "Access & privacy",
		items: [
			{ q: "Who can see our staff information?", a: "Access follows roles. Managers and admins see full profiles and learning records; staff can’t open each other’s." },
			{ q: "Can we limit files to certain people?", a: "Yes. Files and policies can be limited to departments, and sensitive files locked with a PIN." },
			{ q: "Can other organizations see our data?", a: "No. Each organization’s workspace is kept separate, and only people you add can sign in to it." },
		],
	},
	{
		id: "language",
		icon: "globe",
		title: "Language",
		items: [
			{ q: "Does AidNova work in Myanmar?", a: "Yes. The whole interface switches between English and Myanmar, and you can publish policies and courses in either language." },
			{ q: "Can we have the same policy in both languages?", a: "Yes. Publish a version in each language so staff can read the one they prefer." },
		],
	},
	{
		id: "reports",
		icon: "file",
		title: "Reports & donors",
		items: [
			{ q: "Can we export reports for donors or audits?", a: "Yes. Managers and admins can export CSV reports of policy acknowledgments and course completions anytime." },
			{ q: "Do certificates show who completed a course?", a: "Yes. Certificates include the staff member’s name, the course and the date, and can be printed." },
		],
	},
	{
		id: "modules",
		icon: "folder",
		title: "Projects, Capacity Building & AI",
		items: [
			{ q: "Are Projects and Capacity Building available now?", a: "They’re built and rolling out in stages. Once a module is available for your organization, an admin turns it on in Settings. Capacity Building and People & Skills ask for a short privacy and safety review first. Want it sooner? Email us and we’ll check." },
			{ q: "Can the AI see files I can’t open?", a: "No. It only uses content you could open yourself, and it names the source it used." },
			{ q: "Does the AI make decisions?", a: "No. It answers questions, but approvals and changes always need a person." },
		],
	},
];

function FaqPage() {
	const [search, setSearch] = useState("");
	const text = search.trim().toLowerCase();
	const groups = FAQ_GROUPS.map((group) => ({
		...group,
		items: group.items.filter((item) => !text || `${item.q} ${item.a}`.toLowerCase().includes(text)),
	})).filter((group) => group.items.length > 0);
	return (
		<PageShell title="FAQ" seoTitle="FAQ: Policy Management and Training for NGOs | AidNova" page="faq" description="Quick answers about AidNova setup, pricing, privacy and language.">
			<PageHero eyebrow="Help" title="Frequently asked questions" lead="Quick answers about setup, pricing, privacy and language." />
			<div className="faq-search">
				<Icon name="search" size={16} color="var(--muted-foreground)" />
				<input
					type="search"
					aria-label="Search questions"
					placeholder="Search questions…"
					value={search}
					onChange={(event) => setSearch(event.target.value)}
				/>
			</div>
			<section className="section faq-page">
				<nav aria-label="Topics" className="faq-topics">
					{FAQ_GROUPS.map((group) => (
						<a key={group.id} href={`#${group.id}`}>
							<Icon name={group.icon} size={16} color="var(--primary)" />
							{group.title}
						</a>
					))}
				</nav>
				<div className="faq-groups">
					{groups.length === 0 && (
						<p role="status" className="faq-empty">
							No questions match that. <a href={`mailto:${CONTACT_EMAIL}`}>Ask us by email</a>.
						</p>
					)}
					{groups.map((group, groupIndex) => (
						<div className="faq-group" id={group.id} key={group.id}>
							<h2>
								<Icon name={group.icon} size={18} color="var(--primary)" />
								{group.title}
							</h2>
							{group.items.map((item, index) => (
								<details key={`${item.q}-${text ? "search" : "all"}`} open={Boolean(text) || (groupIndex === 0 && index === 0)}>
									<summary>{item.q}</summary>
									<p>{item.a}</p>
								</details>
							))}
						</div>
					))}
				</div>
			</section>
			<section className="section still-section">
				<div className="still-card">
					<div>
						<h2>Still have a question?</h2>
						<p>Send us a message and we’ll get back to you.</p>
					</div>
					<div className="still-actions">
						<a href={`mailto:${CONTACT_EMAIL}`} className="btn btn-primary">Email us</a>
						<a href={FACEBOOK_URL} className="btn btn-outline">Message on Facebook</a>
					</div>
				</div>
			</section>
			<PageCta title="Ready to try it?" text="14-day free trial. No card needed." label="Start your free trial" />
		</PageShell>
	);
}

function AiPage() {
	return (
		<PageShell
			title="AI"
			seoTitle="AI Assistant for NGO Policies and Documents | AidNova"
			page="ai"
			description="AidNova's AI reads only the files you're allowed to open, names where each answer came from, and tells you when it doesn't know."
		>
			<PageHero
				eyebrow="AI in AidNova"
				chip="Answers with sources"
				violet
				title="Ask your organization’s documents. Get answers you can check."
				lead="AidNova’s AI reads only the content you’re allowed to open, names where each answer came from, and tells you when it doesn’t know."
				actions={
					<>
						<a href={SIGN_UP} className="btn btn-primary">Start your free trial</a>
						<a href="#how" className="btn btn-outline">See how it works</a>
					</>
				}
				trust={[
					{ icon: "quote", label: "Sources named" },
					{ icon: "lock", label: "Respects your access" },
					{ icon: "globe", label: "English and Myanmar" },
					{ icon: "shield", label: "People make the decisions" },
				]}
			/>
			<HeroShowcase>
				<Showcase wide name="hub" alt="AidNova answering a question about annual leave, with links to the Leave Policy and the Employee Handbook" tone="violet">
					<Float at="tl">
						<FloatIcon name="spark" tone="#753ff3" />
						<FloatText title="AidNova assistant" text="In your Hub, in English or မြန်မာ" />
					</Float>
					<Float at="br">
						<FloatIcon name="quote" tone="#0066f5" />
						<FloatText title="Leave Policy 2026" text="Source named with the answer" />
					</Float>
				</Showcase>
			</HeroShowcase>
			<ShowRow
				eyebrow="In AidNova"
				flip
				title="An assistant for every staff member."
				lead="Ask about your policies and Hub files in English or Myanmar, and get answers that name the source."
				points={["“What does our leave policy say about sick days?”", "“Where is the travel request form?”", "It’s in beta, so check answers against the source"]}
			>
				<PhoneShowcase name="mobile-ask" alt="The Ask AidNova assistant on a phone, offering to find a policy or explain one" tone="blue" />
			</ShowRow>
			<section id="project-intelligence" className="section">
				<Reveal>
					<div className="coming-soon-card">
						<span className="eyebrow">Coming soon</span>
						<h2 className="section-title">Project Intelligence.</h2>
						<p>We’re planning an assistant for your projects, so you can ask about status, budget, outputs and reports and see where each number came from. It isn’t available yet.</p>
					</div>
				</Reveal>
			</section>
			<section id="how" className="section">
				<Reveal>
					<div className="dark-panel">
						<span className="eyebrow eyebrow-blue">How it behaves</span>
						<h2 className="section-title">Useful because it’s careful.</h2>
						<p>NGO decisions need evidence. These rules shape every answer.</p>
						<div className="dark-grid">
							{(
								[
									{ icon: "quote", title: "Shows its sources", text: "Each answer names the policy or file it used." },
									{ icon: "eyeOff", title: "Says when it doesn’t know", text: "If your content doesn’t answer the question, it tells you to ask a manager — it doesn’t make something up." },
									{ icon: "lock", title: "Only reads what you can open", text: "If you can’t open a file, the AI can’t read it for you either." },
									{ icon: "shield", title: "Never decides for you", text: "It answers questions. It can’t approve, publish or change anything." },
								] as { icon: IconName; title: string; text: string }[]
							).map((rule) => (
								<div key={rule.title}>
									<Icon name={rule.icon} size={18} color="#9ebfff" />
									<h3>{rule.title}</h3>
									<p>{rule.text}</p>
								</div>
							))}
						</div>
					</div>
				</Reveal>
			</section>
			<Questions
				items={[
					{ q: "Can the AI see files I can’t?", a: "No. It checks your access first, so it only uses content you could open yourself." },
					{ q: "Can it approve reports or change anything?", a: "No. It only answers questions. Approvals and changes always need a person." },
					{ q: "Does it work in Myanmar?", a: "Yes. You can ask in English or Myanmar." },
					{ q: "What if it doesn’t know?", a: "It says so, and suggests you ask a manager." },
					{ q: "Is there a usage limit?", a: "Yes. There’s a daily limit, so the assistant stays available for everyone. It’s in beta, so answers are worth checking against the source." },
				]}
			/>
			<PageCta title="Spend less time searching. More time on the mission." text="Try the AI assistant in your free trial." label="Start your free trial" />
		</PageShell>
	);
}

function ProjectsPage() {
	const join = earlyAccessLink("Projects");
	return (
		<PageShell
			title="Projects"
			seoTitle="NGO Project Management with Files and Donor Reports | AidNova"
			page="projects"
			description="Plan NGO projects, keep every version of every file, collect reports and see real progress against your targets. Early access."
		>
			<PageHero
				eyebrow="New in AidNova"
				chip="Early access"
				violet
				title="Every project, its files and its progress — in one place."
				lead="Plan projects, keep every version of every file, collect reports, and see real progress against your targets. Built for how NGOs actually work with donors."
				actions={
					<>
						<a href={join} className="btn btn-primary">Join early access</a>
						<a href="#how" className="btn btn-outline">See how it works</a>
					</>
				}
				note="We’re building this now. Join the early-access list and we’ll set it up with you when it’s ready."
				trust={[
					{ icon: "folder", label: "Folders and versions" },
					{ icon: "file", label: "Reports and approvals" },
					{ icon: "chart", label: "Dashboards from your spreadsheets" },
					{ icon: "lock", label: "Only the people you add" },
				]}
			/>
			<HeroShowcase>
				<Showcase wide name="project-overview" alt="A project overview, with milestones, budget, people reached and reports, and what needs attention" tone="green">
					<Float at="tl">
						<Ring value={68} tone="#22a076" />
						<FloatText title="3,410 people reached" text="of 5,000 target" />
					</Float>
					<Float at="br">
						<span className="float-urgent">Overdue</span>
						<FloatText title="September monthly report" />
					</Float>
				</Showcase>
			</HeroShowcase>
			<section className="section">
				<SectionHead
					eyebrow="Progress you can explain"
					title="Four kinds of progress — never one made-up percentage."
					lead="Donors ask different questions. AidNova keeps milestones, money, impact and reporting separate, and every number shows where it came from."
				/>
				<div className="progress-kinds">
					{[
						{ label: "OPERATIONAL", value: "4 of 6 milestones", text: "Counted from milestones you mark done.", tone: "var(--primary)", percent: 67 },
						{ label: "FINANCIAL", value: "$73,500 of $120,000", text: "From your budget file, labelled until it’s checked.", tone: "var(--accent)", percent: 61 },
						{ label: "IMPACT", value: "3,410 of 5,000 people", text: "From approved reports and verified data.", tone: "var(--success)", percent: 68 },
						{ label: "REPORTING", value: "8 of 10 approved", text: "From your reporting schedule.", tone: "var(--warning)", percent: 80 },
					].map((kind) => (
						<div key={kind.label} style={{ borderTopColor: kind.tone }}>
							<span>{kind.label}</span>
							<strong>{kind.value}</strong>
							<div className="kind-meter" aria-hidden="true"><div style={{ width: `${kind.percent}%`, background: kind.tone }} /></div>
							<p>{kind.text}</p>
						</div>
					))}
				</div>
			</section>
			<ShowRow
				eyebrow="Files"
				title="Every version kept."
				lead="Start from a standard NGO folder set, or build your own. Upload a new version with a note on what changed. Older versions stay, and you can bring one back any time."
				points={["Planning, finance, progress, M&E and annual reports", "See who changed what, and why", "Link existing files without counting them twice"]}
			>
				<Showcase name="project-files" alt="Project files in folders, with the version history of a budget file" tone="blue" />
			</ShowRow>
			<ShowRow
				flip
				eyebrow="Reports"
				title="Reports with approval."
				lead="Staff fill in a monthly report or upload a file. Managers approve it or send it back with a comment."
				points={["A reporting schedule with what’s due", "Draft, submitted, approved or needs revision", "A record of every decision"]}
			>
				<Showcase name="project-reports" alt="The reporting register beside a monthly report being filled in" tone="violet">
					<Float at="bl">
						<FloatIcon name="check" tone="#22a076" />
						<FloatText title="Q3 report approved" text="by Su Mon" />
					</Float>
				</Showcase>
			</ShowRow>
			<ShowRow
				eyebrow="Dashboards"
				title="Dashboards from your spreadsheets."
				lead="Upload a CSV or Excel file, check the columns, and pick charts. Numbers are calculated from your rows, not guessed."
				points={["Suggested charts for your columns", "Checks for duplicate months and empty rows", "Share with the project team"]}
			>
				<Showcase name="project-data" alt="A project dashboard being built from a spreadsheet, with suggested charts" tone="amber" />
			</ShowRow>
			<ShowRow
				flip
				eyebrow="Team"
				title="Roles for every project."
				lead="Owner, manager, editor, contributor, viewer or executive viewer. Staff only see the projects they’re on."
				points={["Choose who can see, upload, approve or only view", "A clear table of what each role can do", "Admins can see all projects"]}
			>
				<Showcase name="project-team" alt="A project’s members and a table of what each role can do" tone="dark" />
			</ShowRow>
			<ShowRow
				eyebrow="For leadership"
				title="See every project at once."
				lead="The portfolio view shows status, health, spending and overdue reports across programs. Different currencies are never mixed, and people only see the projects they’re allowed to."
			>
				<Showcase name="project-portfolio" alt="The portfolio dashboard, with active projects, spending in USD and MMK and overdue reports" tone="blue">
					<Float at="tr">
						<FloatIcon name="chart" tone="#0066f5" />
						<FloatText title="7 active projects" text="1 at risk" />
					</Float>
				</Showcase>
			</ShowRow>
			<section id="how" className="section">
				<SectionHead eyebrow="How it works" title="From new project to completed — with a record of every step." />
				<div className="cards-after-head">
					<Steps
						steps={[
							{ title: "Create the project", text: "Name, code, dates, owner and manager. Add donor, budget and targets if you track them." },
							{ title: "Add your team", text: "Choose who can see, upload, approve or only view." },
							{ title: "Collect files and reports", text: "Upload files, link existing ones from Files, and set a reporting schedule." },
							{ title: "Track and complete", text: "Watch progress, fix what’s overdue, and close the project. Nothing is deleted." },
						]}
					/>
				</div>
			</section>
			<Questions
				items={[
					{ q: "Is Projects available now?", a: "Not yet. We’re building it now. Tell us you’d like to try it, and we’ll turn it on for your organization as it rolls out." },
					{ q: "Does it use my storage?", a: "Project files will count toward your organization’s storage. Files you link from Files aren’t counted twice." },
					{ q: "Can every staff member see every project?", a: "No. People only see projects they’ve been added to. Admins can see all of them." },
					{ q: "Can we edit Word and Excel files in the browser?", a: "No. You upload a new version with a short note, and AidNova keeps the full history." },
					{ q: "What happens when a project is completed?", a: "You review anything still open, confirm, and the project is marked Completed. Files and reports stay available." },
				]}
			/>
			<PageCta title="Run your next project in one place." text="Join early access and we’ll set it up with you." label="Join early access" href={join} />
		</PageShell>
	);
}

function CapacityPage() {
	const join = earlyAccessLink("Capacity Building");
	return (
		<PageShell
			title="Capacity Building"
			seoTitle="Staff Capacity Building Tracking for NGOs | AidNova"
			page="capacity"
			description="Staff report training, team leaders verify it, and skills are recognised one by one. Private by default. Early access."
		>
			<PageHero
				eyebrow="New in AidNova"
				chip="Early access"
				violet
				title="Grow your people’s skills — without putting them at risk."
				lead="Staff report the workshops and training they take. Team leaders check and verify them. Skills are recognised one by one — and everything is private by default."
				actions={
					<>
						<a href={join} className="btn btn-primary">Join early access</a>
						<a href="#privacy" className="btn btn-outline">How privacy works</a>
					</>
				}
				note="We’re building this now. Join the early-access list and we’ll help you set up safely when it’s ready."
				trust={[
					{ icon: "lock", label: "Private by default" },
					{ icon: "check", label: "Verified, not just claimed" },
					{ icon: "star", label: "Skills, not scores" },
					{ icon: "phone", label: "Report from your phone" },
				]}
			/>
			<HeroShowcase>
				<Showcase wide name="cb-training" alt="My training, listing each workshop with its dates and whether it’s verified, under review or self-reported" tone="violet">
					<Float at="tl">
						<FloatIcon name="lock" tone="#753ff3" />
						<FloatText title="Only you and your reviewer" text="Private by default" />
					</Float>
					<Float at="br">
						<FloatIcon name="check" tone="#22a076" />
						<FloatText title="Project Cycle Management" text="Verified · 5 training days" />
					</Float>
				</Showcase>
			</HeroShowcase>
			<ShowRow
				flip
				eyebrow="Report from anywhere"
				title="Easy training reports."
				lead="Name, dates, duration and what you learned. Save a draft, add a certificate, submit when ready — on a phone or laptop."
				points={["Apply, start or finish: update it as it happens", "Location is always optional", "“Withhold for safety” is the recommended option"]}
			>
				<PhoneShowcase name="mobile-cb" alt="Reporting a training on a phone, with location set to withhold for safety" tone="violet" />
			</ShowRow>
			<ShowRow
				eyebrow="Review"
				title="Verified by a person."
				lead="Team leaders see only their own team’s reports. They check the dates and evidence, then verify, ask for changes, or decline with a reason."
				points={["A checklist before deciding", "Certificates kept with the report", "A record of every decision"]}
			>
				<Showcase name="cb-review" alt="A reviewer’s queue beside a training report and its certificate" tone="blue">
					<Float at="br">
						<FloatIcon name="check" tone="#22a076" />
						<FloatText title="Verify completion" text="Safeguarding & PSEA refresher" />
					</Float>
				</Showcase>
			</ShowRow>
			<ShowRow
				flip
				eyebrow="Skills & badges"
				title="From “I attended” to “I can teach this”."
				lead="Attendance, completion and real skill are different things. AidNova keeps them apart, so recognition means something."
				points={["Foundation, Developing, Proficient, Advanced, Specialist", "Each skill has its own rubric, assessed by a person", "Badges show how they were earned"]}
			>
				<Showcase name="cb-skills" alt="A staff member’s skills with their levels, and badges with how each was earned" tone="amber" />
			</ShowRow>
			<ShowRow
				eyebrow="Directory"
				title="Find who knows what."
				lead="An optional, opt-in directory of verified skills, so colleagues can ask each other for help. Staff choose what appears."
				points={["Off by default", "Verified skills only", "Display names where your organization permits"]}
			>
				<Showcase name="cb-directory" alt="The People and Skills directory, with cards showing each person’s shared skills" tone="green" />
			</ShowRow>
			<section id="privacy" className="section">
				<Reveal>
					<div className="dark-panel dark-split">
						<div>
							<span className="eyebrow eyebrow-blue">Designed for high-risk contexts</span>
							<h2 className="section-title">Who trained where can be dangerous information. We treat it that way.</h2>
							<p>In Myanmar and similar settings, a workshop, a provider or a travel date can put someone at risk. So location is never required, there’s no GPS, and nothing is shared unless the staff member chooses to.</p>
							<ul className="dark-list">
								<li>“Withhold location for safety” is the recommended option</li>
								<li>Display names allowed where your organization permits</li>
								<li>Sensitive categories hide names even from team views</li>
								<li>Notifications never say who is attending what, or where</li>
							</ul>
						</div>
						<div className="dark-shot">
							<ShotImage name="cb-privacy" alt="Privacy settings, where staff choose their display name, picture and which skills to show" />
						</div>
					</div>
				</Reveal>
			</section>
			<section className="section">
				<SectionHead
					eyebrow="How it works"
					title="Four steps, with a person in charge of every decision."
					lead="AI can help summarise, but people approve training, assess skills and award badges."
				/>
				<div className="cards-after-head">
					<Steps
						steps={[
							{ title: "Staff report training", text: "Apply, start or finish — update the status as it happens." },
							{ title: "A reviewer checks it", text: "Dates, evidence and outcomes. They verify, ask for changes or decline." },
							{ title: "Skills are assessed", text: "Separately, against a rubric. A workshop never raises a level by itself." },
							{ title: "Staff choose what to share", text: "Pick which verified skills and badges colleagues can see — or nothing at all." },
						]}
					/>
				</div>
			</section>
			<Questions
				items={[
					{ q: "Is Capacity Building available now?", a: "Not yet. We’re building it now. When it’s ready, your admin turns it on after a short setup: categories, reviewers, and a privacy and safety review." },
					{ q: "Do staff have to give a location?", a: "No. Location is always optional, and “withhold for safety” is the recommended choice. AidNova never uses GPS." },
					{ q: "Is there a leaderboard or score?", a: "No. There are no rankings, points or overall scores — only skills assessed one at a time." },
					{ q: "Does it work with AidNova Courses?", a: "Yes. Passing an AidNova course can add a course certificate badge, once per course. It doesn’t change a skill level on its own." },
					{ q: "Who can see a staff member’s training?", a: "The staff member and their assigned reviewer. Admins can open sensitive records only under your organization’s policy, and each view is recorded." },
				]}
			/>
			<PageCta title="Recognise learning. Protect your people." text="Join early access and we’ll help you set up safely." label="Join early access" href={join} />
		</PageShell>
	);
}

const ART_TONES = {
	blue: ["#0066f5", "#753ff3"],
	green: ["#22a076", "#0066f5"],
	violet: ["#753ff3", "#e92063"],
	amber: ["#f59f0a", "#e92063"],
	dark: ["#030711", "#0066f5"],
	teal: ["#0066f5", "#22a076"],
};
type ArtTone = keyof typeof ART_TONES;

// The AidNova mark drawn large and cropped, in one of three arrangements.
const ART_LAYOUTS = ["art-corners", "art-left", "art-tall"] as const;

function PostArt({
	tone,
	layout = 0,
	label,
	className,
}: {
	tone: ArtTone;
	layout?: number;
	label?: string;
	className?: string;
}) {
	const [from, to] = ART_TONES[tone];
	return (
		<div
			aria-hidden="true"
			className={`post-art ${ART_LAYOUTS[layout]} ${className ?? ""}`}
			style={{ background: `linear-gradient(135deg, ${from} 0%, ${from} 45%, ${to} 100%)` }}
		>
			<img src="/blog-mark.webp" alt="" />
			<img src="/blog-mark.webp" alt="" />
			{label && <span>{label}</span>}
		</div>
	);
}

const POST_CATEGORIES = ["Guides", "Safety", "Language"];

function postMeta(post: BlogPost) {
	return `${post.date} · ${readMinutes(post)} min read`;
}

function PostCard({ post, compact = false }: { post: BlogPost; compact?: boolean }) {
	return (
		<a href={`/blog/${post.slug}`} className={compact ? "post-card post-card-compact" : "post-card"}>
			<PostArt tone={post.tone} layout={post.layout} />
			<div>
				<span className="post-tag">{post.category.toUpperCase()}</span>
				<h3>{post.title}</h3>
				{!compact && <p>{post.excerpt}</p>}
				<span className="post-soon">{compact ? post.date : postMeta(post)}</span>
			</div>
		</a>
	);
}

function BlogPage() {
	const [category, setCategory] = useState("All");
	const [search, setSearch] = useState("");
	const text = search.trim().toLowerCase();
	const matches = (post: BlogPost) =>
		(category === "All" || category === post.category) &&
		(!text || `${post.title} ${post.excerpt} ${post.tags.join(" ")}`.toLowerCase().includes(text));
	const [featured, ...rest] = POSTS;
	const shown = rest.filter(matches);
	return (
		<PageShell
			title="Blog"
			seoTitle="NGO Policy, Training and Safeguarding Guides | AidNova Blog"
			page="blog"
			description="Practical guides on policies, training and running a safer, better-organized NGO, plus what's new in AidNova."
		>
			<section className="section blog-section">
				<div className="blog-head">
					<div>
						<span className="eyebrow">Blog</span>
						<h1>Notes for people-first organizations</h1>
						<p>Practical guides on policies, training and running a safer, better-organized NGO — plus what’s new in AidNova.</p>
					</div>
					<label className="blog-search">
						<Icon name="search" size={16} color="var(--muted-foreground)" />
						<span className="sr-only">Search posts</span>
						<input
							type="search"
							placeholder="Search posts…"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
						/>
					</label>
				</div>
				{matches(featured) && (
					<a href={`/blog/${featured.slug}`} className="featured-post">
						<PostArt tone={featured.tone} label="Featured guide" className="featured-art" />
						<div className="featured-copy">
							<span className="post-tag">{featured.category.toUpperCase()}</span>
							<h2>{featured.title}</h2>
							<p>{featured.excerpt}</p>
							<span className="post-byline">
								<img src={LOGO} alt="" width="28" height="28" />
								<span>
									<b>AidNova Team</b> <span>· {postMeta(featured)}</span>
								</span>
							</span>
							<span className="post-read">Read the guide →</span>
						</div>
					</a>
				)}
				<div className="blog-filters" role="group" aria-label="Filter by category">
					{["All", ...POST_CATEGORIES].map((name) => (
						<button key={name} type="button" aria-pressed={category === name} onClick={() => setCategory(name)}>
							{name}
						</button>
					))}
				</div>
				{shown.length > 0 && (
					<div className="post-grid">
						{shown.map((post) => (
							<PostCard key={post.slug} post={post} />
						))}
					</div>
				)}
				{!matches(featured) && shown.length === 0 && (
					<p role="status" className="blog-empty">
						No posts match that.
					</p>
				)}
			</section>
			<section className="section newsletter-section">
				<div className="newsletter">
					<div>
						<h2>Get new guides by email</h2>
						<p>About once a month. Unsubscribe any time.</p>
					</div>
					<a
						href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Send me new AidNova guides")}`}
						className="newsletter-button"
					>
						Email us to subscribe
					</a>
				</div>
			</section>
		</PageShell>
	);
}

function ShareButtons() {
	const [copied, setCopied] = useState(false);
	const url = encodeURIComponent(window.location.href);
	return (
		<div className="post-share">
			<span>SHARE</span>
			<div>
				<a href={`https://www.facebook.com/sharer/sharer.php?u=${url}`} target="_blank" rel="noreferrer noopener" aria-label="Share on Facebook">f</a>
				<a href={`https://www.linkedin.com/sharing/share-offsite/?url=${url}`} target="_blank" rel="noreferrer noopener" aria-label="Share on LinkedIn">in</a>
				<button
					type="button"
					aria-label={copied ? "Link copied" : "Copy link"}
					onClick={async () => {
						await navigator.clipboard.writeText(window.location.href);
						setCopied(true);
					}}
				>
					<Icon name={copied ? "check" : "link"} size={14} />
				</button>
			</div>
		</div>
	);
}

function PostBody({ block }: { block: BlogPost["blocks"][number] }) {
	if ("h" in block) return <h2 id={postHeadingId(block.h)}>{block.h}</h2>;
	if ("p" in block) return <p>{block.p}</p>;
	if ("ul" in block) {
		return (
			<ul>
				{block.ul.map((item) => (
					<li key={item}>{item}</li>
				))}
			</ul>
		);
	}
	if ("tip" in block) {
		return (
			<p className="post-tip">
				<b>Tip:</b> {block.tip}
			</p>
		);
	}
	if ("links" in block) {
		return (
			<ul>
				{block.links.map(([label, href]) => (
					<li key={href}>
						<a href={href} target="_blank" rel="noreferrer noopener">
							{label}
						</a>
					</li>
				))}
			</ul>
		);
	}
	return (
		<figure>
			<div className="post-figure">
				<div>
					<strong>Safeguarding Policy 2026</strong>
					<span className="status-pill status-danger">Mandatory</span>
				</div>
				<div className="meter" aria-hidden="true"><div style={{ width: "92%" }} /></div>
				<div>
					<span>22 of 24 staff acknowledged</span>
					<span>2 pending · reminder sent</span>
				</div>
			</div>
			<figcaption>Acknowledgment tracking in AidNova. Illustrative example.</figcaption>
		</figure>
	);
}

// Tells search engines this page is an article, so results can show its date.
function useArticleData(post: BlogPost) {
	useEffect(() => {
		const script = document.createElement("script");
		script.type = "application/ld+json";
		script.textContent = JSON.stringify({
			"@context": "https://schema.org",
			"@type": "Article",
			headline: post.seoTitle,
			description: post.description,
			datePublished: post.isoDate,
			author: { "@type": "Organization", name: "AidNova" },
			publisher: { "@type": "Organization", name: "AidNova" },
			mainEntityOfPage: window.location.href,
		});
		document.head.append(script);
		return () => script.remove();
	}, [post]);
}

function PostPage({ post }: { post: BlogPost }) {
	useArticleData(post);
	const headings = post.blocks.flatMap((block) => ("h" in block ? [block.h] : []));
	const others = POSTS.filter((other) => other.slug !== post.slug);
	const start = (POSTS.indexOf(post) + 1) % others.length;
	const next = [0, 1, 2].map((offset) => others[(start + offset) % others.length]);
	return (
		<PageShell title={post.title} seoTitle={`${post.seoTitle} | AidNova`} page="blog" description={post.description}>
			<article className="section post">
				<nav aria-label="Breadcrumb" className="post-crumb">
					<a href="/blog">Blog</a> / {post.category}
				</nav>
				<span className="post-tag">{post.category.toUpperCase()}</span>
				<h1>{post.title}</h1>
				<div className="post-author">
					<img src={LOGO} alt="" width="36" height="36" />
					<div>
						<strong>AidNova Team</strong>
						<span>{postMeta(post)}</span>
					</div>
				</div>
				<PostArt tone={post.tone} layout={post.layout} className="post-banner" />
				<div className="post-layout">
					<aside>
						<nav aria-label="On this page" className="post-toc">
							<span>ON THIS PAGE</span>
							{headings.map((heading) => (
								<a key={heading} href={`#${postHeadingId(heading)}`}>{heading}</a>
							))}
						</nav>
						<ShareButtons />
					</aside>
					<div className="post-body">
						<p className="post-lead">{post.lead}</p>
						{post.blocks.map((block, index) => (
							<PostBody key={index} block={block} />
						))}
						<div className="post-tags">
							{post.tags.map((tag) => (
								<span key={tag}>{tag}</span>
							))}
						</div>
						<div className="post-bio">
							<img src={LOGO} alt="" width="36" height="36" />
							<div>
								<strong>AidNova Team</strong>
								<p>We build policy and learning tools for NGOs and mission-driven teams.</p>
							</div>
						</div>
					</div>
				</div>
				<div className="post-cta">
					<div>
						<h2>{post.cta.title}</h2>
						<p>{post.cta.text}</p>
					</div>
					<a href={post.category === "Safety" ? "/capacity-building#privacy" : SIGN_UP} className="btn btn-primary">
						{post.category === "Safety" ? "Read about it" : "Start your free trial"}
					</a>
				</div>
				<div className="keep-reading">
					<div className="keep-reading-head">
						<h2>Keep reading</h2>
						<a href="/blog">All posts →</a>
					</div>
					<div className="post-grid">
						{next.map((other) => (
							<PostCard key={other.slug} post={other} compact />
						))}
					</div>
				</div>
			</article>
		</PageShell>
	);
}

function NotFoundPost() {
	return (
		<PageShell title="Page not found" page="blog" description="That page doesn't exist.">
			<PageHero
				eyebrow="Blog"
				title="That post doesn’t exist."
				lead="It may have moved."
				actions={<a href="/blog" className="btn btn-primary">All posts</a>}
			/>
		</PageShell>
	);
}

const PAGES: Record<string, () => ReactNode> = {
	"/features": FeaturesPage,
	"/employee-hub": EmployeeHubPage,
	"/pricing": PricingPage,
	"/faq": FaqPage,
	"/ai": AiPage,
	"/projects": ProjectsPage,
	"/capacity-building": CapacityPage,
	"/blog": BlogPage,
};

export default function SitePages({ path }: { path: string }) {
	const post = POSTS.find((item) => `/blog/${item.slug}` === path);
	if (post) return <PostPage post={post} />;
	const Page = PAGES[path] ?? NotFoundPost;
	return <Page />;
}
