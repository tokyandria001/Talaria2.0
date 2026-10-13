"""
Génère les images des marqueurs de la carte (bulles de regroupement + points des lieux) dans
mobile/assets/markers/, en @1x, @2x et @3x, ainsi que constants/MarkerImages.js.

Pourquoi des images : sur Android (nouvelle architecture), react-native-maps rogne les marqueurs
dessinés avec des View (ronds coupés en quart). Une image passée à <Marker image={...}> est dessinée
par la carte elle-même, sans rognage, et coûte moins cher à afficher.

    python scripts/generate-markers.py      (depuis mobile/, à relancer si les couleurs ou catégories changent)
"""
import json
import os
import re
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'markers')
FONT = os.path.join(ROOT, 'node_modules', '@expo-google-fonts', 'bricolage-grotesque', '700Bold', 'BricolageGrotesque_700Bold.ttf')
ICONS = os.path.join(ROOT, 'node_modules', 'expo', 'node_modules', '@expo', 'vector-icons', 'build', 'vendor', 'react-native-vector-icons')
SCALES = [1, 2, 3]
SS = 4  # suréchantillonnage pour des bords lisses

PARME = '#4f203f'
WHITE = '#ffffff'

# Bulles : libellé → diamètre (dp). Même logique que clusterLabel() dans MapPanel.jsx
CLUSTERS = (
    [(str(n), 34) for n in range(2, 10)]
    + [(f'{n}+', 40) for n in range(10, 100, 10)]
    + [(f'{n}+', 48) for n in range(100, 1000, 100)]
    + [(f'{n}k+', 56) for n in range(1, 10)]
    + [(f'{n}k+', 60) for n in (10, 20, 50)]
)


def categories():
    """Catégories (valeur, icône, couleur) lues dans constants/PlaceCategories.js"""
    src = open(os.path.join(ROOT, 'constants', 'PlaceCategories.js'), encoding='utf-8').read()
    cats = re.findall(r"value: '(\w+)'.*?icon: '([\w-]+)'.*?color: '(#[0-9a-fA-F]{6})'", src)
    return cats + [('default', 'location', PARME)]


def font(px):
    return ImageFont.truetype(FONT, px)


def save(img, name, scale):
    suffix = '' if scale == 1 else f'@{scale}x'
    img.save(os.path.join(OUT, f'{name}{suffix}.png'), optimize=True)


def cluster_image(label, diameter, scale):
    border = 3
    size = diameter + 4  # marge pour l'anticrénelage
    k = scale * SS
    img = Image.new('RGBA', (size * k, size * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    o = 2 * k
    d.ellipse([o, o, o + diameter * k - 1, o + diameter * k - 1], fill=WHITE)
    b = o + border * k
    d.ellipse([b, b, o + (diameter - border) * k - 1, o + (diameter - border) * k - 1], fill=PARME)
    f = font((14 if diameter >= 56 else 13) * k)
    d.text((size * k / 2, size * k / 2), label, font=f, fill=WHITE, anchor='mm')
    return img.resize((size * scale, size * scale), Image.LANCZOS)


def pin_image(icon, color, glyphs, scale, active):
    z = 1.2 if active else 1.0
    circle, tail_w, tail_h, border = 32 * z, 12 * z, 8 * z, 2 * z
    w, h = round(circle + 4), round(circle + tail_h + 4)
    k = scale * SS
    img = Image.new('RGBA', (w * k, h * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x0, y0 = (w - circle) / 2 * k, 2 * k
    cx = w * k / 2
    # Pointe sous le rond
    ty = y0 + (circle - border) * k
    d.polygon([(cx - tail_w / 2 * k, ty), (cx + tail_w / 2 * k, ty), (cx, ty + tail_h * k)], fill=color)
    d.ellipse([x0, y0, x0 + circle * k - 1, y0 + circle * k - 1], fill=WHITE)
    d.ellipse([x0 + border * k, y0 + border * k, x0 + (circle - border) * k - 1, y0 + (circle - border) * k - 1], fill=color)
    glyph = chr(glyphs[icon])
    f = ImageFont.truetype(os.path.join(ICONS, 'Fonts', 'Ionicons.ttf'), round(15 * z * k))
    d.text((cx, y0 + circle * k / 2), glyph, font=f, fill=WHITE, anchor='mm')
    return img.resize((w * scale, h * scale), Image.LANCZOS)


def slug(label):
    return label.replace('+', 'plus')


def main():
    os.makedirs(OUT, exist_ok=True)
    glyphs = json.load(open(os.path.join(ICONS, 'glyphmaps', 'Ionicons.json'), encoding='utf-8'))
    cats = categories()

    for scale in SCALES:
        for label, diameter in CLUSTERS:
            save(cluster_image(label, diameter, scale), f'cluster-{slug(label)}', scale)
        for value, icon, color in cats:
            save(pin_image(icon, color, glyphs, scale, False), f'pin-{value}', scale)
            save(pin_image(icon, color, glyphs, scale, True), f'pin-{value}-active', scale)

    lines = [
        '// Fichier généré par scripts/generate-markers.py — ne pas modifier à la main',
        '/* eslint-disable */',
        'export const CLUSTER_IMAGES = {',
        *[f"  '{label}': require('../assets/markers/cluster-{slug(label)}.png')," for label, _ in CLUSTERS],
        '};',
        '',
        'export const PIN_IMAGES = {',
        *[f"  {value}: require('../assets/markers/pin-{value}.png')," for value, _, _ in cats],
        '};',
        '',
        'export const PIN_ACTIVE_IMAGES = {',
        *[f"  {value}: require('../assets/markers/pin-{value}-active.png')," for value, _, _ in cats],
        '};',
        '',
    ]
    open(os.path.join(ROOT, 'constants', 'MarkerImages.js'), 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
    print(f'{len(CLUSTERS)} bulles, {len(cats)} catégories de points, {len(SCALES)} densités')


if __name__ == '__main__':
    main()
