import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './Button';
import { MaterialIcon } from './MaterialIcon';
import { getRedirectUri } from '@integrations/spotify/redirectUri';
import {
  isValidClientIdFormat,
  setStoredClientId,
} from '@integrations/spotify/clientId';

export interface ByocTutorialDialogProps {
  /** Si el modal esta abierto. */
  open: boolean;
  /** Cierra el modal sin guardar nada (Esc, click fuera, boton Cancelar). */
  onClose: () => void;
  /**
   * Se invoca despues de validar y persistir el Client ID custom. El caller
   * puede aprovecharlo para reintentar el flujo OAuth que disparo el modal
   * (por ejemplo, "Crear playlist" en ResultStep). El id viene normalizado
   * a lowercase.
   */
  onSaved?: (clientId: string) => void;
}

const TOTAL_STEPS = 5;

/**
 * Modal BYOC ("Bring Your Own Client ID"): wizard de 4 pantallas que guia al
 * usuario para crear su propia app de Spotify (gratis, ~3 min) y pegar aqui
 * el Client ID resultante.
 *
 * Por que existe: Spotify endurecio Extended Quota Mode el 15-mayo-2025 y
 * Development Mode quedo limitado a 5 testers por Client ID. La unica via de
 * uso publico para apps indie es BYOC: cada usuario es dueno de su propia
 * cuota usando su propio Client ID.
 *
 * Por que wizard y no single-page con scroll:
 * - Las capturas anotadas son lo critico del tutorial (public/byoc/*.png) y
 *   en single-page quedaban como thumbnails ilegibles. Aqui ocupan todo el
 *   ancho del modal.
 * - El usuario se concentra en un solo paso a la vez sin saltarse texto.
 * - El progreso visual ("Paso 2 de 4") da sensacion de avance y baja la
 *   fricción cognitiva.
 *
 * UX:
 * - Step 0: introduccion + boton "Empezar".
 * - Steps 1-3: captura grande arriba, texto debajo, Atras/Siguiente abajo.
 * - Step 3: input con validacion inline (32 chars hex) + "Guardar y continuar".
 * - "Copiar Redirect URI" lleva al portapapeles la URL EXACTA que el usuario
 *   debe pegar en el dashboard. Reduce errores de tipeo.
 */
