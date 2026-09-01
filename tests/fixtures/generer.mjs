// Fabrique des fichiers d'exemple ayant exactement la forme des fichiers de la
// mission, mais avec des praticiens inventés : les tests tournent partout sans
// qu'aucune donnée réelle ne soit versionnée.
//   node tests/fixtures/generer.mjs
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeZip } from "../../src/lib/zip.js";
import { escapeXml, indexToCol } from "../../src/lib/xlsx.js";
import { HEADERS } from "../../src/lib/model.js";

const ICI = path.dirname(fileURLToPath(import.meta.url));

const cellule = (ref, valeur) =>
  valeur === "" || valeur == null
    ? ""
    : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(valeur)}</t></is></c>`;

const ligne = (numero, cellules) => {
  const contenu = cellules.map((v, i) => cellule(`${indexToCol(i)}${numero}`, v)).filter(Boolean).join("");
  return contenu ? `<row r="${numero}">${contenu}</row>` : `<row r="${numero}"/>`;
};

function classeur({ nomFeuille, lignes, validations = "", derniereColonne }) {
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${derniereColonne}${lignes.length}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData>${lignes
    .map((cellules, i) => ligne(i + 1, cellules))
    .join("")}</sheetData>${validations}</worksheet>`;

  return writeZip([
    {
      name: "[Content_Types].xml",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(nomFeuille)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    {
      name: "xl/styles.xml",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`,
    },
    { name: "xl/worksheets/sheet1.xml", text: sheet },
  ]);
}

/* ------------------------------------------- liste d'appel d'exemple */

const PRATICIENS = [
  ["1", "DUBOIS, CAMILLE", "300001-11", "Rue de l'Exemple 1", "Charleroi", "6000", "+32 71 00 00 01", "exemple-un.be", "annuaire.be"],
  ["2", "MARTIN, ALEX", "300002-22", "Avenue Fictive 12", "Mons", "7000", "+32 65 00 00 02", "exemple-deux.be", ""],
  ["3", "LAMBERT, DOMINIQUE", "300003-33", "Place Imaginaire 3", "La Louvière", "7100", "+32 64 00 00 03", "exemple-trois.be", "annuaire.be"],
  ["4", "SIMON, CLAUDE", "300004-44", "Chaussée d'Essai 44", "Tournai", "7500", "+32 69 00 00 04", "", ""],
  ["5", "PETIT, MAXENCE", "300005-55", "Rue du Test 5", "Thuin", "6530", "+32 71 00 00 05", "exemple-cinq.be", ""],
];

const ENTETE_LISTE = [
  "N°", "Nom du Praticien", "N° INAMI", "Adresse d'Exercice", "Commune", "CP",
  "Téléphone", "Site Web principal", "Source secondaire", "Appelé ?", "Date appel", "Remarques",
];

const lignesListe = [
  ["Dentistes – Hainaut · liste d'appel (mystery shopping) — PRATICIENS FICTIFS"],
  ["Téléphones au format international (+32, le 0 initial est supprimé)"],
  [],
  ENTETE_LISTE,
  ...PRATICIENS,
  [],
  ["Colonnes à compléter par vous : « Appelé ? », « Date appel », « Remarques »."],
];

/* --------------------------------------- tableau de réponses d'exemple */

// mêmes listes déroulantes que le fichier officiel : c'est ce que le
// remplissage doit préserver
const VALIDATIONS = `<dataValidations count="6"><dataValidation type="list" allowBlank="1" sqref="C2:C894"><formula1>"conventionné,partiellement conventionné, non conventionné"</formula1></dataValidation><dataValidation type="list" allowBlank="1" sqref="F2:F916 G2:G827 H2:H996 J2:J847 K2:K870 N3:N962 T2:T919 U2:U908"><formula1>"oui,non"</formula1></dataValidation><dataValidation type="list" allowBlank="1" sqref="M2:M859"><formula1>"avec supplément,sans supplément,la personne au téléphone ne le savait pas"</formula1></dataValidation><dataValidation type="list" allowBlank="1" sqref="P2:P917"><formula1>"oui,non,la personne au téléphone ne le savait pas"</formula1></dataValidation><dataValidation type="list" allowBlank="1" sqref="R2:R987"><formula1>"oui,non,je n'ai pas reçu de l'information à ce sujet"</formula1></dataValidation><dataValidation type="list" allowBlank="1" sqref="V2:V956"><formula1>"remboursé,non remboursé"</formula1></dataValidation></dataValidations>`;

// le fichier officiel arrive avec une valeur isolée en M2 : on la reproduit
const ligneResiduelle = [];
ligneResiduelle[12] = "avec supplément";

const lignesModele = [HEADERS, ligneResiduelle];

const listeBlob = await classeur({
  nomFeuille: "Dentistes Hainaut",
  lignes: lignesListe,
  derniereColonne: "L",
});
const modeleBlob = await classeur({
  nomFeuille: "Sheet1",
  lignes: lignesModele,
  validations: VALIDATIONS,
  derniereColonne: "W",
});

await writeFile(path.join(ICI, "liste-exemple.xlsx"), Buffer.from(await listeBlob.arrayBuffer()));
await writeFile(path.join(ICI, "modele-exemple.xlsx"), Buffer.from(await modeleBlob.arrayBuffer()));
console.log("liste-exemple.xlsx et modele-exemple.xlsx régénérés.");
