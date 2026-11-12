/** Minimal .docx writer: a stored (uncompressed) zip with WordprocessingML parts. */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = (CRC_TABLE[(crc ^ bytes[i]!) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const encoder = new TextEncoder();

function u16(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
}

function u32(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** ZIP with stored entries — enough for Word to open the package. */
export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const header = concat([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(file.data.length),
      u32(file.data.length),
      u16(name.length),
      u16(0),
      name,
    ]);
    locals.push(header, file.data);
    central.push(
      concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(file.data.length),
        u32(file.data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ]),
    );
    offset += header.length + file.data.length;
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  return concat([
    ...locals,
    ...central,
    concat([
      u32(0x06054b50),
      u16(0),
      u16(0),
      u16(files.length),
      u16(files.length),
      u32(centralSize),
      u32(offset),
      u16(0),
    ]),
  ]);
}

export type DocBlock =
  | { kind: "title"; text: string }
  | { kind: "subtitle"; text: string }
  | { kind: "heading"; text: string }
  | {
      kind: "paragraph";
      text: string;
      bold?: boolean;
      align?: "both" | "center" | "left" | "right";
      size?: number;
      spaceAfter?: number;
    }
  | { kind: "label"; text: string }
  | {
      kind: "table";
      rows: string[][];
      headerRow?: boolean;
      boldFirstColumn?: boolean;
      shadedHeader?: boolean;
      columnSizes?: number[];
      borderColor?: string;
      headerShade?: string;
      padY?: number;
      padX?: number;
    }
  | { kind: "runs"; runs: { text: string; bold?: boolean; size?: number }[]; spaceBefore?: number }
  | { kind: "richTable"; rows: string[][][]; borderColor?: string; widths?: number[]; borderless?: boolean }
  | { kind: "raw"; xml: string }
  | { kind: "columns"; cells: DocBlock[][] };

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const FONT = `<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>`;

export function run(
  text: string,
  opts: { bold?: boolean; size?: number; color?: string; spacing?: number; caps?: boolean } = {},
): string {
  const rPr = `<w:rPr>${FONT}${opts.bold ? "<w:b/>" : ""}${opts.caps ? "<w:caps/>" : ""}${
    opts.spacing ? `<w:spacing w:val="${opts.spacing}"/>` : ""
  }${opts.color ? `<w:color w:val="${opts.color}"/>` : ""}${
    opts.size ? `<w:sz w:val="${opts.size}"/><w:szCs w:val="${opts.size}"/>` : ""
  }</w:rPr>`;
  return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

export function paragraph(
  text: string,
  opts: {
    bold?: boolean;
    size?: number;
    spaceBefore?: number;
    spaceAfter?: number;
    align?: "both" | "center" | "left" | "right";
    color?: string;
    spacing?: number;
    caps?: boolean;
    ruleAbove?: boolean;
    keepNext?: boolean;
  } = {},
): string {
  const pPr = `<w:pPr>${
    opts.keepNext ? "<w:keepNext/>" : ""
  }${opts.ruleAbove ? '<w:pBdr><w:top w:val="single" w:sz="6" w:space="6" w:color="10161C"/></w:pBdr>' : ""}${
    opts.align ? `<w:jc w:val="${opts.align}"/>` : ""
  }${
    opts.spaceBefore || opts.spaceAfter
      ? `<w:spacing${opts.spaceBefore ? ` w:before="${opts.spaceBefore}"` : ""}${opts.spaceAfter ? ` w:after="${opts.spaceAfter}"` : ""}/>`
      : ""
  }</w:pPr>`;
  return `<w:p>${pPr}${run(text, opts)}</w:p>`;
}

const borders = (color: string) => `<w:tblBorders>
    <w:top w:val="single" w:sz="6" w:color="${color}"/><w:left w:val="single" w:sz="6" w:color="${color}"/>
    <w:bottom w:val="single" w:sz="6" w:color="${color}"/><w:right w:val="single" w:sz="6" w:color="${color}"/>
    <w:insideH w:val="single" w:sz="6" w:color="${color}"/><w:insideV w:val="single" w:sz="6" w:color="${color}"/>
  </w:tblBorders>`;


function cell(inner: string, shade?: string, width?: number): string {
  const tcPr = `<w:tcPr>${width ? `<w:tcW w:w="${width}" w:type="dxa"/>` : `<w:tcW w:w="0" w:type="auto"/>`}${shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : ""}</w:tcPr>`;
  return `<w:tc>${tcPr}${inner}</w:tc>`;
}

function table(
  rows: string[][],
  opts: {
    headerRow?: boolean;
    boldFirstColumn?: boolean;
    shadedHeader?: boolean;
    columnSizes?: number[];
    borderColor?: string;
    headerShade?: string;
    padY?: number;
    padX?: number;
  } = {},
): string {
  const body = rows
    .map((cells, rowIndex) => {
      const isHeader = opts.headerRow && rowIndex === 0;
      return `<w:tr>${cells
        .map((value, columnIndex) => {
          const bold = isHeader || (opts.boldFirstColumn && columnIndex === 0);
          const shade = isHeader && opts.shadedHeader ? (opts.headerShade ?? "D9E2F3") : undefined;
          const size = opts.columnSizes?.[columnIndex] ?? 21;
          return cell(paragraph(value, { bold, size }), shade);
        })
        .join("")}</w:tr>`;
    })
    .join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${borders(opts.borderColor ?? "D9E2F3")}<w:tblCellMar><w:top w:w="${opts.padY ?? 40}" w:type="dxa"/><w:left w:w="${opts.padX ?? 70}" w:type="dxa"/><w:bottom w:w="${opts.padY ?? 40}" w:type="dxa"/><w:right w:w="${opts.padX ?? 70}" w:type="dxa"/></w:tblCellMar></w:tblPr>${body}</w:tbl>`;
}

/** A table whose cells hold several paragraphs each (party boxes). */
export function richTable(
  rows: string[][][],
  opts: { borderColor?: string; padY?: number; padX?: number; widths?: number[]; borderless?: boolean } = {},
): string {
  const body = rows
    .map(
      (cells) =>
        `<w:tr>${cells
          .map((paragraphs, columnIndex) => {
            const width = opts.widths?.[columnIndex];
            const tcPr = `<w:tcPr>${width ? `<w:tcW w:w="${width}" w:type="pct"/>` : `<w:tcW w:w="0" w:type="auto"/>`}</w:tcPr>`;
            return `<w:tc>${tcPr}${paragraphs.join("")}</w:tc>`;
          })
          .join("")}</w:tr>`,
    )
    .join("");
  const frame = opts.borderless
    ? `<w:tblBorders><w:top w:val="none" w:sz="0"/><w:left w:val="none" w:sz="0"/><w:bottom w:val="none" w:sz="0"/><w:right w:val="none" w:sz="0"/><w:insideH w:val="none" w:sz="0"/><w:insideV w:val="none" w:sz="0"/></w:tblBorders>`
    : borders(opts.borderColor ?? "C9D4DE");
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${frame}<w:tblCellMar><w:top w:w="${opts.padY ?? 60}" w:type="dxa"/><w:left w:w="${opts.padX ?? 90}" w:type="dxa"/><w:bottom w:w="${opts.padY ?? 60}" w:type="dxa"/><w:right w:w="${opts.padX ?? 90}" w:type="dxa"/></w:tblCellMar></w:tblPr>${body}</w:tbl>`;
}

/** Side-by-side blocks (nested tables inside a borderless layout table). */
function columns(cells: DocBlock[][]): string {
  const inner = cells
    .map((blocks) => {
      const content = blocks.map(renderBlock).join("");
      // a table must be followed by a paragraph inside a cell
      const tail = blocks.length && blocks[blocks.length - 1]?.kind === "table" ? "<w:p/>" : "";
      return cell(`${content}${tail}`);
    })
    .join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>
    <w:top w:val="none" w:sz="0"/><w:left w:val="none" w:sz="0"/><w:bottom w:val="none" w:sz="0"/><w:right w:val="none" w:sz="0"/>
    <w:insideH w:val="none" w:sz="0"/><w:insideV w:val="none" w:sz="0"/>
  </w:tblBorders></w:tblPr><w:tr>${inner}</w:tr></w:tbl><w:p/>`;
}

function renderBlock(block: DocBlock): string {
  switch (block.kind) {
    case "title":
      return paragraph(block.text, { bold: true, size: 32, align: "center" });
    case "subtitle":
      return paragraph(block.text, { size: 24, align: "center" });
    case "heading":
      return paragraph(block.text.toUpperCase(), { bold: true, size: 27, spaceBefore: 200 });
    case "label":
      return paragraph(block.text.toUpperCase(), { bold: true, size: 27 });
    case "paragraph":
      return paragraph(block.text, {
        size: block.size ?? 21,
        bold: block.bold,
        align: block.align ?? "both",
        spaceAfter: block.spaceAfter,
      });
    case "table":
      return table(block.rows, block);
    case "runs":
      return `<w:p><w:pPr>${block.spaceBefore ? `<w:spacing w:before="${block.spaceBefore}"/>` : ""}</w:pPr>${block.runs
        .map((item) => run(item.text, { bold: item.bold, size: item.size ?? 21 }))
        .join("")}</w:p>`;
    case "raw":
      return block.xml;
    case "richTable":
      return richTable(block.rows, { borderColor: block.borderColor, widths: block.widths, borderless: block.borderless });
    case "columns":
      return columns(block.cells);
  }
}

/** Builds a .docx file from simple blocks. */
export function buildDocx(blocks: DocBlock[]): Uint8Array {
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
${blocks.map(renderBlock).join("\n")}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>
</w:body></w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  return zipStore([
    { name: "[Content_Types].xml", data: encoder.encode(contentTypes) },
    { name: "_rels/.rels", data: encoder.encode(rels) },
    { name: "word/document.xml", data: encoder.encode(document) },
  ]);
}
