# Le Dossard

Carnet d’entraînement au trail et à la course en montagne. On choisit un objectif (jusqu’au marathon et à 2 000 m de dénivelé) et un rythme ; l’appli découpe le chemin en étapes, propose les séances semaine après semaine et remet une médaille à chaque étape franchie. Les sorties se notent à la main, après coup : kilomètres, dénivelé, ressenti.

Créé par Valérian Tripet.

## Ce que contient ce dossier

| Élément | Rôle |
|---|---|
| `index.html` | L’appli entière, en un seul fichier |
| `manifest.webmanifest` | Nom, couleurs et icônes pour l’installation sur l’écran d’accueil |
| `sw.js` | Fonctionnement hors connexion |
| `icones/` | L’icône de l’appli, aux tailles demandées par les téléphones |
| `polices/` | Les polices Barlow et Barlow Condensed, avec leur licence |
| `sources/` | Le code avant assemblage, et le script qui reconstruit `index.html` |
| `.nojekyll` | Demande à GitHub de publier les fichiers tels quels (facultatif) |

Le site ne fait appel à aucun autre serveur : tout ce dont l’appli a besoin est dans ce dossier.

## Mettre en ligne avec GitHub Pages

1. **Créer le dépôt.** Sur github.com, bouton « New ». Nom conseillé : `le-dossard`. Visibilité : « Public » (avec un compte gratuit, GitHub Pages ne publie que les dépôts publics).
2. **Déposer les fichiers.** Dans le dépôt, « Add file » puis « Upload files » (sur un dépôt encore vide : le lien « uploading an existing file »). Glisser dans la page **le contenu** de ce dossier, et non le dossier lui-même : `index.html` doit se retrouver à la racine du dépôt. Valider avec « Commit changes ».
3. **Activer la publication.** « Settings », puis « Pages » dans la colonne de gauche. Sous « Build and deployment », choisir « Deploy from a branch », la branche `main`, le dossier `/ (root)`, puis « Save ».
4. **Ouvrir le site.** Après quelques minutes, l’adresse apparaît en haut de cette même page, sous la forme `https://identifiant.github.io/le-dossard/`.

Le fichier `.nojekyll` est invisible sur certains ordinateurs et peut manquer au dépôt : le site fonctionne aussi sans lui.

Pour essayer avant de publier, un double-clic sur `index.html` ouvre l’appli dans le navigateur (sans le mode hors connexion, réservé au site en ligne).

## Installer l’appli sur le téléphone

- **iPhone (Safari)** : ouvrir l’adresse du site, toucher « Partager » (rangé dans le menu « ··· » sur les versions récentes), puis « Sur l’écran d’accueil » et « Ajouter ».
- **Android (Chrome)** : ouvrir l’adresse du site, menu « ⋮ », puis « Ajouter à l’écran d’accueil » ou « Installer l’application ».

L’appli s’ouvre alors en plein écran, comme une appli ordinaire. Après une première ouverture avec du réseau, elle s’ouvre aussi sans connexion.

## Où sont les données

Le carnet est enregistré dans le navigateur de l’appareil, et nulle part ailleurs : rien n’est envoyé à GitHub ni à un autre serveur.

- Chaque appareil, et chaque navigateur, a donc son propre carnet. Il n’y a pas de synchronisation.
- Effacer les données de navigation du site efface le carnet ; supprimer l’appli de l’écran d’accueil peut l’effacer aussi.
- Sur iPhone, l’appli de l’écran d’accueil a son propre espace, séparé de Safari : mieux vaut l’installer d’abord et créer son programme ensuite.

**Sauvegarder ou changer d’appareil.** Dans l’appli, ouvrir les réglages (icône en haut à droite de l’écran Objectif), puis « Copier mes données ». Coller ce texte dans une note ou un message pour le garder. Pour reprendre un carnet commencé ailleurs (autre appareil, autre navigateur, version ouverte dans Claude), le coller dans « Restaurer une copie ».

Une copie de temps en temps met le carnet à l’abri.

## Mettre à jour l’appli

Déposer le nouveau `index.html` dans le dépôt (« Add file », « Upload files », même nom de fichier) : GitHub republie le site en quelques minutes. À l’ouverture suivante avec du réseau, l’appli prend la nouvelle version. Le carnet n’est pas touché.

## Modifier l’appli

Le dossier `sources/` contient le code avant assemblage :

- `gabarit.html` : la structure de la page ;
- `style.css` : les couleurs et la mise en page ;
- `logique.js` : les programmes, les médailles et les calculs ;
- `icones.js` : les dessins des médailles ;
- `interface.js` : les écrans.

Après une modification, `python3 sources/construire.py` réassemble `index.html`.

## Crédits

Conception : Valérian Tripet.

Polices Barlow et Barlow Condensed, © The Barlow Project Authors, sous SIL Open Font License 1.1 (texte dans `polices/OFL.txt`).
