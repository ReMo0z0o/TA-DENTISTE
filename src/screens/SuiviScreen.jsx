// Ce que le scénario demande APRÈS l'appel : rappeler les cabinets qu'on n'a
// pas pu joindre, rappeler avec l'autre profil ceux qui ont parlé
// d'intervention majorée, annuler les rendez-vous au bon moment, surveiller le
// registre national.
//
// Les deux rubriques de rappels tiennent côte à côte en haut ; les rendez-vous,
// eux, prennent toute la largeur : c'est la liste la plus longue et la plus
// souvent parcourue, en tableau au bureau et en cartes sur téléphone.
import { useState } from "react";
import { Block, Bouton, Choice, Field, Puce, Vide } from "../components/ui.jsx";
import { OUI_NON, besoinRappel, rdvPris, telHref } from "../lib/model.js";
import { dateLongue, frDate, joursRestants, today } from "../lib/dates.js";
import { lienRegistre } from "../lib/scenario.js";
import { useT } from "../lib/i18n.js";
import { TRIS_RDV, classeurRendezVous, nomFichier, rendezVousPlaces, telecharger } from "../lib/exporters.js";

/**
 * Dans combien de jours tombe le rendez-vous. C'est la vraie échéance : passé
 * ce jour-là, il est trop tard pour l'annuler.
 */
function Echeance({ iso }) {
  const t = useT();
  const jours = joursRestants(iso);
  if (jours === null) return null;
  if (jours < 0)
    return <Puce tone="red">{t("passé depuis {n} j", { n: -jours })}</Puce>;
  if (jours === 0) return <Puce tone="red">{t("aujourd'hui")}</Puce>;
  if (jours === 1) return <Puce tone="red">{t("demain")}</Puce>;
  return (
    <Puce tone={jours <= 7 ? "amber" : "slate"}>
      {t("dans {n} j", { n: jours })}
    </Puce>
  );
}

/**
 * Où en est la fenêtre d'annulation. Une date dépassée n'est pas un retard :
 * elle veut dire qu'on a le droit d'annuler depuis ce jour-là.
 */
function Fenetre({ iso }) {
  const t = useT();
  const jours = joursRestants(iso);
  if (jours === null) return null;
  if (jours < 0)
    return <Puce tone="teal">{t("possible depuis {n} j", { n: -jours })}</Puce>;
  if (jours === 0) return <Puce tone="teal">{t("possible aujourd'hui")}</Puce>;
  return <Puce>{t("pas avant {n} j", { n: jours })}</Puce>;
}

/** Le numéro, prêt à composer d'un doigt. */
function Appeler({ numero, libelle, avecNumero = true, petit = false }) {
  const t = useT();
  const tel = telHref(numero);
  if (!tel)
    return (
      <span className="text-[12.5px] text-slate-500">{t("Pas de numéro")}</span>
    );
  return (
    <a
      href={tel}
      className={
        "inline-flex shrink-0 items-center rounded-lg bg-teal-800 font-medium whitespace-nowrap text-white hover:bg-teal-900 " +
        (petit
          ? "px-2.5 py-1 text-[12px]"
          : "min-h-[40px] px-3 py-2 text-[13px]")
      }
    >
      {avecNumero ? `${libelle} ${numero}` : libelle}
    </a>
  );
}

