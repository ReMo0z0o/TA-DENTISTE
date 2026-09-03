// Les tests tournent sur les vrais fichiers de la mission s'ils sont présents,
// sinon sur les fichiers d'exemple versionnés (praticiens inventés).
// Voir tests/fixtures/README.md.
import fs from "node:fs";
import path from "node:path";

const DOSSIER = path.resolve("tests/fixtures");

const JEUX = [
  {
    nom: "fichiers réels de la mission",
    liste: "liste.xlsx",
    modele: "modele.xlsx",
    attendu: {
      praticiens: 25,
      premierNom: "BOURDON, SANDY",
      premierTel: "+32 69 64 14 60",
      premierTelLien: "tel:+3269641460",
      premierCp: "7608",
      premierInami: "303016-12",
      deuxiemeNom: "FLORINDO SANTOS FARIA, SUSANA",
      troisiemeNom: "LEFÈBVRE, SANDRINE",
      dernierNom: "EL AHMADI, MALIKA",
      province: "Hainaut",
    },
  },
  {
    nom: "fichiers d'exemple",
    liste: "liste-exemple.xlsx",
    modele: "modele-exemple.xlsx",
    attendu: {
      praticiens: 5,
      premierNom: "DUBOIS, CAMILLE",
      premierTel: "+32 71 00 00 01",
      premierTelLien: "tel:+3271000001",
      premierCp: "6000",
      premierInami: "300001-11",
      deuxiemeNom: "MARTIN, ALEX",
      troisiemeNom: "LAMBERT, DOMINIQUE",
      dernierNom: "PETIT, MAXENCE",
      province: "Hainaut",
    },
  },
];

const trouve = JEUX.find(
  (jeu) => fs.existsSync(path.join(DOSSIER, jeu.liste)) && fs.existsSync(path.join(DOSSIER, jeu.modele))
);

export const jeu = trouve
  ? { ...trouve, liste: path.join(DOSSIER, trouve.liste), modele: path.join(DOSSIER, trouve.modele) }
  : null;

export function bufferDe(fichier) {
  const b = fs.readFileSync(fichier);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}
