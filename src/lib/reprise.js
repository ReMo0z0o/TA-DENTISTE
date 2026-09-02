// Lecture d'un code de reprise collé à la main.
//
// Le fichier .json passe toujours ; le copier-coller, lui, traverse souvent un
// messager, une note ou une fenêtre de discussion, et en ressort abîmé :
// espaces insécables à la place des espaces, guillemets typographiques,
// clôtures de bloc de code, phrase d'accompagnement, texte tronqué. Chacun de
// ces accidents fait échouer JSON.parse alors que les données, elles, sont
// intactes. On répare donc ce qui est réparable, et on dit clairement ce qui
// ne l'est pas.

/**
 * Les messages rendus par la lecture. Ils sont traduits au moment de
 * l'affichage : les recenser ici évite qu'une langue les oublie.
 */
export const MESSAGES_REPRISE = {
  vide: "Rien à charger.",
  incomplet: "Ce code de reprise est incomplet : il en manque la fin ({n} caractères reçus). Copie-le en entier avec le bouton « Copier le code », ou passe par le fichier .json.",
  pasUnCode: "Ce texte n'est pas un code de reprise : il doit commencer par une accolade « { ».",
  illisible: "Ce code de reprise est illisible ({n} caractères reçus) : recopie-le avec le bouton « Copier le code », ou passe par le fichier .json.",
};

/** Espaces exotiques qu'un traitement de texte glisse à la place d'un espace. */
const ESPACES = /[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g;
/** Caractères invisibles ajoutés par certaines applications. */
const INVISIBLES = /[\u200b-\u200d\u2060\ufeff]/g;

/**
 * Applique une réparation aux seuls caractères situés HORS des chaînes JSON :
 * un numéro de téléphone « 069 64 14 60 » écrit avec un espace insécable doit
 * rester tel quel, seule la ponctuation du fichier est normalisée.
 */
function horsChaines(texte, repare) {
  let sortie = "";
  let dansChaine = false;
  let echappe = false;
  let morceau = "";
  for (const c of texte) {
    if (dansChaine) {
      sortie += c;
      if (echappe) echappe = false;
      else if (c === "\\") echappe = true;
      else if (c === '"') dansChaine = false;
      continue;
    }
    if (c === '"') {
      sortie += repare(morceau) + c;
      morceau = "";
      dansChaine = true;
      continue;
    }
    morceau += c;
  }
  return sortie + repare(morceau);
}

/** Guillemets typographiques → guillemets droits, hors chaînes. */
function redresseGuillemets(texte) {
  // le redressement se fait sur le texte entier : des guillemets courbes
  // remplacent justement les guillemets droits qui délimitent les chaînes
  return texte.replace(/[“”„″]/g, '"').replace(/[‘’]/g, "'");
}

/** Retire une clôture de bloc de code (```json … ```) et le bavardage autour. */
function retireHabillage(texte) {
  let brut = texte.replace(/^\ufeff/, "").trim();
  const bloc = brut.match(/```[a-z]*\s*([\s\S]*?)```/i);
  if (bloc) brut = bloc[1].trim();
  else brut = brut.replace(/```[a-z]*/gi, "").trim();
  // une phrase d'accompagnement avant l'accolade : on garde le fichier
  const debut = brut.search(/[[{]/);
  if (debut > 0) brut = brut.slice(debut);
  return brut.trim();
}

/**
 * Découpe le premier objet (ou tableau) complet, accolades comptées.
 * Renvoie null s'il ne se referme jamais : c'est le signe d'un texte coupé en
 * route, et c'est cette information-là qui manquait à l'utilisateur.
 */
function extraitObjet(texte) {
  if (texte[0] !== "{" && texte[0] !== "[") return null;
  let profondeur = 0;
  let dansChaine = false;
  let echappe = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (dansChaine) {
      if (echappe) echappe = false;
      else if (c === "\\") echappe = true;
      else if (c === '"') dansChaine = false;
      continue;
    }
    if (c === '"') dansChaine = true;
    else if (c === "{" || c === "[") profondeur++;
    else if (c === "}" || c === "]") {
      profondeur--;
      if (profondeur === 0) return texte.slice(0, i + 1);
      if (profondeur < 0) return null;
    }
  }
  return null;
}

/**
 * Lit un code de reprise.
 * @returns {{data: any}} si la lecture aboutit,
 *          sinon {{erreur: string, valeurs: object}} : un message prêt à
 *          traduire et les valeurs à y injecter.
 */
export function lisCodeDeReprise(texte) {
  const brut = String(texte ?? "").replace(/^\ufeff/, "").trim();
  if (!brut) return { erreur: MESSAGES_REPRISE.vide, valeurs: {} };

  const nu = retireHabillage(brut);
  const objet = extraitObjet(nu);
  const repare = (t) => horsChaines(t, (m) => m.replace(ESPACES, " ")).replace(INVISIBLES, "");
  const redresse = repare(redresseGuillemets(nu));

  const tentatives = [brut, nu, objet, repare(objet || nu), redresse, extraitObjet(redresse)];
  for (const essai of tentatives) {
    if (!essai || !/^[[{]/.test(essai)) continue;
    try {
      return { data: JSON.parse(essai) };
    } catch {
      /* on tente la réparation suivante */
    }
  }

  // Rien n'a marché : dire pourquoi, c'est ce qui permet de recommencer juste.
  if (!/^[[{]/.test(nu)) {
    return {
      erreur: MESSAGES_REPRISE.pasUnCode,
      valeurs: {},
    };
  }
  if (!objet && !extraitObjet(redresse)) {
    return {
      erreur: MESSAGES_REPRISE.incomplet,
      valeurs: { n: nu.length },
    };
  }
  return {
    erreur: MESSAGES_REPRISE.illisible,
    valeurs: { n: nu.length },
  };
}

/** Un texte collé ressemble-t-il à un code de reprise plutôt qu'à un tableau ? */
export function ressembleAUnCode(texte) {
  const brut = retireHabillage(String(texte ?? ""));
  return brut.startsWith("{") || brut.startsWith("[");
}
