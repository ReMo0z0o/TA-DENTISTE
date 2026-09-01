// Chargement d'une liste d'appel : fichier .xlsx / .csv ou simple collage.
// Les colonnes sont reconnues toutes seules, et restent corrigeables à la main.
import { useMemo, useState } from "react";
import { Block, Bouton, Label, Puce, Select } from "./ui.jsx";
import {
  CHAMPS_LISTE,
  callsDepuisReponses,
  contexteDepuisNom,
  estTableauReponses,
  lireFichier,
  mappingListe,
  parseDelimited,
  prospectsDepuis,
} from "../lib/importers.js";
import { PROVINCES, STATUTS } from "../lib/model.js";

const CHAMPS_OPTIONS = CHAMPS_LISTE.map((c) => ({ value: c.key, label: c.label }));

export default function ImportPanel({ onProspects, onCalls, onSauvegarde, flash }) {
  const [source, setSource] = useState(null); // { nom, feuilles }
  const [feuilleIndex, setFeuilleIndex] = useState(0);
  const [genre, setGenre] = useState("liste");
  const [mapping, setMapping] = useState([]);
  // chaque genre a sa propre ligne d'en-tête : basculer de l'un à l'autre
  // ne doit pas relire le fichier de travers
  const [enTetes, setEnTetes] = useState({ liste: -1, reponses: -1 });
  const [contexte, setContexte] = useState({ province: "", statut: "" });
  const [texte, setTexte] = useState("");

  const rows = source?.feuilles?.[feuilleIndex]?.rows || [];
  const enTete = enTetes[genre];

  const prepare = (feuilles, nom, index = 0) => {
    const lignes = feuilles[index]?.rows || [];
    const reponses = estTableauReponses(lignes);
    const liste = mappingListe(lignes);
    setSource({ nom, feuilles });
    setFeuilleIndex(index);
    // un tableau de réponses se reconnaît à ses 23 intitulés ; une liste de
    // praticiens, elle, a toujours sa propre ligne d'en-tête
    setGenre(reponses.oui && (reponses.enTete >= 0 || liste.enTete < 0) ? "reponses" : "liste");
    setMapping(liste.mapping);
    setEnTetes({ liste: liste.enTete, reponses: reponses.enTete });
    setContexte(contexteDepuisNom(nom, lignes));
  };

  const surFichier = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const lu = await lireFichier(file);
      if (lu.type === "json") {
        onSauvegarde(lu.data);
        return;
      }
      if (!lu.feuilles.length || !lu.feuilles[0].rows.length) {
        flash("Ce fichier ne contient aucune ligne exploitable.");
        return;
      }
      prepare(lu.feuilles, lu.nom);
    } catch (err) {
      flash(err.message || "Lecture du fichier impossible.");
    }
  };

  const surCollage = () => {
    const brut = texte.trim();
    if (!brut) return;
    if (brut.startsWith("{") || brut.startsWith("[")) {
      try {
        onSauvegarde(JSON.parse(brut));
        setTexte("");
      } catch {
        flash("Ce code de reprise est illisible — il a peut-être été tronqué.");
      }
      return;
    }
    const lignes = parseDelimited(brut);
    if (!lignes.length) {
      flash("Rien à charger.");
      return;
    }
    prepare([{ nom: "collage", rows: lignes }], "collage");
    setTexte("");
  };

  const apercu = useMemo(() => {
    if (!source) return [];
    const debut = enTete >= 0 ? enTete + 1 : 0;
    return rows.slice(debut, debut + 4);
  }, [source, rows, enTete]);

  // ce qui sera réellement importé : les lignes vides et les notes de bas de
  // fichier sont écartées, le compte affiché est donc le bon
  const resultat = useMemo(() => {
    if (!source) return [];
    return genre === "reponses"
      ? callsDepuisReponses(rows, enTete)
      : prospectsDepuis(rows, mapping, enTete, contexte);
  }, [source, rows, genre, mapping, enTete, contexte]);

  const nbColonnes = rows.reduce((n, r) => Math.max(n, r.length), 0);

  const importer = () => {
    if (!resultat.length) {
      flash(
        genre === "reponses"
          ? "Aucun appel trouvé dans ce tableau."
          : "Aucun praticien trouvé : vérifie la correspondance des colonnes."
      );
      return;
    }
    if (genre === "reponses") onCalls(resultat);
    else onProspects(resultat);
    setSource(null);
  };

  const nbLignes = resultat.length;
  const nbBrutes = Math.max(0, rows.length - (enTete >= 0 ? enTete + 1 : 0));

  return (
    <>
      <Block title="Charger une liste d'appel">
        <p className="mb-3 text-[13px] text-slate-600">
          Un fichier <strong>.xlsx</strong> ou <strong>.csv</strong> de praticiens (comme
          « Dentistes_Hainaut_liste_appels.xlsx »), ou des lignes copiées depuis Excel. Province, nom et téléphone
          seront ensuite déjà remplis à chaque appel.
        </p>
        <label className="mb-3 block">
          <span className="text-[13px] text-slate-600">Fichier .xlsx, .csv ou sauvegarde .json</span>
          <input
            type="file"
            accept=".xlsx,.xlsm,.csv,.tsv,.txt,.json,application/json,text/csv,text/plain"
            onChange={surFichier}
            className="mt-1.5 block w-full text-[13px] text-slate-700 file:mr-3 file:min-h-[40px] file:rounded-lg file:border-0 file:bg-teal-800 file:px-3 file:py-2 file:text-[13px] file:text-white"
          />
        </label>
        <Label hint="Colle ici des lignes copiées depuis Excel, ou un code de reprise .json.">Ou coller</Label>
        <textarea
          rows={3}
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder="1  BOURDON, SANDY  303016-12  Rue du Colombier 28  Péruwelz  7608  +32 69 64 14 60"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-[12px] focus:border-teal-700 focus:outline-none"
        />
        <Bouton variant="ghost" onClick={surCollage} disabled={!texte.trim()} className="mt-2 w-full">
          Lire ce texte
        </Bouton>
      </Block>

      {source && (
        <Block title="Vérifier avant d'importer">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px] text-slate-600">
            <Puce tone="teal">{source.nom}</Puce>
            <span>
              {nbBrutes} ligne{nbBrutes > 1 ? "s" : ""} lue{nbBrutes > 1 ? "s" : ""} · {nbColonnes} colonnes
            </span>
          </div>

          {source.feuilles.length > 1 && (
            <Select
              label="Feuille"
              value={String(feuilleIndex)}
              onChange={(v) => prepare(source.feuilles, source.nom, Number(v))}
              options={source.feuilles.map((f, i) => ({ value: String(i), label: f.nom }))}
            />
          )}

          <Select
            label="Ce fichier contient"
            value={genre}
            onChange={setGenre}
            options={[
              { value: "liste", label: "Une liste de praticiens à appeler" },
              { value: "reponses", label: "Un tableau de réponses déjà rempli (23 colonnes)" },
            ]}
          />

          {genre === "liste" && (
            <>
              <div className="mb-3 grid gap-x-3 sm:grid-cols-2">
                <Select
                  label="Province si absente du fichier"
                  value={contexte.province}
                  onChange={(v) => setContexte((c) => ({ ...c, province: v }))}
                  options={[{ value: "", label: "— aucune —" }, ...PROVINCES.map((p) => ({ value: p, label: p }))]}
                />
                <Select
                  label="Statut Inami de cette liste"
                  value={contexte.statut}
                  onChange={(v) => setContexte((c) => ({ ...c, statut: v }))}
                  options={[{ value: "", label: "— aucun —" }, ...STATUTS.map((s) => ({ value: s, label: s }))]}
                />
              </div>

              <Label hint="Corrige si une colonne n'a pas été reconnue.">Correspondance des colonnes</Label>
              <div className="-mx-3 mb-3 overflow-x-auto px-3">
                <table className="min-w-full text-[12px]">
                  <thead>
                    <tr>
                      {Array.from({ length: nbColonnes }, (_, i) => (
                        <th key={i} className="p-1 text-left align-top">
                          <select
                            value={mapping[i] || "ignorer"}
                            onChange={(e) => {
                              const suivant = [...mapping];
                              suivant[i] = e.target.value;
                              setMapping(suivant);
                            }}
                            className="min-h-[36px] w-full min-w-[130px] rounded border border-slate-300 bg-white px-1 py-1 text-[12px]"
                          >
                            {CHAMPS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {apercu.map((row, r) => (
                      <tr key={r} className="border-t border-slate-100">
                        {Array.from({ length: nbColonnes }, (_, i) => (
                          <td key={i} className="max-w-[160px] truncate p-1 text-slate-600">
                            {row[i]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {genre === "reponses" && (
            <p className="mb-3 text-[13px] text-slate-600">
              Les 23 colonnes du fichier de réponses seront reprises telles quelles comme appels déjà encodés.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Bouton onClick={importer} className="flex-1">
              {genre === "reponses"
                ? `Importer ${nbLignes} appel${nbLignes > 1 ? "s" : ""}`
                : `Importer ${nbLignes} praticien${nbLignes > 1 ? "s" : ""}`}
            </Bouton>
            <Bouton variant="ghost" onClick={() => setSource(null)}>
              Annuler
            </Bouton>
          </div>
        </Block>
      )}
    </>
  );
}
