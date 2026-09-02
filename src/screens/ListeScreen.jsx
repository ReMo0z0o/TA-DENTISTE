import { useMemo, useRef, useState } from "react";
import { Bouton, Puce, Vide, useRaccourciRecherche } from "../components/ui.jsx";
import { ETATS_PROSPECT, estOriente, fichesDeLaMission, phoneKey, telHref } from "../lib/model.js";
import { frDate } from "../lib/dates.js";
import { useT } from "../lib/i18n.js";

const ETAT_PAR_CLE = Object.fromEntries(ETATS_PROSPECT.map((e) => [e.key, e]));

function sansAccents(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/* ------------------------------------------------- téléphone (bureau) */

function Telephone({ numero, flash }) {
  const t = useT();
  const tel = telHref(numero);
  if (!numero) return <span className="text-slate-400">—</span>;
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <a href={tel} className="text-slate-800 tabular-nums hover:text-teal-800 hover:underline">
        {numero}
      </a>
      <button
        onClick={async (e) => {
          e.stopPropagation();
          try {
            await navigator.clipboard.writeText(numero);
            flash?.(t("Numéro copié : {numero}", { numero }));
          } catch {
            flash?.(t("Copie refusée par le navigateur."));
          }
        }}
        title={t("Copier le numéro")}
        className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-500 hover:border-slate-400 hover:text-slate-700"
      >
        {t("copier")}
      </button>
    </span>
  );
}

/* ------------------------------------------------------ carte (mobile) */

function Carte({ fiche, appel, doublon, onEncoder, onEtat, onSupprimer }) {
  const t = useT();
  const [ouvert, setOuvert] = useState(false);
  const etat = ETAT_PAR_CLE[fiche.etat] || ETAT_PAR_CLE.a_appeler;
  const tel = telHref(fiche.telephone);
  return (
    <li
      className={
        "mb-2 rounded-xl border p-3 " +
        (estOriente(fiche) ? "border-amber-300 bg-amber-50/60" : "border-slate-200 bg-white")
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {fiche.ordre && <span className="text-[12px] text-slate-400">{fiche.ordre}</span>}
            <span className="truncate text-[15px] font-medium text-slate-900">{fiche.nom}</span>
            {estOriente(fiche) && <Puce tone="amber">{t("dentiste Y")}</Puce>}
          </div>
          {estOriente(fiche) && fiche.orientePar && (
            <div className="mt-0.5 text-[11.5px] text-amber-700">
              {t("proposé par {nom}", { nom: fiche.orientePar })}
            </div>
          )}
          <div className="mt-0.5 truncate text-[12px] text-slate-500">
            {[fiche.commune, fiche.cp, fiche.province].filter(Boolean).join(" · ")}
          </div>
          {fiche.statut && (
            <div className="mt-1">
              <Puce tone="teal">{t.valeur(fiche.statut)}</Puce>
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <Puce tone={etat.tone}>{t(etat.label)}</Puce>
          {appel && (
            <div className="mt-1 text-[11px] text-slate-500">
              {frDate(appel.dateAppel)} {appel.heureAppel}
            </div>
          )}
        </div>
      </div>

      {doublon && (
        <div className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-[11.5px] text-red-700">
          {t("Même numéro que « {nom} » — ne pas appeler deux fois le même cabinet.", { nom: doublon })}
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
          {appel ? t("Revoir l'appel") : t("Encoder")}
        </Bouton>
        <button
          onClick={() => setOuvert(!ouvert)}
          className="min-h-[42px] rounded-lg border border-slate-300 px-3 text-[13px] text-slate-600"
          aria-label={t("Plus d'options")}
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
                {t(e.label)}
              </button>
            ))}
          </div>
          <button onClick={() => onSupprimer(fiche.id)} className="text-[12.5px] text-red-700 underline underline-offset-2">
            {t("Retirer de la liste")}
          </button>
        </div>
      )}
    </li>
  );
}

/* ------------------------------------------------------ ligne (bureau) */

