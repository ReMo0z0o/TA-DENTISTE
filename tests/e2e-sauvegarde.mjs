// Le trajet que fait vraiment l'utilisateur : travailler, télécharger la
// sauvegarde, puis la recharger sur un autre appareil — et tout retrouver,
// y compris l'onglet Suivi.
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { jeu } from "./fixtures.mjs";

const PORT = 5196;
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

const ouvreAppareil = async () => {
  const contexte = await navigateur.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
    locale: "fr-BE",
  });
  const page = await contexte.newPage();
  page.on("pageerror", (e) => erreurs.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") erreurs.push(m.text());
  });
  page.on("dialog", (d) => d.accept());
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForSelector("aside h1");
  return page;
};

console.log(`\nJeu de fichiers : ${jeu.nom}`);

/* ------------------------------------------------ appareil 1 : le bureau */

console.log("\n1. Une journée de travail");
const bureau = await ouvreAppareil();
await bureau.setInputFiles('input[accept*=".xlsx"]', jeu.liste);
await bureau.waitForSelector("text=Vérifier avant d'importer");
await bureau.click(`button:has-text("Importer ${A.praticiens} praticien")`);
await bureau.waitForSelector("table");

await bureau.keyboard.press("Alt+2");
await bureau.waitForTimeout(200);
await bureau.click("button:has-text('Ouvrir sa fiche')");
await bureau.waitForTimeout(200);
await bureau.click("button:text-is('conventionné')");
// le cabinet demande le registre national -> la fiche part dans les rappels
await bureau.click("h2:has-text('Questions posées') >> xpath=../.. >> button:text-is('oui') >> nth=1");
await bureau.click("h2:has-text('Résultat de l\\'appel') >> xpath=../.. >> button:text-is('oui')");
await bureau.fill('input[type="date"] >> nth=1', "2026-11-12");
await bureau.click("button:text-is('sans supplément')");
await bureau.click("h2:has-text('Hygiéniste') >> xpath=../.. >> button:text-is('non')");
await bureau.fill("textarea", "secrétariat pressé");
const heureAppel = await bureau.inputValue('input[type="time"]');
await bureau.keyboard.press("Control+Enter");
await bureau.waitForTimeout(400);
verifie("un appel encodé", (await bureau.textContent("body")).includes("Au suivant"));

// deuxième praticien marqué injoignable depuis la liste
await bureau.keyboard.press("Alt+1");
await bureau.waitForTimeout(250);
await bureau.selectOption("tbody tr:nth-child(3) select", "injoignable");
await bureau.waitForTimeout(200);

console.log("\n2. Le suivi est rempli");
await bureau.keyboard.press("Alt+4");
await bureau.waitForTimeout(300);
verifie("la fiche apparaît dans les rappels", (await bureau.textContent("body")).includes(A.premierNom));
await bureau.fill("input[type='date'] >> nth=0", "2026-09-02"); // date du rappel
await bureau.fill("input[type='date'] >> nth=1", "2026-10-03"); // date du RDV obtenu
await bureau.click("h2:has-text('Rappels avec le profil') >> xpath=../.. >> button:text-is('oui')");
await bureau.click("button:has-text(\"J'ai vérifié aujourd'hui\")");
await bureau.waitForTimeout(300);

const annulationAvant = await bureau.textContent("h2:has-text('Rendez-vous à annuler') >> xpath=../..");
const registreAvant = await bureau.textContent("h2:has-text('Registre national') >> xpath=../..");
verifie("date d'annulation calculée", /À annuler à partir du/.test(annulationAvant));
verifie("contrôle du registre noté", /Dernier contrôle/.test(registreAvant), registreAvant.replace(/\s+/g, " ").slice(0, 90));
await bureau.screenshot({ path: path.join(SORTIES, "suivi-avant.png") });

console.log("\n3. Téléchargement de la sauvegarde");
await bureau.keyboard.press("Alt+5");
await bureau.waitForTimeout(250);
const telechargement = bureau.waitForEvent("download");
await bureau.click('button:has-text("Télécharger le fichier .json")');
const fichierJson = path.join(SORTIES, "sauvegarde-suivi.json");
await (await telechargement).saveAs(fichierJson);
const contenu = JSON.parse(fs.readFileSync(fichierJson, "utf8"));
verifie("la liste d'appel est dans le fichier", contenu.prospects?.length === A.praticiens, String(contenu.prospects?.length));
verifie("les appels sont dans le fichier", contenu.calls?.length === 1, String(contenu.calls?.length));
verifie("le suivi est dans le fichier", Array.isArray(contenu.suivi?.controlesRegistre) && contenu.suivi.controlesRegistre.length === 1, JSON.stringify(contenu.suivi));
verifie("le rappel est dans le fichier", contenu.calls?.[0]?.rappel?.dateRdv === "2026-10-03", JSON.stringify(contenu.calls?.[0]?.rappel));
verifie("l'annulation est dans le fichier", Boolean(contenu.calls?.[0]?.annulation?.prevueLe), JSON.stringify(contenu.calls?.[0]?.annulation));

/* --------------------------------------------- appareil 2 : le téléphone */

console.log("\n4. Rechargement sur un autre appareil");
const autre = await ouvreAppareil();
await autre.setInputFiles('input[accept*=".json"]', fichierJson);
await autre.waitForTimeout(700);

