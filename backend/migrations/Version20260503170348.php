<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260503170348 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE trip (id INT AUTO_INCREMENT NOT NULL, title VARCHAR(255) DEFAULT NULL, destination VARCHAR(255) NOT NULL, departure_city VARCHAR(255) NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL, travelers INT DEFAULT 1 NOT NULL, budget INT DEFAULT NULL, transport_mode VARCHAR(20) NOT NULL, distance_km INT DEFAULT NULL, fuel_price_per_liter NUMERIC(5, 3) DEFAULT NULL, fuel_consumption NUMERIC(5, 2) DEFAULT NULL, toll_cost INT DEFAULT NULL, needs_rental TINYINT DEFAULT 0 NOT NULL, rental_link VARCHAR(500) DEFAULT NULL, rental_cost INT DEFAULT NULL, booking_links JSON DEFAULT \'[]\' NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME DEFAULT NULL, user_id INT NOT NULL, INDEX IDX_7656F53BA76ED395 (user_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE trip ADD CONSTRAINT FK_7656F53BA76ED395 FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE trip DROP FOREIGN KEY FK_7656F53BA76ED395');
        $this->addSql('DROP TABLE trip');
    }
}
