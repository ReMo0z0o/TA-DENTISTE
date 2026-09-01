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
