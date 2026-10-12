<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261012124151 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Phase 8 étape 3 : voyages de groupe (trip.group_id, notification.trip_id)';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE notification ADD trip_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE notification ADD CONSTRAINT FK_BF5476CAA5BC2E0E FOREIGN KEY (trip_id) REFERENCES trip (id) ON DELETE CASCADE');
        $this->addSql('CREATE INDEX IDX_BF5476CAA5BC2E0E ON notification (trip_id)');
        $this->addSql('ALTER TABLE trip ADD group_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE trip ADD CONSTRAINT FK_7656F53BFE54D947 FOREIGN KEY (group_id) REFERENCES travel_group (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_7656F53BFE54D947 ON trip (group_id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE notification DROP FOREIGN KEY FK_BF5476CAA5BC2E0E');
        $this->addSql('DROP INDEX IDX_BF5476CAA5BC2E0E ON notification');
        $this->addSql('ALTER TABLE notification DROP trip_id');
        $this->addSql('ALTER TABLE trip DROP FOREIGN KEY FK_7656F53BFE54D947');
        $this->addSql('DROP INDEX IDX_7656F53BFE54D947 ON trip');
        $this->addSql('ALTER TABLE trip DROP group_id');
    }
}
