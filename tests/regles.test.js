// Règles de saisie, dates et ordre d'export.
import { test } from "node:test";
import assert from "node:assert/strict";
import { applique, visible } from "../src/lib/regles.js";
import {
  ETATS_PROSPECT,
  aDesReponses,
  emptyCall,
  emptyProspect,
  estOriente,
  ficheSelonAppel,
  fichesDeLaMission,
  ordreExport,
  phoneKey,
  champsManquants,
  besoinRappel,
} from "../src/lib/model.js";
import { isoDate, frDate, jourOuvrableSuivant, dateLongue } from "../src/lib/dates.js";
import { provinceDeCodePostal, statutDansTexte, provinceDansTexte } from "../src/lib/provinces.js";
import { tsv, ligneTexte } from "../src/lib/exporters.js";

test("un premier rendez-vous au tarif officiel remplit la colonne « sans supplément »", () => {
  let call = emptyCall({ rdvPossible: "oui", datePremierRdv: "2026-11-12" });
  call = applique(call, "supplementPremierRdv", "sans supplément");
  assert.equal(call.rdvSansSupplement, "oui");
  assert.equal(call.dateSansSupplement, "2026-11-12");
  assert.equal(call.memeCabinet, "oui");
});

test("changer la date du premier rendez-vous entraîne celle sans supplément", () => {
  let call = emptyCall({ rdvPossible: "oui", datePremierRdv: "2026-11-12" });
  call = applique(call, "supplementPremierRdv", "sans supplément");
  call = applique(call, "datePremierRdv", "2026-12-01");
  assert.equal(call.dateSansSupplement, "2026-12-01");
});

test("une date sans supplément saisie à la main n'est pas écrasée", () => {
  let call = emptyCall({ rdvPossible: "oui", datePremierRdv: "2026-11-12" });
  call = applique(call, "supplementPremierRdv", "avec supplément");
  call = applique(call, "rdvSansSupplement", "oui");
  call = applique(call, "dateSansSupplement", "2027-03-04");
  call = applique(call, "datePremierRdv", "2026-12-01");
  assert.equal(call.dateSansSupplement, "2027-03-04");
});

test("passer à « pas de rendez-vous » vide la branche devenue sans objet", () => {
  let call = emptyCall({ rdvPossible: "oui", datePremierRdv: "2026-11-12", prix: "45", supplementPremierRdv: "avec supplément" });
  call = applique(call, "rdvPossible", "non");
  assert.equal(call.datePremierRdv, "");
  assert.equal(call.prix, "");
  assert.equal(call.supplementPremierRdv, "");
});

test("l'annulation est prévue 4 jours ouvrables après l'appel", () => {
  let call = emptyCall({ dateAppel: "2026-09-01", rdvPossible: "oui" });
  call = applique(call, "datePremierRdv", "2026-11-12");
  // mardi 1er septembre + 4 jours ouvrables = lundi 7 septembre
  assert.equal(call.annulation.prevueLe, "2026-09-07");
  assert.equal(dateLongue("2026-09-07"), "lundi 7 septembre 2026");
});

test("jours ouvrables : le week-end est sauté", () => {
  assert.equal(jourOuvrableSuivant("2026-09-04", 1), "2026-09-07"); // vendredi -> lundi
  assert.equal(jourOuvrableSuivant("2026-09-04", 2), "2026-09-08");
});

test("affichage conditionnel des colonnes", () => {
  const call = emptyCall({ rdvPossible: "non" });
  assert.equal(visible(call, "raison", false), true);
  assert.equal(visible(call, "prix", false), false);
  assert.equal(visible(call, "prix", true), true, "« afficher toutes les colonnes » force l'affichage");
});

test("le dentiste Y est exporté juste après le dentiste X", () => {
  const calls = [
    { ...emptyCall(), id: "x1", dentiste: "X1" },
    { ...emptyCall(), id: "a", dentiste: "Autre" },
    { ...emptyCall(), id: "y1", dentiste: "Y1", groupeDe: "x1", roleY: true },
  ];
  assert.deepEqual(ordreExport(calls).map((c) => c.dentiste), ["X1", "Y1", "Autre"]);
});

