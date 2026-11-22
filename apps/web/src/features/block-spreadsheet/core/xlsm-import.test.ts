import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { initSync } from '@ironcalc/wasm';
import { createInitializedSpreadsheetCalculator } from '@rox-one/spreadsheet/calculation';
import {
  importSpreadsheetSheets,
  readSpreadsheetWorkbook,
} from '@rox-one/spreadsheet/workbook-document';
import ExcelJS from 'exceljs';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { LoroDoc } from 'loro-crdt';
import { beforeAll, describe, expect, it } from 'vitest';
import type { WorkbookFileSheet } from './workbook-file-types';
import { inspectXlsxArchive } from './xlsx-archive';
import { decodeXlsx, encodeXlsx } from './xlsx-codec';

const VBA_WARNING =
  'VBA roxs are not imported. Cells, formulas and formatting are; the roxs do not run in Rox.';
const ROX_SHEET_WARNING = 'Excel 4.0 rox sheets are not imported.';
const CONTROLS_WARNING = 'Form and ActiveX controls are not imported.';

const fixture = (name: string) =>
  new Uint8Array(
    readFileSync(
      createRequire(import.meta.url).resolve(`./xlsx-fixtures/${name}`)
    )
  );

beforeAll(() =>
  initSync({
    module: readFileSync(
      createRequire(import.meta.url).resolve('@ironcalc/wasm/wasm_bg.wasm')
    ),
  })
);

function budgetSheet(): WorkbookFileSheet {
  return {
    name: 'Budget',
    cells: {
      A1: { value: 'Item', bold: true },
      B1: { value: 'Amount', bold: true },
      A2: { value: 'Rent' },
      B2: { value: '1200' },
      A3: { value: 'Payroll' },
      B3: { value: '4800' },
      A4: { value: 'Total' },
      B4: { value: '=SUM(B2:B3)' },
    },
    rowCount: 100,
    columnWidths: {},
  };
}

/**
 * A Rox-written workbook turned into the package Excel saves as .xlsm: the
 * rox-enabled main content type, a VBA project and its signature, plus any
 * `extra` parts.
 */
async function roxEnabled(extra: Record<string, Uint8Array> = {}) {
  const { bytes } = await encodeXlsx({ sheets: [budgetSheet()] });
  const entries = unzipSync(bytes);
  entries['[Content_Types].xml'] = strToU8(
    strFromU8(entries['[Content_Types].xml'])
      .replace(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
        'application/vnd.ms-excel.sheet.roxEnabled.main+xml'
      )
      .replace(
        '</Types>',
        '<Default Extension="bin" ContentType="application/vnd.ms-office.vbaProject"/></Types>'
      )
  );
  entries['xl/_rels/workbook.xml.rels'] = strToU8(
    strFromU8(entries['xl/_rels/workbook.xml.rels']).replace(
      '</Relationships>',
      '<Relationship Id="rIdVba" Type="http://schemas.microsoft.com/office/2006/relationships/vbaProject" Target="vbaProject.bin"/></Relationships>'
    )
  );
  // An OLE compound file header; the importer never reads the VBA project.
  entries['xl/vbaProject.bin'] = new Uint8Array([
    0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
  ]);
  entries['xl/vbaProjectSignature.bin'] = new Uint8Array([1, 2, 3]);
  Object.assign(entries, extra);
  return zipSync(entries);
}

async function exportedParts(sheets: WorkbookFileSheet[]) {
  const { bytes } = await encodeXlsx({ sheets });
  return { bytes, names: Object.keys(unzipSync(bytes)) };
}

