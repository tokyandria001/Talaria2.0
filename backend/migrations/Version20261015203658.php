<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261015203658 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Parrainage : parrain de chaque compte (lien ?invite=<pseudo>)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE `user` ADD referred_at DATETIME DEFAULT NULL, ADD referred_by_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE `user` ADD CONSTRAINT FK_8D93D649758C8114 FOREIGN KEY (referred_by_id) REFERENCES `user` (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_8D93D649758C8114 ON `user` (referred_by_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE `user` DROP FOREIGN KEY FK_8D93D649758C8114');
        $this->addSql('DROP INDEX IDX_8D93D649758C8114 ON `user`');
        $this->addSql('ALTER TABLE `user` DROP referred_at, DROP referred_by_id');
    }
}
