import { lazy, Suspense, useState, type ReactNode } from "react";
import "./landing-base.css";
import "./landing.css";
import "./site.css";
import { HOME_COPY, type HomeCopy } from "./home-copy";
import { PrivacyPolicyPage, TermsOfServicePage } from "./Legal";
import { Float, FloatIcon, FloatText, Reveal, Ring, Showcase, ShotImage, type Tone } from "./showcase";
import { CONTACT_EMAIL, HeroTiles, hubUrl, Icon, SiteFooter, SiteNav, usePageMeta, type Lang } from "./site";

type IconName = Parameters<typeof Icon>[0]["name"];

function SectionHead({ eyebrow, title, lead }: { eyebrow: string; title: string | string[]; lead?: string }) {
	const lines = Array.isArray(title) ? title : [title];
	return (
		<div className="section-center">
			<span className="eyebrow">{eyebrow}</span>
			<h2 className="section-title">
				{lines.map((line, index) => (
					<span key={line} className="title-line">
						{index > 0 && " "}
						{line}
					</span>
				))}
			</h2>
			{lead && <p className="section-lead">{lead}</p>}
		</div>
	);
}

function Hero({ copy }: { copy: HomeCopy["hero"] }) {
	return (
		<section id="top" className="section hero hero-tiled">
			<HeroTiles />
			<a href={hubUrl("/sign-up")} className="hero-badge">
				<span>{copy.badge}</span>
				{copy.badgeCta}
			</a>
			<h1 className="hero-title">
				{copy.title[0]}
				<br />
				{copy.title[1]}
			</h1>
			<p className="hero-lead">{copy.lead}</p>
			<div className="hero-actions">
				<a href={hubUrl("/sign-up")} className="btn btn-primary">
					{copy.primary}
				</a>
				{copy.secondary && (
					<a href="#features" className="btn btn-outline">
						{copy.secondary}
					</a>
				)}
			</div>
			<p className="hero-setup">
				<Icon name="clock" size={15} color="currentColor" />
				{copy.setup}
			</p>
		</section>
	);
}

function ProductScreen({ copy }: { copy: HomeCopy["preview"] }) {
	return (
		<section className="section screen-section" aria-label={copy.label}>
			<Reveal>
				<div className="screen-halo">
					<div className="screen-frame">
						<ShotImage name="dashboard" alt={copy.screenAlt} />
					</div>
					<Float at="tl">
						<Ring value={92} />
						<FloatText title={copy.policyUpdated} text={copy.ackText} />
					</Float>
					<Float at="br">
						<FloatIcon name="star" tone="#22a076" />
						<FloatText title={copy.certificate} text={copy.certificateCourse} />
					</Float>
				</div>
			</Reveal>
			<p className="note">{copy.illustrative}</p>
		</section>
	);
}

function TrustRow({ copy }: { copy: HomeCopy["trustRow"] }) {
	const icons: IconName[] = copy.items.length === 4 ? ["lock", "clock", "globe", "chart"] : ["lock", "shield", "globe", "phone", "chart"];
	return (
		<section className="section trust-section">
			<p className="trust-title">{copy.title}</p>
			<ul className="trust-row">
				{copy.items.map((item, index) => (
					<li key={item}>
						<Icon name={icons[index]} size={18} color="#8996a9" />
						{item}
					</li>
				))}
			</ul>
		</section>
	);
}

function Problem({ copy }: { copy: HomeCopy["problem"] }) {
	return (
		<section className="section">
			<Reveal>
				<div className="problem-card">
					<div className="problem-top">
						<div className="problem-copy">
							<span className="eyebrow">{copy.eyebrow}</span>
							<h2 className="section-title">{copy.title}</h2>
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
								<h3>{copy.whoRead}</h3>
								<div className="chip-stack">
									<div className="chip chip-row">
										<span>Amy S.</span>
										<span className="strong">{copy.read}</span>
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
								<h3>{copy.inbox}</h3>
								<div className="chip-stack muted">
									<span className="chip">FWD: RE: RE: Policy doc</span>
									<span className="chip">RE: FWD: Training update</span>
									<span className="chip">Fwd: Has anyone read…</span>
								</div>
							</div>
							<div className="chaos-card">
								<h3>{copy.conflict}</h3>
								<div className="chip-stack">
									<div className="chip">
										<div>HR Manual 2024</div>
										<div className="strong text-destructive">{copy.outdated}</div>
									</div>
									<div className="chip">
										<div>HR Manual 2026</div>
										<div className="strong">{copy.current}</div>
									</div>
								</div>
							</div>
						</div>
					</div>
					<div className="problem-points">
						{copy.points.map((point) => (
							<div key={point.title}>
								<h3>{point.title}</h3>
								<p>{point.text}</p>
							</div>
						))}
					</div>
				</div>
			</Reveal>
		</section>
	);
}

