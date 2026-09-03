// Le classeur des rendez-vous placés : ce qu'il contient, dans quel ordre,
// et à quoi il ressemble une fois ouvert par un vrai lecteur Excel.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COLONNES_RDV,
  classeurRendezVous,
  dateRendezVousPris,
  etatAnnulation,
  rendezVousPlaces,
} from "../src/lib/exporters.js";
import { readXlsx } from "../src/lib/xlsx.js";
import { emptyCall, emptyProspect } from "../src/lib/model.js";
import { creeTraducteur } from "../src/lib/i18n.js";
import { today, ajouteJours } from "../src/lib/dates.js";

const hier = ajouteJours(today(), -1);
const dansUnMois = ajouteJours(today(), 30);

function jeuDAppels() {
  return [
    {
      ...emptyCall(),
      id: "urgent",
      prospectId: "p1",
      dentiste: "BOURDON, SANDY",
      telephone: "+32 69 64 14 60",
      province: "Hainaut",
      dateAppel: "2026-09-01",
      heureAppel: "10:24",
      rdvPossible: "oui",
      datePremierRdv: "2026-11-12",
      supplementPremierRdv: "avec supplément",
      prix: "45",
      rdvSansSupplement: "oui",
      dateSansSupplement: "2027-01-15",
      remarques: "secrétariat pressé",
      annulation: { prevueLe: hier, faiteLe: "", parCabinet: false },
    },
    {
      ...emptyCall(),
      id: "plus-tard",
      dentiste: "MARTIN, ALEX",
      dateAppel: "2026-09-02",
      rdvPossible: "oui",
      datePremierRdv: "2026-12-01",
      supplementPremierRdv: "sans supplément",
      annulation: { prevueLe: dansUnMois, faiteLe: "", parCabinet: false },
    },
    {
      ...emptyCall(),
      id: "deja-annule",
      dentiste: "DUPONT, CLAIRE",
      roleY: true,
      dateAppel: "2026-09-01",
      rdvPossible: "oui",
      datePremierRdv: "2026-09-30",
      annulation: { prevueLe: "2026-09-07", faiteLe: "2026-09-09", parCabinet: true },
    },
    // un refus : il n'y a pas de rendez-vous à annuler
    { ...emptyCall(), id: "refus", dentiste: "SANS, RENDEZVOUS", rdvPossible: "non", raison: "retraite" },
    // un appel encore vide
    { ...emptyCall(), id: "vide", dentiste: "PAS, ENCODE" },
  ];
}

const fiches = [emptyProspect({ id: "p1", commune: "Péruwelz", cp: "7608", province: "Hainaut" })];

test("seuls les rendez-vous réellement placés sont repris", () => {
  const lignes = rendezVousPlaces(jeuDAppels(), fiches);
  assert.equal(lignes.length, 3, "le refus et l'appel vide sont écartés");
  assert.ok(!lignes.some((l) => l.dentiste === "SANS, RENDEZVOUS"));
});

test("l'ordre met en tête ce qui reste à annuler, du plus urgent au plus lointain", () => {
  const lignes = rendezVousPlaces(jeuDAppels(), fiches);
  assert.deepEqual(
    lignes.map((l) => l.dentiste),
    ["BOURDON, SANDY", "MARTIN, ALEX", "DUPONT, CLAIRE"],
    "les annulations faites passent en dernier"
  );
});

test("le rendez-vous retenu est celui qu'on a réellement pris", () => {
  // scénario B : premier rendez-vous avec supplément, mais un rendez-vous au
  // tarif officiel était possible — c'est celui-là qu'on prend
  const avecAlternative = emptyCall({
    datePremierRdv: "2026-11-12",
    supplementPremierRdv: "avec supplément",
    rdvSansSupplement: "oui",
    dateSansSupplement: "2027-01-15",
  });
  assert.equal(dateRendezVousPris(avecAlternative), "2027-01-15");

  const simple = emptyCall({ datePremierRdv: "2026-11-12", supplementPremierRdv: "sans supplément" });
  assert.equal(dateRendezVousPris(simple), "2026-11-12");
});

