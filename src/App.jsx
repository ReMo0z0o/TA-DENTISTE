import { useEffect, useMemo, useRef, useState } from "react";
import { Tiroir } from "./components/ui.jsx";
import ScenarioSheet from "./components/ScenarioSheet.jsx";
import AppelScreen from "./screens/AppelScreen.jsx";
import ListeScreen from "./screens/ListeScreen.jsx";
import JourneeScreen from "./screens/JourneeScreen.jsx";
import SuiviScreen from "./screens/SuiviScreen.jsx";
import DonneesScreen from "./screens/DonneesScreen.jsx";
import { besoinRappel, emptyCall, phoneKey, rdvPris } from "./lib/model.js";
import { applique, majAnnulation } from "./lib/regles.js";
import { charge, enregistre, etatVide, nouvelId } from "./lib/storage.js";
import { nowTime, today } from "./lib/dates.js";

const ONGLETS = [
  ["liste", "Liste"],
  ["appel", "Appel"],
  ["journee", "Journée"],
  ["suivi", "Suivi"],
  ["donnees", "Données"],
];

export default function App() {
  const [etat, setEtat] = useState(null);
  const [call, setCall] = useState(() => emptyCall());
  const [editing, setEditing] = useState(null);
  const [onglet, setOnglet] = useState("liste");
  const [message, setMessage] = useState("");
  const [scenario, setScenario] = useState(false);
  const [alerte, setAlerte] = useState("");
  const minuteur = useRef(null);

  useEffect(() => {
    const charge0 = charge();
    setEtat(charge0);
    if (charge0.brouillon) setCall({ ...emptyCall(), ...charge0.brouillon });
    if (charge0.prospects.length === 0 && charge0.calls.length === 0) setOnglet("donnees");
  }, []);

  // sauvegarde différée : rien ne se perd si l'onglet se ferme
  useEffect(() => {
    if (!etat) return;
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => {
      const brouillon = call.dentiste || call.telephone || call.rdvPossible ? call : null;
      const erreur = enregistre({ ...etat, brouillon });
      setAlerte(erreur || "");
    }, 400);
    return () => clearTimeout(minuteur.current);
  }, [etat, call]);

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

  if (!etat) return <div className="p-6 text-sm text-slate-500">Chargement…</div>;

  const ouvreAppel = (fiche) => {
    const existant = etat.calls.find((c) => c.prospectId === fiche.id);
    if (existant) {
      setCall({ ...emptyCall(), ...existant });
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
        })
      );
      setEditing(null);
    }
    setOnglet("appel");
    window.scrollTo({ top: 0 });
  };

  const prochaineFiche = (saufId) =>
    etat.prospects.find((p) => p.etat === "a_appeler" && p.id !== saufId) || null;

  /** Enregistre l'appel en cours et renvoie l'appel enregistré. */
  const enregistreAppel = () => {
    if (!call.dentiste.trim()) {
      flash("Indique au moins le nom du dentiste avant d'enregistrer.");
      return null;
    }
    const complet = majAnnulation({
      ...call,
      id: editing || call.id || nouvelId(),
      createdAt: call.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const existe = etat.calls.some((c) => c.id === complet.id);
    majEtat((e) => ({
      calls: existe ? e.calls.map((c) => (c.id === complet.id ? complet : c)) : [...e.calls, complet],
      prospects: e.prospects.map((p) => (p.id === complet.prospectId ? { ...p, etat: "fait" } : p)),
      reglages: { ...e.reglages, province: complet.province || e.reglages.province, statut: complet.statut || e.reglages.statut },
    }));
    return complet;
  };

  const enregistreEtSuivant = () => {
    const complet = enregistreAppel();
    if (!complet) return;
    const suivante = prochaineFiche(complet.prospectId);
    setEditing(null);
    if (suivante) {
      ouvreAppel(suivante);
      flash(`Appel enregistré. Au suivant : ${suivante.nom}.`);
    } else {
      setCall(
        emptyCall({
          province: complet.province,
          statut: complet.statut,
          dateAppel: today(),
          heureAppel: nowTime(),
        })
      );
      flash("Appel enregistré.");
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
    flash("Encode maintenant le dentiste Y proposé par le cabinet.");
  };

  const editeAppel = (c) => {
    setCall({ ...emptyCall(), ...c });
    setEditing(c.id);
    setOnglet("appel");
    window.scrollTo({ top: 0 });
  };

  const majAppel = (id, patch) =>
    majEtat((e) => ({ calls: e.calls.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c)) }));

  const supprimeAppel = (id) => {
    if (!window.confirm("Supprimer définitivement cet appel ?")) return;
    majEtat((e) => ({ calls: e.calls.filter((c) => c.id !== id && c.groupeDe !== id) }));
    if (editing === id) {
      setEditing(null);
      setCall(emptyCall());
    }
    flash("Appel supprimé.");
  };

  const ajouteProspects = (fiches) => {
    majEtat((e) => {
      const connus = new Set(e.prospects.map((p) => `${p.nom}|${phoneKey(p.telephone)}`));
      const nouveaux = fiches.filter((f) => !connus.has(`${f.nom}|${phoneKey(f.telephone)}`));
      return { prospects: [...e.prospects, ...nouveaux] };
    });
    flash(`${fiches.length} praticiens lus. Ouvre l'onglet « Liste » : il n'y a plus qu'à appeler.`);
    setOnglet("liste");
  };

  const ajouteCalls = (appels) => {
    majEtat((e) => ({ calls: [...e.calls, ...appels] }));
    flash(`${appels.length} appels importés.`);
    setOnglet("journee");
  };

  const chargeSauvegarde = (data) => {
    const prospects = Array.isArray(data?.prospects) ? data.prospects : [];
    const calls = Array.isArray(data?.calls) ? data.calls : Array.isArray(data) ? data : [];
    if (!prospects.length && !calls.length) {
      flash("Cette sauvegarde ne contient ni liste d'appel ni appel.");
      return;
    }
    const remplacer = window.confirm(
      `Sauvegarde : ${prospects.length} praticiens et ${calls.length} appels.\n\n` +
        "OK = remplacer ce qu'il y a sur cet appareil\nAnnuler = compléter sans rien effacer"
    );
    majEtat((e) => {
      if (remplacer) {
        return {
          prospects,
          calls: calls.map((c) => ({ ...emptyCall(), ...c })),
          reglages: { ...e.reglages, ...(data.reglages || {}) },
          suivi: { ...e.suivi, ...(data.suivi || {}) },
        };
      }
      const idsCalls = new Set(e.calls.map((c) => c.id));
      const clesProspects = new Set(e.prospects.map((p) => `${p.nom}|${phoneKey(p.telephone)}`));
      return {
        prospects: [...e.prospects, ...prospects.filter((p) => !clesProspects.has(`${p.nom}|${phoneKey(p.telephone)}`))],
        calls: [...e.calls, ...calls.filter((c) => !idsCalls.has(c.id)).map((c) => ({ ...emptyCall(), ...c }))],
      };
    });
    flash(remplacer ? "Sauvegarde chargée." : "Sauvegarde ajoutée à ce qui existait déjà.");
  };

  const enAttente = etat.calls.filter((c) => besoinRappel(c) && !c.rappelFait).length;
  const aAnnuler = etat.calls.filter((c) => rdvPris(c) && !c.annulation?.faiteLe).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-2xl px-4 pt-4 pb-[76px]">
        <header className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[17px] leading-tight font-semibold text-teal-900">Appels dentistes</h1>
            <p className="text-[12px] text-slate-500">
              {etat.calls.length} appel{etat.calls.length > 1 ? "s" : ""} encodé{etat.calls.length > 1 ? "s" : ""}
              {etat.prospects.length ? ` · ${etat.prospects.filter((p) => p.etat === "a_appeler").length} à appeler` : ""}
            </p>
          </div>
          <button
            onClick={() => setScenario(true)}
            className="min-h-[40px] rounded-lg border border-teal-800 px-3 py-2 text-[13px] font-medium text-teal-800"
          >
            Scénario
          </button>
        </header>

        {alerte && (
          <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
            {alerte}
          </div>
        )}
        {message && <div className="mb-3 rounded-lg bg-teal-800 px-3 py-2 text-[13px] text-white">{message}</div>}

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
            onVider={() => {
              if (window.confirm("Vider la liste d'appel ? Les appels déjà encodés sont conservés.")) {
                majEtat({ prospects: [] });
                flash("Liste d'appel vidée.");
              }
            }}
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
            majAppel={majAppel}
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
              if (window.confirm("Vider les appels encodés ? À faire seulement après avoir rempli le fichier Excel.")) {
                majEtat({ calls: [] });
                setCall(emptyCall());
                setEditing(null);
                flash("Appels vidés.");
              }
            }}
            onToutEffacer={() => {
              if (window.confirm("Tout effacer : liste d'appel, appels et suivi. Cette action est définitive.")) {
                setEtat(etatVide());
                setCall(emptyCall());
                setEditing(null);
                flash("Application remise à zéro.");
              }
            }}
          />
        )}
      </div>

      <nav
        className="fixed right-0 bottom-0 left-0 z-40 border-t border-slate-200 bg-white"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-2xl">
          {ONGLETS.map(([cle, libelle]) => {
            const badge = cle === "suivi" ? enAttente + aAnnuler : 0;
            return (
              <button
                key={cle}
                onClick={() => setOnglet(cle)}
                className={
                  "relative flex-1 py-3 text-[12px] font-medium " +
                  (onglet === cle ? "text-teal-800" : "text-slate-500")
                }
              >
                {onglet === cle && <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-teal-800" />}
                {libelle}
                {badge > 0 && (
                  <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] text-white">{badge}</span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <Tiroir ouvert={scenario} onClose={() => setScenario(false)} titre="Scénario de la mission">
        <ScenarioSheet />
      </Tiroir>
    </div>
  );
}
