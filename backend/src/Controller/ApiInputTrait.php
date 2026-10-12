<?php

namespace App\Controller;

use App\Exception\InvalidInputException;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Validator\ConstraintViolationListInterface;

/**
 * Lecture sûre des champs JSON : une valeur mal formée lève InvalidInputException (réponse 400)
 * au lieu de provoquer une erreur serveur.
 */
trait ApiInputTrait
{
    /** Date au format AAAA-MM-JJ */
    private function parseDate(mixed $value, string $label): \DateTimeImmutable
    {
        $date = is_string($value) ? \DateTimeImmutable::createFromFormat('!Y-m-d', $value) : false;
        if (!$date || $date->format('Y-m-d') !== $value) {
            throw new InvalidInputException(sprintf('%s invalide (format attendu : AAAA-MM-JJ).', ucfirst($label)));
        }
        return $date;
    }

    /** Entier optionnel : null ou '' → null ; texte non numérique → 400 */
    private function parseInt(mixed $value, string $label): ?int
    {
        if ($value === null || $value === '') return null;
        if (!is_numeric($value)) {
            throw new InvalidInputException(sprintf('%s doit être un nombre.', ucfirst($label)));
        }
        return (int) round((float) $value);
    }

    /** Décimal optionnel stocké en texte (colonnes DECIMAL) */
    private function parseDecimal(mixed $value, string $label): ?string
    {
        if ($value === null || $value === '') return null;
        if (!is_numeric($value)) {
            throw new InvalidInputException(sprintf('%s doit être un nombre.', ucfirst($label)));
        }
        return (string) (float) $value;
    }

    private function validationError(ConstraintViolationListInterface $errors): JsonResponse
    {
        $messages = [];
        foreach ($errors as $e) {
            $messages[$e->getPropertyPath()] = $e->getMessage();
        }
        return $this->json(['message' => reset($messages) ?: 'Données invalides.', 'errors' => $messages], 422);
    }
}
