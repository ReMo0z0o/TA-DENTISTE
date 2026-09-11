// Vérifie la lecture des vrais fichiers de la mission et l'écriture des exports.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readZip, entryText } from "../src/lib/zip.js";
import { readXlsx, templateFirstFreeRow, fillTemplate, buildXlsx, isoToSerial, serialToIso } from "../src/lib/xlsx.js";
import { mappingListe, prospectsDepuis, estTableauReponses, callsDepuisReponses, parseDelimited, contexteDepuisNom } from "../src/lib/importers.js";
import { HEADERS } from "../src/lib/model.js";
import { ligneExcel } from "../src/lib/exporters.js";
import { jeu, bufferDe } from "./fixtures.mjs";

const FIXTURES = path.join(process.cwd(), "tests", "fixtures");
const dispo = jeu !== null;
const liste = jeu?.liste;
const modele = jeu?.modele;
const attendu = jeu?.attendu ?? {};
const buffer = bufferDe;

test("dates : aller-retour entre ISO et numéro de série Excel", () => {
  assert.equal(serialToIso(isoToSerial("2026-09-01")), "2026-09-01");
  assert.equal(serialToIso(isoToSerial("2027-02-28")), "2027-02-28");
  assert.equal(isoToSerial("pas une date"), null);
});

test("lecture d'une liste d'appel", { skip: !dispo }, async () => {
  const { sheets } = await readXlsx(buffer(liste));
  assert.equal(sheets.length, 1);
  const rows = sheets[0].rows;
  const { enTete, mapping } = mappingListe(rows);
  assert.ok(enTete >= 0, "la ligne d'en-tête doit être trouvée");
  assert.ok(mapping.includes("nom"));
  assert.ok(mapping.includes("telephone"));

  const contexte = contexteDepuisNom("Dentistes_Hainaut_liste_appels.xlsx", rows);
  assert.equal(contexte.province, "Hainaut");

  const fiches = prospectsDepuis(rows, mapping, enTete, contexte);
  assert.equal(fiches.length, attendu.praticiens, "les lignes vides et la note de bas de page sont écartées");
  assert.equal(fiches[0].nom, attendu.premierNom);
  assert.equal(fiches[0].telephone, attendu.premierTel);
  assert.equal(fiches[0].cp, attendu.premierCp);
  assert.equal(fiches[0].province, attendu.province);
  assert.equal(fiches[0].inami, attendu.premierInami);
  assert.equal(fiches.at(-1).nom, attendu.dernierNom);
  assert.ok(fiches.every((f) => f.province === attendu.province));
});

test("détection du tableau de réponses", { skip: !dispo }, async () => {
  const { sheets } = await readXlsx(buffer(modele));
  const rows = sheets[0].rows;
  const detection = estTableauReponses(rows);
  assert.equal(detection.oui, true);
  assert.equal(detection.enTete, 0);
  assert.equal(rows[0].length, 23);
});

