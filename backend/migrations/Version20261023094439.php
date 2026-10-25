<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261023094439 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Signalements de contenus, contenus masqués, comptes suspendus';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE report (id INT AUTO_INCREMENT NOT NULL, target_type VARCHAR(10) NOT NULL, target_id INT NOT NULL, photo VARCHAR(255) DEFAULT NULL, reason VARCHAR(20) NOT NULL, comment VARCHAR(500) DEFAULT NULL, status VARCHAR(10) NOT NULL, handled_at DATETIME DEFAULT NULL, created_at DATETIME NOT NULL, reporter_id INT NOT NULL, handled_by_id INT DEFAULT NULL, INDEX IDX_C42F7784E1CFE6F5 (reporter_id), INDEX IDX_C42F7784FE65AF40 (handled_by_id), INDEX idx_report_target (target_type, target_id, status), UNIQUE INDEX uniq_report_reporter_target (reporter_id, target_type, target_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE report ADD CONSTRAINT FK_C42F7784E1CFE6F5 FOREIGN KEY (reporter_id) REFERENCES `user` (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE report ADD CONSTRAINT FK_C42F7784FE65AF40 FOREIGN KEY (handled_by_id) REFERENCES `user` (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE article ADD hidden_at DATETIME DEFAULT NULL');
        $this->addSql('ALTER TABLE article_comment ADD hidden_at DATETIME DEFAULT NULL');
        $this->addSql('ALTER TABLE place ADD hidden_at DATETIME DEFAULT NULL');
        $this->addSql('ALTER TABLE `user` ADD suspended_at DATETIME DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE report DROP FOREIGN KEY FK_C42F7784E1CFE6F5');
        $this->addSql('ALTER TABLE report DROP FOREIGN KEY FK_C42F7784FE65AF40');
        $this->addSql('DROP TABLE report');
        $this->addSql('ALTER TABLE article DROP hidden_at');
        $this->addSql('ALTER TABLE article_comment DROP hidden_at');
        $this->addSql('ALTER TABLE place DROP hidden_at');
        $this->addSql('ALTER TABLE `user` DROP suspended_at');
    }
}