export function ByocTutorialDialog({
  open,
  onClose,
  onSaved,
}: ByocTutorialDialogProps): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<number>(0);
  const [value, setValue] = useState<string>('');
  const [touched, setTouched] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  // Lightbox: cuando el usuario pulsa una captura del tutorial, la guardamos
  // aqui para mostrarla a pantalla completa en un overlay separado del modal.
  // null = sin lightbox abierto.
  const [zoomed, setZoomed] = useState<{ src: string; alt: string } | null>(null);

  // Redirect URI DINAMICO segun el origin actual: en cadencia.movimientofuncional.app
  // sera "https://cadencia.movimientofuncional.app/callback", en self-host sera el
  // dominio del operador, en dev sera "http://127.0.0.1:5173/callback". El usuario
  // tiene que pegar esta URL EXACTA en el dashboard de Spotify, asi que NO puede
  // estar hardcodeada o se rompe el OAuth en cualquier deploy distinto del nuestro.
  const redirectUri = useMemo(() => getRedirectUri(), []);

  const trimmed = value.trim();
  const isValid = useMemo(() => isValidClientIdFormat(trimmed), [trimmed]);
  const showError = touched && trimmed.length > 0 && !isValid;

  // Sincroniza prop `open` con showModal/close del dialog nativo.
  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (open && !node.open) {
      node.showModal();
    } else if (!open && node.open) {
      node.close();
    }
  }, [open]);

  // Reset del estado cuando se cierra para que la proxima apertura empiece
  // siempre en el step 0 con el formulario limpio.
  useEffect(() => {
    if (!open) {
      setStep(0);
      setValue('');
      setTouched(false);
      setCopied(false);
      setStorageError(null);
      setZoomed(null);
    }
  }, [open]);

  // Esc cierra primero el lightbox si está abierto, luego el modal entero.
  // Sin esta capa el Esc del lightbox cerraría todo de golpe (perdería contexto).
  useEffect(() => {
    if (!open || zoomed === null) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setZoomed(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open, zoomed]);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    const handleCancel = (e: Event): void => {
      e.preventDefault();
      onClose();
    };
    node.addEventListener('cancel', handleCancel);
    return () => {
      node.removeEventListener('cancel', handleCancel);
    };
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>): void => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  const handleNext = (): void => {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
  };

  const handleBack = (): void => {
    if (step > 0) setStep(step - 1);
  };

  const handleSave = (): void => {
    setTouched(true);
    setStorageError(null);
    if (!isValid) return;
    try {
      setStoredClientId(trimmed);
    } catch (err) {
      setStorageError(
        err instanceof Error ? err.message : 'No se pudo guardar el Client ID.',
      );
      return;
    }
    onSaved?.(trimmed.toLowerCase());
    onClose();
  };

  const handleCopyRedirectUri = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(redirectUri);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback silencioso: el usuario puede seleccionar el texto y copiarlo
      // a mano. No mostramos error porque el caso es raro y no bloquea.
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      aria-labelledby="byoc-title"
      className="
        max-w-2xl w-[calc(100%-2rem)] p-0 rounded-2xl border-0
        backdrop:bg-gris-900/60 backdrop:backdrop-blur-sm
        text-gris-800 bg-white
        max-h-[calc(100vh-2rem)]
      "
    >
      <div className="flex flex-col max-h-[calc(100vh-2rem)]">
        <header className="relative px-6 md:px-8 pt-6 pb-4 border-b border-gris-100">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute top-3 right-3 w-10 h-10 inline-flex items-center justify-center rounded-full text-gris-500 hover:text-gris-800 hover:bg-gris-100 transition-colors"
          >
            <MaterialIcon name="close" />
          </button>

          <div className="flex items-center gap-3 pr-10">
            <span
              className="inline-flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full bg-turquesa-100 text-turquesa-600 shrink-0"
              aria-hidden
            >
              <MaterialIcon name="vpn_key" size="large" />
            </span>
            <div className="min-w-0">
              <h2
                id="byoc-title"
                className="font-display text-xl md:text-2xl text-gris-800 leading-tight"
              >
                Conecta tu Spotify a Cadencia
              </h2>
              <p className="text-xs text-gris-500 mt-1">
                Paso {step + 1} de {TOTAL_STEPS}
              </p>
            </div>
          </div>

          <ProgressBar current={step + 1} total={TOTAL_STEPS} />
        </header>

        <div className="flex-1 overflow-y-auto px-6 md:px-8 py-5">
          {step === 0 && <StepIntro />}
          {step === 1 && <StepCreateApp onZoom={setZoomed} />}
          {step === 2 && (
            <StepFillForm
              redirectUri={redirectUri}
              copied={copied}
              onCopy={() => {
                void handleCopyRedirectUri();
              }}
              onZoom={setZoomed}
            />
          )}
          {step === 3 && <StepAddTester onZoom={setZoomed} />}
          {step === 4 && (
            <StepCopyAndPasteClientId
              value={value}
              onChange={setValue}
              onBlur={() => setTouched(true)}
              showError={showError}
              storageError={storageError}
              onZoom={setZoomed}
            />
          )}
        </div>

        <footer className="px-6 md:px-8 py-4 border-t border-gris-100 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 bg-gris-50">
          <div className="flex gap-2">
            {step > 0 && (
              <Button
                variant="secondary"
                size="sm"
                iconLeft="arrow_back"
                onClick={handleBack}
              >
                Atrás
              </Button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gris-600 hover:text-gris-800 hover:bg-gris-100 px-3 py-1.5 rounded-md transition-colors min-h-[36px]"
            >
              Cancelar
            </button>
          </div>

          {step < TOTAL_STEPS - 1 ? (
            <Button
              variant="primary"
              iconRight="arrow_forward"
              onClick={handleNext}
            >
              {step === 0 ? 'Empezar' : 'Siguiente'}
            </Button>
          ) : (
            <Button
              variant="primary"
              iconLeft="check"
              onClick={handleSave}
              disabled={!isValid}
            >
              Guardar y continuar
            </Button>
          )}
        </footer>
      </div>

      {zoomed !== null && (
        <ImageLightbox
          src={zoomed.src}
          alt={zoomed.alt}
          onClose={() => setZoomed(null)}
        />
      )}
    </dialog>
  );
}

