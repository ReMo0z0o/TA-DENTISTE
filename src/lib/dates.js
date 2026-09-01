// Dates et heures : l'application travaille en "aaaa-mm-jj" (format des champs
// date du navigateur) et n'affiche du "jj/mm/aaaa" que pour Excel et pour l'écran.

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const stamp = () => `${today()}_${nowTime().replace(":", "h")}`;

/** "aaaa-mm-jj" -> "jj/mm/aaaa" */
export function frDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || "");
}

/** Accepte jj/mm/aaaa, jj-mm-aaaa, aaaa-mm-jj, jj.mm.aa -> "aaaa-mm-jj" */
export function isoDate(value) {
  const s = String(value ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/.exec(s);
  if (!m) return s;
  const year = m[3].length === 2 ? String(2000 + Number(m[3])) : m[3];
  return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

const JOURS = {
  fr: ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"],
  nl: ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

const MOIS = {
  fr: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
  nl: ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

/** "aaaa-mm-jj" -> "lundi 1 septembre 2026" (ou son équivalent nl / en). */
export function dateLongue(iso, langue = "fr") {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const jours = JOURS[langue] || JOURS.fr;
  const mois = MOIS[langue] || MOIS.fr;
  return `${jours[d.getDay()]} ${d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}`;
}

function fromIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function toIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Jour ouvrable suivant (les jours fériés ne sont pas gérés). */
export function jourOuvrableSuivant(iso, nombre = 1) {
  const d = fromIso(iso);
  if (!d) return "";
  let restants = nombre;
  while (restants > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) restants--;
  }
  return toIso(d);
}

/** Nombre de jours entre aujourd'hui et une date ISO (négatif = passé). */
export function joursRestants(iso) {
  const d = fromIso(iso);
  if (!d) return null;
  const now = fromIso(today());
  return Math.round((d - now) / 86_400_000);
}

export function ajouteJours(iso, nombre) {
  const d = fromIso(iso);
  if (!d) return "";
  d.setDate(d.getDate() + nombre);
  return toIso(d);
}
