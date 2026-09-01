import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base relative : le fichier construit fonctionne aussi bien depuis un disque
// (double-clic) que depuis un hébergement en sous-dossier (GitHub Pages).
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    assetsInlineLimit: 0,
  },
});
