import { useState, type Dispatch } from 'react';
import {
  type UserInputsRaw,
  type ValidationResult,
} from '@core/user';
import { Button } from '@ui/components/Button';
import { UserDataForm } from '@ui/components/UserDataForm';
import { WizardStepFooter } from '@ui/components/WizardStepFooter';
import { WizardStepHeading } from '@ui/components/WizardStepHeading';
import type { UserInputsAction } from '@ui/state/userInputsReducer';

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

  const handleCancel = (): void => {
    dispatch({ type: 'RESET' });
    setShowAllErrors(false);
  };

  const handleSubmit = (): void => {
    if (validation.ok) {
      onNext();
    } else {
      setShowAllErrors(true);
    }
  };

  const submitDisabled = !validation.ok;
  const nextLabel = mode === 'session' ? 'Siguiente: Sesión' : 'Siguiente: Ruta';

  const subtitle =
    mode === 'session'
      ? 'Solo lo imprescindible para calcular tus zonas de intensidad.'
      : 'Necesitamos tu peso y, si lo conoces, tu FTP o frecuencia cardíaca.';

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-4 md:py-8 space-y-3 md:space-y-4 pb-32 md:pb-10">
      <WizardStepHeading title="Tus datos" subtitle={subtitle} />
      <UserDataForm
        inputs={inputs}
        dispatch={dispatch}
        validation={validation}
        currentYear={currentYear}
        showAllErrors={showAllErrors}
        mode={mode}
      />

      <FooterActions
        submitDisabled={submitDisabled}
        onCancel={handleCancel}
        onSubmit={handleSubmit}
        onBack={onBack}
        nextLabel={nextLabel}
      />
    </div>
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
          <Button variant="secondary" onClick={onCancel} aria-label="Limpiar datos">
            Limpiar
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
