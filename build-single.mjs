// Regroupe le résultat de `vite build` en UN seul fichier docs/index.html.
// Objectif : l'application s'ouvre par double-clic depuis une clé USB comme
// depuis un hébergement, sans serveur, sans installation, hors ligne.
import { readFile, writeFile, mkdir, readdir, copyFile } from "node:fs/promises";
import path from "node:path";

const DIST = "dist";
const SORTIE = "docs";

const lire = (p) => readFile(path.join(DIST, p), "utf8");

// un "</script>" à l'intérieur d'une chaîne fermerait la balise trop tôt
const protege = (js) => js.replace(/<\/script>/gi, "<\\/script>").replace(/<!--/g, "<\\!--");

let html = await lire("index.html");

const scripts = [...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g)];
for (const [balise, src] of scripts) {
  const code = await lire(src.replace(/^\.?\//, ""));
  // remplacement par fonction : sinon les motifs $& du code minifié seraient interprétés
  html = html.replace(balise, () => `<script type="module">\n${protege(code)}\n</script>`);
}

const styles = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)];
for (const [balise, href] of styles) {
  const css = await lire(href.replace(/^\.?\//, ""));
  html = html.replace(balise, () => `<style>\n${css}\n</style>`);
}

// les préchargements ne servent plus à rien une fois tout intégré
html = html.replace(/<link\b[^>]*rel="modulepreload"[^>]*>\s*/g, "");

await mkdir(SORTIE, { recursive: true });
await writeFile(path.join(SORTIE, "index.html"), html);

// fichiers statiques (manifeste, service worker, icônes)
for (const nom of await readdir("public")) {
  await copyFile(path.join("public", nom), path.join(SORTIE, nom));
}

const taille = (html.length / 1024).toFixed(0);
console.log(`docs/index.html — ${taille} Ko, ${scripts.length} script(s) et ${styles.length} feuille(s) intégrés.`);
