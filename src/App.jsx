import { useEffect, useMemo, useRef, useState } from "react";
import { Tiroir } from "./components/ui.jsx";
import ScenarioSheet from "./components/ScenarioSheet.jsx";
import RaccourcisSheet from "./components/RaccourcisSheet.jsx";
import AppelScreen from "./screens/AppelScreen.jsx";
import ListeScreen from "./screens/ListeScreen.jsx";
import JourneeScreen from "./screens/JourneeScreen.jsx";
import SuiviScreen from "./screens/SuiviScreen.jsx";
import DonneesScreen from "./screens/DonneesScreen.jsx";
import {
  ETATS_PROSPECT,
  aDesReponses,
  besoinRappel,
  emptyCall,
  emptyProspect,
  estAjoute,
  estOriente,
  ficheSelonAppel,
  fichesDeLaMission,
  phoneKey,
  rdvPris,
} from "./lib/model.js";
import { applique, majAnnulation } from "./lib/regles.js";
import { charge, enregistre, etatVide, fusionneSauvegarde, nouvelId } from "./lib/storage.js";
import { nowTime, today } from "./lib/dates.js";
import { CODES_LANGUE, FournisseurLangue, LANGUES, creeTraducteur, langueParDefaut } from "./lib/i18n.js";

const LIBELLE_ETAT = Object.fromEntries(ETATS_PROSPECT.map((e) => [e.key, e.label]));

/** Place la fiche juste après celle qui l'a proposée, comme dans l'export. */
function inserePres(prospects, fiche) {
  if (!fiche) return prospects;
  const index = prospects.findIndex((p) => p.id === fiche.orienteDe);
  if (index < 0) return [...prospects, fiche];
  return [...prospects.slice(0, index + 1), fiche, ...prospects.slice(index + 1)];
}

const ONGLETS = [
  ["liste", "Liste", "Qui reste à appeler"],
  ["appel", "Appel", "Encoder l'appel en cours"],
  ["journee", "Journée", "Ce qui est déjà encodé"],
  ["suivi", "Suivi", "Rappels et annulations"],
  ["donnees", "Données", "Import, Excel, sauvegarde"],
];

