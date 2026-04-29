import { ArticleShell } from '@ui/components/help/ArticleShell';
import { Card } from '@ui/components/Card';
import { MaterialIcon } from '@ui/components/MaterialIcon';

interface FaqItem {
  q: string;
  a: string;
}

const FAQS: readonly FaqItem[] = [
  {
    q: '¿Necesito conectar Drive para usar Cadencia?',
    a: 'No. Cadencia funciona 100% sin Drive. Conectarlo es opcional y solo aporta una cosa: que tus ajustes (peso, FC, FTP, géneros musicales preferidos) y tus sesiones guardadas viajen entre tu móvil y tu ordenador automáticamente.',
  },
  {
    q: '¿Qué se sincroniza exactamente?',
    a: 'Solo tres cosas: (1) tus inputs fisiológicos: peso, FTP, FC máxima, FC reposo, año de nacimiento, sexo biológico, tipo y peso de bici. (2) Tus preferencias musicales: géneros favoritos, semilla de aleatorización, opción "Todo con energía". (3) Las sesiones que has guardado con un nombre desde el constructor de sesiones (botón "Guardar como mi sesión"). Nada más: ni tus rutas GPX, ni las playlists generadas, ni nada que envíes a Spotify.',
  },
  {
    q: '¿Dónde se guardan los datos? ¿Los puede ver alguien?',
    a: 'En una carpeta privada y oculta de tu propio Google Drive llamada "datos de aplicaciones" (technicalmente, el espacio drive.appdata). Esta carpeta NO aparece en la UI normal de Drive: solo Cadencia con tu permiso explícito puede leerla y escribirla, y solo en tu cuenta. Nosotros no tenemos servidor — los datos viajan directos entre tu navegador y Google.',
  },
  {
    q: '¿Cómo conecto Drive?',
    a: 'En el paso "Datos" del wizard, busca la tarjeta "Sincronizar con Google Drive" y pulsa "Conectar mi Google Drive". Se abrirá un popup oficial de Google donde te pedirá autorizar a Cadencia el acceso a su carpeta privada (drive.appdata). Acepta y listo: el badge cambia a "Sincronizado" y a partir de ese momento todos tus cambios se subirán automáticamente.',
  },
  {
    q: '¿Cuándo se sincroniza?',
    a: 'Cuando cambias algo en tus ajustes o sesiones, la app espera 2 segundos y sube el cambio. Cuando vuelves a la pestaña tras tenerla en segundo plano, comprueba si hay cambios remotos y los descarga. Mientras la pestaña está activa, hace una comprobación ligera cada 30 segundos. Puedes seguir trabajando sin notar nada — todo en segundo plano.',
  },
  {
    q: 'Edito en mi móvil y luego abro en mi ordenador, ¿qué pasa?',
    a: 'En cuanto abras la app en el ordenador y conectes Drive (si no está conectado), descargará tus datos del móvil y los aplicará. Si lo abres con Drive ya conectado, en menos de 30 segundos los cambios del móvil aparecen automáticamente. Si has editado el mismo dato en los dos sitios sin tener uno de ellos online, gana la versión más reciente — Cadencia detecta colisiones y combina los cambios por sección (ej: si en el móvil cambias tu peso y en el ordenador añades una sesión nueva, ambos cambios sobreviven).',
  },
  {
    q: '¿Cómo desconecto Drive?',
    a: 'En la misma tarjeta "Sincronizar con Google Drive", pulsa "Desconectar". Esto revoca el token y desactiva la sincronización. Tus datos en este navegador se conservan; tus datos en Drive también permanecen intactos. Si quieres borrar también los datos de Drive, ve a https://drive.google.com/drive/u/0/settings → "Administrar aplicaciones" → "Cadencia" → "Eliminar datos ocultos de la aplicación".',
  },
  {
    q: '¿Por qué un permiso tan pequeño? ¿No podría acceder a más cosas?',
    a: 'Es deliberado. Cadencia solo pide el scope drive.appdata, que es el más restrictivo: limita el acceso a una carpeta oculta y exclusiva de la app. NO podemos leer tus documentos, fotos, hojas de cálculo ni ningún otro archivo de tu Drive. Cuando autorizas, Google te lo deja bien claro en el popup.',
  },
  {
    q: '¿Cuánto espacio ocupa en mi Drive?',
    a: 'Casi nada — pocos KB. Tus ajustes son un único archivo JSON pequeño. Aunque guardases cientos de sesiones, no llegarías al medio mega. Y el espacio drive.appdata es independiente de tu cuota normal de Drive (15 GB gratuitos), así que no te roba sitio.',
  },
  {
    q: 'Si borro una sesión guardada en un dispositivo, ¿desaparece del otro?',
    a: 'Sí. Cuando borras, Cadencia marca la sesión como "tombstone" (lápida lógica) y propaga ese borrado al otro dispositivo en el siguiente sync. Tras 30 días, el tombstone se purga automáticamente. Si reconectas un dispositivo viejo después de eso, podría reaparecer brevemente — pero el siguiente sync lo borrará otra vez.',
  },
  {
    q: 'No tengo Client ID configurado en mi despliegue self-hosted, ¿qué hago?',
    a: 'Si has clonado el repo y desplegado tu propia versión, necesitas configurar tu propio VITE_GOOGLE_CLIENT_ID en .env.local antes de compilar. Sin eso, la tarjeta de sincronización mostrará "no configurada" y todo lo demás funcionará igual. Las instrucciones están en .env.example o en el CLAUDE.md del repo.',
  },
  {
    q: 'He visto un error "redirect_uri_mismatch", ¿qué pasa?',
    a: 'Es la queja del OAuth de Google porque la URL desde la que abres Cadencia no está autorizada en el cliente OAuth. Si estás en desarrollo local, asegúrate de abrir http://127.0.0.1:5173/ (NO localhost). En producción, comprueba que cadencia.movimientofuncional.app esté añadido como "Authorized JavaScript origins" en https://console.cloud.google.com/apis/credentials.',
  },
];

