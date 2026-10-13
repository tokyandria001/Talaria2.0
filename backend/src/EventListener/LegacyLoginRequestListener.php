<?php

namespace App\EventListener;

use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * Connexion avec { "email", "password" } (site web app.talaria.world) en plus de { "username", "password" }
 * (apps mobile et React) : l'email est recopié dans "username", le champ lu par json_login.
 * Passe avant le pare-feu de sécurité (priorité 8).
 */
#[AsEventListener(event: KernelEvents::REQUEST, priority: 16)]
final class LegacyLoginRequestListener
{
    public function __invoke(RequestEvent $event): void
    {
        $request = $event->getRequest();
        if (!$event->isMainRequest() || !$request->isMethod('POST') || $request->getPathInfo() !== '/api/auth/login') {
            return;
        }

        $data = json_decode($request->getContent(), true);
        if (!is_array($data) || isset($data['username']) || !isset($data['email'])) {
            return;
        }

        $data['username'] = $data['email'];
        $request->initialize(
            $request->query->all(),
            $request->request->all(),
            $request->attributes->all(),
            $request->cookies->all(),
            $request->files->all(),
            $request->server->all(),
            json_encode($data),
        );
    }
}
