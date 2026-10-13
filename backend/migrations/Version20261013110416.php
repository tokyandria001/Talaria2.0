<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261013110416 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Profil et paramètres : bio, téléphone, mobilité, confidentialité, préférences de voyage, réglages, suppression différée ; utilisateurs bloqués';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE blocked_user (id INT AUTO_INCREMENT NOT NULL, created_at DATETIME NOT NULL, blocker_id INT NOT NULL, blocked_id INT NOT NULL, INDEX IDX_718E1137548D5975 (blocker_id), INDEX IDX_718E113721FF5136 (blocked_id), UNIQUE INDEX uniq_blocked_user (blocker_id, blocked_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE blocked_user ADD CONSTRAINT FK_718E1137548D5975 FOREIGN KEY (blocker_id) REFERENCES `user` (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE blocked_user ADD CONSTRAINT FK_718E113721FF5136 FOREIGN KEY (blocked_id) REFERENCES `user` (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE `user` ADD bio LONGTEXT DEFAULT NULL, ADD phone VARCHAR(30) DEFAULT NULL, ADD has_car TINYINT DEFAULT 0 NOT NULL, ADD has_driving_license TINYINT DEFAULT 0 NOT NULL, ADD profile_public TINYINT DEFAULT 1 NOT NULL, ADD invite_policy VARCHAR(20) DEFAULT \'friends\' NOT NULL, ADD travel_preferences JSON DEFAULT NULL, ADD settings JSON DEFAULT NULL, ADD password_changed_at DATETIME DEFAULT NULL, ADD deletion_requested_at DATETIME DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE blocked_user DROP FOREIGN KEY FK_718E1137548D5975');
        $this->addSql('ALTER TABLE blocked_user DROP FOREIGN KEY FK_718E113721FF5136');
        $this->addSql('DROP TABLE blocked_user');
        $this->addSql('ALTER TABLE `user` DROP bio, DROP phone, DROP has_car, DROP has_driving_license, DROP profile_public, DROP invite_policy, DROP travel_preferences, DROP settings, DROP password_changed_at, DROP deletion_requested_at');
    }
}
