<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261016075840 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Accord des textes : « Elle », « Il » ou neutre';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE `user` ADD gender VARCHAR(10) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE `user` DROP gender');
    }
}
