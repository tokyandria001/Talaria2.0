#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Mise à jour de la production (VPS) — à lancer en root sur le serveur :
#     bash /var/www/talaria/app/deploy/deploy.sh
#
# Étapes : sauvegarde de la base → git pull → dépendances → configuration
#          → migrations → cache → rechargement PHP → vérification de l'API.
# Le script s'arrête à la première erreur.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR=/var/www/talaria/app
BACKEND="$APP_DIR/backend"
APP_USER=talaria
BACKUP_DIR=/root/backups
API_URL=https://api.talaria.world/api/price-defaults

as_app() { runuser -u "$APP_USER" -- "$@"; }
step()   { printf '\n\033[1;35m▶ %s\033[0m\n' "$1"; }

if [ "$(id -u)" -ne 0 ]; then
    echo "À lancer en root : bash $0" >&2
    exit 1
fi

step "1/7 Sauvegarde de la base de données"
mkdir -p "$BACKUP_DIR" && chmod 700 "$BACKUP_DIR"
BACKUP="$BACKUP_DIR/talaria-$(date +%Y%m%d-%H%M%S).sql.gz"
mysqldump --single-transaction --routines talaria | gzip > "$BACKUP"
echo "Sauvegarde : $BACKUP ($(du -h "$BACKUP" | cut -f1))"
# On garde les 14 sauvegardes les plus récentes
ls -1t "$BACKUP_DIR"/talaria-*.sql.gz | tail -n +15 | xargs -r rm --

step "2/7 Récupération du code (git pull)"
cd "$APP_DIR"
BEFORE=$(as_app git rev-parse --short HEAD)
as_app git pull --ff-only
AFTER=$(as_app git rev-parse --short HEAD)
echo "Version : $BEFORE → $AFTER"

cd "$BACKEND"

step "3/7 Dépendances PHP (composer install)"
as_app composer install --no-dev --optimize-autoloader --no-interaction

step "4/7 Configuration de production (.env.local.php)"
as_app composer dump-env prod
chown "$APP_USER":www-data .env.local.php && chmod 640 .env.local.php

step "5/7 Migrations de la base"
as_app php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration

step "6/7 Cache Symfony et rechargement de PHP"
as_app php bin/console cache:clear
systemctl reload php8.2-fpm

step "7/7 Vérification de l'API"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$API_URL")
if [ "$CODE" = "401" ]; then
    echo "API OK (401 attendu sans connexion)"
else
    echo "⚠ L'API a répondu $CODE au lieu de 401 — voir /var/log/nginx/talaria-api.error.log et $BACKEND/var/log/" >&2
    echo "  Pour restaurer la base si besoin : gunzip -c $BACKUP | mysql talaria" >&2
    exit 1
fi

printf '\n\033[1;32m✔ Déploiement terminé : %s\033[0m\n' "$AFTER"
