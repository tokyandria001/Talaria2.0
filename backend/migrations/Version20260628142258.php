<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260628142258 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE accommodation (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(200) NOT NULL, type VARCHAR(20) NOT NULL, check_in DATE NOT NULL, check_out DATE NOT NULL, price INT DEFAULT NULL, has_special_price TINYINT DEFAULT 0 NOT NULL, special_price_note VARCHAR(255) DEFAULT NULL, link VARCHAR(500) DEFAULT NULL, created_at DATETIME NOT NULL, trip_id INT NOT NULL, INDEX IDX_2D385412A5BC2E0E (trip_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE accommodation ADD CONSTRAINT FK_2D385412A5BC2E0E FOREIGN KEY (trip_id) REFERENCES trip (id) ON DELETE CASCADE');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE accommodation DROP FOREIGN KEY FK_2D385412A5BC2E0E');
        $this->addSql('DROP TABLE accommodation');
    }
}
