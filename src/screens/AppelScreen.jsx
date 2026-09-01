import { useState } from "react";
import { Area, Block, Bouton, Case, Choice, Field, Puce } from "../components/ui.jsx";
import {
  COLUMN_BY_KEY,
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
import { PHRASE_OUVERTURE, REPONSES_TYPES } from "../lib/scenario.js";

const lib = (cle) => COLUMN_BY_KEY[cle].label;

function Identite({ call, set, fiche, ouvert, setOuvert }) {
  const tel = telHref(call.telephone);
  return (
    <Block
      title="Le dentiste"
      action={
        <button onClick={() => setOuvert(!ouvert)} className="text-[12px] text-teal-800 underline underline-offset-2">
          {ouvert ? "Replier" : "Modifier"}
        </button>
      }
    >
      <div className="mb-3">
        <div className="text-[17px] leading-tight font-semibold text-slate-900">
          {call.dentiste || <span className="text-slate-400">Nom du dentiste</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-slate-600">
          {call.province && <Puce>{call.province}</Puce>}
          {call.statut && <Puce tone="teal">{call.statut}</Puce>}
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
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-teal-800 px-4 py-2.5 text-[15px] font-medium text-white active:bg-teal-900"
          >
            Appeler {call.telephone}
          </a>
        ) : (
          <span className="text-[13px] text-slate-500">Pas de numéro encodé</span>
        )}
        {fiche?.site && (
          <a
            href={fiche.site.startsWith("http") ? fiche.site : `https://${fiche.site}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[13px] text-slate-700"
          >
            {fiche.site}
          </a>
        )}
      </div>

      {!ouvert && !call.statut && (
        <div className="mt-4 border-t border-slate-200 pt-3">
          <Choice
            label={lib("statut")}
            hint="Colonne obligatoire du fichier de réponses."
            options={STATUTS}
            value={call.statut}
            onChange={set("statut")}
          />
        </div>
      )}

      {ouvert && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <Field label={lib("dentiste")} value={call.dentiste} onChange={set("dentiste")} placeholder="Nom tel qu'il figure dans le fichier" />
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

function AideScenario() {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50/60 p-3">
      <div className="text-[13px] leading-snug text-teal-900 italic">« {PHRASE_OUVERTURE} »</div>
      <button
        onClick={() => setOuvert(!ouvert)}
        className="mt-2 text-[12px] font-medium text-teal-800 underline underline-offset-2"
      >
        {ouvert ? "Masquer les réponses types" : "Réponses aux questions du secrétariat"}
      </button>
      {ouvert && (
        <dl className="mt-2 space-y-2">
          {REPONSES_TYPES.map((item) => (
            <div key={item.q} className="text-[12.5px] leading-snug">
              <dt className="text-slate-600">{item.q}</dt>
              <dd className="font-medium text-teal-900">{item.r}</dd>
            </div>
          ))}
        </dl>
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
  onCancel,
  onDentisteY,
  afficherTout,
  setAfficherTout,
  doublon,
  parent,
}) {
  const [identiteOuverte, setIdentiteOuverte] = useState(!call.dentiste);
  const montre = (cle) => visible(call, cle, afficherTout);
  const manquants = champsManquants(call);
  const rdvOui = call.rdvPossible === "oui";
  const rdvNon = call.rdvPossible === "non";

  return (
    <div className="pb-28">
      {parent && (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-900">
          <strong>Scénario C — dentiste Y.</strong> Cette fiche est rattachée à{" "}
          <strong>{parent.dentiste || "le dentiste X"}</strong> : à l'export, elle sera placée juste après lui et
          surlignée en jaune.
        </div>
      )}

      {doublon && (
        <div className="mb-3 rounded-xl border border-red-300 bg-red-50 p-3 text-[13px] text-red-800">
          Ce numéro a déjà été appelé (<strong>{doublon.dentiste}</strong>
          {doublon.dateAppel ? ` le ${frDate(doublon.dateAppel)}` : ""}). Le scénario demande de ne pas appeler deux fois
          le même cabinet.
        </div>
      )}

      <Identite call={call} set={set} fiche={fiche} ouvert={identiteOuverte} setOuvert={setIdentiteOuverte} />

      <AideScenario />

      <Block title="Quand">
        <div className="grid gap-x-3 sm:grid-cols-2">
          <Field label={lib("dateAppel")} type="date" value={call.dateAppel} onChange={set("dateAppel")} />
          <Field
            label="Heure de l'appel"
            type="time"
            value={call.heureAppel}
            onChange={set("heureAppel")}
            suffix={
              <Bouton variant="ghost" className="shrink-0" onClick={() => set("heureAppel")(nowTime())}>
                Maintenant
              </Bouton>
            }
          />
        </div>
      </Block>

      <Block title="Questions posées par le cabinet">
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
        {besoinRappel(call) && (
          <div className="rounded-lg bg-amber-100 px-3 py-2 text-[12.5px] text-amber-900">
            À rappeler le lendemain avec le profil « intervention majorée ». La fiche apparaîtra dans l'onglet Suivi.
          </div>
        )}
      </Block>

      <Block title="Résultat de l'appel" tone={rdvOui ? "yes" : rdvNon ? "no" : "plain"}>
        <Choice label={lib("rdvPossible")} options={OUI_NON} value={call.rdvPossible} onChange={set("rdvPossible")} />

        {montre("raison") && (
          <>
            <Choice label={lib("raison")} options={RAISONS} value={call.raison} onChange={set("raison")} />
            {montre("raisonPrecision") && (
              <Field
                label="Préciser"
                value={call.raisonPrecision}
                onChange={set("raisonPrecision")}
                placeholder="Ce que le cabinet a répondu"
              />
            )}
            <Choice
              label={lib("orienteMemePratique")}
              hint="Si oui : encoder aussi ce dentiste Y (bouton en bas de page)."
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
          </>
        )}

        {montre("datePremierRdv") && (
          <>
            <Field label={lib("datePremierRdv")} type="date" value={call.datePremierRdv} onChange={set("datePremierRdv")} />
            <Choice
              label={lib("supplementPremierRdv")}
              options={SUPPLEMENT}
              value={call.supplementPremierRdv}
              onChange={set("supplementPremierRdv")}
            />
            <Choice label={lib("infoPrix")} options={INFO_PRIX} value={call.infoPrix} onChange={set("infoPrix")} />
            <Field
              label={lib("prix")}
              hint="Le chiffre seul, même approximatif."
              value={call.prix}
              onChange={set("prix")}
              inputMode="decimal"
              placeholder="ex. 45"
            />
            <Choice
              label={lib("rdvSansSupplement")}
              hint="Si le premier rendez-vous est déjà au tarif officiel : oui."
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

      <Block title="Hygiéniste bucco-dentaire">
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
        <Area label={lib("remarques")} value={call.remarques} onChange={set("remarques")} placeholder="Ce que tu veux retenir de l'appel" />
        <Case checked={afficherTout} onChange={setAfficherTout}>
          Afficher toutes les colonnes, même celles qui ne s'appliquent pas
        </Case>
        {manquants.length > 0 && (
          <div className="text-[12px] text-slate-500">
            Encore vide : {manquants.join(" · ")}. Laisse vide si tu n'es pas sûr — c'est ce que demande le scénario.
          </div>
        )}
      </Block>

      {!parent && (
        <Block title="Pratique de groupe">
          <p className="mb-3 text-[13px] text-slate-600">
            Le cabinet a proposé un autre dentiste de la même pratique ? Enregistre d'abord cette fiche, puis encode le
            dentiste Y : il sera exporté juste en dessous, surligné.
          </p>
          <Bouton variant="ghost" onClick={onDentisteY} className="w-full">
            Enregistrer et encoder le dentiste Y
          </Bouton>
        </Block>
      )}

      <div
        className="fixed right-0 bottom-[56px] left-0 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-2xl gap-2">
          <Bouton onClick={onSave} className="flex-1">
            {editing ? "Mettre à jour l'appel" : "Enregistrer et passer au suivant"}
          </Bouton>
          {editing && (
            <Bouton variant="ghost" onClick={onCancel}>
              Annuler
            </Bouton>
          )}
        </div>
      </div>
    </div>
  );
}
