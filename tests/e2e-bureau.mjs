// Parcours au bureau : barre latérale, tableaux, clavier, glisser-déposer.
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { jeu } from "./fixtures.mjs";
import { readXlsx } from "../src/lib/xlsx.js";

const PORT = 5198;
const RACINE = path.resolve("docs");
const SORTIES = path.resolve("tests/sorties");
if (!jeu) {
  console.error("Aucun jeu de fichiers : lance d'abord `node tests/fixtures/generer.mjs`.");
  process.exit(1);
}
const A = jeu.attendu;
fs.mkdirSync(SORTIES, { recursive: true });

const TYPES = { ".html": "text/html", ".png": "image/png", ".js": "text/javascript", ".webmanifest": "application/json" };
const serveur = http.createServer((req, res) => {
  const fichier = path.join(RACINE, req.url === "/" ? "index.html" : decodeURIComponent(req.url.split("?")[0]));
  if (!fichier.startsWith(RACINE) || !fs.existsSync(fichier)) {
    res.writeHead(404).end("non trouvé");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(fichier)] || "application/octet-stream" });
  res.end(fs.readFileSync(fichier));
});

const erreurs = [];
let echecs = 0;
function verifie(nom, condition, detail = "") {
  if (condition) console.log(`  ok   ${nom}`);
  else {
    echecs++;
    console.log(`  ÉCHEC ${nom} ${detail}`);
  }
}

await new Promise((r) => serveur.listen(PORT, r));
const navigateur = await chromium.launch({
  executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});
const page = await (
  await navigateur.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, locale: "fr-BE" })
).newPage();
page.on("pageerror", (e) => erreurs.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") erreurs.push(m.text());
});

await page.goto(`http://localhost:${PORT}/`);
await page.waitForSelector("aside h1");

console.log(`\nJeu de fichiers : ${jeu.nom}`);
console.log("\n1. Mise en page bureau");
verifie("barre latérale affichée", await page.isVisible("aside nav"));
verifie("barre du bas masquée", !(await page.isVisible('[data-role="onglets-mobile"]')));
verifie("raccourcis annoncés dans la barre latérale", (await page.textContent("aside")).includes("alt+1"));

console.log("\n2. Import par la zone de dépôt");
await page.setInputFiles('input[accept*=".xlsx"]', jeu.liste);
await page.waitForSelector("text=Vérifier avant d'importer");
verifie("vérification en fenêtre dédiée", await page.isVisible("thead select"));

// le statut Inami de la liste : trois choix en clair, et un avertissement
// tant qu'aucun n'est fait (c'est une colonne obligatoire du fichier)
const choixStatut = '[role="group"][aria-label="Statut Inami de cette liste"]';
verifie(
  "les trois statuts sont proposés au chargement",
  (await page.$$eval(`${choixStatut} button`, (els) => els.map((e) => e.textContent.trim()))).join(" | ") ===
    "conventionné | partiellement conventionné | non conventionné",
  await page.textContent(choixStatut)
);
verifie("l'absence de statut est signalée", await page.isVisible("text=Sans statut, cette colonne obligatoire"));
await page.click(`${choixStatut} >> button:text-is("non conventionné")`);
await page.waitForTimeout(200);
verifie("l'avertissement disparaît une fois le statut choisi", !(await page.isVisible("text=Sans statut, cette colonne obligatoire")));

await page.click(`button:has-text("Importer ${A.praticiens} praticien")`);
await page.waitForSelector("table");

// la sauvegarde est différée : on attend qu'elle ait eu lieu plutôt que de
// courser le minuteur
await page.waitForFunction(
  () => (JSON.parse(localStorage.getItem("ta-dentiste:v1") || "{}").prospects || []).length > 0,
  null,
  { timeout: 5000 }
);
const statutsImportes = await page.evaluate(() => {
  const e = JSON.parse(localStorage.getItem("ta-dentiste:v1") || "{}");
  return [...new Set((e.prospects || []).map((p) => p.statut))];
});
verifie(
  "le statut choisi couvre toute la liste",
  statutsImportes.length === 1 && statutsImportes[0] === "non conventionné",
  JSON.stringify(statutsImportes)
);