/** Ce qu'on peut faire d'un rendez-vous : l'annuler, ou noter que le cabinet l'a fait. */
function ActionsAnnulation({ ligne, call, majAppel, petit = false }) {
  const t = useT();
  const annule = (parCabinet) =>
    majAppel(ligne.id, {
      annulation: { ...call?.annulation, faiteLe: today(), parCabinet },
      ...(parCabinet
        ? {
            remarques: [
              call?.remarques,
              "Rendez-vous annulé par le cabinet lui-même.",
            ]
              .filter(Boolean)
              .join(" "),
          }
        : {}),
    });

  if (ligne.etat !== "a_annuler") {
    return (
      <span className="text-[12px] whitespace-nowrap text-slate-500">
        {ligne.etat === "annule_cabinet"
          ? t("Annulé par le cabinet le {date}", {
              date: frDate(ligne.annuleLe),
            })
          : t("Annulé le {date}", { date: frDate(ligne.annuleLe) })}{" "}
        <button
          onClick={() =>
            majAppel(ligne.id, {
              annulation: {
                ...call?.annulation,
                faiteLe: "",
                parCabinet: false,
              },
            })
          }
          className="text-teal-800 underline underline-offset-2"
        >
          {t("rouvrir")}
        </button>
      </span>
    );
  }

  const style = petit
    ? "rounded-md border px-2 py-1 text-[12px] whitespace-nowrap"
    : "min-h-[40px] flex-1 rounded-lg border px-3 py-2 text-[13px]";
  return (
    <div className={petit ? "flex gap-1" : "flex flex-wrap gap-2"}>
      <button
        onClick={() => annule(false)}
        title={t("J'ai annulé aujourd'hui")}
        className={
          style + " border-teal-700 bg-white text-teal-800 hover:bg-teal-50"
        }
      >
        {petit ? t("Annulé") : t("J'ai annulé aujourd'hui")}
      </button>
      <button
        onClick={() => annule(true)}
        title={t("Le cabinet a annulé lui-même")}
        className={
          style +
          " border-slate-300 bg-white text-slate-700 hover:border-slate-400"
        }
      >
        {petit ? t("par le cabinet") : t("Le cabinet a annulé lui-même")}
      </button>
    </div>
  );
}

/** Les repères d'un rendez-vous : intervention majorée, dentiste Y. */
function Marques({ ligne }) {
  const t = useT();
  return (
    <>
      {ligne.interventionMajoree && (
        <Puce tone="amber">{t("à rappeler — intervention majorée")}</Puce>
      )}
      {ligne.roleY && <Puce tone="teal">{t("dentiste Y")}</Puce>}
    </>
  );
}

