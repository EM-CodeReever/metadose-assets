/** Same escaping rule as the server's export.csv routes — a value needs quoting if it contains a comma, quote, or newline. */
function escapeCsvField(value: string): string {
	if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
	return value;
}

/** Builds and downloads a CSV template client-side — no server round-trip needed. */
export function downloadCsvTemplate(filename: string, headers: string[], exampleRow?: string[]): void {
	const lines = [headers.map(escapeCsvField).join(',')];
	if (exampleRow) lines.push(exampleRow.map(escapeCsvField).join(','));
	const csv = lines.join('\r\n');

	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
