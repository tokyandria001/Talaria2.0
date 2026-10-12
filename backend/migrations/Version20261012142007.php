<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261012142007 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Lieux à grande échelle : catégorie principale indexée, index de position, origine des imports, horaires';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE place ADD primary_tag VARCHAR(30) DEFAULT NULL, ADD source VARCHAR(20) DEFAULT NULL, ADD external_id VARCHAR(64) DEFAULT NULL, ADD opening_hours VARCHAR(255) DEFAULT NULL');
        $this->addSql('CREATE INDEX idx_place_position ON place (latitude, longitude)');
        $this->addSql('CREATE INDEX idx_place_primary_tag ON place (primary_tag)');
        $this->addSql('CREATE UNIQUE INDEX uniq_place_external ON place (source, external_id)');
        // Catégorie principale des lieux existants = premier tag
        $this->addSql("UPDATE place SET primary_tag = JSON_UNQUOTE(JSON_EXTRACT(tags, '$[0]')) WHERE primary_tag IS NULL");
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('DROP INDEX idx_place_position ON place');
        $this->addSql('DROP INDEX idx_place_primary_tag ON place');
        $this->addSql('DROP INDEX uniq_place_external ON place');
        $this->addSql('ALTER TABLE place DROP primary_tag, DROP source, DROP external_id, DROP opening_hours');
    }
}