test("un dentiste Y orphelin reste dans l'export", () => {
  const calls = [{ ...emptyCall(), id: "y1", dentiste: "Y1", groupeDe: "disparu", roleY: true }];
  assert.equal(ordreExport(calls).length, 1);
});

test("la précision derrière « autres » part dans la colonne raison", () => {
  const call = emptyCall({ dentiste: "Test", rdvPossible: "non", raison: "autres", raisonPrecision: "cabinet en travaux" });
  assert.equal(ligneTexte(call)[8], "autres : cabinet en travaux");
});

test("l'export en colonnes reste aligné sur les 23 colonnes", () => {
  const call = emptyCall({ dentiste: "Test", dateAppel: "2026-09-01" });
  const ligne = ligneTexte(call);
  assert.equal(ligne.length, 23);
  assert.equal(ligne[3], "01/09/2026");
  assert.equal(tsv([call]).split("\t").length, 23);
});

test("numéros de téléphone : les écritures se rejoignent", () => {
  assert.equal(phoneKey("+32 69 64 14 60"), phoneKey("069/64.14.60"));
  assert.equal(phoneKey("0032 69 641 460"), phoneKey("+32 69 64 14 60"));
  assert.equal(phoneKey(""), "");
});

test("dates : lecture des écritures courantes", () => {
  assert.equal(isoDate("12/11/2026"), "2026-11-12");
  assert.equal(isoDate("2026-11-12"), "2026-11-12");
  assert.equal(isoDate("1/9/26"), "2026-09-01");
  assert.equal(frDate("2026-11-12"), "12/11/2026");
});

test("province déduite du code postal", () => {
  assert.equal(provinceDeCodePostal("7608"), "Hainaut");
  assert.equal(provinceDeCodePostal("6041"), "Hainaut");
  assert.equal(provinceDeCodePostal("6600"), "Luxembourg");
  assert.equal(provinceDeCodePostal("4000"), "Liège");
  assert.equal(provinceDeCodePostal("1000"), "Bruxelles-Capitale");
  assert.equal(provinceDeCodePostal("1300"), "Brabant wallon");
  assert.equal(provinceDeCodePostal(""), "");
});

test("statut et province reconnus dans un nom de fichier", () => {
  assert.equal(statutDansTexte("Dentistes non conventionnés Hainaut.xlsx"), "non conventionné");
  assert.equal(statutDansTexte("partiellement conventionnés.xlsx"), "partiellement conventionné");
  assert.equal(statutDansTexte("conventionnes_liege.xlsx"), "conventionné");
  assert.equal(provinceDansTexte("Dentistes_Liege_liste.xlsx"), "Liège");
});

test("rappel avec l'autre profil dès qu'une des deux questions est posée", () => {
  assert.equal(besoinRappel(emptyCall({ registreNational: "oui" })), true);
  assert.equal(besoinRappel(emptyCall({ interventionMajoree: "oui" })), true);
  assert.equal(besoinRappel(emptyCall()), false);
});

test("les champs encore vides sont signalés sans bloquer", () => {
  const manquants = champsManquants(emptyCall({ dentiste: "Test" }));
  assert.ok(manquants.length > 0);
  assert.ok(manquants.includes("Rendez-vous possible ?"));
});

test("une fiche seulement pré-remplie ne vaut pas une réponse", () => {
  // les cinq colonnes d'identité viennent de la liste d'appel, pas du cabinet
  const prerempli = emptyCall({
    province: "Hainaut",
    dentiste: "BOURDON, SANDY",
    statut: "conventionné",
    dateAppel: "2026-09-01",
    telephone: "+32 69 64 14 60",
    heureAppel: "10:24",
  });
  assert.equal(aDesReponses(prerempli), false);
});

test("la moindre réponse rend l'appel exportable", () => {
  const base = emptyCall({ dentiste: "X", dateAppel: "2026-09-01" });
  assert.equal(aDesReponses({ ...base, rdvPossible: "non" }), true);
  assert.equal(aDesReponses({ ...base, hygieniste: "non" }), true);
  assert.equal(aDesReponses({ ...base, remarques: "répondeur" }), true);
  assert.equal(aDesReponses({ ...base, prix: "45" }), true);
  assert.equal(aDesReponses({ ...base, raisonPrecision: "cabinet fermé" }), true);
});

