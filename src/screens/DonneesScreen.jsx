// Tout ce qui entre et tout ce qui sort : listes d'appel, fichier Excel de
// réponses, sauvegarde pour passer du bureau au téléphone.
import { useState } from "react";
import { Block, Bouton, Case, Field, Vide } from "../components/ui.jsx";
import ImportPanel from "../components/ImportPanel.jsx";
import {
  classeurNeuf,
  csv,
  nomFichier,
  remplirModele,
  sauvegarde,
  telecharger,
  templateFirstFreeRow,
  tsv,
} from "../lib/exporters.js";
import { besoinRappel, ordreExport, rdvPris } from "../lib/model.js";
import { frDate } from "../lib/dates.js";

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
  const [avecEnTete, setAvecEnTete] = useState(false);
  const [modele, setModele] = useState(null); // { nom, buffer, depart }
  const [remplissage, setRemplissage] = useState(false);
  const vide = calls.length === 0;

  const chargeModele = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const depart = await templateFirstFreeRow(buffer);
      setModele({ nom: file.name, buffer, depart: String(depart) });
      flash(`Modèle chargé : première ligne libre = ligne ${depart}.`);
    } catch (err) {
      flash(err.message || "Ce fichier Excel n'a pas pu être lu.");
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
          ? `${calls.length} appels écrits à partir de la ligne ${depart}. Vérifie le fichier avant de l'envoyer.`
          : "Téléchargement refusé par le navigateur — utilise le collage pour Excel."
      );
    } catch (err) {
      flash(err.message || "Le remplissage a échoué : utilise le collage pour Excel.");
    }
    setRemplissage(false);
  };

  const copier = async () => {
    const texte = tsv(calls, avecEnTete);
    try {
      await navigator.clipboard.writeText(texte);
      flash("Copié. Colle dans la première cellule vide de la colonne A.");
    } catch {
      flash("Copie automatique refusée — sélectionne le texte ci-dessous à la main.");
    }
  };

  return (
    <div className="pb-24">
      <ImportPanel onProspects={onProspects} onCalls={onCalls} onSauvegarde={onSauvegarde} flash={flash} />

      <Block title="Remplir le fichier Excel de Test-Achats">
        <p className="mb-3 text-[13px] text-slate-600">
          Charge ici le fichier <strong>Antwoordtabel</strong> que tu dois rendre : l'application y ajoute tes{" "}
          {calls.length} appels en gardant les titres, les listes déroulantes et la mise en forme, puis te rend le
          fichier complété.
        </p>
        <label className="mb-3 block">
          <span className="text-[13px] text-slate-600">Fichier Antwoordtabel…xlsx</span>
          <input
            type="file"
            accept=".xlsx,.xlsm"
            onChange={chargeModele}
            className="mt-1.5 block w-full text-[13px] text-slate-700 file:mr-3 file:min-h-[40px] file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-2 file:text-[13px] file:text-slate-800"
          />
        </label>
        {modele && (
          <>
            <Field
              label="Écrire à partir de la ligne"
              hint="Ligne 2 = juste sous les titres. La valeur proposée est la première ligne libre du fichier."
              type="number"
              value={modele.depart}
              onChange={(v) => setModele((m) => ({ ...m, depart: v }))}
              inputMode="numeric"
            />
            <Bouton onClick={remplir} disabled={vide || remplissage} className="w-full">
              {remplissage ? "Écriture en cours…" : `Télécharger le fichier rempli (${calls.length} appels)`}
            </Bouton>
          </>
        )}
      </Block>

      <Block title="Coller directement dans Excel">
        <p className="mb-3 text-[13px] text-slate-600">
          Le texte ci-dessous contient les {calls.length} appels dans l'ordre des 23 colonnes. Copie-le, puis colle-le
          dans la première cellule vide de la colonne A : Excel répartit les colonnes tout seul.
        </p>
        <Case checked={avecEnTete} onChange={setAvecEnTete}>
          Inclure la ligne de titres
        </Case>
        <Bouton onClick={copier} disabled={vide} className="mb-3 w-full">
          Copier pour Excel
        </Bouton>
        <textarea
          readOnly
          rows={6}
          value={tsv(calls, avecEnTete)}
          onFocus={(e) => e.target.select()}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-[11.5px] text-slate-700"
        />
      </Block>

      <Block title="Autres fichiers">
        <div className="grid gap-2 sm:grid-cols-2">
          <Bouton
            variant="ghost"
            disabled={vide}
            onClick={async () => {
              const blob = await classeurNeuf(calls);
              telecharger(nomFichier("appels-dentistes", "xlsx"), blob);
            }}
          >
            Classeur .xlsx neuf
          </Bouton>
          <Bouton
            variant="ghost"
            disabled={vide}
            onClick={() => telecharger(nomFichier("appels-dentistes", "csv"), csv(calls), "text/csv;charset=utf-8")}
          >
            Fichier .csv
          </Bouton>
          <Bouton
            variant="ghost"
            disabled={vide}
            onClick={() => telecharger(nomFichier("suivi-rappels-annulations", "csv"), csvSuivi(calls), "text/csv;charset=utf-8")}
          >
            Suivi : rappels et annulations
          </Bouton>
          <Bouton
            variant="ghost"
            onClick={() => telecharger(nomFichier("sauvegarde-appels", "json"), sauvegarde(etat), "application/json")}
          >
            Sauvegarde .json
          </Bouton>
        </div>
      </Block>

      <Block title="Changer d'appareil">
        <p className="mb-3 text-[13px] text-slate-600">
          La sauvegarde <strong>.json</strong> contient tout : la liste d'appel, les appels encodés et le suivi.
          Télécharge-la sur un appareil, puis charge-la sur l'autre (bouton « Fichier » plus haut). Le code ci-dessous
          fait la même chose par copier-coller si le fichier ne passe pas.
        </p>
        <textarea
          readOnly
          rows={3}
          value={sauvegarde(etat)}
          onFocus={(e) => e.target.select()}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-[11px] text-slate-600"
        />
      </Block>

      <Block title="Après le transfert" tone="warn">
        <p className="mb-3 text-[13px] text-slate-600">
          À faire seulement une fois les lignes collées et le fichier Excel enregistré.
        </p>
        <div className="flex flex-wrap gap-2">
          <Bouton variant="danger" onClick={onViderAppels} disabled={vide}>
            Vider les appels encodés
          </Bouton>
          <Bouton variant="danger" onClick={onToutEffacer}>
            Tout effacer (liste comprise)
          </Bouton>
        </div>
      </Block>

      {vide && <Vide>Aucun appel encodé pour l'instant : les exports seront vides.</Vide>}
    </div>
  );
}
