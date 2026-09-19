import { useState } from "react";
import { Area, Block, Bouton, Case, Choice, Field, Puce } from "../components/ui.jsx";
import {
  COLUMN_BY_KEY,
  ETATS_PROSPECT,
  aDesReponses,
  INFO_PRIX,
  MEME_CABINET,
  OUI_NON,
  PROVINCES,
  RAISONS,
  REMBOURSEMENT,
  SANS_SUPP,
  STATUTS,
  SUPPLEMENT,
  besoinRappel,
  champsManquants,
  telHref,
} from "../lib/model.js";
import { visible } from "../lib/regles.js";
import { nowTime, frDate } from "../lib/dates.js";
import { scenario } from "../lib/scenario.js";
import { useT } from "../lib/i18n.js";

// « à appeler » est l'état de départ, pas une suite à donner après un appel
const SUITES = ETATS_PROSPECT.filter((e) => e.key !== "a_appeler");
const LIBELLE_ETAT = Object.fromEntries(ETATS_PROSPECT.map((e) => [e.key, e.label]));
// la suite choisie prend la couleur qu'elle aura dans la liste
const TEINTE_ETAT = Object.fromEntries(ETATS_PROSPECT.map((e) => [e.key, e.tone]));

function Identite({ call, set, fiche, ouvert, setOuvert }) {
  const t = useT();
  const lib = (cle) => t(COLUMN_BY_KEY[cle].label);
  const tel = telHref(call.telephone);
  return (
    <Block
      title={t("Le dentiste")}
      action={
        <button onClick={() => setOuvert(!ouvert)} className="text-[12px] text-teal-800 underline underline-offset-2">
          {ouvert ? t("Replier") : t("Modifier")}
        </button>
      }
    >
      <div className="mb-3">
        <div className="text-[17px] leading-tight font-semibold text-slate-900">
          {call.dentiste || <span className="text-slate-400">{t("Nom du dentiste")}</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-slate-600">
          {call.province && <Puce>{call.province}</Puce>}
          {call.statut && <Puce tone="teal">{t.valeur(call.statut)}</Puce>}
          {fiche?.commune && (
            <span>
              {fiche.commune} {fiche.cp}
            </span>
          )}
          {fiche?.inami && <span>· INAMI {fiche.inami}</span>}
        </div>
        {fiche?.adresse && <div className="mt-1 text-[12px] text-slate-500">{fiche.adresse}</div>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tel ? (
          <a
            href={tel}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-teal-800 px-4 py-2.5 text-[15px] font-medium text-white hover:bg-teal-900 active:bg-teal-900 lg:min-h-[38px] lg:py-2 lg:text-[14px]"
          >
            {t("Appeler")} {call.telephone}
          </a>
        ) : (
          <span className="text-[13px] text-slate-500">{t("Pas de numéro encodé")}</span>
        )}
        {call.telephone && (
          <button
            onClick={() => navigator.clipboard?.writeText(call.telephone).catch(() => {})}
            title={t("Copier le numéro")}
            className="hidden min-h-[38px] rounded-lg border border-slate-300 px-3 text-[12.5px] text-slate-600 hover:border-slate-400 lg:inline-flex lg:items-center"
          >
            {t("Copier")}
          </button>
        )}
        {fiche?.site && (
          <a
            href={fiche.site.startsWith("http") ? fiche.site : `https://${fiche.site}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[13px] text-slate-700 hover:border-slate-400 lg:min-h-[38px] lg:py-2"
          >
            {fiche.site}
          </a>
        )}
      </div>

      {!ouvert && !call.statut && (
        <div className="mt-4 border-t border-slate-200 pt-3">
          <Choice
            label={lib("statut")}
            hint={t("Colonne obligatoire du fichier de réponses.")}
            options={STATUTS}
            value={call.statut}
            onChange={set("statut")}
          />
        </div>
      )}

      {ouvert && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <Field
            label={lib("dentiste")}
            value={call.dentiste}
            onChange={set("dentiste")}
            placeholder={t("Nom tel qu'il figure dans le fichier")}
          />
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Field label={lib("province")} value={call.province} onChange={set("province")} list="liste-provinces" />
            <Field label={lib("telephone")} value={call.telephone} onChange={set("telephone")} inputMode="tel" />
          </div>
          <datalist id="liste-provinces">
            {PROVINCES.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <Choice label={lib("statut")} options={STATUTS} value={call.statut} onChange={set("statut")} />
        </div>
      )}
    </Block>
  );
}

/** Les réponses types : dépliables sur petit écran, toujours visibles au bureau. */
function ReponsesTypes({ compact }) {
  const t = useT();
  const [ouvert, setOuvert] = useState(false);
  const liste = (
    <dl className="mt-2 space-y-2">
      {scenario(t.langue).reponses.map((item) => (
        <div key={item.q} className="text-[12.5px] leading-snug">
          <dt className="text-slate-600">{item.q}</dt>
          <dd className="font-medium text-teal-900">{item.r}</dd>
        </div>
      ))}
    </dl>
  );

  if (!compact) return liste;
  return (
    <>
      <button
        onClick={() => setOuvert(!ouvert)}
        className="mt-2 text-[12px] font-medium text-teal-800 underline underline-offset-2"
      >
        {ouvert ? t("Masquer les réponses types") : t("Réponses aux questions du secrétariat")}
      </button>
      {ouvert && liste}
    </>
  );
}

function FileAttente({ fiches, onOuvrir }) {
  const t = useT();
  if (!fiches.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <h2 className="mb-2 text-[12px] font-semibold tracking-wide text-slate-600 uppercase">{t("Ensuite")}</h2>
      <ul className="max-h-[38vh] space-y-1 overflow-y-auto">
        {fiches.slice(0, 8).map((f) => (
          <li key={f.id}>
            <button
              onClick={() => onOuvrir(f)}
              className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
            >
              <span className="block truncate text-[13px] text-slate-800">{f.nom}</span>
              <span className="block text-[11.5px] text-slate-500">
                {[f.commune, f.telephone].filter(Boolean).join(" · ")}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {fiches.length > 8 && (
        <p className="mt-2 px-2 text-[11.5px] text-slate-400">{t("+ {n} autres dans la liste", { n: fiches.length - 8 })}</p>
      )}
    </div>
  );
}

export default function AppelScreen({
  call,
  set,
  fiche,
  editing,
  onSave,
  onSaveSeul,
  onCancel,
  onDentisteY,
  afficherTout,
  setAfficherTout,
  doublon,
  parent,
  fileAttente = [],
  onOuvrirFiche,
  navigation,
}) {
  const t = useT();
  const lib = (cle) => t(COLUMN_BY_KEY[cle].label);
  const [identiteOuverte, setIdentiteOuverte] = useState(!call.dentiste);
  const montre = (cle) => visible(call, cle, afficherTout);
  const manquants = champsManquants(call);
  const rdvOui = call.rdvPossible === "oui";
  const rdvNon = call.rdvPossible === "non";
  const suite = call.etatFiche || "fait";
  // une fiche sans aucune réponse ne doit pas produire de ligne dans l'export
  const exportable = suite === "fait" || aDesReponses(call);

  return (
    <div className="pb-28 lg:pb-0 xl:grid xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start xl:gap-6">
      <div className="min-w-0">
        {/* feuilleter les fiches une par une, dans l'ordre de la liste */}
        {navigation && navigation.rang >= 0 && navigation.total > 1 && (
          <div
            data-role="navigation-fiches"
            className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5"
          >
            <button
              onClick={navigation.surPrecedent}
              disabled={!navigation.precedent}
              title={navigation.precedent ? navigation.precedent.nom : undefined}
              data-role="fiche-precedente"
              className="min-h-[36px] max-w-[45%] truncate rounded-lg px-2.5 text-[13px] text-slate-700 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent"
            >
              ‹ {navigation.precedent ? navigation.precedent.nom : t("Précédent")}
            </button>
            <span className="shrink-0 text-[12px] whitespace-nowrap text-slate-500 tabular-nums">
              {navigation.rang + 1} / {navigation.total}
            </span>
            <button
              onClick={navigation.surSuivant}
              disabled={!navigation.suivant}
              title={navigation.suivant ? navigation.suivant.nom : undefined}
              data-role="fiche-suivante"
              className="min-h-[36px] max-w-[45%] truncate rounded-lg px-2.5 text-[13px] text-slate-700 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent"
            >
              {navigation.suivant ? navigation.suivant.nom : t("Suivant")} ›
            </button>
          </div>
        )}

        {!call.dentiste && fileAttente.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 bg-white p-3">
            <div>
              <div className="text-[11.5px] font-semibold tracking-wide text-slate-500 uppercase">
                {t("Prochain praticien à appeler")}
              </div>
              <div className="text-[15px] font-medium text-slate-900">{fileAttente[0].nom}</div>
              <div className="text-[12px] text-slate-500">
                {[fileAttente[0].commune, fileAttente[0].telephone].filter(Boolean).join(" · ")}
              </div>
            </div>
            <Bouton onClick={() => onOuvrirFiche(fileAttente[0])}>{t("Ouvrir sa fiche")}</Bouton>
          </div>
        )}

        {parent && (
          <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-900">
            <strong>{t("Scénario C — dentiste Y.")}</strong>{" "}
            {t("Cette fiche est rattachée à {nom} : à l'export, elle sera placée juste après lui et surlignée en jaune.", {
              nom: parent.dentiste || t("le dentiste X"),
            })}
          </div>
        )}

        {doublon && (
          <div className="mb-3 rounded-xl border border-red-300 bg-red-50 p-3 text-[13px] text-red-800">
            {t("Ce numéro a déjà été appelé ({nom}{quand}). Le scénario demande de ne pas appeler deux fois le même cabinet.", {
              nom: doublon.dentiste,
              quand: doublon.dateAppel ? t(" le {date}", { date: frDate(doublon.dateAppel) }) : "",
            })}
          </div>
        )}

        <Identite call={call} set={set} fiche={fiche} ouvert={identiteOuverte} setOuvert={setIdentiteOuverte} />

        {/* la même aide passe dans la colonne de droite sur grand écran */}
        <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50/60 p-3 xl:hidden">
          <div className="text-[13px] leading-snug text-teal-900 italic">« {scenario(t.langue).ouverture} »</div>
          <ReponsesTypes compact />
        </div>

        <Block title={t("Quand")}>
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Field label={lib("dateAppel")} type="date" value={call.dateAppel} onChange={set("dateAppel")} />
            <Field
              label={t("Heure de l'appel")}
              type="time"
              value={call.heureAppel}
              onChange={set("heureAppel")}
              suffix={
                <Bouton variant="ghost" className="shrink-0" onClick={() => set("heureAppel")(nowTime())}>
                  {t("Maintenant")}
                </Bouton>
              }
            />
          </div>
        </Block>

        <Block title={t("Questions posées par le cabinet")}>
          <div className="lg:grid lg:grid-cols-2 lg:gap-x-6">
            <Choice
              label={lib("interventionMajoree")}
              options={OUI_NON}
              value={call.interventionMajoree}
              onChange={set("interventionMajoree")}
            />
            <Choice
              label={lib("registreNational")}
              options={OUI_NON}
              value={call.registreNational}
              onChange={set("registreNational")}
            />
          </div>
          {besoinRappel(call) && (
            <div className="rounded-lg bg-amber-100 px-3 py-2 text-[12.5px] text-amber-900">
              {t("À rappeler le lendemain avec le profil « intervention majorée ». La fiche apparaîtra dans l'onglet Suivi.")}
            </div>
          )}
        </Block>

        <Block title={t("Résultat de l'appel")} tone={rdvOui ? "yes" : rdvNon ? "no" : "plain"}>
          <Choice label={lib("rdvPossible")} options={OUI_NON} value={call.rdvPossible} onChange={set("rdvPossible")} />

          {montre("raison") && (
            <>
              <Choice label={lib("raison")} options={RAISONS} value={call.raison} onChange={set("raison")} />
              {montre("raisonPrecision") && (
                <Field
                  label={t("Préciser")}
                  value={call.raisonPrecision}
                  onChange={set("raisonPrecision")}
                  placeholder={t("Ce que le cabinet a répondu")}
                />
              )}
              <div className="lg:grid lg:grid-cols-2 lg:gap-x-6">
                <Choice
                  label={lib("orienteMemePratique")}
                  hint={t("Si oui : encoder aussi ce dentiste Y (bouton en bas de page).")}
                  options={OUI_NON}
                  value={call.orienteMemePratique}
                  onChange={set("orienteMemePratique")}
                />
                <Choice
                  label={lib("orienteAutreCabinet")}
                  options={OUI_NON}
                  value={call.orienteAutreCabinet}
                  onChange={set("orienteAutreCabinet")}
                />
              </div>
              {(call.orienteMemePratique === "oui" || call.orienteAutreCabinet === "oui") && !parent && (
                <div className="rounded-lg bg-amber-100 px-3 py-2 text-[12.5px] text-amber-900">
                  {t("Un autre dentiste vous a été proposé : encode-le avec le bouton « Enregistrer et encoder le dentiste Y » en bas de page. Il rejoindra ta liste, marqué « dentiste Y ».")}
                </div>
              )}
            </>
          )}

          {montre("datePremierRdv") && (
            <>
              <div className="lg:grid lg:grid-cols-2 lg:gap-x-6">
                <Field label={lib("datePremierRdv")} type="date" value={call.datePremierRdv} onChange={set("datePremierRdv")} />
                <Field
                  label={lib("prix")}
                  hint={t("Le chiffre seul, même approximatif.")}
                  value={call.prix}
                  onChange={set("prix")}
                  inputMode="decimal"
                  placeholder={t("ex. 45")}
                />
              </div>
              <Choice
                label={lib("supplementPremierRdv")}
                options={SUPPLEMENT}
                value={call.supplementPremierRdv}
                onChange={set("supplementPremierRdv")}
              />
              <Choice label={lib("infoPrix")} options={INFO_PRIX} value={call.infoPrix} onChange={set("infoPrix")} />
              <Choice
                label={lib("rdvSansSupplement")}
                hint={t("Si le premier rendez-vous est déjà au tarif officiel : oui.")}
                options={SANS_SUPP}
                value={call.rdvSansSupplement}
                onChange={set("rdvSansSupplement")}
                auto={call.supplementPremierRdv === "sans supplément"}
              />
              {montre("dateSansSupplement") && (
                <>
                  <Field
                    label={lib("dateSansSupplement")}
                    type="date"
                    value={call.dateSansSupplement}
                    onChange={set("dateSansSupplement")}
                    auto={call.supplementPremierRdv === "sans supplément"}
                  />
                  <Choice
                    label={lib("memeCabinet")}
                    options={MEME_CABINET}
                    value={call.memeCabinet}
                    onChange={set("memeCabinet")}
                  />
                </>
              )}
              {montre("adresseSansSupplement") && (
                <Field
                  label={lib("adresseSansSupplement")}
                  value={call.adresseSansSupplement}
                  onChange={set("adresseSansSupplement")}
                />
              )}
            </>
          )}
        </Block>

        <Block title={t("Hygiéniste bucco-dentaire")}>
          <Choice label={lib("hygieniste")} options={OUI_NON} value={call.hygieniste} onChange={set("hygieniste")} />
          {montre("infoRemboursement") && (
            <Choice
              label={lib("infoRemboursement")}
              options={OUI_NON}
              value={call.infoRemboursement}
              onChange={set("infoRemboursement")}
            />
          )}
          {montre("remboursement") && (
            <Choice
              label={lib("remboursement")}
              options={REMBOURSEMENT}
              value={call.remboursement}
              onChange={set("remboursement")}
            />
          )}
        </Block>

        <Block>
          <Area
            label={lib("remarques")}
            value={call.remarques}
            onChange={set("remarques")}
            placeholder={t("Ce que tu veux retenir de l'appel")}
          />
          <Case checked={afficherTout} onChange={setAfficherTout}>
            {t("Afficher toutes les colonnes, même celles qui ne s'appliquent pas")}
          </Case>
          {manquants.length > 0 && (
            <div className="text-[12px] text-slate-500">
              {t("Encore vide : {champs}. Laisse vide si tu n'es pas sûr — c'est ce que demande le scénario.", {
                champs: manquants.map((m) => t(m)).join(" · "),
              })}
            </div>
          )}
        </Block>

        {!parent && (
          <Block title={t("Pratique de groupe")}>
            <p className="mb-3 text-[13px] text-slate-600">
              {t("Le cabinet a proposé un autre dentiste de la même pratique ? Enregistre d'abord cette fiche, puis encode le dentiste Y : il sera exporté juste en dessous, surligné.")}
            </p>
            <Bouton variant="ghost" onClick={onDentisteY} className="w-full lg:w-auto">
              {t("Enregistrer et encoder le dentiste Y")}
            </Bouton>
          </Block>
        )}

        {fiche && (
          <Block title={t("Suite à donner")}>
            <Choice
              hint={t("Par défaut « Fait ». À changer si le cabinet est injoignable ou s'il faut rappeler.")}
              options={SUITES.map((e) => e.key)}
              value={call.etatFiche || "fait"}
              onChange={(cle) => set("etatFiche")(cle || "fait")}
              rendu={(cle) => t(LIBELLE_ETAT[cle])}
              teintes={TEINTE_ETAT}
            />
            {!exportable && (
              <div className="rounded-lg bg-slate-100 px-3 py-2 text-[12.5px] text-slate-600">
                {t("Rien n'a encore été encodé : aucune ligne ne partira dans le fichier Excel, le praticien est simplement marqué dans la liste.")}
              </div>
            )}
          </Block>
        )}

        <div
          className="fixed right-0 bottom-[56px] left-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:sticky lg:right-auto lg:bottom-0 lg:left-auto lg:rounded-t-xl lg:border-x lg:px-3"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-2 lg:max-w-none">
            {/* deux façons d'enregistrer : enchaîner les appels, ou rester sur
                la fiche pour la relire et la corriger */}
            <Bouton onClick={onSave} className="flex-1 lg:flex-none">
              {editing
                ? t("Mettre à jour et passer au suivant")
                : suite === "fait"
                  ? t("Enregistrer et passer au suivant")
                  : t("Marquer « {etat} » et passer au suivant", { etat: t(LIBELLE_ETAT[suite]) })}
            </Bouton>
            <Bouton
              variant="ghost"
              onClick={onSaveSeul}
              className="shrink-0"
              title={t("Enregistrer et rester sur cette fiche")}
            >
              {editing ? t("Mettre à jour") : t("Enregistrer")}
            </Bouton>
            <span className="hidden text-[11.5px] text-slate-400 lg:inline">
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-sans">Ctrl</kbd> +{" "}
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-sans">{t("Entrée")}</kbd>
              {" · "}
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-sans">Ctrl</kbd> +{" "}
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-sans">{t("Maj")}</kbd> +{" "}
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-sans">{t("Entrée")}</kbd>
            </span>
            {editing && (
              <Bouton variant="ghost" onClick={onCancel} className="lg:ml-auto">
                {t("Annuler")}
              </Bouton>
            )}
          </div>
        </div>
      </div>

      {/* colonne d'appoint : visible seulement quand l'écran est assez large */}
      <aside className="hidden xl:sticky xl:top-6 xl:block xl:space-y-4">
        <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-3">
          <h2 className="mb-1 text-[12px] font-semibold tracking-wide text-teal-700 uppercase">{t("Ouverture")}</h2>
          <p className="text-[13px] leading-snug text-teal-900 italic">« {scenario(t.langue).ouverture} »</p>
          <div className="mt-3 border-t border-teal-200 pt-2">
            <h2 className="text-[12px] font-semibold tracking-wide text-teal-700 uppercase">{t("Réponses types")}</h2>
            <ReponsesTypes />
          </div>
        </div>
        <FileAttente fiches={fileAttente.filter((f) => f.id !== call.prospectId)} onOuvrir={onOuvrirFiche} />
      </aside>
    </div>
  );
}
