import { requireValue } from './domain.mjs';

export const resumeSections = [
  { key: 'summary', title: 'Professional summary', limit: 4000 },
  { key: 'education', title: 'Education', limit: 2000 },
  { key: 'experience', title: 'Experience', limit: 4000 },
  { key: 'projects', title: 'Projects', limit: 2000 },
  { key: 'skills', title: 'Skills', limit: 2000 },
  { key: 'certifications', title: 'Certifications and awards', limit: 1000 },
];

export const papers = {
  a4: { label: 'A4 (210 × 297 mm)', css: '210mm 297mm', width: 11906, height: 16838 },
  short: { label: 'Short / Letter (8.5 × 11 in)', css: '8.5in 11in', width: 12240, height: 15840 },
};

export function resumeInput(details, clean = (s) => s) {
  requireValue(details && typeof details === 'object', 'Enter your résumé details.');
  const input = {};
  for (const { key, limit } of [{ key: 'role', limit: 150 }, ...resumeSections]) {
    const value = details[key] ?? '';
    requireValue(
      typeof value === 'string' && value.length <= limit,
      'Check the length of your ' + key + ' field.',
    );
    const text = clean(value.trim());
    if (text) input[key] = text;
  }
  requireValue(
    resumeSections.some(({ key }) => input[key]),
    'Add some background, education, experience, projects, or skills first.',
  );
  return input;
}

export function readResumeDraft(text, input) {
  const content = JSON.parse(text);
  const sections = {};
  for (const { key } of resumeSections) {
    if (key !== 'summary' && !input[key]) continue;
    const value = content?.[key];
    if (typeof value !== 'string' || !value.trim() || value.length > 6000)
      throw new Error('Incomplete résumé section');
    sections[key] = value.trim();
  }
  return sections;
}

export function resumeParagraphs(header, sections) {
  const paragraphs = [];
  if (header.name.trim()) paragraphs.push({ style: 'name', text: header.name.trim() });
  if (header.role.trim()) paragraphs.push({ style: 'role', text: header.role.trim() });
  const contact = [header.email, header.phone, header.city, header.portfolio]
    .map((s) => s.trim())
    .filter(Boolean)
    .join('  ·  ');
  if (contact) paragraphs.push({ style: 'contact', text: contact });
  for (const { key, title } of resumeSections) {
    const lines = (sections[key] || '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!lines.length) continue;
    paragraphs.push({ style: 'heading', text: title });
    for (const text of lines) paragraphs.push({ style: 'body', text });
  }
  return paragraphs;
}
