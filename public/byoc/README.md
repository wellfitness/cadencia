# Capturas del tutorial BYOC

Este directorio sirve las 3 capturas que muestra el modal `ByocTutorialDialog`
([src/ui/components/ByocTutorialDialog.tsx](../../src/ui/components/ByocTutorialDialog.tsx))
cuando el usuario configura su propio Client ID de Spotify.

## Archivos servidos

| Archivo | Contenido |
|---|---|
| `step-1-create-app.png` | Dashboard de Spotify con el botón **Create app** resaltado en amarillo. |
| `step-2-fill-form.png` | Vista «Basic Information» de la app, con los campos **Redirect URIs** y **APIs used** resaltados (los 2 datos críticos a rellenar al crear la app). |
| `step-3-copy-id.png` | Vista «Basic Information» con el card del **Client ID** resaltado, listo para copiar. |

## Cómo se generaron

Capturas reales del dashboard de Spotify, tomadas con el Chrome controlado vía
DevTools Protocol. Antes de cada screenshot se aplica una pasada de JavaScript
que neutraliza datos sensibles del operador (Client ID real → `a1b2c3d4...`,
nombre real de la app → «Mi Cadencia», descripción real → texto genérico) para
que las capturas sean genéricas y no expongan datos del Client ID compartido.

Si el layout del dashboard de Spotify cambia, se regeneran navegando a la app
de demo y aplicando el mismo flujo. El Client ID es **público por diseño**
(PKCE no usa secret), así que aunque apareciera el real no sería un problema
de seguridad — el cambio cosmético es solo para que la captura no parezca
referirse a la app concreta del operador.

## Optimización opcional

Las capturas pesan ~140 KB cada una en PNG. Se sirven con `loading="lazy"` en
el modal, así que no afectan al primer paint. Si quieres reducir peso, puedes
convertir a WebP con calidad 80 (típicamente bajan a ~50-70 KB):

```bash
cwebp -q 80 step-1-create-app.png -o step-1-create-app.webp
# Repetir para los otros dos
# Luego actualizar las refs en ByocTutorialDialog.tsx de .png → .webp
```
