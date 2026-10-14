<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261014081311 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Logistique des voyages : réglages par voyageur, avis et réservation des hébergements, trajets de chacun';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE accommodation_reaction (id INT AUTO_INCREMENT NOT NULL, liked TINYINT NOT NULL, accommodation_id INT NOT NULL, user_id INT NOT NULL, INDEX IDX_F9F328818F3692CD (accommodation_id), INDEX IDX_F9F32881A76ED395 (user_id), UNIQUE INDEX uniq_accommodation_reaction (accommodation_id, user_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE transport_option (id INT AUTO_INCREMENT NOT NULL, mode VARCHAR(20) NOT NULL, departure_city VARCHAR(255) NOT NULL, departure_latitude DOUBLE PRECISION DEFAULT NULL, departure_longitude DOUBLE PRECISION DEFAULT NULL, price INT DEFAULT NULL, link VARCHAR(500) DEFAULT NULL, note VARCHAR(255) DEFAULT NULL, chosen TINYINT DEFAULT 0 NOT NULL, created_at DATETIME NOT NULL, trip_id INT NOT NULL, user_id INT NOT NULL, INDEX IDX_E97D7539A5BC2E0E (trip_id), INDEX IDX_E97D7539A76ED395 (user_id), INDEX IDX_E97D7539A5BC2E0EA76ED395 (trip_id, user_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE trip_traveler (id INT AUTO_INCREMENT NOT NULL, budget INT DEFAULT NULL, dependents INT DEFAULT 0 NOT NULL, trip_id INT NOT NULL, user_id INT NOT NULL, INDEX IDX_C010C106A5BC2E0E (trip_id), INDEX IDX_C010C106A76ED395 (user_id), UNIQUE INDEX uniq_trip_traveler (trip_id, user_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE accommodation_reaction ADD CONSTRAINT FK_F9F328818F3692CD FOREIGN KEY (accommodation_id) REFERENCES accommodation (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE accommodation_reaction ADD CONSTRAINT FK_F9F32881A76ED395 FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE transport_option ADD CONSTRAINT FK_E97D7539A5BC2E0E FOREIGN KEY (trip_id) REFERENCES trip (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE transport_option ADD CONSTRAINT FK_E97D7539A76ED395 FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE trip_traveler ADD CONSTRAINT FK_C010C106A5BC2E0E FOREIGN KEY (trip_id) REFERENCES trip (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE trip_traveler ADD CONSTRAINT FK_C010C106A76ED395 FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE accommodation ADD status VARCHAR(12) DEFAULT \'proposed\' NOT NULL, ADD proposed_by_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE accommodation ADD CONSTRAINT FK_2D385412DAB5A938 FOREIGN KEY (proposed_by_id) REFERENCES `user` (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_2D385412DAB5A938 ON accommodation (proposed_by_id)');
        $this->addSql('ALTER TABLE expense ADD accommodation_id INT DEFAULT NULL, ADD transport_option_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE expense ADD CONSTRAINT FK_2D3A8DA68F3692CD FOREIGN KEY (accommodation_id) REFERENCES accommodation (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE expense ADD CONSTRAINT FK_2D3A8DA631079BF4 FOREIGN KEY (transport_option_id) REFERENCES transport_option (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_2D3A8DA68F3692CD ON expense (accommodation_id)');
        $this->addSql('CREATE INDEX IDX_2D3A8DA631079BF4 ON expense (transport_option_id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE accommodation_reaction DROP FOREIGN KEY FK_F9F328818F3692CD');
        $this->addSql('ALTER TABLE accommodation_reaction DROP FOREIGN KEY FK_F9F32881A76ED395');
        $this->addSql('ALTER TABLE transport_option DROP FOREIGN KEY FK_E97D7539A5BC2E0E');
        $this->addSql('ALTER TABLE transport_option DROP FOREIGN KEY FK_E97D7539A76ED395');
        $this->addSql('ALTER TABLE trip_traveler DROP FOREIGN KEY FK_C010C106A5BC2E0E');
        $this->addSql('ALTER TABLE trip_traveler DROP FOREIGN KEY FK_C010C106A76ED395');
        $this->addSql('DROP TABLE accommodation_reaction');
        $this->addSql('DROP TABLE transport_option');
        $this->addSql('DROP TABLE trip_traveler');
        $this->addSql('ALTER TABLE accommodation DROP FOREIGN KEY FK_2D385412DAB5A938');
        $this->addSql('DROP INDEX IDX_2D385412DAB5A938 ON accommodation');
        $this->addSql('ALTER TABLE accommodation DROP status, DROP proposed_by_id');
        $this->addSql('ALTER TABLE expense DROP FOREIGN KEY FK_2D3A8DA68F3692CD');
        $this->addSql('ALTER TABLE expense DROP FOREIGN KEY FK_2D3A8DA631079BF4');
        $this->addSql('DROP INDEX IDX_2D3A8DA68F3692CD ON expense');
        $this->addSql('DROP INDEX IDX_2D3A8DA631079BF4 ON expense');
        $this->addSql('ALTER TABLE expense DROP accommodation_id, DROP transport_option_id');
    }
}
