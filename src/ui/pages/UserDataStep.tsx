import { useMemo, useRef, useState, type Dispatch } from 'react';
import {
  type UserInputsRaw,
  type ValidationResult,
} from '@core/user';
import { Button } from '@ui/components/Button';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { UserDataForm, type UserDataFormHandle } from '@ui/components/UserDataForm';
import { WizardStep } from '@ui/components/WizardStep';
import { WizardStepFooter } from '@ui/components/WizardStepFooter';
import { WizardStepHeading } from '@ui/components/WizardStepHeading';
import type { UserInputsAction } from '@ui/state/userInputsReducer';
import { buildErrorSummary } from './userDataErrorSummary';

export interface UserDataStepProps {
  inputs: UserInputsRaw;
  dispatch: Dispatch<UserInputsAction>;
  validation: ValidationResult;
  currentYear: number;
  onBack: () => void;
  onNext: () => void;
  /** 'gpx' (default) o 'session' (sesion indoor: peso/bici se ocultan). */
  mode?: 'gpx' | 'session';
}

export function UserDataStep({
  inputs,
  dispatch,
  validation,
  currentYear,
  onBack,
  onNext,
  mode = 'gpx',
}: UserDataStepProps): JSX.Element {
  // Para mostrar errores de "campo vacio" solo despues de un intento de submit
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const formRef = useRef<UserDataFormHandle>(null);

  const handleCancelClick = (): void => {
    setConfirmOpen(true);
  };
  const handleConfirmReset = (): void => {
    dispatch({ type: 'RESET' });
    setShowAllErrors(false);
    setConfirmOpen(false);
  };
  const handleCancelReset = (): void => {
    setConfirmOpen(false);
  };

  const handleSubmit = (): void => {
    if (validation.ok) {
      onNext();
    } else {
      setShowAllErrors(true);
      // Foco al primer error tras render (rAF asegura que el formulario ha
      // re-renderizado y los inputs reflejan el aria-invalid actualizado).
      requestAnimationFrame(() => {
        formRef.current?.focusFirstError();
      });
    }
  };

  const submitDisabled = !validation.ok;
  const nextLabel = 'Siguiente: Plan';

  // P3: copy reescrito.
  const subtitle =
    mode === 'session'
      ? 'Necesitamos tu FC máxima — o tu año de nacimiento y sexo, y la estimamos. Con eso te guiamos en pulsaciones y vatios durante el modo TV.'
      : 'Necesitamos tu peso. Para tus zonas vale tu FC, tu FTP o tu año de nacimiento — lo que tengas.';

  // Resumen de errores para aria-live (P2). Solo se calcula cuando hay errores
  // visibles tras intento de submit.
  const errorSummary = useMemo(() => {
    if (validation.ok || !showAllErrors) return '';
    return buildErrorSummary(validation.errors);
  }, [validation, showAllErrors]);

  // Banner "Ya puedes avanzar" (P6): visible cuando la validacion pasa.
  const showReadyBanner = validation.ok;

  return (
    <WizardStep>
      <WizardStepHeading title="Tus datos" subtitle={subtitle} />

      {/* P2: anuncio aria-live de errores agregados tras intento de submit. */}
      {showAllErrors && !validation.ok && errorSummary !== '' && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-lg border-2 border-rosa-600 bg-rosa-100/60 px-3 py-2.5 text-sm text-rosa-700 font-medium flex items-center gap-2"
        >
          <MaterialIcon name="error_outline" size="small" className="text-rosa-600" />
          <span>
            {errorSummary}{' '}
            <span className="font-normal text-rosa-700/80">
              Te llevamos al primer campo que falta.
            </span>
          </span>
        </div>
      )}

      <UserDataForm
        ref={formRef}
        inputs={inputs}
        dispatch={dispatch}
        validation={validation}
        currentYear={currentYear}
        showAllErrors={showAllErrors}
        mode={mode}
      />

      {/* P6: confirmacion discreta cuando la validacion pasa. */}
      {showReadyBanner && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg bg-turquesa-50 border border-turquesa-200 px-3 py-2 text-sm text-turquesa-800 motion-safe:animate-fade-in"
        >
          <MaterialIcon name="check_circle" size="small" className="text-turquesa-600" />
          <span className="font-semibold">Listo, ya puedes continuar.</span>
        </div>
      )}

      <div className="flex justify-center md:hidden pt-1">
        <button
          type="button"
          onClick={handleCancelClick}
          className="text-sm text-gris-500 hover:text-rosa-600 underline-offset-2 hover:underline transition-colors min-h-[36px] inline-flex items-center gap-1"
        >
          <MaterialIcon name="restart_alt" size="small" />
          Borrar todos mis datos
        </button>
      </div>

      <FooterActions
        submitDisabled={submitDisabled}
        onCancel={handleCancelClick}
        onSubmit={handleSubmit}
        onBack={onBack}
        nextLabel={nextLabel}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="¿Borrar todos tus datos?"
        message={
          <p>
            Esta acción no se puede deshacer. Perderás peso, FC, FTP y todo lo que hayas
            introducido.
          </p>
        }
        icon="warning"
        confirmLabel="Limpiar todo"
        cancelLabel="Cancelar"
        confirmVariant="critical"
        onConfirm={handleConfirmReset}
        onCancel={handleCancelReset}
      />
    </WizardStep>
  );
}

interface FooterActionsProps {
  submitDisabled: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  onBack: () => void;
  nextLabel: string;
}

function FooterActions({
  submitDisabled,
  onCancel,
  onSubmit,
  onBack,
  nextLabel,
}: FooterActionsProps): JSX.Element {
  return (
    <WizardStepFooter
      mobile={
        <>
          <Button variant="secondary" iconLeft="arrow_back" onClick={onBack}>
            Atrás
          </Button>
          <Button
            variant="primary"
            iconRight="arrow_forward"
            disabled={submitDisabled}
            onClick={onSubmit}
            fullWidth
          >
            {nextLabel}
          </Button>
        </>
      }
      desktop={
        <div className="flex items-center justify-between gap-3 w-full">
          <Button variant="secondary" iconLeft="arrow_back" onClick={onBack}>
            Atrás
          </Button>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={onCancel}>
              Limpiar
            </Button>
            <Button
              variant="primary"
              iconRight="arrow_forward"
              disabled={submitDisabled}
              onClick={onSubmit}
            >
              {nextLabel}
            </Button>
          </div>
        </div>
      }
    />
  );
}