function Ligne({ fiche, appel, doublon, onEncoder, onEtat, onSupprimer, flash }) {
  const t = useT();
  return (
    <tr
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) {
          e.preventDefault();
          onEncoder(fiche);
        }
      }}
      onDoubleClick={() => onEncoder(fiche)}
      className={
        "border-t border-slate-100 align-middle focus:bg-teal-50 focus:outline-none " +
        (estOriente(fiche) ? "bg-amber-50/60 hover:bg-amber-50 " : "hover:bg-slate-50 ") +
        (fiche.etat === "fait" ? "text-slate-500" : "")
      }
    >
      <td className="py-1.5 pr-2 pl-3 text-[12px] text-slate-400 tabular-nums">{fiche.ordre}</td>
      <td className="py-1.5 pr-3">
        <button
          onClick={() => onEncoder(fiche)}
          className="text-left text-[13.5px] font-medium text-slate-900 hover:text-teal-800 hover:underline"
        >
          {fiche.nom}
        </button>
        {estOriente(fiche) && (
          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-amber-800">
            {t("dentiste Y")}
          </span>
        )}
        {doublon && (
          <span className="ml-2 text-[11px] text-red-700" title={t("Même numéro que {nom}", { nom: doublon })}>
            {t("doublon")}
          </span>
        )}
        {estOriente(fiche) && fiche.orientePar ? (
          <div className="text-[11.5px] text-amber-700">{t("proposé par {nom}", { nom: fiche.orientePar })}</div>
        ) : (
          fiche.adresse && <div className="text-[11.5px] text-slate-500">{fiche.adresse}</div>
        )}
      </td>
      <td className="py-1.5 pr-3 text-[12.5px] whitespace-nowrap text-slate-600">
        {fiche.commune}
        {fiche.cp ? <span className="text-slate-400"> {fiche.cp}</span> : null}
      </td>
      <td className="py-1.5 pr-3 text-[12px] text-slate-600">
        {t.valeur(fiche.statut) || <span className="text-slate-300">—</span>}
      </td>
      <td className="py-1.5 pr-3 text-[12.5px]">
        <Telephone numero={fiche.telephone} flash={flash} />
      </td>
      <td className="py-1.5 pr-3">
        <select
          value={fiche.etat}
          onChange={(e) => onEtat(fiche.id, e.target.value)}
          className={
            "min-h-[30px] rounded-md border px-1.5 py-0.5 text-[12px] focus:border-teal-700 focus:outline-none " +
            (fiche.etat === "fait"
              ? "border-teal-200 bg-teal-50 text-teal-800"
              : fiche.etat === "a_appeler"
                ? "border-slate-300 bg-white text-slate-700"
                : "border-amber-200 bg-amber-50 text-amber-800")
          }
        >
          {ETATS_PROSPECT.map((e) => (
            <option key={e.key} value={e.key}>
              {t(e.label)}
            </option>
          ))}
        </select>
      </td>
      <td className="py-1.5 pr-3 text-[11.5px] whitespace-nowrap text-slate-500">
        {appel ? `${frDate(appel.dateAppel)} ${appel.heureAppel}` : ""}
      </td>
      <td className="py-1.5 pr-3 text-right whitespace-nowrap">
        <button
          onClick={() => onEncoder(fiche)}
          className="rounded-md border border-slate-300 px-2 py-1 text-[12px] text-slate-700 hover:border-teal-700 hover:text-teal-800"
        >
          {appel ? t("Revoir") : t("Encoder")}
        </button>
        <button
          onClick={() => onSupprimer(fiche.id)}
          title={t("Retirer de la liste")}
          className="ml-1 rounded-md px-1.5 py-1 text-[12px] text-slate-400 hover:text-red-700"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------- écran */