test("la suite à donner vaut « fait » par défaut", () => {
  assert.equal(emptyCall().etatFiche, "fait");
  assert.equal(emptyCall({ etatFiche: "injoignable" }).etatFiche, "injoignable");
});

test("la suite à donner correspond aux états de la liste d'appel", () => {
  const cles = ETATS_PROSPECT.map((e) => e.key);
  for (const suite of ["fait", "rappeler", "injoignable", "ignore"]) {
    assert.ok(cles.includes(suite), `état « ${suite} » inconnu de la liste d'appel`);
  }
});

test("un dentiste Y se distingue d'un praticien du fichier", () => {
  const duFichier = emptyProspect({ id: "p1", nom: "BOURDON, SANDY" });
  const oriente = emptyProspect({ id: "p2", nom: "DUPONT, CLAIRE", origine: "oriente", orientePar: "BOURDON, SANDY" });
  assert.equal(estOriente(duFichier), false);
  assert.equal(estOriente(oriente), true);
  assert.equal(duFichier.origine, "liste", "une fiche importée l'est par défaut");
});

test("le quota de la mission ignore les dentistes Y", () => {
  const prospects = [
    emptyProspect({ id: "p1", etat: "fait" }),
    emptyProspect({ id: "p2", etat: "a_appeler" }),
    emptyProspect({ id: "y1", etat: "fait", origine: "oriente" }),
  ];
  const mission = fichesDeLaMission(prospects);
  assert.equal(mission.length, 2, "seuls les praticiens du fichier comptent");
  assert.equal(prospects.filter(estOriente).length, 1);
});

test("le dentiste Y partage le numéro du cabinet sans être un doublon", () => {
  // le scénario interdit d'appeler deux fois le même cabinet, mais le dentiste Y
  // exerce dans la même pratique : son numéro est légitimement identique
  const prospects = [
    emptyProspect({ id: "x", nom: "EL AHMADI, MALIKA", telephone: "+32 67 49 02 95" }),
    emptyProspect({ id: "y", nom: "DUPONT, CLAIRE", telephone: "+32 67 49 02 95", origine: "oriente" }),
  ];
  const aSignaler = prospects.filter((f) => !estOriente(f) && phoneKey(f.telephone));
  assert.equal(aSignaler.length, 1, "seul le praticien du fichier entre dans la détection");
  assert.equal(phoneKey(prospects[0].telephone), phoneKey(prospects[1].telephone), "les numéros sont bien identiques");
});

/* ------------------------------------------ ce qu'un appel corrige sur la fiche */

test("un numéro corrigé pendant l'appel remonte dans la liste", () => {
  const fiche = emptyProspect({
    id: "p1",
    nom: "BOURDON, SANDI",
    telephone: "+32 69 64 14 60",
    province: "Hainaut",
    statut: "conventionné",
    commune: "Péruwelz",
    etat: "a_appeler",
  });
  // au téléphone : le numéro du fichier était faux, et le nom mal orthographié
  const appel = emptyCall({
    prospectId: "p1",
    dentiste: "BOURDON, SANDY",
    telephone: "+32 69 77 12 34",
    province: "Hainaut",
    statut: "non conventionné",
  });

  const suivante = ficheSelonAppel(fiche, appel, "fait");
  assert.equal(suivante.telephone, "+32 69 77 12 34", "c'est ce numéro-là qu'il faudra rappeler");
  assert.equal(suivante.nom, "BOURDON, SANDY");
  assert.equal(suivante.statut, "non conventionné");
  assert.equal(suivante.etat, "fait");
  assert.equal(suivante.commune, "Péruwelz", "ce que l'appel ne touche pas ne bouge pas");
});

test("un champ laissé vide dans l'appel n'efface pas ce que la fiche sait", () => {
  const fiche = emptyProspect({ id: "p1", nom: "BOURDON, SANDY", telephone: "+32 69 64 14 60", province: "Hainaut", statut: "conventionné" });
  const suivante = ficheSelonAppel(fiche, emptyCall({ prospectId: "p1", dentiste: "BOURDON, SANDY" }), "rappeler");
  assert.equal(suivante.telephone, "+32 69 64 14 60");
  assert.equal(suivante.province, "Hainaut");
  assert.equal(suivante.statut, "conventionné");
  assert.equal(suivante.etat, "rappeler", "seule la suite à donner change");
});
