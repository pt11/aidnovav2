// Cells starting with these could run as formulas when opened in a spreadsheet,
// and names and titles here are typed by other people.
const FORMULA_START = /^[=+\-@\t\r]/;

export function downloadCsv(name: string, rows: (string | number)[][]) {
	const cell = (value: string | number) => {
		const text = String(value);
		const safe = typeof value === "string" && FORMULA_START.test(text) ? `'${text}` : text;
		return `"${safe.replace(/"/g, '""')}"`;
	};
	// A byte-order mark so Excel reads Burmese text correctly.
	const blob = new Blob([`\ufeff${rows.map((row) => row.map(cell).join(",")).join("\n")}`], {
		type: "text/csv;charset=utf-8",
	});
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = name;
	link.click();
	URL.revokeObjectURL(url);
}
