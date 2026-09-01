import { useMemo, useState } from "react";
import { Bouton, Puce, Vide } from "../components/ui.jsx";
import { ETATS_PROSPECT, phoneKey, telHref } from "../lib/model.js";
import { frDate } from "../lib/dates.js";

const ETAT_PAR_CLE = Object.fromEntries(ETATS_PROSPECT.map((e) => [e.key, e]));

function Ligne({ fiche, appel, doublon, onEncoder, onEtat, onSupprimer }) {
  const [ouvert, setOuvert] = useState(false);
  const etat = ETAT_PAR_CLE[fiche.etat] || ETAT_PAR_CLE.a_appeler;
  const tel = telHref(fiche.telephone);
  return (
    <li className="mb-2 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {fiche.ordre && <span className="text-[12px] text-slate-400">{fiche.ordre}</span>}
            <span className="truncate text-[15px] font-medium text-slate-900">{fiche.nom}</span>
          </div>
          <div className="mt-0.5 truncate text-[12px] text-slate-500">
            {[fiche.commune, fiche.cp, fiche.province].filter(Boolean).join(" · ")}
          </div>
          {fiche.statut && (
            <div className="mt-1">
              <Puce tone="teal">{fiche.statut}</Puce>
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <Puce tone={etat.tone}>{etat.label}</Puce>
          {appel && (
            <div className="mt-1 text-[11px] text-slate-500">
              {frDate(appel.dateAppel)} {appel.heureAppel}
            </div>
          )}
        </div>
      </div>

      {doublon && (
        <div className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-[11.5px] text-red-700">
          Même numéro que « {doublon} » — ne pas appeler deux fois le même cabinet.
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        {tel && (
          <a
            href={tel}
            className="inline-flex min-h-[42px] flex-1 items-center justify-center rounded-lg bg-teal-800 px-3 py-2 text-[13.5px] font-medium whitespace-nowrap text-white active:bg-teal-900"
          >
            {fiche.telephone}
          </a>
        )}
        <Bouton variant="ghost" onClick={() => onEncoder(fiche)} className="flex-1">
          {appel ? "Revoir l'appel" : "Encoder"}
        </Bouton>
        <button
          onClick={() => setOuvert(!ouvert)}
          className="min-h-[42px] rounded-lg border border-slate-300 px-3 text-[13px] text-slate-600"
          aria-label="Plus d'options"
        >
          ⋯
        </button>
      </div>

      {ouvert && (
        <div className="mt-3 border-t border-slate-200 pt-3">
          {fiche.adresse && <div className="mb-2 text-[12.5px] text-slate-600">{fiche.adresse}</div>}
          {fiche.inami && <div className="mb-2 text-[12px] text-slate-500">INAMI {fiche.inami}</div>}
          <div className="mb-3 flex flex-wrap gap-2">
            {[fiche.site, fiche.site2].filter(Boolean).map((s) => (
              <a
                key={s}
                href={s.startsWith("http") ? s : `https://${s}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-[12px] text-slate-700"
              >
                {s}
              </a>
            ))}
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {ETATS_PROSPECT.map((e) => (
              <button
                key={e.key}
                onClick={() => onEtat(fiche.id, e.key)}
                className={
                  "min-h-[38px] rounded-lg border px-2.5 py-1.5 text-[12.5px] " +
                  (fiche.etat === e.key
                    ? "border-teal-800 bg-teal-800 text-white"
                    : "border-slate-300 bg-white text-slate-700")
                }
              >
                {e.label}
              </button>
            ))}
          </div>
          <button onClick={() => onSupprimer(fiche.id)} className="text-[12.5px] text-red-700 underline underline-offset-2">
            Retirer de la liste
          </button>
        </div>
      )}
    </li>
  );
}

export default function ListeScreen({ prospects, calls, onEncoder, onEtat, onSupprimer, onImporter, onVider }) {
  const [filtre, setFiltre] = useState("tous");
  const [recherche, setRecherche] = useState("");

  const appelParFiche = useMemo(() => {
    const map = new Map();
    for (const c of calls) if (c.prospectId) map.set(c.prospectId, c);
    return map;
  }, [calls]);

  const doublons = useMemo(() => {
    const vus = new Map();
    const out = new Map();
    for (const f of prospects) {
      const cle = phoneKey(f.telephone);
      if (!cle) continue;
      if (vus.has(cle)) out.set(f.id, vus.get(cle));
      else vus.set(cle, f.nom);
    }
    return out;
  }, [prospects]);

  const filtres = useMemo(() => {
    const q = recherche
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return prospects.filter((f) => {
      if (filtre !== "tous" && f.etat !== filtre) return false;
      if (!q) return true;
      const texte = [f.nom, f.commune, f.cp, f.telephone, f.adresse, f.inami]
        .join(" ")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return texte.includes(q);
    });
  }, [prospects, filtre, recherche]);

  const faits = prospects.filter((f) => f.etat === "fait").length;
  const restants = prospects.filter((f) => f.etat === "a_appeler");
  const pourcent = prospects.length ? Math.round((faits / prospects.length) * 100) : 0;

  if (!prospects.length) {
    return (
      <div className="pb-24">
        <Vide>
          <p className="mb-3">
            Aucune liste d'appel chargée. Importe ton fichier de praticiens : province, nom et téléphone seront déjà
            remplis à chaque appel.
          </p>
          <Bouton onClick={onImporter}>Charger une liste d'appel</Bouton>
        </Vide>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-medium text-slate-700">
            {faits} / {prospects.length} appelés
          </span>
          <span className="text-[12px] text-slate-500">{restants.length} restants</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-teal-700 transition-all" style={{ width: `${pourcent}%` }} />
        </div>
        {restants.length > 0 && (
          <Bouton onClick={() => onEncoder(restants[0])} className="mt-3 w-full">
            Appeler le suivant : {restants[0].nom}
          </Bouton>
        )}
      </div>

      <input
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="Chercher un nom, une commune, un numéro…"
        className="mb-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[15px] focus:border-teal-700 focus:outline-none"
      />

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {[{ key: "tous", label: "Tous" }, ...ETATS_PROSPECT].map((e) => {
          const n = e.key === "tous" ? prospects.length : prospects.filter((f) => f.etat === e.key).length;
          return (
            <button
              key={e.key}
              onClick={() => setFiltre(e.key)}
              className={
                "min-h-[36px] shrink-0 rounded-lg border px-3 py-1.5 text-[12.5px] " +
                (filtre === e.key ? "border-teal-800 bg-teal-800 text-white" : "border-slate-300 bg-white text-slate-700")
              }
            >
              {e.label} {n > 0 && <span className="opacity-70">{n}</span>}
            </button>
          );
        })}
      </div>

      <ul>
        {filtres.map((fiche) => (
          <Ligne
            key={fiche.id}
            fiche={fiche}
            appel={appelParFiche.get(fiche.id)}
            doublon={doublons.get(fiche.id)}
            onEncoder={onEncoder}
            onEtat={onEtat}
            onSupprimer={onSupprimer}
          />
        ))}
      </ul>
      {!filtres.length && <Vide>Aucun praticien ne correspond à ce filtre.</Vide>}

      <div className="mt-4 flex flex-wrap gap-2">
        <Bouton variant="ghost" onClick={onImporter}>
          Ajouter une autre liste
        </Bouton>
        <Bouton variant="danger" onClick={onVider}>
          Vider la liste d'appel
        </Bouton>
      </div>
    </div>
  );
}
