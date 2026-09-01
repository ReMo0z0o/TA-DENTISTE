// Ce que le scénario demande APRÈS l'appel : rappeler avec l'autre profil,
// annuler les rendez-vous au bon moment, surveiller le registre national.
import { Block, Bouton, Choice, Field, Puce, Vide } from "../components/ui.jsx";
import { OUI_NON, besoinRappel, rdvPris, telHref } from "../lib/model.js";
import { dateLongue, frDate, joursRestants, today } from "../lib/dates.js";
import { lienRegistre } from "../lib/scenario.js";
import { useT } from "../lib/i18n.js";

function Echeance({ iso }) {
  const t = useT();
  const jours = joursRestants(iso);
  if (jours === null) return null;
  if (jours < 0) return <Puce tone="red">{t("en retard de {n} j", { n: -jours })}</Puce>;
  if (jours === 0) return <Puce tone="amber">{t("aujourd'hui")}</Puce>;
  if (jours === 1) return <Puce tone="amber">{t("demain")}</Puce>;
  return <Puce>{t("dans {n} j", { n: jours })}</Puce>;
}

export default function SuiviScreen({ calls, majAppel, controles, onControle }) {
  const t = useT();
  const rappels = calls.filter((c) => besoinRappel(c) && !c.rappelFait);
  const rappelsFaits = calls.filter((c) => besoinRappel(c) && c.rappelFait);
  const annulations = calls
    .filter((c) => rdvPris(c) && !c.annulation?.faiteLe)
    .sort((a, b) => String(a.annulation?.prevueLe).localeCompare(String(b.annulation?.prevueLe)));
  const dernierControle = controles[controles.length - 1];

  return (
    <div className="pb-24 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5 lg:pb-0">
      <Block title={t("Rappels avec le profil « intervention majorée »")}>
        <p className="mb-3 text-[13px] text-slate-600">
          {t("Le scénario demande de rappeler le lendemain, avec une voix d'homme et l'autre profil, les cabinets qui ont demandé le numéro de registre national ou parlé d'intervention majorée. Il suffit de noter si un rendez-vous a été obtenu, et la date.")}
        </p>
        {!rappels.length && !rappelsFaits.length && <Vide>{t("Aucun cabinet à rappeler pour l'instant.")}</Vide>}
        {rappels.map((call) => {
          const tel = telHref(call.telephone);
          return (
            <div key={call.id} className="mb-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[15px] font-medium">{call.dentiste}</div>
                  <div className="text-[12px] text-slate-600">
                    {t("Appelé le {date} {heure}", { date: frDate(call.dateAppel), heure: call.heureAppel })} ·{" "}
                    {call.interventionMajoree === "oui" ? t("intervention majorée") : ""}
                    {call.interventionMajoree === "oui" && call.registreNational === "oui" ? " + " : ""}
                    {call.registreNational === "oui" ? t("registre national") : ""}
                  </div>
                </div>
                {tel && (
                  <a
                    href={tel}
                    className="min-h-[40px] shrink-0 rounded-lg bg-teal-800 px-3 py-2 text-[13px] font-medium text-white"
                  >
                    {t("Rappeler")}
                  </a>
                )}
              </div>
              <div className="mt-3 grid gap-x-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <Field
                  label={t("Date du rappel")}
                  type="date"
                  value={call.rappel?.date || ""}
                  onChange={(v) => majAppel(call.id, { rappel: { ...call.rappel, date: v } })}
                />
                <Field
                  label={t("Date du rendez-vous obtenu")}
                  type="date"
                  value={call.rappel?.dateRdv || ""}
                  onChange={(v) => majAppel(call.id, { rappel: { ...call.rappel, dateRdv: v } })}
                />
              </div>
              <Choice
                label={t("Rendez-vous obtenu avec ce profil ?")}
                options={OUI_NON}
                value={call.rappel?.rdvObtenu || ""}
                onChange={(v) => majAppel(call.id, { rappel: { ...call.rappel, rdvObtenu: v } })}
              />
              <Bouton variant="ghost" onClick={() => majAppel(call.id, { rappelFait: true })}>
                {t("Marquer le rappel comme fait")}
              </Bouton>
            </div>
          );
        })}
        {rappelsFaits.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-[13px] text-slate-600">
              {t.n(rappelsFaits.length, "{n} rappel déjà fait", "{n} rappels déjà faits")}
            </summary>
            <ul className="mt-2 space-y-1">
              {rappelsFaits.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-[12.5px] text-slate-600">
                  <span>
                    {c.dentiste} —{" "}
                    {c.rappel?.rdvObtenu === "oui"
                      ? t("RDV le {date}", { date: frDate(c.rappel.dateRdv) })
                      : t("pas de RDV")}
                  </span>
                  <button
                    onClick={() => majAppel(c.id, { rappelFait: false })}
                    className="text-teal-800 underline underline-offset-2"
                  >
                    {t("rouvrir")}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Block>

      <div className="lg:contents">
      <Block title={t("Rendez-vous à annuler")}>
        <p className="mb-3 text-[13px] text-slate-600">
          {t("À annuler seulement après 4 jours ouvrables : Test-Achats veut voir si le cabinet annule de lui-même. Par téléphone ou par e-mail, sans être identifiable.")}
        </p>
        {!annulations.length && <Vide>{t("Aucun rendez-vous en attente d'annulation.")}</Vide>}
        {annulations.map((call) => (
          <div key={call.id} className="mb-3 rounded-xl border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[15px] font-medium">{call.dentiste}</div>
                <div className="text-[12px] text-slate-600">
                  {t("RDV le {rdv} · appelé le {appel}", {
                    rdv: frDate(call.datePremierRdv || call.dateSansSupplement),
                    appel: frDate(call.dateAppel),
                  })}
                </div>
              </div>
              <Echeance iso={call.annulation?.prevueLe} />
            </div>
            <div className="mt-2 text-[12.5px] text-slate-600">
              {t("À annuler à partir du")}{" "}
              <strong>{dateLongue(call.annulation?.prevueLe, t.langue) || "?"}</strong>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Bouton
                variant="ghost"
                onClick={() =>
                  majAppel(call.id, { annulation: { ...call.annulation, faiteLe: today() } })
                }
              >
                {t("J'ai annulé aujourd'hui")}
              </Bouton>
              <Bouton
                variant="ghost"
                onClick={() =>
                  majAppel(call.id, {
                    annulation: { ...call.annulation, faiteLe: today(), parCabinet: true },
                    remarques: [call.remarques, "Rendez-vous annulé par le cabinet lui-même."].filter(Boolean).join(" "),
                  })
                }
              >
                {t("Le cabinet a annulé lui-même")}
              </Bouton>
            </div>
          </div>
        ))}
      </Block>

      <Block title={t("Registre national — contrôle hebdomadaire")}>
        <p className="mb-3 text-[13px] text-slate-600">
          {t("Vérifier chaque semaine si un dentiste a consulté ton dossier, et transmettre l'information. Lecteur de carte et code PIN nécessaires.")}
        </p>
        <a
          href={lienRegistre(t.langue)}
          target="_blank"
          rel="noreferrer"
          className="mb-3 inline-block text-[13px] text-teal-800 underline underline-offset-2"
        >
          {t("Ouvrir « Mon dossier » sur ibz.rrn.fgov.be")}
        </a>
        <div className="mb-2 text-[12.5px] text-slate-600">
          {dernierControle
            ? t("Dernier contrôle : {date}", { date: dateLongue(dernierControle, t.langue) })
            : t("Aucun contrôle noté.")}
        </div>
        <Bouton variant="ghost" onClick={() => onControle(today())}>
          {t("J'ai vérifié aujourd'hui")}
        </Bouton>
      </Block>
      </div>
    </div>
  );
}
