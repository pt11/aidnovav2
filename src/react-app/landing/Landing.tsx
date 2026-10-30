import { useEffect, useRef, useState, type ReactNode } from "react";
import "./landing-base.css";
import "./landing.css";

function hubUrl(path: string) {
	const { protocol, hostname, port } = window.location;
	return hostname === "localhost" || hostname === "127.0.0.1"
		? `${protocol}//hub.localhost:${port}${path}`
		: `https://hub.aidnova.app${path}`;
}

const LOGO = "/aidnova-logo.png";
const CONTACT_EMAIL = "helloaidnova@gmail.com";
const FACEBOOK_URL = "https://www.facebook.com/people/AidNova/61585034496714/";

const ICONS = {
	shield: <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" />,
	lock: (
		<>
			<rect x="4" y="10" width="16" height="11" rx="2" />
			<path d="M8 10V7a4 4 0 0 1 8 0v3" />
		</>
	),
	globe: (
		<>
			<circle cx="12" cy="12" r="9" />
			<path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
		</>
	),
	phone: (
		<>
			<rect x="7" y="2" width="10" height="20" rx="2" />
			<path d="M11 18h2" />
		</>
	),
	file: (
		<>
			<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
			<path d="M14 3v5h5" />
		</>
	),
	calendar: (
		<>
			<rect x="3" y="5" width="18" height="16" rx="2" />
			<path d="M3 10h18M8 3v4M16 3v4" />
		</>
	),
	search: (
		<>
			<circle cx="11" cy="11" r="7" />
			<path d="m20 20-3.5-3.5" />
		</>
	),
	link: (
		<>
			<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
			<path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
		</>
	),
	folder: (
		<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
	),
	menu: <path d="M4 7h16M4 12h16M4 17h16" />,
	close: <path d="M6 6l12 12M18 6L6 18" />,
};

function Icon({
	name,
	size = 16,
	color = "var(--primary)",
}: {
	name: keyof typeof ICONS;
	size?: number;
	color?: string;
}) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			{ICONS[name]}
		</svg>
	);
}

