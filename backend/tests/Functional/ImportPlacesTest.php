<?php

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Console\Tester\CommandTester;

/** Import de lieux OpenStreetMap (hôtels, bars) et chargement de la carte par zone */
final class ImportPlacesTest extends ApiTestCase
{
    private function import(array $json): string
    {
        $file = tempnam(sys_get_temp_dir(), 'places') . '.json';
        file_put_contents($file, json_encode($json));
        $tester = new CommandTester((new Application(static::$kernel))->find('app:import-places'));
        $tester->execute(['file' => $file]);
        self::assertSame(0, $tester->getStatusCode());
        return $tester->getDisplay();
    }

    public function testImportsHotelsAndBarsWithoutDuplicates(): void
    {
        $hotels = [
            ['lat' => 48.8566, 'lon' => 2.3522, 'name' => 'Hôtel du Louvre', 'type' => 'hotel'],
            ['lat' => 48.8566, 'lon' => 2.3522, 'name' => 'Hôtel du Louvre', 'type' => 'hotel'],          // doublon
            ['lat' => 45.76, 'lon' => 4.83, 'name' => 'Chez Marie', 'type' => 'guest_house'],
            ['lat' => 43.3, 'lon' => 5.4, 'name' => 'Camping des Calanques', 'type' => 'camp_site'],
            ['lat' => 43.6, 'lon' => 1.44, 'name' => 'Auberge Capitole', 'type' => 'hostel'],
            ['lat' => 120, 'lon' => 2, 'name' => 'Hors carte', 'type' => 'hotel'],                          // position invalide
            ['lat' => 44, 'lon' => 2, 'name' => 'Musée', 'type' => 'museum'],                               // type ignoré
        ];
        $display = $this->import($hotels);
        self::assertMatchesRegularExpression('/importés\s+4/', $display);
        self::assertMatchesRegularExpression('/doublon dans le fichier\s+1/', $display);

        $bars = ['bars' => [
            ['type' => 'node', 'id' => 1, 'lat' => 48.86, 'lon' => 2.35, 'tags' => [
                'amenity' => 'bar', 'name' => 'Le Comptoir', 'opening_hours' => 'Mo-Sa 17:00-02:00',
                'addr:housenumber' => '12', 'addr:street' => 'rue de Rivoli', 'addr:postcode' => '75001', 'addr:city' => 'Paris',
            ]],
            ['type' => 'node', 'id' => 2, 'lat' => 48.87, 'lon' => 2.36, 'tags' => ['amenity' => 'bar']],                         // sans nom
            ['type' => 'node', 'id' => 3, 'lat' => 48.87, 'lon' => 2.36, 'tags' => ['amenity' => 'public_bookcase', 'name' => 'Boîte à livres']], // pas un bar
        ]];
        self::assertMatchesRegularExpression('/importés\s+1/', $this->import($bars));
        self::assertMatchesRegularExpression('/importés\s+0/', $this->import($bars), 'Réimport : aucun doublon');

        $token = $this->registerAndLogin();
        [, $data] = $this->json('GET', '/api/places?tags=bar', null, $token);
        self::assertCount(1, $data['places']);
        $bar = $data['places'][0];
        self::assertSame('Le Comptoir', $bar['name']);
        self::assertSame('12 rue de Rivoli, 75001 Paris', $bar['address']);
        self::assertSame('Mo-Sa 17:00-02:00', $bar['openingHours']);
        self::assertSame('osm', $bar['source']);
        self::assertNull($bar['createdBy'], 'Lieu importé : pas d\'auteur');

        [, $lodging] = $this->json('GET', '/api/places?tags=hotel,auberge,camping', null, $token);
        self::assertEqualsCanonicalizing(['Hôtel du Louvre', 'Chez Marie', 'Camping des Calanques', 'Auberge Capitole'], array_column($lodging['places'], 'name'));
    }

    public function testMapLoadsTheVisibleAreaWithALimit(): void
    {
        $rows = [];
        for ($i = 0; $i < 30; $i++) {
            $rows[] = ['lat' => 48.85 + $i / 1000, 'lon' => 2.35, 'name' => "Hôtel $i", 'type' => 'hotel'];
        }
        $rows[] = ['lat' => 43.3, 'lon' => 5.4, 'name' => 'Hôtel Marseille', 'type' => 'hotel'];
        $this->import($rows);
        $token = $this->registerAndLogin();

        [, $paris] = $this->json('GET', '/api/places?bbox=48.8,2.3,48.9,2.4&limit=10', null, $token);
        self::assertCount(10, $paris['places']);
        self::assertTrue($paris['truncated'], 'D\'autres lieux dans la zone');
        self::assertNotContains('Hôtel Marseille', array_column($paris['places'], 'name'));

        [, $marseille] = $this->json('GET', '/api/places?bbox=43.2,5.3,43.4,5.5', null, $token);
        self::assertSame(['Hôtel Marseille'], array_column($marseille['places'], 'name'));
        self::assertFalse($marseille['truncated']);

        [, $capped] = $this->json('GET', '/api/places?limit=100000', null, $token);
        self::assertCount(31, $capped['places'], 'Limite plafonnée à 500');
    }
}
