<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261014123428 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Logements proposés par Talaria (prix estimé)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE accommodation ADD suggested TINYINT DEFAULT 0 NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE accommodation DROP suggested');
    }
}
