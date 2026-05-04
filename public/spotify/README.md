# Logos oficiales de Spotify

Esta carpeta contiene los PNG oficiales del logo de Spotify, descargados
directamente del media kit oficial:

  https://newsroom.spotify.com/media-kit/logo-and-brand-assets/

Archivos:

  Logo completo (icono + wordmark «Spotify»):
  - Spotify_Full_Logo_RGB_Green.png   (fondos claros — default)
  - Spotify_Full_Logo_RGB_White.png   (fondos oscuros — p. ej. Modo TV)
  - Spotify_Full_Logo_RGB_Black.png   (alternativa monocromo)

  Logo primario (solo icono, en nomenclatura de Spotify «Primary Logo»):
  - Spotify_Primary_Logo_RGB_Green.png   (icono cuadrado 512 px, fondo
    transparente; el verde corporativo lo hace válido sobre cualquier fondo)

## Por qué PNG y no SVG

El media kit oficial sirve los logos en PNG de alta resolución como
descarga directa pública. Spotify exige usar sus assets oficiales tal
cual (sin recortar, sin recolorar, sin estirar). Reproducir el logo en
SVG sería violación de marca.

Los PNG aquí servidos están sin alteraciones desde la fuente oficial:

  https://storage.googleapis.com/pr-newsroom-wp/1/2023/05/Spotify_Full_Logo_RGB_Green.png
  https://storage.googleapis.com/pr-newsroom-wp/1/2023/05/Spotify_Full_Logo_RGB_White.png
  https://storage.googleapis.com/pr-newsroom-wp/1/2023/05/Spotify_Full_Logo_RGB_Black.png
  https://storage.googleapis.com/pr-newsroom-wp/1/2023/05/Spotify_Primary_Logo_RGB_Green.png

## Tamaños mínimos según Branding Guidelines

  - Logo completo (icono + wordmark): mínimo 70 px digital / 20 mm impresión.
  - Solo icono: mínimo 21 px digital / 6 mm impresión.
  - Exclusion zone: la mitad de la altura del icono alrededor del logo.

El componente `SpotifyAttribution` (en `src/ui/components/`) los carga
automáticamente. Si faltan, cae a un fallback textual «Música de Spotify»
sin romper la UI.
