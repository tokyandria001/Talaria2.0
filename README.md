# Talaria

> **Voyager mieux, moins cher, ensemble.**

Talaria est une travel super-app en cours de développement — un espace tout-en-un pour planifier ses voyages, explorer des lieux sur une carte interactive, et rejoindre une communauté de voyageurs qui partagent leurs récits et conseils.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Backend | Symfony 7.2 (PHP 8.3) |
| App mobile | Expo (React Native), dossier `mobile/` |
| Site web | app.talaria.world : dépôt séparé `talaria-webapp` (hébergé sur Vercel) |
| Base de données | MySQL / MariaDB 10.4 (XAMPP) |
| Auth | JWT via LexikJWTAuthenticationBundle (clés RSA) |
| ORM | Doctrine |
| Styles | CSS custom (design system Talaria) |

---

## Architecture

```
Talaria2.0/
├── backend/          # API REST Symfony
│   ├── src/
│   │   ├── Controller/   # AuthController, ProfileController, ArticleController, PlaceController
│   │   └── Entity/       # User, Article, ArticleLike, Comment, Place
│   └── migrations/
├── mobile/           # App mobile Expo (React Native)
└── deploy/           # Script de déploiement du VPS (deploy.sh)
```

Le site web `app.talaria.world` vit dans son propre dépôt (`talaria-webapp`) et appelle la même API (`https://api.talaria.world`). L'ancienne web-app React de ce dépôt a été retirée ; elle reste disponible dans l'historique git.

La base de données s'appelle `tar`, utilisateur `root` sans mot de passe, port 3306.

---

## Phases de développement

### Phase 1 — Auth & Profil ✅

Fondations de l'application : inscription, connexion, gestion du profil.

**Backend**
- `POST /api/auth/register` — inscription
- `POST /api/auth/login` — connexion (retourne un JWT)
- `GET /api/auth/me` — utilisateur courant
- `GET|PUT /api/profile` — lecture et mise à jour du profil
- `POST /api/profile/picture` — upload de photo de profil
- `PUT /api/profile/password` — changement de mot de passe

**Profil utilisateur** : email, prénom, nom, username, photo, budget moyen, tags d'activité, style de voyage, rythme de voyage, transport favori, centres d'intérêt.

**Frontend**
- Pages : `/login`, `/register`, `/dashboard` (protégé), `/profile` (protégé)
- Routes protégées via `ProtectedRoute`

---

### Phase 2 — Communauté & Carte ✅

Espace communautaire avec articles de voyage, et carte interactive des lieux.

**Backend — Articles**
- `GET /api/articles` — liste des articles (filtres : catégorie, recherche)
- `POST /api/articles` — créer un article (auth requise)
- `GET /api/articles/{id}` — détail + commentaires
- `PUT /api/articles/{id}` — modifier (auteur uniquement)
- `DELETE /api/articles/{id}` — supprimer (auteur uniquement)
- `POST /api/articles/{id}/like` — liker / unliker
- `POST /api/articles/{id}/comments` — ajouter un commentaire
- `DELETE /api/articles/{articleId}/comments/{commentId}` — supprimer un commentaire
- `POST /api/articles/upload-cover` — upload image de couverture (JPEG/PNG/WebP/GIF, max 5 Mo)

**Entités** : `Article` (titre, contenu, extrait, catégorie, image, compteurs likes/commentaires), `ArticleLike`, `Comment`.

**Catégories disponibles** : Itinéraires, Aventures, Éco-Tourisme, Logements, Conseils.

**Frontend — CommunityPage**
- Mise en page 3 colonnes
- Sidebar gauche : filtres (tout, populaire, mes articles), navigation par catégorie
- Feed principal : barre de recherche, article à la une, grille d'articles avec like/commentaire
- Sidebar droite : top destinations, tags populaires, bouton "Écrire"
- Modals : `WriteArticleModal` (créer / éditer), `ArticleDetailModal` (lire + commenter)

**Frontend — MapPage**
- Carte interactive (en cours)
- `AddPlaceModal` pour ajouter un lieu

---

## Lancer le projet en local

### Prérequis
- PHP 8.3+, Composer
- Node.js 20+, npm (app mobile)
- XAMPP (MySQL/MariaDB sur le port 3306)

### Backend

```bash
cd backend
composer install
# Créer la base de données "tar" dans phpMyAdmin, puis :
php bin/console doctrine:migrations:migrate
symfony serve
# → http://localhost:8000
```

Les clés JWT RSA se trouvent dans `backend/config/jwt/`. Si elles sont absentes :

```bash
php bin/console lexik:jwt:generate-keypair
```

### App mobile

```bash
cd mobile
npm install
npx expo start
```

---

## Design system

| Nom | Couleur |
|---|---|
| Parme | `#4f203f` |
| Sable-lune | `#fcf9f1` |
| Sable-doré | `#f0dacb` |
| Orchidée | `#c9b2d7` |

Police principale : **Bricolage Grotesque**.

---

## Roadmap

- [ ] Phase 3 — Voyages : planification d'itinéraires, partage entre amis
- [ ] Phase 4 — Deals & Alertes de prix
- [ ] Phase 5 — Social : following, feed personnalisé
