# Images provisoires

Les douze fichiers de ce dossier sont des **illustrations de remplissage**. Ce
ne sont pas les images définitives du site : elles tiennent la place, au bon
rapport largeur / hauteur, en attendant les photographies du client.

Elles sont volontairement rangées dans un dossier dont le nom le dit, parce
qu'elles ne portent plus d'étiquette à l'écran : c'est ici que l'on vérifie, au
moment de la mise en production, qu'il ne reste plus rien à remplacer.

## Remplacer une image

1. Déposer le fichier définitif dans `frontend/public/` (par exemple
   `frontend/public/visuels/lignes-rouges-bandeau.jpg`).
2. Dans le fichier de contenu de la page (`frontend/src/content/fr/*.json`),
   modifier les quatre champs de l'emplacement :

```json
"visuel": {
  "fichier": "/visuels/lignes-rouges-bandeau.jpg",
  "largeur": 1200,
  "hauteur": 900,
  "texteAlternatif": "Ce que montre l’image, pour les lecteurs d’écran.",
  "motif": "seuil"
}
```

Rien à modifier dans le code. `motif` reste renseigné : c'est le dessin de
repli, affiché si `fichier` repasse à `null`.

**Garder le même rapport largeur / hauteur**, sinon l'image sera recadrée :
l'emplacement a une hauteur réservée pour que la page ne sursaute pas au
chargement.

## Les douze emplacements

| Fichier provisoire | Page et section | Rapport | Taille conseillée |
|---|---|---|---|
| `accueil-bandeau.svg` | Accueil, bandeau de tête | 16 / 9 | 1200 × 675 |
| `accueil-prevenir.svg` | Accueil, « Former pour prévenir » | 4 / 3 | 1200 × 900 |
| `bch-bandeau.svg` | Brain Corporation Hub, bandeau | 4 / 3 | 1200 × 900 |
| `bch-creuset.svg` | BCH, « Un creuset de talents » | 4 / 3 | 1200 × 900 |
| `bch-cycle.svg` | BCH, « Une exigence pédagogique constante » | 4 / 3 | 1200 × 900 |
| `bch-ambition.svg` | BCH, « Notre ambition » | 4 / 3 | 1200 × 900 |
| `lr-bandeau.svg` | Lignes Rouges, bandeau | 4 / 3 | 1200 × 900 |
| `lr-echeances.svg` | LR, « Pourquoi cette formation existe » | 4 / 3 | 1200 × 900 |
| `lr-tableau-de-bord.svg` | LR, « Le tableau de bord de sécurisation » | 4 / 3 | 1200 × 900 |
| `lr-methode.svg` | LR, « Une formation structurée » | 4 / 3 | 1200 × 900 |
| `lr-cout.svg` | LR, « Pourquoi investir dans la prévention » | 4 / 3 | 1200 × 900 |
| `lr-formateurs.svg` | LR, « Les formateurs lignes rouges » | 4 / 3 | 1200 × 900 |

Les tailles conseillées valent le double de la place occupée à l'écran, pour
rester nettes sur un écran à haute densité. Formats acceptés : `.jpg` pour une
photographie, `.webp` si disponible (plus léger), `.svg` pour un dessin.

## Précaution sur les photographies de personnes

Ce site traite de situations administratives d'étrangers. Une photographie de
personne identifiable placée à côté d'un texte comme « titulaire d'un titre de
séjour étudiant » laisse entendre que cette personne est une stagiaire, ce
qu'une photo de banque d'images n'est pas.

- Images de lieux, de documents, de bureaux, de bâtiments, de mains : sans
  difficulté.
- Portraits présentés comme ceux des avocats-formateurs : uniquement de vraies
  photographies, avec leur accord écrit.
- Visages présentés comme ceux de stagiaires : à éviter, même avec une licence
  valable.

## D'où viennent ces fichiers

Ils ont été générés par un script, à partir d'une palette alignée sur celle du
thème provisoire. Leurs couleurs sont écrites **dans les fichiers** et non dans
`frontend/src/styles/_theme.scss` : une image chargée par `<img>` ne peut pas
lire les variables CSS de la page, exactement comme une photographie ne le
pourrait pas. Ces couleurs disparaîtront avec ces fichiers, et la règle « une
seule source pour les couleurs » (CLAUDE.md §14) continue de valoir pour tout
le reste du projet.
