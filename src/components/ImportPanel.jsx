// Chargement d'une liste d'appel : fichier .xlsx / .csv ou simple collage.
// Les colonnes sont reconnues toutes seules, et restent corrigeables à la main.
import { useMemo, useState } from "react";
import { Block, Bouton, Choice, Label, Puce, Select, Tiroir, ZoneFichier } from "./ui.jsx";
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
import { lisCodeDeReprise, ressembleAUnCode } from "../lib/reprise.js";
import { useT } from "../lib/i18n.js";

export default function ImportPanel({ onProspects, onCalls, onSauvegarde, flash }) {
  const t = useT();
  const champsOptions = CHAMPS_LISTE.map((c) => ({ value: c.key, label: t(c.label) }));
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

  const surFichier = async (file) => {
    if (!file) return;
    try {
      const lu = await lireFichier(file);
      if (lu.type === "json") {
        onSauvegarde(lu.data);
        return;
      }
      if (!lu.feuilles.length || !lu.feuilles[0].rows.length) {
        flash(t("Ce fichier ne contient aucune ligne exploitable."));
        return;
      }
      prepare(lu.feuilles, lu.nom);
    } catch (err) {
      flash(err.message || t("Lecture du fichier impossible."));
    }
  };

  const surCollage = () => {
    const brut = texte.trim();
    if (!brut) return;
    // un code de reprise passe souvent par un messager ou une note : on répare
    // ce qui a été abîmé en route plutôt que de le rejeter en bloc
    if (ressembleAUnCode(brut)) {
      const lu = lisCodeDeReprise(brut);
      if (lu.erreur) flash(t(lu.erreur, lu.valeurs));
      else {
        onSauvegarde(lu.data);
        setTexte("");
      }
      return;
    }
    const lignes = parseDelimited(brut);
    if (!lignes.length) {
      flash(t("Rien à charger."));
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
          ? t("Aucun appel trouvé dans ce tableau.")
          : t("Aucun praticien trouvé : vérifie la correspondance des colonnes.")
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
      <Block title={t("Charger une liste d'appel")}>
        <p className="mb-3 text-[13px] text-slate-600">
          {t("Un fichier .xlsx ou .csv de praticiens, ou des lignes copiées depuis Excel. Province, nom et téléphone seront ensuite déjà remplis à chaque appel.")}
        </p>
        <ZoneFichier
          accept=".xlsx,.xlsm,.csv,.tsv,.txt,.json,application/json,text/csv,text/plain"
          onFichier={surFichier}
          libelle={t("Choisir un fichier")}
          aide={t("Liste .xlsx ou .csv, ou sauvegarde .json")}
        />
        <Label hint={t("Colle ici des lignes copiées depuis Excel, ou un code de reprise .json.")}>{t("Ou coller")}</Label>
        <textarea
          rows={3}
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder="1  BOURDON, SANDY  303016-12  Rue du Colombier 28  Péruwelz  7608  +32 69 64 14 60"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-[12px] focus:border-teal-700 focus:outline-none"
        />
        <Bouton variant="ghost" onClick={surCollage} disabled={!texte.trim()} className="mt-2 w-full">
          {t("Lire ce texte")}
        </Bouton>
      </Block>

      <Tiroir ouvert={Boolean(source)} onClose={() => setSource(null)} titre={t("Vérifier avant d'importer")}>
        {source && (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px] text-slate-600">
            <Puce tone="teal">{source.nom}</Puce>
            <span>
              {t.n(nbBrutes, "{n} ligne lue", "{n} lignes lues")} · {t("{n} colonnes", { n: nbColonnes })}
            </span>
          </div>

          {source.feuilles.length > 1 && (
            <Select
              label={t("Feuille")}
              value={String(feuilleIndex)}
              onChange={(v) => prepare(source.feuilles, source.nom, Number(v))}
              options={source.feuilles.map((f, i) => ({ value: String(i), label: f.nom }))}
            />
          )}

          <Select
            label={t("Ce fichier contient")}
            value={genre}
            onChange={setGenre}
            options={[
              { value: "liste", label: t("Une liste de praticiens à appeler") },
              { value: "reponses", label: t("Un tableau de réponses déjà rempli (23 colonnes)") },
            ]}
          />

          {genre === "liste" && (
            <>
              <Select
                label={t("Province si absente du fichier")}
                value={contexte.province}
                onChange={(v) => setContexte((c) => ({ ...c, province: v }))}
                options={[{ value: "", label: t("— aucune —") }, ...PROVINCES.map((p) => ({ value: p, label: p }))]}
              />

              {/* colonne obligatoire du fichier de réponses : la choisir une
                  fois ici évite de la reprendre sur chacun des 25 appels */}
              <Choice
                label={t("Statut Inami de cette liste")}
                hint={t("Appliqué à tous les praticiens de cette liste, et déjà rempli à chaque appel. Les praticiens dont le fichier précise le statut gardent le leur.")}
                options={STATUTS}
                value={contexte.statut}
                onChange={(v) => setContexte((c) => ({ ...c, statut: v }))}
              />
              {!contexte.statut && (
                <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
                  {t("Sans statut, cette colonne obligatoire restera à remplir sur chaque appel.")}
                </p>
              )}

              <Label hint={t("Corrige si une colonne n'a pas été reconnue.")}>{t("Correspondance des colonnes")}</Label>
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
                            {champsOptions.map((o) => (
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
              {t("Les 23 colonnes du fichier de réponses seront reprises telles quelles comme appels déjà encodés.")}
            </p>
          )}

            <div className="flex flex-wrap gap-2">
              <Bouton onClick={importer} className="flex-1">
                {genre === "reponses"
                  ? t.n(nbLignes, "Importer {n} appel", "Importer {n} appels")
                  : t.n(nbLignes, "Importer {n} praticien", "Importer {n} praticiens")}
              </Bouton>
              <Bouton variant="ghost" onClick={() => setSource(null)}>
                {t("Annuler")}
              </Bouton>
            </div>
          </div>
        )}
      </Tiroir>
    </>
  );
}