function FeatureCard({
	title,
	text,
	shot,
	tone,
	alt,
	early,
	children,
}: {
	title: string;
	text: string;
	shot: string;
	tone: Tone;
	alt: string;
	early?: string;
	children?: ReactNode;
}) {
	return (
		<div className="v3-card">
			<div className={`v3-art showcase-${tone}`}>
				<img className="showcase-mark" src="/blog-mark.webp" alt="" />
				<ShotImage name={shot} alt={alt} />
				{children}
			</div>
			<h3>
				{title}
				{early && <em>{early}</em>}
			</h3>
			<p>{text}</p>
		</div>
	);
}

function Features({ copy }: { copy: HomeCopy["features"] }) {
	return (
		<section id="features" className="section">
			<SectionHead eyebrow={copy.eyebrow} title={copy.title} lead={copy.lead} />
			<div className="v3-grid">
				<FeatureCard {...copy.policy} shot="policies" tone="blue">
					<Float at="bl">
						<Ring value={92} />
						<FloatText title={copy.policyFloat} text="Employee Handbook 2026" />
					</Float>
				</FeatureCard>
				<FeatureCard {...copy.learning} shot="lesson" tone="violet">
					<div className="float-shot float-br" aria-hidden="true">
						<ShotImage name="certificate" alt="" />
					</div>
				</FeatureCard>
				<FeatureCard {...copy.projects} shot="project-overview" tone="green" />
				<FeatureCard {...copy.ask} shot="hub" tone="amber">
					<Float at="tr">
						<span className="ask-orb" aria-hidden="true" />
						<FloatText title="AidNova assistant" text={copy.askFloat} />
					</Float>
				</FeatureCard>
			</div>
			<p className="note">{copy.illustrative}</p>
			<p className="features-more">
				<a href="/features">{copy.more}</a>
			</p>
		</section>
	);
}

function Benefits({ copy }: { copy: HomeCopy["benefits"] }) {
	return (
		<section className="section">
			<SectionHead eyebrow={copy.eyebrow} title={copy.title} lead={copy.lead} />
			<div className="benefit-grid">
				{copy.items.map((item) => (
					<div className="benefit-card" key={item.title}>
						<span className="benefit-icon">
							<Icon name={item.icon as IconName} size={20} />
						</span>
						<h3>{item.title}</h3>
						<p>{item.text}</p>
					</div>
				))}
			</div>
		</section>
	);
}

function HowItWorks({ copy }: { copy: HomeCopy["how"] }) {
	return (
		<section className="section">
			<SectionHead eyebrow={copy.eyebrow} title={copy.title} lead={copy.lead} />
			<div className="how-grid">
				<div className="how-card">
					<div className="how-art" aria-hidden="true">
						<div className="how-form">
							<span>{copy.orgLabel}</span>
							<div className="how-input">Hope Health Myanmar</div>
							<div className="how-button">{copy.createLabel}</div>
						</div>
					</div>
					<span className="how-step">{copy.steps[0].label}</span>
					<h3>{copy.steps[0].title}</h3>
					<p>{copy.steps[0].text}</p>
				</div>
				<div className="how-card">
					<div className="how-art" aria-hidden="true">
						<div className="how-people">
							{[
								["JD", "James D.", "Admin"],
								["AS", "Amy S.", "Manager"],
								["RN", "Rachel N.", "Staff"],
							].map(([initials, name, role]) => (
								<div key={name}>
									<i>{initials}</i>
									<b>{name}</b>
									<span>{role}</span>
								</div>
							))}
							<em>+ Import from CSV</em>
						</div>
					</div>
					<span className="how-step">{copy.steps[1].label}</span>
					<h3>{copy.steps[1].title}</h3>
					<p>{copy.steps[1].text}</p>
				</div>
				<div className="how-card">
					<div className="how-art" aria-hidden="true">
						<div className="how-form">
							<b>
								<Icon name="file" size={16} />
								Leave Policy 2026
							</b>
							<span>Published to all departments</span>
							<div className="how-actions">
								<div className="how-button">Publish</div>
								<div className="how-outline">Require acknowledgment ✓</div>
							</div>
						</div>
					</div>
					<span className="how-step">{copy.steps[2].label}</span>
					<h3>{copy.steps[2].title}</h3>
					<p>{copy.steps[2].text}</p>
				</div>
			</div>
		</section>
	);
}

