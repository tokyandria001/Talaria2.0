<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261012132120 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Assistant voyage + journal de groupe (trip: activités souhaitées, billet, partage ; accommodation.address ; group_activity)';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE group_activity (id INT AUTO_INCREMENT NOT NULL, type VARCHAR(20) NOT NULL, message VARCHAR(255) NOT NULL, created_at DATETIME NOT NULL, group_id INT NOT NULL, actor_id INT DEFAULT NULL, trip_id INT DEFAULT NULL, INDEX IDX_A5444525FE54D947 (group_id), INDEX IDX_A544452510DAF24A (actor_id), INDEX IDX_A5444525A5BC2E0E (trip_id), INDEX IDX_A5444525FE54D9478B8E8428 (group_id, created_at), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE group_activity ADD CONSTRAINT FK_A5444525FE54D947 FOREIGN KEY (group_id) REFERENCES travel_group (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE group_activity ADD CONSTRAINT FK_A544452510DAF24A FOREIGN KEY (actor_id) REFERENCES `user` (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE group_activity ADD CONSTRAINT FK_A5444525A5BC2E0E FOREIGN KEY (trip_id) REFERENCES trip (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE accommodation ADD address VARCHAR(255) DEFAULT NULL');
        $this->addSql('ALTER TABLE trip ADD wished_activities JSON DEFAULT \'[]\' NOT NULL, ADD transport_price_per_person INT DEFAULT NULL, ADD each_books_own_transport TINYINT DEFAULT 0 NOT NULL, ADD split_costs_equally TINYINT DEFAULT 1 NOT NULL');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE group_activity DROP FOREIGN KEY FK_A5444525FE54D947');
        $this->addSql('ALTER TABLE group_activity DROP FOREIGN KEY FK_A544452510DAF24A');
        $this->addSql('ALTER TABLE group_activity DROP FOREIGN KEY FK_A5444525A5BC2E0E');
        $this->addSql('DROP TABLE group_activity');
        $this->addSql('ALTER TABLE accommodation DROP address');
        $this->addSql('ALTER TABLE trip DROP wished_activities, DROP transport_price_per_person, DROP each_books_own_transport, DROP split_costs_equally');
    }
}
