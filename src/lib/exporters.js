// Sorties : collage Excel, .csv, classeur .xlsx neuf, remplissage du fichier
// officiel Antwoordtabel, et sauvegarde .json pour changer d'appareil.
import { COLUMNS, DATE_FIELDS, HEADERS, ordreExport } from "./model.js";
import { frDate, stamp } from "./dates.js";
import { buildXlsx, fillTemplate, templateFirstFreeRow } from "./xlsx.js";

/**
 * Valeur d'une colonne telle qu'elle doit partir dans le fichier Excel.
 * La précision saisie derrière « autres » est recollée à la raison.
 */
export function valeurColonne(call, key) {
  const v = call[key] ?? "";
  if (key === "raison" && v === "autres" && String(call.raisonPrecision || "").trim()) {
    return `autres : ${String(call.raisonPrecision).trim()}`;
  }
  return v;
}

/** Une ligne de texte (dates en jj/mm/aaaa), pour le collage et le .csv. */
export function ligneTexte(call) {
  return COLUMNS.map(({ key }) => {
    const v = valeurColonne(call, key);
    if (DATE_FIELDS.includes(key)) return frDate(v);
    return String(v).replace(/[\t\n\r]+/g, " ").trim();
  });
}

/** Une ligne typée (vraies dates, prix numérique) pour les fichiers Excel. */
export function ligneExcel(call) {
  return COLUMNS.map(({ key, type }) => {
    const v = valeurColonne(call, key);
    if (v === "") return "";
    if (DATE_FIELDS.includes(key)) return { t: "d", v };
    if (type === "number") {
      const nombre = Number(String(v).replace(",", ".").replace(/[^\d.-]/g, ""));
      return Number.isFinite(nombre) && String(v).trim() !== "" ? { t: "n", v: nombre } : String(v);
    }
    return String(v);
  });
}

const csvCell = (v) => {
  const s = String(v ?? "");
  return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export function tsv(calls, avecEnTete = false) {
  const lignes = ordreExport(calls).map((c) => ligneTexte(c).join("\t"));
  return avecEnTete ? [HEADERS.join("\t"), ...lignes].join("\n") : lignes.join("\n");
}

export function csv(calls) {
  const lignes = ordreExport(calls).map((c) => ligneTexte(c).map(csvCell).join(";"));
  return "\uFEFF" + [HEADERS.map(csvCell).join(";"), ...lignes].join("\r\n");
}

/** Classeur neuf au format du fichier de réponses. */
export function classeurNeuf(calls) {
  const ordonnes = ordreExport(calls);
  const highlight = new Set();
  ordonnes.forEach((c, i) => {
    if (c.roleY) highlight.add(i);
  });
  return buildXlsx({
    sheetName: "Sheet1",
    headers: HEADERS,
    rows: ordonnes.map(ligneExcel),
    highlight,
    widths: COLUMNS.map(({ key, type }) =>
      key === "remarques" ? 40 : type === "date" ? 12 : key === "dentiste" ? 28 : 18
    ),
  });
}

/** Recopie les appels dans le fichier Excel officiel fourni par l'utilisateur. */
export function remplirModele(buffer, calls, startRow) {
  return fillTemplate(buffer, ordreExport(calls).map(ligneExcel), { startRow });
}

export { templateFirstFreeRow };

/** Sauvegarde complète : appels, liste d'appel, réglages. */
export function sauvegarde(etat) {
  return JSON.stringify(
    {
      app: "ta-dentiste",
      version: 2,
      exporteLe: new Date().toISOString(),
      reglages: etat.reglages,
      prospects: etat.prospects,
      calls: etat.calls,
    },
    null,
    2
  );
}

export const nomFichier = (base, ext) => `${base}-${stamp()}.${ext}`;

/** Déclenche un téléchargement ; renvoie false si le navigateur le refuse. */
export function telecharger(nom, contenu, mime) {
  try {
    const blob = contenu instanceof Blob ? contenu : new Blob([contenu], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nom;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return true;
  } catch {
    return false;
  }
}
