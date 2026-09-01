// Ce que le scénario demande APRÈS l'appel : rappeler avec l'autre profil,
// annuler les rendez-vous au bon moment, surveiller le registre national.
import { Block, Bouton, Choice, Field, Puce, Vide } from "../components/ui.jsx";
import { OUI_NON, besoinRappel, rdvPris, telHref } from "../lib/model.js";
import { dateLongue, frDate, joursRestants, today } from "../lib/dates.js";
import { LIEN_REGISTRE } from "../lib/scenario.js";

function Echeance({ iso }) {
  const jours = joursRestants(iso);
  if (jours === null) return null;
  if (jours < 0) return <Puce tone="red">en retard de {-jours} j</Puce>;
  if (jours === 0) return <Puce tone="amber">aujourd'hui</Puce>;
  if (jours === 1) return <Puce tone="amber">demain</Puce>;
  return <Puce>dans {jours} j</Puce>;
}

export default function SuiviScreen({ calls, majAppel, controles, onControle }) {
  const rappels = calls.filter((c) => besoinRappel(c) && !c.rappelFait);
  const rappelsFaits = calls.filter((c) => besoinRappel(c) && c.rappelFait);
  const annulations = calls
    .filter((c) => rdvPris(c) && !c.annulation?.faiteLe)
    .sort((a, b) => String(a.annulation?.prevueLe).localeCompare(String(b.annulation?.prevueLe)));
  const dernierControle = controles[controles.length - 1];

  return (
    <div className="pb-24 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5 lg:pb-0">
      <Block title="Rappels avec le profil « intervention majorée »">
        <p className="mb-3 text-[13px] text-slate-600">
          Le scénario demande de rappeler le lendemain, avec une voix d'homme et l'autre profil, les cabinets qui ont
          demandé le numéro de registre national ou parlé d'intervention majorée. Il suffit de noter si un rendez-vous a
          été obtenu, et la date.
        </p>
        {!rappels.length && !rappelsFaits.length && <Vide>Aucun cabinet à rappeler pour l'instant.</Vide>}
        {rappels.map((call) => {
          const tel = telHref(call.telephone);
          return (
            <div key={call.id} className="mb-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[15px] font-medium">{call.dentiste}</div>
                  <div className="text-[12px] text-slate-600">
                    Appelé le {frDate(call.dateAppel)} {call.heureAppel} ·{" "}
                    {call.interventionMajoree === "oui" ? "intervention majorée" : ""}
                    {call.interventionMajoree === "oui" && call.registreNational === "oui" ? " + " : ""}
                    {call.registreNational === "oui" ? "registre national" : ""}
                  </div>
                </div>
                {tel && (
                  <a
                    href={tel}
                    className="min-h-[40px] shrink-0 rounded-lg bg-teal-800 px-3 py-2 text-[13px] font-medium text-white"
                  >
                    Rappeler
                  </a>
                )}
              </div>
              <div className="mt-3 grid gap-x-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <Field
                  label="Date du rappel"
                  type="date"
                  value={call.rappel?.date || ""}
                  onChange={(v) => majAppel(call.id, { rappel: { ...call.rappel, date: v } })}
                />
                <Field
                  label="Date du rendez-vous obtenu"
                  type="date"
                  value={call.rappel?.dateRdv || ""}
                  onChange={(v) => majAppel(call.id, { rappel: { ...call.rappel, dateRdv: v } })}
                />
              </div>
              <Choice
                label="Rendez-vous obtenu avec ce profil ?"
                options={OUI_NON}
                value={call.rappel?.rdvObtenu || ""}
                onChange={(v) => majAppel(call.id, { rappel: { ...call.rappel, rdvObtenu: v } })}
              />
              <Bouton variant="ghost" onClick={() => majAppel(call.id, { rappelFait: true })}>
                Marquer le rappel comme fait
              </Bouton>
            </div>
          );
        })}
        {rappelsFaits.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-[13px] text-slate-600">
              {rappelsFaits.length} rappel{rappelsFaits.length > 1 ? "s" : ""} déjà fait
              {rappelsFaits.length > 1 ? "s" : ""}
            </summary>
            <ul className="mt-2 space-y-1">
              {rappelsFaits.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-[12.5px] text-slate-600">
                  <span>
                    {c.dentiste} — {c.rappel?.rdvObtenu === "oui" ? `RDV le ${frDate(c.rappel.dateRdv)}` : "pas de RDV"}
                  </span>
                  <button
                    onClick={() => majAppel(c.id, { rappelFait: false })}
                    className="text-teal-800 underline underline-offset-2"
                  >
                    rouvrir
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Block>

      <div className="lg:contents">
      <Block title="Rendez-vous à annuler">
        <p className="mb-3 text-[13px] text-slate-600">
          À annuler seulement <strong>après 4 jours ouvrables</strong> : Test-Achats veut voir si le cabinet annule de
          lui-même. Par téléphone ou par e-mail, sans être identifiable.
        </p>
        {!annulations.length && <Vide>Aucun rendez-vous en attente d'annulation.</Vide>}
        {annulations.map((call) => (
          <div key={call.id} className="mb-3 rounded-xl border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[15px] font-medium">{call.dentiste}</div>
                <div className="text-[12px] text-slate-600">
                  RDV le {frDate(call.datePremierRdv || call.dateSansSupplement)} · appelé le {frDate(call.dateAppel)}
                </div>
              </div>
              <Echeance iso={call.annulation?.prevueLe} />
            </div>
            <div className="mt-2 text-[12.5px] text-slate-600">
              À annuler à partir du <strong>{dateLongue(call.annulation?.prevueLe) || "?"}</strong>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Bouton
                variant="ghost"
                onClick={() =>
                  majAppel(call.id, { annulation: { ...call.annulation, faiteLe: today() } })
                }
              >
                J'ai annulé aujourd'hui
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
                Le cabinet a annulé lui-même
              </Bouton>
            </div>
          </div>
        ))}
      </Block>

      <Block title="Registre national — contrôle hebdomadaire">
        <p className="mb-3 text-[13px] text-slate-600">
          Vérifier chaque semaine si un dentiste a consulté ton dossier, et transmettre l'information. Lecteur de carte
          et code PIN nécessaires.
        </p>
        <a
          href={LIEN_REGISTRE}
          target="_blank"
          rel="noreferrer"
          className="mb-3 inline-block text-[13px] text-teal-800 underline underline-offset-2"
        >
          Ouvrir « Mon dossier » sur ibz.rrn.fgov.be
        </a>
        <div className="mb-2 text-[12.5px] text-slate-600">
          {dernierControle ? `Dernier contrôle : ${dateLongue(dernierControle)}` : "Aucun contrôle noté."}
        </div>
        <Bouton variant="ghost" onClick={() => onControle(today())}>
          J'ai vérifié aujourd'hui
        </Bouton>
      </Block>
      </div>
    </div>
  );
}
