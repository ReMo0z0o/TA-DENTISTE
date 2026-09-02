// Aller-retour d'une sauvegarde : ce qui est téléchargé doit revenir entier,
// suivi compris (rappels, annulations, contrôles du registre national).
import { test } from "node:test";
import assert from "node:assert/strict";
import { sauvegarde } from "../src/lib/exporters.js";
import { fusionneSauvegarde, etatVide } from "../src/lib/storage.js";
import { emptyCall, emptyProspect } from "../src/lib/model.js";

/** Un état de travail réaliste : liste entamée, appels encodés, suivi en cours. */
function etatTravail() {
  return {
    ...etatVide(),
    reglages: { province: "Hainaut", statut: "conventionné", profil: "standard", afficherTout: true, langue: "fr" },
    prospects: [
      emptyProspect({ id: "p1", nom: "BOURDON, SANDY", telephone: "+32 69 64 14 60", cp: "7608", province: "Hainaut", etat: "fait" }),
      emptyProspect({ id: "p2", nom: "MARTIN, ALEX", telephone: "+32 65 00 00 02", cp: "7000", province: "Hainaut", etat: "a_appeler" }),
      emptyProspect({ id: "p3", nom: "PETIT, MAXENCE", telephone: "+32 71 00 00 05", cp: "6530", etat: "injoignable", note: "répondeur" }),
    ],
    calls: [
      {
        ...emptyCall(),
        id: "c1",
        prospectId: "p1",
        province: "Hainaut",
        dentiste: "BOURDON, SANDY",
        statut: "conventionné",
        dateAppel: "2026-09-01",
        heureAppel: "10:24",
        telephone: "+32 69 64 14 60",
        registreNational: "oui",
        interventionMajoree: "non",
        rdvPossible: "oui",
        datePremierRdv: "2026-11-12",
        supplementPremierRdv: "avec supplément",
        prix: "45",
        rdvSansSupplement: "oui",
        dateSansSupplement: "2027-01-15",
        memeCabinet: "oui",
        hygieniste: "non",
        remarques: "secrétariat pressé",
        // --- suivi rattaché à l'appel ---
        rappel: { date: "2026-09-02", rdvObtenu: "oui", dateRdv: "2026-10-03", remarque: "voix d'homme" },
        rappelFait: true,
        annulation: { prevueLe: "2026-09-07", faiteLe: "2026-09-08", parCabinet: true },
      },
      {
        ...emptyCall(),
        id: "c2",
        groupeDe: "c1",
        roleY: true,
        dentiste: "DUPONT, CLAIRE",
        dateAppel: "2026-09-01",
        heureAppel: "10:31",
        rdvPossible: "oui",
        datePremierRdv: "2026-09-30",
        annulation: { prevueLe: "2026-09-07", faiteLe: "", parCabinet: false },
      },
    ],
    // --- suivi global ---
    suivi: { controlesRegistre: ["2026-09-05", "2026-09-12"] },
  };
}

/** Simule le trajet réel : téléchargement du .json puis relecture. */
function allerRetour(etat, cible, remplacer) {
  const fichier = JSON.parse(sauvegarde(etat));
  return { ...cible, ...fusionneSauvegarde(cible, fichier, remplacer) };
}

test("la sauvegarde contient bien tout le suivi", () => {
  const fichier = JSON.parse(sauvegarde(etatTravail()));
  assert.ok(fichier.prospects, "liste d'appel absente");
  assert.ok(fichier.calls, "appels absents");
  assert.ok(fichier.suivi, "le suivi doit être dans le fichier");
  assert.deepEqual(fichier.suivi.controlesRegistre, ["2026-09-05", "2026-09-12"]);
  assert.equal(fichier.calls[0].rappel.dateRdv, "2026-10-03");
  assert.equal(fichier.calls[0].annulation.faiteLe, "2026-09-08");
});

