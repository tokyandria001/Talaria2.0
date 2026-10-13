<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261013170902 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Position et pays de la destination des voyages';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE trip ADD destination_latitude DOUBLE PRECISION DEFAULT NULL, ADD destination_longitude DOUBLE PRECISION DEFAULT NULL, ADD destination_country VARCHAR(100) DEFAULT NULL, ADD destination_country_code VARCHAR(2) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE trip DROP destination_latitude, DROP destination_longitude, DROP destination_country, DROP destination_country_code');
    }
}
