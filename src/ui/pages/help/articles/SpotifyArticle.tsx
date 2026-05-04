import { ArticleShell } from '@ui/components/help/ArticleShell';
import { Card } from '@ui/components/Card';

interface FaqItem {
  q: string;
  a: string | readonly string[];
}

const FAQS: readonly FaqItem[] = [
  {
    q: '¿Por qué tengo que crear mi propia aplicación de Spotify para usar Cadencia?',
    a: [
      'Spotify endureció su política el 15 de mayo de 2025: el acceso ampliado para aplicaciones grandes ahora exige ser una empresa legalmente registrada con más de 250.000 usuarios mensuales y facturación demostrable. Para una aplicación pequeña como Cadencia, ese camino está cerrado de hecho.',
      'La única vía realista (el llamado «modo desarrollo») limita cada aplicación de Spotify a 5 cuentas autorizadas. Si Cadencia compartiese una única aplicación entre todos los usuarios, solo 5 personas en todo el mundo podrían usarla.',
      'Por eso adoptamos el modelo BYOC («tu propia llave»): cada persona crea su propia aplicación de Spotify (gratis, 3 minutos) y tiene sus propios 5 huecos para autorizar cuentas, sin pasar por listas centralizadas. La aplicación te guía paso a paso con un asistente la primera vez que pulsas «Crear lista».',
    ],
  },
  {
    q: '¿Cuánto tarda crear mi Client ID y para qué lo necesito exactamente?',
    a: [
      'Tres minutos en developer.spotify.com → «Create app» → rellenar nombre, descripción, pegar la URL de retorno que te muestra Cadencia, marcar «Web API» y guardar. Después, en la pestaña «User Management», añades tu propio correo de Spotify Premium como cuenta autorizada. Por último copias el Client ID resultante (32 caracteres) y lo pegas en Cadencia.',
      'Solo lo haces una vez en la vida; queda guardado en el almacenamiento local de tu navegador. El asistente te enseña cada paso con capturas reales del panel de Spotify. Tu Client ID es lo que permite que TÚ autorices a Cadencia a crear listas en tu cuenta — sin él, Spotify no te deja.',
    ],
  },
  {
    q: '¿La voz del entrenador del Modo TV controla Spotify?',
    a: [
      'No. La voz que oyes en el Modo TV es síntesis de voz local de tu navegador y solo describe el bloque actual del entrenamiento (zona, sensación, cadencia, duración).',
      'No controla la reproducción de Spotify por voz: los botones de música del Modo TV (reproducir/pausa/anterior/siguiente) envían comandos directos a tu reproductor de Spotify Premium activo. Voz y controles son dos canales independientes.',
    ],
  },
  {
    q: '¿Necesito una cuenta Premium de Spotify?',
    a: [
      'Sí. Spotify exige Premium para escribir listas desde aplicaciones de terceros y también para crear aplicaciones en el panel de desarrollador (paso obligatorio del flujo BYOC).',
      'Si solo quieres previsualizar el emparejamiento y exportar la sesión a .zwo (Zwift, TrainerRoad y similares) sin crear lista en Spotify, no hace falta ninguna cuenta.',
    ],
  },
  {
    q: '¿Por qué no aparece mi cuenta de Spotify al pulsar «Crear lista»?',
    a: [
      'Cadencia abre la página oficial de acceso a Spotify en una pestaña separada para que autorices la conexión. Si tienes bloqueador de ventanas emergentes o el navegador en modo estricto, puede impedirlo. Permite ventanas emergentes para cadencia.movimientofuncional.app y vuelve a intentarlo.',
      'Si todavía no tienes tu Client ID configurado, en lugar de la pantalla de Spotify se te abrirá el asistente para que crees tu propia aplicación.',
    ],
  },
  {
    q: 'He visto un error 403 después de autenticar — ¿qué pasa?',
    a: [
      'Lo más habitual: al crear tu aplicación de Spotify olvidaste añadir tu propio correo como cuenta autorizada en la pestaña «User Management» del panel. Spotify limita el modo desarrollo a 5 cuentas autorizadas explícitamente, y por defecto la lista está vacía — incluso para ti como creadora. La solución es entrar en developer.spotify.com → tu aplicación → User Management → Add user con tu correo de Premium, y reintentar.',
      'Si tu cuenta ya está añadida y aun así te sale 403, puede que tu navegador tenga una versión antigua de Cadencia en caché (Spotify renombró las rutas de su servicio en febrero de 2026): recarga con Ctrl+Shift+R o cierra y reabre la aplicación.',
      'Si persiste, copia los detalles del error desde la propia tarjeta y avísame por Telegram.',
    ],
  },
  {
    q: '¿Puedo invitar a otra persona a usar mi Client ID?',
    a: [
      'Sí. Hasta 5 cuentas en total (incluyéndote a ti). En el panel de developer.spotify.com → tu aplicación → User Management → Add user, añades el correo de Spotify Premium de la otra persona.',
      'Esa persona pondrá TU Client ID en SU navegador (Mis preferencias → Conexión con Spotify → Configurar el mío) y podrá usar Cadencia sin crearse su propia aplicación. Útil para parejas, familias o equipos pequeños que comparten una sola configuración.',
    ],
  },
  {
    q: 'Me sale otro error de Spotify (502, sin conexión, etc.). ¿Qué hago?',
    a: [
      'Cualquier fallo del servicio de Spotify muestra una tarjeta roja con el mensaje técnico completo (código, ruta, detalle) y dos atajos: «Copiar detalles» (al portapapeles) y «Avisar por Telegram» (abre t.me/wellfitness_trainer en una pestaña nueva).',
      'Cópialo y pégamelo allí — con eso puedo localizar el problema sin pedirte que abras herramientas de desarrollador. En el Modo TV el botón se llama «Detalles» y abre la misma información en un cuadro de diálogo.',
    ],
  },
  {
    q: 'Algunas canciones del catálogo no aparecen en mi lista final',
    a: 'Si una canción del CSV no se encuentra en Spotify (por ejemplo porque ya no está disponible en tu país), Cadencia la salta y elige la siguiente mejor del orden de puntuación. La lista resultante puede ser ligeramente más corta que la previa, pero todas las canciones que sí están encajan en zona y cadencia.',
  },
  {
    q: '¿Mis datos van a algún sitio?',
    a: [
      'No. Cadencia no tiene servidor ni base de datos. Tu plan de sesión, tu GPX y tu progreso del asistente viven solo en la memoria de la pestaña y se borran al cerrarla.',
      'Tus datos duraderos (peso, FC, FTP, géneros musicales, sesiones guardadas, listas propias y entradas del calendario) se guardan en este dispositivo solo si activas «Recordar mis datos» desde Mis preferencias, y se sincronizan entre dispositivos solo si conectas tu propio Google Drive — Cadencia escribe en una carpeta privada que solo nuestra aplicación ve, no en tu Drive normal.',
      'Tu Client ID de Spotify se guarda en el almacenamiento local de tu navegador y nunca sale de ahí. La llave de acceso temporal a Spotify caduca en una hora y se borra al cerrar la pestaña.',
    ],
  },
  {
    q: '¿Cómo subo mis propias listas de canciones?',
    a: [
      'En el paso «Música», elige fuente «Mías» o «Ambas» y arrastra el CSV de exportación de Spotify (con columnas Track URI, Tempo, Energy, Valence). Cadencia descarta canciones repetidas por su URI: las que coinciden con el catálogo nativo se cuentan una sola vez.',
      'Tus listas se guardan automáticamente en este dispositivo y, si tienes Drive conectado, se sincronizan al resto. Para gestionarlas: Mis preferencias → Catálogo de música → «Editar catálogo» → pestaña «Mis listas».',
    ],
  },
  {
    q: '¿«Regenerar lista» cambia mucho la lista?',
    a: 'El botón «🎲 Regenerar lista» cambia la semilla aleatoria del motor. Para cada bloque, hace un muestreo ponderado entre los 5 mejores candidatos del ranking de cadencia — así puedes hacer la misma sesión Noruego 4×4 cada martes con música distinta sin perder calidad. Si quieres reproducibilidad total, no toques el botón.',
  },
  {
    q: '¿Cómo descarto una canción que no me gusta?',
    a: [
      'En el paso «A pedalear» (resultado), cada canción tiene tres botones: «Aleatorio» (sustituye por otra al azar), «Otro tema» (eliges del menú) y «No la quiero» (descarte permanente).',
      'El descarte se guarda en tu lista de canciones rechazadas y la canción no volverá a aparecer en futuras listas. Para revisarlas o recuperarlas: Mis preferencias → Catálogo de música → «Editar catálogo» → pestaña «Descartadas».',
    ],
  },
];

