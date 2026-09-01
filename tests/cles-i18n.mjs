// Recense tout ce qui doit être traduit : les appels t("…") écrits dans le
// code, plus les libellés que le code traduit dynamiquement (colonnes du
// fichier de réponses, valeurs des listes, onglets, états).
import fs from "node:fs";
import path from "node:path";
import { COLUMNS, ETATS_PROSPECT, OUI_NON, STATUTS, SUPPLEMENT, INFO_PRIX, SANS_SUPP, MEME_CABINET, REMBOURSEMENT, RAISONS } from "../src/lib/model.js";
import { CHAMPS_LISTE } from "../src/lib/importers.js";

const RACINE = path.resolve("src");

function fichiers(dossier) {
  const out = [];
  for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
    const complet = path.join(dossier, entree.name);
    if (entree.isDirectory()) out.push(...fichiers(complet));
    else if (/\.(js|jsx)$/.test(entree.name)) out.push(complet);
  }
  return out;
}

/** Clés littérales : t("…"), t("…", {…}), t.n(n, "…", "…"). */
function clesLitterales() {
  const cles = new Set();
  for (const fichier of fichiers(RACINE)) {
    const code = fs.readFileSync(fichier, "utf8");
    for (const m of code.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) cles.add(JSON.parse(`"${m[1]}"`));
    for (const m of code.matchAll(/\bt\.n\(\s*[^,]+,\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"/g)) {
      cles.add(JSON.parse(`"${m[1]}"`));
      cles.add(JSON.parse(`"${m[2]}"`));
    }
  }
  return cles;
}

/** Libellés traduits par le code au moment du rendu. */
function clesDynamiques() {
  const cles = new Set();
  for (const col of COLUMNS) cles.add(col.label);
  for (const etat of ETATS_PROSPECT) cles.add(etat.label);
  for (const champ of CHAMPS_LISTE) cles.add(champ.label);
  // valeurs du fichier de réponses : traduites à l'affichage, stockées en français
  for (const valeur of [
    ...OUI_NON, ...STATUTS, ...SUPPLEMENT, ...INFO_PRIX,
    ...SANS_SUPP, ...MEME_CABINET, ...REMBOURSEMENT, ...RAISONS,
  ]) {
    cles.add(valeur);
  }
  for (const mot of ["Tous", "Liste", "Appel", "Journée", "Suivi", "Données"]) cles.add(mot);
  for (const aide of [
    "Qui reste à appeler",
    "Encoder l'appel en cours",
    "Ce qui est déjà encodé",
    "Rappels et annulations",
    "Import, Excel, sauvegarde",
  ]) {
    cles.add(aide);
  }
  return cles;
}

export function toutesLesCles() {
  return [...new Set([...clesLitterales(), ...clesDynamiques()])].sort((a, b) => a.localeCompare(b, "fr"));
}