/** Choix de la langue — l'affichage seulement : les données restent en français. */
function ChoixLangue({ langue, onChange, t }) {
  return (
    <div>
      <div className="flex gap-1">
        {LANGUES.map((l) => (
          <button
            key={l.code}
            onClick={() => onChange(l.code)}
            aria-pressed={langue === l.code}
            title={l.nom}
            className={
              "flex-1 rounded-lg px-2 py-1.5 text-[12px] font-medium transition-colors " +
              (langue === l.code
                ? "bg-teal-800 text-white"
                : "border border-slate-300 bg-white text-slate-600 hover:border-slate-400")
            }
          >
            {l.court}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
        {t("Les réponses partent en français dans le fichier Excel, quelle que soit la langue choisie.")}
      </p>
    </div>
  );
}

export default function App() {
  const [etat, setEtat] = useState(null);
  const [call, setCall] = useState(() => emptyCall());
  const [editing, setEditing] = useState(null);
  const [onglet, setOnglet] = useState("liste");
  const [message, setMessage] = useState("");
  const [scenario, setScenario] = useState(false);
  const [raccourcis, setRaccourcis] = useState(false);
  const [alerte, setAlerte] = useState("");
  const minuteur = useRef(null);
  const langue = CODES_LANGUE.includes(etat?.reglages?.langue) ? etat.reglages.langue : "fr";
  const t = useMemo(() => creeTraducteur(langue), [langue]);
  // les raccourcis clavier sont posés une fois, mais doivent appeler les
  // fonctions du rendu courant
  const actions = useRef({});

  useEffect(() => {
    const charge0 = charge();
    if (!CODES_LANGUE.includes(charge0.reglages.langue)) charge0.reglages.langue = langueParDefaut();
    setEtat(charge0);
    if (charge0.brouillon) setCall({ ...emptyCall(), ...charge0.brouillon });
    if (charge0.prospects.length === 0 && charge0.calls.length === 0) setOnglet("donnees");
  }, []);

  // Sauvegarde différée : on n'écrit pas à chaque frappe.
  const aEnregistrer = useRef(null);
  useEffect(() => {
    if (!etat) return;
    const brouillon = call.dentiste || call.telephone || call.rdvPossible ? call : null;
    aEnregistrer.current = { ...etat, brouillon };
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => {
      setAlerte(enregistre(aEnregistrer.current) || "");
      aEnregistrer.current = null;
    }, 400);
    return () => clearTimeout(minuteur.current);
  }, [etat, call]);

  // …mais si l'onglet se ferme ou passe en arrière-plan pendant ce délai, on
  // écrit tout de suite : c'est exactement le moment où l'on change d'appareil.
  useEffect(() => {
    const vide = () => {
      if (!aEnregistrer.current) return;
      clearTimeout(minuteur.current);
      enregistre(aEnregistrer.current);
      aEnregistrer.current = null;
    };
    const auMasquage = () => document.visibilityState === "hidden" && vide();
    window.addEventListener("pagehide", vide);
    document.addEventListener("visibilitychange", auMasquage);
    return () => {
      window.removeEventListener("pagehide", vide);
      document.removeEventListener("visibilitychange", auMasquage);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = langue;
    // un message affiché dans l'ancienne langue n'aurait plus de sens
    setMessage("");
  }, [langue]);

  useEffect(() => {
    const auClavier = (e) => {
      const cible = e.target;
      const saisie =
        cible instanceof HTMLElement &&
        (cible.tagName === "INPUT" || cible.tagName === "TEXTAREA" || cible.tagName === "SELECT" || cible.isContentEditable);
      const commande = e.ctrlKey || e.metaKey;

      if (e.key === "Escape") {
        setScenario(false);
        setRaccourcis(false);
        return;
      }
      if (commande && (e.key === "Enter" || e.key.toLowerCase() === "s")) {
        e.preventDefault();
        actions.current.enregistrer?.();
        return;
      }
      if (e.altKey && /^[1-5]$/.test(e.key)) {
        e.preventDefault();
        setOnglet(ONGLETS[Number(e.key) - 1][0]);
        return;
      }
      if (saisie || commande || e.altKey) return;
      if (e.key === "?") {
        e.preventDefault();
        setRaccourcis(true);
      } else if (e.key === "/") {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent("focus-recherche"));
      }
    };
    window.addEventListener("keydown", auClavier);
    return () => window.removeEventListener("keydown", auClavier);
  }, []);

  const flash = (texte) => {
    setMessage(texte);
    setTimeout(() => setMessage((m) => (m === texte ? "" : m)), 4000);
  };

  const majEtat = (patch) => setEtat((e) => ({ ...e, ...(typeof patch === "function" ? patch(e) : patch) }));

  const set = (cle) => (valeur) => setCall((c) => applique(c, cle, valeur));

  const ficheLiee = useMemo(
    () => (etat && call.prospectId ? etat.prospects.find((p) => p.id === call.prospectId) : null),
    [etat, call.prospectId]
  );

  const parent = useMemo(
    () => (etat && call.groupeDe ? etat.calls.find((c) => c.id === call.groupeDe) : null),
    [etat, call.groupeDe]
  );

  const doublon = useMemo(() => {
    if (!etat) return null;
    const cle = phoneKey(call.telephone);
    if (!cle) return null;
    return etat.calls.find((c) => c.id !== editing && !c.roleY && phoneKey(c.telephone) === cle) || null;
  }, [etat, call.telephone, editing]);

  if (!etat) return <div className="p-6 text-sm text-slate-500">{t("Chargement…")}</div>;

  /** Suite à donner à afficher : celle de l'appel, sinon celle du praticien. */
  const suiteDe = (call, fiche) =>
    call?.etatFiche || (fiche && fiche.etat !== "a_appeler" ? fiche.etat : "fait");

  const ouvreAppel = (fiche) => {
    const existant = etat.calls.find((c) => c.prospectId === fiche.id);
    if (existant) {
      setCall({ ...emptyCall(), ...existant, etatFiche: suiteDe(existant, fiche) });
      setEditing(existant.id);
    } else {
      setCall(
        emptyCall({
          province: fiche.province || etat.reglages.province,
          dentiste: fiche.nom,
          statut: fiche.statut || etat.reglages.statut,
          telephone: fiche.telephone,
          dateAppel: today(),
          heureAppel: nowTime(),
          prospectId: fiche.id,
          // on repart de « fait » sauf si le praticien porte déjà une autre suite
          etatFiche: fiche.etat === "a_appeler" ? "fait" : fiche.etat,
        })
      );
      setEditing(null);
    }
    setOnglet("appel");
    window.scrollTo({ top: 0 });
  };

  const prochaines = etat.prospects.filter((p) => p.etat === "a_appeler");
  const prochaineFiche = (saufId) => prochaines.find((p) => p.id !== saufId) || null;

  /**
   * Ouvre un formulaire d'appel vierge pour un praticien qui n'est dans aucun
   * fichier. Sans cela, taper un nom par-dessus la fiche ouverte renommerait
   * ce praticien-là au lieu d'en ajouter un.
   */
  const ajoutePraticien = () => {
    // un appel à moitié encodé ne doit pas disparaître d'un clic
    const enCours = call.dentiste || call.telephone || call.rdvPossible;
    if (enCours && !window.confirm(t("L'appel en cours n'est pas enregistré. Le remplacer par une fiche vierge ?"))) return;
    setEditing(null);
    setCall(
      emptyCall({
        dateAppel: today(),
        heureAppel: nowTime(),
        province: etat.reglages.province,
        statut: etat.reglages.statut,
      })
    );
    setOnglet("appel");
    window.scrollTo({ top: 0 });
    flash(t("Encode ce praticien : il rejoindra la liste une fois l'appel enregistré."));
  };

  /** Enregistre l'appel en cours et renvoie l'appel enregistré. */
  const enregistreAppel = () => {
    if (!call.dentiste.trim()) {
      flash(t("Indique au moins le nom du dentiste avant d'enregistrer."));
      return null;
    }
    const complet = majAnnulation({
      ...call,
      id: editing || call.id || nouvelId(),
      createdAt: call.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const suite = complet.etatFiche || "fait";
    const existe = etat.calls.some((c) => c.id === complet.id);

    // Un appel encodé sans fiche liée crée la sienne : le praticien rejoint la
    // liste comme les autres, qu'il vienne du scénario C (dentiste Y proposé
    // par un cabinet) ou qu'on l'ait simplement tapé à la main.
    let nouvelleFiche = null;
    if (!complet.prospectId && complet.dentiste.trim()) {
      const parent = complet.roleY ? etat.calls.find((c) => c.id === complet.groupeDe) : null;
      const ficheParent = parent ? etat.prospects.find((p) => p.id === parent.prospectId) : null;
      nouvelleFiche = emptyProspect({
        id: nouvelId("p"),
        nom: complet.dentiste,
        telephone: complet.telephone,
        province: complet.province,
        statut: complet.statut,
        // même cabinet : l'adresse du dentiste X est la bonne
        adresse: ficheParent?.adresse || "",
        commune: ficheParent?.commune || "",
        cp: ficheParent?.cp || "",
        etat: suite,
        origine: complet.roleY ? "oriente" : "ajoute",
        orienteDe: ficheParent?.id || null,
        orientePar: parent?.dentiste || "",
      });
      complet.prospectId = nouvelleFiche.id;
    }
    // un cabinet injoignable dont rien n'a été encodé ne doit pas laisser une
    // ligne vide dans le fichier de réponses : on ne marque que la fiche
    const garde = existe || suite === "fait" || aDesReponses(complet);

    majEtat((e) => ({
      calls: existe
        ? e.calls.map((c) => (c.id === complet.id ? complet : c))
        : garde
          ? [...e.calls, complet]
          : e.calls,
      // la fiche suit l'appel : état, mais aussi numéro, nom, province et
      // statut corrigés pendant la conversation
      prospects: inserePres(
        e.prospects.map((p) => (p.id === complet.prospectId ? ficheSelonAppel(p, complet, suite) : p)),
        nouvelleFiche
      ),
      reglages: { ...e.reglages, province: complet.province || e.reglages.province, statut: complet.statut || e.reglages.statut },
    }));
    return { ...complet, garde, suite };
  };

  const enregistreEtSuivant = () => {
    const complet = enregistreAppel();
    if (!complet) return;
    const suivante = prochaineFiche(complet.prospectId);
    setEditing(null);
    const marque = complet.suite !== "fait";
    if (suivante) {
      ouvreAppel(suivante);
      flash(
        marque
          ? t("{fiche} : {etat}. Au suivant : {nom}.", {
              fiche: complet.dentiste,
              etat: t(LIBELLE_ETAT[complet.suite]),
              nom: suivante.nom,
            })
          : t("Appel enregistré. Au suivant : {nom}.", { nom: suivante.nom })
      );
    } else {
      setCall(
        emptyCall({
          province: complet.province,
          statut: complet.statut,
          dateAppel: today(),
          heureAppel: nowTime(),
        })
      );
      flash(
        marque
          ? t("{fiche} : {etat}.", { fiche: complet.dentiste, etat: t(LIBELLE_ETAT[complet.suite]) })
          : t("Appel enregistré.")
      );
      window.scrollTo({ top: 0 });
    }
  };

  const encodeDentisteY = (source) => {
    const base = source || enregistreAppel();
    if (!base) return;
    setCall(
      emptyCall({
        province: base.province,
        statut: "",
        telephone: base.telephone,
        dateAppel: base.dateAppel || today(),
        heureAppel: base.heureAppel || nowTime(),
        groupeDe: base.id,
        roleY: true,
      })
    );
    setEditing(null);
    setOnglet("appel");
    window.scrollTo({ top: 0 });
    flash(t("Encode maintenant le dentiste Y proposé par le cabinet."));
  };

  const editeAppel = (c) => {
    const fiche = etat.prospects.find((p) => p.id === c.prospectId);
    setCall({ ...emptyCall(), ...c, etatFiche: suiteDe(c, fiche) });
    setEditing(c.id);
    setOnglet("appel");
    window.scrollTo({ top: 0 });
  };

  const majAppel = (id, patch) =>
    majEtat((e) => ({ calls: e.calls.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c)) }));

  const supprimeAppel = (id) => {
    if (!window.confirm(t("Supprimer définitivement cet appel ?"))) return;
    majEtat((e) => ({ calls: e.calls.filter((c) => c.id !== id && c.groupeDe !== id) }));
    if (editing === id) {
      setEditing(null);
      setCall(emptyCall());
    }
    flash(t("Appel supprimé."));
  };

  const ajouteProspects = (fiches) => {
    majEtat((e) => {
      const connus = new Set(e.prospects.map((p) => `${p.nom}|${phoneKey(p.telephone)}`));
      const nouveaux = fiches.filter((f) => !connus.has(`${f.nom}|${phoneKey(f.telephone)}`));
      return { prospects: [...e.prospects, ...nouveaux] };
    });
    flash(t("{n} praticiens lus. Ouvre l'onglet « Liste » : il n'y a plus qu'à appeler.", { n: fiches.length }));
    setOnglet("liste");
  };

  const ajouteCalls = (appels) => {
    majEtat((e) => ({ calls: [...e.calls, ...appels] }));
    flash(t("{n} appels importés.", { n: appels.length }));
    setOnglet("journee");
  };

  const chargeSauvegarde = (data) => {
    const prospects = Array.isArray(data?.prospects) ? data.prospects : [];
    const calls = Array.isArray(data?.calls) ? data.calls : Array.isArray(data) ? data : [];
    if (!prospects.length && !calls.length) {
      flash(t("Cette sauvegarde ne contient ni liste d'appel ni appel."));
      return;
    }
    const remplacer = window.confirm(
      t("Sauvegarde : {p} praticiens et {c} appels.", { p: prospects.length, c: calls.length }) +
        "\n\n" +
        t("OK = remplacer ce qu'il y a sur cet appareil") +
        "\n" +
        t("Annuler = compléter sans rien effacer")
    );
    majEtat((e) => fusionneSauvegarde(e, data, remplacer));
    flash(remplacer ? t("Sauvegarde chargée.") : t("Sauvegarde ajoutée à ce qui existait déjà."));
  };

  actions.current = { enregistrer: () => (onglet === "appel" ? enregistreEtSuivant() : null) };

  // le badge de l'onglet Suivi compte tout ce qui y reste à faire
  const aRappeler = etat.prospects.filter((p) => p.etat === "rappeler").length;
  const enAttente = etat.calls.filter((c) => besoinRappel(c) && !c.rappelFait).length;
  const aAnnuler = etat.calls.filter((c) => rdvPris(c) && !c.annulation?.faiteLe).length;
  const badges = { suivi: aRappeler + enAttente + aAnnuler };
  // le quota de la mission porte sur le fichier reçu : les dentistes vers
  // lesquels on nous oriente s'ajoutent, ils ne remplacent personne
  const fichesMission = fichesDeLaMission(etat.prospects);
  const orientes = etat.prospects.filter(estOriente).length;
  const ajoutes = etat.prospects.filter(estAjoute).length;
  const faits = fichesMission.filter((p) => p.etat === "fait").length;
  const pourcent = fichesMission.length ? Math.round((faits / fichesMission.length) * 100) : 0;

  const ecran = (
    <>
      {onglet === "liste" && (
        <ListeScreen
          prospects={etat.prospects}
          calls={etat.calls}
          onEncoder={ouvreAppel}
          onEtat={(id, valeur) =>
            majEtat((e) => ({ prospects: e.prospects.map((p) => (p.id === id ? { ...p, etat: valeur } : p)) }))
          }
          onSupprimer={(id) => majEtat((e) => ({ prospects: e.prospects.filter((p) => p.id !== id) }))}
          onImporter={() => setOnglet("donnees")}
          onAjouter={ajoutePraticien}
          onVider={() => {
            if (window.confirm(t("Vider la liste d'appel ? Les appels déjà encodés sont conservés."))) {
              majEtat({ prospects: [] });
              flash(t("Liste d'appel vidée."));
            }
          }}
          flash={flash}
        />
      )}

      {onglet === "appel" && (
        <AppelScreen
          call={call}
          set={set}
          fiche={ficheLiee}
          parent={parent}
          doublon={doublon}
          editing={editing}
          onSave={enregistreEtSuivant}
          onCancel={() => {
            setEditing(null);
            setCall(emptyCall({ dateAppel: today() }));
          }}
          onDentisteY={() => encodeDentisteY(null)}
          afficherTout={etat.reglages.afficherTout}
          setAfficherTout={(v) => majEtat((e) => ({ reglages: { ...e.reglages, afficherTout: v } }))}
          fileAttente={prochaines}
          onOuvrirFiche={ouvreAppel}
        />
      )}

      {onglet === "journee" && (
        <JourneeScreen
          calls={etat.calls}
          onEditer={editeAppel}
          onSupprimer={supprimeAppel}
          onDentisteY={encodeDentisteY}
        />
      )}

      {onglet === "suivi" && (
        <SuiviScreen
          calls={etat.calls}
          prospects={etat.prospects}
          majAppel={majAppel}
          onEncoder={ouvreAppel}
          controles={etat.suivi.controlesRegistre}
          onControle={(date) =>
            majEtat((e) => ({
              suivi: { ...e.suivi, controlesRegistre: [...e.suivi.controlesRegistre, date] },
            }))
          }
        />
      )}

      {onglet === "donnees" && (
        <DonneesScreen
          etat={etat}
          calls={etat.calls}
          onProspects={ajouteProspects}
          onCalls={ajouteCalls}
          onSauvegarde={chargeSauvegarde}
          flash={flash}
          onViderAppels={() => {
            if (window.confirm(t("Vider les appels encodés ? À faire seulement après avoir rempli le fichier Excel."))) {
              majEtat({ calls: [] });
              setCall(emptyCall());
              setEditing(null);
              flash(t("Appels vidés."));
            }
          }}
          onToutEffacer={() => {
            if (window.confirm(t("Tout effacer : liste d'appel, appels et suivi. Cette action est définitive."))) {
              setEtat({ ...etatVide(), reglages: { ...etatVide().reglages, langue } });
              setCall(emptyCall());
              setEditing(null);
              flash(t("Application remise à zéro."));
            }
          }}
        />
      )}
    </>
  );

  const changeLangue = (code) => majEtat((e) => ({ reglages: { ...e.reglages, langue: code } }));

  return (
    <FournisseurLangue value={t}>
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* barre latérale : sur ordinateur, la navigation reste visible en permanence */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex xl:w-64">
        <div className="border-b border-slate-200 px-4 py-4">
          <h1 className="text-[16px] leading-tight font-semibold text-teal-900">{t("Appels dentistes")}</h1>
          <p className="text-[11.5px] text-slate-500">{t("Mystery shopping · Test-Achats")}</p>
        </div>

        <nav data-role="onglets-bureau" className="flex-1 overflow-y-auto p-2">
          {ONGLETS.map(([cle, libelle, aide], i) => {
            const actif = onglet === cle;
            return (
              <button
                key={cle}
                onClick={() => setOnglet(cle)}
                className={
                  "mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors " +
                  (actif ? "bg-teal-800 text-white" : "text-slate-700 hover:bg-slate-100")
                }
              >
                <span className="flex-1">
                  <span className="block text-[13.5px] font-medium">{t(libelle)}</span>
                  <span className={"block text-[11px] " + (actif ? "text-teal-100" : "text-slate-500")}>{t(aide)}</span>
                </span>
                {badges[cle] > 0 && (
                  <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-medium text-white">{badges[cle]}</span>
                )}
                <span className={"text-[10px] " + (actif ? "text-teal-200" : "text-slate-400")}>alt+{i + 1}</span>
              </button>
            );
          })}
        </nav>

        {etat.prospects.length > 0 && (
          <div className="border-t border-slate-200 px-4 py-3">
            <div className="flex items-baseline justify-between text-[12px]">
              <span className="font-medium text-slate-700">
                {t("{faits} / {total} appelés", { faits, total: fichesMission.length })}
              </span>
              <span className="text-slate-500">{t("{n} restants", { n: prochaines.length })}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-teal-700 transition-all" style={{ width: `${pourcent}%` }} />
            </div>
            {orientes > 0 && (
              <div className="mt-1.5 text-[11px] text-amber-700">
                {t.n(orientes, "+ {n} dentiste Y ajouté", "+ {n} dentistes Y ajoutés")}
              </div>
            )}
            {ajoutes > 0 && (
              <div className="mt-1.5 text-[11px] text-slate-500">
                {t.n(ajoutes, "+ {n} praticien ajouté à la main", "+ {n} praticiens ajoutés à la main")}
              </div>
            )}
          </div>
        )}

        <div className="border-t border-slate-200 p-2">
          <button
            onClick={() => setScenario(true)}
            className="mb-1 w-full rounded-lg border border-teal-800 px-3 py-2 text-[13px] font-medium text-teal-800 hover:bg-teal-50"
          >
            {t("Scénario de la mission")}
          </button>
          <button
            onClick={() => setRaccourcis(true)}
            className="mb-2 w-full rounded-lg px-3 py-1.5 text-[12px] text-slate-500 hover:bg-slate-100"
          >
            {t("Raccourcis clavier")} <kbd className="font-sans text-slate-400">?</kbd>
          </button>
          <div className="px-1">
            <ChoixLangue langue={langue} onChange={changeLangue} t={t} />
          </div>
        </div>
      </aside>

      <div className="lg:pl-60 xl:pl-64">
        <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-[76px] lg:max-w-[1180px] lg:px-6 lg:pt-6 lg:pb-10">
          {/* en-tête compacte, remplacée par la barre latérale sur ordinateur */}
          <header className="mb-3 flex items-center justify-between gap-3 lg:hidden">
            <div className="min-w-0">
              <h1 className="text-[17px] leading-tight font-semibold text-teal-900">{t("Appels dentistes")}</h1>
              <p className="truncate text-[12px] text-slate-500">
                {t.n(etat.calls.length, "{n} appel encodé", "{n} appels encodés")}
                {etat.prospects.length ? ` · ${t("{n} à appeler", { n: prochaines.length })}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <select
                value={langue}
                onChange={(e) => changeLangue(e.target.value)}
                aria-label={t("Langue")}
                className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-2 text-[12px] font-medium text-slate-700"
              >
                {LANGUES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.court}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setScenario(true)}
                className="min-h-[40px] rounded-lg border border-teal-800 px-3 py-2 text-[13px] font-medium text-teal-800"
              >
                {t("Scénario")}
              </button>
            </div>
          </header>

          <div className="mb-3 hidden items-baseline justify-between lg:flex">
            <h2 className="text-[19px] font-semibold text-slate-900">
              {t(ONGLETS.find(([c]) => c === onglet)?.[1] || "")}
            </h2>
            <p className="text-[12.5px] text-slate-500">
              {t.n(etat.calls.length, "{n} appel encodé", "{n} appels encodés")}
            </p>
          </div>

          {alerte && (
            <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
              {alerte}
            </div>
          )}
          {message && <div className="mb-3 rounded-lg bg-teal-800 px-3 py-2 text-[13px] text-white">{message}</div>}

          {ecran}
        </div>
      </div>

      {/* navigation du bas : téléphone uniquement */}
      <nav
        data-role="onglets-mobile"
        className="fixed right-0 bottom-0 left-0 z-40 border-t border-slate-200 bg-white lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-2xl">
          {ONGLETS.map(([cle, libelle]) => (
            <button
              key={cle}
              onClick={() => setOnglet(cle)}
              className={
                "relative flex-1 py-3 text-[12px] font-medium " + (onglet === cle ? "text-teal-800" : "text-slate-500")
              }
            >
              {onglet === cle && <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-teal-800" />}
              {t(libelle)}
              {badges[cle] > 0 && (
                <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] text-white">{badges[cle]}</span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <Tiroir ouvert={scenario} onClose={() => setScenario(false)} titre={t("Scénario de la mission")}>
        <ScenarioSheet />
      </Tiroir>
      <Tiroir ouvert={raccourcis} onClose={() => setRaccourcis(false)} titre={t("Raccourcis clavier")}>
        <RaccourcisSheet />
      </Tiroir>
    </div>
    </FournisseurLangue>
  );
}