test("sur un appareil vierge, tout revient à l'identique", () => {
  const depart = etatTravail();
  const arrivee = allerRetour(depart, etatVide(), true);

  assert.equal(arrivee.prospects.length, 3, "liste d'appel");
  assert.equal(arrivee.calls.length, 2, "appels");
  assert.deepEqual(
    arrivee.prospects.map((p) => p.etat),
    ["fait", "a_appeler", "injoignable"],
    "l'état de chaque praticien"
  );
  assert.equal(arrivee.prospects[2].note, "répondeur");

  const c1 = arrivee.calls.find((c) => c.id === "c1");
  assert.equal(c1.heureAppel, "10:24", "heure de l'appel");
  assert.equal(c1.prix, "45");
  assert.equal(c1.remarques, "secrétariat pressé");

  // le suivi rattaché à l'appel
  assert.deepEqual(c1.rappel, { date: "2026-09-02", rdvObtenu: "oui", dateRdv: "2026-10-03", remarque: "voix d'homme" });
  assert.equal(c1.rappelFait, true);
  assert.deepEqual(c1.annulation, { prevueLe: "2026-09-07", faiteLe: "2026-09-08", parCabinet: true });

  // le lien scénario C
  const c2 = arrivee.calls.find((c) => c.id === "c2");
  assert.equal(c2.groupeDe, "c1");
  assert.equal(c2.roleY, true);
  assert.equal(c2.annulation.prevueLe, "2026-09-07");

  // le suivi global
  assert.deepEqual(arrivee.suivi.controlesRegistre, ["2026-09-05", "2026-09-12"], "contrôles du registre national");

  // les réglages de travail
  assert.equal(arrivee.reglages.province, "Hainaut");
  assert.equal(arrivee.reglages.afficherTout, true);
});

test("aucun champ ne se perd en route", () => {
  const depart = etatTravail();
  const arrivee = allerRetour(depart, etatVide(), true);
  for (const attendu of depart.calls) {
    const relu = arrivee.calls.find((c) => c.id === attendu.id);
    assert.ok(relu, `appel ${attendu.id} perdu`);
    assert.deepEqual(relu, attendu, `appel ${attendu.id} modifié en route`);
  }
  assert.deepEqual(arrivee.prospects, depart.prospects);
  assert.deepEqual(arrivee.suivi, depart.suivi);
});

test("en mode « compléter », rien n'est effacé et le suivi fusionne", () => {
  const bureau = etatTravail();
  // le téléphone a son propre appel et son propre contrôle du registre
  const telephone = {
    ...etatVide(),
    prospects: [emptyProspect({ id: "p9", nom: "LOCAL, LUC", telephone: "+32 2 000 00 09" })],
    calls: [{ ...emptyCall(), id: "c9", dentiste: "LOCAL, LUC", dateAppel: "2026-09-03" }],
    suivi: { controlesRegistre: ["2026-09-19"] },
  };

  const fusion = allerRetour(bureau, telephone, false);
  assert.equal(fusion.calls.length, 3, "les appels des deux appareils");
  assert.ok(fusion.calls.some((c) => c.id === "c9"), "l'appel local est conservé");
  assert.ok(fusion.calls.some((c) => c.id === "c1"), "l'appel importé est ajouté");
  assert.equal(fusion.prospects.length, 4);
  assert.deepEqual(
    fusion.suivi.controlesRegistre,
    ["2026-09-05", "2026-09-12", "2026-09-19"],
    "les contrôles des deux appareils sont réunis, sans doublon"
  );
  assert.equal(fusion.calls.find((c) => c.id === "c1").rappel.dateRdv, "2026-10-03");
});

test("recharger deux fois la même sauvegarde ne duplique rien", () => {
  const depart = etatTravail();
  const une = allerRetour(depart, etatVide(), true);
  const deux = allerRetour(depart, une, false);
  assert.equal(deux.calls.length, 2, "pas d'appel en double");
  assert.equal(deux.prospects.length, 3, "pas de praticien en double");
  assert.deepEqual(deux.suivi.controlesRegistre, ["2026-09-05", "2026-09-12"]);
});

test("la langue de l'appareil n'est pas écrasée par la sauvegarde", () => {
  const bureau = etatTravail(); // travaille en français
  const telephone = { ...etatVide(), reglages: { ...etatVide().reglages, langue: "nl" } };
  const fusion = allerRetour(bureau, telephone, true);
  assert.equal(fusion.reglages.langue, "nl", "chaque appareil garde sa langue d'affichage");
  assert.equal(fusion.reglages.province, "Hainaut", "mais les réglages de travail suivent");
});

test("une sauvegarde d'une ancienne version reste lisible", () => {
  const ancienne = { app: "ta-dentiste", version: 2, prospects: [], calls: [{ id: "vieux", dentiste: "X" }] };
  const arrivee = fusionneSauvegarde(etatVide(), ancienne, true);
  assert.equal(arrivee.calls.length, 1);
  assert.deepEqual(arrivee.calls[0].annulation, { prevueLe: "", faiteLe: "", parCabinet: false });
  assert.deepEqual(arrivee.suivi.controlesRegistre, [], "pas de suivi dans le fichier : liste vide, pas de plantage");
});
