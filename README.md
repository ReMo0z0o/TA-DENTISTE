# Appels dentistes — saisie pour le mystery shopping Test-Achats

Application de saisie d'appels pour la mission « contrôle annuel chez le dentiste » :
charger la liste des praticiens à appeler, encoder chaque appel en quelques
touches, suivre les rappels et les annulations, puis reverser le tout dans le
fichier Excel officiel.

Tout tient dans **un seul fichier HTML**. Rien n'est envoyé sur un serveur : les
données restent dans le navigateur de l'appareil, et passent d'un appareil à
l'autre par un fichier de sauvegarde `.json`.

## Ouvrir l'application

Trois façons, au choix :

| Situation | Marche à suivre |
| --- | --- |
| Au bureau, tout de suite | Ouvrir `docs/index.html` (double-clic). Fonctionne hors ligne. |
| Sur le téléphone | Héberger `docs/` (voir plus bas), ouvrir l'adresse, puis « Ajouter à l'écran d'accueil ». |
| Pour développer | `npm install` puis `npm run dev`. |

### Deux mises en page pour un même outil

L'application change de forme selon la largeur de l'écran ; les données et les
règles sont exactement les mêmes.

**Au bureau (à partir de 1024 px)** — la mise en page est prévue pour la souris
et le clavier :

- barre latérale permanente : navigation, avancement, scénario, raccourcis ;
- la liste d'appel devient un **tableau** : nom, commune, statut, téléphone,
  état modifiable sur place, dernier appel — tout se lit d'un coup d'œil ;
- la journée devient elle aussi un tableau, dans l'ordre des colonnes du fichier
  Excel : heure, résultat, date du rendez-vous, tarif, prix, remarques ;
- le formulaire d'appel s'accompagne d'une colonne de droite (à partir de
  1280 px) : la phrase d'ouverture, les réponses aux questions du secrétariat et
  la file des praticiens suivants, toujours visibles pendant l'appel ;
- suivi et données s'affichent sur deux colonnes ;
- les fichiers se **glissent-déposent** depuis l'explorateur ;
- le bouton d'enregistrement reste collé en bas du formulaire ;
- les numéros se copient d'un clic (pour un softphone ou un téléphone à côté).

**Sur téléphone** — barre d'onglets en bas, cartes tactiles, cibles de 44 px,
bouton d'appel qui compose directement le numéro.

### Langue de l'interface

Français, néerlandais, anglais — au choix dans la barre latérale (au bureau) ou
dans l'en-tête (sur téléphone). Tout suit : navigation, formulaire, tableaux,
messages, dates en toutes lettres, et le **scénario complet**, phrases à dire au
téléphone comprises — utile pour un cabinet néerlandophone.

**Ce qui ne change jamais : les données.** Les réponses sont enregistrées et
exportées dans les termes exacts qu'attend le fichier de Test-Achats
(« conventionné », « oui », « avec supplément »…), quelle que soit la langue
affichée. Choisir le néerlandais fait afficher « ja », mais c'est bien « oui »
qui part dans la colonne — sinon les listes déroulantes du fichier officiel ne
reconnaîtraient plus rien. Un test vérifie cette règle à chaque exécution.

Le choix est mémorisé sur l'appareil. Au premier lancement, l'application suit la
langue du navigateur si elle en connaît une. Les listes d'appel sont aussi
reconnues avec des intitulés néerlandais ou anglais (`Naam`, `Telefoon`,
`Postcode`, `Practitioner`, `Phone`…).

### Raccourcis clavier

| Touches | Effet |
| --- | --- |
| `Alt` + `1` … `5` | Liste · Appel · Journée · Suivi · Données |
| `Ctrl` + `Entrée` (ou `Ctrl` + `S`) | Enregistrer l'appel et passer au praticien suivant |
| `/` | Aller à la recherche |
| `←` `→` | Choisir une réponse dans le groupe sélectionné |
| `Espace` | Valider la réponse sélectionnée |
| `Entrée` | Ouvrir la fiche du praticien sélectionné dans le tableau |
| `?` | Liste des raccourcis |
| `Échap` | Fermer la fenêtre ouverte |

Sur Mac, `Ctrl` devient `⌘`.