console.log("\n3. Liste en tableau");
const lignes = await page.$$eval("tbody tr", (els) => els.length);
verifie(`${A.praticiens} lignes dans le tableau`, lignes === A.praticiens, String(lignes));
verifie("cartes tactiles masquées au bureau", !(await page.isVisible("ul > li")));
const premiere = await page.textContent("tbody tr");
verifie("commune et téléphone visibles d'un coup d'œil", premiere.includes(A.premierTel), premiere.replace(/\s+/g, " ").slice(0, 90));
verifie("état modifiable directement dans la ligne", await page.isVisible("tbody tr select"));
await page.screenshot({ path: path.join(SORTIES, "pc-liste.png") });

console.log("\n4. Clavier");
await page.keyboard.press("/");
verifie(
  "« / » place le curseur dans la recherche",
  await page.evaluate(() => document.activeElement?.placeholder?.startsWith("Chercher"))
);
await page.keyboard.type("mons");
await page.waitForTimeout(150);
const filtrees = await page.$$eval("tbody tr", (els) => els.length);
verifie("la recherche filtre le tableau", filtrees > 0 && filtrees < A.praticiens, String(filtrees));
await page.fill("input[placeholder^='Chercher']", "");

await page.keyboard.press("Alt+2");
await page.waitForTimeout(200);
verifie("alt+2 ouvre le formulaire d'appel", await page.isVisible("text=Prochain praticien à appeler"));
await page.click("button:has-text('Ouvrir sa fiche')");
await page.waitForTimeout(200);
verifie("fiche pré-remplie depuis la liste", (await page.textContent("section")).includes(A.premierNom));

console.log("\n5. Encodage au clavier");
await page.click("button:text-is('conventionné')");
await page.click("h2:has-text('Résultat de l\\'appel') >> xpath=../.. >> button:text-is('oui')");
await page.fill('input[type="date"] >> nth=1', "2026-11-12");
await page.click("button:text-is('sans supplément')");
// flèches puis espace : répondre sans quitter le clavier
// le cabinet demande le numéro de registre national : c'est ce qui déclenche
// le rappel avec l'autre profil, et donc le marquage dans les rendez-vous
await page.click(
  '[role="group"][aria-label="Le dentiste a demandé votre numéro de registre national ?"] >> button:text-is("oui")'
);
await page.waitForTimeout(150);
await page.focus("h2:has-text('Hygiéniste') >> xpath=../.. >> button:text-is('oui')");
await page.keyboard.press("ArrowRight");
await page.keyboard.press(" ");
await page.waitForTimeout(150);
const hygieniste = await page.getAttribute("h2:has-text('Hygiéniste') >> xpath=../.. >> button:text-is('non')", "aria-pressed");
verifie("les flèches déplacent la réponse, l'espace la valide", hygieniste === "true", String(hygieniste));
await page.screenshot({ path: path.join(SORTIES, "pc-appel.png") });

await page.keyboard.press("Control+Enter");
await page.waitForTimeout(400);
verifie("Ctrl+Entrée enregistre et enchaîne", (await page.textContent("body")).includes("Au suivant"));

console.log("\n6. Suite à donner depuis la fiche");
// on est sur la fiche du deuxième praticien : personne ne décroche
const nomSuivant = A.deuxiemeNom;
verifie("fiche suivante ouverte", (await page.textContent("section >> nth=0")).includes(nomSuivant), nomSuivant);
verifie("« Fait » proposé par défaut", (await page.getAttribute("h2:has-text('Suite à donner') >> xpath=../.. >> button:text-is('Fait')", "aria-pressed")) === "true");

await page.click("h2:has-text('Suite à donner') >> xpath=../.. >> button:text-is('Injoignable')");
await page.waitForTimeout(200);
verifie("l'application prévient qu'aucune ligne ne partira", await page.isVisible("text=aucune ligne ne partira dans le fichier Excel"));
verifie("le bouton annonce ce qu'il va faire", await page.isVisible('button:has-text("Marquer « Injoignable » et passer au suivant")'));

await page.click('button:has-text("Marquer « Injoignable »")');
await page.waitForTimeout(400);
verifie("passage automatique au praticien suivant", (await page.textContent("body")).includes("Au suivant"));

