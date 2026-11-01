import { useEffect, useRef, useState, type ReactNode } from "react";

export type Lang = "en" | "my";

export function hubUrl(path: string) {
	const { protocol, hostname, port } = window.location;
	return hostname === "localhost" || hostname === "127.0.0.1"
		? `${protocol}//hub.localhost:${port}${path}`
		: `https://hub.aidnova.app${path}`;
}

export const LOGO = "/aidnova-logo.webp";
export const CONTACT_EMAIL = "helloaidnova@gmail.com";
export const FACEBOOK_URL = "https://www.facebook.com/people/AidNova/61585034496714/";

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
	home: (
		<>
			<path d="M3 10l9-6 9 6v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
			<path d="M9 21v-7h6v7" />
		</>
	),
	rays: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />,
	clock: (
		<>
			<circle cx="12" cy="12" r="9" />
			<path d="M12 7v5l3 2" />
		</>
	),
	tick: <path d="M5 12l4 4 10-10" />,
	megaphone: <path d="M4 10v4l12 5V5zM16 9a3 3 0 0 1 0 6M7 15v4h3v-3" />,
	square: <rect x="6" y="5" width="13" height="14" rx="2" transform="rotate(8 12 12)" />,
	chevron: <path d="m6 9 6 6 6-6" />,
	check: (
		<>
			<circle cx="12" cy="12" r="9" />
			<path d="m8.5 12 2.5 2.5 4.5-5" />
		</>
	),
	spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
	chart: <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />,
	users: (
		<>
			<circle cx="9" cy="8" r="3.5" />
			<path d="M3 20a6 6 0 0 1 12 0M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.5a6 6 0 0 1 3 5.5" />
		</>
	),
	flag: <path d="M6 21V4h11l-2 4 2 4H6" />,
	copy: (
		<>
			<rect x="9" y="9" width="11" height="11" rx="2" />
			<path d="M5 15V6a2 2 0 0 1 2-2h9" />
		</>
	),
	eyeOff: <path d="M3 3l18 18M10.6 5.2A9.8 9.8 0 0 1 12 5c5 0 9 5 9 7a9 9 0 0 1-2.4 3.4M6.5 6.8C4.2 8.3 3 10.6 3 12c0 2 4 7 9 7 1.6 0 3-.4 4.3-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2" />,
	star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
	quote: <path d="M9 7H5v6h4V7zm0 6c0 2-1 3-3 4M19 7h-4v6h4V7zm0 6c0 2-1 3-3 4" />,
};

type IconKey = keyof typeof ICONS;