### Mettre l'application en ligne (pour le téléphone)

Dans le dépôt GitHub : **Settings → Pages → Source : Deploy from a branch**,
branche `claude/mystery-shopping-call-app-v20o22`, dossier `/docs`. L'adresse
obtenue s'ouvre sur n'importe quel téléphone. Une fois la page visitée, elle
reste utilisable sans réseau (service worker).

## Le déroulé d'une journée d'appels

### 1. Charger la liste des praticiens — onglet **Données**

Déposer le fichier de la province (`Dentistes_Hainaut_liste_appels.xlsx` par
exemple), un `.csv`, ou coller des lignes copiées depuis Excel. L'application :

- retrouve la ligne d'en-tête même si le fichier commence par un titre ;
- reconnaît les colonnes (nom, téléphone, INAMI, adresse, commune, code postal,
  sites web) et affiche la correspondance, corrigeable colonne par colonne ;
- **déduit la province du code postal** (7608 → Hainaut) ;
- devine la province et le statut Inami depuis le nom du fichier
  (« …non conventionnés… ») ;
- laisse **choisir le statut Inami de toute la liste** — conventionné,
  partiellement conventionné, non conventionné — en un clic, la mission
  fournissant un fichier par statut. C'est une colonne obligatoire du fichier de
  réponses : tant qu'aucun statut n'est choisi, l'écran le signale, car il
  faudrait sinon le reprendre sur chacun des appels. Les praticiens dont le
  fichier précise déjà le statut gardent le leur ;
- écarte les lignes vides et les notes de bas de page : le nombre annoncé est
  celui qui sera vraiment importé.

### 2. Appeler — onglet **Liste**

Chaque praticien montre son nom, sa commune, son statut et son numéro — en
tableau au bureau, en cartes sur téléphone, avec un bouton qui compose le numéro.
**« Ajouter un praticien »**, en bas de la liste, ouvre un formulaire d'appel
vierge pour un dentiste qui n'est dans aucun fichier. Il rejoint la liste dès
l'appel enregistré, marqué « ajouté à la main ». Comme le dentiste Y du
scénario C, il s'ajoute au travail sans gonfler le quota : le compte
« X / 25 appelés » reste celui du fichier reçu de Test-Achats, et la barre
latérale annonce les ajouts à part. Si un appel est en cours de saisie,
l'application demande confirmation avant de le remplacer par une fiche vierge.

Deux façons de récupérer des lignes du fichier de réponses sans quitter la
liste :

- sur une fiche déjà encodée, un **bouton copier** (deux feuillets, au bout de
  la ligne) reprend les 24 colonnes de ce seul appel. Sur téléphone, il est dans
  le menu « ⋯ » de la carte, avec son libellé ;
- sous les filtres, **« Copier les N lignes affichées »** reprend toute la
  sélection en cours — « Tous », « À appeler », « Fait », « Injoignable »,
  « dentiste Y »… — recherche comprise. Les praticiens qu'on n'a pas encore
  appelés y figurent aussi : leur ligne porte la province, le nom, le statut et
  le téléphone, le reste étant à compléter dans Excel. Aucune date n'est
  inventée pour un appel qui n'a pas eu lieu.

Une fois une fiche ouverte, une barre **« ‹ précédent · 3 / 25 · suivant › »**
permet de les **feuilleter une par une**, sans rien enregistrer : les voisins
sont nommés, et `Alt` + `←` / `→` fait la même chose au clavier. Le parcours est
celui que la liste affichait au moment du clic — **filtre et recherche
compris** : partir de « À rappeler » ne fait défiler que ceux-là. Si un appel
est commencé mais pas enregistré, l'application demande confirmation avant de
passer à la fiche suivante.

« Encoder » ouvre le formulaire avec province, dentiste, téléphone, statut, date
**et heure** déjà remplis. Un bandeau rouge prévient si un numéro
apparaît deux fois : le scénario interdit d'appeler deux fois le même cabinet.

Le bouton « Appeler le suivant » enchaîne les fiches non encore appelées, et une
barre de progression indique où on en est (`12 / 25 appelés`).

### 3. Encoder — onglet **Appel**