await page.keyboard.press("Alt+1");
await page.waitForTimeout(300);
const ligneInjoignable = await page.textContent(`tbody tr:has-text("${nomSuivant}")`);
verifie("le praticien est marqué injoignable dans la liste", ligneInjoignable.includes("Injoignable"), ligneInjoignable.replace(/\s+/g, " ").slice(0, 80));
verifie(
  "il ne compte pas comme appelé",
  (await page.textContent("aside")).includes("1 / 25 appelés"),
  (await page.textContent("aside")).replace(/\s+/g, " ").slice(0, 60)
);

console.log("\n7. Un numéro corrigé pendant l'appel");
// le fichier de la mission se trompe souvent d'un chiffre : on corrige sur la
// fiche d'appel, et la liste doit suivre — sinon on rappelle le mauvais numéro
await page.keyboard.press("Alt+1");
await page.waitForTimeout(250);
const aCorriger = A.troisiemeNom;
await page.click(`tbody tr:has-text("${aCorriger}") button:has-text("Encoder")`);
await page.waitForTimeout(300);
await page.click("h2:has-text('Le dentiste') >> xpath=../.. >> button:has-text('Modifier')");
await page.waitForTimeout(200);
const NOUVEAU_TEL = "+32 69 77 12 34";
await page.fill("h2:has-text('Le dentiste') >> xpath=../.. >> input[inputmode='tel']", NOUVEAU_TEL);
await page.waitForTimeout(150);
await page.click("h2:has-text('Résultat de l\\'appel') >> xpath=../.. >> button:text-is('oui')");
await page.waitForTimeout(200);
await page.click('button:has-text("Enregistrer et passer")');
await page.waitForTimeout(500);

await page.keyboard.press("Alt+1");
await page.waitForTimeout(300);
const ligneCorrigee = await page.textContent(`tbody tr:has-text("${aCorriger}")`);
verifie(
  "le nouveau numéro apparaît dans la liste",
  ligneCorrigee.includes(NOUVEAU_TEL),
  ligneCorrigee.replace(/\s+/g, " ").slice(0, 110)
);

console.log("\n8. Un dentiste ajouté à la main rejoint la liste");
// « Ajouter un praticien » ouvre un formulaire vierge, délié de toute fiche :
// sans lui, taper un nom par-dessus la fiche ouverte la renommerait
await page.keyboard.press("Alt+1");
await page.waitForTimeout(300);
const avantAjout = await page.$$eval("tbody tr", (e) => e.length);
// l'appel en cours n'est pas enregistré : l'application demande confirmation
// avant de le remplacer par une fiche vierge
let confirmationVue = "";
page.once("dialog", (d) => {
  confirmationVue = d.message();
  d.accept();
});
await page.click('button:has-text("Ajouter un praticien")');
await page.waitForTimeout(400);
verifie(
  "l'appel en cours n'est pas jeté sans prévenir",
  /n'est pas enregistré/.test(confirmationVue),
  confirmationVue || "(aucune confirmation demandée)"
);
verifie(
  "le formulaire s'ouvre vierge",
  (await page.inputValue("h2:has-text('Le dentiste') >> xpath=../.. >> input >> nth=0")) === "",
  await page.inputValue("h2:has-text('Le dentiste') >> xpath=../.. >> input >> nth=0")
);
const AJOUTE = "NOUVEAU, DENTISTE";
await page.fill("h2:has-text('Le dentiste') >> xpath=../.. >> input >> nth=0", AJOUTE);
await page.fill("h2:has-text('Le dentiste') >> xpath=../.. >> input[inputmode='tel']", "+32 2 111 22 33");
await page.click("h2:has-text('Le dentiste') >> xpath=../.. >> button:text-is('conventionné')");
await page.click("h2:has-text('Résultat de l\\'appel') >> xpath=../.. >> button:text-is('oui')");
await page.waitForTimeout(200);
// bouton exact : « Enregistrer et encoder le dentiste Y » contient aussi le mot
await page.click('button:text-is("Enregistrer et passer au suivant")');
await page.waitForTimeout(600);

