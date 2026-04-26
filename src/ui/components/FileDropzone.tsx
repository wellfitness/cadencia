import { useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { MaterialIcon } from './MaterialIcon';

export interface FileDropzoneProps {
  /** Called when the user drops or selects a single file. */
  onFile: (file: File) => void;
  /** Called when the user drops something invalid (multiple files, wrong extension). */
  onError?: (message: string) => void;
  /** Comma-separated MIME types and extensions accepted. */
  accept?: string;
  /** Pretty extension list shown in the UI ("GPX"). */
  acceptedLabel?: string;
  /** Disable interactions (during processing, etc). */
  disabled?: boolean;
}

const DEFAULT_ACCEPT = '.gpx,application/gpx+xml,application/xml,text/xml';

/**
 * Drag & drop con fallback de input file. Mobile-first y accesible:
 * - Touch target del label >= 48px.
 * - aria-live announce del estado de drag.
 * - Focus visible global del :focus-visible aplica al input.
 */
export function FileDropzone({
  onFile,
  onError,
  accept = DEFAULT_ACCEPT,
  acceptedLabel = 'GPX',
  disabled = false,
}: FileDropzoneProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const reactId = useId();
  const inputId = `file-${reactId}`;
  const liveId = `${inputId}-live`;

  const handleFiles = (files: FileList | null): void => {
    if (!files || files.length === 0) return;
    if (files.length > 1) {
      onError?.('Solo se puede subir un archivo a la vez.');
      return;
    }
    const file = files[0];
    if (!file) return;
    const expectedExt = `.${acceptedLabel.toLowerCase()}`;
    if (!file.name.toLowerCase().endsWith(expectedExt)) {
      onError?.(`El archivo debe tener extensión ${expectedExt}`);
      return;
    }
    onFile(file);
  };

  const handleDragEnter = (e: DragEvent<HTMLLabelElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  };
  const handleDragOver = (e: DragEvent<HTMLLabelElement>): void => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDragLeave = (e: DragEvent<HTMLLabelElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };
  const handleDrop = (e: DragEvent<HTMLLabelElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
    handleFiles(e.target.files);
    // Reset para que volver a subir el mismo archivo dispare onChange
    if (inputRef.current) inputRef.current.value = '';
  };

  const baseClasses =
    'flex flex-col items-center justify-center gap-3 w-full rounded-xl border-2 border-dashed px-6 py-10 md:py-14 transition-colors duration-200 cursor-pointer text-center';
  const stateClasses = disabled
    ? 'border-gris-200 bg-gris-50 cursor-not-allowed opacity-60'
    : isDragOver
      ? 'border-turquesa-600 bg-turquesa-50'
      : 'border-gris-300 bg-white hover:border-turquesa-400 hover:bg-turquesa-50/40';

  return (
    <div className="w-full">
      <label
        htmlFor={inputId}
        className={`${baseClasses} ${stateClasses}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <MaterialIcon
          name={isDragOver ? 'file_download' : 'cloud_upload'}
          size="xlarge"
          className={isDragOver ? 'text-turquesa-700' : 'text-turquesa-600'}
        />
        <div className="space-y-1">
          <p className="text-base md:text-lg font-semibold text-gris-800">
            {isDragOver
              ? 'Suelta tu archivo aquí'
              : `Arrastra tu ${acceptedLabel} o pulsa para elegir`}
          </p>
          <p className="text-sm text-gris-500">
            Solo {acceptedLabel}. Tu archivo no sale de tu dispositivo.
          </p>
        </div>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={handleInputChange}
          disabled={disabled}
        />
      </label>
      <span id={liveId} className="sr-only" aria-live="polite">
        {isDragOver ? 'Archivo a punto de soltarse' : ''}
      </span>
    </div>
  );
}
