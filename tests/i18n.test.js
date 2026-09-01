// Deux garanties : aucune traduction ne manque, et changer de langue ne change
// jamais ce qui part dans le fichier Excel.
import { test } from "node:test";
import assert from "node:assert/strict";
import { toutesLesCles } from "./cles-i18n.mjs";
import { DICTIONNAIRES } from "../src/lib/traductions.js";
import { creeTraducteur, CODES_LANGUE, LANGUES } from "../src/lib/i18n.js";
import { scenario, lienRegistre } from "../src/lib/scenario.js";
import { dateLongue } from "../src/lib/dates.js";
import { emptyCall, STATUTS } from "../src/lib/model.js";
import { applique } from "../src/lib/regles.js";
import { ligneTexte, tsv, csv } from "../src/lib/exporters.js";

const CLES = toutesLesCles();

for (const langue of ["nl", "en"]) {
  test(`aucune traduction manquante en ${langue}`, () => {
    const dico = DICTIONNAIRES[langue];
    const manquantes = CLES.filter((cle) => !(cle in dico));
    assert.deepEqual(manquantes, [], `${manquantes.length} clé(s) sans traduction ${langue}`);
  });

  test(`aucune traduction ${langue} inutilisée`, () => {
    const connues = new Set(CLES);
    const orphelines = Object.keys(DICTIONNAIRES[langue]).filter((cle) => !connues.has(cle));
    assert.deepEqual(orphelines, [], `${orphelines.length} traduction(s) ${langue} sans emploi`);
  });

  test(`les variables sont conservées en ${langue}`, () => {
    const dico = DICTIONNAIRES[langue];
    for (const [cle, valeur] of Object.entries(dico)) {
      const attendues = [...cle.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      const trouvees = [...valeur.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      assert.deepEqual(trouvees, attendues, `variables différentes pour « ${cle} »`);
    }
  });
}

test("le français passe tel quel", () => {
  const t = creeTraducteur("fr");
  assert.equal(t("Enregistrer et passer au suivant"), "Enregistrer et passer au suivant");
  assert.equal(t.valeur("conventionné"), "conventionné");
});

test("une clé inconnue retombe sur le français", () => {
  const t = creeTraducteur("nl");
  assert.equal(t("Texte jamais traduit"), "Texte jamais traduit");
});

test("les variables sont remplacées", () => {
  const t = creeTraducteur("en");
  assert.equal(t("{n} restants", { n: 7 }), "7 left");
  assert.equal(t.n(1, "{n} appel", "{n} appels"), "1 call");
  assert.equal(t.n(3, "{n} appel", "{n} appels"), "3 calls");
});

test("le pluriel suit la règle de chaque langue", () => {
  // en français, 0 reste au singulier ; en néerlandais et en anglais, non
  assert.equal(creeTraducteur("fr").n(0, "{n} appel", "{n} appels"), "0 appel");
  assert.equal(creeTraducteur("nl").n(0, "{n} appel", "{n} appels"), "0 oproepen");
  assert.equal(creeTraducteur("en").n(0, "{n} appel", "{n} appels"), "0 calls");
});

test("l'affichage est traduit mais la valeur stockée reste française", () => {
  const nl = creeTraducteur("nl");
  assert.equal(nl.valeur("oui"), "ja");
  assert.equal(nl.valeur("conventionné"), "geconventioneerd");
  assert.equal(nl.valeur("avec supplément"), "met supplement");

  // ce qui compte : la donnée elle-même n'a pas bougé
  let call = emptyCall({ dentiste: "Test", statut: STATUTS[0], rdvPossible: "oui" });
  call = applique(call, "supplementPremierRdv", "sans supplément");
  assert.equal(call.statut, "conventionné");
  assert.equal(call.rdvSansSupplement, "oui");
});

test("l'export reste en français quelle que soit la langue affichée", () => {
  const call = emptyCall({
    dentiste: "BOURDON, SANDY",
    statut: "partiellement conventionné",
    dateAppel: "2026-09-01",
    rdvPossible: "oui",
    supplementPremierRdv: "avec supplément",
    hygieniste: "non",
  });
  const ligne = ligneTexte(call);
  assert.equal(ligne[2], "partiellement conventionné");
  assert.equal(ligne[7], "oui");
  assert.equal(ligne[12], "avec supplément");
  assert.equal(ligne[19], "non");

  // les fonctions d'export ne reçoivent aucune langue : impossible de les traduire
  assert.equal(ligneTexte.length, 1);
  assert.ok(tsv([call]).includes("partiellement conventionné"));
  assert.ok(csv([call]).includes("avec supplément"));
});

test("le scénario existe dans les trois langues", () => {
  for (const code of CODES_LANGUE) {
    const s = scenario(code);
    assert.ok(s.ouverture.length > 20, `ouverture manquante en ${code}`);
    assert.equal(s.reponses.length, 7);
    assert.equal(s.scenarios.length, 3);
    assert.equal(s.consignes.length, 9);
    assert.ok(lienRegistre(code).startsWith("https://"));
  }
  assert.notEqual(scenario("nl").ouverture, scenario("fr").ouverture);
  assert.notEqual(scenario("en").ouverture, scenario("fr").ouverture);
});

test("les dates longues suivent la langue", () => {
  assert.equal(dateLongue("2026-09-07", "fr"), "lundi 7 septembre 2026");
  assert.equal(dateLongue("2026-09-07", "nl"), "maandag 7 september 2026");
  assert.equal(dateLongue("2026-09-07", "en"), "Monday 7 September 2026");
  assert.equal(dateLongue("2026-09-07"), "lundi 7 septembre 2026");
});

test("trois langues proposées", () => {
  assert.deepEqual(LANGUES.map((l) => l.code), ["fr", "nl", "en"]);
});