await autre.keyboard.press("Alt+1");
await autre.waitForTimeout(300);
const listeApres = await autre.textContent("table");
verifie("la liste d'appel est revenue", (await autre.$$eval("tbody tr", (e) => e.length)) === A.praticiens);
verifie("l'état « fait » est conservé", listeApres.includes("Fait"), "");
verifie("l'état « injoignable » est conservé", listeApres.includes("Injoignable"), "");

await autre.keyboard.press("Alt+3");
await autre.waitForTimeout(300);
const journeeApres = await autre.textContent(`tbody tr:has-text("${A.premierNom}")`);
verifie("l'appel est revenu avec son heure", journeeApres.includes(heureAppel), journeeApres.replace(/\s+/g, " ").slice(0, 80));
verifie("le rendez-vous est revenu", journeeApres.includes("12/11/2026"));
verifie("les remarques sont revenues", journeeApres.includes("secrétariat pressé"));

console.log("\n5. L'onglet Suivi est intact");
await autre.keyboard.press("Alt+4");
await autre.waitForTimeout(400);
const annulationApres = await autre.textContent("h2:has-text('Rendez-vous à annuler') >> xpath=../..");
const registreApres = await autre.textContent("h2:has-text('Registre national') >> xpath=../..");
const dates = await autre.$$eval("input[type='date']", (els) => els.map((e) => e.value));
verifie("date du rappel conservée", dates[0] === "2026-09-02", dates.join(" | "));
verifie("date du rendez-vous obtenu conservée", dates[1] === "2026-10-03", dates.join(" | "));
verifie(
  "« rendez-vous obtenu » conservé",
  (await autre.getAttribute("h2:has-text('Rappels avec le profil') >> xpath=../.. >> button:text-is('oui')", "aria-pressed")) === "true"
);
verifie(
  "date d'annulation identique",
  annulationApres.replace(/\s+/g, " ") === annulationAvant.replace(/\s+/g, " "),
  annulationApres.replace(/\s+/g, " ").slice(0, 90)
);
verifie(
  "contrôle du registre national conservé",
  registreApres.replace(/\s+/g, " ") === registreAvant.replace(/\s+/g, " "),
  registreApres.replace(/\s+/g, " ").slice(0, 90)
);
await autre.screenshot({ path: path.join(SORTIES, "suivi-apres.png") });

console.log("\n6. Le transfert par copier-coller, y compris abîmé en route");
// on repart du bureau : le bouton met le code dans le presse-papier
await bureau.keyboard.press("Alt+5");
await bureau.waitForTimeout(250);
await bureau.context().grantPermissions(["clipboard-read", "clipboard-write"]);
await bureau.click('button:has-text("Copier le code")');
await bureau.waitForTimeout(300);
const codeCopie = await bureau.evaluate(() => navigator.clipboard.readText());
verifie("le bouton copie bien le code", codeCopie.startsWith('{"app":"ta-dentiste"'), codeCopie.slice(0, 40));
verifie("le code tient sur une seule ligne", !codeCopie.includes("\n"));
verifie(
  "le compte de caractères annoncé est le bon",
  (await bureau.textContent('[data-role="taille-code"]')).includes(String(codeCopie.length)),
  (await bureau.textContent('[data-role="taille-code"]')) + " ≠ " + codeCopie.length
);

// ce que le code devient après un passage par un messager : espaces
// insécables, clôtures de bloc de code, phrase autour
const NBSP = String.fromCharCode(0xa0);
const abime = "Voici mon travail :\n```json\n" + codeCopie.replace(/,"/g, "," + NBSP + '"') + "\n```\nMerci !";
const troisieme = await ouvreAppareil();
await troisieme.keyboard.press("Alt+5");
await troisieme.waitForTimeout(250);
await troisieme.fill('[data-role="collage-reprise"]', abime);
await troisieme.click('button:has-text("Charger ce code")');
await troisieme.waitForTimeout(700);
await troisieme.keyboard.press("Alt+1");
await troisieme.waitForTimeout(300);
verifie(
  "le code abîmé est réparé et la liste revient",
  (await troisieme.$$eval("tbody tr", (e) => e.length)) === A.praticiens,
  String(await troisieme.$$eval("tbody tr", (e) => e.length))
);
await troisieme.keyboard.press("Alt+3");
await troisieme.waitForTimeout(300);
verifie(
  "l'appel encodé revient lui aussi",
  (await troisieme.textContent("body")).includes(A.premierNom)
);

// un code tronqué doit le dire, et ne rien écraser
const quatrieme = await ouvreAppareil();
await quatrieme.keyboard.press("Alt+5");
await quatrieme.waitForTimeout(250);
await quatrieme.fill('[data-role="collage-reprise"]', codeCopie.slice(0, Math.floor(codeCopie.length / 2)));
await quatrieme.click('button:has-text("Charger ce code")');
await quatrieme.waitForTimeout(400);
const messageTronque = await quatrieme.textContent("body");
verifie("un code tronqué est annoncé comme incomplet", /incomplet/.test(messageTronque), messageTronque.replace(/\s+/g, " ").slice(0, 120));

console.log("\n7. Aucune erreur JavaScript");
verifie("console propre", erreurs.length === 0, erreurs.join(" | ").slice(0, 300));

await navigateur.close();
serveur.close();
console.log(echecs === 0 ? "\nTous les points vérifiés." : `\n${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
