// Règles de saisie : ce que l'application déduit toute seule pour éviter de
// retaper la même chose, et ce qu'elle vide quand une branche du scénario
// devient sans objet (« si vous ne vous souvenez plus : laissez vide »).
import { jourOuvrableSuivant } from "./dates.js";
import { rdvPris } from "./model.js";

const vide = (call, ...cles) => {
  for (const cle of cles) call[cle] = "";
};

/**
 * Applique un changement de champ et ses conséquences.
 * Renvoie toujours un nouvel objet.
 */
export function applique(call, cle, valeur) {
  const suivant = { ...call, [cle]: valeur };
  const avant = call[cle];

  switch (cle) {
    case "rdvPossible":
      if (valeur === "oui") vide(suivant, "raison", "raisonPrecision", "orienteMemePratique", "orienteAutreCabinet");
      if (valeur === "non")
        vide(
          suivant,
          "datePremierRdv",
          "supplementPremierRdv",
          "infoPrix",
          "prix",
          "rdvSansSupplement",
          "dateSansSupplement",
          "memeCabinet",
          "adresseSansSupplement"
        );
      break;

    case "raison":
      if (valeur !== "autres") suivant.raisonPrecision = "";
      break;

    case "supplementPremierRdv":
      // Le fichier de réponses le demande : un premier rendez-vous déjà au tarif
      // officiel compte comme « rendez-vous possible sans supplément », même date.
      if (valeur === "sans supplément") {
        if (!suivant.rdvSansSupplement) suivant.rdvSansSupplement = "oui";
        if (!suivant.dateSansSupplement) suivant.dateSansSupplement = suivant.datePremierRdv || "";
        if (!suivant.memeCabinet) suivant.memeCabinet = "oui";
        if (!suivant.prix) suivant.infoPrix = suivant.infoPrix || "";
      }
      break;

    case "datePremierRdv":
      // la date « sans supplément » suit tant qu'elle est restée identique
      if (suivant.supplementPremierRdv === "sans supplément" && (!call.dateSansSupplement || call.dateSansSupplement === avant)) {
        suivant.dateSansSupplement = valeur;
      }
      break;

    case "rdvSansSupplement":
      if (valeur !== "oui") vide(suivant, "dateSansSupplement", "memeCabinet", "adresseSansSupplement");
      break;

    case "memeCabinet":
      if (valeur !== "non") suivant.adresseSansSupplement = "";
      break;

    case "hygieniste":
      if (valeur !== "oui") vide(suivant, "infoRemboursement", "remboursement");
      break;

    case "infoRemboursement":
      if (valeur !== "oui") suivant.remboursement = "";
      break;

    default:
      break;
  }

  return majAnnulation(suivant);
}

/**
 * Le scénario demande de n'annuler qu'après 4 jours ouvrables : la date est
 * calculée d'office, et reste modifiable à la main.
 */
export function majAnnulation(call) {
  const annulation = { ...(call.annulation || { prevueLe: "", faiteLe: "", parCabinet: false }) };
  if (!rdvPris(call)) return { ...call, annulation };
  if (!annulation.prevueLe && call.dateAppel) {
    annulation.prevueLe = jourOuvrableSuivant(call.dateAppel, 4);
  }
  return { ...call, annulation };
}

/** Faut-il afficher ce champ ? (« afficher toutes les colonnes » force l'affichage) */
export function visible(call, cle, afficherTout) {
  if (afficherTout) return true;
  switch (cle) {
    case "raison":
    case "orienteMemePratique":
    case "orienteAutreCabinet":
      return call.rdvPossible === "non";
    case "raisonPrecision":
      return call.rdvPossible === "non" && call.raison === "autres";
    case "datePremierRdv":
    case "supplementPremierRdv":
    case "infoPrix":
    case "prix":
    case "rdvSansSupplement":
      return call.rdvPossible === "oui";
    case "dateSansSupplement":
    case "memeCabinet":
      return call.rdvPossible === "oui" && call.rdvSansSupplement === "oui";
    case "adresseSansSupplement":
      return call.rdvPossible === "oui" && call.rdvSansSupplement === "oui" && call.memeCabinet === "non";
    case "infoRemboursement":
      return call.hygieniste === "oui";
    case "remboursement":
      return call.hygieniste === "oui" && call.infoRemboursement === "oui";
    default:
      return true;
  }
}
