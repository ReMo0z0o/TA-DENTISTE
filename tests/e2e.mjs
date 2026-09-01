// Parcours complet dans un vrai navigateur : import de la liste d'appel,
// encodage d'un appel, remplissage du fichier Excel officiel.
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { jeu } from "./fixtures.mjs";
import { readXlsx } from "../src/lib/xlsx.js";
import { readZip, entryText } from "../src/lib/zip.js";

const PORT = 5199;
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
  const rel = decodeURIComponent(req.url.split("?")[0]);
  const fichier = path.join(RACINE, rel === "/" ? "index.html" : rel);
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
  if (condition) {
    console.log(`  ok   ${nom}`);
  } else {
    echecs++;
    console.log(`  ÉCHEC ${nom} ${detail}`);
  }
}

await new Promise((r) => serveur.listen(PORT, r));

const navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const contexte = await navigateur.newContext({
  viewport: { width: 390, height: 844 },
  acceptDownloads: true,
  locale: "fr-BE",
});
const page = await contexte.newPage();
page.on("pageerror", (e) => erreurs.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") erreurs.push(m.text());
});

await page.goto(`http://localhost:${PORT}/`);
await page.waitForSelector("h1");

console.log(`\nJeu de fichiers : ${jeu.nom}`);
console.log("\n1. Import de la liste d'appel (.xlsx)");
await page.setInputFiles('input[type="file"]', jeu.liste);
await page.waitForSelector("text=Vérifier avant d'importer");
const apercu = await page.textContent("button:has-text('Importer')");
verifie(`${A.praticiens} praticiens détectés`, apercu.includes(`Importer ${A.praticiens} praticien`), apercu || "");
const colonnes = await page.$$eval("thead select", (els) => els.map((e) => e.value));
verifie("colonnes reconnues", colonnes.includes("nom") && colonnes.includes("telephone"), colonnes.join(","));
await page.click(`button:has-text("Importer ${A.praticiens} praticien")`);
await page.waitForSelector(`text=0 / ${A.praticiens} appelés`);
verifie("liste chargée", true);

console.log("\n2. Premier appel pré-rempli");
await page.click('button:has-text("Appeler le suivant")');
await page.waitForSelector("text=Le dentiste");
const nom = await page.inputValue("input[list='liste-provinces']").catch(() => "");
const titre = await page.textContent("section >> nth=0");
verifie("nom pré-rempli", titre.includes(A.premierNom), titre.slice(0, 60));
verifie("province déduite du code postal", titre.includes(A.province), titre.slice(0, 80));
const lien = await page.getAttribute('a[href^="tel:"]', "href");
verifie("numéro cliquable", lien === A.premierTelLien, lien || "");
const heure = await page.inputValue('input[type="time"]');
verifie("heure de l'appel notée", /^\d{2}:\d{2}$/.test(heure), heure);

console.log("\n3. Encodage d'un rendez-vous");
await page.click("button:text-is('conventionné')");
await page.click("h2:has-text('Résultat de l\\'appel') >> xpath=../.. >> button:text-is('oui')");
await page.fill('input[type="date"] >> nth=1', "2026-11-12");
await page.click("button:text-is('sans supplément')");
const sansSupp = await page.$$eval("input[type='date']", (els) => els.map((e) => e.value));
verifie("date sans supplément recopiée", sansSupp[2] === "2026-11-12", sansSupp.join(" | "));
await page.click("h2:has-text('Hygiéniste') >> xpath=../.. >> button:text-is('non')");
await page.click('button:has-text("Enregistrer et passer au suivant")');
await page.waitForSelector("text=/Au suivant/");
verifie("appel enregistré et fiche suivante ouverte", true);

console.log("\n4. Historique avec l'heure");
await page.click("nav >> text=Journée");
await page.waitForSelector(`text=${A.premierNom}`);
const carte = await page.textContent(`li:has-text("${A.premierNom}")`);
verifie("heure visible dans l'historique", new RegExp(heure).test(carte), carte.slice(0, 120));
verifie("résumé du rendez-vous", carte.includes("12/11/2026"), carte.slice(0, 160));

console.log("\n5. Remplissage du fichier Excel officiel");
await page.click("nav >> text=Données");
await page.waitForSelector("text=Remplir le fichier Excel de Test-Achats");
await page.setInputFiles('input[accept=".xlsx,.xlsm"]', jeu.modele);
await page.waitForSelector("text=/première ligne libre/");
const telechargement = page.waitForEvent("download");
await page.click('button:has-text("Télécharger le fichier rempli")');
const dl = await telechargement;
const cible = path.join(SORTIES, "modele-rempli.xlsx");
await dl.saveAs(cible);
const octets = fs.readFileSync(cible);
const rempli = await readXlsx(octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength));
const lignesModele = rempli.sheets[0].rows;
verifie("titres du fichier officiel conservés", lignesModele[0][0] === "Province adresse dentiste", String(lignesModele[0][0]));
const ecrite = lignesModele.find((r) => r[1] === A.premierNom) || [];
verifie("appel écrit dans le fichier", ecrite[0] === A.province && ecrite[4] === A.premierTel, JSON.stringify(ecrite.slice(0, 5)));
verifie("date du rendez-vous écrite comme une date", ecrite[11] === "2026-11-12", String(ecrite[11]));
verifie("tarif officiel déduit dans les colonnes P/Q/R", ecrite[15] === "oui" && ecrite[16] === "2026-11-12" && ecrite[17] === "oui", JSON.stringify(ecrite.slice(15, 18)));
const zipRempli = readZip(octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength));
const feuille = await entryText(zipRempli.get("xl/worksheets/sheet1.xml"));
verifie("listes déroulantes conservées", /<dataValidations/.test(feuille) && /conventionné,partiellement/.test(feuille));

console.log("\n6. Sauvegarde .json et reprise sur un autre appareil");
const dlJson = page.waitForEvent("download");
await page.click('button:has-text("Sauvegarde .json")');
const fichierJson = path.join(SORTIES, "sauvegarde.json");
await (await dlJson).saveAs(fichierJson);
const sauvegarde = JSON.parse(fs.readFileSync(fichierJson, "utf8"));
verifie(
  "sauvegarde complète",
  sauvegarde.prospects.length === A.praticiens && sauvegarde.calls.length === 1,
  JSON.stringify({ p: sauvegarde.prospects.length, c: sauvegarde.calls.length })
);

// un contexte neuf = un autre appareil : mémoire du navigateur vierge
const autreAppareil = await navigateur.newContext({ viewport: { width: 1280, height: 900 }, locale: "fr-BE" });
const page2 = await autreAppareil.newPage();
page2.on("pageerror", (e) => erreurs.push(String(e)));
page2.on("dialog", (d) => d.accept());
await page2.goto(`http://localhost:${PORT}/`);
await page2.waitForSelector("h1");
await page2.setInputFiles('input[accept*=".json"]', fichierJson);
await page2.waitForTimeout(600);
const entete = await page2.textContent("header");
verifie("reprise sur un autre appareil", entete.includes("1 appel"), entete.replace(/\s+/g, " ").slice(0, 80));

console.log("\n7. Aucune erreur JavaScript");
verifie("console propre", erreurs.length === 0, erreurs.join(" | ").slice(0, 300));

await page2.click("nav >> text=Liste");
await page2.waitForTimeout(300);
await page2.screenshot({ path: path.join(SORTIES, "ecran-bureau.png") });
await page.screenshot({ path: path.join(SORTIES, "ecran-liste.png") });
await navigateur.close();
serveur.close();

console.log(echecs === 0 ? "\nTous les points vérifiés." : `\n${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
