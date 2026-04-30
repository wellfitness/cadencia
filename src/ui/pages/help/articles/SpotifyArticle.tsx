import { ArticleShell } from '@ui/components/help/ArticleShell';
import { Card } from '@ui/components/Card';

interface FaqItem {
  q: string;
  a: string;
}

const FAQS: readonly FaqItem[] = [
  {
    q: '¿Necesito una cuenta Premium de Spotify?',
    a:
      'Para crear la lista en tu biblioteca, sí — Spotify exige Premium para escribir listas desde aplicaciones de terceros. Para previsualizar el emparejamiento y exportar la sesión a .zwo (Zwift, TrainerRoad, etc.) no hace falta cuenta.',
  },
  {
    q: '¿Por qué no aparece mi cuenta de Spotify al pulsar «Crear lista»?',
    a:
      'Cadencia usa OAuth PKCE: abre la página oficial de acceso a Spotify en una pestaña separada. Si tienes bloqueador de ventanas emergentes o el navegador en modo estricto, puede impedirlo. Permite ventanas emergentes para cadencia.movimientofuncional.app y vuelve a intentarlo.',
  },
  {
    q: 'He visto un error 403 después de autenticar — ¿qué pasa?',
    a:
      'En febrero de 2026 Spotify retiró los puntos de acceso antiguos para crear listas (POST /v1/users/{id}/playlists y POST /v1/playlists/{id}/tracks). Devuelven 403 silencioso sin mensaje. Cadencia ya usa los nuevos (/me/playlists y /items), pero si una versión vieja del service worker queda en caché puedes ver el error. Recarga con Ctrl+Shift+R o cierra y reabre la PWA.',
  },
  {
    q: '¿Por qué tengo que abrir la app en 127.0.0.1 en lugar de localhost (modo desarrollo)?',
    a:
      'A finales de 2024 Spotify dejó de aceptar http://localhost como dirección de redirección. La app de desarrollo se abre en http://127.0.0.1:5173/. En producción no afecta — usa la URL real con HTTPS.',
  },
  {
    q: 'Algunas canciones del catálogo no aparecen en mi lista final',
    a:
      'Si una canción del CSV no se encuentra en Spotify (por ejemplo porque ya no está disponible en tu país), Cadencia la salta y elige la siguiente mejor del orden de puntuación. La lista resultante puede ser ligeramente más corta que la previa, pero todas las canciones que sí están encajan en zona y cadencia.',
  },
  {
    q: '¿Mis datos van a algún sitio?',
    a:
      'No. Cadencia no tiene servidor ni base de datos. Tu plan de sesión, tu GPX y tu progreso del asistente viven en el almacenamiento de tu pestaña y se borran al cerrarla. Tus datos duraderos (peso, FC, FTP, géneros musicales, sesiones guardadas, listas propias y entradas del calendario) se guardan en este dispositivo solo si activas «Recordar mis datos» desde Mis preferencias, y se sincronizan entre dispositivos solo si conectas tu propio Google Drive — la carpeta `drive.appdata` es privada y exclusiva de Cadencia, nosotros no la vemos. El token de Spotify es siempre de sesión y expira en una hora.',
  },
  {
    q: '¿Cómo subo mis propias listas de canciones?',
    a:
      'En el paso «Música», elige fuente «Mías» o «Ambas» y arrastra el CSV de exportación de Spotify (con columnas Track URI, Tempo, Energy, Valence). La app deduplica por URI: las que coinciden con el catálogo nativo se cuentan una sola vez. Tus listas se guardan automáticamente en este dispositivo y, si tienes Drive conectado, se sincronizan al resto. Para gestionarlas: Mis preferencias → Catálogo de música → «Editar catálogo» → pestaña «Mis listas».',
  },
  {
    q: '¿«Regenerar lista» cambia mucho la lista?',
    a:
      'El botón «🎲 Regenerar lista» cambia la semilla aleatoria del motor. Para cada bloque, hace un muestreo ponderado entre los 5 mejores candidatos del ranking de cadencia — así puedes hacer la misma sesión Noruego 4×4 cada martes con música distinta sin perder calidad. Si quieres reproducibilidad total, no toques el botón.',
  },
  {
    q: '¿Cómo descarto una canción que no me gusta?',
    a:
      'En el paso «A pedalear» (resultado), cada canción tiene tres botones: «Aleatorio» (sustituye por otra al azar), «Otro tema» (eliges del menú) y «No la quiero» (descarte permanente). El descarte se guarda en tu lista de canciones rechazadas y la canción no volverá a aparecer en futuras listas. Para revisarlas o recuperarlas: Mis preferencias → Catálogo de música → «Editar catálogo» → pestaña «Descartadas».',
  },
];

export function SpotifyArticle(): JSX.Element {
  return (
    <ArticleShell
      slug="spotify"
      lead="Cadencia se conecta a Spotify solo cuando pulsas 'Crear lista'. Aquí están las preguntas que más nos llegan sobre la integración y sobre la app en general."
    >
      <Card variant="info" className="mb-6" title="Privacidad: nada va a ningún servidor" titleIcon="shield">
        <p className="text-sm text-gris-700 leading-relaxed">
          Cadencia es 100% cliente. Tu GPX y el progreso del asistente viven en la
          pestaña actual y se borran al cerrarla. Tus ajustes y sesiones guardadas
          permanecen en este dispositivo solo si tú lo activas, y solo viajan a otros
          dispositivos si conectas tu propio Google Drive. El token de Spotify es de
          sesión y expira en una hora. Sin servidor, sin analítica de seguimiento.
        </p>
      </Card>

      <h2 className="font-display text-xl md:text-2xl text-gris-900 mt-2 mb-3">
        Preguntas frecuentes
      </h2>
      <div className="space-y-2">
        {FAQS.map((item, i) => (
          <details
            key={i}
            className="group rounded-xl border border-gris-200 bg-white p-4 hover:border-turquesa-400 transition-colors"
          >
            <summary className="cursor-pointer list-none font-semibold text-gris-800 flex items-start gap-2">
              <span className="text-turquesa-600 mt-0.5 group-open:rotate-90 transition-transform" aria-hidden>
                ▶
              </span>
              <span className="flex-1">{item.q}</span>
            </summary>
            <p className="mt-3 ml-6 text-sm text-gris-700 leading-relaxed">{item.a}</p>
          </details>
        ))}
      </div>
    </ArticleShell>
  );
}
