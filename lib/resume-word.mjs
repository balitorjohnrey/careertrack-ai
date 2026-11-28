import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  HeightRule,
  ImageRun,
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
  portraitColors,
  portraitSections,
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

function portraitTable(header, sections, photo, width) {
  const { navy, side, ink } = portraitColors;
  const groups = portraitSections(header, sections);
  const sidebar = Boolean(photo || groups.contacts.length || groups.side.length);
  const sideWidth = Math.round(2.48 * 1440);
  const widths = sidebar ? [sideWidth, width - sideWidth] : [width];
  const bannerHeight = Math.round(1.65 * 1440);
  function textParagraph(text, options = {}) {
    const { heading, bannerSize, justify, bullet, before } = options;
    return new Paragraph({
      alignment: justify ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
      keepNext: Boolean(heading), widowControl: true,
      spacing: { before: before ?? (heading ? 240 : 0), after: heading ? 110 : 75, line: 270 },
      ...(heading && { border: { bottom: { color: navy, style: BorderStyle.SINGLE, size: 7, space: 3 } } }),
      ...(bullet && { indent: { left: 180, hanging: 180 } }),
      children: [new TextRun({
        ...font, text: bullet ? '•  ' + text.replace(/^[•*-]\s+/, '') : text,
        size: bannerSize || (heading ? 26 : 24),
        bold: heading || bannerSize === 52, allCaps: Boolean(heading || bannerSize),
        color: bannerSize ? 'FFFFFF' : heading ? navy : ink,
        ...(heading && { characterSpacing: 18 }),
      })],
    });
  }
  function cell(index, children, options = {}) {
    return new TableCell({
      width: { size: widths[index], type: WidthType.DXA },
      children: children.length ? children : [new Paragraph('')], ...options,
    });
  }
  const banner = [];
  // Separate entries let Word paginate the main column while the sidebar spans the rows.
  const entries = groups.main.flatMap(({ title, lines }) =>
    lines.map((line, i) => [
      ...(i === 0 ? [textParagraph(title, { heading: true })] : []),
      textParagraph(line, { justify: true }),
    ]),
  );
  if (!entries.length) entries.push([]);
  let rail;
  if (sidebar) {
    const image = photo && new ImageRun({
      type: 'jpg', data: Uint8Array.from(atob(photo), (c) => c.charCodeAt(0)),
      transformation: { width: 192, height: 192 }, // 192 CSS pixels = 2 physical inches.
      outline: { type: 'solidFill', solidFillType: 'rgb', value: 'FFFFFF', width: 38100 },
      altText: { title: 'Résumé photo', name: 'Résumé photo', description: 'Square résumé photo' },
      floating: {
        horizontalPosition: { relative: 'margin', offset: Math.round(0.24 * 914400) },
        verticalPosition: { relative: 'margin', offset: Math.round(0.58 * 914400) },
        layoutInCell: false, allowOverlap: true, lockAnchor: true,
      },
    });
    banner.push(cell(0, [new Paragraph({ children: image ? [image] : [] })], { shading: { fill: navy } }));
    const sideText = [];
    function sideHeading(title) {
      return textParagraph(title, {
        heading: true, before: sideText.length ? 240 : photo ? 1650 : 440,
      });
    }
    if (groups.contacts.length) {
      sideText.push(sideHeading('Contact'));
      for (const { text } of groups.contacts) sideText.push(textParagraph(text));
    }
    for (const { key, title, lines } of groups.side) {
      sideText.push(sideHeading(title));
      for (const text of lines) sideText.push(textParagraph(text, { bullet: key !== 'references' }));
    }
    rail = cell(0, sideText, {
      rowSpan: entries.length,
      shading: { fill: side }, margins: { top: 0, bottom: 0, left: 285, right: 285 },
    });
  }
  const mainIndex = widths.length - 1;
  const identity = [textParagraph(header.name, { bannerSize: 52 })];
  if (header.role) identity.push(textParagraph(header.role, { bannerSize: 28 }));
  banner.push(cell(mainIndex, identity, {
    shading: { fill: navy }, verticalAlign: VerticalAlign.CENTER,
    margins: { top: 160, bottom: 160, left: 460, right: 320 },
  }));
  const bodyRows = entries.map((paragraphs, i) => new TableRow({
    children: [
      ...(i === 0 && rail ? [rail] : []),
      cell(mainIndex, paragraphs, {
        margins: { top: i === 0 ? 200 : 0, bottom: 0, left: 460, right: 280 },
      }),
    ],
  }));
  return new Table({
    width: { size: width, type: WidthType.DXA }, layout: TableLayoutType.FIXED,
    columnWidths: widths, borders: TableBorders.NONE,
    rows: [
      new TableRow({ children: banner, height: { value: bannerHeight, rule: HeightRule.ATLEAST }, cantSplit: true }),
      ...bodyRows,
    ],
  });
}

export async function resumeWordBlob(header, sections, paper, design = 'classic', photo = null) {
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
  const pageMargin = design === 'portrait' ? 432 : margin;
  const children = design === 'portrait' ? [
    portraitTable(header, sections, photo, width - 2 * pageMargin),
  ] : [
    ...(editorial ? [editorialMasthead(header, width - 2 * margin, identity)] : identity),
    ...resumeBodyParagraphs(sections, header).map(paragraph),
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
            margin: { top: pageMargin, right: pageMargin, bottom: pageMargin, left: pageMargin },
          },
        },
        children,
      },
    ],
  });
  return Packer.toBlob(document);
}
