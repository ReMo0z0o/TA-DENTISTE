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
  (« …non conventionnés… ») ; le statut se choisit aussi pour toute la liste, la
  mission fournissant un fichier par statut ;
- écarte les lignes vides et les notes de bas de page : le nombre annoncé est
  celui qui sera vraiment importé.

### 2. Appeler — onglet **Liste**

Chaque fiche montre le nom, la commune, le statut, et un **bouton qui compose le
numéro**. « Encoder » ouvre le formulaire avec province, dentiste, téléphone,
statut, date **et heure** déjà remplis. Un bandeau rouge prévient si un numéro
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

Le bouton **Scénario**, en haut à droite, ouvre à tout moment la phrase
d'ouverture, les réponses aux questions du secrétariat et les scénarios A, B et C.

**Pratique de groupe (scénario C)** : le bouton « Enregistrer et encoder le
dentiste Y » crée une seconde fiche rattachée à la première. À l'export, elle est
placée juste après le dentiste X et surlignée en jaune, comme demandé.

### 4. Suivre — onglet **Suivi**

- **Rappels profil « intervention majorée »** : les cabinets à rappeler le
  lendemain, avec de quoi noter le second appel (date, rendez-vous obtenu).
- **Rendez-vous à annuler** : la date d'annulation est calculée à **4 jours
  ouvrables** après l'appel, avec le compte à rebours et un bouton « le cabinet a
  annulé lui-même » (qui l'écrit dans les remarques).
- **Registre national** : le lien vers « Mon dossier » et la date du dernier
  contrôle hebdomadaire.

### 5. Rendre le fichier Excel — onglet **Données**

Quatre sorties, de la plus directe à la plus souple :

1. **Remplir le fichier de Test-Achats** — charger l'`Antwoordtabel…xlsx`
   d'origine : l'application y ajoute les appels et rend le fichier complété,
   **titres, listes déroulantes et mise en forme intacts**. La première ligne
   libre est détectée et reste modifiable. Les dates sont écrites comme de vraies
   dates Excel, le prix comme un nombre.
2. **Copier pour Excel** — les 23 colonnes séparées par des tabulations, à coller
   dans la première cellule vide de la colonne A.
3. **Classeur `.xlsx` neuf** ou **`.csv`**, si le fichier officiel n'est pas sous
   la main.
4. **Suivi `.csv`** — rappels et annulations, qui ne font pas partie des 23
   colonnes.

### 6. Changer d'appareil

« Sauvegarde `.json` » télécharge tout (liste d'appel, appels, suivi, réglages).
Sur l'autre appareil, le même fichier se charge depuis « Charger une liste
d'appel » : au choix **remplacer** ou **compléter** ce qui s'y trouve déjà. Un
code de reprise à copier-coller fait la même chose si le fichier ne passe pas.

L'appel en cours de saisie est lui aussi enregistré en continu : fermer l'onglet
par erreur ne fait rien perdre.

## Sous le capot

Aucune dépendance à l'exécution : React est empaqueté dans le fichier construit,
et la lecture/écriture des `.xlsx` est faite maison (`src/lib/zip.js` et
`src/lib/xlsx.js`) à partir de `DecompressionStream`/`CompressionStream`, natifs
dans les navigateurs récents. Remplir le fichier officiel consiste à réécrire la
seule feuille de calcul en recopiant toutes les autres pièces du classeur
telles quelles — d'où la conservation des listes déroulantes.

```
src/lib/      zip, xlsx, modèle des 23 colonnes, règles de saisie, import, export
src/screens/  Liste · Appel · Journée · Suivi · Données
src/components/ briques d'interface, panneau d'import, scénario
docs/         l'application construite, en un seul fichier
tests/        tests unitaires + parcours complet dans un navigateur
```

### Commandes

```bash
npm install
npm run dev        # développement
npm run build      # reconstruit docs/index.html (à refaire après toute modification)
npm test           # tests unitaires (Node)
npm run test:e2e   # parcours complet dans Chromium : import, appel, Excel, sauvegarde
```

Les tests utilisent les vrais fichiers de la mission, dans `tests/fixtures/` :
`liste.xlsx` (liste d'appel du Hainaut) et `modele.xlsx` (Antwoordtabel).

### Limites connues

- Le calcul « 4 jours ouvrables » saute les week-ends, pas les jours fériés.
- La lecture des `.xlsx` demande un navigateur récent (Chrome/Edge 103+,
  Safari 16.4+, Firefox 113+) ; le `.csv` et le collage fonctionnent partout.
- Les données vivent dans le navigateur de l'appareil : vider les données du site
  les efface. D'où la sauvegarde `.json` avant tout nettoyage.
