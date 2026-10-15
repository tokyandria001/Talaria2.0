<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261015093232 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Connexion avec Google (compte lié, compte sans mot de passe)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE `user` ADD google_id VARCHAR(64) DEFAULT NULL, CHANGE password password VARCHAR(255) DEFAULT NULL');
        $this->addSql('CREATE UNIQUE INDEX UNIQ_8D93D64976F5C865 ON `user` (google_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX UNIQ_8D93D64976F5C865 ON `user`');
        $this->addSql('ALTER TABLE `user` DROP google_id, CHANGE password password VARCHAR(255) NOT NULL');
    }
}
