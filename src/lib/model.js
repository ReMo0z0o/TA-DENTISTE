// Modèle de données : les 23 colonnes du fichier Antwoordtabel, dans l'ordre
// exact, plus les champs propres à l'application (heure, suivi, liaison X/Y).

export const OUI_NON = ["oui", "non"];
export const STATUTS = ["conventionné", "partiellement conventionné", "non conventionné"];
export const SUPPLEMENT = ["avec supplément", "sans supplément", "la personne au téléphone ne le savait pas"];
export const INFO_PRIX = ["oui", "non", "ne s'applique pas"];
export const SANS_SUPP = ["oui", "non", "la personne au téléphone ne le savait pas"];
export const MEME_CABINET = ["oui", "non", "je n'ai pas reçu de l'information à ce sujet"];
export const REMBOURSEMENT = ["remboursé", "non remboursé"];
export const RAISONS = ["pas de nouveaux patients", "retraite", "autres"];

export const PROVINCES = [
  "Anvers",
  "Brabant flamand",
  "Brabant wallon",
  "Bruxelles-Capitale",
  "Flandre occidentale",
  "Flandre orientale",
  "Hainaut",
  "Liège",
  "Limbourg",
  "Luxembourg",
  "Namur",
];

/**
 * Les 23 colonnes, dans l'ordre du fichier Excel.
 * header : intitulé exact du fichier Antwoordtabel (sert aussi à le reconnaître)
 * label  : version courte affichée dans l'application
 */
export const COLUMNS = [
  { key: "province", type: "text", label: "Province de l'adresse du dentiste", header: "Province adresse dentiste" },
  { key: "dentiste", type: "text", label: "Dentiste", header: "Dentiste" },
  { key: "statut", type: "choice", options: STATUTS, label: "Statut Inami", header: "Statut dentiste  Inami" },
  { key: "dateAppel", type: "date", label: "Date de l'appel", header: "Date de l'appel" },
  { key: "telephone", type: "text", label: "Nr de téléphone", header: "Nr de téléphone" },
  {
    key: "interventionMajoree",
    type: "choice",
    options: OUI_NON,
    label: "Le dentiste s'est renseigné sur le droit à l'intervention majorée ?",
    header: "Le dentiste s'est renseigné sur le droit à l'intervention majorée?",
  },
  {
    key: "registreNational",
    type: "choice",
    options: OUI_NON,
    label: "Le dentiste a demandé votre numéro de registre national ?",
    header: "Le dentiste a demandé votre numéro de régistre national?",
  },
  { key: "rdvPossible", type: "choice", options: OUI_NON, label: "Rendez-vous possible ?", header: "Rendez-vous possible?" },
  {
    key: "raison",
    type: "choice",
    options: RAISONS,
    free: true,
    label: "Si pas de rendez-vous : raison",
    header: "Si pas de rendez-vous possible: raison (pas de nouveaux patients, retraite, autres)",
  },
  {
    key: "orienteMemePratique",
    type: "choice",
    options: OUI_NON,
    label: "Orienté vers un autre dentiste de la même pratique de groupe",
    header: "Si pas de rendez-vous possible cette année: orienté vers un autre dentiste de la même pratique de groupe",
  },
  {
    key: "orienteAutreCabinet",
    type: "choice",
    options: OUI_NON,
    label: "Orienté vers un dentiste d'un autre cabinet",
    header: "Si pas de rendez-vous possible cette année: orienté vers un autre dentiste d'un autre cabinet",
  },
  {
    key: "datePremierRdv",
    type: "date",
    label: "Date du premier rendez-vous proposé",
    header: "Si un rendez-vous est possible: date du premier rendez-vous proposé",
  },
  {
    key: "supplementPremierRdv",
    type: "choice",
    options: SUPPLEMENT,
    label: "Ce premier rendez-vous est…",
    header: "Concernant le premier rendez-vous proposé: c'ést un rendez-vous avec ou sans supplément?",
  },
  {
    key: "infoPrix",
    type: "choice",
    options: INFO_PRIX,
    label: "Informations reçues sur le prix de la consultation ?",
    header: "Vous avez reçu des informations sur le prix de la consultation?",
  },
  {
    key: "prix",
    type: "number",
    label: "Prix du premier rendez-vous",
    header:
      "Prix du premier rendez-vous proposé (si un prix a été donné, remplissez seulement le chiffre, cela peut être un montant approximatif)",
  },
  {
    key: "rdvSansSupplement",
    type: "choice",
    options: SANS_SUPP,
    label: "Rendez-vous possible sans supplément ?",
    header:
      'Rendez-vous possible sans supplément (si le premier rendez-vous proposé est au tarif officiel, remplissez aussi "oui" dans cette colonne',
  },
  {
    key: "dateSansSupplement",
    type: "date",
    label: "Date du rendez-vous sans supplément",
    header:
      "Si oui: date du rendez-vous sans supplément (si le premier rendez-vous proposé est au tarif officiel, c'est la même date)",
  },
  {
    key: "memeCabinet",
    type: "choice",
    options: MEME_CABINET,
    label: "Ce rendez-vous a-t-il lieu dans le même cabinet ?",
    header: "Si oui: le rendez-vous  sans supplément a-t-il lieu dans le même cabinet ?",
  },
  {
    key: "adresseSansSupplement",
    type: "text",
    label: "Adresse du rendez-vous sans supplément",
    header: "Si non: adresse où le rendez-vous sans supplément a lieu",
  },
  {
    key: "hygieniste",
    type: "choice",
    options: OUI_NON,
    label: "Une consultation chez un hygiéniste a-t-elle été proposée ?",
    header: "À un moment donné, a-t-on proposé une consultation chez un hygiéniste bucco-dentaire comme alternative ?",
  },
  {
    key: "infoRemboursement",
    type: "choice",
    options: OUI_NON,
    label: "Informations reçues sur le remboursement de l'hygiéniste ?",
    header: "Si oui: avez-vous reçu des informations concernant le remboursement des soins du hygiéniste bucco-dentaire ?",
  },
  {
    key: "remboursement",
    type: "choice",
    options: REMBOURSEMENT,
    label: "Cette consultation est…",
    header: "Si oui: a-t-on indiqué qu’une consultation chez un hygiéniste bucco-dentaire est remboursée ou non remboursée ?",
  },
  { key: "remarques", type: "textarea", label: "Remarques", header: "Remarques" },
];

