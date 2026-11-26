import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { papers, resumeParagraphs } from './resume.mjs';

export async function resumeWordBlob(header, sections, paper) {
  const { width, height } = papers[paper];
  const font = { font: 'Arial', size: 24, color: '000000' }; // Word uses half-points.
  const children = resumeParagraphs(header, sections).map(({ style, text }) => {
    const heading = style === 'heading';
    const name = style === 'name';
    return new Paragraph({
      ...(name
        ? { heading: HeadingLevel.TITLE }
        : heading
          ? { heading: HeadingLevel.HEADING_1 }
          : {}),
      alignment: AlignmentType.JUSTIFIED,
      keepNext: name || heading,
      widowControl: true,
      spacing: { before: heading ? 180 : 0, after: 60, line: 276 },
      children: [new TextRun({ ...font, bold: name || heading, text })],
    });
  });
  const document = new Document({
    creator: header.name,
    title: header.name + ' – Résumé',
    styles: { default: { document: { run: font } } },
    sections: [
      {
        properties: {
          page: {
            size: { width, height },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        children,
      },
    ],
  });
  return Packer.toBlob(document);
}
