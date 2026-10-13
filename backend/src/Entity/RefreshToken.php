<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Gesdinet\JWTRefreshTokenBundle\Entity\RefreshToken as BaseRefreshToken;

/**
 * Jeton de renouvellement (gesdinet/jwt-refresh-token-bundle) : identifiant de l'utilisateur
 * (son email), empreinte du jeton, date de fin de validité.
 */
#[ORM\Entity]
#[ORM\Table(name: 'refresh_tokens')]
#[ORM\Index(name: 'idx_refresh_tokens_username', columns: ['username'])]
class RefreshToken extends BaseRefreshToken
{
}
