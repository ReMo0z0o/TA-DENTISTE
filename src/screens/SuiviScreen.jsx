// Ce que le scénario demande APRÈS l'appel : rappeler les cabinets qu'on n'a
// pas pu joindre, rappeler avec l'autre profil ceux qui ont parlé
// d'intervention majorée, annuler les rendez-vous au bon moment, surveiller le
// registre national.
import { Block, Bouton, Choice, Field, Puce, Vide } from "../components/ui.jsx";
import { OUI_NON, besoinRappel, rdvPris, telHref } from "../lib/model.js";
import { dateLongue, frDate, joursRestants, today } from "../lib/dates.js";
import { lienRegistre } from "../lib/scenario.js";
import { useT } from "../lib/i18n.js";
import { classeurRendezVous, nomFichier, rendezVousPlaces, telecharger } from "../lib/exporters.js";

function Echeance({ iso }) {
  const t = useT();
  const jours = joursRestants(iso);
  if (jours === null) return null;
  if (jours < 0) return <Puce tone="red">{t("en retard de {n} j", { n: -jours })}</Puce>;
  if (jours === 0) return <Puce tone="amber">{t("aujourd'hui")}</Puce>;
  if (jours === 1) return <Puce tone="amber">{t("demain")}</Puce>;
  return <Puce>{t("dans {n} j", { n: jours })}</Puce>;
}

/**
 * Le numéro, prêt à composer d'un doigt. Il n'est répété dans le bouton que
 * lorsque la fiche ne l'affiche pas déjà en clair juste à côté.
 */
function Appeler({ numero, libelle, avecNumero = true }) {
  const t = useT();
  const tel = telHref(numero);
  if (!tel) return <span className="text-[12.5px] text-slate-500">{t("Pas de numéro")}</span>;
  return (
    <a
      href={tel}
      className="inline-flex min-h-[40px] shrink-0 items-center rounded-lg bg-teal-800 px-3 py-2 text-[13px] font-medium whitespace-nowrap text-white hover:bg-teal-900"
    >
      {avecNumero ? `${libelle} ${numero}` : libelle}
    </a>
  );
}

