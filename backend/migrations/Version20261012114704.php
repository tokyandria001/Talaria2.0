<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261012114704 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Phase 7 : amis (table friendship)';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE friendship (id INT AUTO_INCREMENT NOT NULL, status VARCHAR(10) NOT NULL, created_at DATETIME NOT NULL, accepted_at DATETIME DEFAULT NULL, requester_id INT NOT NULL, addressee_id INT NOT NULL, INDEX IDX_7234A45FED442CF4 (requester_id), INDEX IDX_7234A45F2261B4C3 (addressee_id), INDEX IDX_7234A45F2261B4C37B00651C (addressee_id, status), UNIQUE INDEX uniq_friendship_pair (requester_id, addressee_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE friendship ADD CONSTRAINT FK_7234A45FED442CF4 FOREIGN KEY (requester_id) REFERENCES `user` (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE friendship ADD CONSTRAINT FK_7234A45F2261B4C3 FOREIGN KEY (addressee_id) REFERENCES `user` (id) ON DELETE CASCADE');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE friendship DROP FOREIGN KEY FK_7234A45FED442CF4');
        $this->addSql('ALTER TABLE friendship DROP FOREIGN KEY FK_7234A45F2261B4C3');
        $this->addSql('DROP TABLE friendship');
    }
}
