#!/usr/bin/env python3
"""
Exporta os PNG do ícone a partir dos SVG desta pasta.

    pip install cairosvg
    python3 design/icon/export.py

Os SVG são o original; os PNG em `assets/` são derivados e refazem-se com isto. Não é um passo do
build nem corre no CI: o ícone muda de vez em quando, e um PNG commitado é mais simples de servir
do que uma dependência de rasterização no workflow do APK.

Verifica também a zona segura — se alguém mexer nas medidas e passar do limite, isto diz.
"""
import math
import os
import sys

try:
    import cairosvg
except ImportError:
    sys.exit('falta o cairosvg: pip install cairosvg')

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', '..', 'assets')

# (svg, png, lado em px)
EXPORTS = [
    ('icon.svg',                'icon.png',            1024),
    ('adaptive-foreground.svg', 'adaptive-icon.png',   1024),
    ('monochrome.svg',          'monochrome-icon.png', 1024),
    ('adaptive-foreground.svg', 'splash-icon.png',     1024),
    ('icon.svg',                'favicon.png',           48),
]

# ── A zona segura ────────────────────────────────────────────────────────────
# O Android recorta o primeiro plano com uma máscara que muda de telemóvel para telemóvel: só se
# pode contar com o círculo central de 660 px dos 1024, ou seja 165 numa tela de 512.
SAFE_RADIUS = 165
CENTRE = 256

# Os cantos das duas cartas, como estão nos SVG. Manter a par se as medidas mudarem.
FRONT = (232, 166, 140, 200)
BACK = (140, 150, 136, 194)
BACK_ROTATION = -13
BACK_PIVOT = (208, 247)


def corners(x, y, w, h):
    return [(x, y), (x + w, y), (x, y + h), (x + w, y + h)]


def rotated(point, degrees, pivot):
    angle = math.radians(degrees)
    dx, dy = point[0] - pivot[0], point[1] - pivot[1]
    return (
        dx * math.cos(angle) - dy * math.sin(angle) + pivot[0],
        dx * math.sin(angle) + dy * math.cos(angle) + pivot[1],
    )


def furthest():
    points = corners(*FRONT)
    points += [rotated(p, BACK_ROTATION, BACK_PIVOT) for p in corners(*BACK)]
    return max(math.hypot(px - CENTRE, py - CENTRE) for px, py in points)


def main():
    reach = furthest()
    print(f'canto mais distante: {reach:.0f} px — limite: {SAFE_RADIUS} px')
    if reach > SAFE_RADIUS:
        sys.exit('o desenho passa da zona segura: há telemóveis que lhe cortam um canto')

    for source, target, size in EXPORTS:
        cairosvg.svg2png(
            url=os.path.join(HERE, source),
            write_to=os.path.join(ASSETS, target),
            output_width=size,
            output_height=size,
        )
        print(f'{target}  {size}×{size}')


if __name__ == '__main__':
    main()
