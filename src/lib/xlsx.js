// Lecture et écriture de fichiers Excel (.xlsx) sans dépendance externe.
// - readXlsx    : lit une liste d'appels ou un tableau de réponses déjà commencé
// - buildXlsx   : fabrique un classeur neuf au format du fichier Antwoordtabel
// - fillTemplate: recopie les appels dans LE fichier Excel officiel, en gardant
//                 ses titres, ses listes déroulantes et sa mise en forme
import { readZip, entryText, writeZip } from "./zip.js";

/* ------------------------------------------------------------------ XML */

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function unescapeXml(s) {
  return String(s).replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (m, code) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code] ?? m;
  });
}

export function escapeXml(s) {
  return String(s ?? "")
    // caractères de contrôle interdits dans un fichier XML
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? m[1] : null;
}

function textOf(xml) {
  let out = "";
  const re = /<t\b[^>]*\/>|<t\b[^>]*>([\s\S]*?)<\/t>/g;
  let m;
  while ((m = re.exec(xml))) out += unescapeXml(m[1] ?? "");
  return out;
}

export function colToIndex(ref) {
  const letters = String(ref).match(/^[A-Z]+/i);
  if (!letters) return 0;
  let n = 0;
  for (const ch of letters[0].toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function indexToCol(index) {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rest = (n - 1) % 26;
    out = String.fromCharCode(65 + rest) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/* ---------------------------------------------------------------- dates */

const DAY_MS = 86_400_000;

/** Numéro de série Excel -> "aaaa-mm-jj". */
export function serialToIso(serial, date1904 = false) {
  const n = Number(serial);
  if (!Number.isFinite(n) || n <= 0) return "";
  const base = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  const d = new Date(base + Math.round(n) * DAY_MS);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** "aaaa-mm-jj" -> numéro de série Excel. */
export function isoToSerial(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return null;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return Math.round((ms - Date.UTC(1899, 11, 30)) / DAY_MS);
}

const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

function dateStyleFlags(stylesXml) {
  const custom = new Map();
  const numFmtRe = /<numFmt\b[^>]*\/>/g;
  let m;
  while ((m = numFmtRe.exec(stylesXml || ""))) {
    const id = Number(attr(m[0], "numFmtId"));
    const code = unescapeXml(attr(m[0], "formatCode") || "");
    const stripped = code.replace(/\[[^\]]*\]/g, "").replace(/"[^"]*"/g, "");
    custom.set(id, /[dmy]/i.test(stripped));
  }
  const block = (stylesXml || "").match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/);
  const flags = [];
  if (!block) return flags;
  const xfRe = /<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g;
  while ((m = xfRe.exec(block[1]))) {
    const id = Number(attr(m[0], "numFmtId") || 0);
    flags.push(BUILTIN_DATE_FORMATS.has(id) || custom.get(id) === true);
  }
  return flags;
}

/* ----------------------------------------------------------- lecture */

function parseSharedStrings(xml) {
  const out = [];
  const re = /<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g;
  let m;
  while ((m = re.exec(xml))) out.push(m[1] ? textOf(m[1]) : "");
  return out;
}

function parseSheet(xml, shared, dateFlags, date1904) {
  const rows = [];
  const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
  let rm;
  while ((rm = rowRe.exec(xml))) {
    const rowIndex = Number(attr(rm[1], "r") || rows.length + 1) - 1;
    const cells = [];
    const body = rm[2] || "";
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm;
    let auto = 0;
    while ((cm = cellRe.exec(body))) {
      const ref = attr(cm[1], "r");
      const col = ref ? colToIndex(ref) : auto;
      auto = col + 1;
      const type = attr(cm[1], "t") || "n";
      const style = Number(attr(cm[1], "s") ?? -1);
      const inner = cm[2] || "";
      let value = "";
      if (type === "s") {
        const vm = inner.match(/<v[^>]*>([\s\S]*?)<\/v>/);
        value = vm ? shared[Number(unescapeXml(vm[1]))] ?? "" : "";
      } else if (type === "inlineStr") {
        value = textOf(inner);
      } else if (type === "str" || type === "e") {
        const vm = inner.match(/<v[^>]*>([\s\S]*?)<\/v>/);
        value = vm ? unescapeXml(vm[1]) : "";
      } else {
        const vm = inner.match(/<v[^>]*>([\s\S]*?)<\/v>/);
        const raw = vm ? unescapeXml(vm[1]) : "";
        if (raw !== "" && style >= 0 && dateFlags[style]) value = serialToIso(raw, date1904);
        else value = raw;
      }
      cells[col] = String(value).trim();
    }
    rows[rowIndex] = cells;
  }
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return rows;
}

/** Lit un .xlsx et renvoie { sheets: [{ name, rows: string[][] }] }. */
export async function readXlsx(arrayBuffer) {
  const zip = readZip(arrayBuffer);
  const workbook = await entryText(zip.get("xl/workbook.xml"));
  const date1904 = /date1904="(1|true)"/.test(workbook);
  const relsXml = await entryText(zip.get("xl/_rels/workbook.xml.rels"));

  const rels = new Map();
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*\/>/g)) {
    const id = attr(m[0], "Id");
    let target = unescapeXml(attr(m[0], "Target") || "");
    if (target.startsWith("/")) target = target.slice(1);
    else if (!target.startsWith("xl/")) target = "xl/" + target.replace(/^\.\//, "");
    if (id) rels.set(id, target);
  }

  const sharedEntry = zip.get("xl/sharedStrings.xml");
  const shared = sharedEntry ? parseSharedStrings(await entryText(sharedEntry)) : [];
  const stylesEntry = zip.get("xl/styles.xml");
  const dateFlags = stylesEntry ? dateStyleFlags(await entryText(stylesEntry)) : [];

  const sheets = [];
  for (const m of workbook.matchAll(/<sheet\b[^>]*\/>/g)) {
    const name = unescapeXml(attr(m[0], "name") || `Feuille ${sheets.length + 1}`);
    const rid = attr(m[0], "r:id") || attr(m[0], "id");
    const path = rels.get(rid) || `xl/worksheets/sheet${sheets.length + 1}.xml`;
    const entry = zip.get(path);
    if (!entry) continue;
    sheets.push({ name, rows: parseSheet(await entryText(entry), shared, dateFlags, date1904) });
  }
  if (!sheets.length) throw new Error("Ce fichier Excel ne contient aucune feuille lisible.");
  return { sheets };
}

/* ----------------------------------------------------------- écriture */

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

// styles : 0 texte · 1 en-tête · 2 date · 3 texte surligné · 4 date surlignée
//          5 texte estompé · 6 date estompée
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="FF94A3B8"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF115E59"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="14" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="14" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

/**
 * Fabrique une cellule XML.
 * value : texte, ou { t:'d', v } pour une date ISO, ou { t:'n', v } pour un nombre
 */
function cellXml(ref, value, style) {
  if (value == null || value === "") return "";
  const s = style ? ` s="${style}"` : "";
  if (typeof value === "object") {
    if (value.v == null || value.v === "") return "";
    if (value.t === "d") {
      const serial = isoToSerial(value.v);
      if (serial != null) return `<c r="${ref}"${s}><v>${serial}</v></c>`;
      return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value.v)}</t></is></c>`;
    }
    if (value.t === "n" && Number.isFinite(Number(value.v))) {
      return `<c r="${ref}"${s}><v>${Number(value.v)}</v></c>`;
    }
    value = value.v;
  }
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function rowXml(rowNumber, cells, styleFor) {
  const parts = cells
    .map((value, i) => cellXml(`${indexToCol(i)}${rowNumber}`, value, styleFor(value, i)))
    .filter(Boolean);
  if (!parts.length) return `<row r="${rowNumber}"/>`;
  return `<row r="${rowNumber}">${parts.join("")}</row>`;
}

/**
 * Classeur neuf.
 * headers : string[] · rows : (string|{t,v})[][]
 * highlight : index de lignes à mettre en avant · estompe : lignes déjà traitées
 */
export async function buildXlsx({
  sheetName = "Feuille1",
  headers,
  rows,
  highlight = new Set(),
  estompe = new Set(),
  widths,
}) {
  const cols = widths
    ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`
    : "";
  const body = [
    rowXml(1, headers, () => 1),
    ...rows.map((cells, i) =>
      rowXml(i + 2, cells, (value) => {
        const isDate = typeof value === "object" && value?.t === "d";
        if (highlight.has(i)) return isDate ? 4 : 3;
        if (estompe.has(i)) return isDate ? 6 : 5;
        return isDate ? 2 : 0;
      })
    ),
  ].join("");
  const lastCol = indexToCol(Math.max(headers.length, 1) - 1);
  const lastRow = rows.length + 1;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastCol}${lastRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${body}</sheetData><autoFilter ref="A1:${lastCol}${lastRow}"/></worksheet>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

  return writeZip([
    { name: "[Content_Types].xml", text: CONTENT_TYPES },
    { name: "_rels/.rels", text: ROOT_RELS },
    { name: "xl/workbook.xml", text: workbook },
    { name: "xl/_rels/workbook.xml.rels", text: WORKBOOK_RELS },
    { name: "xl/styles.xml", text: STYLES },
    { name: "xl/worksheets/sheet1.xml", text: sheet },
  ]);
}

/* -------------------------------------------- remplissage du modèle */

async function firstSheetPath(zip) {
  const workbook = await entryText(zip.get("xl/workbook.xml"));
  const first = workbook.match(/<sheet\b[^>]*\/>/);
  const rid = first ? attr(first[0], "r:id") || attr(first[0], "id") : null;
  const relsEntry = zip.get("xl/_rels/workbook.xml.rels");
  if (rid && relsEntry) {
    const relsXml = await entryText(relsEntry);
    for (const m of relsXml.matchAll(/<Relationship\b[^>]*\/>/g)) {
      if (attr(m[0], "Id") !== rid) continue;
      let target = unescapeXml(attr(m[0], "Target") || "");
      if (target.startsWith("/")) target = target.slice(1);
      else if (!target.startsWith("xl/")) target = "xl/" + target.replace(/^\.\//, "");
      return target;
    }
  }
  return "xl/worksheets/sheet1.xml";
}

/** Ajoute (ou retrouve) un style « date » dans le styles.xml du modèle. */
function appendDateStyle(stylesXml) {
  const m = stylesXml.match(/<cellXfs\b([^>]*)>([\s\S]*?)<\/cellXfs>/);
  if (!m) return null;
  const flags = dateStyleFlags(stylesXml);
  const existing = flags.findIndex(Boolean);
  if (existing >= 0) return { xml: stylesXml, index: existing };
  const count = (m[2].match(/<xf\b/g) || []).length;
  const updated =
    stylesXml.slice(0, m.index) +
    `<cellXfs count="${count + 1}">${m[2]}<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>` +
    stylesXml.slice(m.index + m[0].length);
  return { xml: updated, index: count };
}

function lastUsedRow(sheetXml) {
  let last = 0;
  const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
  let m;
  while ((m = rowRe.exec(sheetXml))) {
    const n = Number(attr(m[1], "r") || 0);
    const body = m[2] || "";
    const hasValue = /<v[^>]*>[\s\S]*?<\/v>|<is>[\s\S]*?<\/is>/.test(body);
    if (hasValue && n > last) last = n;
  }
  return last;
}

/** Première ligne libre du modèle (au moins 2 : la ligne 1 porte les titres). */
export async function templateFirstFreeRow(arrayBuffer) {
  const zip = readZip(arrayBuffer);
  const path = await firstSheetPath(zip);
  const sheetXml = await entryText(zip.get(path));
  return Math.max(2, lastUsedRow(sheetXml) + 1);
}

/**
 * Recopie des lignes dans un fichier Excel existant en conservant tout le reste
 * (titres, listes déroulantes, mise en forme).
 */
export async function fillTemplate(arrayBuffer, rows, { startRow = 2 } = {}) {
  const zip = readZip(arrayBuffer);
  const sheetPath = await firstSheetPath(zip);
  const sheetEntry = zip.get(sheetPath);
  if (!sheetEntry) throw new Error("Feuille introuvable dans ce fichier Excel.");
  let sheetXml = await entryText(sheetEntry);

  let dateStyle = null;
  let stylesXml = null;
  const stylesEntry = zip.get("xl/styles.xml");
  if (stylesEntry) {
    try {
      const result = appendDateStyle(await entryText(stylesEntry));
      if (result) {
        stylesXml = result.xml;
        dateStyle = result.index;
      }
    } catch {
      dateStyle = null;
      stylesXml = null;
    }
  }

  // on garde les lignes existantes situées avant le point d'insertion
  const kept = [];
  const rowRe = /<row\b([^>]*?)(?:\/>|>[\s\S]*?<\/row>)/g;
  let m;
  while ((m = rowRe.exec(sheetXml))) {
    const n = Number(attr(m[1], "r") || 0);
    if (n && n < startRow) kept.push(m[0]);
  }

  const added = rows.map((cells, i) =>
    rowXml(startRow + i, cells, (value) => {
      const isDate = typeof value === "object" && value?.t === "d";
      return isDate && dateStyle != null ? dateStyle : 0;
    })
  );

  const sheetData = `<sheetData>${kept.join("")}${added.join("")}</sheetData>`;
  if (/<sheetData\s*\/>/.test(sheetXml)) sheetXml = sheetXml.replace(/<sheetData\s*\/>/, sheetData);
  else if (/<sheetData[^>]*>[\s\S]*?<\/sheetData>/.test(sheetXml))
    sheetXml = sheetXml.replace(/<sheetData[^>]*>[\s\S]*?<\/sheetData>/, sheetData);
  else throw new Error("Structure inattendue : impossible d'écrire dans cette feuille.");

  const lastRow = Math.max(startRow + rows.length - 1, 1);
  sheetXml = sheetXml.replace(/<dimension ref="([A-Z]+)\d+:([A-Z]+)\d+"\/>/, (all, a, b) => {
    const width = Math.max(colToIndex(b), rows.reduce((n, r) => Math.max(n, r.length - 1), 0));
    return `<dimension ref="${a}1:${indexToCol(width)}${lastRow}"/>`;
  });

  const files = [];
  for (const [name, entry] of zip) {
    if (name === sheetPath) files.push({ name, text: sheetXml });
    else if (name === "xl/styles.xml" && stylesXml) files.push({ name, text: stylesXml });
    else files.push({ name, copyOf: entry });
  }
  return writeZip(files);
}
