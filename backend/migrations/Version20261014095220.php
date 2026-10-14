<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261014095220 extends AbstractMigration
{
    public function getDescription(): string
    {
        return "Onboarding : âge, ville de départ, gares et aéroports, styles de voyageur, budget week-end, compagnons, envies";
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE `user` ADD birth_year INT DEFAULT NULL, ADD home_city VARCHAR(120) DEFAULT NULL, ADD home_latitude DOUBLE PRECISION DEFAULT NULL, ADD home_longitude DOUBLE PRECISION DEFAULT NULL, ADD home_hubs JSON DEFAULT NULL, ADD traveler_types JSON DEFAULT NULL, ADD weekend_budget INT DEFAULT NULL, ADD companions VARCHAR(20) DEFAULT NULL, ADD wishlist JSON DEFAULT NULL, ADD onboarded_at DATETIME DEFAULT NULL');
        // Comptes existants déjà renseignés : pas d'onboarding à refaire
        $this->addSql('UPDATE `user` SET onboarded_at = created_at WHERE first_name IS NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE `user` DROP birth_year, DROP home_city, DROP home_latitude, DROP home_longitude, DROP home_hubs, DROP traveler_types, DROP weekend_budget, DROP companions, DROP wishlist, DROP onboarded_at');
    }
}
