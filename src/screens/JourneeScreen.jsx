import { useMemo, useState } from "react";
import { Bouton, Puce, Vide } from "../components/ui.jsx";
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

export default function JourneeScreen({ calls, onEditer, onSupprimer, onDentisteY }) {
  const [recherche, setRecherche] = useState("");
  const [ouvert, setOuvert] = useState(null);

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

  return (
    <div className="pb-24">
      <input
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="Chercher dans les appels…"
        className="mb-3 min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[15px] focus:border-teal-700 focus:outline-none"
      />

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
                  "mb-2 rounded-xl border bg-white p-3 " + (call.roleY ? "border-amber-300 bg-amber-50/60" : "border-slate-200")
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
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
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
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