Le formulaire suit le scénario et n'affiche que les questions qui s'appliquent
(la case « afficher toutes les colonnes » lève ce filtre). Il déduit ce qui peut
l'être :

- premier rendez-vous **sans supplément** → « rendez-vous possible sans
  supplément = oui », même date, même cabinet (c'est la consigne écrite dans
  l'en-tête du fichier Excel) ;
- changement de la date du premier rendez-vous → la date sans supplément suit,
  tant qu'elle n'a pas été modifiée à la main ;
- passage de « rendez-vous possible » à « non » → la branche devenue sans objet
  est vidée, pour ne jamais exporter deux réponses contradictoires ;
- question sur l'intervention majorée ou le registre national → la fiche part
  automatiquement dans les rappels du lendemain.

**Suite à donner** — en bas de la fiche, un choix décide de ce qu'il advient du
praticien : **Fait** (par défaut), **À rappeler**, **Injoignable** ou **Écarté**.
Le bouton d'enregistrement enchaîne sur le praticien suivant dans tous les cas :
plus besoin de repasser par la liste pour corriger un statut.

Un cabinet qui ne décroche pas ne produit **aucune ligne** dans le fichier Excel :
si rien n'a été encodé et que la suite n'est pas « Fait », seule la fiche est
marquée dans la liste. L'application le dit à l'écran avant d'enregistrer. Si
tu as déjà obtenu des réponses partielles, elles sont conservées et la ligne
part quand même — utile pour « à rappeler » après un premier contact.

Le bouton **Scénario** — barre latérale au bureau, en haut à droite sur
téléphone — ouvre à tout moment la phrase d'ouverture, les réponses aux questions
du secrétariat et les scénarios A, B et C. Au bureau, ces réponses restent
affichées en permanence à côté du formulaire.

**Pratique de groupe (scénario C)** : le bouton « Enregistrer et encoder le
dentiste Y » crée une seconde fiche rattachée à la première. Dès que tu réponds
« oui » à une question d'orientation, l'application te le rappelle à l'écran.

Le dentiste Y **rejoint la liste d'appel** une fois encodé, juste sous le
dentiste qui l'a proposé, et se repère au premier coup d'œil : fond ambre,
étiquette **dentiste Y**, mention « proposé par … », et un filtre dédié dans la
barre de filtres. Il hérite de l'adresse et de la commune du cabinet.

Deux précautions : il **ne compte pas dans le quota** de la mission (la barre
d'avancement reste sur les praticiens du fichier reçu, avec un « + n dentiste Y
ajouté » à part), et il n'est **pas signalé comme doublon** alors qu'il partage
le numéro de sa pratique de groupe. À l'export, il reste placé juste après le
dentiste X et surligné en jaune, comme demandé.

### 4. Suivre — onglet **Suivi**

L'onglet suit l'ordre du travail : d'abord les rappels ordinaires, puis ceux du
scénario, puis les annulations.

- **Rappels — profil habituel** : les praticiens marqués « À rappeler » dans la
  liste, ceux qui n'ont pas décroché ou qui ont demandé qu'on rappelle plus
  tard. Rien ne change au scénario : c'est le même appel à refaire. Chaque fiche
  donne la date du dernier essai, la commune, le numéro à composer et un bouton
  qui rouvre directement le formulaire d'appel.
- **Rappels profil « intervention majorée »** : les cabinets à rappeler le
  lendemain, avec de quoi noter le second appel (date, rendez-vous obtenu). Si
  un rendez-vous y est déjà placé, la fiche le rappelle.
- **Rendez-vous à annuler** : **tous** les rendez-vous placés depuis le début de
  la mission, à annuler comme déjà annulés (ces derniers grisés en fin de liste,
  avec un lien pour rouvrir en cas de fausse manœuvre). C'est la liste la plus
  longue de l'onglet : elle prend toute la largeur, en **tableau** au bureau et
  en cartes sur téléphone. Chaque ligne porte la **date de l'appel**, la **date
  du rendez-vous** et le **numéro de téléphone**, et celles dont le cabinet est
  aussi à rappeler avec l'autre profil portent la pastille « à rappeler —
  intervention majorée » : au moment d'annuler, on sait qu'un second appel
  attend.
  **« Classer par »** range la liste à l'urgence d'annulation (par défaut), par
  **date de rendez-vous** — pour traiter d'abord ceux qui approchent — ou par
  dentiste ; dans tous les cas ce qui reste à annuler passe devant. **« Masquer
  ceux déjà annulés »** raccourcit la liste une fois le travail avancé.
  Deux pastilles, à ne pas confondre : celle du rendez-vous dit dans combien de
  jours il tombe (rouge à l'approche : passé cette date, trop tard pour
  annuler), celle de l'annulation dit depuis quand elle est **possible** — une
  date dépassée n'y est pas un retard. La date d'annulation est calculée à
  **4 jours ouvrables** après l'appel, avec un bouton « le cabinet a
  annulé lui-même » (qui l'écrit dans les remarques). Un bouton
  **« Télécharger les rendez-vous (.xlsx) »** sort tous les rendez-vous placés
  depuis le début de la mission, dans un classeur fait pour être lu :
  trié du plus urgent à annuler au plus lointain, ce qui est déjà annulé
  renvoyé en fin de liste et grisé, ce qui est à annuler aujourd'hui surligné,
  titres figés et filtres actifs, vraies dates et prix numérique. Colonnes :
  date d'annulation, où en est l'annulation, dentiste, téléphone, rappel
  « intervention majorée », rendez-vous pris, tarif, prix, commune, province,
  date et heure de l'appel, remarques.
  Le rendez-vous repris est bien **celui qu'on a pris** : si le premier était
  avec supplément et qu'un rendez-vous au tarif officiel était possible, c'est
  ce dernier qui compte, comme le veut le scénario B.
- **Registre national** : le lien vers « Mon dossier » et la date du dernier
  contrôle hebdomadaire.

### 5. Rendre le fichier Excel — onglet **Données**

> **Colonne « Statut » (W).** Le fichier de Test-Achats en compte 23, remarques
> comprises. La mission demande d'y ajouter une **24e colonne « Statut » en W**,
> juste avant « Remarques » qui passe en **X**. L'application l'écrit toute
> seule, à partir de la suite donnée au praticien dans la liste d'appel, et
> **toujours en anglais** — `To call`, `Done`, `To call back`, `Unreachable`,
> `Excluded` — quelle que soit la langue de l'application, comme les autres
> valeurs du fichier de réponses. Elle part dans les trois chemins : le
> remplissage du fichier officiel, « Copier pour Excel » et les copies de
> l'onglet Liste. Charger un fichier qui n'a pas encore cette colonne affiche un
> avertissement, car les statuts s'écriraient sinon par-dessus les remarques.


Quatre sorties, de la plus directe à la plus souple :

1. **Remplir le fichier de Test-Achats** — charger l'`Antwoordtabel…xlsx`
   d'origine : l'application y ajoute les appels et rend le fichier complété,
   **titres, listes déroulantes et mise en forme intacts**. La première ligne
   libre est détectée et reste modifiable. Les dates sont écrites comme de vraies
   dates Excel, le prix comme un nombre.
2. **Copier pour Excel** — les 24 colonnes séparées par des tabulations, à coller
   dans la première cellule vide de la colonne A.
3. **Classeur `.xlsx` neuf** ou **`.csv`**, si le fichier officiel n'est pas sous
   la main.
4. **Suivi `.csv`** — rappels et annulations, qui ne font pas partie des 23
   colonnes. Pour les seules annulations, le classeur `.xlsx` de l'onglet Suivi
   est plus lisible.

Ces fichiers de travail personnels suivent la langue de l'application ; seul le
fichier de réponses de Test-Achats reste en français.

### 6. Changer d'appareil

Le bloc « Changer d'appareil » de l'onglet Données porte les deux bouts du
trajet : **1. Emporter le travail** sur l'appareil qu'on quitte, **2. Reprendre
le travail ici** sur celui où l'on arrive.

« Télécharger le fichier `.json` » emporte **tout** ce que l'application sait :

- la liste d'appel avec l'état de chaque praticien (à appeler, fait, injoignable…) ;
- les appels encodés, colonnes du fichier Excel, heure et remarques comprises ;
- **le suivi** : rappels avec le profil « intervention majorée » (date, rendez-vous
  obtenu), dates d'annulation calculées et annulations faites, contrôles
  hebdomadaires du registre national ;
- le lien dentiste X / dentiste Y du scénario C, et les réglages de travail.

Sur l'autre appareil, le même fichier se charge depuis « Charger une liste
d'appel » : au choix **remplacer** ou **compléter** ce qui s'y trouve déjà. En
mode « compléter », rien n'est effacé et les deux suivis fusionnent sans
doublon ; recharger deux fois la même sauvegarde ne duplique rien. Une
sauvegarde d'une version antérieure de l'application repart complète : les
champs ajoutés depuis reprennent leur valeur par défaut. Seule la langue
d'affichage reste propre à chaque appareil.

Quand le fichier ne passe pas — une messagerie, un appareil qui n'accepte pas
les téléchargements — le **code de reprise** fait la même chose : « Copier le
code » le met dans le presse-papier d'un seul geste (avec le nombre de
caractères pour vérifier des deux côtés), et il se recolle dans la zone du
point 2. Il tient sur une seule ligne, sans indentation, pour ne pas se faire
recouper en chemin. Un code qui a traversé un messager arrive souvent abîmé :
espaces insécables à la place des espaces, guillemets typographiques, clôtures
de bloc de code, phrase d'accompagnement. Tout cela est réparé à la lecture,
sans jamais retoucher les données elles-mêmes — un espace insécable *à
l'intérieur* d'un numéro de téléphone est conservé tel quel. S'il manque
vraiment la fin, l'application le dit et annonce le nombre de caractères reçus,
plutôt que de charger un travail incomplet.

L'appel en cours de saisie est lui aussi enregistré en continu, et la sauvegarde
en attente est écrite immédiatement si l'onglet se ferme ou passe en
arrière-plan : fermer l'onglet par erreur ne fait rien perdre.

## Sous le capot

Aucune dépendance à l'exécution : React est empaqueté dans le fichier construit,
et la lecture/écriture des `.xlsx` est faite maison (`src/lib/zip.js` et
`src/lib/xlsx.js`) à partir de `DecompressionStream`/`CompressionStream`, natifs
dans les navigateurs récents. Remplir le fichier officiel consiste à réécrire la
seule feuille de calcul en recopiant toutes les autres pièces du classeur
telles quelles — d'où la conservation des listes déroulantes.

```
src/lib/      zip, xlsx, modèle des 24 colonnes, règles de saisie, import, export,
              lecture des codes de reprise, i18n + traductions (fr / nl / en),
              scénario dans les trois langues
src/screens/  Liste · Appel · Journée · Suivi · Données
src/components/ briques d'interface, panneau d'import, scénario, raccourcis
docs/         l'application construite, en un seul fichier
tests/        tests unitaires + parcours navigateur (e2e.mjs téléphone, e2e-bureau.mjs
              bureau, e2e-sauvegarde.mjs changement d'appareil)
```

### Commandes

```bash
npm install
npm run dev        # développement
npm run build      # reconstruit docs/index.html (à refaire après toute modification)
npm test           # tests unitaires (Node)
npm run test:e2e   # trois parcours dans Chromium : téléphone, bureau, changement d'appareil
```

Côté traduction, les tests refusent toute clé sans traduction, toute traduction
devenue inutile, toute variable `{n}` perdue en route — et vérifient qu'un export
reste français en néerlandais comme en anglais.

Les tests utilisent les vrais fichiers de la mission, dans `tests/fixtures/` :
`liste.xlsx` (liste d'appel du Hainaut) et `modele.xlsx` (Antwoordtabel).

### Limites connues

- Le calcul « 4 jours ouvrables » saute les week-ends, pas les jours fériés.
- L'export vise le fichier de réponses **français**. Pour un Antwoordtabel
  néerlandais, il faudrait ajouter la correspondance des valeurs (une table à
  écrire, le fichier néerlandais sous la main).
- La lecture des `.xlsx` demande un navigateur récent (Chrome/Edge 103+,
  Safari 16.4+, Firefox 113+) ; le `.csv` et le collage fonctionnent partout.
- Les données vivent dans le navigateur de l'appareil : vider les données du site
  les efface. D'où la sauvegarde `.json` avant tout nettoyage.
