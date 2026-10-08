import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } from 'docx';
import sharp from 'sharp';
import { config } from './config.js';
import { generateIllustration } from './ai.js';
const exec = promisify(execFile);
const blue = '#0A2540',
  teal = '#007F70';
const xml = (s) =>
  s.replace(
    /[<>&"']/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c],
  );
// Diagrams are rendered from bounded structured nodes, never arbitrary AI SVG.
async function diagramImage(d) {
  const nodes = d.nodes.slice(0, 6),
    positions = nodes.map((_, i) => ({ x: 100 + (i % 3) * 225, y: 85 + Math.floor(i / 3) * 165 }));
  const edges = d.connections
    .filter((e) => positions[e.from] && positions[e.to] && e.from !== e.to)
    .map((e) => {
      const a = positions[e.from],
        b = positions[e.to];
      return `<path d="M${a.x} ${a.y + 22} L${b.x} ${b.y - 22}" stroke="#51718d" stroke-width="2" marker-end="url(#a)"/><text x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2 - 8}" text-anchor="middle" fill="#0A2540" font-size="13">${xml(e.label)}</text>`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="650" height="330"><defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10Z" fill="#51718d"/></marker></defs><rect width="650" height="330" fill="#f4f8fa"/>${edges}${nodes.map((n, i) => `<rect x="${positions[i].x - 85}" y="${positions[i].y - 23}" width="170" height="46" rx="9" fill="#0A2540"/><text x="${positions[i].x}" y="${positions[i].y + 5}" text-anchor="middle" fill="white" font-family="sans-serif" font-size="13">${xml(n)}</text>`).join('')}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
export async function renderDocument(orderId, data, template = 'modern', illustration = 'none') {
  const dir = path.join(config.storage, 'orders', orderId);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  let image;
  if (illustration === 'diagram' && data.diagram.nodes.length)
    image = await diagramImage(data.diagram);
  if (illustration === 'image' && data.imagePrompt)
    image = await generateIllustration(data.imagePrompt);
  const pdfPath = path.join(dir, 'document.pdf'),
    docxPath = path.join(dir, 'document.docx');
  const margin = template === 'compressed' ? 42 : 52;
  const serif = ['executive', 'academic'].includes(template);
  const headingColor = template === 'canadian' ? '#1A1F36' : blue;
  const pdf = new PDFDocument({
    size: 'A4',
    margin,
    bufferPages: true,
    info: { Title: data.title, Author: 'Victorious Cyber', Creator: 'Victorious Cyber' },
  });
  const chunks = [];
  pdf.on('data', (c) => chunks.push(c));
  const finished = new Promise((resolve, reject) => {
    pdf.on('end', resolve);
    pdf.on('error', reject);
  });
  const condensed = template === 'compressed';
  const fontSize = condensed ? 10 : 11;
  const head = serif ? 'Times-Bold' : 'Helvetica-Bold';
  const bodyFont = serif ? 'Times-Roman' : 'Helvetica';
  const alignment = template === 'academic' ? 'center' : 'left';
  pdf
    .fillColor(headingColor)
    .font(head)
    .fontSize(template === 'compressed' ? 21 : 24)
    .text(data.title, { lineGap: 3, align: alignment });
  pdf
    .fillColor(template === 'canadian' ? '#4A5568' : teal)
    .font(bodyFont)
    .fontSize(10)
    .text(data.subtitle, { lineGap: 3, align: alignment });
  pdf.moveDown(1.2);
  pdf
    .moveTo(margin, pdf.y)
    .lineTo(595 - margin, pdf.y)
    .strokeColor('#c7e5e0')
    .stroke();
  pdf.moveDown();
  for (const s of data.sections) {
    if (pdf.y > 700) pdf.addPage();
    if (s.heading) {
      pdf
        .fillColor(headingColor)
        .font(head)
        .fontSize(template === 'compressed' ? 12 : 13)
        .text(s.heading, { keepWithNext: true });
      pdf.moveDown(0.35);
    }
    pdf
      .fillColor('#1A1F36')
      .font(bodyFont)
      .fontSize(fontSize)
      .text(s.body, { lineGap: condensed ? 3 : 5 });
    pdf.moveDown(condensed ? 0.7 : 1);
  }
  if (image) {
    if (pdf.y > 450) pdf.addPage();
    pdf
      .fillColor(blue)
      .font(head)
      .fontSize(12)
      .text(data.diagram.title || 'Learning illustration');
    pdf.moveDown();
    pdf.image(image, { fit: [480, 270], align: 'center' });
  }
  const pages = pdf.bufferedPageRange().count;
  for (let i = 0; i < pages; i++) {
    pdf.switchToPage(i);
    pdf
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#718096')
      .text(`${i + 1} / ${pages}`, 52, 797, { lineBreak: false, align: 'right', width: 491 });
  }
  pdf.end();
  await finished;
  await fs.writeFile(pdfPath, Buffer.concat(chunks), { mode: 0o600 });
  const children = [
    new Paragraph({ text: data.title, heading: HeadingLevel.TITLE }),
    new Paragraph({ text: data.subtitle }),
  ];
  for (const s of data.sections) {
    if (s.heading)
      children.push(
        new Paragraph({ text: s.heading, heading: HeadingLevel.HEADING_1, keepNext: true }),
      );
    for (const line of s.body.split('\n'))
      children.push(
        new Paragraph({
          children: [new TextRun({ text: line, size: fontSize * 2 })],
          spacing: { after: 120 },
        }),
      );
  }
  if (image)
    children.push(
      new Paragraph({
        children: [
          new ImageRun({
            type: 'png',
            data: image,
            transformation: {
              width: 480,
              height: Math.round(
                ((await sharp(image).metadata()).height / (await sharp(image).metadata()).width) *
                  480,
              ),
            },
          }),
        ],
      }),
    );
  const word = new Document({
    creator: 'Victorious Cyber',
    title: data.title,
    styles: {
      default: {
        document: {
          run: { font: serif ? 'Times New Roman' : 'Arial', size: fontSize * 2, color: '1A1F36' },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1040, bottom: 1040, left: 1040, right: 1040 },
          },
        },
        children,
      },
    ],
  });
  await fs.writeFile(docxPath, await Packer.toBuffer(word), { mode: 0o600 });
  // Only rasterized, visibly watermarked pages are sent to unpaid visitors.
  await exec(
    config.popplerBin ? path.join(config.popplerBin, 'pdftoppm') : 'pdftoppm',
    ['-scale-to', '800', '-png', pdfPath, path.join(dir, 'raw')],
    {
      timeout: 45000,
      maxBuffer: 1024 * 1024,
    },
  );
  const files = (await fs.readdir(dir))
    .filter((f) => /^raw-\d+\.png$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  for (let i = 0; i < files.length; i++) {
    const raw = path.join(dir, files[i]);
    const meta = await sharp(raw).metadata();
    const watermark = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="${meta.height}"><g fill="#0A2540" opacity="0.22" font-family="sans-serif" font-size="42" font-weight="bold" transform="rotate(-32 ${meta.width / 2} ${meta.height / 2})"><text x="${meta.width / 2}" y="${meta.height / 2 - 110}" text-anchor="middle">VICTORIOUS CYBER</text><text x="${meta.width / 2}" y="${meta.height / 2}" text-anchor="middle">UNPAID PREVIEW</text><text x="${meta.width / 2}" y="${meta.height / 2 + 110}" text-anchor="middle">vcyber.co.ke</text></g></svg>`,
    );
    await sharp(raw)
      .composite([{ input: watermark }])
      .jpeg({ quality: 55 })
      .toFile(path.join(dir, `preview-${i + 1}.jpg`));
    await fs.unlink(raw);
  }
  return { pdfPath, docxPath, pages, previewCount: files.length };
}
