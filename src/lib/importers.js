// Import de fichiers : listes d'appel (.xlsx, .csv, collage), tableau de
// réponses déjà commencé, et sauvegardes .json de l'application.
import { readXlsx } from "./xlsx.js";
import { COLUMNS, COLUMN_KEYS, DATE_FIELDS, emptyCall, emptyProspect } from "./model.js";
import { isoDate } from "./dates.js";
import { provinceDeCodePostal, provinceDansTexte, statutDansTexte } from "./provinces.js";

/* --------------------------------------------------------- texte délimité */

/** Découpe une ligne en respectant les guillemets. */
export function splitRow(line, delim) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function detecteSeparateur(ligne) {
  const compte = (ch) => (ligne.split(ch).length - 1);
  const candidats = [
    ["\t", compte("\t")],
    [";", compte(";")],
    [",", compte(",")],
  ];
  candidats.sort((a, b) => b[1] - a[1]);
  return candidats[0][1] > 0 ? candidats[0][0] : "\t";
}

/** Texte CSV / TSV / collage Excel -> tableau de lignes. */
export function parseDelimited(texte) {
  const clean = String(texte || "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  // un champ entre guillemets peut contenir des retours à la ligne
  const lignes = [];
  let cur = "";
  let quoted = false;
  for (const ch of clean) {
    if (ch === '"') quoted = !quoted;
    if (ch === "\n" && !quoted) {
      lignes.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur) lignes.push(cur);
  const utiles = lignes.filter((l) => l.trim() !== "");
  if (!utiles.length) return [];
  const delim = detecteSeparateur(utiles[0]);
  return utiles.map((l) => splitRow(l, delim).map((c) => c.trim()));
}

/* --------------------------------------------------------- normalisation */

export function normalise(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/* ------------------------------------------------ colonnes d'une liste */

// Les intitulés reconnus valent aussi en néerlandais et en anglais : les
// listes de la mission circulent dans les trois langues.
export const CHAMPS_LISTE = [
  { key: "ignorer", label: "— ignorer —" },
  {
    key: "nom",
    label: "Nom du praticien",
    alias: ["nom du praticien", "praticien", "dentiste", "nom", "naam", "naam van de beoefenaar", "tandarts", "name", "practitioner", "dentist"],
  },
  {
    key: "telephone",
    label: "Téléphone",
    alias: ["telephone", "tel", "gsm", "nr de telephone", "numero de telephone", "telefoon", "telefoonnummer", "phone", "phone number"],
  },
  { key: "inami", label: "N° INAMI", alias: ["n inami", "inami", "numero inami", "riziv", "riziv nummer", "inami number"] },
  { key: "adresse", label: "Adresse", alias: ["adresse d exercice", "adresse", "rue", "straat", "adres", "address"] },
  { key: "commune", label: "Commune", alias: ["commune", "ville", "localite", "gemeente", "stad", "city", "town"] },
  { key: "cp", label: "Code postal", alias: ["cp", "code postal", "postcode", "postal code", "zip", "zip code"] },
  { key: "province", label: "Province", alias: ["province", "provincie"] },
  { key: "statut", label: "Statut Inami", alias: ["statut", "statut dentiste inami", "convention", "statuut", "riziv statuut", "status"] },
  { key: "site", label: "Site web", alias: ["site web principal", "site web", "site", "website"] },
  { key: "site2", label: "Autre source", alias: ["source secondaire", "source", "site 2", "autre source", "andere bron", "other source"] },
  { key: "ordre", label: "N° d'ordre", alias: ["n", "no", "num", "numero", "ordre", "nr", "number"] },
  { key: "note", label: "Remarques", alias: ["remarques", "remarque", "note", "notes", "opmerkingen", "remarks"] },
];

const ALIAS_LISTE = new Map();
for (const champ of CHAMPS_LISTE) for (const a of champ.alias || []) ALIAS_LISTE.set(a, champ.key);

const RE_TEL = /^(\+?\s*32|0)[\s./-]*\d[\d\s./-]{6,}$/;
const RE_CP = /^\d{4}$/;
const RE_INAMI = /^\d{5,6}[-\s]?\d{2}$/;
const RE_SITE = /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i;
const RE_NOM = /[A-Za-zÀ-ÿ]{2,}\s*,\s*[A-Za-zÀ-ÿ]{2,}|^[A-ZÀ-Ý][a-zà-ÿ]+\s+[A-ZÀ-Ý]/;

/** Cherche la ligne d'en-tête d'une liste (les fichiers ont souvent un titre au-dessus). */
export function trouveEnTete(rows, aliasMap) {
  let meilleur = { index: -1, score: 0 };
  const limite = Math.min(rows.length, 20);
  for (let i = 0; i < limite; i++) {
    let score = 0;
    for (const cell of rows[i]) {
      const n = normalise(cell);
      if (n && aliasMap.has(n)) score++;
    }
    if (score > meilleur.score) meilleur = { index: i, score };
  }
  return meilleur.score >= 2 ? meilleur.index : -1;
}

/** Devine le rôle de chaque colonne d'une liste sans en-tête, d'après son contenu. */
function devineParContenu(rows) {
  const nbCols = rows.reduce((n, r) => Math.max(n, r.length), 0);
  const mapping = new Array(nbCols).fill("ignorer");
  const part = (col, re) => {
    let vus = 0;
    let ok = 0;
    for (const row of rows) {
      const v = String(row[col] ?? "").trim();
      if (!v) continue;
      vus++;
      if (re.test(v)) ok++;
    }
    return vus ? ok / vus : 0;
  };

  const pris = new Set();
  const assigne = (col, key) => {
    if (col < 0 || pris.has(col)) return;
    mapping[col] = key;
    pris.add(col);
  };

  const meilleur = (re, seuil) => {
    let best = -1;
    let bestScore = seuil;
    for (let c = 0; c < nbCols; c++) {
      if (pris.has(c)) continue;
      const s = part(c, re);
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    return best;
  };

  assigne(meilleur(RE_TEL, 0.5), "telephone");
  assigne(meilleur(RE_INAMI, 0.5), "inami");
  assigne(meilleur(RE_CP, 0.6), "cp");
  assigne(meilleur(RE_SITE, 0.6), "site");
  assigne(meilleur(RE_NOM, 0.4), "nom");

  const restantes = [];
  for (let c = 0; c < nbCols; c++) if (!pris.has(c)) restantes.push(c);
  if (!mapping.includes("nom") && restantes.length) assigne(restantes.shift(), "nom");
  const cpCol = mapping.indexOf("cp");
  if (cpCol > 0 && !pris.has(cpCol - 1)) assigne(cpCol - 1, "commune");
  const libres = restantes.filter((c) => !pris.has(c));
  if (libres.length) assigne(libres[0], "adresse");
  return mapping;
}

/**
 * Propose une correspondance colonne -> champ.
 * Renvoie { enTete, mapping } ; enTete = -1 si aucune ligne d'en-tête trouvée.
 */
export function mappingListe(rows) {
  const enTete = trouveEnTete(rows, ALIAS_LISTE);
  if (enTete < 0) return { enTete, mapping: devineParContenu(rows) };
  const ligne = rows[enTete];
  const nbCols = rows.reduce((n, r) => Math.max(n, r.length), 0);
  const mapping = new Array(nbCols).fill("ignorer");
  const pris = new Set();
  ligne.forEach((cell, i) => {
    const n = normalise(cell);
    let key = ALIAS_LISTE.get(n);
    if (!key) {
      for (const [alias, k] of ALIAS_LISTE) {
        if (n && (n.startsWith(alias) || alias.startsWith(n)) && Math.abs(n.length - alias.length) < 8) {
          key = k;
          break;
        }
      }
    }
    if (key && !pris.has(key)) {
      mapping[i] = key;
      pris.add(key);
    }
  });
  return { enTete, mapping };
}

/** Construit les fiches praticiens à partir du tableau et de la correspondance. */
export function prospectsDepuis(rows, mapping, enTete, contexte = {}) {
  const debut = enTete >= 0 ? enTete + 1 : 0;
  const out = [];
  for (let i = debut; i < rows.length; i++) {
    const row = rows[i];
    const fiche = emptyProspect();
    mapping.forEach((key, col) => {
      if (key === "ignorer") return;
      const v = String(row[col] ?? "").trim();
      if (v) fiche[key] = v;
    });
    if (!fiche.nom && !fiche.telephone) continue;
    // une ligne de commentaire en bas de fichier n'a ni téléphone ni code postal
    if (!fiche.telephone && !fiche.cp && fiche.nom.length > 60) continue;
    fiche.province = fiche.province || provinceDeCodePostal(fiche.cp) || contexte.province || "";
    fiche.statut = statutDansTexte(fiche.statut) || contexte.statut || "";
    fiche.id = `p${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`;
    out.push(fiche);
  }
  return out;
}

/* ---------------------------------------------- tableau de réponses */

const ALIAS_REPONSES = new Map();
COLUMNS.forEach((col) => {
  ALIAS_REPONSES.set(normalise(col.header), col.key);
  ALIAS_REPONSES.set(normalise(col.label), col.key);
});

/** Le tableau ressemble-t-il au fichier Antwoordtabel (23 colonnes) ? */
export function estTableauReponses(rows) {
  if (!rows.length) return { oui: false, enTete: -1 };
  const enTete = trouveEnTete(rows, ALIAS_REPONSES);
  if (enTete >= 0) {
    let score = 0;
    for (const cell of rows[enTete]) if (ALIAS_REPONSES.has(normalise(cell))) score++;
    if (score >= 6) return { oui: true, enTete };
  }
  const large = rows.every((r) => r.length >= 18 && r.length <= 25);
  return { oui: large && rows.length > 0, enTete: -1 };
}

/** Tableau de réponses -> appels de l'application. */
export function callsDepuisReponses(rows, enTete) {
  const ordre =
    enTete >= 0
      ? rows[enTete].map((cell) => ALIAS_REPONSES.get(normalise(cell)) || null)
      : COLUMN_KEYS.slice();
  const debut = enTete >= 0 ? enTete + 1 : 0;
  const out = [];
  for (let i = debut; i < rows.length; i++) {
    const row = rows[i];
    if (!row.some((c) => String(c ?? "").trim())) continue;
    const call = emptyCall();
    ordre.forEach((key, col) => {
      if (!key) return;
      const v = String(row[col] ?? "").trim();
      if (!v) return;
      call[key] = DATE_FIELDS.includes(key) ? isoDate(v) : v;
    });
    if (!call.dentiste && !call.telephone) continue;
    call.id = `c${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`;
    call.createdAt = new Date().toISOString();
    out.push(call);
  }
  return out;
}

/* ------------------------------------------------------ lecture fichier */

function lireTexte(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsText(file, "utf-8");
  });
}

function lireBinaire(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Lit un fichier déposé par l'utilisateur.
 * -> { type: "json", data } | { type: "table", feuilles: [{nom, rows}], nom }
 */
export async function lireFichier(file) {
  const nom = file.name || "";
  const ext = nom.toLowerCase().split(".").pop();

  if (ext === "xlsx" || ext === "xlsm") {
    const buffer = await lireBinaire(file);
    const { sheets } = await readXlsx(buffer);
    return { type: "table", nom, feuilles: sheets.map((s) => ({ nom: s.name, rows: s.rows })) };
  }

  const texte = await lireTexte(file);
  const brut = texte.replace(/^\uFEFF/, "").trim();
  if (ext === "json" || brut.startsWith("{") || brut.startsWith("[")) {
    try {
      return { type: "json", data: JSON.parse(brut), nom };
    } catch {
      throw new Error("Ce fichier .json est illisible : il a peut-être été tronqué.");
    }
  }
  return { type: "table", nom, feuilles: [{ nom, rows: parseDelimited(brut) }] };
}

/** Contexte déduit du nom du fichier : « Dentistes_Hainaut… », « …non conventionnés ». */
export function contexteDepuisNom(nom, rows = []) {
  const entete = rows.slice(0, 3).map((r) => r.join(" ")).join(" ");
  const source = `${nom} ${entete}`;
  return { province: provinceDansTexte(source), statut: statutDansTexte(source) };
}
