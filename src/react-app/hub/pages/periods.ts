export function periodLabel(period: string, language: string) {
	const quarter = /^(\d{4})-Q([1-4])$/.exec(period);
	if (quarter) return `Q${quarter[2]} ${quarter[1]}`;
	if (/^\d{4}-\d{2}$/.test(period)) {
		return new Date(`${period}-01T00:00:00Z`).toLocaleDateString(language, { month: "long", year: "numeric", timeZone: "UTC" });
	}
	return period;
}
