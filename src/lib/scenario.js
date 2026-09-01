// Le scénario de la mission, sous la main pendant l'appel.
// Repris de « definitief_scenario_fr » (Test-Achats).

export const PHRASE_OUVERTURE =
  "J'appelle pour prendre rendez-vous chez le dentiste X pour le contrôle annuel. Est-ce encore possible cette année-ci ?";

export const REPONSES_TYPES = [
  { q: "Vous êtes déjà patient ici ?", r: "Non, je viens de déménager et je n'ai pas encore de dentiste ici." },
  { q: "Vous avez mal quelque part ?", r: "Non." },
  { q: "Quand avez-vous été chez le dentiste la dernière fois ?", r: "L'année passée, en septembre je pense." },
  { q: "Qui était votre dentiste précédent ?", r: "Le nom de votre dentiste habituel." },
  { q: "Vous avez droit à l'intervention majorée ?", r: "Non. → cocher la case, et rappeler le lendemain avec l'autre profil." },
  { q: "Quel est votre numéro de registre national ?", r: "Le donner. → cocher la case, et rappeler le lendemain avec l'autre profil." },
  { q: "Le rendez-vous peut-il avoir lieu chez un hygiéniste bucco-dentaire ?", r: "Non." },
];

export const SCENARIOS = [
  {
    id: "A",
    titre: "Scénario A — pas de rendez-vous possible",
    quand: "Ni cette année, ni l'année prochaine.",
    etapes: [
      { dire: "Puis-je vous demander pourquoi ?", note: "Raison : plus de nouveaux patients · retraite · autres." },
      { dire: "Vous pouvez me conseiller un autre dentiste à proximité ?", note: "Noter la réponse : même pratique de groupe, ou autre cabinet." },
      { dire: "Terminer l'appel.", note: "" },
    ],
  },
  {
    id: "B",
    titre: "Scénario B — un rendez-vous est possible",
    quand: "Cette année ou l'année prochaine : noter la date, puis parler du prix.",
    etapes: [
      {
        dire: "J'ai encore une question sur le prix : le dentiste applique les tarifs officiels ou il demande des suppléments ?",
        note: "",
      },
      {
        dire: "Avec supplément → « Pouvez-vous me dire combien je vais devoir payer, plus ou moins ? »",
        note: "Puis : « Serait-il aussi possible d'avoir un rendez-vous au tarif officiel, sans supplément ? »",
      },
      {
        dire: "Sans supplément → confirmer le rendez-vous et terminer l'appel.",
        note: "Dans le tableau : rendez-vous sans supplément = oui, même date.",
      },
      {
        dire: "« Je ne sais pas » → « Vous aurez peut-être une idée du prix que je vais devoir payer ? »",
        note: "Ensuite : confirmer le rendez-vous et terminer l'appel.",
      },
    ],
  },
  {
    id: "C",
    titre: "Scénario C — pratique de groupe",
    quand: "Rien chez le dentiste X cette année, mais le cabinet propose le dentiste Y.",
    etapes: [
      { dire: "Est-ce que je pourrais avoir un rendez-vous chez le dentiste X l'année prochaine ?", note: "Si oui : noter la date, puis demander tarif officiel ou suppléments." },
      { dire: "Vous aviez dit qu'un rendez-vous était possible chez le dentiste Y cette année-ci. Quand exactement ?", note: "Noter la date." },
      { dire: "Ce dentiste demande un supplément ou il travaille aux tarifs officiels ?", note: "Si supplément : « Combien me coûtera mon contrôle, plus ou moins ? »" },
      { dire: "Prendre le rendez-vous chez le dentiste Y et terminer l'appel.", note: "Encoder DEUX fiches : le dentiste X, puis le dentiste Y juste après." },
    ],
  },
];

export const CONSIGNES = [
  "Commencer par l'adresse citée en premier dans le fichier. Si ce n'est pas un cabinet actif, passer à la suivante.",
  "Ne pas appeler deux fois le même numéro (cabinet de groupe). Si un dentiste est déjà sélectionné, passer au suivant.",
  "Si vous ne vous souvenez plus de quelque chose : laisser le champ vide. Ne pas deviner.",
  "Dentiste à la retraite : il ne compte pas dans le quota, mais l'indiquer quand même dans le tableau.",
  "Scénario C : ajouter le dentiste Y juste après le dentiste X, dans une autre couleur (l'application le fait à l'export).",
  "Rappeler le lendemain, avec le profil « intervention majorée », les cabinets qui ont demandé le registre national ou parlé d'intervention majorée. Voix d'homme.",
  "Annuler les rendez-vous entre 1 et 4 jours ouvrables, mais seulement APRÈS 4 jours ouvrables : on veut voir si le cabinet annule de lui-même.",
  "Si le cabinet annule lui-même : le noter dans le tableau.",
  "Vérifier chaque semaine si un dentiste a consulté votre dossier au registre national (lecteur de carte + code PIN).",
];

export const LIEN_REGISTRE =
  "https://www.ibz.rrn.fgov.be/fr/citoyen/registre-national-et-population/registre-national/mon-dossier";