function Nav({
	lang,
	onLangChange,
}: {
	lang: Lang;
	onLangChange: (lang: Lang) => void;
}) {
	const [menuOpen, setMenuOpen] = useState(false);
	const toggleRef = useRef<HTMLButtonElement>(null);
	const closeMenu = () => setMenuOpen(false);

	useEffect(() => {
		if (!menuOpen) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setMenuOpen(false);
				toggleRef.current?.focus();
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [menuOpen]);

	return (
		<header className="site-header">
			<nav className="site-nav" aria-label="Main">
				<a href="#top" className="brand" onClick={closeMenu}>
					<img src={LOGO} alt="" width="28" height="28" />
					AidNova
				</a>
				<button
					ref={toggleRef}
					type="button"
					className="menu-toggle"
					aria-label={menuOpen ? "Close menu" : "Open menu"}
					aria-expanded={menuOpen}
					aria-controls="site-menu"
					onClick={() => setMenuOpen((open) => !open)}
				>
					<Icon
						name={menuOpen ? "close" : "menu"}
						size={22}
						color="var(--foreground)"
					/>
				</button>
				<div id="site-menu" className={menuOpen ? "nav-menu open" : "nav-menu"}>
					<div className="nav-links">
						<a href="#features" onClick={closeMenu}>
							Features
						</a>
						<a href="#hub" onClick={closeMenu}>
							Employee Hub
						</a>
						<a href="#pricing" onClick={closeMenu}>
							Pricing
						</a>
						<a href="#faq" onClick={closeMenu}>
							FAQ
						</a>
					</div>
					<div className="nav-actions">
						<div className="segmented" role="group" aria-label="Language">
							<button
								type="button"
								aria-pressed={lang === "en"}
								onClick={() => onLangChange("en")}
							>
								EN
							</button>
							<button
								type="button"
								lang="my"
								aria-pressed={lang === "my"}
								onClick={() => onLangChange("my")}
							>
								မြန်မာ
							</button>
						</div>
						<a href={hubUrl("/sign-in")} className="nav-signin">
							Sign in
						</a>
						<a href={hubUrl("/sign-up")} className="btn btn-primary btn-sm nav-signup">
							Sign up
						</a>
					</div>
				</div>
			</nav>
		</header>
	);
}

function Hero({ lang }: { lang: Lang }) {
	return (
		<section id="top" className="section hero">
			<a href={hubUrl("/sign-up")} className="hero-badge">
				Built for NGOs <span>14-day free trial →</span>
			</a>
			{lang === "en" ? (
				<>
					<h1 className="hero-title">
						Policies. Training.
						<br />
						One place for all of it.
					</h1>
					<p className="hero-lead">
						Stop losing policies in shared drives and chasing training records
						across spreadsheets. AidNova gives your NGO one secure hub — with
						Myanmar language built in.
					</p>
				</>
			) : (
				<>
					<h1 className="hero-title" lang="my">
						မူဝါဒများ၊ သင်တန်းများ —
						<br />
						အားလုံး တစ်နေရာတည်းမှာ။
					</h1>
					<p className="hero-lead" lang="my">
						မူဝါဒများကို တင်ပြီး ဘယ်သူ ဖတ်ပြီး အသိအမှတ်ပြုပြီးပြီလဲ ဆိုတာ
						မြင်ရပါမယ်။
					</p>
				</>
			)}
			<div className="hero-actions">
				<a href={hubUrl("/sign-up")} className="btn btn-primary btn-lg">
					Start your free trial
				</a>
				<a href="#features" className="btn btn-outline">
					See how it works
				</a>
			</div>
			<ul className="trust-list">
				<li>
					<Icon name="shield" />
					Role-based access
				</li>
				<li>
					<Icon name="lock" />
					Department and PIN-protected files
				</li>
				<li>
					<Icon name="globe" />
					English and Myanmar
				</li>
				<li>
					<Icon name="phone" />
					Installs on phones
				</li>
			</ul>
		</section>
	);
}

function Progress({ value, color }: { value: number; color?: string }) {
	return (
		<div style={{ width: `${value}%`, background: color, height: "100%" }} />
	);
}

const POLICY_SECTIONS = [
	{ label: "SECTION 1", title: "Code of Conduct", value: 75, color: "var(--success)" },
	{ label: "SECTION 2", title: "Leave Policy", value: 50, color: "var(--warning)" },
	{ label: "SECTION 3", title: "IT Security", value: 30, color: "var(--destructive)" },
];

function ProductPreview() {
	return (
		<section className="section preview" aria-label="Product preview">
			<div className="preview-grid">
				<div className="preview-side">
					<div className="float-card">
						<div className="float-title">
							<span className="icon-tile">
								<Icon name="file" size={14} color="#fff" />
							</span>
							Policy updated
						</div>
						<div className="muted mt-8">
							Leave Policy 2026 published to all departments
						</div>
						<div className="strong text-primary mt-6">Acknowledge →</div>
					</div>
					<div className="float-card">
						<div className="label">ACTIVE STAFF</div>
						<div className="big-number">124</div>
						<div className="avatars">
							<span className="avatar">AA</span>
							<span className="avatar avatar-accent">KM</span>
							<span className="avatar avatar-dark">NP</span>
							<span className="avatar avatar-muted">+9</span>
						</div>
					</div>
				</div>

				<div className="browser">
					<div className="browser-bar">
						<span />
						<span />
						<span />
						<span className="browser-url">aidnova.app/policies</span>
					</div>
					<div className="browser-body">
						<div className="browser-sidebar">
							<div className="browser-brand">
								<img src={LOGO} alt="" width="18" height="18" />
								AidNova
							</div>
							<span className="active">Policies</span>
							<span>Courses</span>
							<span>Hub</span>
							<span>Calendar</span>
							<span>Reports</span>
							<div className="sidebar-stats">
								Staff
								<strong>124</strong>
								Policies
								<strong>38</strong>
							</div>
						</div>
						<div className="browser-main">
							<div className="browser-heading">
								<div>
									<div className="label">POLICIES</div>
									<div className="browser-title">Employee Handbook 2026</div>
									<div className="muted tiny">Last edited 2h ago</div>
								</div>
								<span className="fake-button">Publish</span>
							</div>
							<div className="mock-sections">
								{POLICY_SECTIONS.map((section) => (
									<div className="mock-section" key={section.label}>
										{section.label}
										<strong>{section.title}</strong>
										<div className="progress progress-thin">
											<Progress value={section.value} color={section.color} />
										</div>
										{section.value}% acknowledged
									</div>
								))}
							</div>
							<div className="mock-stats">
								<div>
									<strong className="text-primary">12</strong>Courses
								</div>
								<div>
									<strong className="text-accent">89</strong>Enrolled
								</div>
								<div>
									<strong>54</strong>Certified
								</div>
								<div>
									<strong>97%</strong>Rate
								</div>
							</div>
						</div>
					</div>
				</div>

				<div className="preview-side">
					<div className="float-card">
						<div className="label">COMPLETION RATE</div>
						<div className="big-number text-primary">97%</div>
						<div className="progress">
							<Progress value={97} />
						</div>
						<div className="strong mt-6">↑ 12% this quarter</div>
					</div>
					<div className="float-card">
						<div className="float-title">
							<span className="icon-tile tile-accent">
								<Icon name="calendar" size={14} color="#fff" />
							</span>
							Upcoming
						</div>
						<div className="strong mt-8" style={{ fontSize: 13 }}>
							All-Staff Training
						</div>
						<div className="muted">Thursday · 2:00 PM</div>
						<div className="strong text-primary mt-6">18 enrolled</div>
					</div>
				</div>
			</div>
			<p className="note">Illustrative data</p>
		</section>
	);
}

function Problem() {
	return (
		<section className="section">
			<div className="problem-card">
				<div className="problem-top">
					<div className="problem-copy">
						<span className="eyebrow">Sound familiar?</span>
						<h2 className="section-title">
							Most NGOs still run on shared drives and group chats.
						</h2>
					</div>
					<div className="chaos-grid">
						<div className="chaos-card">
							<h3>Shared Drive</h3>
							<div className="chip-stack muted">
								<span className="chip">Policy_FINAL.pdf</span>
								<span className="chip">Policy_v2_USE_THIS.pdf</span>
								<span className="chip">Policy_FINAL_2.pdf</span>
							</div>
						</div>
						<div className="chaos-card">
							<h3>Who read it?</h3>
							<div className="chip-stack">
								<div className="chip chip-row">
									<span>Amy S.</span>
									<span className="strong">Read</span>
								</div>
								<div className="chip chip-row">
									<span>James D.</span>
									<span className="strong muted">?</span>
								</div>
								<div className="chip chip-row">
									<span>Maria K.</span>
									<span className="strong muted">?</span>
								</div>
							</div>
						</div>
						<div className="chaos-card">
							<h3>Inbox</h3>
							<div className="chip-stack muted">
								<span className="chip">FWD: RE: RE: Policy doc</span>
								<span className="chip">RE: FWD: Training update</span>
								<span className="chip">Fwd: Has anyone read…</span>
							</div>
						</div>
						<div className="chaos-card">
							<h3>Version conflict</h3>
							<div className="chip-stack">
								<div className="chip">
									<div>HR Manual 2024</div>
									<div className="strong text-destructive">
										Outdated — 2026 exists
									</div>
								</div>
								<div className="chip">
									<div>HR Manual 2026</div>
									<div className="strong">Current version</div>
								</div>
							</div>
						</div>
					</div>
				</div>
				<div className="problem-points">
					<div>
						<h3>Policies buried in folders</h3>
						<p>
							The latest HR policy is somewhere in a shared drive — nobody can
							find it, and you can't prove anyone read it.
						</p>
					</div>
					<div>
						<h3>No record of who learned what</h3>
						<p>
							Training happened, but you can't show a funder or auditor who
							completed it.
						</p>
					</div>
					<div>
						<h3>Zero accountability</h3>
						<p>You emailed the update. You have no idea who actually read it.</p>
					</div>
				</div>
			</div>
		</section>
	);
}

function FeatureCard({
	title,
	description,
	stack = false,
	children,
}: {
	title: string;
	description: string;
	stack?: boolean;
	children: ReactNode;
}) {
	return (
		<div className="feature-card">
			<div className={stack ? "feature-visual visual-stack" : "feature-visual"}>
				{children}
			</div>
			<div>
				<h3>{title}</h3>
				<p>{description}</p>
			</div>
		</div>
	);
}

const BAR_HEIGHTS = [34, 46, 40, 58, 66, 92];
const BAR_MONTHS = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const TRANSLATIONS = [
	["Welcome", "ကြိုဆိုပါ"],
	["Policy update", "မူဝါဒ အပ်ဒိတ်"],
	["Training complete", "သင်တန်း ပြီးစီး"],
	["Certificate issued", "လက်မှတ် ထုတ်ပေး"],
];

function Features() {
	return (
		<section id="features" className="section section-center">
			<span className="eyebrow">What you get</span>
			<h2 className="section-title">
				Everything your team needs, nothing they don't.
			</h2>
			<p className="section-lead">
				Policies, training and team records in one place. No IT team required —
				set up in under an hour.
			</p>

			<div className="feature-grid">
				<FeatureCard
					title="Policy management"
					description="Publish policies and see exactly who has acknowledged them."
				>
					<div className="row">
						<div>
							<div className="strong">Employee Handbook 2026</div>
							<div className="muted">Requires acknowledgment · PDF</div>
						</div>
						<span className="pill pill-primary">Mandatory</span>
					</div>
					<div className="label mt-12">STAFF ACKNOWLEDGMENT</div>
					<div className="progress-row">
						<div className="progress">
							<Progress value={92} />
						</div>
						<span className="strong">92%</span>
					</div>
					<div className="muted mt-4">
						22 of 24 staff acknowledged · 2 pending, reminder sent
					</div>
				</FeatureCard>

				<FeatureCard
					title="Reports and analytics"
					description="Completion and acknowledgment at a glance — export to CSV for donors and audits."
				>
					<div className="kpis">
						<div>
							COMPLETION
							<strong className="text-primary">84%</strong>
						</div>
						<div>
							STAFF ACTIVE
							<strong>24</strong>
						</div>
						<div>
							AVG. DAYS
							<strong className="text-accent">4.2</strong>
						</div>
					</div>
					<div className="label mt-12">MONTHLY TRAINING COMPLETION</div>
					<div className="bars">
						{BAR_HEIGHTS.map((height, index) => (
							<span
								key={BAR_MONTHS[index]}
								className={index === BAR_HEIGHTS.length - 1 ? "current" : undefined}
								style={{ height: `${height}%` }}
							/>
						))}
					</div>
					<div className="bar-labels">
						{BAR_MONTHS.map((month) => (
							<span key={month}>{month}</span>
						))}
					</div>
				</FeatureCard>

				<FeatureCard
					title="Learning Hub"
					description="Modules, quizzes and printable certificates — all in one place."
				>
					<div className="ring-row">
						<div className="ring">
							<span>73%</span>
						</div>
						<div>
							<div className="label">IN PROGRESS</div>
							<div className="row-title">Safety Training 2026</div>
						</div>
					</div>
					<div className="visual-stack mt-12">
						<div className="row">
							<span>Introduction</span>
							<span className="strong">Done</span>
						</div>
						<div className="row row-active">
							<span>Module 2: Advanced</span>
							<span className="strong text-primary">Active</span>
						</div>
						<div className="row muted">
							<span>Final quiz and certificate</span>
							<span>Locked</span>
						</div>
					</div>
				</FeatureCard>

				<FeatureCard
					title="Team management"
					description="Departments and roles set once; everyone sees only what they should."
				>
					<div className="roster-heading">
						<span className="label">TEAM ROSTER</span>
						<span className="strong text-primary">8 active</span>
					</div>
					<div className="visual-stack mt-8">
						<div className="row">
							<span className="avatar">JD</span>
							<span className="row-grow">James D.</span>
							<span className="pill pill-primary">Admin</span>
						</div>
						<div className="row">
							<span className="avatar avatar-accent">AS</span>
							<span className="row-grow">Amy S.</span>
							<span className="pill pill-muted">Manager</span>
						</div>
						<div className="row">
							<span className="avatar avatar-dark">RN</span>
							<span className="row-grow">Rachel N.</span>
							<span className="pill">Staff</span>
						</div>
					</div>
				</FeatureCard>

				<FeatureCard
					title="English and Myanmar"
					description="Switch the whole interface between English and Myanmar anytime."
				>
					<div className="translation-grid">
						<span className="label">ENGLISH</span>
						<span className="label" lang="my">
							မြန်မာ
						</span>
						{TRANSLATIONS.map(([english, myanmar]) => (
							<TranslationRow key={english} english={english} myanmar={myanmar} />
						))}
					</div>
				</FeatureCard>

				<FeatureCard
					stack
					title="Announcements"
					description="Send urgent notices and updates to the whole team, in-app and by email."
				>
					<div className="row">
						<span>Fire drill — Friday 2 PM</span>
						<span className="pill pill-danger">Urgent</span>
					</div>
					<div className="row">
						<span>Updated: Staff Leave Policy 2026</span>
						<span className="pill pill-primary">Important</span>
					</div>
					<div className="row">
						<span>Welcome our new HR Manager</span>
						<span className="pill">General</span>
					</div>
					<div className="row">
						<span>Q1 training schedule published</span>
						<span className="pill">General</span>
					</div>
				</FeatureCard>

				<FeatureCard
					stack
					title="Course content library"
					description="Videos, PDFs and slides structured into clear courses."
				>
					<div className="row">
						<span className="icon-tile file-tile tile-accent">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
								<path d="M8 5v14l11-7z" />
							</svg>
						</span>
						<span className="row-grow">Welcome and orientation</span>
						<span className="strong muted">VIDEO</span>
					</div>
					<div className="row">
						<span className="icon-tile file-tile tile-destructive">PDF</span>
						<span className="row-grow">Safety procedures manual</span>
						<span className="strong muted">PDF</span>
					</div>
					<div className="row">
						<span className="icon-tile file-tile">PPT</span>
						<span className="row-grow">HR policy guide</span>
						<span className="strong muted">SLIDES</span>
					</div>
				</FeatureCard>

				<FeatureCard
					stack
					title="Policy document library"
					description="Every policy with acknowledgment tracking built in."
				>
					<div className="row">
						<span>Employee Handbook 2026</span>
						<span className="muted">92% acknowledged</span>
					</div>
					<div className="row">
						<span>Code of Conduct</span>
						<span className="muted">87% acknowledged</span>
					</div>
					<div className="row">
						<span>Remote Work Guidelines</span>
						<span className="pill">Optional</span>
					</div>
					<div className="row">
						<span>Safeguarding Policy</span>
						<span className="strong">100% acknowledged</span>
					</div>
				</FeatureCard>

				<FeatureCard
					title="Calendar and events"
					description="Schedule sessions and keep everyone on the same page."
				>
					<div className="strong" style={{ marginBottom: 8 }}>
						April 2026
					</div>
					<Calendar />
					<div className="visual-stack mt-8" style={{ gap: 4 }}>
						<div className="legend">
							<span className="dot" />
							Team meeting · Apr 14
						</div>
						<div className="legend">
							<span className="dot dot-accent" />
							Training session · Apr 21
						</div>
					</div>
				</FeatureCard>
			</div>
			<p className="note">Illustrative data</p>
		</section>
	);
}

function TranslationRow({ english, myanmar }: { english: string; myanmar: string }) {
	return (
		<>
			<span className="chip">{english}</span>
			<span className="chip" lang="my">
				{myanmar}
			</span>
		</>
	);
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const CALENDAR_DAYS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26];

function Calendar() {
	return (
		<div className="calendar">
			{WEEKDAYS.map((day, index) => (
				<span key={index}>{day}</span>
			))}
			{CALENDAR_DAYS.map((day, index) => {
				let className = index % 7 < 5 ? "weekday" : undefined;
				if (day === 14) className = "selected";
				if (day === 21) className = "selected-accent";
				return (
					<span key={day} className={className}>
						{day}
					</span>
				);
			})}
		</div>
	);
}

function EmployeeHub() {
	return (
		<section id="hub" className="section">
			<div className="hub-grid">
				<div className="hub-copy">
					<span className="eyebrow">One place for your team</span>
					<h2 className="section-title">
						Everything your staff needs, right where they look.
					</h2>
					<p className="hub-lead">
						Give everyone a secure home for policies, documents, useful links and
						shared Drive resources. One search, less chasing.
					</p>
					<ul className="hub-points">
						<li>
							<span className="icon-tile">
								<Icon name="search" size={14} />
							</span>
							Search policies, files and links in seconds
						</li>
						<li>
							<span className="icon-tile">
								<Icon name="shield" size={14} />
							</span>
							Show each person only what they can access
						</li>
						<li>
							<span className="icon-tile">
								<Icon name="globe" size={14} />
							</span>
							A familiar experience in English or Myanmar
						</li>
					</ul>
					<a href={hubUrl("/sign-up")} className="btn btn-primary btn-sm">
						Give your team a better home
					</a>
				</div>
				<div className="hub-device">
					<div className="hub-screen">
						<div className="hub-bar">
							<span>
								<img src={LOGO} alt="" width="18" height="18" />
								Employee Hub
							</span>
							<span className="muted">aidnova.app/hub</span>
						</div>
						<div className="hub-main">
							<div className="browser-heading">
								<div>
									<div className="hub-greeting">Good morning, Aye Aye</div>
									<div className="muted" style={{ fontSize: 12 }}>
										Find what you need, all in one place
									</div>
								</div>
								<span className="avatar hub-avatar">AA</span>
							</div>
							<div className="hub-search">
								<Icon name="search" size={14} color="var(--muted-foreground)" />
								<span>Search policies, documents and more…</span>
								<kbd>⌘ K</kbd>
							</div>
							<div className="hub-tabs">
								<span className="active">All</span>
								<span>Policies</span>
								<span>Documents</span>
								<span>Drive</span>
							</div>
							<div className="visual-stack">
								<div className="row hub-result">
									<span className="icon-tile">
										<Icon name="file" size={14} color="#fff" />
									</span>
									<div className="row-grow">
										<div className="strong">Safeguarding Policy 2026</div>
										<div className="muted tiny">Policy · Updated 2 days ago</div>
									</div>
									<span className="pill pill-primary">Required</span>
								</div>
								<div className="row hub-result">
									<span className="icon-tile tile-accent">
										<Icon name="link" size={14} color="#fff" />
									</span>
									<div className="row-grow">
										<div className="strong">Staff Wellbeing Resources</div>
										<div className="muted tiny">Link · Shared with People team</div>
									</div>
									<span className="pill">People</span>
								</div>
								<div className="row hub-result">
									<span className="icon-tile tile-success">
										<Icon name="folder" size={14} color="#fff" />
									</span>
									<div className="row-grow">
										<div className="strong">Q2 Programme Toolkit</div>
										<div className="muted tiny">Google Drive · 8 files</div>
									</div>
									<span className="pill">Drive</span>
								</div>
							</div>
							<div className="hub-security">
								<Icon name="lock" size={12} color="var(--muted-foreground)" />
								Protected by role-based access and department visibility
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

function Pricing() {
	const [yearly, setYearly] = useState(false);
	const period = yearly ? " /year" : " /month";

	return (
		<section id="pricing" className="section section-center">
			<span className="eyebrow">Pricing</span>
			<h2 className="section-title">Simple, honest pricing.</h2>
			<p className="section-lead" style={{ maxWidth: 560, marginTop: 12 }}>
				Every workspace starts with a 14-day free trial of the full product. When
				you're ready, request an upgrade from inside the app.
			</p>
			<div className="segmented segmented-primary" role="group" aria-label="Billing period">
				<button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>
					Monthly
				</button>
				<button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>
					Yearly · 2 months free
				</button>
			</div>
			<div className="pricing-grid">
				<div className="price-card">
					<div>
						<h3>Basic</h3>
						<p>For growing organizations</p>
					</div>
					<div>
						<span className="price-amount">{yearly ? "$300" : "$30"}</span>
						<span className="price-period">{period}</span>
					</div>
					<ul>
						<li>Up to 50 users</li>
						<li>Policies and acknowledgments</li>
						<li>Courses, quizzes and certificates</li>
						<li>Hub, files and team calendar</li>
						<li>AI assistant (beta)</li>
						<li>Email support</li>
					</ul>
					<a href={hubUrl("/sign-up")} className="btn btn-primary">
						Start free trial
					</a>
				</div>
				<div className="price-card price-card-featured">
					<div>
						<h3>Plus</h3>
						<p>Everything your organization needs to scale</p>
					</div>
					<div>
						<span className="price-amount">{yearly ? "$600" : "$60"}</span>
						<span className="price-period">{period}</span>
					</div>
					<ul>
						<li>Up to 100 users</li>
						<li>Everything in Basic</li>
						<li>Knowledge base</li>
						<li>Workflow automation</li>
						<li>Activity logs</li>
						<li>Priority support</li>
					</ul>
					<a href={hubUrl("/sign-up")} className="btn btn-white">
						Start free trial
					</a>
				</div>
			</div>
			<p className="pricing-note">
				{yearly
					? "Yearly plans cost the same as 10 months."
					: "Prices in USD per organization."}{" "}
				Need more than 100 users? <a href={`mailto:${CONTACT_EMAIL}`}>Talk to us</a>.
			</p>
		</section>
	);
}

const FAQS = [
	{
		question: "Who can see our staff information?",
		answer:
			"Access follows roles. Colleagues see each other's contact card only; managers and admins see full profiles and learning records. Files and policies can be limited to departments, and sensitive files locked with a PIN.",
	},
	{
		question: "Can we export reports for donors or audits?",
		answer:
			"Yes. Managers and admins can export CSV reports of policy acknowledgments and course completions anytime.",
	},
	{
		question: "How quickly can we get set up?",
		answer:
			"Most teams are up and running in under an hour: create your workspace, add your staff, and publish your first policy.",
	},
	{
		question: "How many staff can we add?",
		answer:
			"Basic covers up to 50 users and Plus up to 100. For larger teams, talk to us.",
	},
	{
		question: "What happens when the trial ends?",
		answer:
			"Request an upgrade from inside the app and we'll activate your plan. Your policies, courses and records stay as you left them.",
	},
];

function Faq() {
	const [openIndex, setOpenIndex] = useState(0);

	return (
		<section id="faq" className="section faq">
			<h2 className="section-title">Frequently asked questions</h2>
			<div className="faq-list">
				{FAQS.map((faq, index) => {
					const isOpen = openIndex === index;
					return (
						<div className="faq-item" key={faq.question}>
							<h3>
								<button
									type="button"
									aria-expanded={isOpen}
									onClick={() => setOpenIndex(isOpen ? -1 : index)}
								>
									{faq.question}
									<span aria-hidden="true">{isOpen ? "−" : "+"}</span>
								</button>
							</h3>
							{isOpen && <p>{faq.answer}</p>}
						</div>
					);
				})}
			</div>
		</section>
	);
}

function Cta() {
	return (
		<section className="section cta-section">
			<div className="cta">
				<h2>
					Your team is doing important work.
					<br />
					Give them the tools to show for it.
				</h2>
				<p>Set up your workspace in minutes. 14-day free trial, no card needed.</p>
				<a href={hubUrl("/sign-up")} className="btn btn-white btn-lg">
					Start your free trial
				</a>
			</div>
		</section>
	);
}

function Footer() {
	return (
		<footer className="footer">
			<div className="footer-main">
				<div className="footer-about">
					<div className="footer-brand">
						<img src={LOGO} alt="" width="28" height="28" />
						AidNova
					</div>
					<p>Policy and learning management built for NGOs and mission-driven teams.</p>
					<p>
						<a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> ·{" "}
						<a href={FACEBOOK_URL}>Facebook</a>
					</p>
				</div>
				<div className="footer-links">
					<div>
						<span>PRODUCT</span>
						<a href="#features">Features</a>
						<a href="#pricing">Pricing</a>
						<a href="#faq">FAQ</a>
					</div>
					<div>
						<span>PLATFORM</span>
						<a href="#features">Policy management</a>
						<a href="#features">Learning Hub</a>
						<a href="#hub">Employee Hub</a>
					</div>
					<div>
						<span>LEGAL</span>
						<a href="/privacy-policy">Privacy policy</a>
						<a href="/terms-of-service">Terms of service</a>
					</div>
				</div>
			</div>
			<div className="footer-bottom">
				<span>© 2026 AidNova. All rights reserved.</span>
				<span>Built for NGOs. Designed for clarity.</span>
			</div>
		</footer>
	);
}

type Lang = "en" | "my";

function Landing() {
	const [lang, setLang] = useState<Lang>("en");

	return (
		<div className="page">
			<Nav lang={lang} onLangChange={setLang} />
			<main>
				<Hero lang={lang} />
				<ProductPreview />
				<Problem />
				<Features />
				<EmployeeHub />
				<Pricing />
				<Faq />
				<Cta />
			</main>
			<Footer />
		</div>
	);
}

export default Landing;
