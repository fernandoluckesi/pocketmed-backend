import { ProseMirrorNode } from '../document.types';

/**
 * Walks a Tiptap/ProseMirror JSON document and draws it with pdfkit calls.
 * Covers exactly the `StarterKit` node/mark vocabulary used by the Laudos
 * rich-text editor (heading/paragraph/bulletList/orderedList/listItem/
 * blockquote/horizontalRule/hardBreak, bold/italic marks) — not a general
 * HTML/ProseMirror renderer.
 */

function fontFor(marks?: { type: string }[]): string {
  const bold = marks?.some((m) => m.type === 'bold') ?? false;
  const italic = marks?.some((m) => m.type === 'italic') ?? false;
  if (bold && italic) return 'Helvetica-BoldOblique';
  if (bold) return 'Helvetica-Bold';
  if (italic) return 'Helvetica-Oblique';
  return 'Helvetica';
}

function renderInline(
  doc: PDFKit.PDFDocument,
  nodes: ProseMirrorNode[] | undefined,
  fontSize: number,
): void {
  const runs = nodes ?? [];
  if (runs.length === 0) {
    doc.font('Helvetica').fontSize(fontSize).text('');
    return;
  }
  runs.forEach((node, index) => {
    const isLast = index === runs.length - 1;
    if (node.type === 'hardBreak') {
      doc.text('\n', { continued: !isLast });
      return;
    }
    doc.font(fontFor(node.marks)).fontSize(fontSize).fillColor('#334155');
    doc.text(node.text ?? '', { continued: !isLast });
  });
}

function renderList(doc: PDFKit.PDFDocument, items: ProseMirrorNode[], ordered: boolean): void {
  items.forEach((item, index) => {
    const bullet = ordered ? `${index + 1}.` : '•';
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#334155').text(`${bullet} `, {
      continued: true,
      indent: 10,
    });
    const children = item.content ?? [];
    if (children.length === 0) {
      doc.text('');
    } else {
      children.forEach((child, childIndex) => {
        if (childIndex > 0) doc.text('', { indent: 10 });
        renderBlock(doc, child);
      });
    }
  });
}

export function renderBlock(doc: PDFKit.PDFDocument, node: ProseMirrorNode): void {
  switch (node.type) {
    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1;
      const size = level === 1 ? 13 : level === 2 ? 11.5 : 10.5;
      renderInline(doc, node.content, size);
      doc.moveDown(0.3);
      break;
    }
    case 'paragraph': {
      if (!node.content || node.content.length === 0) {
        doc.moveDown(0.4);
        break;
      }
      renderInline(doc, node.content, 10);
      doc.moveDown(0.4);
      break;
    }
    case 'bulletList':
      renderList(doc, node.content ?? [], false);
      doc.moveDown(0.2);
      break;
    case 'orderedList':
      renderList(doc, node.content ?? [], true);
      doc.moveDown(0.2);
      break;
    case 'horizontalRule': {
      const startX = doc.page.margins.left;
      const endX = doc.page.width - doc.page.margins.right;
      doc.moveDown(0.3);
      doc.moveTo(startX, doc.y).lineTo(endX, doc.y).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
      doc.moveDown(0.3);
      break;
    }
    case 'blockquote':
      for (const child of node.content ?? []) renderBlock(doc, child);
      break;
    default:
      for (const child of node.content ?? []) renderBlock(doc, child);
  }
}

export function renderProseMirrorDoc(doc: PDFKit.PDFDocument, root: ProseMirrorNode): void {
  for (const child of root.content ?? []) {
    renderBlock(doc, child);
  }
}
