import { ArticleShell } from '@ui/components/help/ArticleShell';
import { Card } from '@ui/components/Card';
import { MaterialIcon } from '@ui/components/MaterialIcon';

interface FaqItem {
  q: string;
  a: string;
}

interface FaqGroup {
  title: string;
  icon: string;
  items: readonly FaqItem[];
}

/**
 * FAQ agrupada por bloques tematicos para guiar al usuario por las
 * secciones de la app: Mis preferencias, Calendario, Sync con Drive,
 * Resolucion de problemas.
 *
 * Cada item solo aparece en un grupo: si una FAQ toca dos temas
 * (ej. "como descartar canciones" toca preferencias y sync), se ubica
 * en el bloque mas natural para el usuario que la busca.
 */
const FAQ_GROUPS: readonly FaqGroup[] = [
  {
    title: 'Mis preferencias y mis datos',
    icon: 'manage_accounts',
    items: [
      {
        q: '¿Qué guarda Cadencia de mí?',
        a: 'Siete cosas, todas tuyas y siempre opcionales: (1) tus datos fisiológicos (peso, FTP, FC máxima y reposo, año de nacimiento, sexo, tipo y peso de bici); (2) tus preferencias musicales (géneros favoritos, semilla de aleatorización, «Todo con energía»); (3) tus sesiones indoor guardadas con nombre desde el constructor; (4) tus listas CSV de Spotify (Exportify); (5) las personalizaciones del catálogo nativo (canciones desmarcadas); (6) las canciones descartadas globalmente; (7) las entradas del calendario de planificación. Por defecto solo viven en la pestaña actual; permanecen entre sesiones si activas «Recordar mis datos» en Mis preferencias y se sincronizan entre dispositivos si conectas tu Google Drive.',
      },
      {
        q: '¿Dónde edito mis preferencias musicales y mi catálogo?',
        a: 'En la página «Mis preferencias» (icono de la cabecera del asistente o desde el pie). Allí se editan los géneros preferidos, el toggle «Todo con energía» y se accede al editor del catálogo (botón «Editar catálogo»). El editor tiene tres pestañas: «Catálogo nativo» (desmarcar canciones del fondo predefinido), «Mis listas» (subir CSVs propios de Exportify) y «Descartadas» (revisar y recuperar canciones que rechazaste con «No la quiero»).',
      },
      {
        q: '¿Para qué sirve «Recordar mis datos»?',
        a: 'Por defecto Cadencia es estrictamente de sesión: tus datos viven solo en la pestaña actual y se borran al cerrarla. Si activas «Recordar mis datos» (en Mis preferencias → «Datos en este dispositivo»), tus ajustes y sesiones se guardan en este navegador y siguen ahí la próxima vez que abras la app. Recomendado en tu móvil personal y tu portátil; desactivar si compartes el ordenador. Puedes apagarlo en cualquier momento; eso borra los datos persistentes pero no afecta a los que estén en tu Drive (si lo tienes conectado).',
      },
      {
        q: '¿Cómo descarto una canción que no me gusta?',
        a: 'En el paso «A pedalear» (resultado), cada canción tiene tres botones: «Aleatorio» (sustituye por otra al azar), «Otro tema» (eliges del menú) y «No la quiero» (descarte permanente). El descarte pide confirmación, sustituye automáticamente el hueco por otra canción y guarda la URI en tu lista de rechazadas (sincronizada con Drive si lo tienes activado). Para revisarlas o recuperarlas: Mis preferencias → Catálogo de música → «Editar catálogo» → pestaña «Descartadas».',
      },
      {
        q: '¿Mis listas CSV se guardan también?',
        a: 'Sí. Cuando subes un CSV (en el paso «Música» o desde el editor del catálogo), Cadencia guarda el texto en este dispositivo y lo sincroniza con Drive si está conectado. Tamaño típico: 50-300 KB por lista. Si subes la misma lista en dos dispositivos distintos, ambas conviven como entradas independientes. Para borrar una: editor del catálogo → pestaña «Mis listas» → icono de papelera.',
      },
    ],
  },
  {
    title: 'Calendario de planificación',
    icon: 'event',
    items: [
      {
        q: '¿Puedo planificar mis entrenamientos en un calendario?',
        a: 'Sí, en la página «Calendario» (acceso desde Mis preferencias o pulsando el badge del próximo entreno en la cabecera del asistente). Hay dos vistas: «Lista» (próximos eventos en orden) y «Mes» (cuadrícula con todos los eventos del mes). Puedes crear eventos puntuales o recurrentes semanales; al pulsar «Cargar» sobre cualquier entrada, Cadencia rehidrata el plan en el asistente y te lleva al paso de Música.',
      },
      {
        q: '¿Qué diferencia hay entre evento indoor y outdoor en el calendario?',
        a: 'Indoor: referencia a una sesión que ya guardaste con nombre desde el constructor. Al cargarla, recupera todos los bloques tal cual los dejaste. Outdoor: solo metadata (nombre + URL externa opcional a Strava, Komoot o RideWithGPS). El GPX no se guarda en Cadencia para no inflar tu Drive — la idea es que el día del entrenamiento abras el enlace externo, descargues el GPX fresco y lo subas en el asistente.',
      },
      {
        q: '¿Cómo programo un entrenamiento que se repite cada semana?',
        a: 'Al crear o editar una entrada del calendario, marca los días de la semana en los que debe repetirse (ej: martes y jueves). La entrada aparecerá en cada uno de esos días sin fecha de fin. Si una semana quieres saltártelo sin borrar la serie entera, en la vista del día pulsa «Saltar este día»: añade esa fecha a las excluidas pero la serie continúa en los demás. Editar la entrada modifica toda la serie; no hay edición por instancia.',
      },
      {
        q: '¿Qué es el badge «Próximo entreno» de la cabecera?',
        a: 'Un atajo: muestra la próxima entrada del calendario (puntual o recurrente) en la cabecera del asistente. Al pulsarlo, carga directamente ese plan sin pasar por la página del calendario. Si tienes un asistente en curso sin guardar, te avisa antes de sobrescribirlo. Si no tienes entradas próximas, el badge se oculta.',
      },
      {
        q: 'Si borro una entrada del calendario en un dispositivo, ¿desaparece del otro?',
        a: 'Sí, igual que las sesiones guardadas. Cuando borras, Cadencia marca la entrada como tombstone (lápida lógica) y propaga ese borrado al otro dispositivo en el siguiente sync. Tras 30 días, el tombstone se purga automáticamente.',
      },
    ],
  },
  {
    title: 'Drive y sincronización',
    icon: 'cloud_sync',
    items: [
      {
        q: '¿Necesito conectar Drive para usar Cadencia?',
        a: 'No. Cadencia funciona 100% sin Drive. Conectarlo es opcional y solo aporta una cosa: que tus ajustes, sesiones, calendario y listas viajen automáticamente entre tu móvil y tu ordenador.',
      },
      {
        q: '¿Dónde se guardan los datos en Drive? ¿Los puede ver alguien?',
        a: 'En una carpeta privada y oculta de tu propio Google Drive llamada «datos de aplicaciones» (técnicamente, el espacio drive.appdata). NO aparece en la vista normal de Drive: solo Cadencia, con tu permiso explícito, puede leerla y escribirla en tu cuenta. Nosotros no tenemos servidor — los datos viajan directos entre tu navegador y Google.',
      },
      {
        q: '¿Cuándo se sincroniza?',
        a: 'Cuando cambias algo en tus ajustes, sesiones o calendario, Cadencia espera 2 segundos y sube el cambio. Cuando vuelves a la pestaña tras tenerla en segundo plano, comprueba si hay cambios remotos y los descarga. Mientras la pestaña está activa, hace una comprobación ligera cada 30 segundos. Todo en segundo plano.',
      },
      {
        q: 'Edito en mi móvil y luego abro en mi ordenador, ¿qué pasa?',
        a: 'En cuanto abras la app en el ordenador y conectes Drive (si no está conectado), descargará tus datos del móvil y los aplicará. Si ya está conectado, en menos de 30 segundos los cambios aparecen automáticamente. Si has editado el mismo dato en los dos sitios sin tener uno de ellos online, gana la versión más reciente — Cadencia detecta colisiones y combina cambios por sección. Ejemplo: si en el móvil cambias tu peso y en el ordenador añades una sesión nueva, ambos cambios sobreviven.',
      },
      {
        q: '¿Cómo conecto Drive?',
        a: 'Mis preferencias → tarjeta «Sincronización entre dispositivos» → «Conectar mi Google Drive». Se abre una ventana emergente oficial de Google donde te pedirá autorizar a Cadencia el acceso a su carpeta privada (drive.appdata). Acepta y listo: la etiqueta cambia a «Sincronizado» y a partir de ese momento todos tus cambios se suben automáticamente.',
      },
      {
        q: '¿Cómo desconecto Drive?',
        a: 'Misma tarjeta, botón «Desconectar». Esto revoca el token y desactiva la sincronización. Tus datos en este navegador se conservan; tus datos en Drive también permanecen intactos. Para borrarlos también desde Drive, ve a https://drive.google.com/drive/u/0/settings → «Administrar aplicaciones» → «Cadencia» → «Eliminar datos ocultos de la aplicación».',
      },
      {
        q: '¿Cuánto espacio ocupa en mi Drive?',
        a: 'Casi nada. Tus ajustes, calendario y sesiones son un único archivo JSON pequeño. Las listas CSV propias suman 50-300 KB cada una. Aunque tengas docenas de sesiones y listas, no llegarías al medio mega. El espacio drive.appdata es independiente de tu cuota normal de Drive (15 GB gratuitos), así que no te roba sitio.',
      },
      {
        q: '¿Por qué un permiso tan pequeño? ¿No podría acceder a más cosas?',
        a: 'Es deliberado. Cadencia solo pide el permiso drive.appdata, que es el más restrictivo: limita el acceso a una carpeta oculta y exclusiva de la aplicación. NO podemos leer tus documentos, fotos, hojas de cálculo ni ningún otro archivo de tu Drive. Cuando autorizas, Google te lo deja bien claro en la ventana de consentimiento.',
      },
    ],
  },
  {
    title: 'Si tengo problemas',
    icon: 'help_outline',
    items: [
      {
        q: 'No tengo Client ID configurado en mi despliegue propio, ¿qué hago?',
        a: 'Si has clonado el repositorio y desplegado tu propia versión, necesitas configurar tu propio VITE_GOOGLE_CLIENT_ID en .env.local antes de compilar. Sin eso, la tarjeta de sincronización mostrará «no configurada» y todo lo demás funcionará igual. Las instrucciones están en .env.example o en el CLAUDE.md del repositorio.',
      },
      {
        q: 'He visto un error «redirect_uri_mismatch», ¿qué pasa?',
        a: 'Es la queja del OAuth de Google porque la URL desde la que abres Cadencia no está autorizada en el cliente OAuth. Si estás en desarrollo local, asegúrate de abrir http://127.0.0.1:5173/ (NO localhost). En producción, comprueba que cadencia.movimientofuncional.app esté añadido como «Authorized JavaScript origins» en https://console.cloud.google.com/apis/credentials.',
      },
      {
        q: '¿Cómo borro absolutamente todo lo que Cadencia tiene de mí?',
        a: 'Mis preferencias → «Zona de peligro» → «Borrar todos mis datos de Cadencia» borra todo lo guardado en este dispositivo (ajustes, sesiones, calendario, listas, descartes). Si tienes Drive conectado, los datos en tu Drive NO se borran automáticamente — son tuyos. Para limpiarlos también, sigue las instrucciones del bloque anterior («Cómo desconecto Drive»).',
      },
    ],
  },
];

