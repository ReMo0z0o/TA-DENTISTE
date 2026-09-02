import { emptyCall, emptyProspect, phoneKey } from "./model.js";

// Tout reste sur l'appareil : rien n'est envoyé sur un serveur.
// Le passage d'un appareil à l'autre se fait par le fichier .json de sauvegarde.

const CLE = "ta-dentiste:v1";

const ETAT_VIDE = {
  reglages: { province: "", statut: "", profil: "standard", afficherTout: false, langue: "" },
  prospects: [],
  calls: [],
  brouillon: null,
  suivi: { controlesRegistre: [] },
};

export function etatVide() {
  return structuredClone(ETAT_VIDE);
}

export function charge() {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return etatVide();
    const data = JSON.parse(brut);
    return {
      ...etatVide(),
      ...data,
      reglages: { ...ETAT_VIDE.reglages, ...(data.reglages || {}) },
      suivi: { ...ETAT_VIDE.suivi, ...(data.suivi || {}) },
    };
  } catch {
    return etatVide();
  }
}

/** Renvoie null si tout va bien, sinon un message à afficher. */
export function enregistre(etat) {
  try {
    localStorage.setItem(CLE, JSON.stringify(etat));
    return null;
  } catch (e) {
    if (e && (e.name === "QuotaExceededError" || e.code === 22)) {
      return "Mémoire du navigateur pleine : télécharge la sauvegarde .json puis allège la liste.";
    }
    return "Sauvegarde automatique impossible sur cet appareil : pense à télécharger la sauvegarde .json.";
  }
}

/** Identifiant court et unique, stable d'un appareil à l'autre. */
export function nouvelId(prefixe = "c") {
  return `${prefixe}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Fusionne une sauvegarde avec l'état de l'appareil.
 * `remplacer` : true = la sauvegarde fait foi, false = on complète sans rien
 * effacer. Dans les deux cas, TOUT est repris : liste d'appel, appels (avec
 * leurs rappels et leurs annulations) et contrôles du registre national.
 * La langue reste celle de l'appareil : c'est un réglage d'affichage local.
 */
export function fusionneSauvegarde(etat, data, remplacer) {
  const prospects = Array.isArray(data?.prospects) ? data.prospects : [];
  // une très vieille sauvegarde pouvait n'être qu'un tableau d'appels
  const calls = Array.isArray(data?.calls) ? data.calls : Array.isArray(data) ? data : [];
  const controles = Array.isArray(data?.suivi?.controlesRegistre) ? data.suivi.controlesRegistre : [];
  // une sauvegarde peut venir d'une version antérieure de l'application :
  // on remet les champs manquants plutôt que de laisser des trous
  const complet = (call) => ({ ...emptyCall(), ...call });
  const complete = (fiche) => emptyProspect(fiche);

  if (remplacer) {
    return {
      prospects: prospects.map(complete),
      calls: calls.map(complet),
      reglages: { ...etat.reglages, ...(data?.reglages || {}), langue: etat.reglages.langue },
      suivi: { ...etat.suivi, controlesRegistre: [...controles].sort() },
    };
  }

  const idsCalls = new Set(etat.calls.map((c) => c.id));
  const clesProspects = new Set(etat.prospects.map((p) => cleProspect(p)));
  return {
    prospects: [...etat.prospects, ...prospects.filter((p) => !clesProspects.has(cleProspect(p))).map(complete)],
    calls: [...etat.calls, ...calls.filter((c) => !idsCalls.has(c.id)).map(complet)],
    suivi: {
      ...etat.suivi,
      controlesRegistre: [...new Set([...etat.suivi.controlesRegistre, ...controles])].sort(),
    },
  };
}

/** Deux fiches sont la même si le nom et le numéro correspondent. */
function cleProspect(fiche) {
  return `${fiche.nom}|${phoneKey(fiche.telephone)}`;
}
