// A small, dependency-light Excel (.xlsx) writer: one sheet, bold frozen header row,
// filter buttons, column widths and real date cells. An .xlsx file is a zip of XML files.
import { strToU8, zipSync } from 'fflate';

/** A cell: text, number, yes/no, a date (ISO yyyy-mm-dd) or empty. */
export type Cell = string | number | boolean | { date: string } | null | undefined;

// Characters XML 1.0 does not allow (control characters except tab/newline/carriage return).
const INVALID_XML = new RegExp('[' + String.fromCharCode(0) + '-' + String.fromCharCode(8) + String.fromCharCode(11, 12) + String.fromCharCode(14) + '-' + String.fromCharCode(31) + ']', 'g');

const esc = (s: string) =>
  s.replace(INVALID_XML, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 0 → A, 25 → Z, 26 → AA */
export function columnName(index: number): string {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

/** Excel stores dates as days since 30 December 1899. */
export function excelDate(iso: string): number | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return (Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

const STYLE_HEADER = 1;
const STYLE_DATE = 2;

function cellXml(ref: string, value: Cell, header: boolean): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'object') {
    const serial = excelDate(value.date);
    return serial === null ? '' : `<c r="${ref}" s="${STYLE_DATE}"><v>${serial}</v></c>`;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? `<c r="${ref}"><v>${value}</v></c>` : '';
  if (typeof value === 'boolean') return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
  const style = header ? ` s="${STYLE_HEADER}"` : '';
  return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
}

function textLength(value: Cell): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'object') return 10;
  return String(value).length;
}

export function buildXlsx(sheetName: string, header: string[], rows: Cell[][]): Uint8Array {
  const all: Cell[][] = [header, ...rows];
  const lastCol = columnName(Math.max(header.length - 1, 0));
  const lastRow = all.length;

  const widths = header.map((_, c) => {
    const longest = Math.max(...all.slice(0, 200).map((r) => textLength(r[c])));
    return Math.min(Math.max(longest + 2, 10), 50);
  });

  const sheetRows = all
    .map((row, r) => {
      const cells = row.map((v, c) => cellXml(`${columnName(c)}${r + 1}`, v, r === 0)).join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');

  const sheet =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<dimension ref="A1:${lastCol}${lastRow}"/>` +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` +
    `<sheetData>${sheetRows}</sheetData>` +
    `<autoFilter ref="A1:${lastCol}${lastRow}"/>` +
    '</worksheet>';

  const safeName = esc(sheetName.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Blad1');
  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets><sheet name="${safeName}" sheetId="1" r:id="rId1"/></sheets>` +
    `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${safeName.replace(/'/g, "''")}'!$A$1:$${lastCol}$${lastRow}</definedName></definedNames>` +
    '</workbook>';

  const styles =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE8F5EE"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="3">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    ),
    'xl/workbook.xml': strToU8(workbook),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>',
    ),
    'xl/styles.xml': strToU8(styles),
    'xl/worksheets/sheet1.xml': strToU8(sheet),
  };
  return zipSync(files, { level: 6 });
}
