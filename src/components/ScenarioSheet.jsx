// Le scénario complet, consultable pendant l'appel sans quitter la saisie.
import { CONSIGNES, PHRASE_OUVERTURE, REPONSES_TYPES, SCENARIOS } from "../lib/scenario.js";

export default function ScenarioSheet() {
  return (
    <div className="pb-4">
      <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50 p-3">
        <div className="mb-1 text-[11px] font-semibold tracking-wide text-teal-700 uppercase">Ouverture</div>
        <p className="text-[14px] leading-snug text-teal-900 italic">« {PHRASE_OUVERTURE} »</p>
      </div>

      <section className="mb-5">
        <h3 className="mb-2 text-[12px] font-semibold tracking-wide text-slate-500 uppercase">
          Si le secrétariat pose une question
        </h3>
        <dl className="space-y-2">
          {REPONSES_TYPES.map((item) => (
            <div key={item.q} className="rounded-lg border border-slate-200 p-2.5">
              <dt className="text-[12.5px] text-slate-600">{item.q}</dt>
              <dd className="mt-0.5 text-[13.5px] font-medium text-slate-900">{item.r}</dd>
            </div>
          ))}
        </dl>
      </section>

      {SCENARIOS.map((s) => (
        <section key={s.id} className="mb-5">
          <h3 className="text-[13px] font-semibold text-teal-900">{s.titre}</h3>
          <p className="mb-2 text-[12px] text-slate-500">{s.quand}</p>
          <ol className="space-y-2">
            {s.etapes.map((e, i) => (
              <li key={i} className="rounded-lg border border-slate-200 p-2.5">
                <div className="text-[13.5px] text-slate-900">{e.dire}</div>
                {e.note && <div className="mt-0.5 text-[12px] text-slate-500">{e.note}</div>}
              </li>
            ))}
          </ol>
        </section>
      ))}

      <section>
        <h3 className="mb-2 text-[12px] font-semibold tracking-wide text-slate-500 uppercase">Consignes de la mission</h3>
        <ul className="space-y-1.5">
          {CONSIGNES.map((c) => (
            <li key={c} className="flex gap-2 text-[12.5px] leading-snug text-slate-700">
              <span className="text-slate-400">•</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