const FILE_TILES: [string, string, string, string][] = [
	["PDF", "#dc2828", "8%", "60px"],
	["VIDEO", "#753ff3", "3%", "190px"],
	["DOCX", "#0066f5", "17%", "170px"],
	["LINK", "#22a076", "84%", "50px"],
	["CSV", "#121212", "89%", "180px"],
	["SLIDES", "#f59f0a", "77%", "160px"],
];

function EmployeeHub({ copy }: { copy: HomeCopy["hub"] }) {
	return (
		<section id="hub" className="section">
			<div className="hub-panel">
				{FILE_TILES.map(([label, color, left, top], index) => (
					<span
						key={label}
						aria-hidden="true"
						className="file-tile-float"
						style={{ left, top, color, transform: `rotate(${index % 2 ? 6 : -8}deg)` }}
					>
						<Icon name="file" size={18} color="currentColor" />
						{label}
					</span>
				))}
				<div className="hub-panel-head">
					<span className="eyebrow">{copy.eyebrow}</span>
					<h2 className="section-title">{copy.title}</h2>
					<p className="section-lead">{copy.lead}</p>
					{copy.points.length > 0 && (
						<ul className="hub-panel-points">
							{copy.points.map((point) => (
								<li key={point}>
									<Icon name="tick" size={16} color="#22a076" />
									{point}
								</li>
							))}
						</ul>
					)}
					<a href={copy.moreHref} className="btn btn-primary">
						{copy.cta}
					</a>
				</div>
				<Reveal className="hub-panel-show">
					<Showcase wide name="hub" alt={copy.screenAlt} tone="green" phone={{ name: "mobile-staff", alt: copy.phoneAlt }} />
				</Reveal>
			</div>
		</section>
	);
}

function WhyCompare({ copy }: { copy: HomeCopy["why"] }) {
	return (
		<section className="section">
			<SectionHead eyebrow={copy.eyebrow} title={copy.title} lead={copy.lead} />
			<div className="compare-card">
				<div>
					<h3>{copy.beforeTitle}</h3>
					<ul>
						{copy.before.map((item) => (
							<li key={item}>
								<Icon name="close" size={16} color="#8996a9" />
								{item}
							</li>
						))}
					</ul>
				</div>
				<div className="compare-after">
					<h3>
						<img src="/aidnova-logo.webp" alt="" width="26" height="26" />
						AidNova
					</h3>
					<ul>
						{copy.after.map((item) => (
							<li key={item}>
								<Icon name="tick" size={16} color="#22a076" />
								{item}
							</li>
						))}
					</ul>
				</div>
			</div>
		</section>
	);
}

