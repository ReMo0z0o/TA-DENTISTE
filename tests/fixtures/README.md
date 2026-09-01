# Fichiers de test

`liste-exemple.xlsx` et `modele-exemple.xlsx` reproduisent exactement la forme
des fichiers de la mission (mêmes en-têtes, mêmes lignes de titre, mêmes listes
déroulantes) avec des praticiens inventés. Ils sont versionnés : les tests
tournent partout, sans donnée réelle dans le dépôt.

Pour tester sur les vrais fichiers, les déposer ici sous ces noms :

- `liste.xlsx` — une liste d'appel de province (`Dentistes_Hainaut_liste_appels.xlsx`)
- `modele.xlsx` — le tableau de réponses (`Antwoordtabel_MysteryShoppingFrans.xlsx`)

Ils sont ignorés par git (voir `.gitignore`) et prennent automatiquement le pas
sur les fichiers d'exemple.

Régénérer les exemples : `node tests/fixtures/generer.mjs`
