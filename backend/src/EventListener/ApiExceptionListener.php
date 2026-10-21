<?php

namespace App\EventListener;

use App\Exception\InvalidInputException;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;

#[AsEventListener]
final class ApiExceptionListener
{
    public function __invoke(ExceptionEvent $event): void
    {
        $e = $event->getThrowable();
        if ($e instanceof InvalidInputException) {
            // Code d'erreur porté par l'exception (ex. 429 trop d'envois), 400 par défaut
            $status = $e->getCode() >= 400 && $e->getCode() < 500 ? $e->getCode() : 400;
            $event->setResponse(new JsonResponse(['message' => $e->getMessage()], $status));
        }
    }
}