function PriceColumn({
	name,
	price,
	period,
	description,
	cta,
	href,
	included,
	items,
	flag,
}: {
	name: string;
	price: string;
	period: string;
	description: string;
	cta: string;
	href: string;
	included: string;
	items: string[];
	flag?: string;
}) {
	return (
		<div className={flag ? "price-col price-col-featured" : "price-col"}>
			{flag && <div className="price-flag">{flag}</div>}
			<div className="price-col-body">
				<h3>{name}</h3>
				<p className="price-line">
					<strong>{price}</strong>
					<span>{period}</span>
				</p>
				<p className="price-desc">{description}</p>
				<a href={href} className="btn btn-primary">
					{cta}
				</a>
				<p className="price-included">{included}</p>
				<ul>
					{items.map((item) => (
						<li key={item}>
							<Icon name="tick" size={16} color="var(--foreground)" />
							{item}
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}

function Pricing({ copy }: { copy: HomeCopy["pricing"] }) {
	const [yearly, setYearly] = useState(false);
	const period = yearly ? copy.perYear : copy.perMonth;
	const signUp = hubUrl("/sign-up");

	return (
		<section id="pricing" className="section">
			<SectionHead eyebrow={copy.eyebrow} title={copy.title} lead={copy.lead} />
			<div className="billing-toggle" role="group" aria-label={copy.period}>
				<button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>
					{copy.monthly}
				</button>
				<button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>
					{copy.yearly}
					<em>{copy.yearlySave}</em>
				</button>
			</div>
			<div className="price-grid">
				<PriceColumn
					name="Basic"
					price={yearly ? "$300" : "$30"}
					period={period}
					description={copy.basic.description}
					cta={copy.cta}
					href={signUp}
					included={copy.included}
					items={copy.basic.items}
				/>
				<PriceColumn
					flag={copy.flag}
					name="Plus"
					price={yearly ? "$600" : "$60"}
					period={period}
					description={copy.plus.description}
					cta={copy.cta}
					href={signUp}
					included={copy.included}
					items={copy.plus.items}
				/>
				<PriceColumn
					name={copy.addons.name}
					price={yearly ? "$800" : "$80"}
					period={`${period} · ${copy.addons.users}`}
					description={copy.addons.description}
					cta={copy.addons.cta}
					href="/pricing#add-users"
					included={copy.included}
					items={copy.addons.items}
				/>
			</div>
			<p className="pricing-note">
				{yearly ? copy.noteYearly : copy.noteMonthly} {copy.more}{" "}
				<a href={`mailto:${CONTACT_EMAIL}`}>{copy.talk}</a>
				{copy.moreEnd}
			</p>
		</section>
	);
}

function Faq({ copy, lang }: { copy: HomeCopy["faq"]; lang: Lang }) {
	const [openIndex, setOpenIndex] = useState(0);

	return (
		<section id="faq" className="section faq">
			<SectionHead eyebrow={copy.eyebrow} title={copy.title} />
			<div className="faq-list">
				{copy.items.map((faq, index) => {
					const isOpen = openIndex === index;
					return (
						<div className="faq-item" key={faq.question}>
							<h3>
								<button type="button" aria-expanded={isOpen} onClick={() => setOpenIndex(isOpen ? -1 : index)}>
									{faq.question}
									<span aria-hidden="true">{isOpen ? "−" : "+"}</span>
								</button>
							</h3>
							{isOpen && <p>{faq.answer}</p>}
						</div>
					);
				})}
			</div>
			<p className="faq-more">
				<a href="/faq" className="btn btn-outline">
					{lang === "my" ? "More in the FAQ (English)" : "More in the FAQ"}
				</a>
			</p>
		</section>
	);
}

function Cta({ copy }: { copy: HomeCopy["cta"] }) {
	return (
		<section className="section cta-section">
			<div className="cta">
				<img className="showcase-mark" src="/blog-mark.webp" alt="" />
				<h2>{copy.title[0]}</h2>
				<p>
					{copy.title[1] && `${copy.title[1]} `}
					{copy.text}
				</p>
				<a href={hubUrl("/sign-up")} className="btn btn-white">
					{copy.button}
				</a>
			</div>
		</section>
	);
}

const LEGAL_PAGES: Record<string, () => ReactNode> = {
	"/privacy-policy": PrivacyPolicyPage,
	"/terms-of-service": TermsOfServicePage,
};

const SITE_PAGES = new Set([
	"/features",
	"/employee-hub",
	"/pricing",
	"/faq",
	"/ai",
	"/projects",
	"/capacity-building",
	"/blog",
]);

const SitePages = lazy(() => import("./SitePages"));
const Guides = lazy(() => import("./Guides"));

function Landing() {
	const path = window.location.pathname.replace(/\/+$/, "");
	const LegalPage = LEGAL_PAGES[path];
	if (LegalPage) return <LegalPage />;
	if (/^(\/my)?\/guides(\/|$)/.test(path)) {
		return (
			<Suspense fallback={null}>
				<Guides path={path} />
			</Suspense>
		);
	}
	if (SITE_PAGES.has(path) || path.startsWith("/blog/")) {
		return (
			<Suspense fallback={null}>
				<SitePages path={path} />
			</Suspense>
		);
	}
	return <Home lang={path === "/my" ? "my" : "en"} />;
}

function Home({ lang }: { lang: Lang }) {
	const copy = HOME_COPY[lang];
	usePageMeta(copy.meta.title, copy.meta.description, lang, true);

	return (
		<div className="page">
			<SiteNav lang={lang} home />
			<main>
				<Hero copy={copy.hero} />
				<ProductScreen copy={copy.preview} />
				<TrustRow copy={copy.trustRow} />
				<Problem copy={copy.problem} />
				<Features copy={copy.features} />
				<Benefits copy={copy.benefits} />
				<HowItWorks copy={copy.how} />
				<EmployeeHub copy={copy.hub} />
				<WhyCompare copy={copy.why} />
				<Pricing copy={copy.pricing} />
				<Faq copy={copy.faq} lang={lang} />
				<Cta copy={copy.cta} />
			</main>
			<SiteFooter lang={lang} />
		</div>
	);
}

export default Landing;
