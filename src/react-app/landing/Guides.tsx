import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CONTACT_EMAIL, Icon, SiteFooter, SiteNav, usePageMeta } from "./site";
import { CATEGORIES, GUIDES, guidePath, guidePlainText, guidesHome, type Guide, type GuideBlock, type GuideLang } from "../../shared/guides-content";
import "./guides.css";

const COPY = {
	en: {
		title: "AidNova guides",
		lead: "Step-by-step help for setting up and using AidNova. New here? Start with Getting started.",
		home: "Guides",
		search: "Search guides",
		noResults: "No guides match that search.",
		results: (count: number) => `${count} ${count === 1 ? "guide" : "guides"} found`,
		browse: "All guides",
		onPage: "On this page",
		previous: "Previous",
		next: "Next",
		needHelp: "Still need help?",
		helpText: "Email us and we'll help you sort it out.",
		guideCount: (count: number) => `${count} guides`,
		notFound: "That guide doesn't exist.",
		notFoundLead: "It may have moved. All our guides are listed here.",
		tip: "Tip:",
		seo: "AidNova Guides: Help and How-tos",
		description: "Step-by-step guides for setting up and using AidNova, in English and Myanmar.",
	},
	my: {
		title: "AidNova လမ်းညွှန်များ",
		lead: "AidNova ကို ပြင်ဆင်ပြီး သုံးဖို့ အဆင့်လိုက် လမ်းညွှန်တွေပါ။ အသစ်ဆိုရင် စတင်အသုံးပြုရန် ကနေ စပါ။",
		home: "လမ်းညွှန်များ",
		search: "လမ်းညွှန် ရှာရန်",
		noResults: "ကိုက်ညီတဲ့ လမ်းညွှန် မရှိပါ။",
		results: (count: number) => `လမ်းညွှန် ${count} ခု တွေ့ပါတယ်`,
		browse: "လမ်းညွှန်အားလုံး",
		onPage: "ဒီစာမျက်နှာမှာ",
		previous: "ရှေ့",
		next: "နောက်",
		needHelp: "အကူအညီ ထပ်လိုသေးလား",
		helpText: "Email ပို့ပါ၊ ကူညီပေးပါမယ်။",
		guideCount: (count: number) => `လမ်းညွှန် ${count} ခု`,
		notFound: "ဒီလမ်းညွှန် မရှိပါ။",
		notFoundLead: "ပြောင်းရွှေ့ထားတာ ဖြစ်နိုင်ပါတယ်။ လမ်းညွှန်အားလုံးကို ဒီမှာ ကြည့်ပါ။",
		tip: "အကြံပြုချက် -",
		seo: "AidNova လမ်းညွှန်များ",
		description: "AidNova ကို ပြင်ဆင်ပြီး သုံးဖို့ အဆင့်လိုက် လမ်းညွှန်များ၊ English နဲ့ မြန်မာ။",
	},
};

const home = guidesHome;

function guideHref(target: string, lang: GuideLang) {
	if (!target.startsWith("guide:")) return target;
	const guide = GUIDES.find((item) => item.slug === target.slice(6));
	return guide ? guidePath(guide, lang) : home(lang);
}

// The small markup guides use: **bold**, `code` and [text](link).
function Rich({ text, lang }: { text: string; lang: GuideLang }) {
	const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/);
	return (
		<>
			{parts.map((part, index) => {
				if (part.startsWith("**")) return <b key={index}>{part.slice(2, -2)}</b>;
				if (part.startsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
				const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
				if (link) return <a key={index} href={guideHref(link[2], lang)}>{link[1]}</a>;
				return part;
			})}
		</>
	);
}

