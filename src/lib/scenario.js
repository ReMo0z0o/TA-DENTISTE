// Le scénario de la mission, sous la main pendant l'appel.
// Repris de « definitief_scenario_fr » (Test-Achats).
//
// Les phrases néerlandaises et anglaises sont des traductions de travail : à
// utiliser telles quelles pour un cabinet néerlandophone, mais le fichier de
// réponses, lui, reste en français.

export const LIEN_REGISTRE = {
  fr: "https://www.ibz.rrn.fgov.be/fr/citoyen/registre-national-et-population/registre-national/mon-dossier",
  nl: "https://www.ibz.rrn.fgov.be/nl/rijksregister/mijn-dossier",
  en: "https://www.ibz.rrn.fgov.be/fr/citoyen/registre-national-et-population/registre-national/mon-dossier",
};

const FR = {
  ouverture:
    "J'appelle pour prendre rendez-vous chez le dentiste X pour le contrôle annuel. Est-ce encore possible cette année-ci ?",
  reponses: [
    { q: "Vous êtes déjà patient ici ?", r: "Non, je viens de déménager et je n'ai pas encore de dentiste ici." },
    { q: "Vous avez mal quelque part ?", r: "Non." },
    { q: "Quand avez-vous été chez le dentiste la dernière fois ?", r: "L'année passée, en septembre je pense." },
    { q: "Qui était votre dentiste précédent ?", r: "Le nom de votre dentiste habituel." },
    { q: "Vous avez droit à l'intervention majorée ?", r: "Non. → cocher la case, et rappeler le lendemain avec l'autre profil." },
    { q: "Quel est votre numéro de registre national ?", r: "Le donner. → cocher la case, et rappeler le lendemain avec l'autre profil." },
    { q: "Le rendez-vous peut-il avoir lieu chez un hygiéniste bucco-dentaire ?", r: "Non." },
  ],
  scenarios: [
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
        { dire: "J'ai encore une question sur le prix : le dentiste applique les tarifs officiels ou il demande des suppléments ?", note: "" },
        { dire: "Avec supplément → « Pouvez-vous me dire combien je vais devoir payer, plus ou moins ? »", note: "Puis : « Serait-il aussi possible d'avoir un rendez-vous au tarif officiel, sans supplément ? »" },
        { dire: "Sans supplément → confirmer le rendez-vous et terminer l'appel.", note: "Dans le tableau : rendez-vous sans supplément = oui, même date." },
        { dire: "« Je ne sais pas » → « Vous aurez peut-être une idée du prix que je vais devoir payer ? »", note: "Ensuite : confirmer le rendez-vous et terminer l'appel." },
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
  ],
  consignes: [
    "Commencer par l'adresse citée en premier dans le fichier. Si ce n'est pas un cabinet actif, passer à la suivante.",
    "Ne pas appeler deux fois le même numéro (cabinet de groupe). Si un dentiste est déjà sélectionné, passer au suivant.",
    "Si vous ne vous souvenez plus de quelque chose : laisser le champ vide. Ne pas deviner.",
    "Dentiste à la retraite : il ne compte pas dans le quota, mais l'indiquer quand même dans le tableau.",
    "Scénario C : ajouter le dentiste Y juste après le dentiste X, dans une autre couleur (l'application le fait à l'export).",
    "Rappeler le lendemain, avec le profil « intervention majorée », les cabinets qui ont demandé le registre national ou parlé d'intervention majorée. Voix d'homme.",
    "Annuler les rendez-vous entre 1 et 4 jours ouvrables, mais seulement APRÈS 4 jours ouvrables : on veut voir si le cabinet annule de lui-même.",
    "Si le cabinet annule lui-même : le noter dans le tableau.",
    "Vérifier chaque semaine si un dentiste a consulté votre dossier au registre national (lecteur de carte + code PIN).",
  ],
};