await page.keyboard.press("Alt+1");
await page.waitForTimeout(400);
const ligneAjoutee = await page.textContent(`tbody tr:has-text("${AJOUTE}")`).catch(() => "");
verifie("le praticien tapé à la main apparaît dans la liste", Boolean(ligneAjoutee), AJOUTE);
verifie(
  "il s'ajoute sans en remplacer un autre",
  (await page.$$eval("tbody tr", (e) => e.length)) === avantAjout + 1,
  `${await page.$$eval("tbody tr", (e) => e.length)} lignes au lieu de ${avantAjout + 1}`
);
verifie("il est signalé comme ajouté à la main", /ajouté à la main/.test(ligneAjoutee), ligneAjoutee.replace(/\s+/g, " ").slice(0, 110));
verifie("son numéro l'a suivi", ligneAjoutee.includes("+32 2 111 22 33"), ligneAjoutee.replace(/\s+/g, " ").slice(0, 110));
verifie(
  "il ne gonfle pas le quota du fichier reçu",
  (await page.textContent("aside")).includes(`/ ${A.praticiens} appelés`),
  (await page.textContent("aside")).replace(/\s+/g, " ").slice(0, 80)
);
verifie(
  "et la barre latérale l'annonce",
  (await page.textContent("aside")).includes("ajouté à la main"),
  (await page.textContent("aside")).replace(/\s+/g, " ").slice(0, 120)
);

console.log("\n9. Dentiste Y du scénario C");
await page.keyboard.press("Alt+1");
await page.waitForTimeout(250);
await page.click(`tbody tr:has-text("${A.dernierNom}") button:has-text("Encoder")`);
await page.waitForTimeout(250);
// pas de rendez-vous, mais le cabinet oriente vers un confrère
await page.click("h2:has-text('Résultat de l\\'appel') >> xpath=../.. >> button:text-is('non')");
await page.waitForTimeout(200);
// premier « oui » = rendez-vous possible, deuxième = orienté vers la même pratique
await page.click("h2:has-text('Résultat de l\\'appel') >> xpath=../.. >> button:text-is('oui') >> nth=1");
await page.waitForTimeout(200);
verifie("l'application invite à encoder le dentiste proposé", await page.isVisible("text=Un autre dentiste vous a été proposé"));

await page.click('button:has-text("Enregistrer et encoder le dentiste Y")');
await page.waitForTimeout(400);
verifie("la fiche du dentiste Y s'ouvre", await page.isVisible("text=Scénario C — dentiste Y"));
await page.click("h2:has-text('Le dentiste') >> xpath=../.. >> button:has-text('Modifier')");
await page.waitForTimeout(200);
await page.fill("h2:has-text('Le dentiste') >> xpath=../.. >> input[type='text'] >> nth=0", "DUPONT, CLAIRE");
await page.click("h2:has-text('Résultat de l\\'appel') >> xpath=../.. >> button:text-is('oui')");
await page.fill('input[type="date"] >> nth=1', "2026-09-30");
await page.click("h2:has-text('Hygiéniste') >> xpath=../.. >> button:text-is('non')");
await page.keyboard.press("Control+Enter");
await page.waitForTimeout(500);

await page.keyboard.press("Alt+1");
await page.waitForTimeout(300);
const ligneY = await page.textContent('tbody tr:has-text("DUPONT, CLAIRE")');
verifie("le dentiste Y apparaît dans la liste", Boolean(ligneY), String(ligneY).replace(/\s+/g, " ").slice(0, 90));
verifie("il porte la marque « dentiste Y »", ligneY.includes("dentiste Y"), ligneY.replace(/\s+/g, " ").slice(0, 90));
verifie("on voit qui l'a proposé", ligneY.includes(A.dernierNom), ligneY.replace(/\s+/g, " ").slice(0, 120));

const ordreListe = await page.$$eval("tbody tr", (els) => els.map((tr) => tr.textContent));
const posX = ordreListe.findIndex((l) => l.includes(A.dernierNom) && !l.includes("DUPONT"));
const posY = ordreListe.findIndex((l) => l.includes("DUPONT, CLAIRE"));
verifie("il est placé juste après le dentiste X", posY === posX + 1, `X=${posX} Y=${posY}`);

verifie(
  "il ne gonfle pas le quota de la mission",
  (await page.textContent("aside")).includes(`/ ${A.praticiens} appelés`),
  (await page.textContent("aside")).replace(/\s+/g, " ").slice(0, 60)
);
verifie("la barre latérale annonce l'ajout", (await page.textContent("aside")).includes("dentiste Y ajouté"));

