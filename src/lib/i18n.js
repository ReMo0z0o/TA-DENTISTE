// Langue de l'interface — français, néerlandais, anglais.
//
// Règle d'or : la langue d'affichage ne touche JAMAIS aux données.
// Les valeurs enregistrées et exportées restent celles qu'attend le fichier
// Antwoordtabel de Test-Achats (« conventionné », « oui », « avec supplément »…).
// Seuls les libellés changent à l'écran.
import { createContext, useContext } from "react";
import { DICTIONNAIRES } from "./traductions.js";

export const LANGUES = [
  { code: "fr", nom: "Français", court: "FR" },
  { code: "nl", nom: "Nederlands", court: "NL" },
  { code: "en", nom: "English", court: "EN" },
];

export const CODES_LANGUE = LANGUES.map((l) => l.code);

/** Langue de départ : celle du navigateur si on la connaît, sinon le français. */
export function langueParDefaut() {
  try {
    for (const demandee of navigator.languages || [navigator.language]) {
      const code = String(demandee || "").slice(0, 2).toLowerCase();
      if (CODES_LANGUE.includes(code)) return code;
    }
  } catch {
    /* pas de navigateur : français */
  }
  return "fr";
}

function remplace(texte, valeurs) {
  if (!valeurs) return texte;
  return texte.replace(/\{(\w+)\}/g, (tout, cle) => (cle in valeurs ? String(valeurs[cle]) : tout));
}

/**
 * Fabrique la fonction de traduction.
 * Le texte français EST la clé : une traduction manquante affiche le français
 * plutôt que rien.
 */
export function creeTraducteur(langue) {
  const dico = DICTIONNAIRES[langue] || null;

  const t = (texte, valeurs) => remplace((dico && dico[texte]) || texte, valeurs);

  /** Singulier ou pluriel selon la langue ({n} est fourni d'office). */
  t.n = (nombre, singulier, pluriel, valeurs) => {
    const beaucoup = langue === "fr" ? nombre > 1 : nombre !== 1;
    return t(beaucoup ? pluriel : singulier, { n: nombre, ...valeurs });
  };

  /** Libellé d'une valeur du fichier de réponses (la valeur stockée ne change pas). */
  t.valeur = (valeur) => (valeur ? t(valeur) : valeur);

  t.langue = langue;
  return t;
}

const ContexteLangue = createContext(creeTraducteur("fr"));

export const FournisseurLangue = ContexteLangue.Provider;

export function useT() {
  return useContext(ContexteLangue);
}