const NL = {
  ouverture:
    "Ik bel om een afspraak te maken bij tandarts X voor de jaarlijkse controle. Kan dat dit jaar nog?",
  reponses: [
    { q: "Bent u hier al patiënt?", r: "Nee, ik ben net verhuisd en heb hier nog geen tandarts." },
    { q: "Hebt u ergens pijn?", r: "Nee." },
    { q: "Wanneer bent u voor het laatst bij de tandarts geweest?", r: "Vorig jaar, in september denk ik." },
    { q: "Wie was uw vorige tandarts?", r: "De naam van uw gewone tandarts." },
    { q: "Hebt u recht op de verhoogde tegemoetkoming?", r: "Nee. → het vakje aanvinken en morgen terugbellen met het andere profiel." },
    { q: "Wat is uw rijksregisternummer?", r: "Geef het. → het vakje aanvinken en morgen terugbellen met het andere profiel." },
    { q: "Mag de afspraak bij een mondhygiënist doorgaan?", r: "Nee." },
  ],
  scenarios: [
    {
      id: "A",
      titre: "Scenario A — geen afspraak mogelijk",
      quand: "Niet dit jaar en ook niet volgend jaar.",
      etapes: [
        { dire: "Mag ik vragen waarom?", note: "Reden: geen nieuwe patiënten · pensioen · andere." },
        { dire: "Kunt u mij een andere tandarts in de buurt aanraden?", note: "Noteer het antwoord: zelfde groepspraktijk of een andere praktijk." },
        { dire: "Het gesprek beëindigen.", note: "" },
      ],
    },
    {
      id: "B",
      titre: "Scenario B — een afspraak is mogelijk",
      quand: "Dit jaar of volgend jaar: noteer de datum en vraag daarna naar de prijs.",
      etapes: [
        { dire: "Ik heb nog een vraag over de prijs: werkt de tandarts aan de officiële tarieven of vraagt hij supplementen?", note: "" },
        { dire: "Met supplement → « Kunt u mij zeggen hoeveel ik ongeveer zal moeten betalen? »", note: "Daarna: « Zou een afspraak aan het officiële tarief, zonder supplement, ook mogelijk zijn? »" },
        { dire: "Zonder supplement → de afspraak bevestigen en het gesprek beëindigen.", note: "In de tabel: afspraak zonder supplement = oui, zelfde datum." },
        { dire: "« Ik weet het niet » → « Hebt u misschien een idee van de prijs die ik zal moeten betalen? »", note: "Daarna: de afspraak bevestigen en het gesprek beëindigen." },
      ],
    },
    {
      id: "C",
      titre: "Scenario C — groepspraktijk",
      quand: "Niets bij tandarts X dit jaar, maar de praktijk stelt tandarts Y voor.",
      etapes: [
        { dire: "Zou ik volgend jaar een afspraak kunnen krijgen bij tandarts X?", note: "Zo ja: noteer de datum en vraag naar officieel tarief of supplementen." },
        { dire: "U zei dat er dit jaar wel een afspraak mogelijk is bij tandarts Y. Wanneer precies?", note: "Noteer de datum." },
        { dire: "Vraagt die tandarts een supplement of werkt hij aan de officiële tarieven?", note: "Bij supplement: « Hoeveel zal mijn controle ongeveer kosten? »" },
        { dire: "Maak de afspraak bij tandarts Y en beëindig het gesprek.", note: "Codeer TWEE fiches: tandarts X, en tandarts Y er meteen achter." },
      ],
    },
  ],
  consignes: [
    "Begin met het eerste adres in het bestand. Is dat geen actieve praktijk, ga dan naar het volgende.",
    "Bel nooit twee keer hetzelfde nummer (groepspraktijk). Is een tandarts al geselecteerd, ga dan naar de volgende.",
    "Weet u iets niet meer? Laat het veld leeg. Niet gokken.",
    "Tandarts met pensioen: telt niet mee voor het quotum, maar noteer het toch in de tabel.",
    "Scenario C: zet tandarts Y meteen na tandarts X, in een andere kleur (de app doet dat bij de export).",
    "Bel de dag nadien terug, met het profiel « verhoogde tegemoetkoming », naar de praktijken die om het rijksregisternummer vroegen of over de verhoogde tegemoetkoming begonnen. Mannenstem.",
    "Annuleer de afspraken tussen 1 en 4 werkdagen, maar pas NA 4 werkdagen: we willen zien of de praktijk zelf annuleert.",
    "Annuleert de praktijk zelf? Noteer het in de tabel.",
    "Controleer elke week of een tandarts uw dossier in het rijksregister heeft geraadpleegd (kaartlezer + pincode).",
  ],
};

