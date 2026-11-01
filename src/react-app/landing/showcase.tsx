import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./site";

type IconName = Parameters<typeof Icon>[0]["name"];

const SHOT_SIZES: Record<string, [number, number]> = {
	dashboard: [1440, 900],
	policies: [1180, 720],
	courses: [1120, 430],
	lesson: [1200, 720],
	certificate: [584, 560],
	hub: [1100, 720],
	files: [1120, 560],
	calendar: [1240, 720],
	users: [1120, 560],
	profile: [1120, 560],
	reports: [1180, 720],
	"policy-read": [1200, 720],
	"project-overview": [1440, 920],
	"project-files": [1280, 640],
	"project-reports": [1280, 640],
	"project-data": [1280, 720],
	"project-portfolio": [1280, 700],
	"project-team": [1280, 620],
	"cb-training": [1440, 860],
	"cb-review": [1180, 760],
	"cb-skills": [1180, 720],
	"cb-privacy": [1180, 760],
	"cb-directory": [1180, 680],
	"mobile-staff": [390, 780],
	"mobile-cb": [390, 780],
	"mobile-ask": [390, 780],
};

export type Tone = "blue" | "violet" | "green" | "amber" | "dark";

export function ShotImage({ name, alt }: { name: string; alt: string }) {
	const [width, height] = SHOT_SIZES[name];
	return <img src={`/site/${name}.webp`} alt={alt} width={width} height={height} loading="lazy" />;
}

// A real product screen on a coloured panel, running off its edge, with small
// cards floating over it.
export function Showcase({
	name,
	alt,
	tone = "blue",
	wide = false,
	phone,
	children,
}: {
	name: string;
	alt: string;
	tone?: Tone;
	wide?: boolean;
	phone?: { name: string; alt: string };
	children?: ReactNode;
}) {
	return (
		<div className={`showcase showcase-${tone} ${wide ? "showcase-wide" : ""}`}>
			<img className="showcase-mark" src="/blog-mark.webp" alt="" />
			<div className="shot-window">
				<div className="shot-bar" aria-hidden="true">
					<span />
					<span />
					<span />
				</div>
				<ShotImage name={name} alt={alt} />
			</div>
			{phone && (
				<div className="shot-phone">
					<ShotImage name={phone.name} alt={phone.alt} />
				</div>
			)}
			{children}
		</div>
	);
}

export function PhoneShowcase({ name, alt, tone = "blue", children }: { name: string; alt: string; tone?: Tone; children?: ReactNode }) {
	return (
		<div className={`showcase showcase-${tone} showcase-phone-only`}>
			<img className="showcase-mark" src="/blog-mark.webp" alt="" />
			<div className="shot-phone shot-phone-center">
				<ShotImage name={name} alt={alt} />
			</div>
			{children}
		</div>
	);
}

export function Float({ at, children }: { at: "tl" | "tr" | "bl" | "br"; children: ReactNode }) {
	return (
		<div className={`float-note float-${at}`} aria-hidden="true">
			{children}
		</div>
	);
}

export function Ring({ value, tone = "var(--primary)" }: { value: number; tone?: string }) {
	return (
		<span className="float-ring" style={{ background: `conic-gradient(${tone} 0 ${value}%, var(--border) ${value}% 100%)` }}>
			<span>{value}%</span>
		</span>
	);
}

export function FloatIcon({ name, tone }: { name: IconName; tone: string }) {
	return (
		<span className="float-icon" style={{ background: `${tone}1a` }}>
			<Icon name={name} size={16} color={tone} />
		</span>
	);
}

export function FloatText({ title, text }: { title: string; text?: string }) {
	return (
		<span className="float-text">
			<b>{title}</b>
			{text && <span>{text}</span>}
		</span>
	);
}

export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
	const ref = useRef<HTMLDivElement>(null);
	const [shown, setShown] = useState(false);
	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					setShown(true);
					observer.disconnect();
				}
			},
			{ rootMargin: "0px 0px -8% 0px" },
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);
	return (
		<div ref={ref} className={`reveal ${shown ? "is-shown" : ""} ${className ?? ""}`}>
			{children}
		</div>
	);
}
