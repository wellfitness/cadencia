"""
Genera assets de marca a partir de public/logo.png:

  Favicons (silueta turquesa sobre transparente):
    public/favicon-16x16.png
    public/favicon-32x32.png
    public/favicon-64x64.png

  Apple Touch Icon (logo turquesa sobre fondo blanco, sin recorte):
    public/apple-touch-icon.png  (180x180)

  PWA icons (logo turquesa sobre fondo blanco, safe-zone para maskable):
    public/pwa-192x192.png
    public/pwa-512x512.png

  Open Graph (1200x630 social card):
    public/og-image.png

El logo de marca (corazon + clave de sol + onda de pulso) esta en silueta
negra sobre transparente (public/logo.png). En la Landing y el Header el
componente <Logo /> lo muestra tal cual (negro nativo). Aqui, sin embargo,
se TINTA en turquesa-700 (#0e7e85) para los assets PWA/favicon/OG: sobre
la pantalla de inicio del movil o en una preview social, una silueta
turquesa lee como icono de marca, mientras que un negro plano se confunde
con cualquier otro icono oscuro. El tinte se aplica usando el canal alpha
del PNG original como mascara.

Las fuentes Righteous y ABeeZee (Google Fonts, SIL OFL) se descargan a
scripts/fonts/ la primera vez. Esa carpeta esta en .gitignore.
"""
from PIL import Image, ImageDraw, ImageFont
import os
import urllib.request
import ssl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = os.path.join(ROOT, 'public', 'logo.png')

OUT_FAVICON_16 = os.path.join(ROOT, 'public', 'favicon-16x16.png')
OUT_FAVICON_32 = os.path.join(ROOT, 'public', 'favicon-32x32.png')
OUT_FAVICON_64 = os.path.join(ROOT, 'public', 'favicon-64x64.png')
OUT_APPLE = os.path.join(ROOT, 'public', 'apple-touch-icon.png')
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
TURQUESA_600 = (0, 190, 200, 255)        # #00bec8 - acento, OG
TURQUESA_700 = (14, 126, 133, 255)       # #0e7e85 - silueta tintada para favicons / iconos PWA / og-image
TULIP_TREE = (234, 179, 8, 255)          # #eab308 (tulipTree-500)
GRIS_800 = (38, 41, 48, 255)             # #262930

logo_silhouette = Image.open(LOGO).convert('RGBA')
print(f'[input] logo: {logo_silhouette.size}')


def tint_logo(color: tuple[int, int, int, int]) -> Image.Image:
    """Devuelve el logo con la silueta pintada en `color` y mismo alpha que el original.

    El logo de origen es silueta negra opaca sobre transparente. Para tintarlo,
    creamos un lienzo del color objetivo y le aplicamos el canal alpha del
    original como mascara: el resultado es la misma silueta pero en el color
    pedido, con bordes antialias preservados.
    """
    canvas = Image.new('RGBA', logo_silhouette.size, color)
    canvas.putalpha(logo_silhouette.getchannel('A'))
    return canvas


# Logo tintado turquesa - reutilizado por todos los generadores
logo = tint_logo(TURQUESA_700)


