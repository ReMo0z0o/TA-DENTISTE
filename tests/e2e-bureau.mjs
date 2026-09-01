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
verifie("barre du bas masquée", !(await page.isVisible("body > nav")));
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

console.log("\n6. Journée en tableau");
await page.keyboard.press("Alt+3");
await page.waitForTimeout(250);
const ligneJournee = await page.textContent(`tbody tr:has-text("${A.premierNom}")`);
verifie("heure de l'appel dans le tableau", /\d{2}:\d{2}/.test(ligneJournee), ligneJournee.replace(/\s+/g, " ").slice(0, 90));
verifie("date du rendez-vous dans le tableau", ligneJournee.includes("12/11/2026"), ligneJournee.replace(/\s+/g, " ").slice(0, 120));
await page.screenshot({ path: path.join(SORTIES, "pc-journee.png") });

console.log("\n7. Suivi et données sur deux colonnes");
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

console.log("\n8. Aide clavier");
await page.keyboard.press("?");
await page.waitForTimeout(300);
verifie("« ? » ouvre les raccourcis", await page.isVisible("text=Raccourcis clavier"));
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
verifie("Échap referme", !(await page.isVisible("text=Enregistrer et passer au praticien suivant")));

console.log("\n9. Aucune erreur JavaScript");
verifie("console propre", erreurs.length === 0, erreurs.join(" | ").slice(0, 300));

await navigateur.close();
serveur.close();
console.log(echecs === 0 ? "\nTous les points vérifiés." : `\n${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
