// La province se déduit du code postal : une colonne de moins à remplir à la main.

const PLAGES = [
  [1000, 1299, "Bruxelles-Capitale"],
  [1300, 1499, "Brabant wallon"],
  [1500, 1999, "Brabant flamand"],
  [2000, 2999, "Anvers"],
  [3000, 3499, "Brabant flamand"],
  [3500, 3999, "Limbourg"],
  [4000, 4999, "Liège"],
  [5000, 5999, "Namur"],
  [6000, 6599, "Hainaut"],
  [6600, 6999, "Luxembourg"],
  [7000, 7999, "Hainaut"],
  [8000, 8999, "Flandre occidentale"],
  [9000, 9999, "Flandre orientale"],
];

/** Code postal belge -> province, "" si le code est hors plage. */
export function provinceDeCodePostal(cp) {
  const n = Number(String(cp || "").replace(/\D/g, "").slice(0, 4));
  if (!n) return "";
  const plage = PLAGES.find(([min, max]) => n >= min && n <= max);
  return plage ? plage[2] : "";
}

/** Retrouve une province citée dans un texte libre (titre de fichier, en-tête…). */
export function provinceDansTexte(texte) {
  const s = String(texte || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const table = [
    ["hainaut", "Hainaut"],
    ["liege", "Liège"],
    ["namur", "Namur"],
    ["luxembourg", "Luxembourg"],
    ["brabant wallon", "Brabant wallon"],
    ["brabant flamand", "Brabant flamand"],
    ["vlaams-brabant", "Brabant flamand"],
    ["bruxelles", "Bruxelles-Capitale"],
    ["anvers", "Anvers"],
    ["antwerpen", "Anvers"],
    ["limbourg", "Limbourg"],
    ["limburg", "Limbourg"],
    ["flandre occidentale", "Flandre occidentale"],
    ["west-vlaanderen", "Flandre occidentale"],
    ["flandre orientale", "Flandre orientale"],
    ["oost-vlaanderen", "Flandre orientale"],
  ];
  const trouve = table.find(([motif]) => s.includes(motif));
  return trouve ? trouve[1] : "";
}

/** Reconnaît le statut Inami cité dans un texte (nom de fichier, en-tête…). */
export function statutDansTexte(texte) {
  const s = String(texte || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/(^|[^a-z])(non[ -]?convention)/.test(s)) return "non conventionné";
  if (/partiel/.test(s)) return "partiellement conventionné";
  if (/convention/.test(s)) return "conventionné";
  return "";
}