export const COLUMN_KEYS = COLUMNS.map((c) => c.key);
export const HEADERS = COLUMNS.map((c) => c.header);
export const DATE_FIELDS = ["dateAppel", "datePremierRdv", "dateSansSupplement"];
export const COLUMN_BY_KEY = Object.fromEntries(COLUMNS.map((c) => [c.key, c]));

/** Un appel vide, éventuellement pré-rempli depuis la fiche du praticien. */
export function emptyCall(defaults = {}) {
  const call = {};
  for (const key of COLUMN_KEYS) call[key] = "";
  return {
    ...call,
    id: null,
    heureAppel: "",
    prospectId: null,
    // précision libre quand la raison du refus est « autres »
    raisonPrecision: "",
    // suite à donner au praticien dans la liste d'appel (voir ETATS_PROSPECT)
    etatFiche: "fait",
    // second appel, le lendemain, avec le profil « intervention majorée »
    rappel: { date: "", rdvObtenu: "", dateRdv: "", remarque: "" },
    // scénario C : le dentiste Y proposé par le cabinet, rattaché au dentiste X
    groupeDe: null,
    roleY: false,
    annulation: { prevueLe: "", faiteLe: "", parCabinet: false },
    rappelFait: false,
    createdAt: null,
    updatedAt: null,
    ...defaults,
  };
}

/** Fiche praticien issue d'une liste d'appel importée. */
export function emptyProspect(defaults = {}) {
  return {
    id: null,
    ordre: "",
    nom: "",
    inami: "",
    adresse: "",
    commune: "",
    cp: "",
    telephone: "",
    site: "",
    site2: "",
    province: "",
    statut: "",
    etat: "a_appeler",
    note: "",
    // « liste » : venu du fichier de praticiens à appeler.
    // « oriente » : dentiste vers lequel un cabinet nous a orientés (scénario C).
    origine: "liste",
    orienteDe: null, // fiche du praticien qui l'a proposé
    orientePar: "", // son nom, pour l'afficher sans avoir à le retrouver
    ...defaults,
  };
}

