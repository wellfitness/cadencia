import type { Dispatch } from 'react';
import type { UserInputsRaw, ValidationResult } from '@core/user';
import { MaterialIcon } from './MaterialIcon';
import { UserDataForm } from './UserDataForm';
import type { UserInputsAction } from '@ui/state/userInputsReducer';

export interface EditDataPanelProps {
  inputs: UserInputsRaw;
  dispatch: Dispatch<UserInputsAction>;
  validation: ValidationResult;
  currentYear: number;
  /** Cerrado por defecto. La pantalla padre puede pasar `defaultOpen` segun necesite. */
  defaultOpen?: boolean;
  /** 'gpx' (default) o 'session'. Pasa al UserDataForm para condicionar campos. */
  mode?: 'gpx' | 'session';
  /** 'bike' (default) o 'run'. En run se ocultan bici y FTP del formulario. */
  sport?: 'bike' | 'run';
}

/**
 * Panel plegable "Ajustar mis datos" que envuelve un UserDataForm.
 * Cuando el usuario edita inputs aqui, el componente padre (ResultStep)
 * recibe el cambio via dispatch y recalcula matching automaticamente.
 *
 * Patron: edit-in-place. El usuario refina su perfil sin perder el
 * contexto de la pantalla Resultado.
 */
export function EditDataPanel({
  inputs,
  dispatch,
  validation,
  currentYear,
  defaultOpen = false,
  mode = 'gpx',
  sport = 'bike',
}: EditDataPanelProps): JSX.Element {
  const blurb =
    sport === 'run'
      ? 'Cambia tu FC si quieres recalcular las zonas. La lista se actualiza al instante.'
      : 'Cambia tu peso, FC o tipo de bici si quieres recalcular las zonas. La lista se actualiza al instante.';
  return (
    <details
      className="group rounded-xl border border-gris-200 bg-white p-3 md:p-5 open:border-turquesa-300"
      {...(defaultOpen ? { open: true } : {})}
    >
      <summary className="flex cursor-pointer items-center gap-2 text-base md:text-lg font-semibold text-gris-800 select-none min-h-[44px]">
        <MaterialIcon name="tune" size="small" className="text-turquesa-600" />
        Ajustar mis datos
        <MaterialIcon
          name="expand_more"
          size="small"
          className="ml-auto text-gris-500 transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className="mt-3 pt-3 border-t border-gris-100">
        <p className="text-sm text-gris-600 mb-3">{blurb}</p>
        <UserDataForm
          inputs={inputs}
          dispatch={dispatch}
          validation={validation}
          currentYear={currentYear}
          mode={mode}
          sport={sport}
        />
      </div>
    </details>
  );
}
