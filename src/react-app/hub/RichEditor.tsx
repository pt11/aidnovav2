import { useState } from "react";
import type { JSONContent } from "@tiptap/core";
import Link from "@tiptap/extension-link";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Italic, Link2, List, ListOrdered } from "lucide-react";
import { useI18n } from "./i18n";
import { buttonClass, Field, Modal } from "./ui";

// The editor shows real formatting, but what's saved stays the same simple text
// that RichText draws. Nothing from a pasted web page survives beyond these marks.
const INLINE = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;

function inlineNodes(text: string): JSONContent[] {
	const nodes: JSONContent[] = [];
	let last = 0;
	for (const match of text.matchAll(INLINE)) {
		if (match.index > last) nodes.push({ type: "text", text: text.slice(last, match.index) });
		if (match[1]) nodes.push({ type: "text", text: match[1], marks: [{ type: "bold" }] });
		else if (match[2]) nodes.push({ type: "text", text: match[2], marks: [{ type: "italic" }] });
		else {
			nodes.push({
				type: "text",
				text: match[3],
				marks: [{ type: "link", attrs: { href: match[4] } }],
			});
		}
		last = match.index + match[0].length;
	}
	if (last < text.length) nodes.push({ type: "text", text: text.slice(last) });
	return nodes;
}

export function textToDoc(text: string): JSONContent {
	const content: JSONContent[] = [];
	const lines = text.split("\n");
	let index = 0;
	while (index < lines.length) {
		const line = lines[index];
		if (line.trim() === "") {
			index += 1;
		} else if (line.startsWith("## ")) {
			content.push({
				type: "heading",
				attrs: { level: 2 },
				content: inlineNodes(line.slice(3)),
			});
			index += 1;
		} else if (/^(- |\d+\. )/.test(line)) {
			const ordered = !line.startsWith("- ");
			const pattern = ordered ? /^\d+\. / : /^- /;
			const items: JSONContent[] = [];
			while (index < lines.length && pattern.test(lines[index])) {
				items.push({
					type: "listItem",
					content: [{ type: "paragraph", content: inlineNodes(lines[index].replace(pattern, "")) }],
				});
				index += 1;
			}
			content.push({ type: ordered ? "orderedList" : "bulletList", content: items });
		} else {
			const parts: JSONContent[] = [];
			while (
				index < lines.length &&
				lines[index].trim() !== "" &&
				!lines[index].startsWith("## ") &&
				!/^(- |\d+\. )/.test(lines[index])
			) {
				if (parts.length > 0) parts.push({ type: "hardBreak" });
				parts.push(...inlineNodes(lines[index]));
				index += 1;
			}
			content.push({ type: "paragraph", content: parts });
		}
	}
	return { type: "doc", content: content.length > 0 ? content : [{ type: "paragraph" }] };
}

function inlineText(node: JSONContent): string {
	return (node.content ?? [])
		.map((child) => {
			if (child.type === "hardBreak") return "\n";
			const text = child.text ?? "";
			const link = child.marks?.find((mark) => mark.type === "link");
			if (link) return `[${text}](${String(link.attrs?.href)})`;
			if (child.marks?.some((mark) => mark.type === "bold")) return `**${text}**`;
			if (child.marks?.some((mark) => mark.type === "italic")) return `*${text}*`;
			return text;
		})
		.join("");
}

// Nested list items are flattened, because the saved format has one level.
function listLines(node: JSONContent, ordered: boolean): string[] {
	return (node.content ?? []).flatMap((item, index) =>
		(item.content ?? []).flatMap((child) => {
			if (child.type === "bulletList") return listLines(child, false);
			if (child.type === "orderedList") return listLines(child, true);
			return [`${ordered ? `${index + 1}. ` : "- "}${inlineText(child)}`];
		}),
	);
}

export function docToText(doc: JSONContent): string {
	return (doc.content ?? [])
		.map((node) => {
			if (node.type === "heading") return `## ${inlineText(node)}`;
			if (node.type === "bulletList") return listLines(node, false).join("\n");
			if (node.type === "orderedList") return listLines(node, true).join("\n");
			return inlineText(node);
		})
		.filter((block) => block.trim() !== "")
		.join("\n\n");
}

function LinkDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
	const { t } = useI18n();
	const [url, setUrl] = useState(String(editor.getAttributes("link").href ?? "https://"));
	const [invalid, setInvalid] = useState(false);

	function apply() {
		if (!/^https?:\/\/\S+$/.test(url.trim())) {
			setInvalid(true);
			return;
		}
		const chain = editor.chain().focus().extendMarkRange("link");
		if (editor.state.selection.empty && !editor.isActive("link")) {
			chain
				.insertContent({
					type: "text",
					text: url.trim(),
					marks: [{ type: "link", attrs: { href: url.trim() } }],
				})
				.run();
		} else {
			chain.setLink({ href: url.trim() }).run();
		}
		onClose();
	}

	return (
		<Modal title={t("rich.link")} open onClose={onClose}>
			<form
				className="flex flex-col gap-3.5"
				onSubmit={(event) => {
					event.preventDefault();
					apply();
				}}
			>
				<Field
					label={t("rich.link_url")}
					type="url"
					autoFocus
					error={invalid ? t("rich.link_invalid") : undefined}
					value={url}
					onChange={(event) => {
						setInvalid(false);
						setUrl(event.target.value);
					}}
				/>
				<div className="flex justify-end gap-2">
					{editor.isActive("link") && (
						<button
							type="button"
							className={buttonClass("outline", "mr-auto")}
							onClick={() => {
								editor.chain().focus().extendMarkRange("link").unsetLink().run();
								onClose();
							}}
						>
							{t("rich.link_remove")}
						</button>
					)}
					<button type="button" className={buttonClass("outline")} onClick={onClose}>
						{t("common.cancel")}
					</button>
					<button type="submit" className={buttonClass()}>
						{t("common.save")}
					</button>
				</div>
			</form>
		</Modal>
	);
}

export default function RichEditor({
	label,
	initial,
	placeholder,
	onChange,
}: {
	label: string;
	initial: string;
	placeholder?: string;
	onChange: (value: string) => void;
}) {
	const { t } = useI18n();
	const [linking, setLinking] = useState(false);
	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				heading: { levels: [2] },
				blockquote: false,
				code: false,
				codeBlock: false,
				horizontalRule: false,
				strike: false,
			}),
			Link.configure({
				openOnClick: false,
				autolink: false,
				protocols: ["http", "https"],
				HTMLAttributes: { rel: "noreferrer noopener", target: "_blank" },
			}),
		],
		content: textToDoc(initial),
		editorProps: {
			attributes: {
				role: "textbox",
				"aria-multiline": "true",
				"aria-label": label,
				class: "rich-editor min-h-40 px-4 py-3.5 leading-7 outline-none",
			},
		},
		onUpdate: ({ editor: current }) => onChange(docToText(current.getJSON())),
	});

	const tools = editor
		? [
				{
					label: t("rich.bold"),
					icon: Bold,
					active: editor.isActive("bold"),
					run: () => editor.chain().focus().toggleBold().run(),
				},
				{
					label: t("rich.italic"),
					icon: Italic,
					active: editor.isActive("italic"),
					run: () => editor.chain().focus().toggleItalic().run(),
				},
				{
					label: t("rich.heading"),
					icon: Heading2,
					active: editor.isActive("heading"),
					run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
				},
				{
					label: t("rich.bullets"),
					icon: List,
					active: editor.isActive("bulletList"),
					run: () => editor.chain().focus().toggleBulletList().run(),
				},
				{
					label: t("rich.numbers"),
					icon: ListOrdered,
					active: editor.isActive("orderedList"),
					run: () => editor.chain().focus().toggleOrderedList().run(),
				},
				{
					label: t("rich.link"),
					icon: Link2,
					active: editor.isActive("link"),
					run: () => setLinking(true),
				},
			]
		: [];

	return (
		<div className="flex flex-col gap-1.5">
			<div className="overflow-hidden rounded-md border border-input bg-card">
				<div
					role="toolbar"
					aria-label={t("rich.formatting")}
					className="flex flex-wrap gap-0.5 border-b border-border bg-background p-1.5"
				>
					{tools.map((tool) => (
						<button
							key={tool.label}
							type="button"
							aria-label={tool.label}
							aria-pressed={tool.active}
							title={tool.label}
							// Keeps the selection in the text when a button is pressed.
							onMouseDown={(event) => event.preventDefault()}
							onClick={tool.run}
							className={`grid size-[30px] place-items-center rounded ${tool.active ? "bg-selected text-selected-foreground" : "hover:bg-muted"}`}
						>
							<tool.icon size={15} aria-hidden="true" />
						</button>
					))}
				</div>
				<div className="relative max-h-[60vh] overflow-y-auto">
					{editor?.isEmpty && placeholder && (
						<p aria-hidden="true" className="pointer-events-none absolute left-4 top-3.5 text-muted-foreground">
							{placeholder}
						</p>
					)}
					<EditorContent editor={editor} />
				</div>
			</div>
			{linking && editor && <LinkDialog editor={editor} onClose={() => setLinking(false)} />}
		</div>
	);
}
