<?php

namespace App\Exception;

/** Donnée de requête invalide : convertie en réponse JSON 400 par ApiExceptionListener */
class InvalidInputException extends \RuntimeException
{
}
