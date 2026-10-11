<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260628135254 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE place_like (id INT AUTO_INCREMENT NOT NULL, created_at DATETIME NOT NULL, place_id INT NOT NULL, user_id INT NOT NULL, INDEX IDX_66D6305FDA6A219 (place_id), INDEX IDX_66D6305FA76ED395 (user_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE place_like ADD CONSTRAINT FK_66D6305FDA6A219 FOREIGN KEY (place_id) REFERENCES place (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE place_like ADD CONSTRAINT FK_66D6305FA76ED395 FOREIGN KEY (user_id) REFERENCES `user` (id)');
        $this->addSql('ALTER TABLE place ADD likes_count INT DEFAULT 0 NOT NULL');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE place_like DROP FOREIGN KEY FK_66D6305FDA6A219');
        $this->addSql('ALTER TABLE place_like DROP FOREIGN KEY FK_66D6305FA76ED395');
        $this->addSql('DROP TABLE place_like');
        $this->addSql('ALTER TABLE place DROP likes_count');
    }
}