/** Praticien ajouté depuis un appel, et non depuis le fichier de la mission. */
export function estOriente(fiche) {
  return fiche?.origine === "oriente";
}

/** Les praticiens du quota : ceux qui viennent du fichier de la mission. */
export function fichesDeLaMission(prospects) {
  return prospects.filter((p) => !estOriente(p));
}

export const ETATS_PROSPECT = [
  { key: "a_appeler", label: "À appeler", tone: "slate" },
  { key: "fait", label: "Fait", tone: "teal" },
  { key: "rappeler", label: "À rappeler", tone: "amber" },
  { key: "injoignable", label: "Injoignable", tone: "red" },
  { key: "ignore", label: "Écarté", tone: "slate" },
];

/** Numéro de téléphone réduit à ses chiffres, pour repérer les doublons. */
export function phoneKey(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0032")) return "32" + digits.slice(4).replace(/^0/, "");
  if (digits.startsWith("32")) return "32" + digits.slice(2).replace(/^0/, "");
  return "32" + digits.replace(/^0/, "");
}

/** Format international cliquable pour l'application téléphone. */
export function telHref(value) {
  const key = phoneKey(value);
  return key ? `tel:+${key}` : null;
}

/**
 * Le scénario impose de rappeler le lendemain, avec l'autre profil, les cabinets
 * qui ont demandé le numéro de registre national ou parlé d'intervention majorée.
 */
export function besoinRappel(call) {
  return call.interventionMajoree === "oui" || call.registreNational === "oui";
}

/** Un rendez-vous a-t-il été pris (et donc à annuler) ? */
export function rdvPris(call) {
  return call.rdvPossible === "oui" && Boolean(call.datePremierRdv || call.dateSansSupplement);
}

// ces cinq colonnes sont pré-remplies depuis la liste : leur présence ne veut
// pas dire qu'on a obtenu des réponses
const COLONNES_IDENTITE = ["province", "dentiste", "statut", "dateAppel", "telephone"];

/**
 * L'appel a-t-il donné quelque chose à mettre dans le fichier de réponses ?
 * Un cabinet injoignable ne doit pas produire une ligne vide.
 */
export function aDesReponses(call) {
  if (String(call.raisonPrecision || "").trim()) return true;
  return COLUMN_KEYS.some((cle) => !COLONNES_IDENTITE.includes(cle) && String(call[cle] ?? "").trim() !== "");
}

/** Champs manquants à signaler avant l'enregistrement (jamais bloquant). */
export function champsManquants(call) {
  const manquants = [];
  const add = (key) => manquants.push(COLUMN_BY_KEY[key].label);
  if (!call.province) add("province");
  if (!call.statut) add("statut");
  if (!call.dateAppel) add("dateAppel");
  if (!call.telephone) add("telephone");
  if (!call.rdvPossible) add("rdvPossible");
  if (call.rdvPossible === "non" && !call.raison) add("raison");
  if (call.rdvPossible === "oui") {
    if (!call.datePremierRdv) add("datePremierRdv");
    if (!call.supplementPremierRdv) add("supplementPremierRdv");
    if (!call.rdvSansSupplement) add("rdvSansSupplement");
  }
  if (!call.hygieniste) add("hygieniste");
  return manquants;
}

/**
 * Ordre d'export : chaque dentiste Y est placé juste après le dentiste X
 * pour lequel l'appel a été passé, comme demandé dans le scénario C.
 */
export function ordreExport(calls) {
  const parIdentifiant = new Map(calls.map((c) => [c.id, c]));
  const enfants = new Map();
  for (const call of calls) {
    if (call.groupeDe && parIdentifiant.has(call.groupeDe)) {
      if (!enfants.has(call.groupeDe)) enfants.set(call.groupeDe, []);
      enfants.get(call.groupeDe).push(call);
    }
  }
  const out = [];
  for (const call of calls) {
    if (call.groupeDe && parIdentifiant.has(call.groupeDe)) continue;
    out.push(call);
    for (const enfant of enfants.get(call.id) || []) out.push(enfant);
  }
  return out;
}
