// Save a chart as a PNG. The pure helpers build the standalone SVG document; the DOM part draws it to a canvas.

const XMLNS = 'http://www.w3.org/2000/svg';
const EVIDENCE_CAPTION = 'Conceptual rendering of a proposed S.P.H.E.R.E. facility. Not a photograph of existing equipment. Instrument appearance is approximate, and equipment selections are provisional. Copper artifact not to scale.';

export function safeFilename(title: string, ext = 'png'): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'chart';
  return `sphere-${base}.${ext}`;
}

export interface SvgPiece { readonly markup: string; readonly width: number; readonly height: number }

/** Wraps SVG markup (its outer <svg> tag included) so it stands alone: namespace, size and a background. */
export function svgDocument(pieces: readonly SvgPiece[], background = '#0b121b', gap = 12, title = ''): { svg: string; width: number; height: number } {
  const head = title ? 28 : 0;
  const width = pieces.reduce((s, p) => s + p.width, 0) + gap * Math.max(0, pieces.length - 1) + 24;
  const contentHeight = Math.max(0, ...pieces.map(p => p.height)) + 24 + head;
  const footerHeight = 50;
  const height = contentHeight + footerHeight;
  let x = 12;
  const body = pieces.map(p => {
    const inner = p.markup.replace(/^<svg\b[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');
    const g = `<g transform="translate(${x} ${12 + head})">${inner}</g>`;
    x += p.width + gap;
    return g;
  }).join('');
  const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
  const text = title ? `<text x="12" y="20" fill="#cbd5e1" font-family="system-ui,sans-serif" font-size="14" font-weight="700">${esc(title)}</text>` : '';
  const captionLines = [
    'Conceptual rendering of a proposed S.P.H.E.R.E. facility.',
    'Not a photograph of existing equipment. Instrument appearance is approximate,',
    'and equipment selections are provisional. Copper artifact not to scale.'
  ];
  const caption = `<g aria-label="${esc(EVIDENCE_CAPTION)}"><rect x="0" y="${contentHeight}" width="${width}" height="${footerHeight}" fill="#090b0f"/>${captionLines.map((line, i) => `<text x="${width / 2}" y="${contentHeight + 13 + i * 14}" text-anchor="middle" fill="#fde68a" font-family="system-ui,sans-serif" font-size="8" font-weight="600">${esc(line)}</text>`).join('')}</g>`;
  return { width, height, svg: `<svg xmlns="${XMLNS}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${background}"/>${text}${body}${caption}</svg>` };
}

/** Size an element's SVG will draw at: its viewBox if it has one, else its rendered box. */
export function svgSize(el: SVGSVGElement): { width: number; height: number } {
  const r = el.getBoundingClientRect();
  return { width: Math.max(1, Math.round(r.width)), height: Math.max(1, Math.round(r.height)) };
}

/** Draws the SVG elements side by side to a PNG and downloads it. Rejects if the browser cannot rasterize the image. */
export async function exportSvgsAsPng(svgs: readonly SVGSVGElement[], title: string, scale = 2): Promise<void> {
  if (!svgs.length) throw new Error('Nothing to export.');
  const ser = new XMLSerializer();
  const pieces = svgs.map(el => {
    const { width, height } = svgSize(el);
    const clone = el.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', XMLNS); clone.setAttribute('width', String(width)); clone.setAttribute('height', String(height));
    if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
    clone.querySelectorAll('text').forEach(t => { if (!t.getAttribute('font-family')) t.setAttribute('font-family', 'ui-monospace,Menlo,monospace'); });
    return { markup: ser.serializeToString(clone), width, height };
  });
  const doc = svgDocument(pieces, '#0b121b', 12, title);
  const url = URL.createObjectURL(new Blob([doc.svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('The browser could not draw this chart.')); img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(doc.width * scale); canvas.height = Math.round(doc.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available.');
    ctx.scale(scale, scale); ctx.drawImage(img, 0, 0, doc.width, doc.height);
    const blob: Blob = await new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('Could not encode the image.'))), 'image/png'));
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = safeFilename(title); link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } finally { URL.revokeObjectURL(url); }
}