export function Icon({
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

function setHeadLink(rel: string, href: string, hreflang?: string) {
	const selector = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]`;
	let link = document.head.querySelector<HTMLLinkElement>(selector);
	if (!link) {
		link = document.createElement("link");
		link.rel = rel;
		if (hreflang) link.hreflang = hreflang;
		document.head.append(link);
	}
	link.href = href;
}

// The English and Myanmar landing pages point at each other so search engines
// show people the one in their language. Other pages are English only.
export function usePageMeta(
	title: string,
	description: string,
	lang: Lang = "en",
	alternates: boolean | { en: string; my: string } = false,
) {
	useEffect(() => {
		document.title = title;
		document.documentElement.lang = lang;
		document.querySelector('meta[name="description"]')?.setAttribute("content", description);
		const origin = window.location.origin;
		setHeadLink("canonical", origin + (window.location.pathname.replace(/\/+$/, "") || "/"));
		if (alternates) {
			const paths = alternates === true ? { en: "/", my: "/my" } : alternates;
			setHeadLink("alternate", `${origin}${paths.en}`, "en");
			setHeadLink("alternate", `${origin}${paths.my}`, "my");
		}
	}, [title, description, lang, alternates]);
}

// Menu labels stay in English on the Myanmar page too, for now.
const NAV_COPY = {
	features: "Features",
	projects: "Projects",
	capacity: "Capacity Building",
	ai: "AI",
	hub: "Employee Hub",
	pricing: "Pricing",
	blog: "Blog",
	guides: "Guides",
	faq: "FAQ",
	signIn: "Sign in",
	signUp: "Start free trial",
	openMenu: "Open menu",
	closeMenu: "Close menu",
	main: "Main",
	language: "Language",
	early: "Early access",
	allFeatures: "ALL FEATURES",
	seeEverything: "See everything AidNova does",
	explore: "Explore features →",
	compare: "Compare plans",
	bothLanguages: "Works in English and မြန်မာ",
	onlyAllowed: "Each person sees only what they’re allowed to",
};

type MegaIcon = "home" | "folder" | "users" | "rays";

interface MegaModule {
	key: NavPage;
	icon: MegaIcon;
	tone: string;
	title: string;
	text: string;
	early: boolean;
	href: string;
	links: { label: string; href: string }[];
}

function megaModules(lang: Lang, anchorBase: string): MegaModule[] {
	const my = lang === "my";
	return [
		{
			key: "hub",
			icon: "home",
			tone: "#0066f5",
			title: NAV_COPY.hub,
			text: "Policies, courses, files and announcements in one place for every staff member.",
			early: false,
			href: "/employee-hub",
			links: [
				{ label: "Policies", href: my ? `${anchorBase}#features` : "/features#policies" },
				{ label: "Courses", href: my ? `${anchorBase}#features` : "/features#learning" },
				{ label: "Files & announcements", href: my ? `${anchorBase}#hub` : "/features#hub-files" },
			],
		},
		{
			key: "projects",
			icon: "folder",
			tone: "#22a076",
			title: NAV_COPY.projects,
			text: "Plan projects, track milestones, share files and approve reports.",
			early: true,
			href: "/projects",
			links: [
				{ label: "Milestones", href: "/projects" },
				{ label: "Files & data", href: "/projects" },
				{ label: "Reports", href: "/projects" },
			],
		},
		{
			key: "capacity",
			icon: "users",
			tone: "#753ff3",
			title: NAV_COPY.capacity,
			text: "Record training, review it and build a picture of your team’s skills.",
			early: true,
			href: "/capacity-building",
			links: [
				{ label: "Training records", href: "/capacity-building" },
				{ label: "Skills & badges", href: "/capacity-building" },
				{ label: "Privacy", href: "/capacity-building#privacy" },
			],
		},
		{
			key: "ai",
			icon: "rays",
			tone: "#f59f0a",
			title: NAV_COPY.ai,
			text: "Ask AidNova and Project Intelligence — answers that show their sources.",
			early: false,
			href: "/ai",
			links: [
				{ label: "Ask AidNova", href: "/ai" },
				{ label: "Project Intelligence", href: "/ai" },
			],
		},
	];
}

function NavDropdown({
	label,
	current,
	open,
	onToggle,
	onClose,
	className,
	children,
}: {
	label: string;
	current: boolean;
	open: boolean;
	onToggle: () => void;
	onClose: () => void;
	className: string;
	children: ReactNode;
}) {
	const root = useRef<HTMLDivElement>(null);
	return (
		<div
			ref={root}
			className={`nav-drop ${className} ${open ? "is-open" : ""}`}
			onBlur={(event) => {
				if (open && event.relatedTarget && !root.current?.contains(event.relatedTarget as Node)) onClose();
			}}
		>
			<button type="button" aria-expanded={open} aria-haspopup="true" className={current ? "nav-current" : undefined} onClick={onToggle}>
				{label}
				<Icon name="chevron" size={14} color="currentColor" />
			</button>
			<div className="nav-panel">{children}</div>
		</div>
	);
}

export type NavPage = "features" | "hub" | "projects" | "capacity" | "ai" | "pricing" | "blog" | "guides" | "faq";

