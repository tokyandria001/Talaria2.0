<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261012121950 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Phase 8 : groupes de voyage (travel_group, group_member, notification.group_id)';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE group_member (id INT AUTO_INCREMENT NOT NULL, role VARCHAR(10) NOT NULL, status VARCHAR(10) NOT NULL, created_at DATETIME NOT NULL, joined_at DATETIME DEFAULT NULL, group_id INT NOT NULL, user_id INT NOT NULL, invited_by_id INT DEFAULT NULL, INDEX IDX_A36222A8FE54D947 (group_id), INDEX IDX_A36222A8A76ED395 (user_id), INDEX IDX_A36222A8A7B4A7E3 (invited_by_id), UNIQUE INDEX uniq_group_member (group_id, user_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE travel_group (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(100) NOT NULL, description VARCHAR(500) DEFAULT NULL, photo VARCHAR(255) DEFAULT NULL, is_private TINYINT DEFAULT 1 NOT NULL, shared_budget TINYINT DEFAULT 1 NOT NULL, invite_code VARCHAR(8) NOT NULL, created_at DATETIME NOT NULL, created_by_id INT DEFAULT NULL, UNIQUE INDEX UNIQ_C56CC3736F21F112 (invite_code), INDEX IDX_C56CC373B03A8386 (created_by_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE group_member ADD CONSTRAINT FK_A36222A8FE54D947 FOREIGN KEY (group_id) REFERENCES travel_group (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE group_member ADD CONSTRAINT FK_A36222A8A76ED395 FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE group_member ADD CONSTRAINT FK_A36222A8A7B4A7E3 FOREIGN KEY (invited_by_id) REFERENCES `user` (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE travel_group ADD CONSTRAINT FK_C56CC373B03A8386 FOREIGN KEY (created_by_id) REFERENCES `user` (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE notification ADD group_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE notification ADD CONSTRAINT FK_BF5476CAFE54D947 FOREIGN KEY (group_id) REFERENCES travel_group (id) ON DELETE CASCADE');
        $this->addSql('CREATE INDEX IDX_BF5476CAFE54D947 ON notification (group_id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE group_member DROP FOREIGN KEY FK_A36222A8FE54D947');
        $this->addSql('ALTER TABLE group_member DROP FOREIGN KEY FK_A36222A8A76ED395');
        $this->addSql('ALTER TABLE group_member DROP FOREIGN KEY FK_A36222A8A7B4A7E3');
        $this->addSql('ALTER TABLE travel_group DROP FOREIGN KEY FK_C56CC373B03A8386');
        $this->addSql('DROP TABLE group_member');
        $this->addSql('DROP TABLE travel_group');
        $this->addSql('ALTER TABLE notification DROP FOREIGN KEY FK_BF5476CAFE54D947');
        $this->addSql('DROP INDEX IDX_BF5476CAFE54D947 ON notification');
        $this->addSql('ALTER TABLE notification DROP group_id');
    }
}
