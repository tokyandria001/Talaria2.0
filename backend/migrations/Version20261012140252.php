<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261012140252 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Étape 4 : dépenses, participants des dépenses et remboursements';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE expense (id INT AUTO_INCREMENT NOT NULL, label VARCHAR(120) NOT NULL, amount_cents INT NOT NULL, category VARCHAR(20) NOT NULL, created_at DATETIME NOT NULL, trip_id INT NOT NULL, paid_by_id INT NOT NULL, created_by_id INT DEFAULT NULL, INDEX IDX_2D3A8DA6A5BC2E0E (trip_id), INDEX IDX_2D3A8DA67F9BC654 (paid_by_id), INDEX IDX_2D3A8DA6B03A8386 (created_by_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE expense_participant (expense_id INT NOT NULL, user_id INT NOT NULL, INDEX IDX_AEF3C78AF395DB7B (expense_id), INDEX IDX_AEF3C78AA76ED395 (user_id), PRIMARY KEY (expense_id, user_id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE settlement (id INT AUTO_INCREMENT NOT NULL, amount_cents INT NOT NULL, created_at DATETIME NOT NULL, trip_id INT NOT NULL, from_user_id INT NOT NULL, to_user_id INT NOT NULL, created_by_id INT DEFAULT NULL, INDEX IDX_DD9F1B51A5BC2E0E (trip_id), INDEX IDX_DD9F1B512130303A (from_user_id), INDEX IDX_DD9F1B5129F6EE60 (to_user_id), INDEX IDX_DD9F1B51B03A8386 (created_by_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE expense ADD CONSTRAINT FK_2D3A8DA6A5BC2E0E FOREIGN KEY (trip_id) REFERENCES trip (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE expense ADD CONSTRAINT FK_2D3A8DA67F9BC654 FOREIGN KEY (paid_by_id) REFERENCES `user` (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE expense ADD CONSTRAINT FK_2D3A8DA6B03A8386 FOREIGN KEY (created_by_id) REFERENCES `user` (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE expense_participant ADD CONSTRAINT FK_AEF3C78AF395DB7B FOREIGN KEY (expense_id) REFERENCES expense (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE expense_participant ADD CONSTRAINT FK_AEF3C78AA76ED395 FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE settlement ADD CONSTRAINT FK_DD9F1B51A5BC2E0E FOREIGN KEY (trip_id) REFERENCES trip (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE settlement ADD CONSTRAINT FK_DD9F1B512130303A FOREIGN KEY (from_user_id) REFERENCES `user` (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE settlement ADD CONSTRAINT FK_DD9F1B5129F6EE60 FOREIGN KEY (to_user_id) REFERENCES `user` (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE settlement ADD CONSTRAINT FK_DD9F1B51B03A8386 FOREIGN KEY (created_by_id) REFERENCES `user` (id) ON DELETE SET NULL');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE expense DROP FOREIGN KEY FK_2D3A8DA6A5BC2E0E');
        $this->addSql('ALTER TABLE expense DROP FOREIGN KEY FK_2D3A8DA67F9BC654');
        $this->addSql('ALTER TABLE expense DROP FOREIGN KEY FK_2D3A8DA6B03A8386');
        $this->addSql('ALTER TABLE expense_participant DROP FOREIGN KEY FK_AEF3C78AF395DB7B');
        $this->addSql('ALTER TABLE expense_participant DROP FOREIGN KEY FK_AEF3C78AA76ED395');
        $this->addSql('ALTER TABLE settlement DROP FOREIGN KEY FK_DD9F1B51A5BC2E0E');
        $this->addSql('ALTER TABLE settlement DROP FOREIGN KEY FK_DD9F1B512130303A');
        $this->addSql('ALTER TABLE settlement DROP FOREIGN KEY FK_DD9F1B5129F6EE60');
        $this->addSql('ALTER TABLE settlement DROP FOREIGN KEY FK_DD9F1B51B03A8386');
        $this->addSql('DROP TABLE expense');
        $this->addSql('DROP TABLE expense_participant');
        $this->addSql('DROP TABLE settlement');
    }
}