export function SincronizarDriveArticle(): JSX.Element {
  return (
    <ArticleShell
      slug="sincronizar-drive"
      lead="Cadencia recuerda lo que tú decides que recuerde, donde tú decides. Aquí cómo se gestionan tus preferencias, tu calendario de entrenamientos y la sincronización opcional con Google Drive."
    >
      <Card
        variant="info"
        className="mb-6"
        title="Privacidad primero"
        titleIcon="shield"
      >
        <p className="text-sm text-gris-700 leading-relaxed">
          Cadencia no tiene servidor ni base de datos. Por defecto tus datos viven
          solo en la pestaña actual y se borran al cerrarla. Permanecen entre sesiones
          solo si activas <strong>«Recordar mis datos»</strong> en este dispositivo y
          viajan a otros dispositivos solo si conectas tu propio <strong>Google Drive</strong>{' '}
          — la carpeta <code>drive.appdata</code> es privada y exclusiva de Cadencia,
          invisible incluso para ti en la vista normal de Drive.
        </p>
      </Card>

      <Card title="Cómo activar la sincronización con Drive" titleIcon="cloud_sync">
        <ol className="list-decimal list-inside space-y-2 text-sm text-gris-700 leading-relaxed">
          <li>
            Abre Cadencia y entra a <strong>«Mis preferencias»</strong> (icono de la
            cabecera del asistente o desde el pie de página).
          </li>
          <li>
            Localiza la tarjeta <strong>«Sincronización entre dispositivos»</strong>.
          </li>
          <li>
            Pulsa <strong>«Conectar mi Google Drive»</strong>. Google abrirá una
            ventana emergente oficial.
          </li>
          <li>
            Acepta el permiso <code>drive.appdata</code> (acceso solo a la carpeta
            privada de la aplicación, no al resto de tu Drive).
          </li>
          <li>
            La etiqueta cambia a <strong>«Sincronizado»</strong>. A partir de ahora,
            todo se sincroniza automáticamente en segundo plano.
          </li>
        </ol>
      </Card>

      <Card title="Cómo desconectar o borrar" titleIcon="cloud_off" className="mt-4">
        <p className="text-sm text-gris-700 leading-relaxed mb-2">
          Para desactivar la sincronización: misma tarjeta, botón{' '}
          <strong>«Desconectar»</strong>. Tus datos locales y los de Drive se
          conservan — solo se desactiva el flujo.
        </p>
        <p className="text-sm text-gris-700 leading-relaxed mb-2">
          Para borrar completamente los datos en Drive:
        </p>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gris-700 leading-relaxed">
          <li>
            Ve a{' '}
            <a
              href="https://drive.google.com/drive/u/0/settings"
              target="_blank"
              rel="noopener noreferrer"
              className="text-turquesa-600 hover:underline"
            >
              drive.google.com → Configuración
            </a>
            .
          </li>
          <li>
            Pestaña <strong>«Administrar aplicaciones»</strong>.
          </li>
          <li>
            Busca <strong>«Cadencia»</strong> en la lista.
          </li>
          <li>
            <strong>«Opciones» → «Eliminar datos ocultos de la aplicación»</strong>
            .
          </li>
        </ol>
      </Card>

      <h2 className="font-display text-xl md:text-2xl text-gris-900 mt-8 mb-3 flex items-center gap-2">
        <MaterialIcon name="help_outline" size="small" className="text-turquesa-600" />
        Preguntas frecuentes
      </h2>

      <div className="space-y-6">
        {FAQ_GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="font-display text-lg text-gris-900 mb-2 flex items-center gap-2">
              <MaterialIcon name={group.icon} size="small" className="text-turquesa-600" />
              {group.title}
            </h3>
            <div className="space-y-2">
              {group.items.map((item, i) => (
                <details
                  key={i}
                  className="group rounded-xl border border-gris-200 bg-white p-4 hover:border-turquesa-400 transition-colors"
                >
                  <summary className="cursor-pointer list-none font-semibold text-gris-800 flex items-start gap-2">
                    <span
                      className="text-turquesa-600 mt-0.5 group-open:rotate-90 transition-transform"
                      aria-hidden
                    >
                      ▶
                    </span>
                    <span className="flex-1">{item.q}</span>
                  </summary>
                  <p className="mt-3 ml-6 text-sm text-gris-700 leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </ArticleShell>
  );
}