export default function SuiviScreen({
  calls,
  prospects = [],
  majAppel,
  onEncoder,
  controles,
  onControle,
}) {
  const t = useT();
  const [tri, setTri] = useState("urgence");
  const [masquerAnnules, setMasquerAnnules] = useState(false);

  // 1. Les cabinets qu'on n'a pas pu joindre : à rappeler avec le profil
  //    habituel, c'est-à-dire simplement refaire l'appel.
  const aRappeler = prospects.filter((p) => p.etat === "rappeler");
  const dernierAppel = new Map();
  for (const c of calls) {
    if (!c.prospectId) continue;
    const connu = dernierAppel.get(c.prospectId);
    if (!connu || String(c.dateAppel) >= String(connu.dateAppel))
      dernierAppel.set(c.prospectId, c);
  }

  // 2. Les rappels du scénario, avec l'autre profil et une voix d'homme.
  const rappels = calls.filter((c) => besoinRappel(c) && !c.rappelFait);
  const rappelsFaits = calls.filter((c) => besoinRappel(c) && c.rappelFait);

  // 3. Tous les rendez-vous placés, à annuler ou déjà annulés.
  const tousLesRdv = rendezVousPlaces(calls, prospects, tri);
  const resteAAnnuler = tousLesRdv.filter((r) => r.etat === "a_annuler").length;
  const affiches = masquerAnnules
    ? tousLesRdv.filter((r) => r.etat === "a_annuler")
    : tousLesRdv;
  const parId = new Map(calls.map((c) => [c.id, c]));

  const telechargeRdv = async () => {
    const blob = await classeurRendezVous(calls, prospects, t);
    telecharger(nomFichier("rendez-vous-a-annuler", "xlsx"), blob);
  };

  return (
    <div className="pb-24 lg:pb-0">
      {/* en haut, ce qui tient en peu de place */}
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-5">
          <Block title={t("Rappels — profil habituel")}>
            <p className="mb-3 text-[13px] text-slate-600">
              {t(
                "Les cabinets marqués « À rappeler » : personne n'a décroché, ou on t'a demandé de rappeler plus tard. Rien à changer au scénario, c'est le même appel à refaire.",
              )}
            </p>
            {!aRappeler.length && (
              <Vide>{t("Aucun cabinet à rappeler pour l'instant.")}</Vide>
            )}
            {aRappeler.map((fiche) => {
              const appel = dernierAppel.get(fiche.id);
              return (
                <div
                  key={fiche.id}
                  className="mb-3 rounded-xl border border-slate-200 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[15px] font-medium">{fiche.nom}</div>
                      <div className="mt-0.5 text-[12px] text-slate-600">
                        {appel?.dateAppel
                          ? t("Dernier essai le {date} {heure}", {
                              date: frDate(appel.dateAppel),
                              heure: appel.heureAppel || "",
                            })
                          : t("Pas encore d'appel encodé")}
                        {fiche.commune ? ` · ${fiche.commune}` : ""}
                      </div>
                    </div>
                    <Appeler numero={fiche.telephone} libelle={t("Rappeler")} />
                  </div>
                  {onEncoder && (
                    <Bouton
                      variant="ghost"
                      onClick={() => onEncoder(fiche)}
                      className="mt-3"
                    >
                      {t("Encoder l'appel")}
                    </Bouton>
                  )}
                </div>
              );
            })}
          </Block>

          <Block title={t("Registre national — contrôle hebdomadaire")}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] text-slate-600">
                  {t(
                    "Vérifier chaque semaine si un dentiste a consulté ton dossier, et transmettre l'information. Lecteur de carte et code PIN nécessaires.",
                  )}
                </p>
                <div className="mt-1 text-[12.5px] text-slate-600">
                  {controles[controles.length - 1]
                    ? t("Dernier contrôle : {date}", {
                        date: dateLongue(
                          controles[controles.length - 1],
                          t.langue,
                        ),
                      })
                    : t("Aucun contrôle noté.")}{" "}
                  <a
                    href={lienRegistre(t.langue)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-teal-800 underline underline-offset-2"
                  >
                    {t("Ouvrir « Mon dossier » sur ibz.rrn.fgov.be")}
                  </a>
                </div>
              </div>
              <Bouton
                variant="ghost"
                onClick={() => onControle(today())}
                className="shrink-0"
              >
                {t("J'ai vérifié aujourd'hui")}
              </Bouton>
            </div>
          </Block>
      </div>

      {/* les rappels du scénario : leurs fiches portent un petit formulaire,
          elles respirent mieux côte à côte sur toute la largeur */}
      <Block title={t("Rappels avec le profil « intervention majorée »")}>
          <p className="mb-3 text-[13px] text-slate-600">
            {t(
              "Le scénario demande de rappeler le lendemain, avec une voix d'homme et l'autre profil, les cabinets qui ont demandé le numéro de registre national ou parlé d'intervention majorée. Il suffit de noter si un rendez-vous a été obtenu, et la date.",
            )}
          </p>
          {!rappels.length && !rappelsFaits.length && (
            <Vide>{t("Aucun cabinet à rappeler avec l'autre profil.")}</Vide>
          )}
          <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-4 xl:grid-cols-3">
          {rappels.map((call) => (
            <div
              key={call.id}
              className="mb-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[15px] font-medium">{call.dentiste}</div>
                  <div className="mt-0.5 text-[12px] text-slate-600">
                    {t("Appelé le {date} {heure}", {
                      date: frDate(call.dateAppel),
                      heure: call.heureAppel,
                    })}{" "}
                    ·{" "}
                    {call.interventionMajoree === "oui"
                      ? t("intervention majorée")
                      : ""}
                    {call.interventionMajoree === "oui" &&
                    call.registreNational === "oui"
                      ? " + "
                      : ""}
                    {call.registreNational === "oui"
                      ? t("registre national")
                      : ""}
                  </div>
                  {rdvPris(call) && (
                    <div className="mt-0.5 text-[12px] text-slate-600">
                      {t(
                        "Un rendez-vous est déjà placé ici, à annuler plus bas.",
                      )}
                    </div>
                  )}
                </div>
                <Appeler numero={call.telephone} libelle={t("Rappeler")} />
              </div>
              <div className="mt-3 grid gap-x-3 sm:grid-cols-2">
                <Field
                  label={t("Date du rappel")}
                  type="date"
                  value={call.rappel?.date || ""}
                  onChange={(v) =>
                    majAppel(call.id, { rappel: { ...call.rappel, date: v } })
                  }
                />
                <Field
                  label={t("Date du rendez-vous obtenu")}
                  type="date"
                  value={call.rappel?.dateRdv || ""}
                  onChange={(v) =>
                    majAppel(call.id, {
                      rappel: { ...call.rappel, dateRdv: v },
                    })
                  }
                />
              </div>
              <Choice
                label={t("Rendez-vous obtenu avec ce profil ?")}
                options={OUI_NON}
                value={call.rappel?.rdvObtenu || ""}
                onChange={(v) =>
                  majAppel(call.id, {
                    rappel: { ...call.rappel, rdvObtenu: v },
                  })
                }
              />
              <Bouton
                variant="ghost"
                onClick={() => majAppel(call.id, { rappelFait: true })}
              >
                {t("Marquer le rappel comme fait")}
              </Bouton>
            </div>
          ))}
          </div>
          {rappelsFaits.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[13px] text-slate-600">
                {t.n(
                  rappelsFaits.length,
                  "{n} rappel déjà fait",
                  "{n} rappels déjà faits",
                )}
              </summary>
              <ul className="mt-2 space-y-1">
                {rappelsFaits.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between text-[12.5px] text-slate-600"
                  >
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

      {/* les rendez-vous : toute la largeur, c'est la liste qu'on parcourt le plus */}
      <Block
        title={t("Rendez-vous à annuler")}
        action={
          tousLesRdv.length > 0 && (
            <span className="text-[12px] whitespace-nowrap text-slate-500">
              {t("{reste} sur {total} encore à annuler", {
                reste: resteAAnnuler,
                total: tousLesRdv.length,
              })}
            </span>
          )
        }
      >
        <p className="mb-3 text-[13px] text-slate-600">
          {t(
            "À annuler seulement après 4 jours ouvrables : Test-Achats veut voir si le cabinet annule de lui-même. Par téléphone ou par e-mail, sans être identifiable.",
          )}
        </p>

        {!tousLesRdv.length ? (
          <Vide>{t("Aucun rendez-vous placé pour l'instant.")}</Vide>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <label className="flex items-center gap-2 text-[12.5px] text-slate-600">
                {t("Classer par")}
                <select
                  value={tri}
                  onChange={(e) => setTri(e.target.value)}
                  data-role="tri-rdv"
                  className="min-h-[34px] rounded-lg border border-slate-300 bg-white px-2 py-1 text-[13px] focus:border-teal-700 focus:outline-none"
                >
                  {TRIS_RDV.map((o) => (
                    <option key={o.cle} value={o.cle}>
                      {t(o.label)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-slate-600">
                <input
                  type="checkbox"
                  checked={masquerAnnules}
                  onChange={(e) => setMasquerAnnules(e.target.checked)}
                  data-role="masquer-annules"
                  className="h-4 w-4 accent-teal-800"
                />
                {t("Masquer ceux déjà annulés")}
              </label>
              <Bouton
                variant="ghost"
                onClick={telechargeRdv}
                className="ml-auto"
              >
                {t("Télécharger les rendez-vous (.xlsx)")}
              </Bouton>
            </div>

            {/* tableau : lecture en un coup d'œil sur grand écran */}
            <div className="-mx-3 hidden overflow-x-auto px-3 lg:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] tracking-wide text-slate-500 uppercase">
                    <th className="py-2 pr-3 text-left font-semibold">
                      {t("Dentiste")}
                    </th>
                    <th className="py-2 pr-3 text-left font-semibold">
                      {t("Rendez-vous le")}
                    </th>
                    <th className="py-2 pr-3 text-left font-semibold">
                      {t("À annuler à partir du")}
                    </th>
                    <th className="py-2 pr-3 text-left font-semibold">
                      {t("Appel du")}
                    </th>
                    <th className="py-2 pr-3 text-left font-semibold">
                      {t("Téléphone")}
                    </th>
                    <th className="py-2 text-right font-semibold">
                      {t("Annulation")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {affiches.map((ligne) => {
                    const fait = ligne.etat !== "a_annuler";
                    return (
                      <tr
                        key={ligne.id}
                        data-role="rendez-vous"
                        className={
                          "border-b border-slate-100 align-top " +
                          (fait ? "text-slate-400" : "")
                        }
                      >
                        <td className="py-2 pr-3">
                          <div
                            className={
                              "text-[13.5px] font-medium " +
                              (fait ? "text-slate-500" : "text-slate-900")
                            }
                          >
                            {ligne.dentiste}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Marques ligne={ligne} />
                          </div>
                          {ligne.commune && (
                            <div className="mt-0.5 text-[11.5px] text-slate-500">
                              {ligne.commune}
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          <div className="text-[13px] font-medium">
                            {frDate(ligne.rdvLe) || "—"}
                          </div>
                          {!fait && (
                            <div className="mt-1">
                              <Echeance iso={ligne.rdvLe} />
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          <div className="text-[12.5px]">
                            {frDate(ligne.annulerLe) || "—"}
                          </div>
                          {!fait && (
                            <div className="mt-1">
                              <Fenetre iso={ligne.annulerLe} />
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-[12px] whitespace-nowrap text-slate-500">
                          {frDate(ligne.appelLe) || "—"} {ligne.heureAppel}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          <div className="text-[12.5px] tabular-nums">
                            {ligne.telephone || "—"}
                          </div>
                          {!fait && (
                            <div className="mt-1">
                              <Appeler
                                numero={ligne.telephone}
                                libelle={t("Appeler")}
                                avecNumero={false}
                                petit
                              />
                            </div>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex justify-end">
                            <ActionsAnnulation
                              ligne={ligne}
                              call={parId.get(ligne.id)}
                              majAppel={majAppel}
                              petit
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* cartes : sur téléphone, un doigt suffit */}
            <ul className="lg:hidden">
              {affiches.map((ligne) => {
                const fait = ligne.etat !== "a_annuler";
                return (
                  <li
                    key={ligne.id}
                    data-role="rendez-vous"
                    className={
                      "mb-3 rounded-xl border p-3 " +
                      (fait
                        ? "border-slate-200 bg-slate-50"
                        : "border-slate-200")
                    }
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div
                          className={
                            "text-[15px] font-medium " +
                            (fait ? "text-slate-500" : "")
                          }
                        >
                          {ligne.dentiste}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Marques ligne={ligne} />
                        </div>
                      </div>
                      {!fait && (
                        <Appeler
                          numero={ligne.telephone}
                          libelle={t("Appeler")}
                          avecNumero={false}
                        />
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
                      <span>
                        <span className="text-slate-500">
                          {t("Rendez-vous le")}{" "}
                        </span>
                        <strong>{frDate(ligne.rdvLe) || "—"}</strong>
                      </span>
                      {!fait && <Echeance iso={ligne.rdvLe} />}
                    </div>
                    <div className="mt-1 text-[12px] text-slate-500">
                      {t("À annuler à partir du")}{" "}
                      {dateLongue(ligne.annulerLe, t.langue) || "?"} ·{" "}
                      {t("Appel du")} {frDate(ligne.appelLe) || "—"} ·{" "}
                      {ligne.telephone || "—"}
                    </div>

                    <div className="mt-3">
                      <ActionsAnnulation
                        ligne={ligne}
                        call={parId.get(ligne.id)}
                        majAppel={majAppel}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>

            {!affiches.length && (
              <Vide>{t("Tout est annulé : rien ne reste en attente.")}</Vide>
            )}
          </>
        )}
      </Block>
    </div>
  );
}
