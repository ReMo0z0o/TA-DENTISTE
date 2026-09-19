// Aide-mémoire clavier, pour encoder sans lâcher les mains au bureau.
import { useT } from "../lib/i18n.js";

function Touche({ children }) {
  return (
    <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-sans text-[11.5px] text-slate-700 shadow-sm">
      {children}
    </kbd>
  );
}

export default function RaccourcisSheet() {
  const t = useT();

  const groupes = [
    {
      titre: t("Partout"),
      lignes: [
        [["Alt", "1"], t("Liste des praticiens à appeler")],
        [["Alt", "2"], t("Formulaire d'appel")],
        [["Alt", "3"], t("Journée : les appels encodés")],
        [["Alt", "4"], t("Suivi : rappels et annulations")],
        [["Alt", "5"], t("Données : import, Excel, sauvegarde")],
        [["/"], t("Aller à la recherche")],
        [["?"], t("Cette fenêtre")],
        [[t("Échap")], t("Fermer la fenêtre ouverte")],
      ],
    },
    {
      titre: t("Pendant l'encodage"),
      lignes: [
        [["Alt", "←"], t("Fiche précédente, sans enregistrer")],
        [["Alt", "→"], t("Fiche suivante, sans enregistrer")],
        [["Ctrl", t("Entrée")], t("Enregistrer et passer au praticien suivant")],
        [["Ctrl", "S"], t("Idem — le réflexe « enregistrer »")],
        [["Tab"], t("Champ ou groupe de réponses suivant")],
        [["←", "→"], t("Choisir une réponse dans le groupe sélectionné")],
        [[t("Espace")], t("Valider la réponse sélectionnée")],
      ],
    },
    {
      titre: t("Dans la liste"),
      lignes: [
        [[t("Entrée")], t("Ouvrir le formulaire du praticien sélectionné")],
        [["Tab"], t("Praticien suivant")],
      ],
    },
  ];

  return (
    <div className="pb-4">
      <p className="mb-4 text-[13px] text-slate-600">
        {t("Sur Mac, Ctrl devient ⌘.")}
      </p>
      {groupes.map((groupe) => (
        <section key={groupe.titre} className="mb-5">
          <h3 className="mb-2 text-[12px] font-semibold tracking-wide text-slate-500 uppercase">{groupe.titre}</h3>
          <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {groupe.lignes.map(([touches, description]) => (
              <div key={description} className="flex items-center justify-between gap-4 px-3 py-2">
                <dt className="flex shrink-0 items-center gap-1">
                  {touches.map((k, i) => (
                    <span key={k} className="flex items-center gap-1">
                      {i > 0 && <span className="text-[11px] text-slate-400">+</span>}
                      <Touche>{k}</Touche>
                    </span>
                  ))}
                </dt>
                <dd className="text-right text-[12.5px] text-slate-700">{description}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
