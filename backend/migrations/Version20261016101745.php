<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/** Suppression d'un compte : ses lieux restent (sans auteur), ses « j'aime » sur les lieux partent avec lui */
final class Version20261016101745 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Suppression de compte : lieux créés gardés sans auteur, likes de lieux supprimés';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE place DROP FOREIGN KEY `FK_741D53CDB03A8386`');
        $this->addSql('ALTER TABLE place ADD CONSTRAINT FK_741D53CDB03A8386 FOREIGN KEY (created_by_id) REFERENCES `user` (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE place_like DROP FOREIGN KEY `FK_66D6305FA76ED395`');
        $this->addSql('ALTER TABLE place_like ADD CONSTRAINT FK_66D6305FA76ED395 FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE place DROP FOREIGN KEY FK_741D53CDB03A8386');
        $this->addSql('ALTER TABLE place ADD CONSTRAINT `FK_741D53CDB03A8386` FOREIGN KEY (created_by_id) REFERENCES `user` (id)');
        $this->addSql('ALTER TABLE place_like DROP FOREIGN KEY FK_66D6305FA76ED395');
        $this->addSql('ALTER TABLE place_like ADD CONSTRAINT `FK_66D6305FA76ED395` FOREIGN KEY (user_id) REFERENCES `user` (id)');
    }
}
