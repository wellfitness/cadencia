"""
Genera assets de marca a partir de public/logo.png:
  - public/pwa-192x192.png  (icono PWA "any")
  - public/pwa-512x512.png  (icono PWA "any" + "maskable", safe-zone 80%)
  - public/og-image.png     (1200x630 social card)

Las fuentes Righteous y ABeeZee (Google Fonts, SIL OFL) se descargan a
scripts/fonts/ la primera vez. Esa carpeta esta en .gitignore.
"""
from PIL import Image, ImageDraw, ImageFont
import os
import urllib.request
import ssl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = os.path.join(ROOT, 'public', 'logo.png')
OUT_192 = os.path.join(ROOT, 'public', 'pwa-192x192.png')
OUT_512 = os.path.join(ROOT, 'public', 'pwa-512x512.png')
OUT_OG = os.path.join(ROOT, 'public', 'og-image.png')

FONTS_DIR = os.path.join(ROOT, 'scripts', 'fonts')
FONT_DISPLAY = os.path.join(FONTS_DIR, 'Righteous.ttf')
FONT_BODY = os.path.join(FONTS_DIR, 'ABeeZee.ttf')

FONT_URLS = {
    FONT_DISPLAY: 'https://github.com/google/fonts/raw/main/ofl/righteous/Righteous-Regular.ttf',
    FONT_BODY: 'https://github.com/google/fonts/raw/main/ofl/abeezee/ABeeZee-Regular.ttf',
}


def ensure_fonts() -> None:
    os.makedirs(FONTS_DIR, exist_ok=True)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE  # entornos Win con cadena CA incompleta
    for path, url in FONT_URLS.items():
        if os.path.exists(path):
            continue
        print(f'[fetch] {os.path.basename(path)} <- {url}')
        with urllib.request.urlopen(url, context=ctx) as r, open(path, 'wb') as f:
            f.write(r.read())


ensure_fonts()

# Paleta Cadencia (de tailwind.config.ts / design-system)
WHITE = (255, 255, 255, 255)
TURQUESA = (0, 190, 200, 255)       # #00bec8
TULIP_TREE = (234, 179, 8, 255)     # #eab308 (tulipTree-500)
GRIS_800 = (38, 41, 48, 255)        # #262930

logo = Image.open(LOGO).convert('RGBA')
print(f'[input] logo: {logo.size}')


def make_pwa_icon(size: int, logo_pct: float, out_path: str) -> None:
    """Crea icono cuadrado con logo centrado sobre fondo blanco.

    logo_pct: ancho del logo como fraccion del lienzo (0-1).
              <=0.7 deja safe-zone para maskable (80% inner area).
    """
    canvas = Image.new('RGBA', (size, size), WHITE)
    target_w = int(size * logo_pct)
    aspect = logo.width / logo.height
    target_h = int(target_w / aspect)
    # No queremos que el logo desborde verticalmente (raro en 2:1, pero seguro)
    if target_h > size * logo_pct:
        target_h = int(size * logo_pct)
        target_w = int(target_h * aspect)
    scaled = logo.resize((target_w, target_h), Image.Resampling.LANCZOS)
    pos = ((size - target_w) // 2, (size - target_h) // 2)
    canvas.alpha_composite(scaled, pos)
    # Quantize 256 colores para reducir peso
    quant = canvas.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
    quant.save(out_path, format='PNG', optimize=True)
    kb = os.path.getsize(out_path) / 1024
    print(f'[ok] {out_path}: {size}x{size} -> {kb:.1f} KB (logo {target_w}x{target_h})')


# 192x192: solo "any". Logo grande (85% ancho).
make_pwa_icon(192, 0.85, OUT_192)

# 512x512: "any" + "maskable". Safe zone 80% -> logo a 70% ancho para holgura.
make_pwa_icon(512, 0.70, OUT_512)


# ----------- OG image (1200x630) -----------
def make_og_image(out_path: str) -> None:
    W, H = 1200, 630
    canvas = Image.new('RGBA', (W, H), WHITE)
    draw = ImageDraw.Draw(canvas)

    # Bandas decorativas turquesa (top/bottom)
    BAND = 10
    draw.rectangle([0, 0, W, BAND], fill=TURQUESA)
    draw.rectangle([0, H - BAND, W, H], fill=TURQUESA)

    # Layout: logo arriba centrado + bloque de texto debajo, ambos centrados.
    # Esto evita problemas de overflow y queda equilibrado para preview social.

    # Logo: 480x240 (ratio 2:1) centrado horizontalmente
    logo_w_target = 480
    aspect = logo.width / logo.height
    logo_h_target = int(logo_w_target / aspect)  # 240
    scaled = logo.resize((logo_w_target, logo_h_target), Image.Resampling.LANCZOS)
    logo_x = (W - logo_w_target) // 2
    logo_y = 70
    canvas.alpha_composite(scaled, (logo_x, logo_y))

    # "Cadencia" en Righteous, color tulipTree, centrado
    font_brand = ImageFont.truetype(FONT_DISPLAY, 96)
    brand_text = 'Cadencia'
    bb = draw.textbbox((0, 0), brand_text, font=font_brand)
    brand_w = bb[2] - bb[0]
    brand_x = (W - brand_w) // 2
    brand_y = logo_y + logo_h_target + 20
    draw.text((brand_x, brand_y), brand_text, font=font_brand, fill=TULIP_TREE)

    # Tagline (uppercase con tracking manual via espacios) centrada
    font_tag = ImageFont.truetype(FONT_BODY, 30)
    tag_text = 'P A R A   C I C L I S T A S   C O N   R I T M O'
    bb = draw.textbbox((0, 0), tag_text, font=font_tag)
    tag_w = bb[2] - bb[0]
    tag_x = (W - tag_w) // 2
    tag_y = brand_y + 110
    draw.text((tag_x, tag_y), tag_text, font=font_tag, fill=GRIS_800)

    # URL pequena en turquesa
    font_url = ImageFont.truetype(FONT_BODY, 22)
    url_text = 'cadencia.movimientofuncional.app'
    bb = draw.textbbox((0, 0), url_text, font=font_url)
    url_w = bb[2] - bb[0]
    url_x = (W - url_w) // 2
    url_y = tag_y + 50
    draw.text((url_x, url_y), url_text, font=font_url, fill=TURQUESA)

    # Quantize para reducir peso
    quant = canvas.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
    quant.save(out_path, format='PNG', optimize=True)
    kb = os.path.getsize(out_path) / 1024
    print(f'[ok] {out_path}: {W}x{H} -> {kb:.1f} KB')


make_og_image(OUT_OG)
print('\n[done] todos los assets generados.')