await page.click('button:has-text("dentiste Y")  >> nth=0');
await page.waitForTimeout(300);
const filtres2 = await page.$$eval("tbody tr", (els) => els.length);
verifie("le filtre « dentiste Y » les isole", filtres2 === 1, `${filtres2} ligne(s)`);
await page.screenshot({ path: path.join(SORTIES, "pc-dentiste-y.png") });
await page.click("button:text-is('Tous') >> nth=0");
await page.waitForTimeout(250);

console.log("\n10. Copier des lignes Excel depuis la liste");
await page.keyboard.press("Alt+1");
await page.waitForTimeout(300);
await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
// l'injoignable n'a laissé aucun appel : rien à copier, donc pas de bouton
verifie(
  "pas de bouton pour un praticien sans appel encodé",
  (await page.locator(`tbody tr:has-text("${nomSuivant}") button[data-role="copier-ligne"]`).count()) === 0,
  nomSuivant
);
await page.click(`tbody tr:has-text("${A.premierNom}") button[data-role="copier-ligne"]`);
await page.waitForTimeout(400);
const ligneCopiee = await page.evaluate(() => navigator.clipboard.readText());
const cellules = ligneCopiee.split("\t");
verifie("une seule ligne est copiée", !ligneCopiee.includes("\n"), JSON.stringify(ligneCopiee.slice(0, 60)));
verifie("les 23 colonnes y sont", cellules.length === 23, `${cellules.length} colonnes`);
verifie("c'est bien ce dentiste-là", cellules[1] === A.premierNom, cellules[1]);
verifie("la province ouvre la ligne", cellules[0] === A.province, cellules[0]);
verifie("le téléphone est repris", cellules[4] === A.premierTel, cellules[4]);
verifie("les dates sont au format du fichier", /^\d{2}\/\d{2}\/\d{4}$/.test(cellules[3]), cellules[3]);
verifie("l'application confirme ce qui a été copié", await page.isVisible(`text=Ligne de ${A.premierNom} copiée`));

// copier toute la sélection : ce que le filtre laisse voir, encodé ou non
const boutonSelection = 'button[data-role="copier-selection"]';
await page.click("button:text-is('Tous') >> nth=0");
await page.waitForTimeout(250);
await page.click(boutonSelection);
await page.waitForTimeout(400);
const tout = (await page.evaluate(() => navigator.clipboard.readText())).split("\n");
// le fichier reçu, plus le dentiste Y du scénario C, plus celui tapé à la main
verifie(
  "« Tous » copie toute la liste, ajouts compris",
  tout.length === A.praticiens + 2,
  `${tout.length} lignes pour ${A.praticiens} praticiens + 1 dentiste Y + 1 ajouté`
);
verifie("chaque ligne a ses 23 colonnes", tout.every((l) => l.split("\t").length === 23));
// une ligne sans date d'appel = un praticien pas encore appelé : il doit tout
// de même porter son identité, prêt à être complété dans Excel
const nonAppelees = tout.map((l) => l.split("\t")).filter((c) => c[3] === "");
// cinq appels encodés jusqu'ici : le premier praticien, le numéro corrigé,
// celui ajouté à la main, le dentiste X du scénario C et son dentiste Y
verifie(
  "les praticiens pas encore appelés sont du lot",
  nonAppelees.length > 0 && nonAppelees.length === tout.length - 5,
  `${nonAppelees.length} non appelés sur ${tout.length}`
);
const nue = nonAppelees[0];
verifie(
  "une fiche nue garde province, nom, statut et téléphone",
  nue[0] === A.province && nue[1].length > 0 && nue[2].length > 0 && /\d/.test(nue[4]),
  JSON.stringify(nue.slice(0, 5))
);
verifie("et rien d'inventé au-delà", nue.slice(5).every((v) => v === ""), JSON.stringify(nue.slice(5, 10)));

await page.click("button:has-text('Injoignable') >> nth=0");
await page.waitForTimeout(300);
await page.click(boutonSelection);
await page.waitForTimeout(400);
const injoignables = (await page.evaluate(() => navigator.clipboard.readText())).split("\n");
verifie(
  "« Injoignable » ne copie que les injoignables",
  injoignables.length === 1 && injoignables[0].split("\t")[1] === nomSuivant,
  `${injoignables.length} ligne(s) : ${injoignables[0]?.split("\t")[1]}`
);