test("l'état de l'annulation distingue qui a annulé", () => {
  assert.equal(etatAnnulation(emptyCall()), "a_annuler");
  assert.equal(etatAnnulation(emptyCall({ annulation: { prevueLe: "", faiteLe: "2026-09-09", parCabinet: false } })), "annule");
  assert.equal(
    etatAnnulation(emptyCall({ annulation: { prevueLe: "", faiteLe: "2026-09-09", parCabinet: true } })),
    "annule_cabinet"
  );
});

test("la commune vient de la fiche du praticien", () => {
  const lignes = rendezVousPlaces(jeuDAppels(), fiches);
  assert.equal(lignes[0].commune, "Péruwelz");
  assert.equal(lignes[1].commune, "", "pas de fiche liée : la colonne reste vide plutôt qu'inventée");
});

test("le classeur s'ouvre et se lit", async () => {
  const blob = await classeurRendezVous(jeuDAppels(), fiches, creeTraducteur("fr"));
  const octets = Buffer.from(await blob.arrayBuffer());
  const { sheets } = await readXlsx(octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength));
  const rows = sheets[0].rows;

  assert.equal(sheets[0].name, "Rendez-vous");
  assert.deepEqual(rows[0], COLONNES_RDV.map((c) => c.titre), "une ligne de titres complète");
  assert.equal(rows.length, 4, "trois rendez-vous sous les titres");

  // les colonnes sont retrouvées par leur clé : ajouter une colonne au classeur
  // ne doit pas obliger à renuméroter tout le test
  const col = (cle) => COLONNES_RDV.findIndex((c) => c.cle === cle);
  const premier = rows[1];
  assert.equal(premier[col("annulerLe")], hier, "date d'annulation : une vraie date");
  assert.equal(premier[col("statut")], "À annuler maintenant", "l'échéance dépassée est annoncée");
  assert.equal(premier[col("dentiste")], "BOURDON, SANDY");
  assert.equal(premier[col("telephone")], "+32 69 64 14 60");
  assert.equal(premier[col("rdvLe")], "2027-01-15", "le rendez-vous réellement pris");
  assert.equal(premier[col("tarif")], "avec supplément");
  assert.equal(premier[col("prix")], "45", "le prix est un nombre");
  assert.equal(premier[col("commune")], "Péruwelz");
  assert.equal(premier[col("appelLe")], "2026-09-01");
  assert.equal(premier[col("heureAppel")], "10:24");
  assert.equal(premier[col("remarques")], "secrétariat pressé");

  assert.equal(rows[2][col("statut")], "À annuler", "échéance encore lointaine");
  assert.equal(rows[3][col("statut")], "Annulé par le cabinet le 09/09/2026");
  assert.match(rows[3][col("dentiste")], /dentiste Y/, "le dentiste Y reste identifiable");
});

test("le classeur suit la langue de l'application", async () => {
  const blob = await classeurRendezVous(jeuDAppels(), fiches, creeTraducteur("nl"));
  const octets = Buffer.from(await blob.arrayBuffer());
  const { sheets } = await readXlsx(octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength));
  const col = (cle) => COLONNES_RDV.findIndex((c) => c.cle === cle);
  assert.equal(sheets[0].rows[0][col("annulerLe")], "Te annuleren vanaf");
  assert.equal(sheets[0].rows[1][col("statut")], "Nu te annuleren");
  assert.equal(sheets[0].rows[1][col("tarif")], "met supplement", "les valeurs sont traduites à l'affichage…");

  // …mais le fichier de Test-Achats, lui, n'a pas bougé
  const { ligneTexte } = await import("../src/lib/exporters.js");
  assert.equal(ligneTexte(jeuDAppels()[0])[12], "avec supplément");
});

test("aucun rendez-vous : un classeur avec ses seuls titres", async () => {
  const blob = await classeurRendezVous([], [], creeTraducteur("fr"));
  const octets = Buffer.from(await blob.arrayBuffer());
  const { sheets } = await readXlsx(octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength));
  assert.equal(sheets[0].rows.length, 1);
});