def make_favicon(size: int, out_path: str) -> None:
    """Favicon transparente con silueta turquesa centrada al ancho completo del lienzo.

    A 16x16 los detalles internos del logo (la onda de pulso dentro del
    corazon) se pierden, pero la silueta global sigue siendo reconocible
    como corazon con clave de sol.
    """
    aspect = logo.width / logo.height
    target_h = size
    target_w = int(target_h * aspect)
    if target_w > size:
        target_w = size
        target_h = int(target_w / aspect)
    scaled = logo.resize((target_w, target_h), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    pos = ((size - target_w) // 2, (size - target_h) // 2)
    canvas.alpha_composite(scaled, pos)
    canvas.save(out_path, format='PNG', optimize=True)
    kb = os.path.getsize(out_path) / 1024
    print(f'[ok] {out_path}: {size}x{size} -> {kb:.1f} KB')


def make_pwa_icon(size: int, logo_pct: float, out_path: str, bg=WHITE) -> None:
    """Icono cuadrado con logo centrado sobre fondo solido.

    logo_pct: ancho del logo como fraccion del lienzo (0-1).
              <=0.7 deja safe-zone para maskable (Android recorta el 20% exterior).
    bg: color de fondo del lienzo (RGBA).
    """
    canvas = Image.new('RGBA', (size, size), bg)
    target_w = int(size * logo_pct)
    aspect = logo.width / logo.height
    target_h = int(target_w / aspect)
    if target_h > size * logo_pct:
        target_h = int(size * logo_pct)
        target_w = int(target_h * aspect)
    scaled = logo.resize((target_w, target_h), Image.Resampling.LANCZOS)
    pos = ((size - target_w) // 2, (size - target_h) // 2)
    canvas.alpha_composite(scaled, pos)
    quant = canvas.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
    quant.save(out_path, format='PNG', optimize=True)
    kb = os.path.getsize(out_path) / 1024
    print(f'[ok] {out_path}: {size}x{size} -> {kb:.1f} KB (logo {target_w}x{target_h})')


# Favicons - silueta turquesa transparente
make_favicon(16, OUT_FAVICON_16)
make_favicon(32, OUT_FAVICON_32)
make_favicon(64, OUT_FAVICON_64)

# Apple Touch Icon - 180x180, fondo blanco, logo al 80% (iOS no recorta pero
# se ve mejor con un poco de aire)
make_pwa_icon(180, 0.80, OUT_APPLE)

# PWA 192x192 - "any". Logo grande (85% ancho).
make_pwa_icon(192, 0.85, OUT_192)

# PWA 512x512 - "any" + "maskable". Safe zone 80% -> logo a 70% para holgura.
make_pwa_icon(512, 0.70, OUT_512)


# ----------- OG image (1200x630) -----------
def make_og_image(out_path: str) -> None:
    """Open Graph card 1200x630 con layout horizontal: logo izquierda, texto derecha.

    El logo es cuadrado (~1:1). Un layout vertical lo haria desbordar verticalmente
    en 630px de alto. El layout horizontal aprovecha la proporcion 1200:630 ≈ 2:1
    y deja respiracion alrededor del texto.
    """
    W, H = 1200, 630
    canvas = Image.new('RGBA', (W, H), WHITE)
    draw = ImageDraw.Draw(canvas)

    # Bandas decorativas turquesa (top/bottom)
    BAND = 10
    draw.rectangle([0, 0, W, BAND], fill=TURQUESA_600)
    draw.rectangle([0, H - BAND, W, H], fill=TURQUESA_600)

    # Logo izquierda: cuadrado 420x420 con margen 80, centrado verticalmente
    logo_size = 420
    aspect = logo.width / logo.height
    if aspect >= 1:
        logo_w = logo_size
        logo_h = int(logo_size / aspect)
    else:
        logo_h = logo_size
        logo_w = int(logo_size * aspect)
    scaled = logo.resize((logo_w, logo_h), Image.Resampling.LANCZOS)
    logo_x = 80
    logo_y = (H - logo_h) // 2
    canvas.alpha_composite(scaled, (logo_x, logo_y))

    # Bloque de texto a la derecha del logo, centrado verticalmente
    text_x = logo_x + logo_size + 60  # 80 (margen) + 420 (logo) + 60 (gap) = 560
    text_block_center_y = H // 2

    # "Cadencia" en Righteous turquesa
    font_brand = ImageFont.truetype(FONT_DISPLAY, 110)
    brand_text = 'Cadencia'
    bb_brand = draw.textbbox((0, 0), brand_text, font=font_brand)
    brand_h = bb_brand[3] - bb_brand[1]

    # Tagline (uppercase con tracking) en gris. Eco del subtitulo pintado en
    # el hero ("disfruta del cardio a tu ritmo"). Tamano calibrado para que
    # quepa en text_x..W-margen sin recortar la ultima letra ('O' de RITMO).
    font_tag = ImageFont.truetype(FONT_BODY, 26)
    tag_text = 'D E L   C A R D I O   A   T U   R I T M O'
    bb_tag = draw.textbbox((0, 0), tag_text, font=font_tag)
    tag_h = bb_tag[3] - bb_tag[1]

    # URL en tulipTree
    font_url = ImageFont.truetype(FONT_BODY, 26)
    url_text = 'cadencia.movimientofuncional.app'
    bb_url = draw.textbbox((0, 0), url_text, font=font_url)
    url_h = bb_url[3] - bb_url[1]

    # Espaciados entre lineas
    GAP_BRAND_TAG = 30
    GAP_TAG_URL = 50
    total_block_h = brand_h + GAP_BRAND_TAG + tag_h + GAP_TAG_URL + url_h
    block_top = text_block_center_y - total_block_h // 2

    # Render: brand (turquesa-700, mismo color que logo), tagline (gris), url (tulipTree)
    draw.text((text_x, block_top), brand_text, font=font_brand, fill=TURQUESA_700)
    draw.text((text_x, block_top + brand_h + GAP_BRAND_TAG), tag_text, font=font_tag, fill=GRIS_800)
    draw.text((text_x, block_top + brand_h + GAP_BRAND_TAG + tag_h + GAP_TAG_URL),
              url_text, font=font_url, fill=TULIP_TREE)

    quant = canvas.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
    quant.save(out_path, format='PNG', optimize=True)
    kb = os.path.getsize(out_path) / 1024
    print(f'[ok] {out_path}: {W}x{H} -> {kb:.1f} KB')


make_og_image(OUT_OG)
print('\n[done] todos los assets generados.')