// la recherche restreint aussi ce qui est copié
await page.click("button:text-is('Tous') >> nth=0");
await page.waitForTimeout(200);
await page.fill("input[placeholder^='Chercher']", A.premierNom.split(",")[0]);
await page.waitForTimeout(300);
const annonce = await page.textContent(boutonSelection);
await page.click(boutonSelection);
await page.waitForTimeout(400);
const cherche = (await page.evaluate(() => navigator.clipboard.readText())).split("\n");
verifie(
  "la recherche restreint aussi la copie",
  cherche.length >= 1 && cherche.every((l) => l.split("\t")[1].includes(A.premierNom.split(",")[0])),
  `${cherche.length} ligne(s) · bouton : ${annonce.trim()}`
);
await page.fill("input[placeholder^='Chercher']", "");
await page.waitForTimeout(200);

console.log("\n11. Journée en tableau");
await page.keyboard.press("Alt+3");
await page.waitForTimeout(250);
const appelsEncodes = await page.$$eval("tbody tr", (els) => els.filter((tr) => tr.querySelectorAll("td").length > 1).length);
// encodés jusqu'ici : le premier praticien, le numéro corrigé, celui ajouté à
// la main, le dentiste X du scénario C et son dentiste Y — l'injoignable, lui,
// n'a rien laissé
verifie("cinq appels encodés", appelsEncodes === 5, `${appelsEncodes} ligne(s)`);
verifie(
  "aucune ligne créée pour l'injoignable",
  !(await page.textContent("table")).includes(nomSuivant),
  nomSuivant
);
const ligneJournee = await page.textContent(`tbody tr:has-text("${A.premierNom}")`);
verifie("heure de l'appel dans le tableau", /\d{2}:\d{2}/.test(ligneJournee), ligneJournee.replace(/\s+/g, " ").slice(0, 90));
verifie("date du rendez-vous dans le tableau", ligneJournee.includes("12/11/2026"), ligneJournee.replace(/\s+/g, " ").slice(0, 120));
await page.screenshot({ path: path.join(SORTIES, "pc-journee.png") });

console.log("\n12. Suivi et données sur deux colonnes");
await page.keyboard.press("Alt+4");
await page.waitForTimeout(250);
const colonnesSuivi = await page.$eval("main, div.lg\\:grid", () => {
  const grille = document.querySelector("div.lg\\:grid");
  return grille ? getComputedStyle(grille).gridTemplateColumns.split(" ").length : 0;
});
verifie("le suivi se répartit sur deux colonnes", colonnesSuivi === 2, String(colonnesSuivi));

// les trois rubriques, dans l'ordre : le profil habituel d'abord
const rubriques = await page.$$eval("section h2", (els) => els.map((e) => e.textContent.trim()));
const rangHabituel = rubriques.indexOf("Rappels — profil habituel");
const rangMajoree = rubriques.indexOf("Rappels avec le profil « intervention majorée »");
const rangRdv = rubriques.indexOf("Rendez-vous à annuler");
verifie(
  "les rubriques suivent l'ordre du travail : rappels habituels, autre profil, annulations",
  rangHabituel === 0 && rangHabituel < rangMajoree && rangMajoree < rangRdv,
  rubriques.join(" | ")
);
verifie(
  "le cabinet rappelé avec l'autre profil est listé",
  (await page.textContent("section:has(h2:text-is('Rappels avec le profil « intervention majorée »'))")).includes(A.premierNom),
  A.premierNom
);

// un praticien marqué « À rappeler » dans la liste doit se retrouver ici
await page.keyboard.press("Alt+1");
await page.waitForTimeout(250);
await page.selectOption(`tbody tr:has-text("${A.troisiemeNom}") select`, { label: "À rappeler" });
await page.waitForTimeout(300);
await page.keyboard.press("Alt+4");
await page.waitForTimeout(300);
verifie(
  "un praticien « À rappeler » apparaît dans la rubrique habituelle",
  (await page.textContent("section:has(h2:text-is('Rappels — profil habituel'))")).includes(A.troisiemeNom),
  A.troisiemeNom
);

