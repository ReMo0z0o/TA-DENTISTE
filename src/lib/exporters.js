// Sorties : collage Excel, .csv, classeur .xlsx neuf, remplissage du fichier
// officiel Antwoordtabel, et sauvegarde .json pour changer d'appareil.
import { COLUMNS, DATE_FIELDS, HEADERS, ordreExport, rdvPris } from "./model.js";
import { frDate, stamp, today } from "./dates.js";
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

/* ------------------------------------------ rendez-vous à annuler */

/**
 * Le rendez-vous réellement pris. Scénario B : si le premier est avec
 * supplément mais qu'un rendez-vous au tarif officiel est possible, c'est
 * celui-là qu'on a pris.
 */
export function dateRendezVousPris(call) {
  if (call.rdvSansSupplement === "oui" && call.dateSansSupplement) return call.dateSansSupplement;
  return call.datePremierRdv || call.dateSansSupplement || "";
}

/** Où en est l'annulation : "a_annuler", "annule" ou "annule_cabinet". */
export function etatAnnulation(call) {
  if (!call.annulation?.faiteLe) return "a_annuler";
  return call.annulation.parCabinet ? "annule_cabinet" : "annule";
}

/**
 * Tous les rendez-vous placés, du plus urgent à annuler au plus lointain.
 * Les fiches praticiens servent à retrouver la commune.
 */
export function rendezVousPlaces(calls, prospects = []) {
  const parId = new Map(prospects.map((p) => [p.id, p]));
  return calls
    .filter(rdvPris)
    .map((call) => {
      const fiche = parId.get(call.prospectId);
      return {
        id: call.id,
        annulerLe: call.annulation?.prevueLe || "",
        etat: etatAnnulation(call),
        annuleLe: call.annulation?.faiteLe || "",
        dentiste: call.dentiste,
        roleY: Boolean(call.roleY),
        telephone: call.telephone,
        rdvLe: dateRendezVousPris(call),
        tarif: call.supplementPremierRdv || "",
        prix: call.prix || "",
        commune: fiche?.commune || "",
        province: call.province || fiche?.province || "",
        appelLe: call.dateAppel || "",
        heureAppel: call.heureAppel || "",
        remarques: call.remarques || "",
      };
    })
    .sort((a, b) => {
      // ce qui reste à annuler passe devant, puis par date d'annulation
      const faitA = a.etat === "a_annuler" ? 0 : 1;
      const faitB = b.etat === "a_annuler" ? 0 : 1;
      if (faitA !== faitB) return faitA - faitB;
      return String(a.annulerLe || "9999").localeCompare(String(b.annulerLe || "9999"));
    });
}

/** Colonnes du classeur des rendez-vous : intitulé, clé, type et largeur. */
export const COLONNES_RDV = [
  { cle: "annulerLe", titre: "À annuler à partir du", type: "date", largeur: 20 },
  { cle: "statut", titre: "Où en est l'annulation", largeur: 26 },
  { cle: "dentiste", titre: "Dentiste", largeur: 30 },
  { cle: "telephone", titre: "Téléphone", largeur: 18 },
  { cle: "rdvLe", titre: "Rendez-vous pris le", type: "date", largeur: 18 },
  { cle: "tarif", titre: "Tarif annoncé", largeur: 22 },
  { cle: "prix", titre: "Prix (€)", type: "nombre", largeur: 10 },
  { cle: "commune", titre: "Commune", largeur: 18 },
  { cle: "province", titre: "Province", largeur: 16 },
  { cle: "appelLe", titre: "Appel du", type: "date", largeur: 13 },
  { cle: "heureAppel", titre: "Heure", largeur: 8 },
  { cle: "remarques", titre: "Remarques", largeur: 40 },
];

/**
 * Classeur des rendez-vous placés : trié par urgence, en-têtes traduits, ce qui
 * est à annuler mis en avant et ce qui est fait estompé.
 * C'est un fichier de travail personnel : il suit la langue de l'application,
 * contrairement au fichier de réponses de Test-Achats.
 */
export function classeurRendezVous(calls, prospects, t = (x) => x) {
  const lignes = rendezVousPlaces(calls, prospects);
  const aujourdhui = today();
  const highlight = new Set();
  const estompe = new Set();

  const rows = lignes.map((ligne, i) => {
    const urgent = ligne.etat === "a_annuler" && ligne.annulerLe && ligne.annulerLe <= aujourdhui;
    if (ligne.etat !== "a_annuler") estompe.add(i);
    else if (urgent) highlight.add(i);

    const statut =
      ligne.etat === "annule_cabinet"
        ? t("Annulé par le cabinet le {date}", { date: frDate(ligne.annuleLe) })
        : ligne.etat === "annule"
          ? t("Annulé le {date}", { date: frDate(ligne.annuleLe) })
          : urgent
            ? t("À annuler maintenant")
            : t("À annuler");

    const valeurs = {
      ...ligne,
      statut,
      dentiste: ligne.roleY ? `${ligne.dentiste} (${t("dentiste Y")})` : ligne.dentiste,
      tarif: t.valeur ? t.valeur(ligne.tarif) : ligne.tarif,
    };

    return COLONNES_RDV.map(({ cle, type }) => {
      const valeur = valeurs[cle] ?? "";
      if (valeur === "") return "";
      if (type === "date") return { t: "d", v: valeur };
      if (type === "nombre") {
        const nombre = Number(String(valeur).replace(",", ".").replace(/[^\d.-]/g, ""));
        return Number.isFinite(nombre) ? { t: "n", v: nombre } : String(valeur);
      }
      return String(valeur);
    });
  });

  return buildXlsx({
    sheetName: t("Rendez-vous"),
    headers: COLONNES_RDV.map((c) => t(c.titre)),
    rows,
    highlight,
    estompe,
    widths: COLONNES_RDV.map((c) => c.largeur),
  });
}

/**
 * Sauvegarde complète : liste d'appel, appels (avec leurs rappels et leurs
 * annulations), contrôles du registre national et réglages. Tout ce que
 * l'application sait doit pouvoir repartir sur un autre appareil.
 */
export function sauvegarde(etat) {
  return JSON.stringify(contenuSauvegarde(etat), null, 2);
}

/**
 * Le même contenu, mais sur une seule ligne : c'est celui qu'on copie à la
 * main. Sans retours à la ligne ni indentation, il est deux fois plus court et
 * ne peut plus être coupé par un messager qui reformate le texte.
 */
export function codeDeReprise(etat) {
  return JSON.stringify(contenuSauvegarde(etat));
}

function contenuSauvegarde(etat) {
  return {
    app: "ta-dentiste",
    version: 3,
    exporteLe: new Date().toISOString(),
    reglages: etat.reglages,
    prospects: etat.prospects,
    calls: etat.calls,
    suivi: etat.suivi,
  };
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
