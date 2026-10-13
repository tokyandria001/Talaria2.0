<?php

namespace App\Service;

/** Le service de recherche de lieux ne répond pas (réseau, quota, panne) */
final class GeoSearchUnavailable extends \RuntimeException
{
}
