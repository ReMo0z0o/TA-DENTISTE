// Le code de reprise voyage à la main : d'un onglet à l'autre, par un
// messager, une note, une fenêtre de discussion. Il en revient rarement
// intact. Ce que l'application doit savoir faire : le réparer quand c'est
// possible, et dire précisément ce qui manque quand ça ne l'est pas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lisCodeDeReprise, ressembleAUnCode } from "../src/lib/reprise.js";
import { codeDeReprise, sauvegarde } from "../src/lib/exporters.js";
import { fusionneSauvegarde, etatVide } from "../src/lib/storage.js";

const NBSP = "\u00a0";

/** Une sauvegarde de la forme de celles que produit l'application. */
function etatDeTravail() {
  return {
    reglages: { province: "Hainaut", statut: "conventionné", profil: "standard", afficherTout: false, langue: "fr" },
    prospects: [
      { id: "p1", nom: "BOURDON, SANDY", telephone: "+32 69 64 14 60", commune: "Péruwelz", cp: "7608", province: "Hainaut", statut: "conventionné", etat: "fait" },
      { id: "p2", nom: "MARTIN, ALEX", telephone: "+32 71 11 22 33", commune: "Charleroi", cp: "6000", province: "Hainaut", statut: "conventionné", etat: "rappeler" },
    ],
    // le dentiste Y d'un cabinet de groupe : pas de fiche à lui, mais un appel
    calls: [
      { id: "cmtjtwzexdkgly", prospectId: "p1", dentiste: "BOURDON, SANDY", telephone: "+32 69 64 14 60", dateAppel: "2026-09-01", heureAppel: "10:24", rdvPossible: "oui", etatFiche: "fait" },
      { id: "cmtjy4aa8i67xs", prospectId: null, roleY: true, groupeDe: "cmtjtwzexdkgly", dentiste: "Varga", telephone: "+32 69 64 14 60", dateAppel: "2026-09-01" },
    ],
    suivi: { controlesRegistre: [] },
  };
}

const CODE = codeDeReprise(etatDeTravail());

test("le code de reprise tient sur une seule ligne", () => {
  assert.ok(!CODE.includes("\n"), "aucun retour à la ligne : rien à recouper au collage");
  assert.ok(CODE.length < sauvegarde(etatDeTravail()).length, "plus court que le fichier .json indenté");
  assert.deepEqual(lisCodeDeReprise(CODE).data.calls.length, 2);
});

test("un code intact se relit tel quel", () => {
  const lu = lisCodeDeReprise(CODE);
  assert.equal(lu.erreur, undefined);
  assert.equal(lu.data.prospects.length, 2);
  assert.equal(lu.data.calls[1].groupeDe, "cmtjtwzexdkgly");
});

test("les espaces insécables glissés par un messager sont réparés", () => {
  // ce que fait un traitement de texte : remplacer les espaces de mise en page
  // du .json indenté, celui-là même que l'utilisateur avait sous les yeux
  const abime = sauvegarde(etatDeTravail()).replace(/^ +/gm, (m) => NBSP.repeat(m.length));
  assert.throws(() => JSON.parse(abime), "sans réparation, ce code est refusé");
  const lu = lisCodeDeReprise(abime);
  assert.equal(lu.erreur, undefined);
  assert.equal(lu.data.calls.length, 2);
});

test("un espace insécable à l'intérieur d'un numéro de téléphone est conservé", () => {
  const avecNbsp = codeDeReprise({
    ...etatDeTravail(),
    prospects: [{ id: "p1", nom: "BOURDON, SANDY", telephone: "069" + NBSP + "64" + NBSP + "14" + NBSP + "60" }],
  });
  const lu = lisCodeDeReprise(avecNbsp.replace(/,"/g, "," + NBSP + '"'));
  assert.equal(lu.erreur, undefined);
  assert.equal(lu.data.prospects[0].telephone, "069" + NBSP + "64" + NBSP + "14" + NBSP + "60", "la donnée n'est pas retouchée");
});

test("les clôtures de bloc de code et la phrase d'accompagnement sont écartées", () => {
  const lu = lisCodeDeReprise("Voici mon code :\n```json\n" + CODE + "\n```\nMerci !");
  assert.equal(lu.erreur, undefined);
  assert.equal(lu.data.prospects.length, 2);
});

test("les guillemets typographiques sont redressés", () => {
  const abime = CODE.replace(/"app"/, "“app”");
  assert.throws(() => JSON.parse(abime));
  assert.equal(lisCodeDeReprise(abime).data.app, "ta-dentiste");
});

test("un code coupé en route le dit, et dit combien de caractères sont arrivés", () => {
  const coupe = CODE.slice(0, Math.floor(CODE.length / 2)); // le collage s'est arrêté en route
  const lu = lisCodeDeReprise(coupe);
  assert.equal(lu.data, undefined);
  assert.match(lu.erreur, /incomplet/);
  assert.equal(lu.valeurs.n, coupe.length, "le compte permet de comparer les deux appareils");
});

test("un texte qui n'est pas un code est renvoyé avec la bonne explication", () => {
  assert.match(lisCodeDeReprise("BOURDON, SANDY\t+32 69 64 14 60").erreur, /pas un code de reprise/);
  assert.match(lisCodeDeReprise("   ").erreur, /Rien à charger/);
});

test("un code complet mais abîmé au-delà du réparable reste refusé plutôt qu'inventé", () => {
  const lu = lisCodeDeReprise('{"app":"ta-dentiste","calls":[{"id":}]}');
  assert.equal(lu.data, undefined);
  assert.match(lu.erreur, /illisible/);
});

test("une liste de praticiens collée n'est jamais prise pour un code de reprise", () => {
  assert.equal(ressembleAUnCode("1\tBOURDON, SANDY\t303016-12\t+32 69 64 14 60"), false);
  assert.equal(ressembleAUnCode(CODE), true);
  assert.equal(ressembleAUnCode("```json\n" + CODE + "\n```"), true);
});

test("un code réparé rend exactement le même travail qu'au départ", () => {
  const depart = etatDeTravail();
  const abime = "```\n" + codeDeReprise(depart).replace(/": /g, '":' + NBSP) + "\n```";
  const { data } = lisCodeDeReprise(abime);
  const arrivee = fusionneSauvegarde(etatVide(), data, true);

  assert.equal(arrivee.prospects.length, 2);
  assert.equal(arrivee.calls.length, 2);
  assert.equal(arrivee.prospects[0].nom, "BOURDON, SANDY");
  assert.equal(arrivee.prospects[1].etat, "rappeler", "l'état de suivi de la fiche suit");
  assert.equal(arrivee.calls[1].roleY, true, "le dentiste Y du cabinet de groupe suit aussi");
  assert.equal(arrivee.reglages.province, "Hainaut");
});

test("une sauvegarde d'une version antérieure repart avec tous ses champs", () => {
  // fiches sans « origine » ni « note » : ce que produisaient les versions
  // précédentes, et ce que l'utilisateur a encore sur son autre appareil
  const ancienne = { prospects: [{ id: "p1", nom: "BOURDON, SANDY", telephone: "069641460", etat: "fait" }], calls: [] };
  const etat = fusionneSauvegarde(etatVide(), ancienne, true);
  assert.equal(etat.prospects[0].origine, "liste", "la fiche compte de nouveau dans le quota de la mission");
  assert.equal(etat.prospects[0].note, "");
  assert.equal(etat.prospects[0].etat, "fait", "sans écraser ce qui était déjà là");
});