// les rendez-vous : tous affichés, détaillés, l'intervention majorée marquée
// au bureau la liste est un tableau ; les cartes du téléphone sont masquées
const cartesRdv = await page.$$eval('[data-role="rendez-vous"]:visible', (els) =>
  els.map((e) => e.innerText.replace(/\s+/g, " "))
);
verifie("tous les rendez-vous placés sont affichés", cartesRdv.length === 2, `${cartesRdv.length} ligne(s)`);
const carteX = cartesRdv.find((c) => c.includes(A.premierNom));
verifie(
  "le rendez-vous porte la date d'appel",
  (carteX?.match(/\d{2}\/\d{2}\/\d{4}/g) || []).length >= 3,
  carteX?.slice(0, 160)
);
verifie("le rendez-vous porte la date du rendez-vous", carteX?.includes("12/11/2026"), carteX?.slice(0, 140));
verifie("le rendez-vous porte le numéro de téléphone", carteX?.includes(A.premierTel), carteX?.slice(0, 160));
verifie(
  "le cabinet à rappeler avec l'autre profil est signalé",
  carteX?.includes("intervention majorée"),
  carteX?.slice(0, 160)
);

// le classement : par défaut l'urgence d'annulation, au choix la date du
// rendez-vous pour traiter d'abord ceux qui approchent
const nomsRdv = async () =>
  page.$$eval('[data-role="rendez-vous"]:visible', (els) =>
    els.map((e) => e.querySelector("td, div")?.textContent.trim().split("\n")[0] || "")
  );
const datesRdv = async () =>
  page.$$eval('[data-role="rendez-vous"]:visible', (els) =>
    els.map((e) => (e.textContent.match(/(\d{2})\/(\d{2})\/(\d{4})/g) || [])[0] || "")
  );
verifie("le classement se choisit", await page.isVisible('[data-role="tri-rdv"]'));
await page.selectOption('[data-role="tri-rdv"]', "rdv");
await page.waitForTimeout(300);
const parDate = (await datesRdv()).map((d) => d.split("/").reverse().join("-"));
verifie(
  "classés par date de rendez-vous, du plus proche au plus lointain",
  parDate.every((d, i) => i === 0 || parDate[i - 1] <= d),
  parDate.join(" · ")
);

await page.selectOption('[data-role="tri-rdv"]', "dentiste");
await page.waitForTimeout(300);
const parNom = await nomsRdv();
verifie("classés par dentiste de A à Z", parNom.every((n, i) => i === 0 || parNom[i - 1].localeCompare(n, "fr") <= 0), parNom.join(" · "));

// masquer ce qui est déjà annulé raccourcit la liste
const avantMasque = (await nomsRdv()).length;
await page.check('[data-role="masquer-annules"]');
await page.waitForTimeout(300);
verifie(
  "masquer les annulés ne laisse que ce qui reste à faire",
  (await nomsRdv()).length <= avantMasque && !(await page.textContent("body")).includes("rouvrir"),
  `${await nomsRdv().then((n) => n.length)} sur ${avantMasque}`
);
await page.uncheck('[data-role="masquer-annules"]');
await page.waitForTimeout(250);
await page.selectOption('[data-role="tri-rdv"]', "urgence");
await page.waitForTimeout(250);

// le classeur des rendez-vous placés, pour préparer les annulations
verifie("ce qui reste à annuler est annoncé", await page.isVisible("text=/\\d+ sur \\d+ encore à annuler/"));
const dlRdv = page.waitForEvent("download");
await page.click('button:has-text("Télécharger les rendez-vous (.xlsx)")');
const fichierRdv = path.join(SORTIES, "rendez-vous.xlsx");
await (await dlRdv).saveAs(fichierRdv);
const octetsRdv = fs.readFileSync(fichierRdv);
const classeurRdv = await readXlsx(octetsRdv.buffer.slice(octetsRdv.byteOffset, octetsRdv.byteOffset + octetsRdv.byteLength));
const lignesRdv = classeurRdv.sheets[0].rows;
verifie("classeur des rendez-vous téléchargé", classeurRdv.sheets[0].name === "Rendez-vous", classeurRdv.sheets[0].name);
const colRdv = (titre) => lignesRdv[0].indexOf(titre);
verifie("une ligne de titres claire", colRdv("À annuler à partir du") === 0 && colRdv("Dentiste") > 0, lignesRdv[0].slice(0, 3).join(" | "));
verifie("les deux rendez-vous placés y sont", lignesRdv.length === 3, `${lignesRdv.length - 1} rendez-vous`);
const avecTel = lignesRdv.slice(1).find((l) => l[colRdv("Dentiste")] === A.premierNom);
verifie("le téléphone est là pour annuler", avecTel && avecTel[colRdv("Téléphone")] === A.premierTel, String(avecTel && avecTel[colRdv("Téléphone")]));
verifie("la date d'annulation est une vraie date", /^\d{4}-\d{2}-\d{2}$/.test(avecTel[0]), String(avecTel[0]));
verifie("le statut d'annulation est explicite", /annuler/i.test(avecTel[colRdv("Où en est l'annulation")]), String(avecTel[colRdv("Où en est l'annulation")]));
verifie(
  "le classeur signale aussi le rappel « intervention majorée »",
  avecTel[colRdv("Rappel « intervention majorée »")] === "oui",
  String(avecTel[colRdv("Rappel « intervention majorée »")])
);

