import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableBorders,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import {
  editorialColors,
  papers,
  resumeBodyParagraphs,
  resumeHeaderParagraphs,
  resumeInitials,
} from './resume.mjs';

const font = { font: 'Arial', size: 24, color: '000000' }; // Word uses half-points.
const margin = 1080; // 0.75 inch in twips

function editorialMasthead(header, contentWidth, paragraphs) {
  const badgeWidth = 1037; // 0.72 inch
  const widths = [badgeWidth, contentWidth - badgeWidth];
  const badge = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0 },
    children: [
      new TextRun({
        ...font,
        text: resumeInitials(header.name),
        bold: true,
        color: 'FFFFFF',
        characterSpacing: 20,
      }),
    ],
  });
  return new Table({
    width: { size: contentWidth, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: TableBorders.NONE,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [[badge], paragraphs].map(
          (children, i) =>
            new TableCell({
              width: { size: widths[i], type: WidthType.DXA },
              shading: { fill: i === 0 ? editorialColors.forest : editorialColors.sage },
              margins: {
                top: 220,
                bottom: 180,
                left: i === 0 ? 30 : 260,
                right: i === 0 ? 30 : 260,
              },
              verticalAlign: VerticalAlign.CENTER,
              children,
            }),
        ),
      }),
    ],
  });
}

export async function resumeWordBlob(header, sections, paper, design = 'classic') {
  const { width, height } = papers[paper];
  const editorial = design === 'editorial';
  function paragraph({ style, text }) {
    const heading = style === 'heading';
    const name = style === 'name';
    const accentHeading = editorial && heading;
    const color = editorial
      ? heading || style === 'role'
        ? editorialColors.forest
        : editorialColors.ink
      : font.color;
    return new Paragraph({
      ...(name
        ? { heading: HeadingLevel.TITLE }
        : heading
          ? { heading: HeadingLevel.HEADING_1 }
          : {}),
      alignment: AlignmentType.JUSTIFIED,
      keepNext: name || heading,
      widowControl: true,
      spacing: {
        before: accentHeading ? 260 : heading ? 180 : 0,
        after: accentHeading ? 100 : 60,
        line: 276,
      },
      ...(accentHeading && {
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 8, space: 3, color: editorialColors.rule },
        },
      }),
      children: [
        new TextRun({
          ...font,
          color,
          bold: name || heading,
          ...(accentHeading && { characterSpacing: 9 }),
          text,
        }),
      ],
    });
  }
  const identity = resumeHeaderParagraphs(header).map(paragraph);
  const children = [
    ...(editorial ? [editorialMasthead(header, width - 2 * margin, identity)] : identity),
    ...resumeBodyParagraphs(sections).map(paragraph),
  ];
  const document = new Document({
    creator: header.name,
    title: header.name + ' – Résumé',
    styles: { default: { document: { run: font } } },
    sections: [
      {
        properties: {
          page: {
            size: { width, height },
            margin: { top: margin, right: margin, bottom: margin, left: margin },
          },
        },
        children,
      },
    ],
  });
  return Packer.toBlob(document);
}