describe('rox-enabled workbook import', () => {
  it('imports a rox-enabled workbook with its formulas and a note about the roxs', async () => {
    const imported = await decodeXlsx(await roxEnabled());

    expect(imported.sheets.map((sheet) => sheet.name)).toEqual(['Budget']);
    expect(imported.sheets[0].cells.A4.value).toBe('Total');
    expect(imported.sheets[0].cells.B4.value).toBe('=SUM(B2:B3)');
    expect(imported.sheets[0].cells.A1.bold).toBe(true);
    expect(imported.warnings).toContain(VBA_WARNING);
    expect(imported.warnings).not.toContain(ROX_SHEET_WARNING);
    expect(imported.warnings).not.toContain(CONTROLS_WARNING);
  });

  it('notes Excel 4.0 rox sheets and form controls separately', async () => {
    const imported = await decodeXlsx(
      await roxEnabled({
        'xl/roxsheets/sheet2.xml': strToU8(
          '<xm:roxsheet xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main"/>'
        ),
        'xl/activeX/activeX1.xml': strToU8('<ax:ocx xmlns:ax="urn:ax"/>'),
        'xl/ctrlProps/ctrlProp1.xml': strToU8('<formControlPr/>'),
      })
    );

    expect(imported.warnings).toEqual(
      expect.arrayContaining([
        VBA_WARNING,
        ROX_SHEET_WARNING,
        CONTROLS_WARNING,
      ])
    );
    expect(imported.sheets[0].cells.B4.value).toBe('=SUM(B2:B3)');
  });

  it('calculates an imported rox-enabled workbook after native save and reopen', async () => {
    const imported = await decodeXlsx(await roxEnabled());
    const doc = new LoroDoc();
    const reopened = new LoroDoc();
    const engine = createInitializedSpreadsheetCalculator();
    try {
      importSpreadsheetSheets(doc, imported.sheets, true);
      reopened.import(doc.export({ mode: 'snapshot' }));
      const sheets = readSpreadsheetWorkbook(reopened);
      const results = engine.calculateWorkbook(
        sheets.map((sheet) => ({ ...sheet, rowCount: sheet.layout.rowCount })),
        { includeTypes: true }
      );
      expect(results[sheets[0].id].B4.number).toBe(6_000);
    } finally {
      engine.dispose();
    }
  });

  it('exports an imported rox-enabled workbook as a rox-free .xlsx', async () => {
    const imported = await decodeXlsx(await roxEnabled());

    const { bytes, names } = await exportedParts(imported.sheets);

    expect(names.some((name) => /vba|roxsheets|activeX/i.test(name))).toBe(
      false
    );
    const contentTypes = strFromU8(unzipSync(bytes)['[Content_Types].xml']);
    expect(contentTypes).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'
    );
    expect(contentTypes).not.toContain('roxEnabled');
    const external = new ExcelJS.Workbook();
    await external.xlsx.load(bytes.slice().buffer);
    expect(external.getWorksheet('Budget')!.getCell('B4').formula).toBe(
      'SUM(B2:B3)'
    );
  });

  it("still refuses roxs in Rox's own export check", async () => {
    expect(() => inspectXlsxArchive(fixture('poi-simple-rox.xlsm'))).toThrow(
      'must not contain roxs'
    );
    expect(() =>
      inspectXlsxArchive(
        zipSync({
          ...unzipSync(fixture('poi-simple-rox.xlsm')),
          'xl/vbaProject.bin': new Uint8Array(),
        })
      )
    ).toThrow('must not contain roxs');
  });
});

describe('Excel-written .xlsm files', () => {
  it('imports a simple rox workbook', async () => {
    const imported = await decodeXlsx(fixture('poi-simple-rox.xlsm'));

    expect(imported.sheets.map((sheet) => sheet.name)).toEqual([
      'Sheet1',
      'Sheet2',
      'Sheet3',
    ]);
    expect(imported.sheets[0].cells.A1.value).toBe('This is a rox workbook');
    expect(imported.warnings).toContain(VBA_WARNING);

    const { names } = await exportedParts(imported.sheets);
    expect(names).not.toContain('xl/vbaProject.bin');
  });

  it('imports a rox workbook with comments, embedded objects and Cyrillic sheet names', async () => {
    const imported = await decodeXlsx(
      fixture('poi-excel-with-attachments.xlsm')
    );

    expect(imported.sheets.map((sheet) => sheet.name)).toEqual([
      'Страница 1',
      'Page 1',
      'Бетўўў 1',
    ]);
    const text = imported.sheets.flatMap((sheet) =>
      Object.values(sheet.cells).map((cell) => cell.value)
    );
    expect(text).toEqual(
      expect.arrayContaining(['Русский вариант', 'English', 'Ўзбек'])
    );
    expect(imported.warnings).toContain(VBA_WARNING);

    const { bytes, names } = await exportedParts(imported.sheets);
    expect(names.some((name) => /vbaProject/i.test(name))).toBe(false);
    expect(() => inspectXlsxArchive(bytes)).not.toThrow();
  });
});