// On the landing page some links jump to its sections. The Myanmar page keeps
// people on the page they can read wherever it has that section.
// anchorBase is for Myanmar pages other than the landing page, whose links have to go back to it.
export function SiteNav({
	lang = "en",
	page,
	home = false,
	anchorBase = "",
	languageLinks = { en: "/", my: "/my" },
}: {
	lang?: Lang;
	page?: NavPage;
	home?: boolean;
	anchorBase?: string;
	languageLinks?: { en: string; my: string };
}) {
	const [menuOpen, setMenuOpen] = useState(false);
	const [openPanel, setOpenPanel] = useState<string | null>(null);
	const toggleRef = useRef<HTMLButtonElement>(null);
	const navRef = useRef<HTMLElement>(null);
	const copy = NAV_COPY;
	const my = lang === "my";
	const closeAll = () => {
		setMenuOpen(false);
		setOpenPanel(null);
	};

	useEffect(() => {
		if (!menuOpen && !openPanel) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			const button = (document.activeElement as HTMLElement | null)
				?.closest(".nav-drop")
				?.querySelector("button");
			if (menuOpen) toggleRef.current?.focus();
			else button?.focus();
			closeAll();
		};
		const onPointerDown = (event: PointerEvent) => {
			if (!navRef.current?.contains(event.target as Node)) {
				setOpenPanel(null);
			}
		};
		document.addEventListener("keydown", onKeyDown);
		document.addEventListener("pointerdown", onPointerDown);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			document.removeEventListener("pointerdown", onPointerDown);
		};
	}, [menuOpen, openPanel]);

	const dropdown = (name: string) => ({
		open: openPanel === name,
		onToggle: () => setOpenPanel(openPanel === name ? null : name),
		onClose: () => setOpenPanel(null),
	});
	const featuresActive = page === "features" || page === "hub" || page === "projects" || page === "capacity" || page === "ai";

	return (
		<header className="site-header">
			<nav ref={navRef} className="site-nav" aria-label={copy.main}>
				<a href={home ? "#top" : "/"} className="brand" onClick={closeAll}>
					<img src={LOGO} alt="" width="28" height="28" />
					AidNova
				</a>
				<button
					ref={toggleRef}
					type="button"
					className="menu-toggle"
					aria-label={menuOpen ? copy.closeMenu : copy.openMenu}
					aria-expanded={menuOpen}
					aria-controls="site-menu"
					onClick={() => setMenuOpen((open) => !open)}
				>
					<Icon name={menuOpen ? "close" : "menu"} size={22} color="var(--foreground)" />
				</button>
				<div id="site-menu" className={menuOpen ? "nav-menu open" : "nav-menu"}>
					<div className="nav-links">
						<NavDropdown
							{...dropdown("features")}
							label={copy.features}
							current={featuresActive}
							className="nav-mega"
						>
							<div className="mega">
								<div className="mega-grid">
									<div className="mega-modules">
										{megaModules(lang, anchorBase).map((module) => (
											<div key={module.key} className={page === module.key ? "mega-module is-current" : "mega-module"}>
												<a
													className="mega-main"
													href={module.href}
													aria-current={page === module.key ? "page" : undefined}
													onClick={closeAll}
												>
													<span className="mega-icon" style={{ background: `${module.tone}1a` }}>
														<Icon name={module.icon} size={20} color={module.tone} />
													</span>
													<span>
														<b>
															{module.title}
															{module.early && <em>{copy.early}</em>}
														</b>
														<span>{module.text}</span>
													</span>
												</a>
												<div className="mega-subs">
													{module.links.map((link) => (
														<a key={link.label} href={link.href} onClick={closeAll}>
															{link.label}
														</a>
													))}
												</div>
											</div>
										))}
									</div>
									<div className="mega-side">
										<a className="mega-promo" href={my ? `${anchorBase}#features` : "/features"} onClick={closeAll}>
											<img src="/blog-mark.webp" alt="" />
											<span className="mega-promo-label">{copy.allFeatures}</span>
											<b>{copy.seeEverything}</b>
											<span className="mega-promo-cta">{copy.explore}</span>
										</a>
										<a className="mega-compare" href={my ? `${anchorBase}#pricing` : "/pricing"} onClick={closeAll}>
											{copy.compare}
											<span aria-hidden="true">→</span>
										</a>
									</div>
								</div>
								<div className="mega-strip">
									<span>
										<Icon name="globe" size={15} color="currentColor" />
										{copy.bothLanguages}
									</span>
									<span>
										<Icon name="shield" size={15} color="currentColor" />
										{copy.onlyAllowed}
									</span>
								</div>
							</div>
						</NavDropdown>
						<a
							className="nav-plain"
							href={my ? `${anchorBase}#pricing` : "/pricing"}
							aria-current={page === "pricing" ? "page" : undefined}
							onClick={closeAll}
						>
							{copy.pricing}
						</a>
						<a className="nav-plain" href="/blog" aria-current={page === "blog" ? "page" : undefined} onClick={closeAll}>
							{copy.blog}
						</a>
						<a className="nav-plain" href={my ? "/my/guides" : "/guides"} aria-current={page === "guides" ? "page" : undefined} onClick={closeAll}>
							{copy.guides}
						</a>
						<a
							className="nav-plain"
							href={my ? `${anchorBase}#faq` : "/faq"}
							aria-current={page === "faq" ? "page" : undefined}
							onClick={closeAll}
						>
							{copy.faq}
						</a>
					</div>
					<div className="nav-actions">
						<div className="segmented" role="group" aria-label={copy.language}>
							<a href={languageLinks.en} aria-current={my ? undefined : "true"}>
								EN
							</a>
							<a href={languageLinks.my} lang="my" aria-current={my ? "true" : undefined}>
								မြန်မာ
							</a>
						</div>
						<a href={hubUrl("/sign-in")} className="nav-signin">
							{copy.signIn}
						</a>
						<a href={hubUrl("/sign-up")} className="btn btn-primary btn-sm nav-signup">
							{copy.signUp}
						</a>
					</div>
				</div>
			</nav>
		</header>
	);
}

