<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261013090934 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Votes du groupe (activity_vote, statut de vote des activités) et chat des voyages (trip_message, poll_vote)';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE activity_vote (id INT AUTO_INCREMENT NOT NULL, participates TINYINT NOT NULL, created_at DATETIME NOT NULL, activity_id INT NOT NULL, user_id INT NOT NULL, INDEX IDX_59D45EF681C06096 (activity_id), INDEX IDX_59D45EF6A76ED395 (user_id), UNIQUE INDEX uniq_activity_vote (activity_id, user_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE poll_vote (id INT AUTO_INCREMENT NOT NULL, option_index INT NOT NULL, message_id INT NOT NULL, user_id INT NOT NULL, INDEX IDX_ED568EBE537A1329 (message_id), INDEX IDX_ED568EBEA76ED395 (user_id), UNIQUE INDEX uniq_poll_vote (message_id, user_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE trip_message (id INT AUTO_INCREMENT NOT NULL, type VARCHAR(10) NOT NULL, body LONGTEXT NOT NULL, poll_options JSON DEFAULT NULL, poll_topic VARCHAR(40) DEFAULT NULL, created_at DATETIME NOT NULL, trip_id INT NOT NULL, author_id INT DEFAULT NULL, INDEX IDX_805175D2A5BC2E0E (trip_id), INDEX IDX_805175D2F675F31B (author_id), INDEX IDX_805175D2A5BC2E0EBF396750 (trip_id, id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE activity_vote ADD CONSTRAINT FK_59D45EF681C06096 FOREIGN KEY (activity_id) REFERENCES activity (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE activity_vote ADD CONSTRAINT FK_59D45EF6A76ED395 FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE poll_vote ADD CONSTRAINT FK_ED568EBE537A1329 FOREIGN KEY (message_id) REFERENCES trip_message (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE poll_vote ADD CONSTRAINT FK_ED568EBEA76ED395 FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE trip_message ADD CONSTRAINT FK_805175D2A5BC2E0E FOREIGN KEY (trip_id) REFERENCES trip (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE trip_message ADD CONSTRAINT FK_805175D2F675F31B FOREIGN KEY (author_id) REFERENCES `user` (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE activity ADD vote_status VARCHAR(12) DEFAULT NULL, ADD vote_deadline DATE DEFAULT NULL, ADD proposed_by_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE activity ADD CONSTRAINT FK_AC74095ADAB5A938 FOREIGN KEY (proposed_by_id) REFERENCES `user` (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_AC74095ADAB5A938 ON activity (proposed_by_id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE activity_vote DROP FOREIGN KEY FK_59D45EF681C06096');
        $this->addSql('ALTER TABLE activity_vote DROP FOREIGN KEY FK_59D45EF6A76ED395');
        $this->addSql('ALTER TABLE poll_vote DROP FOREIGN KEY FK_ED568EBE537A1329');
        $this->addSql('ALTER TABLE poll_vote DROP FOREIGN KEY FK_ED568EBEA76ED395');
        $this->addSql('ALTER TABLE trip_message DROP FOREIGN KEY FK_805175D2A5BC2E0E');
        $this->addSql('ALTER TABLE trip_message DROP FOREIGN KEY FK_805175D2F675F31B');
        $this->addSql('DROP TABLE activity_vote');
        $this->addSql('DROP TABLE poll_vote');
        $this->addSql('DROP TABLE trip_message');
        $this->addSql('ALTER TABLE activity DROP FOREIGN KEY FK_AC74095ADAB5A938');
        $this->addSql('DROP INDEX IDX_AC74095ADAB5A938 ON activity');
        $this->addSql('ALTER TABLE activity DROP vote_status, DROP vote_deadline, DROP proposed_by_id');
    }
}