export function SincronizarDriveArticle(): JSX.Element {
  return (
    <ArticleShell
      slug="sincronizar-drive"
      lead="Cadencia puede sincronizar tus ajustes y sesiones guardadas entre dispositivos usando Google Drive — opcional, privado, gratis. Aquí cómo y por qué."
    >
      <Card
        variant="info"
        className="mb-6"
        title="Privacidad primero"
        titleIcon="shield"
      >
        <p className="text-sm text-gris-700 leading-relaxed">
          La sincronización con Drive es <strong>100% opcional</strong>. Cadencia
          funciona idéntica sin ella. Si decides activarla, tus datos viajan a una
          carpeta privada y oculta de tu propio Drive — invisible para ti en la UI
          normal de Drive y, por descontado, para nosotros (no tenemos servidor).
        </p>
      </Card>

      <Card title="Cómo activar la sincronización" titleIcon="cloud_sync">
        <ol className="list-decimal list-inside space-y-2 text-sm text-gris-700 leading-relaxed">
          <li>Abre Cadencia y avanza al paso 1 (Datos).</li>
          <li>
            Localiza la tarjeta <strong>"Sincronizar con Google Drive"</strong> al
            final del formulario.
          </li>
          <li>
            Pulsa <strong>"Conectar mi Google Drive"</strong>. Google abrirá un
            popup oficial.
          </li>
          <li>
            Acepta el permiso <code>drive.appdata</code> (acceso solo a la carpeta
            privada de la app, no al resto de tu Drive).
          </li>
          <li>
            El badge cambia a <strong>"Sincronizado"</strong>. A partir de ahora,
            todo se sincroniza automáticamente en segundo plano.
          </li>
        </ol>
      </Card>

      <Card title="Cómo desconectar o borrar" titleIcon="cloud_off" className="mt-4">
        <p className="text-sm text-gris-700 leading-relaxed mb-2">
          Para desactivar la sincronización: misma tarjeta, botón{' '}
          <strong>"Desconectar"</strong>. Tus datos locales y los de Drive se
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
            Pestaña <strong>"Administrar aplicaciones"</strong>.
          </li>
          <li>
            Busca <strong>"Cadencia"</strong> en la lista.
          </li>
          <li>
            <strong>"Opciones" → "Eliminar datos ocultos de la aplicación"</strong>
            .
          </li>
        </ol>
      </Card>

      <h2 className="font-display text-xl md:text-2xl text-gris-900 mt-8 mb-3 flex items-center gap-2">
        <MaterialIcon name="help_outline" size="small" className="text-turquesa-600" />
        Preguntas frecuentes
      </h2>
      <div className="space-y-2">
        {FAQS.map((item, i) => (
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
    </ArticleShell>
  );
}