const EN = {
  ouverture:
    "I'm calling to make an appointment with dentist X for the annual check-up. Is that still possible this year?",
  reponses: [
    { q: "Are you already a patient here?", r: "No, I've just moved and I don't have a dentist here yet." },
    { q: "Are you in any pain?", r: "No." },
    { q: "When did you last see a dentist?", r: "Last year, in September I think." },
    { q: "Who was your previous dentist?", r: "The name of your usual dentist." },
    { q: "Are you entitled to the increased reimbursement?", r: "No. → tick the box, and call back the next day with the other profile." },
    { q: "What is your national register number?", r: "Give it. → tick the box, and call back the next day with the other profile." },
    { q: "Could the appointment be with a dental hygienist?", r: "No." },
  ],
  scenarios: [
    {
      id: "A",
      titre: "Scenario A — no appointment possible",
      quand: "Neither this year nor next year.",
      etapes: [
        { dire: "May I ask why?", note: "Reason: no new patients · retirement · other." },
        { dire: "Could you recommend another dentist nearby?", note: "Note the answer: same group practice, or another practice." },
        { dire: "End the call.", note: "" },
      ],
    },
    {
      id: "B",
      titre: "Scenario B — an appointment is possible",
      quand: "This year or next year: note the date, then ask about the price.",
      etapes: [
        { dire: "One more question about the price: does the dentist charge official rates or extra fees?", note: "" },
        { dire: "With extra fees → “Could you tell me roughly how much I'll have to pay?”", note: "Then: “Would an appointment at the official rate, without extra fees, also be possible?”" },
        { dire: "Without extra fees → confirm the appointment and end the call.", note: "In the table: appointment without extra fees = oui, same date." },
        { dire: "“I don't know” → “Would you have any idea of the price I'll have to pay?”", note: "Then: confirm the appointment and end the call." },
      ],
    },
    {
      id: "C",
      titre: "Scenario C — group practice",
      quand: "Nothing with dentist X this year, but the practice offers dentist Y.",
      etapes: [
        { dire: "Could I get an appointment with dentist X next year?", note: "If yes: note the date, then ask about official rate or extra fees." },
        { dire: "You said an appointment with dentist Y was possible this year. When exactly?", note: "Note the date." },
        { dire: "Does that dentist charge extra fees or work at the official rates?", note: "If extra fees: “Roughly how much will my check-up cost?”" },
        { dire: "Book the appointment with dentist Y and end the call.", note: "Encode TWO records: dentist X, then dentist Y right after." },
      ],
    },
  ],
  consignes: [
    "Start with the first address listed in the file. If it isn't an active practice, move to the next one.",
    "Never call the same number twice (group practice). If a dentist is already selected, move on to the next.",
    "Can't remember something? Leave the field empty. Don't guess.",
    "Retired dentist: doesn't count towards the quota, but record it in the table anyway.",
    "Scenario C: put dentist Y right after dentist X, in a different colour (the app does this on export).",
    "Call back the next day, with the “increased reimbursement” profile, every practice that asked for the national register number or raised the increased reimbursement. Male voice.",
    "Cancel appointments between 1 and 4 working days, but only AFTER 4 working days: we want to see whether the practice cancels by itself.",
    "If the practice cancels by itself: record it in the table.",
    "Check every week whether a dentist has consulted your national register file (card reader + PIN).",
  ],
};

const PAR_LANGUE = { fr: FR, nl: NL, en: EN };

/** Le scénario dans la langue demandée (français par défaut). */
export function scenario(langue) {
  return PAR_LANGUE[langue] || FR;
}

export function lienRegistre(langue) {
  return LIEN_REGISTRE[langue] || LIEN_REGISTRE.fr;
}
