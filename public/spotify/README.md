# Logos oficiales de Spotify

Esta carpeta debe contener los SVG oficiales del logo de Spotify
descargados desde el media kit oficial:

  https://newsroom.spotify.com/media-kit/

Archivos esperados (nombres exactos):

  - Spotify_Logo_RGB_Green.svg   (fondos claros — default)
  - Spotify_Logo_RGB_White.svg   (fondos oscuros — p. ej. Modo TV)
  - Spotify_Logo_RGB_Black.svg   (alternativa monocromo)

El componente `SpotifyAttribution` (en `src/ui/components/`) los carga
automáticamente. Si faltan, cae a un fallback textual «Música de Spotify»
sin romper la UI.

## Por qué descargarlos manualmente

Spotify exige usar sus assets oficiales tal cual (sin recortar, sin
recolorar, sin estirar). Reproducir el logo es violación de marca. Este
proyecto sirve los SVG originales sin alteraciones.

## Tamaños mínimos según Branding Guidelines

  - Logo completo (icono + wordmark): mínimo 70 px digital / 20 mm impresión.
  - Solo icono: mínimo 21 px digital / 6 mm impresión.
  - Exclusion zone: la mitad de la altura del icono alrededor del logo.
