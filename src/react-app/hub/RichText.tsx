import { Fragment, type ReactNode } from "react";

// Lesson text is simple marks in plain text, drawn as React elements. No HTML is
// ever stored or injected, so someone's lesson can't run scripts for its readers.
const INLINE = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;

function inline(text: string): ReactNode[] {
	const parts: ReactNode[] = [];
	let last = 0;
	for (const match of text.matchAll(INLINE)) {
		const at = match.index;
		if (at > last) parts.push(text.slice(last, at));
		if (match[1]) parts.push(<strong key={at}>{match[1]}</strong>);
		else if (match[2]) parts.push(<em key={at}>{match[2]}</em>);
		else {
			parts.push(
				<a
					key={at}
					href={match[4]}
					target="_blank"
					rel="noreferrer noopener"
					className="text-selected-foreground underline"
				>
					{match[3]}
				</a>,
			);
		}
		last = at + match[0].length;
	}
	if (last < text.length) parts.push(text.slice(last));
	return parts;
}

export function RichText({ text }: { text: string }) {
	const blocks: ReactNode[] = [];
	const lines = text.split("\n");
	let index = 0;
	while (index < lines.length) {
		const line = lines[index];
		if (line.trim() === "") {
			index += 1;
		} else if (line.startsWith("## ")) {
			blocks.push(
				<h2 key={index} className="mt-1 text-lg font-semibold">
					{inline(line.slice(3))}
				</h2>,
			);
			index += 1;
		} else if (/^(- |\d+\. )/.test(line)) {
			const ordered = !line.startsWith("- ");
			const pattern = ordered ? /^\d+\. / : /^- /;
			const start = index;
			const items: string[] = [];
			while (index < lines.length && pattern.test(lines[index])) {
				items.push(lines[index].replace(pattern, ""));
				index += 1;
			}
			const List = ordered ? "ol" : "ul";
			blocks.push(
				<List key={start} className={`pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>
					{items.map((item, position) => (
						<li key={position}>{inline(item)}</li>
					))}
				</List>,
			);
		} else {
			const start = index;
			const paragraph: string[] = [];
			while (
				index < lines.length &&
				lines[index].trim() !== "" &&
				!lines[index].startsWith("## ") &&
				!/^(- |\d+\. )/.test(lines[index])
			) {
				paragraph.push(lines[index]);
				index += 1;
			}
			blocks.push(
				<p key={start} className="whitespace-pre-wrap break-words">
					{paragraph.map((part, position) => (
						<Fragment key={position}>
							{position > 0 && "\n"}
							{inline(part)}
						</Fragment>
					))}
				</p>,
			);
		}
	}
	return <div className="flex flex-col gap-3 leading-7">{blocks}</div>;
}
