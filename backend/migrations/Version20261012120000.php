<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261012120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Phase 5 : planning d\'activités jour par jour (table activity)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE activity (id INT AUTO_INCREMENT NOT NULL, date DATE NOT NULL, slot VARCHAR(20) NOT NULL, title VARCHAR(200) NOT NULL, description LONGTEXT DEFAULT NULL, category VARCHAR(30) DEFAULT NULL, price INT DEFAULT NULL, has_special_price TINYINT DEFAULT 0 NOT NULL, special_price_note VARCHAR(255) DEFAULT NULL, is_auto TINYINT DEFAULT 0 NOT NULL, created_at DATETIME NOT NULL, trip_id INT NOT NULL, place_id INT DEFAULT NULL, INDEX IDX_AC74095AA5BC2E0E (trip_id), INDEX IDX_AC74095ADA6A219 (place_id), INDEX IDX_AC74095AA5BC2E0EAA9E377A (trip_id, date), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE activity ADD CONSTRAINT FK_AC74095AA5BC2E0E FOREIGN KEY (trip_id) REFERENCES trip (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE activity ADD CONSTRAINT FK_AC74095ADA6A219 FOREIGN KEY (place_id) REFERENCES place (id) ON DELETE SET NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE activity DROP FOREIGN KEY FK_AC74095AA5BC2E0E');
        $this->addSql('ALTER TABLE activity DROP FOREIGN KEY FK_AC74095ADA6A219');
        $this->addSql('DROP TABLE activity');
    }
}