test("remplissage du modèle officiel", { skip: !dispo }, async () => {
  const buf = buffer(modele);
  const depart = await templateFirstFreeRow(buf);
  assert.ok(depart >= 2);

  const appels = [
    {
      province: "Hainaut",
      dentiste: "BOURDON, SANDY",
      statut: "conventionné",
      dateAppel: "2026-09-01",
      telephone: "+32 69 64 14 60",
      interventionMajoree: "non",
      registreNational: "oui",
      rdvPossible: "oui",
      raison: "",
      orienteMemePratique: "",
      orienteAutreCabinet: "",
      datePremierRdv: "2026-11-12",
      supplementPremierRdv: "avec supplément",
      infoPrix: "oui",
      prix: "45",
      rdvSansSupplement: "oui",
      dateSansSupplement: "2027-01-15",
      memeCabinet: "oui",
      adresseSansSupplement: "",
      hygieniste: "non",
      infoRemboursement: "",
      remboursement: "",
      remarques: 'Guillemets " et & et <balise>',
    },
  ];
  const blob = await fillTemplate(buf, appels.map(ligneExcel), { startRow: depart });
  const bytes = Buffer.from(await blob.arrayBuffer());
  fs.writeFileSync(path.join(FIXTURES, "out-modele.xlsx"), bytes);

  // les listes déroulantes du fichier officiel doivent survivre au remplissage
  const zip = readZip(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const feuille = await entryText(zip.get("xl/worksheets/sheet1.xml"));
  assert.match(feuille, /<dataValidations/, "les listes déroulantes sont conservées");
  assert.match(feuille, /conventionné,partiellement conventionné/);

  const relu = await readXlsx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const rows = relu.sheets[0].rows;
  assert.equal(rows[0][0], "Province adresse dentiste", "les titres d'origine sont conservés");
  const ligne = rows[depart - 1];
  assert.equal(ligne[0], "Hainaut");
  assert.equal(ligne[1], "BOURDON, SANDY");
  assert.equal(ligne[3], "2026-09-01", "la date de l'appel est une vraie date");
  assert.equal(ligne[11], "2026-11-12");
  assert.equal(ligne[14], "45");
  assert.equal(ligne[22], 'Guillemets " et & et <balise>');
});

test("classeur neuf", async () => {
  const appels = [
    { province: "Hainaut", dentiste: "X", dateAppel: "2026-09-01", prix: "45" },
    { province: "Hainaut", dentiste: "Y", dateAppel: "2026-09-01" },
  ];
  const blob = await buildXlsx({
    headers: HEADERS,
    rows: appels.map(ligneExcel),
    highlight: new Set([1]),
  });
  const bytes = Buffer.from(await blob.arrayBuffer());
  if (fs.existsSync(FIXTURES)) fs.writeFileSync(path.join(FIXTURES, "out-neuf.xlsx"), bytes);
  const relu = await readXlsx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const rows = relu.sheets[0].rows;
  assert.equal(rows[0][0], "Province adresse dentiste");
  assert.equal(rows[1][1], "X");
  assert.equal(rows[1][3], "2026-09-01");
  assert.equal(rows[2][1], "Y");
});

test("collage de lignes Excel (23 colonnes, sans titres)", () => {
  const colle = [
    "Hainaut\tBOURDON, SANDY\tconventionné\t01/09/2026\t+32 69 64 14 60\tnon\tnon\toui\t\t\t\t12/11/2026\tavec supplément\toui\t45\toui\t15/01/2027\toui\t\tnon\t\t\tRAS",
  ].join("\n");
  const rows = parseDelimited(colle);
  const detection = estTableauReponses(rows);
  assert.equal(detection.oui, true);
  const appels = callsDepuisReponses(rows, detection.enTete);
  assert.equal(appels.length, 1);
  assert.equal(appels[0].dentiste, "BOURDON, SANDY");
  assert.equal(appels[0].dateAppel, "2026-09-01");
  assert.equal(appels[0].datePremierRdv, "2026-11-12");
  assert.equal(appels[0].remarques, "RAS");
});

test("liste collée sans en-tête : les colonnes sont devinées", () => {
  const colle = [
    "1;BOURDON, SANDY;303016-12;Rue du Colombier 28;Péruwelz;7608;+32 69 64 14 60;rdv.biz",
    "2;FLORINDO SANTOS FARIA, SUSANA;314336-41;Place des Alliés 4;Mons;7000;+32 65 34 85 97;pagesdor.be",
  ].join("\n");
  const rows = parseDelimited(colle);
  const { enTete, mapping } = mappingListe(rows);
  assert.equal(enTete, -1);
  const fiches = prospectsDepuis(rows, mapping, enTete, {});
  assert.equal(fiches.length, 2);
  assert.equal(fiches[0].nom, "BOURDON, SANDY");
  assert.equal(fiches[0].telephone, "+32 69 64 14 60");
  assert.equal(fiches[0].cp, "7608");
  assert.equal(fiches[0].province, "Hainaut");
});

test("un Antwoordtabel déjà commencé est reconnu comme tableau de réponses", { skip: !dispo }, async () => {
  const { sheets } = await readXlsx(buffer(modele));
  const rows = sheets[0].rows;
  const reponses = estTableauReponses(rows);
  const liste = mappingListe(rows);
  const genre = reponses.oui && (reponses.enTete >= 0 || liste.enTete < 0) ? "reponses" : "liste";
  assert.equal(genre, "reponses");
});

test("une liste de praticiens reste une liste", { skip: !dispo }, async () => {
  const { sheets } = await readXlsx(buffer(liste));
  const rows = sheets[0].rows;
  const reponses = estTableauReponses(rows);
  const map = mappingListe(rows);
  const genre = reponses.oui && (reponses.enTete >= 0 || map.enTete < 0) ? "reponses" : "liste";
  assert.equal(genre, "liste");
});

test("une liste aux intitulés néerlandais est reconnue", () => {
  const colle = [
    "Nr;Naam;Riziv-nummer;Adres;Gemeente;Postcode;Telefoon",
    "1;JANSSENS, PIETER;300111-11;Kerkstraat 4;Gent;9000;+32 9 000 00 01",
    "2;PEETERS, ANNE;300222-22;Dorpsplein 8;Brugge;8000;+32 50 00 00 02",
  ].join("\n");
  const rows = parseDelimited(colle);
  const { enTete, mapping } = mappingListe(rows);
  assert.equal(enTete, 0);
  assert.ok(mapping.includes("nom"));
  assert.ok(mapping.includes("telephone"));
  const fiches = prospectsDepuis(rows, mapping, enTete, {});
  assert.equal(fiches.length, 2);
  assert.equal(fiches[0].nom, "JANSSENS, PIETER");
  assert.equal(fiches[0].commune, "Gent");
  assert.equal(fiches[0].province, "Flandre orientale");
  assert.equal(fiches[1].province, "Flandre occidentale");
});

test("une liste aux intitulés anglais est reconnue", () => {
  const colle = [
    "No;Practitioner;Address;City;Postcode;Phone",
    "1;SMITH, JOHN;Main street 1;Antwerp;2000;+32 3 000 00 01",
  ].join("\n");
  const rows = parseDelimited(colle);
  const { enTete, mapping } = mappingListe(rows);
  assert.equal(enTete, 0);
  const fiches = prospectsDepuis(rows, mapping, enTete, {});
  assert.equal(fiches[0].nom, "SMITH, JOHN");
  assert.equal(fiches[0].province, "Anvers");
});

/* ----------------------------- statut Inami choisi au chargement de la liste */

const LISTE_VIERGE = [
  "N°;Nom du Praticien;N° INAMI;Adresse;Commune;Code postal;Téléphone",
  "1;BOURDON, SANDY;303016-12;Rue du Colombier 28;Péruwelz;7608;+32 69 64 14 60",
  "2;MARTIN, ALEX;314336-41;Place des Alliés 4;Mons;7000;+32 65 34 85 97",
].join("\n");

test("les trois statuts peuvent être appliqués à une liste vierge", () => {
  const rows = parseDelimited(LISTE_VIERGE);
  const { enTete, mapping } = mappingListe(rows);
  for (const statut of ["conventionné", "partiellement conventionné", "non conventionné"]) {
    const fiches = prospectsDepuis(rows, mapping, enTete, { statut });
    assert.equal(fiches.length, 2);
    assert.deepEqual(
      fiches.map((f) => f.statut),
      [statut, statut],
      `le statut « ${statut} » doit couvrir toute la liste`
    );
  }
});

test("sans choix, le statut reste vide plutôt qu'inventé", () => {
  const rows = parseDelimited(LISTE_VIERGE);
  const { enTete, mapping } = mappingListe(rows);
  const fiches = prospectsDepuis(rows, mapping, enTete, {});
  assert.deepEqual(fiches.map((f) => f.statut), ["", ""]);
});

test("un praticien dont le fichier donne le statut garde le sien", () => {
  // le choix fait au chargement ne doit pas écraser ce que le fichier sait
  const colle = [
    "N°;Nom du Praticien;Statut;Téléphone",
    "1;BOURDON, SANDY;partiellement conventionné;+32 69 64 14 60",
    "2;MARTIN, ALEX;;+32 65 34 85 97",
  ].join("\n");
  const rows = parseDelimited(colle);
  const { enTete, mapping } = mappingListe(rows);
  const fiches = prospectsDepuis(rows, mapping, enTete, { statut: "non conventionné" });
  assert.equal(fiches[0].statut, "partiellement conventionné", "le fichier fait foi");
  assert.equal(fiches[1].statut, "non conventionné", "le choix comble les cases vides");
});

test("la ligne copiée pour un seul dentiste est celle du collage groupé", async () => {
  const { ligneTexte, tsv } = await import("../src/lib/exporters.js");
  const { emptyCall } = await import("../src/lib/model.js");
  const appels = [
    emptyCall({ id: "a", dentiste: "BOURDON, SANDY", province: "Hainaut", telephone: "+32 69 64 14 60", dateAppel: "2026-09-01", rdvPossible: "oui", datePremierRdv: "2026-11-12", remarques: "secrétariat pressé" }),
    emptyCall({ id: "b", dentiste: "MARTIN, ALEX", province: "Hainaut", dateAppel: "2026-09-02", rdvPossible: "non", raison: "retraite" }),
  ];
  const groupe = tsv(appels).split("\n");
  assert.equal(ligneTexte(appels[0]).join("\t"), groupe[0], "copier une ligne ne doit rien changer à son contenu");
  assert.equal(ligneTexte(appels[1]).join("\t"), groupe[1]);
  assert.equal(ligneTexte(appels[0]).length, 23, "les 23 colonnes du fichier de réponses");
  assert.ok(!ligneTexte(appels[0]).join("\t").includes("\n"), "une seule ligne, collable telle quelle");
});