export default function ListeScreen({ prospects, calls, onEncoder, onEtat, onSupprimer, onImporter, onVider, flash }) {
  const t = useT();
  const [filtre, setFiltre] = useState("tous");
  const [recherche, setRecherche] = useState("");
  const champRecherche = useRef(null);
  useRaccourciRecherche(champRecherche);

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
      // un dentiste Y partage le numéro de sa pratique de groupe : c'est normal,
      // ce n'est pas le doublon que le scénario demande d'éviter
      if (!cle || estOriente(f)) continue;
      if (vus.has(cle)) out.set(f.id, vus.get(cle));
      else vus.set(cle, f.nom);
    }
    return out;
  }, [prospects]);

  const filtres = useMemo(() => {
    const q = sansAccents(recherche.trim());
    return prospects.filter((f) => {
      if (filtre === "orientes") {
        if (!estOriente(f)) return false;
      } else if (filtre !== "tous" && f.etat !== filtre) return false;
      if (!q) return true;
      return sansAccents([f.nom, f.commune, f.cp, f.telephone, f.adresse, f.inami, f.orientePar].join(" ")).includes(q);
    });
  }, [prospects, filtre, recherche]);

  // le quota porte sur le fichier de la mission, pas sur les dentistes Y ajoutés
  const mission = fichesDeLaMission(prospects);
  const orientes = prospects.filter(estOriente);
  const faits = mission.filter((f) => f.etat === "fait").length;
  const restants = prospects.filter((f) => f.etat === "a_appeler");
  const pourcent = mission.length ? Math.round((faits / mission.length) * 100) : 0;

  if (!prospects.length) {
    return (
      <div className="pb-24 lg:pb-0">
        <Vide>
          <p className="mb-3">
            {t("Aucune liste d'appel chargée. Importe ton fichier de praticiens : province, nom et téléphone seront déjà remplis à chaque appel.")}
          </p>
          <Bouton onClick={onImporter}>{t("Charger une liste d'appel")}</Bouton>
        </Vide>
      </div>
    );
  }

  const commun = { onEncoder, onEtat, onSupprimer };

  return (
    <div className="pb-24 lg:pb-0">
      <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3 lg:hidden">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-medium text-slate-700">
            {t("{faits} / {total} appelés", { faits, total: mission.length })}
          </span>
          <span className="text-[12px] text-slate-500">{t("{n} restants", { n: restants.length })}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-teal-700 transition-all" style={{ width: `${pourcent}%` }} />
        </div>
        {restants.length > 0 && (
          <Bouton onClick={() => onEncoder(restants[0])} className="mt-3 w-full">
            {t("Appeler le suivant : {nom}", { nom: restants[0].nom })}
          </Bouton>
        )}
      </div>

      <div className="mb-3 lg:flex lg:items-center lg:gap-3">
        <div className="relative lg:flex-1">
          <input
            ref={champRecherche}
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={t("Chercher un nom, une commune, un numéro…")}
            className="mb-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[15px] focus:border-teal-700 focus:outline-none lg:mb-0 lg:min-h-[38px] lg:py-1.5 lg:pr-10 lg:text-[14px]"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 text-[11px] text-slate-400 lg:block">
            /
          </kbd>
        </div>
        {restants.length > 0 && (
          <Bouton onClick={() => onEncoder(restants[0])} className="hidden shrink-0 lg:block">
            {t("Appeler le suivant : {nom}", { nom: restants[0].nom })}
          </Bouton>
        )}
      </div>

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {[
          { key: "tous", label: "Tous" },
          ...ETATS_PROSPECT,
          ...(orientes.length ? [{ key: "orientes", label: "dentiste Y", tone: "amber" }] : []),
        ].map((e) => {
          const n =
            e.key === "tous"
              ? prospects.length
              : e.key === "orientes"
                ? orientes.length
                : prospects.filter((f) => f.etat === e.key).length;
          const actif = filtre === e.key;
          return (
            <button
              key={e.key}
              onClick={() => setFiltre(e.key)}
              className={
                "min-h-[36px] shrink-0 rounded-lg border px-3 py-1.5 text-[12.5px] lg:min-h-[30px] lg:py-1 " +
                (actif
                  ? e.tone === "amber"
                    ? "border-amber-500 bg-amber-500 text-white"
                    : "border-teal-800 bg-teal-800 text-white"
                  : e.tone === "amber"
                    ? "border-amber-300 bg-amber-50 text-amber-800 hover:border-amber-400"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-400")
              }
            >
              {t(e.label)} {n > 0 && <span className="opacity-70">{n}</span>}
            </button>
          );
        })}
      </div>

      {/* tableau : lecture en un coup d'œil sur grand écran */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white lg:block">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 text-[11px] tracking-wide text-slate-500 uppercase">
              <th className="py-2 pr-2 pl-3 text-left font-semibold">{t("N°")}</th>
              <th className="py-2 pr-3 text-left font-semibold">{t("Praticien")}</th>
              <th className="py-2 pr-3 text-left font-semibold">{t("Commune")}</th>
              <th className="py-2 pr-3 text-left font-semibold">{t("Statut Inami")}</th>
              <th className="py-2 pr-3 text-left font-semibold">{t("Téléphone")}</th>
              <th className="py-2 pr-3 text-left font-semibold">{t("État")}</th>
              <th className="py-2 pr-3 text-left font-semibold">{t("Appelé le")}</th>
              <th className="py-2 pr-3" />
            </tr>
          </thead>
          <tbody>
            {filtres.map((fiche) => (
              <Ligne
                key={fiche.id}
                fiche={fiche}
                appel={appelParFiche.get(fiche.id)}
                doublon={doublons.get(fiche.id)}
                flash={flash}
                {...commun}
              />
            ))}
          </tbody>
        </table>
        {!filtres.length && (
          <div className="p-6 text-center text-[13px] text-slate-500">{t("Aucun praticien ne correspond.")}</div>
        )}
      </div>

      {/* cartes : plus lisibles au pouce */}
      <ul className="lg:hidden">
        {filtres.map((fiche) => (
          <Carte
            key={fiche.id}
            fiche={fiche}
            appel={appelParFiche.get(fiche.id)}
            doublon={doublons.get(fiche.id)}
            {...commun}
          />
        ))}
      </ul>
      {!filtres.length && (
        <div className="lg:hidden">
          <Vide>{t("Aucun praticien ne correspond à ce filtre.")}</Vide>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Bouton variant="ghost" onClick={onImporter}>
          {t("Ajouter une autre liste")}
        </Bouton>
        <Bouton variant="danger" onClick={onVider}>
          {t("Vider la liste d'appel")}
        </Bouton>
      </div>
    </div>
  );
}
