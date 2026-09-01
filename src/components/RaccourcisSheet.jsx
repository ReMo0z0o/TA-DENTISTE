// Aide-mémoire clavier, pour encoder sans lâcher les mains au bureau.

const GROUPES = [
  {
    titre: "Partout",
    lignes: [
      [["Alt", "1"], "Liste des praticiens à appeler"],
      [["Alt", "2"], "Formulaire d'appel"],
      [["Alt", "3"], "Journée : les appels encodés"],
      [["Alt", "4"], "Suivi : rappels et annulations"],
      [["Alt", "5"], "Données : import, Excel, sauvegarde"],
      [["/"], "Aller à la recherche"],
      [["?"], "Cette fenêtre"],
      [["Échap"], "Fermer la fenêtre ouverte"],
    ],
  },
  {
    titre: "Pendant l'encodage",
    lignes: [
      [["Ctrl", "Entrée"], "Enregistrer et passer au praticien suivant"],
      [["Ctrl", "S"], "Idem — le réflexe « enregistrer »"],
      [["Tab"], "Champ ou groupe de réponses suivant"],
      [["←", "→"], "Choisir une réponse dans le groupe sélectionné"],
      [["Espace"], "Valider la réponse sélectionnée"],
    ],
  },
  {
    titre: "Dans la liste",
    lignes: [
      [["Entrée"], "Ouvrir le formulaire du praticien sélectionné"],
      [["Tab"], "Praticien suivant"],
    ],
  },
];

function Touche({ children }) {
  return (
    <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-sans text-[11.5px] text-slate-700 shadow-sm">
      {children}
    </kbd>
  );
}

export default function RaccourcisSheet() {
  return (
    <div className="pb-4">
      <p className="mb-4 text-[13px] text-slate-600">
        Sur Mac, <Touche>Ctrl</Touche> devient <Touche>⌘</Touche>.
      </p>
      {GROUPES.map((groupe) => (
        <section key={groupe.titre} className="mb-5">
          <h3 className="mb-2 text-[12px] font-semibold tracking-wide text-slate-500 uppercase">{groupe.titre}</h3>
          <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {groupe.lignes.map(([touches, description]) => (
              <div key={description} className="flex items-center justify-between gap-4 px-3 py-2">
                <dt className="flex shrink-0 items-center gap-1">
                  {touches.map((t, i) => (
                    <span key={t} className="flex items-center gap-1">
                      {i > 0 && <span className="text-[11px] text-slate-400">+</span>}
                      <Touche>{t}</Touche>
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
