// Tout ce qui entre et tout ce qui sort : listes d'appel, fichier Excel de
// réponses, sauvegarde pour passer du bureau au téléphone.
import { useMemo, useRef, useState } from "react";
import { Block, Bouton, Case, Field, Label, Vide, ZoneFichier } from "../components/ui.jsx";
import ImportPanel from "../components/ImportPanel.jsx";
import {
  classeurNeuf,
  codeDeReprise,
  csv,
  nomFichier,
  remplirModele,
  sauvegarde,
  telecharger,
  templateFirstFreeRow,
  templateHeaders,
  tsv,
} from "../lib/exporters.js";
import { HEADERS, besoinRappel, ordreExport, rdvPris } from "../lib/model.js";
import { frDate } from "../lib/dates.js";
import { lisCodeDeReprise } from "../lib/reprise.js";
import { useT } from "../lib/i18n.js";

function csvSuivi(calls) {
  const cell = (v) => {
    const s = String(v ?? "");
    return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lignes = [
    [
      "Dentiste",
      "Téléphone",
      "Date de l'appel",
      "Heure",
      "Rappel profil intervention majorée",
      "Date du rappel",
      "RDV obtenu au rappel",
      "Date du RDV obtenu",
      "RDV à annuler à partir du",
      "Annulé le",
      "Annulé par le cabinet",
      "Remarques du rappel",
    ].map(cell).join(";"),
  ];
  for (const c of ordreExport(calls)) {
    if (!besoinRappel(c) && !rdvPris(c)) continue;
    lignes.push(
      [
        c.dentiste,
        c.telephone,
        frDate(c.dateAppel),
        c.heureAppel,
        besoinRappel(c) ? "oui" : "",
        frDate(c.rappel?.date),
        c.rappel?.rdvObtenu || "",
        frDate(c.rappel?.dateRdv),
        frDate(c.annulation?.prevueLe),
        frDate(c.annulation?.faiteLe),
        c.annulation?.parCabinet ? "oui" : "",
        c.rappel?.remarque || "",
      ]
        .map(cell)
        .join(";")
    );
  }
  return "\uFEFF" + lignes.join("\r\n");
}

export default function DonneesScreen({
  etat,
  calls,
  onProspects,
  onCalls,
  onSauvegarde,
  onViderAppels,
  onToutEffacer,
  flash,
}) {
  const t = useT();
  const [avecEnTete, setAvecEnTete] = useState(false);
  const [modele, setModele] = useState(null); // { nom, buffer, depart }
  const [remplissage, setRemplissage] = useState(false);
  const vide = calls.length === 0;

  // Le code ne se recalcule qu'au changement des données : s'il se réécrivait à
  // chaque rendu, la sélection de l'utilisateur sauterait au milieu de sa copie.
  const code = useMemo(() => codeDeReprise(etat), [etat]);
  const zoneCode = useRef(null);
  const [reprise, setReprise] = useState("");

  const copieLeCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      flash(t("Code copié ({n} caractères). Colle-le sur l'autre appareil.", { n: code.length }));
      return;
    } catch {
      /* navigateur sans presse-papier : on repasse par la sélection */
    }
    const zone = zoneCode.current;
    if (zone) {
      zone.focus();
      zone.select();
      try {
        if (document.execCommand("copy")) {
          flash(t("Code copié ({n} caractères). Colle-le sur l'autre appareil.", { n: code.length }));
          return;
        }
      } catch {
        /* rien à faire de plus */
      }
    }
    flash(t("Copie automatique refusée : le code est sélectionné, fais Ctrl+C (ou Cmd+C)."));
  };

  const chargeLeCode = () => {
    const lu = lisCodeDeReprise(reprise);
    if (lu.erreur) {
      flash(t(lu.erreur, lu.valeurs));
      return;
    }
    onSauvegarde(lu.data);
    setReprise("");
  };

  const chargeModele = async (file) => {
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const depart = await templateFirstFreeRow(buffer);
      const titres = await templateHeaders(buffer);
      setModele({ nom: file.name, buffer, depart: String(depart), titres });
      // l'application écrit 24 colonnes : sur un fichier qui n'a pas encore la
      // colonne « Statut », tout glisserait d'une case à partir de W
      flash(
        titres.length >= HEADERS.length
          ? t("Modèle chargé : première ligne libre = ligne {n}.", { n: depart })
          : t("Modèle chargé, mais il n'a que {n} colonnes : ajoute « Statut » en W, avant « Remarques », sinon les statuts s'écriraient par-dessus les remarques.", { n: titres.length })
      );
    } catch (err) {
      flash(err.message || t("Ce fichier Excel n'a pas pu être lu."));
    }
  };

  const remplir = async () => {
    if (!modele) return;
    setRemplissage(true);
    try {
      const depart = Math.max(2, Number(modele.depart) || 2);
      const blob = await remplirModele(modele.buffer, calls, depart);
      const ok = telecharger(modele.nom.replace(/\.xlsx?$/i, "") + `-rempli-${calls.length}-appels.xlsx`, blob);
      flash(
        ok
          ? t("{n} appels écrits à partir de la ligne {ligne}. Vérifie le fichier avant de l'envoyer.", {
              n: calls.length,
              ligne: depart,
            })
          : t("Téléchargement refusé par le navigateur — utilise le collage pour Excel.")
      );
    } catch (err) {
      flash(err.message || t("Le remplissage a échoué : utilise le collage pour Excel."));
    }
    setRemplissage(false);
  };

  const copier = async () => {
    const texte = tsv(calls, avecEnTete);
    try {
      await navigator.clipboard.writeText(texte);
      flash(t("Copié. Colle dans la première cellule vide de la colonne A."));
    } catch {
      flash(t("Copie automatique refusée — sélectionne le texte ci-dessous à la main."));
    }
  };

  return (
    <div className="pb-24 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5 lg:pb-0">
      {/* à gauche ce qui entre dans l'application, à droite ce qui en sort */}
      <div>
        <ImportPanel onProspects={onProspects} onCalls={onCalls} onSauvegarde={onSauvegarde} flash={flash} />
        {vide && <Vide>{t("Aucun appel encodé pour l'instant : les exports seront vides.")}</Vide>}
      </div>

      <div>
      <Block title={t("Remplir le fichier Excel de Test-Achats")}>
        <p className="mb-3 text-[13px] text-slate-600">
          {t("Charge ici le fichier Antwoordtabel que tu dois rendre : l'application y ajoute tes appels en gardant les titres, les listes déroulantes et la mise en forme, puis te rend le fichier complété.")}
        </p>
        <p className="mb-3 rounded-lg bg-slate-100 px-3 py-2 text-[12px] text-slate-600">
          {t("Le fichier reste en français : les réponses y sont écrites telles que Test-Achats les attend, quelle que soit la langue de l'application.")}
        </p>
        <ZoneFichier
          accept=".xlsx,.xlsm"
          onFichier={chargeModele}
          libelle={modele ? t("Changer de fichier") : t("Choisir le fichier Antwoordtabel")}
          aide={modele ? modele.nom : t("Fichier .xlsx fourni par Test-Achats")}
          ton="ghost"
        />
        {modele && (
          <>
            <Field
              label={t("Écrire à partir de la ligne")}
              hint={t("Ligne 2 = juste sous les titres. La valeur proposée est la première ligne libre du fichier.")}
              type="number"
              value={modele.depart}
              onChange={(v) => setModele((m) => ({ ...m, depart: v }))}
              inputMode="numeric"
            />
            <Bouton onClick={remplir} disabled={vide || remplissage} className="w-full">
              {remplissage
                ? t("Écriture en cours…")
                : t("Télécharger le fichier rempli ({n} appels)", { n: calls.length })}
            </Bouton>
          </>
        )}
      </Block>

      <Block title={t("Coller directement dans Excel")}>
        <p className="mb-3 text-[13px] text-slate-600">
          {t("Le texte ci-dessous contient {n} appels dans l'ordre des 23 colonnes. Copie-le, puis colle-le dans la première cellule vide de la colonne A : Excel répartit les colonnes tout seul.", { n: calls.length })}
        </p>
        <Case checked={avecEnTete} onChange={setAvecEnTete}>
          {t("Inclure la ligne de titres")}
        </Case>
        <Bouton onClick={copier} disabled={vide} className="mb-3 w-full">
          {t("Copier pour Excel")}
        </Bouton>
        <textarea
          readOnly
          rows={6}
          value={tsv(calls, avecEnTete)}
          onFocus={(e) => e.target.select()}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-[11.5px] text-slate-700"
        />
      </Block>

      <Block title={t("Autres fichiers")}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <Bouton
            variant="ghost"
            disabled={vide}
            onClick={async () => {
              const blob = await classeurNeuf(calls);
              telecharger(nomFichier("appels-dentistes", "xlsx"), blob);
            }}
          >
            {t("Classeur .xlsx neuf")}
          </Bouton>
          <Bouton
            variant="ghost"
            disabled={vide}
            onClick={() => telecharger(nomFichier("appels-dentistes", "csv"), csv(calls), "text/csv;charset=utf-8")}
          >
            {t("Fichier .csv")}
          </Bouton>
          <Bouton
            variant="ghost"
            disabled={vide}
            onClick={() => telecharger(nomFichier("suivi-rappels-annulations", "csv"), csvSuivi(calls), "text/csv;charset=utf-8")}
          >
            {t("Suivi : rappels et annulations")}
          </Bouton>
        </div>
      </Block>

      <Block title={t("Changer d'appareil")}>
        <p className="mb-3 text-[13px] text-slate-600">
          {t("Tout est transféré : la liste d'appel, les appels encodés et le suivi. Le fichier .json est le moyen le plus sûr ; le code ci-dessous fait la même chose par copier-coller quand le fichier ne passe pas.")}
        </p>

        <Label hint={t("Sur l'appareil que tu quittes.")}>{t("1. Emporter le travail")}</Label>
        <div className="mb-2 flex flex-wrap gap-2">
          <Bouton
            onClick={() => telecharger(nomFichier("sauvegarde-appels", "json"), sauvegarde(etat), "application/json")}
          >
            {t("Télécharger le fichier .json")}
          </Bouton>
          <Bouton variant="ghost" onClick={copieLeCode}>
            {t("Copier le code")}
          </Bouton>
        </div>
        <textarea
          readOnly
          rows={2}
          ref={zoneCode}
          value={code}
          onFocus={(e) => e.target.select()}
          data-role="code-de-reprise"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-[11px] text-slate-600"
        />
        <p data-role="taille-code" className="mt-1 mb-4 text-[11.5px] text-slate-500">
          {t("{n} caractères — le code doit être collé en entier, jusqu'à l'accolade finale.", { n: code.length })}
        </p>

        <Label hint={t("Sur l'appareil où tu reprends. Le fichier .json se charge, lui, par « Charger une liste d'appel ».")}>
          {t("2. Reprendre le travail ici")}
        </Label>
        <textarea
          rows={2}
          value={reprise}
          onChange={(e) => setReprise(e.target.value)}
          placeholder={t("Colle ici le code copié sur l'autre appareil")}
          data-role="collage-reprise"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-[11px] focus:border-teal-700 focus:outline-none"
        />
        <Bouton onClick={chargeLeCode} disabled={!reprise.trim()} className="mt-2 w-full">
          {t("Charger ce code")}
        </Bouton>
      </Block>

      <Block title={t("Après le transfert")} tone="warn">
        <p className="mb-3 text-[13px] text-slate-600">
          {t("À faire seulement une fois les lignes collées et le fichier Excel enregistré.")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Bouton variant="danger" onClick={onViderAppels} disabled={vide}>
            {t("Vider les appels encodés")}
          </Bouton>
          <Bouton variant="danger" onClick={onToutEffacer}>
            {t("Tout effacer (liste comprise)")}
          </Bouton>
        </div>
      </Block>

      </div>
    </div>
  );
}