function GuideSearch({ lang }: { lang: GuideLang }) {
	const copy = COPY[lang];
	const [query, setQuery] = useState("");
	const input = useRef<HTMLInputElement>(null);
	const index = useMemo(
		() => GUIDES.map((guide) => ({ guide, text: `${guide.title[lang]} ${guide.summary[lang]} ${guidePlainText(guide.body[lang])}`.toLowerCase() })),
		[lang],
	);
	const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
	const results = words.length ? index.filter((entry) => words.every((word) => entry.text.includes(word))) : [];

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				input.current?.focus();
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, []);

	return (
		<div className="guide-search">
			<label>
				<Icon name="search" size={16} color="var(--muted-foreground)" />
				<span className="guide-sr">{copy.search}</span>
				<input
					ref={input}
					type="search"
					placeholder={copy.search}
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Escape") setQuery("");
					}}
				/>
			</label>
			{words.length > 0 && (
				<div className="guide-results">
					<p role="status">{results.length ? copy.results(results.length) : copy.noResults}</p>
					{results.map(({ guide }) => (
						<a key={guide.slug} href={guidePath(guide, lang)}>
							<b>{guide.title[lang]}</b>
							<span>{guide.summary[lang]}</span>
						</a>
					))}
				</div>
			)}
		</div>
	);
}

function GuideLinks({ lang, current }: { lang: GuideLang; current?: Guide }) {
	return (
		<>
			{CATEGORIES.map((category) => (
				<div key={category.key} className="guide-nav-group">
					<strong>{category.title[lang]}</strong>
					{GUIDES.filter((guide) => guide.category === category.key).map((guide) => (
						<a key={guide.slug} href={guidePath(guide, lang)} aria-current={guide === current ? "page" : undefined}>
							{guide.title[lang]}
						</a>
					))}
				</div>
			))}
		</>
	);
}

function GuideShell({
	lang,
	current,
	title,
	description,
	paths,
	children,
}: {
	lang: GuideLang;
	current?: Guide;
	title: string;
	description: string;
	paths: { en: string; my: string };
	children: ReactNode;
}) {
	const copy = COPY[lang];
	usePageMeta(title, description, lang, paths);
	return (
		<div className="page">
			<SiteNav lang={lang} page="guides" anchorBase="/my" languageLinks={paths} />
			<main className="guides">
				<div className="guides-layout">
					<aside className="guides-side">
						<GuideSearch lang={lang} />
						<details className="guides-browse">
							<summary>{copy.browse}</summary>
							<nav aria-label={copy.browse}>
								<GuideLinks lang={lang} current={current} />
							</nav>
						</details>
						<nav aria-label={copy.browse} className="guides-nav">
							<GuideLinks lang={lang} current={current} />
						</nav>
					</aside>
					{children}
				</div>
			</main>
			<SiteFooter lang={lang} anchorBase="/my" />
		</div>
	);
}