export default function SuiviScreen({ calls, prospects = [], majAppel, onEncoder, controles, onControle }) {
  const t = useT();

  // 1. Les cabinets qu'on n'a pas pu joindre : à rappeler avec le profil
  //    habituel, c'est-à-dire simplement refaire l'appel.
  const aRappeler = prospects.filter((p) => p.etat === "rappeler");
  const dernierAppel = new Map();
  for (const c of calls) {
    if (!c.prospectId) continue;
    const connu = dernierAppel.get(c.prospectId);
    if (!connu || String(c.dateAppel) >= String(connu.dateAppel)) dernierAppel.set(c.prospectId, c);
  }

  // 2. Les rappels du scénario, avec l'autre profil et une voix d'homme.
  const rappels = calls.filter((c) => besoinRappel(c) && !c.rappelFait);
  const rappelsFaits = calls.filter((c) => besoinRappel(c) && c.rappelFait);

  // 3. Tous les rendez-vous placés, à annuler ou déjà annulés.
  const tousLesRdv = rendezVousPlaces(calls, prospects);
  const resteAAnnuler = tousLesRdv.filter((r) => r.etat === "a_annuler").length;
  const parId = new Map(calls.map((c) => [c.id, c]));

  const telechargeRdv = async () => {
    const blob = await classeurRendezVous(calls, prospects, t);
    telecharger(nomFichier("rendez-vous-a-annuler", "xlsx"), blob);
  };

  return (
    <div className="pb-24 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5 lg:pb-0">
      <div className="lg:contents">
        <Block title={t("Rappels — profil habituel")}>
          <p className="mb-3 text-[13px] text-slate-600">
            {t("Les cabinets marqués « À rappeler » : personne n'a décroché, ou on t'a demandé de rappeler plus tard. Rien à changer au scénario, c'est le même appel à refaire.")}
          </p>
          {!aRappeler.length && <Vide>{t("Aucun cabinet à rappeler pour l'instant.")}</Vide>}
          {aRappeler.map((fiche) => {
            const appel = dernierAppel.get(fiche.id);
            return (
              <div key={fiche.id} className="mb-3 rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[15px] font-medium">{fiche.nom}</div>
                    <div className="mt-0.5 text-[12px] text-slate-600">
                      {appel?.dateAppel
                        ? t("Dernier essai le {date} {heure}", { date: frDate(appel.dateAppel), heure: appel.heureAppel || "" })
                        : t("Pas encore d'appel encodé")}
                      {fiche.commune ? ` · ${fiche.commune}` : ""}
                    </div>
                  </div>
                  <Appeler numero={fiche.telephone} libelle={t("Rappeler")} />
                </div>
                {onEncoder && (
                  <Bouton variant="ghost" onClick={() => onEncoder(fiche)} className="mt-3">
                    {t("Encoder l'appel")}
                  </Bouton>
                )}
              </div>
            );
          })}
        </Block>

        <Block title={t("Rappels avec le profil « intervention majorée »")}>
          <p className="mb-3 text-[13px] text-slate-600">
            {t("Le scénario demande de rappeler le lendemain, avec une voix d'homme et l'autre profil, les cabinets qui ont demandé le numéro de registre national ou parlé d'intervention majorée. Il suffit de noter si un rendez-vous a été obtenu, et la date.")}
          </p>
          {!rappels.length && !rappelsFaits.length && <Vide>{t("Aucun cabinet à rappeler avec l'autre profil.")}</Vide>}
          {rappels.map((call) => (
            <div key={call.id} className="mb-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[15px] font-medium">{call.dentiste}</div>
                  <div className="mt-0.5 text-[12px] text-slate-600">
                    {t("Appelé le {date} {heure}", { date: frDate(call.dateAppel), heure: call.heureAppel })} ·{" "}
                    {call.interventionMajoree === "oui" ? t("intervention majorée") : ""}
                    {call.interventionMajoree === "oui" && call.registreNational === "oui" ? " + " : ""}
                    {call.registreNational === "oui" ? t("registre national") : ""}
                  </div>
                  {rdvPris(call) && (
                    <div className="mt-0.5 text-[12px] text-slate-600">
                      {t("Un rendez-vous est déjà placé ici, à annuler plus bas.")}
                    </div>
                  )}
                </div>
                <Appeler numero={call.telephone} libelle={t("Rappeler")} />
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
          ))}
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
      </div>

      <div className="lg:contents">
        <Block title={t("Rendez-vous à annuler")}>
          <p className="mb-3 text-[13px] text-slate-600">
            {t("À annuler seulement après 4 jours ouvrables : Test-Achats veut voir si le cabinet annule de lui-même. Par téléphone ou par e-mail, sans être identifiable.")}
          </p>

          {tousLesRdv.length > 0 && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-[12.5px] text-slate-600">
                {t("{total} rendez-vous placés depuis le début de la mission, dont {reste} encore à annuler.", {
                  total: tousLesRdv.length,
                  reste: resteAAnnuler,
                })}
              </p>
              <Bouton variant="ghost" onClick={telechargeRdv} className="w-full sm:w-auto">
                {t("Télécharger les rendez-vous (.xlsx)")}
              </Bouton>
            </div>
          )}

          {!tousLesRdv.length && <Vide>{t("Aucun rendez-vous placé pour l'instant.")}</Vide>}

          {tousLesRdv.map((ligne) => {
            const call = parId.get(ligne.id);
            const fait = ligne.etat !== "a_annuler";
            return (
              <div
                key={ligne.id}
                data-role="rendez-vous"
                className={
                  "mb-3 rounded-xl border p-3 " +
                  (fait ? "border-slate-200 bg-slate-50 text-slate-500" : "border-slate-200")
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className={"text-[15px] font-medium " + (fait ? "text-slate-600" : "")}>{ligne.dentiste}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {ligne.interventionMajoree && (
                        <Puce tone="amber">{t("à rappeler — intervention majorée")}</Puce>
                      )}
                      {ligne.roleY && <Puce tone="teal">{t("dentiste Y")}</Puce>}
                      {!fait && <Echeance iso={ligne.annulerLe} />}
                    </div>
                  </div>
                  {!fait && <Appeler numero={ligne.telephone} libelle={t("Appeler")} avecNumero={false} />}
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px] sm:grid-cols-3">
                  <div>
                    <dt className="text-slate-500">{t("Appel du")}</dt>
                    <dd className="font-medium">
                      {frDate(ligne.appelLe) || "—"} {ligne.heureAppel}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{t("Rendez-vous le")}</dt>
                    <dd className="font-medium">{frDate(ligne.rdvLe) || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{t("Téléphone")}</dt>
                    <dd className="font-medium break-all">{ligne.telephone || "—"}</dd>
                  </div>
                </dl>

                <div className="mt-2 text-[12.5px]">
                  {fait ? (
                    <span>
                      {ligne.etat === "annule_cabinet"
                        ? t("Annulé par le cabinet le {date}", { date: frDate(ligne.annuleLe) })
                        : t("Annulé le {date}", { date: frDate(ligne.annuleLe) })}{" "}
                      <button
                        onClick={() => majAppel(ligne.id, { annulation: { ...call?.annulation, faiteLe: "", parCabinet: false } })}
                        className="text-teal-800 underline underline-offset-2"
                      >
                        {t("rouvrir")}
                      </button>
                    </span>
                  ) : (
                    <span className="text-slate-600">
                      {t("À annuler à partir du")}{" "}
                      <strong>{dateLongue(ligne.annulerLe, t.langue) || "?"}</strong>
                    </span>
                  )}
                </div>

                {!fait && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Bouton
                      variant="ghost"
                      onClick={() => majAppel(ligne.id, { annulation: { ...call?.annulation, faiteLe: today() } })}
                    >
                      {t("J'ai annulé aujourd'hui")}
                    </Bouton>
                    <Bouton
                      variant="ghost"
                      onClick={() =>
                        majAppel(ligne.id, {
                          annulation: { ...call?.annulation, faiteLe: today(), parCabinet: true },
                          remarques: [call?.remarques, "Rendez-vous annulé par le cabinet lui-même."]
                            .filter(Boolean)
                            .join(" "),
                        })
                      }
                    >
                      {t("Le cabinet a annulé lui-même")}
                    </Bouton>
                  </div>
                )}
              </div>
            );
          })}
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
            {controles[controles.length - 1]
              ? t("Dernier contrôle : {date}", { date: dateLongue(controles[controles.length - 1], t.langue) })
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
