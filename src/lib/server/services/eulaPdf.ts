import PDFDocument from 'pdfkit';
import { parse, type HTMLElement, type Node } from 'node-html-parser';

export interface EulaAcceptancePdfParams {
	organizationName: string;
	recordName: string;
	objectTypeName: string;
	assigneeName: string;
	assigneeEmail: string;
	typedName: string;
	acceptedAt: Date;
	/** The object type's EULA text as it stood at the moment of acceptance (a snapshot — later
	 *  edits to the live agreement never change an already-generated PDF). HTML from the rich
	 *  text editor. */
	eulaHtml: string;
}

interface Run {
	text: string;
	bold: boolean;
	italic: boolean;
	underline: boolean;
}

function fontFor(run: Run): string {
	if (run.bold && run.italic) return 'Helvetica-BoldOblique';
	if (run.bold) return 'Helvetica-Bold';
	if (run.italic) return 'Helvetica-Oblique';
	return 'Helvetica';
}

/** Flattens an inline node tree (text, strong/b, em/i, u, nested combinations) into a flat list of
 *  styled text runs, in order. */
function collectRuns(node: Node, style: { bold: boolean; italic: boolean; underline: boolean }, out: Run[]): void {
	if (node.nodeType === 3) {
		const text = node.rawText;
		if (text) out.push({ text, ...style });
		return;
	}
	const el = node as HTMLElement;
	const tag = el.tagName?.toLowerCase();
	const nextStyle = {
		bold: style.bold || tag === 'strong' || tag === 'b',
		italic: style.italic || tag === 'em' || tag === 'i',
		underline: style.underline || tag === 'u'
	};
	for (const child of el.childNodes) collectRuns(child, nextStyle, out);
}

/** Writes a sequence of runs as one flowing paragraph, switching font/underline per run, and
 *  finishes with a non-continued call so pdfkit advances to a fresh line afterward. */
function writeRuns(doc: PDFKit.PDFDocument, runs: Run[]): void {
	const nonEmpty = runs.filter((r) => r.text.length > 0);
	if (nonEmpty.length === 0) return;
	nonEmpty.forEach((run, i) => {
		const isLast = i === nonEmpty.length - 1;
		doc.font(fontFor(run)).text(run.text, { continued: !isLast, underline: run.underline });
	});
}

function writeBlock(doc: PDFKit.PDFDocument, el: HTMLElement): void {
	const tag = el.tagName?.toLowerCase();

	if (tag === 'ul' || tag === 'ol') {
		const items = el.childNodes.filter((n) => (n as HTMLElement).tagName?.toLowerCase() === 'li') as HTMLElement[];
		items.forEach((li, i) => {
			const prefix = tag === 'ol' ? `${i + 1}. ` : '• ';
			const runs: Run[] = [{ text: prefix, bold: false, italic: false, underline: false }];
			collectRuns(li, { bold: false, italic: false, underline: false }, runs);
			writeRuns(doc, runs);
		});
		doc.moveDown(0.3);
		return;
	}

	const sizeByTag: Record<string, number> = { h1: 16, h2: 14, h3: 12 };
	const size = sizeByTag[tag ?? ''] ?? 10.5;
	const headingBold = tag === 'h1' || tag === 'h2' || tag === 'h3';

	doc.fontSize(size);
	if (tag === 'blockquote') doc.fillColor('#555555');

	const runs: Run[] = [];
	collectRuns(el, { bold: headingBold, italic: false, underline: false }, runs);
	writeRuns(doc, runs);

	if (tag === 'blockquote') doc.fillColor('#000000');
	doc.fontSize(10.5);
	doc.moveDown(0.5);
}

export function renderEulaAcceptancePdf(params: EulaAcceptancePdfParams): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const doc = new PDFDocument({ size: 'LETTER', margin: 54 });
		const chunks: Buffer[] = [];
		doc.on('data', (chunk) => chunks.push(chunk));
		doc.on('end', () => resolve(Buffer.concat(chunks)));
		doc.on('error', reject);

		doc.fontSize(16).font('Helvetica-Bold').text('EULA Acceptance Record');
		doc.moveDown(0.5);
		doc.fontSize(10.5).font('Helvetica');
		doc.text(`Organization: ${params.organizationName}`);
		doc.text(`Item: ${params.recordName} (${params.objectTypeName})`);
		doc.text(`Assigned to: ${params.assigneeName} <${params.assigneeEmail}>`);
		doc.text(`Accepted at: ${params.acceptedAt.toLocaleString()}`);
		doc.text(`Confirmed by typing: "${params.typedName}"`);
		doc.moveDown(1);
		doc.font('Helvetica-Bold').text('Agreement');
		doc.moveDown(0.3);
		doc.font('Helvetica');

		const root = parse(params.eulaHtml || '');
		const blocks = root.childNodes.filter((n) => n.nodeType === 1) as HTMLElement[];
		if (blocks.length === 0) {
			doc.text(root.textContent || '(No agreement text was set.)');
		} else {
			for (const block of blocks) writeBlock(doc, block);
		}

		doc.end();
	});
}