await page.screenshot({ path: path.join(SORTIES, "pc-suivi.png") });

await page.keyboard.press("Alt+5");
await page.waitForTimeout(250);
verifie("zone de dépôt du fichier Excel", await page.isVisible("text=Choisir le fichier Antwoordtabel"));
await page.screenshot({ path: path.join(SORTIES, "pc-donnees.png") });

console.log("\n13. Aide clavier");
await page.keyboard.press("?");
await page.waitForTimeout(300);
verifie("« ? » ouvre les raccourcis", await page.isVisible("text=Raccourcis clavier"));
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
verifie("Échap referme", !(await page.isVisible("text=Enregistrer et passer au praticien suivant")));

console.log("\n14. Langue de l'interface");
const tsvFrancais = await page.inputValue("textarea[readonly]");
verifie("l'export contient bien les valeurs françaises", tsvFrancais.includes("conventionné") && tsvFrancais.includes("oui"), tsvFrancais.slice(0, 80));

await page.click('aside button[title="Nederlands"]');
await page.waitForTimeout(300);
verifie("navigation en néerlandais", (await page.textContent("aside nav")).includes("Lijst"), (await page.textContent("aside nav")).replace(/\s+/g, " ").slice(0, 60));
verifie("titre de page en néerlandais", (await page.textContent("main, body")).includes("Gegevens"));
verifie("attribut lang du document", (await page.getAttribute("html", "lang")) === "nl");
const tsvApresNl = await page.inputValue("textarea[readonly]");
verifie("l'export reste en français en néerlandais", tsvApresNl === tsvFrancais, tsvApresNl.slice(0, 80));

await page.keyboard.press("Alt+2");
await page.waitForTimeout(250);
const reponsesNl = await page.textContent("aside:last-of-type, body");
verifie("réponses aux choix traduites (ja / nee)", await page.isVisible("button:text-is('ja')"));
verifie("scénario en néerlandais", reponsesNl.includes("Ik bel om een afspraak"), "");

await page.keyboard.press("Alt+5");
await page.waitForTimeout(200);
await page.click('aside button[title="English"]');
await page.waitForTimeout(300);
verifie("navigation en anglais", (await page.textContent("aside nav")).includes("List"));
const tsvApresEn = await page.inputValue("textarea[readonly]");
verifie("l'export reste en français en anglais", tsvApresEn === tsvFrancais, tsvApresEn.slice(0, 80));
await page.screenshot({ path: path.join(SORTIES, "pc-anglais.png") });

// la langue survit au rechargement — on attend l'enregistrement plutôt que de
// le supposer : sinon le test course la sauvegarde différée
await page.waitForFunction(
  () => JSON.parse(localStorage.getItem("ta-dentiste:v1") || "{}")?.reglages?.langue === "en",
  null,
  { timeout: 5000 }
);
await page.reload();
await page.waitForSelector("aside h1");
verifie("langue mémorisée après rechargement", (await page.textContent("aside nav")).includes("List"));
await page.click('aside button[title="Français"]');
await page.waitForTimeout(300);
verifie("retour au français", (await page.textContent("aside nav")).includes("Liste"));

console.log("\n15. Aucune erreur JavaScript");
verifie("console propre", erreurs.length === 0, erreurs.join(" | ").slice(0, 300));

await navigateur.close();
serveur.close();
console.log(echecs === 0 ? "\nTous les points vérifiés." : `\n${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
