import {
  EMPTY_USER_INPUTS,
  type BikeType,
  type BiologicalSex,
  type Sport,
  type UserInputsRaw,
} from '@core/user';

/**
 * Reducer del state del usuario, sacado a fichero compartido para que tanto
 * App.tsx (que lifta el state y persiste) como UserDataStep (que dispatchea
 * desde los inputs) usen exactamente el mismo contrato.
 */
type NumericField =
  | 'weightKg'
  | 'ftpWatts'
  | 'maxHeartRate'
  | 'restingHeartRate'
  | 'birthYear'
  | 'bikeWeightKg';

export type UserInputsAction =
  | { type: 'SET_NUMBER'; field: NumericField; value: number | null }
  | { type: 'SET_BIKE_TYPE'; value: BikeType | null }
  | { type: 'SET_SEX'; value: BiologicalSex | null }
  | { type: 'SET_SPORT'; value: Sport }
  | { type: 'HYDRATE'; value: UserInputsRaw }
  | { type: 'RESET' };

export function userInputsReducer(
  state: UserInputsRaw,
  action: UserInputsAction,
): UserInputsRaw {
  switch (action.type) {
    case 'SET_NUMBER':
      return { ...state, [action.field]: action.value };
    case 'SET_BIKE_TYPE':
      return { ...state, bikeType: action.value };
    case 'SET_SEX':
      return { ...state, sex: action.value };
    case 'SET_SPORT':
      return { ...state, sport: action.value };
    case 'HYDRATE':
      // Reemplaza el state entero. Usado cuando el pull de Drive aplica
      // datos remotos al cadenciaStore: el reducer (inicializado una sola
      // vez al montar App.tsx) debe rehidratarse para que la UI refleje
      // los inputs sincronizados desde otro dispositivo.
      return action.value;
    case 'RESET':
      return EMPTY_USER_INPUTS;
  }
}