// The floating icons either side of a page's main heading.
export function HeroTiles() {
	const tiles: [IconKey, string][] = [
		["file", "#0066f5"],
		["square", "#753ff3"],
		["folder", "#22a076"],
		["rays", "#f59f0a"],
	];
	return (
		<>
			{tiles.map(([name, color], index) => (
				<span key={name} aria-hidden="true" className={`hero-tile hero-tile-${index + 1}`}>
					<Icon name={name} size={28} color={color} />
				</span>
			))}
		</>
	);
}

const FOOTER_TAGLINE = {
	en: "Policy and learning management built for NGOs and mission-driven teams.",
	my: "NGO များ၊ INGO များနှင့် ခေတ်မီအဖွဲ့အစည်းများအတွက် မူဝါဒ (Policy) နှင့် ဝန်ထမ်းသင်တန်း စီမံခန့်ခွဲရေး ပလက်ဖောင်း။",
};

export function SiteFooter({ lang = "en", anchorBase = "" }: { lang?: Lang; anchorBase?: string }) {
	const nav = NAV_COPY;
	const my = lang === "my";
	return (
		<footer className="site-footer">
			<div className="site-footer-main">
				<div className="site-footer-brand">
					<a href="/" className="brand">
						<img src={LOGO} alt="" width="30" height="30" />
						AidNova
					</a>
					<p>{FOOTER_TAGLINE[lang]}</p>
					<a href={hubUrl("/sign-up")} className="btn btn-primary">
						{nav.signUp}
					</a>
				</div>
				<div className="site-footer-links">
					<strong>Product</strong>
					<a href={my ? `${anchorBase}#features` : "/features"}>{nav.features}</a>
					<a href={my ? `${anchorBase}#pricing` : "/pricing"}>{nav.pricing}</a>
					{my ? <a href="/">English</a> : <a href="/my" lang="my">မြန်မာ</a>}
				</div>
				<div className="site-footer-links">
					<strong>Platform</strong>
					<a href={my ? `${anchorBase}#hub` : "/employee-hub"}>{nav.hub}</a>
					<a href="/projects">{nav.projects}</a>
					<a href="/capacity-building">{nav.capacity}</a>
					<a href="/ai">{nav.ai}</a>
				</div>
				<div className="site-footer-links">
					<strong>Resources</strong>
					<a href={my ? "/my/guides" : "/guides"}>{nav.guides}</a>
					<a href="/blog">{nav.blog}</a>
					<a href={my ? `${anchorBase}#faq` : "/faq"}>{nav.faq}</a>
					<a href={FACEBOOK_URL}>Facebook</a>
				</div>
				<div className="site-footer-links">
					<strong>Legal</strong>
					<a href="/privacy-policy">Privacy policy</a>
					<a href="/terms-of-service">Terms of service</a>
				</div>
			</div>
			<div className="site-footer-bottom">
				<span>© 2026 AidNova. All rights reserved.</span>
				<a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
			</div>
		</footer>
	);
}