function GuideBody({ block, id, lang }: { block: GuideBlock; id: string; lang: GuideLang }) {
	if ("h" in block) return <h2 id={id}>{block.h}</h2>;
	if ("p" in block) return <p><Rich text={block.p} lang={lang} /></p>;
	if ("tip" in block) {
		return (
			<p className="guide-tip">
				<b>{COPY[lang].tip}</b> <Rich text={block.tip} lang={lang} />
			</p>
		);
	}
	if ("steps" in block) {
		return (
			<ol className="guide-steps">
				{block.steps.map((step) => <li key={step}><Rich text={step} lang={lang} /></li>)}
			</ol>
		);
	}
	if ("ul" in block) {
		return (
			<ul>
				{block.ul.map((item) => <li key={item}><Rich text={item} lang={lang} /></li>)}
			</ul>
		);
	}
	if ("shot" in block) {
		return (
			<figure className="guide-shot">
				<img src={`/site/guides/${lang}/${block.shot}.webp`} alt={block.alt} loading="lazy" width="1200" height="760" />
			</figure>
		);
	}
	return (
		<div className="guide-table">
			<table>
				<thead>
					<tr>{block.table.head.map((cell) => <th key={cell} scope="col">{cell}</th>)}</tr>
				</thead>
				<tbody>
					{block.table.rows.map((row) => (
						<tr key={row[0]}>
							{row.map((cell, index) => <td key={index}><Rich text={cell} lang={lang} /></td>)}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function GuidesHome({ lang }: { lang: GuideLang }) {
	const copy = COPY[lang];
	return (
		<GuideShell lang={lang} title={copy.seo} description={copy.description} paths={{ en: "/guides", my: "/my/guides" }}>
			<div className="guide-main">
				<h1>{copy.title}</h1>
				<p className="guide-lead">{copy.lead}</p>
				{CATEGORIES.map((category) => {
					const guides = GUIDES.filter((guide) => guide.category === category.key);
					return (
						<section key={category.key} className="guide-category">
							<h2>{category.title[lang]}</h2>
							<p>{category.summary[lang]}</p>
							<div className="guide-cards">
								{guides.map((guide) => (
									<a key={guide.slug} href={guidePath(guide, lang)} className="guide-card">
										<b>{guide.title[lang]}</b>
										<span>{guide.summary[lang]}</span>
									</a>
								))}
							</div>
						</section>
					);
				})}
			</div>
		</GuideShell>
	);
}

function GuidePage({ guide, lang }: { guide: Guide; lang: GuideLang }) {
	const copy = COPY[lang];
	const blocks = guide.body[lang];
	const headings = blocks.flatMap((block, index) => ("h" in block ? [{ id: `s${index}`, text: block.h }] : []));
	const siblings = GUIDES;
	const at = siblings.indexOf(guide);
	const previous = siblings[at - 1];
	const next = siblings[at + 1];
	const category = CATEGORIES.find((item) => item.key === guide.category);
	return (
		<GuideShell
			lang={lang}
			current={guide}
			title={`${guide.title[lang]} | AidNova`}
			description={guide.summary[lang]}
			paths={{ en: guidePath(guide, "en"), my: guidePath(guide, "my") }}
		>
			<article className="guide-main">
				<nav aria-label="Breadcrumb" className="guide-crumb">
					<a href={home(lang)}>{copy.home}</a> / {category?.title[lang]}
				</nav>
				<h1>{guide.title[lang]}</h1>
				<p className="guide-lead">{guide.summary[lang]}</p>
				{blocks.map((block, index) => <GuideBody key={index} block={block} id={`s${index}`} lang={lang} />)}
				<div className="guide-pager">
					{previous ? (
						<a href={guidePath(previous, lang)}>
							<span>{copy.previous}</span>
							<b>{previous.title[lang]}</b>
						</a>
					) : <span />}
					{next && (
						<a href={guidePath(next, lang)} className="guide-pager-next">
							<span>{copy.next}</span>
							<b>{next.title[lang]}</b>
						</a>
					)}
				</div>
				<p className="guide-help">
					<b>{copy.needHelp}</b> {copy.helpText} <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
				</p>
			</article>
			{headings.length > 0 && (
				<nav aria-label={copy.onPage} className="guide-toc">
					<span>{copy.onPage}</span>
					{headings.map((heading) => <a key={heading.id} href={`#${heading.id}`}>{heading.text}</a>)}
				</nav>
			)}
		</GuideShell>
	);
}

function GuideNotFound({ lang }: { lang: GuideLang }) {
	const copy = COPY[lang];
	return (
		<GuideShell lang={lang} title={`${copy.notFound} | AidNova`} description={copy.description} paths={{ en: "/guides", my: "/my/guides" }}>
			<div className="guide-main">
				<h1>{copy.notFound}</h1>
				<p className="guide-lead">{copy.notFoundLead}</p>
				<a href={home(lang)} className="btn btn-primary">{copy.title}</a>
			</div>
		</GuideShell>
	);
}

export default function Guides({ path }: { path: string }) {
	const lang: GuideLang = path.startsWith("/my/") ? "my" : "en";
	const rest = path.replace(/^(\/my)?\/guides\/?/, "");
	if (!rest) return <GuidesHome lang={lang} />;
	const guide = GUIDES.find((item) => `${item.category}/${item.slug}` === rest);
	return guide ? <GuidePage guide={guide} lang={lang} /> : <GuideNotFound lang={lang} />;
}
