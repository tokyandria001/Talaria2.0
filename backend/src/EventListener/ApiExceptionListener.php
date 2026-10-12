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
            $event->setResponse(new JsonResponse(['message' => $e->getMessage()], 400));
        }
    }
}
