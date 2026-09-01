import { useMemo, useRef, useState } from "react";
import { Bouton, Puce, Vide, useRaccourciRecherche } from "../components/ui.jsx";
import { besoinRappel, ordreExport } from "../lib/model.js";
import { dateLongue, frDate } from "../lib/dates.js";

function Resume({ call }) {
  if (call.rdvPossible === "oui") {
    return (
      <>
        RDV le <strong>{frDate(call.datePremierRdv) || "?"}</strong>
        {call.supplementPremierRdv ? ` — ${call.supplementPremierRdv}` : ""}
        {call.prix ? ` · ${call.prix} €` : ""}
      </>
    );
  }
  if (call.rdvPossible === "non") {
    return <>Pas de rendez-vous{call.raison ? ` — ${call.raison}` : ""}</>;
  }
  return <span className="text-slate-400">Résultat non renseigné</span>;
}

function Actions({ call, onEditer, onSupprimer, onDentisteY, compact }) {
  return (
    <div className={compact ? "flex flex-wrap gap-2" : "flex justify-end gap-1 whitespace-nowrap"}>
      {compact ? (
        <>
          <Bouton variant="ghost" onClick={() => onEditer(call)}>
            Modifier
          </Bouton>
          {!call.roleY && (
            <Bouton variant="ghost" onClick={() => onDentisteY(call)}>
              Ajouter le dentiste Y
            </Bouton>
          )}
          <Bouton variant="danger" onClick={() => onSupprimer(call.id)}>
            Supprimer
          </Bouton>
        </>
      ) : (
        <>
          <button
            onClick={() => onEditer(call)}
            className="rounded-md border border-slate-300 px-2 py-1 text-[12px] text-slate-700 hover:border-teal-700 hover:text-teal-800"
          >
            Modifier
          </button>
          {!call.roleY && (
            <button
              onClick={() => onDentisteY(call)}
              title="Encoder le dentiste Y de la même pratique"
              className="rounded-md border border-slate-300 px-2 py-1 text-[12px] text-slate-700 hover:border-amber-500 hover:text-amber-700"
            >
              + Y
            </button>
          )}
          <button
            onClick={() => onSupprimer(call.id)}
            title="Supprimer cet appel"
            className="rounded-md px-1.5 py-1 text-[12px] text-slate-400 hover:text-red-700"
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}

export default function JourneeScreen({ calls, onEditer, onSupprimer, onDentisteY }) {
  const [recherche, setRecherche] = useState("");
  const [ouvert, setOuvert] = useState(null);
  const champRecherche = useRef(null);
  useRaccourciRecherche(champRecherche);

  const groupes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const filtres = ordreExport(calls).filter((c) =>
      !q ? true : [c.dentiste, c.telephone, c.province, c.remarques].join(" ").toLowerCase().includes(q)
    );
    const map = new Map();
    for (const call of filtres) {
      const cle = call.dateAppel || "sans date";
      if (!map.has(cle)) map.set(cle, []);
      map.get(cle).push(call);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [calls, recherche]);

  if (!calls.length) {
    return <Vide>Aucun appel enregistré pour l'instant. Commence par l'onglet « Liste » ou « Appel ».</Vide>;
  }

  const actions = { onEditer, onSupprimer, onDentisteY };

  return (
    <div className="pb-24 lg:pb-0">
      <div className="relative mb-3 lg:max-w-md">
        <input
          ref={champRecherche}
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Chercher dans les appels…"
          className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[15px] focus:border-teal-700 focus:outline-none lg:min-h-[38px] lg:py-1.5 lg:pr-10 lg:text-[14px]"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 text-[11px] text-slate-400 lg:block">
          /
        </kbd>
      </div>

      {/* tableau : la journée se relit comme le fichier Excel */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white lg:block">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 text-[11px] tracking-wide text-slate-500 uppercase">
              <th className="py-2 pr-2 pl-3 text-left font-semibold">Heure</th>
              <th className="py-2 pr-3 text-left font-semibold">Dentiste</th>
              <th className="py-2 pr-3 text-left font-semibold">Statut</th>
              <th className="py-2 pr-3 text-left font-semibold">Résultat</th>
              <th className="py-2 pr-3 text-left font-semibold">1er RDV</th>
              <th className="py-2 pr-3 text-left font-semibold">Tarif</th>
              <th className="py-2 pr-3 text-left font-semibold">Prix</th>
              <th className="py-2 pr-3 text-left font-semibold">Remarques</th>
              <th className="py-2 pr-3" />
            </tr>
          </thead>
          <tbody>
            {groupes.map(([date, liste]) => (
              <JourGroupe key={date} date={date} liste={liste} actions={actions} />
            ))}
          </tbody>
        </table>
      </div>

      {/* cartes : lecture au pouce */}
      <div className="lg:hidden">
        {groupes.map(([date, liste]) => (
          <section key={date} className="mb-5">
            <h2 className="mb-2 text-[12px] font-semibold tracking-wide text-slate-500 uppercase">
              {date === "sans date" ? "Sans date" : dateLongue(date)} · {liste.length} appel{liste.length > 1 ? "s" : ""}
            </h2>
            <ul>
              {liste.map((call) => (
                <li
                  key={call.id}
                  className={
                    "mb-2 rounded-xl border bg-white p-3 " +
                    (call.roleY ? "border-amber-300 bg-amber-50/60" : "border-slate-200")
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-medium text-slate-900">{call.dentiste || "Sans nom"}</span>
                        {call.heureAppel && <Puce>{call.heureAppel}</Puce>}
                        {call.roleY && <Puce tone="amber">dentiste Y</Puce>}
                        {besoinRappel(call) && !call.rappelFait && <Puce tone="amber">à rappeler</Puce>}
                      </div>
                      <div className="mt-0.5 text-[12px] text-slate-500">
                        {[call.province, call.statut, call.telephone].filter(Boolean).join(" · ")}
                      </div>
                      <div className="mt-1 text-[13px] text-slate-700">
                        <Resume call={call} />
                      </div>
                      {call.remarques && <div className="mt-1 text-[12px] text-slate-500 italic">{call.remarques}</div>}
                    </div>
                    <button
                      onClick={() => setOuvert(ouvert === call.id ? null : call.id)}
                      className="min-h-[38px] shrink-0 rounded-lg border border-slate-300 px-3 text-[13px] text-slate-600"
                    >
                      ⋯
                    </button>
                  </div>

                  {ouvert === call.id && (
                    <div className="mt-3 border-t border-slate-200 pt-3">
                      <Actions call={call} compact {...actions} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/** Un jour d'appels dans le tableau : un intertitre puis ses lignes. */
function JourGroupe({ date, liste, actions }) {
  return (
    <>
      <tr>
        <td
          colSpan={9}
          className="border-t border-slate-200 bg-slate-50/70 py-1.5 pl-3 text-[11.5px] font-semibold tracking-wide text-slate-500 uppercase"
        >
          {date === "sans date" ? "Sans date" : dateLongue(date)} · {liste.length} appel{liste.length > 1 ? "s" : ""}
        </td>
      </tr>
      {liste.map((call) => (
        <tr key={call.id} className={"border-t border-slate-100 " + (call.roleY ? "bg-amber-50/50" : "hover:bg-slate-50")}>
          <td className="py-1.5 pr-2 pl-3 text-[12px] text-slate-500 tabular-nums">{call.heureAppel || "—"}</td>
          <td className="py-1.5 pr-3">
            <button
              onClick={() => actions.onEditer(call)}
              className="text-left text-[13.5px] font-medium text-slate-900 hover:text-teal-800 hover:underline"
            >
              {call.dentiste || "Sans nom"}
            </button>
            <div className="flex flex-wrap items-center gap-1.5">
              {call.roleY && <Puce tone="amber">dentiste Y</Puce>}
              {besoinRappel(call) && !call.rappelFait && <Puce tone="amber">à rappeler</Puce>}
              <span className="text-[11.5px] text-slate-500">{call.telephone}</span>
            </div>
          </td>
          <td className="py-1.5 pr-3 text-[12px] text-slate-600">{call.statut || <span className="text-slate-300">—</span>}</td>
          <td className="py-1.5 pr-3 text-[12.5px]">
            {call.rdvPossible === "oui" ? (
              <span className="text-teal-800">rendez-vous</span>
            ) : call.rdvPossible === "non" ? (
              <span className="text-amber-800">refus{call.raison ? ` · ${call.raison}` : ""}</span>
            ) : (
              <span className="text-slate-300">—</span>
            )}
          </td>
          <td className="py-1.5 pr-3 text-[12.5px] whitespace-nowrap text-slate-700 tabular-nums">
            {frDate(call.datePremierRdv) || <span className="text-slate-300">—</span>}
          </td>
          <td className="py-1.5 pr-3 text-[12px] text-slate-600">
            {call.supplementPremierRdv || <span className="text-slate-300">—</span>}
          </td>
          <td className="py-1.5 pr-3 text-[12.5px] text-slate-700 tabular-nums">
            {call.prix ? `${call.prix} €` : <span className="text-slate-300">—</span>}
          </td>
          <td className="max-w-[220px] truncate py-1.5 pr-3 text-[12px] text-slate-500" title={call.remarques}>
            {call.remarques}
          </td>
          <td className="py-1.5 pr-3">
            <Actions call={call} {...actions} />
          </td>
        </tr>
      ))}
    </>
  );
}
