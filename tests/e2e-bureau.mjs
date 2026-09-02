// Parcours au bureau : barre latérale, tableaux, clavier, glisser-déposer.
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { jeu } from "./fixtures.mjs";

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
await page.click(`button:has-text("Importer ${A.praticiens} praticien")`);
await page.waitForSelector("table");

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

console.log("\n7. Journée en tableau");
await page.keyboard.press("Alt+3");
await page.waitForTimeout(250);
const appelsEncodes = await page.$$eval("tbody tr", (els) => els.filter((tr) => tr.querySelectorAll("td").length > 1).length);
verifie("aucune ligne vide créée pour l'injoignable", appelsEncodes === 1, `${appelsEncodes} ligne(s)`);
const ligneJournee = await page.textContent(`tbody tr:has-text("${A.premierNom}")`);
verifie("heure de l'appel dans le tableau", /\d{2}:\d{2}/.test(ligneJournee), ligneJournee.replace(/\s+/g, " ").slice(0, 90));
verifie("date du rendez-vous dans le tableau", ligneJournee.includes("12/11/2026"), ligneJournee.replace(/\s+/g, " ").slice(0, 120));
await page.screenshot({ path: path.join(SORTIES, "pc-journee.png") });

console.log("\n8. Suivi et données sur deux colonnes");
await page.keyboard.press("Alt+4");
await page.waitForTimeout(250);
const colonnesSuivi = await page.$eval("main, div.lg\\:grid", () => {
  const grille = document.querySelector("div.lg\\:grid");
  return grille ? getComputedStyle(grille).gridTemplateColumns.split(" ").length : 0;
});
verifie("le suivi se répartit sur deux colonnes", colonnesSuivi === 2, String(colonnesSuivi));
await page.screenshot({ path: path.join(SORTIES, "pc-suivi.png") });

await page.keyboard.press("Alt+5");
await page.waitForTimeout(250);
verifie("zone de dépôt du fichier Excel", await page.isVisible("text=Choisir le fichier Antwoordtabel"));
await page.screenshot({ path: path.join(SORTIES, "pc-donnees.png") });

console.log("\n9. Aide clavier");
await page.keyboard.press("?");
await page.waitForTimeout(300);
verifie("« ? » ouvre les raccourcis", await page.isVisible("text=Raccourcis clavier"));
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
verifie("Échap referme", !(await page.isVisible("text=Enregistrer et passer au praticien suivant")));

console.log("\n10. Langue de l'interface");
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

// la langue survit au rechargement
await page.reload();
await page.waitForSelector("aside h1");
verifie("langue mémorisée après rechargement", (await page.textContent("aside nav")).includes("List"));
await page.click('aside button[title="Français"]');
await page.waitForTimeout(300);
verifie("retour au français", (await page.textContent("aside nav")).includes("Liste"));

console.log("\n11. Aucune erreur JavaScript");
verifie("console propre", erreurs.length === 0, erreurs.join(" | ").slice(0, 300));

await navigateur.close();
serveur.close();
console.log(echecs === 0 ? "\nTous les points vérifiés." : `\n${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