export function SpotifyArticle(): JSX.Element {
  return (
    <ArticleShell
      slug="spotify"
      lead="Cadencia se conecta a Spotify solo cuando pulsas 'Crear lista'. Aquí están las preguntas que más nos llegan sobre esa conexión y sobre la aplicación en general."
    >
      <Card variant="info" className="mb-6" title="Privacidad: nada va a ningún servidor" titleIcon="shield">
        <p className="text-sm text-gris-700 leading-relaxed">
          Cadencia funciona entera en tu navegador. Tu GPX y el progreso del asistente
          viven solo en la pestaña actual y se borran al cerrarla. Tus ajustes y
          sesiones guardadas permanecen en este dispositivo solo si tú lo activas, y
          solo viajan a otros dispositivos si conectas tu propio Google Drive. Tu
          Client ID de Spotify se queda guardado en este navegador; la llave de acceso
          temporal a Spotify caduca en una hora. Sin servidor, sin seguimiento.
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
            <div className="mt-3 ml-6 space-y-2">
              {(typeof item.a === 'string' ? [item.a] : item.a).map((para, i) => (
                <p key={i} className="text-sm text-gris-700 leading-relaxed">{para}</p>
              ))}
            </div>
          </details>
        ))}
      </div>
    </ArticleShell>
  );
}
