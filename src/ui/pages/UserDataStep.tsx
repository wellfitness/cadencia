import { useState, type Dispatch } from 'react';
import {
  type UserInputsRaw,
  type ValidationResult,
} from '@core/user';
import { Button } from '@ui/components/Button';
import { UserDataForm } from '@ui/components/UserDataForm';
import type { UserInputsAction } from '@ui/state/userInputsReducer';

export interface UserDataStepProps {
  inputs: UserInputsRaw;
  dispatch: Dispatch<UserInputsAction>;
  validation: ValidationResult;
  currentYear: number;
  onNext: () => void;
}

export function UserDataStep({
  inputs,
  dispatch,
  validation,
  currentYear,
  onNext,
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

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-4 md:py-8 space-y-3 md:space-y-4 pb-32 md:pb-10">
      <UserDataForm
        inputs={inputs}
        dispatch={dispatch}
        validation={validation}
        currentYear={currentYear}
        showAllErrors={showAllErrors}
      />

      <FooterActions
        submitDisabled={submitDisabled}
        onCancel={handleCancel}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

interface FooterActionsProps {
  submitDisabled: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

function FooterActions({ submitDisabled, onCancel, onSubmit }: FooterActionsProps): JSX.Element {
  return (
    <>
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gris-200 px-4 py-3 flex items-center justify-between gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
        <Button variant="secondary" onClick={onCancel} aria-label="Cancelar y limpiar datos">
          Limpiar
        </Button>
        <Button
          variant="primary"
          iconRight="arrow_forward"
          disabled={submitDisabled}
          onClick={onSubmit}
          fullWidth
        >
          Siguiente: Ruta
        </Button>
      </div>
      <div className="hidden md:flex items-center justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={onCancel}>
          Limpiar
        </Button>
        <Button
          variant="primary"
          iconRight="arrow_forward"
          disabled={submitDisabled}
          onClick={onSubmit}
        >
          Siguiente: Ruta
        </Button>
      </div>
    </>
  );
}