interface ImageLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

/**
 * Overlay full-screen para ampliar una captura del tutorial. Click en el
 * fondo, en el botón cerrar o tecla Esc cierra el lightbox sin afectar al
 * modal padre. Z-index alto para sobreponerse al `<dialog>` nativo.
 */
function ImageLightbox({ src, alt, onClose }: ImageLightboxProps): JSX.Element {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Captura ampliada: ${alt}`}
      onClick={onClose}
      className="fixed inset-0 z-[100] bg-gris-900/85 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Cerrar imagen ampliada"
        className="absolute top-4 right-4 w-12 h-12 inline-flex items-center justify-center rounded-full bg-white/90 text-gris-800 hover:bg-white shadow-lg transition-colors cursor-pointer"
      >
        <MaterialIcon name="close" size="medium" />
      </button>
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl cursor-default"
      />
    </div>
  );
}

interface ProgressBarProps {
  current: number;
  total: number;
}

function ProgressBar({ current, total }: ProgressBarProps): JSX.Element {
  const pct = (current / total) * 100;
  return (
    <div
      className="mt-4 h-1.5 bg-gris-100 rounded-full overflow-hidden"
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={total}
    >
      <div
        className="h-full bg-turquesa-600 transition-all duration-300 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function StepIntro(): JSX.Element {
  return (
    <div className="space-y-4 max-w-prose">
      <p className="text-base text-gris-700">
        Cadencia es una herramienta <strong>gratuita y con código fuente público</strong> que se conecta a tu
        Spotify usando un código gratuito que Spotify llama <strong>Client ID</strong>.
        Crearlo te lleva unos <strong>3 minutos</strong> y solo lo haces una vez en la
        vida.
      </p>
      <p className="text-base text-gris-700">
        Tú creas tu propia conexión con Spotify desde su web oficial. No nos das tu
        contraseña ni nos cedes acceso desde nuestra cuenta — Spotify se conecta
        directamente con tu navegador.
      </p>

      <div className="bg-turquesa-50 border-2 border-turquesa-200 rounded-lg p-4 space-y-2">
        <p className="text-sm font-semibold text-gris-800 flex items-center gap-2">
          <MaterialIcon name="checklist" size="small" className="text-turquesa-600" />
          Lo que necesitas
        </p>
        <ul className="text-sm text-gris-700 space-y-1 list-disc pl-5">
          <li>Una cuenta de Spotify Premium.</li>
          <li>3 minutos para crear tu app de Spotify.</li>
          <li>Pegar el Client ID resultante aquí abajo.</li>
        </ul>
      </div>

      <p className="text-xs text-gris-500">
        Te guiamos paso a paso con capturas. Pulsa <strong>«Empezar»</strong>
        cuando estés listo.
      </p>
    </div>
  );
}

interface StepImageZoomProp {
  onZoom: (img: { src: string; alt: string }) => void;
}

function StepCreateApp({ onZoom }: StepImageZoomProp): JSX.Element {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gris-800">
        Abre el dashboard y pulsa «Create app»
      </h3>
      <p className="text-sm text-gris-700 leading-relaxed">
        Ve a{' '}
        <a
          href="https://developer.spotify.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="text-turquesa-600 hover:text-turquesa-700 underline font-semibold"
        >
          developer.spotify.com/dashboard
        </a>{' '}
        y haz login con tu cuenta de Spotify Premium. Pulsa el botón{' '}
        <strong>Create app</strong> arriba a la derecha (resaltado en amarillo
        en la captura).
      </p>
      <StepImage
        src="/byoc/step-1-create-app.png"
        alt="Dashboard de Spotify con el botón Create app resaltado en amarillo"
        onZoom={onZoom}
      />
    </div>
  );
}

interface StepFillFormProps {
  redirectUri: string;
  copied: boolean;
  onCopy: () => void;
  onZoom: (img: { src: string; alt: string }) => void;
}

function StepFillForm({
  redirectUri,
  copied,
  onCopy,
  onZoom,
}: StepFillFormProps): JSX.Element {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gris-800">
        Rellena el formulario de la nueva app
      </h3>
      <ul className="text-sm text-gris-700 leading-relaxed space-y-3 list-disc pl-5">
        <li>
          <strong>App name</strong> (obligatorio): el que tú quieras, por
          ejemplo &laquo;Mi Cadencia&raquo;.
        </li>
        <li>
          <strong>App description</strong> (obligatorio): cualquier texto
          breve que describa para qué la usas, por ejemplo &laquo;App personal
          para usar Cadencia con mi cuenta de Spotify&raquo;.
        </li>
        <li>
          <strong>Redirect URI</strong>: pega exactamente la URL de abajo (es
          la dirección donde Spotify te devolverá tras autorizar).
          <div className="mt-2 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <code className="font-mono text-xs bg-gris-100 text-gris-800 px-3 py-2 rounded border border-gris-200 break-all flex-1">
              {redirectUri}
            </code>
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded border border-turquesa-300 text-turquesa-700 bg-turquesa-50 hover:bg-turquesa-100 transition-colors min-h-[40px]"
            >
              <MaterialIcon
                name={copied ? 'check' : 'content_copy'}
                size="small"
              />
              {copied ? 'Copiada' : 'Copiar'}
            </button>
          </div>
        </li>
        <li>
          Marca <strong>Web API</strong> en la lista de APIs.
        </li>
        <li>
          Acepta los términos y pulsa <strong>Save</strong>.
        </li>
      </ul>
      <StepImage
        src="/byoc/step-2-fill-form.png"
        alt="Formulario de creación de app con los campos rellenos: nombre, descripción, redirect URI y APIs marcadas"
        onZoom={onZoom}
      />
    </div>
  );
}

function StepAddTester({ onZoom }: StepImageZoomProp): JSX.Element {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gris-800">
        Añade tu cuenta como tester autorizado
      </h3>
      <p className="text-sm text-gris-700 leading-relaxed">
        Spotify limita tu app nueva a un máximo de <strong>5 cuentas</strong>{' '}
        autorizadas. Tienes que añadirte tú primero, si no Spotify rechazará
        la creación de la lista con un error «403 Forbidden».
      </p>
      <ol className="list-decimal pl-5 text-sm text-gris-700 leading-relaxed space-y-2">
        <li>
          En la página de tu app, abre la pestaña <strong>User Management</strong>{' '}
          (arriba, junto a «Basic Information»).
        </li>
        <li>
          Rellena <strong>Full Name</strong> con tu nombre y{' '}
          <strong>Email</strong> con el correo de tu cuenta de Spotify Premium
          (el mismo con el que harás login).
        </li>
        <li>
          Pulsa <strong>Add user</strong>. Tu nombre aparecerá en la tabla de
          abajo con un contador «1/5 added».
        </li>
      </ol>
      <div className="px-4 py-3 rounded-lg border-2 border-turquesa-200 bg-turquesa-50 text-sm text-gris-700 flex items-start gap-2">
        <MaterialIcon
          name="lightbulb"
          size="small"
          className="mt-0.5 shrink-0 text-turquesa-700"
        />
        <span>
          Si quieres permitir que otra persona use tu Client ID (por ejemplo
          tu pareja), añade su cuenta también aquí. Hasta 5 en total.
        </span>
      </div>
      <StepImage
        src="/byoc/step-4-user.png"
        alt="Pestaña User Management de la app con el formulario de Add user y la cuenta del propietario añadida"
        onZoom={onZoom}
      />
    </div>
  );
}

interface StepCopyAndPasteClientIdProps {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  showError: boolean;
  storageError: string | null;
  onZoom: (img: { src: string; alt: string }) => void;
}

function StepCopyAndPasteClientId({
  value,
  onChange,
  onBlur,
  showError,
  storageError,
  onZoom,
}: StepCopyAndPasteClientIdProps): JSX.Element {
  return (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-gris-800">
        Copia tu Client ID y pégalo aquí
      </h3>
      <p className="text-sm text-gris-700 leading-relaxed">
        Vuelve a la pestaña <strong>Basic Information</strong> de tu app. Ahí
        aparece un campo <strong>Client ID</strong> (32 caracteres
        hexadecimales). Cópialo y pégalo abajo. Cuando pulses{' '}
        <strong>Guardar y continuar</strong>, Cadencia conectará con tu
        Spotify y empezará a crear la lista.
      </p>

      <div className="space-y-2">
        <label
          htmlFor="byoc-client-id-input"
          className="block text-sm font-semibold text-gris-800"
        >
          Tu Client ID
        </label>
        <input
          id="byoc-client-id-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder="32 caracteres hexadecimales (0-9 y a-f)"
          autoComplete="off"
          spellCheck={false}
          autoFocus
          className={`
            w-full px-4 py-2.5 rounded-lg border-2 font-mono text-sm
            focus:outline-none focus:ring-2 focus:ring-turquesa-500/40
            ${
              showError
                ? 'border-rosa-400 focus:border-rosa-500'
                : 'border-gris-300 focus:border-turquesa-500'
            }
          `}
          aria-invalid={showError}
          aria-describedby={showError ? 'byoc-client-id-error' : undefined}
        />
        {showError && (
          <p
            id="byoc-client-id-error"
            className="text-xs text-rosa-600 flex items-center gap-1"
          >
            <MaterialIcon name="error_outline" size="small" />
            El Client ID debe ser 32 caracteres hexadecimales (digitos 0-9 y
            letras a-f).
          </p>
        )}
        <p className="text-xs text-gris-500">
          Se guarda en este navegador y no sale de aquí. Puedes cambiarlo o
          borrarlo desde &laquo;Mis preferencias&raquo;.
        </p>
      </div>

      {storageError !== null && (
        <div
          role="alert"
          className="px-4 py-3 rounded-lg border-2 border-rosa-300 bg-rosa-50 text-sm text-rosa-700 flex items-start gap-2"
        >
          <MaterialIcon
            name="error_outline"
            size="small"
            className="mt-0.5 shrink-0"
          />
          <span>{storageError}</span>
        </div>
      )}

      <StepImage
        src="/byoc/step-3-copy-id.png"
        alt="Página principal de la app con el Client ID resaltado en amarillo"
        onZoom={onZoom}
      />
    </div>
  );
}

interface StepImageProps {
  src: string;
  alt: string;
  onZoom: (img: { src: string; alt: string }) => void;
}

/**
 * Captura del tutorial pulsable. Al hacer click amplía a pantalla completa
 * via lightbox. Sin click sigue siendo legible al ancho del modal (el
 * texto de detalle del dashboard de Spotify NO es completamente legible a
 * este tamaño — el zoom es la vía para inspeccionar bien).
 */
function StepImage({ src, alt, onZoom }: StepImageProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onZoom({ src, alt })}
      aria-label={`Ampliar captura: ${alt}`}
      className="group block w-full relative cursor-zoom-in rounded-lg overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-turquesa-500"
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="w-full rounded-lg border border-gris-200 shadow-sm bg-gris-50 transition-transform group-hover:scale-[1.01]"
      />
      <span
        className="absolute top-2 right-2 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gris-900/70 text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        aria-hidden
      >
        <MaterialIcon name="zoom_in" size="small" />
      </span>
    </button>
  );
}
