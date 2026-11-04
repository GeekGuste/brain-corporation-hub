# Prompts pour générer les images manquantes

Trois images manquent. Les prompts ci-dessous sont écrits **en anglais** : tous
les générateurs comprennent mieux l'anglais, y compris quand on leur parle en
français le reste du temps.

Après génération, déposez les fichiers bruts dans `assets/visuels-pages/` et
dites-le moi : je recadre au rapport d'affichage, je réduis à la résolution
utile, je compresse et je câble. Ne vous occupez ni du format ni du poids.

---

## Le style à tenir

Les huit photos déjà en place ont un registre commun : photographie réelle,
lumière naturelle, tons froids et désaturés, composition dégagée, ambiance
institutionnelle et calme. Une image générée qui ne s'y accroche pas se verra
immédiatement.

**Préambule à coller devant chaque prompt :**

```
Editorial documentary photograph, natural window light, cool neutral palette of
grey-blue and soft teal, muted and desaturated colours, shallow depth of field,
50mm lens, realistic texture, uncluttered composition with generous negative
space, calm and institutional mood, contemporary European office setting.
```

**Ce qu'il faut interdire** (champ « negative prompt », ou à la fin du prompt
pour les outils qui n'en ont pas) :

```
text, letters, words, numbers, signage, logos, official seals, national emblems,
coats of arms, identity documents, watermark, illustration, 3d render, cartoon,
oversaturated, lens flare, people smiling at the camera, high five, thumbs up,
stock photo cliché
```

Trois interdits comptent plus que les autres :

- **Pas de texte.** Les générateurs écrivent du charabia, et sur ce site le
  moindre faux document administratif serait un problème.
- **Pas d'emblème officiel** : Marianne, armoiries, sceaux, en-têtes de
  préfecture. C'est juridiquement risqué et les générateurs les déforment.
- **Pas de titre de séjour ni de carte d'identité**, même flou.

---

## 1. « Pourquoi investir dans la prévention »

Rapport **4/3**, au moins 1400 px de large.

La section parle du coût d'une perte de séjour non anticipée, sans donner un
seul chiffre. L'image doit donc dire **l'anticipation**, pas la catastrophe, et
surtout ne pas suggérer un montant.

### Proposition A, recommandée : le bureau de celui qui prend les devants

```
A tidy wooden desk beside a window in soft morning light. Several plain paper
folders stacked neatly, an open notebook with a pen resting on it, a wall
calendar blurred in the background. No people. Orderly, deliberate, unhurried.
```

### Proposition B : les mains qui classent

```
Close-up of two hands calmly sorting printed documents into plain folders on a
desk, the person's face outside the frame, soft daylight from the left, muted
grey-blue tones.
```

### Proposition C : le rendez-vous pris à temps

```
A person seated alone at a desk in a quiet office, seen from the side, looking
at a wall calendar and writing a note. Soft daylight, cool tones, no text
visible anywhere.
```

**Ce qu'il faut éviter ici** : la tête dans les mains, le visage inquiet, la
pile de factures, la calculatrice. La section parle de prévention, pas de
détresse, et le cahier des charges interdit d'amplifier le registre.

---

## 2. « Les formateurs Lignes Rouges »

Rapport **4/3**, au moins 1400 px de large.

**La contrainte principale de tout le lot.** Les formateurs sont des avocats :
des professionnels réglementés. Une image de groupe sous ce titre se lira comme
le portrait des avocats de la méthode, alors qu'elle montrerait des personnes
qui n'existent pas. Le cahier des charges interdit d'inventer un nom d'avocat ;
un visage, c'est pareil.

**Générez donc une image sans visage identifiable.** Les trois propositions
respectent cette règle.

### Proposition A, recommandée : le cabinet, sans personne

```
A lawyer's office in late afternoon light. A wall of bound legal volumes, the
spines softly out of focus so that no lettering is legible. A plain wooden desk
in the foreground, a reading lamp, a closed notebook. A black French barrister's
robe with a white collar band hangs on a wooden stand in the background. No
people, no readable text.
```

### Proposition B : de dos, au travail

```
Over-the-shoulder view of a professional in a dark suit seated at a desk,
reading a printed document, photographed from behind so the face is never
visible. Shelves of legal books blurred in the background, soft daylight, cool
muted tones.
```

### Proposition C : la préparation d'une séance

```
A quiet meeting room prepared for a small session: a long table, six empty
chairs, a closed notebook and a glass of water at each place, a blank flipchart
at the far end. Natural light through tall windows. No people, no writing on the
flipchart.
```

La C a un avantage : elle ne montre personne du tout, donc elle ne prétend rien.
C'est la plus sûre des trois si le sujet vous inquiète.

---

## 3. L'image de partage sur les réseaux sociaux

Rapport **1,91/1**, exactement **1200 × 630 px**. C'est l'image qui s'affiche
quand un lien du site est collé sur Facebook, LinkedIn, WhatsApp ou X. Le
trafic viendra beaucoup de là.

**Ne la générez probablement pas.** Une bonne image de partage porte le logo et
une phrase courte, et les générateurs écrivent du texte illisible. Deux voies
plus sûres :

1. **Recadrer une photo déjà en place.** `lr-bandeau.jpg` fonctionne : je la
   recadre en 1200 × 630 et j'y pose le logo proprement. Zéro coût, disponible
   tout de suite.
2. **La faire composer par la graphiste**, avec le logo et la charte. C'est la
   bonne version définitive.

Si vous tenez à en générer une, demandez un **fond** et rien d'autre, j'y
poserai le logo et le titre ensuite :

```
Wide horizontal photograph of a calm, empty modern meeting room with tall
windows, soft daylight, cool grey-blue and teal tones, strong negative space on
the left half of the frame for text overlay. No people, no text, no logos.
```

Le « negative space on the left half » n'est pas un détail : sans lui, le logo
et le titre tomberont sur un élément chargé et deviendront illisibles.

---

## Réglages selon l'outil

| Outil | Rapport | Remarque |
|---|---|---|
| Midjourney | `--ar 4:3` ou `--ar 1200:630` | ajouter `--style raw` pour éviter l'effet illustration |
| DALL·E (ChatGPT) | demander « format 4:3 » en toutes lettres | pas de champ negative prompt : mettre les interdits à la fin du prompt |
| Flux | champ dédié | très bon sur les mains, utile pour la proposition B du 1 |
| Firefly (Adobe) | menu déroulant | licence commerciale explicite, c'est son intérêt |

Visez **au moins 1400 px de large**, plus si l'outil le permet. Je réduis
ensuite ; l'inverse n'est pas possible.

---

## Avant de publier une image générée

- **Vérifiez la licence commerciale** de l'outil. Elle est claire chez Adobe
  Firefly et chez Midjourney en offre payante ; elle l'est moins ailleurs.
- **Regardez les mains et les visages de près.** C'est là que les générateurs
  échouent, et un doigt en trop se remarque sur une page qui vend du sérieux.
- **Vérifiez qu'aucun texte n'est apparu** dans l'image, même petit, même flou.
- **Aucune personne générée ne doit être présentée comme un formateur, un
  stagiaire ou un témoin.** Les textes alternatifs décrivent une scène, jamais
  une identité. C'est la règle qui vaut déjà pour les photos de banque.
