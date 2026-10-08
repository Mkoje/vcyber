import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import AdmZip from 'adm-zip';
import { config } from './config.js';
import { id, HttpError } from './security.js';
const exec = promisify(execFile);
export const upload = multer({
  storage: multer.diskStorage({
    destination: (_r, _f, cb) => cb(null, path.join(config.storage, 'quarantine')),
    filename: (_r, _f, cb) => cb(null, id()),
  }),
  limits: { fileSize: 100 * 1024 * 1024, files: 1, fields: 10, fieldSize: 18000 },
});
export async function scanFile(file) {
  if (config.production) {
    try {
      await exec(process.env.CLAMSCAN_PATH || 'clamscan', ['--no-summary', file.path], {
        timeout: 60000,
        maxBuffer: 1024 * 1024,
      });
    } catch {
      throw new HttpError(
        422,
        'Upload rejected: the malware scan failed or is unavailable. Contact support.',
      );
    }
  }
}
export async function extractCv(file) {
  if (!file) return '';
  try {
    if (file.size > 5 * 1024 * 1024) throw new HttpError(413, 'CV uploads must be below 5 MB.');
    await scanFile(file);
    const header = await fs.readFile(file.path);
    let text = '';
    if (header.subarray(0, 5).toString() === '%PDF-') {
      const result = await exec(
        config.popplerBin ? path.join(config.popplerBin, 'pdftotext') : 'pdftotext',
        ['-layout', file.path, '-'],
        {
          timeout: 15000,
          maxBuffer: 150000,
        },
      );
      text = result.stdout;
    } else if (header[0] === 0x50 && header[1] === 0x4b && /\.docx$/i.test(file.originalname)) {
      const zip = new AdmZip(header),
        entries = zip.getEntries();
      if (
        entries.length > 512 ||
        entries.reduce((sum, e) => sum + e.header.size, 0) > 16 * 1024 * 1024
      )
        throw new HttpError(413, 'The expanded CV is too large. Paste the text instead.');
      const main = zip.getEntry('word/document.xml');
      if (!main) throw new HttpError(415, 'This is not a valid Word document.');
      const xml = main.getData().toString('utf8');
      // Read text only; do not resolve XML external entities or render uploaded markup.
      const decode = (s) =>
        s
          .replace(
            /&(?:amp|lt|gt|quot|apos);/g,
            (x) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" })[x],
          )
          .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, n) => {
            const cp = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n);
            return cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
          });
      text = [...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)]
        .map((p) =>
          [...p[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>/g)]
            .map((m) => (m[1] !== undefined ? decode(m[1]) : m[0].includes('w:tab') ? '\t' : '\n'))
            .join(''),
        )
        .join('\n');
    } else if (/\.txt$/i.test(file.originalname)) text = header.toString('utf8');
    else throw new HttpError(415, 'Upload a PDF, DOCX or plain text CV.');
    if (text.trim().length < 20)
      throw new HttpError(
        422,
        'No readable text was found. For a scanned CV, paste your details instead.',
      );
    if (text.length > 12000)
      throw new HttpError(413, 'Your CV is too long. Keep it below 12,000 characters.');
    return text;
  } finally {
    await fs.unlink(file.path).catch(() => {});
  }
}
export async function storeResource(file, category) {
  if (!file) throw new HttpError(400, 'Select the file to upload.');
  await scanFile(file);
  const name = path
    .basename(file.originalname)
    .replace(/[^\w. -]/g, '')
    .slice(0, 120);
  const extension = path.extname(name).toLowerCase();
  const allowed =
    category === 'documents'
      ? ['.pdf', '.docx', '.xlsx', '.txt', '.zip']
      : ['.zip', '.exe', '.msi', '.dmg', '.deb', '.apk', '.pdf'];
  if (!allowed.includes(extension))
    throw new HttpError(415, 'This file type is not supported for the selected category.');
  const dest = path.join(config.storage, 'resources', id() + extension);
  await fs.rename(file.path, dest);
  return { path: dest, name };
}
