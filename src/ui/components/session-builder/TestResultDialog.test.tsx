import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { TestProtocol } from '@core/segmentation';
import type { UserInputsRaw } from '@core/user/userInputs';
import { TestResultDialog } from './TestResultDialog';

/**
 * Tests del modal generico que dispara el `compute()` del testProtocol y
 * persiste el delta en cadenciaStore. Cubre:
 *  - render basico (titulo, inputs, citas DOI)
 *  - validacion en vivo: derived solo aparece con inputs validos
 *  - guardar invoca onSaved con el delta correcto
 *  - saltar invoca onSkipped sin escribir
 *  - inputs fuera de rango bloquean el guardado
 */

function makeProtocol(overrides?: Partial<TestProtocol>): TestProtocol {
  return {
    id: 'run-hrmax-daniels',
    inputs: [
      {
        id: 'peakHrBpm',
        label: 'FC máxima registrada (bpm)',
        unit: 'bpm',
        min: 100,
        max: 230,
      },
    ],
    compute: (inputs) => {
      const v = inputs.peakHrBpm;
      if (v === undefined) throw new Error('missing input');
      return {
        delta: { maxHeartRate: Math.round(v) },
        derived: [{ label: 'FCmáx', value: Math.round(v), unit: 'bpm' }],
      };
    },
    citationDois: ['10.1097/00005768-200111000-00008'],
    postTestNote: 'Tu FCmáx se actualizó.',
    ...overrides,
  };
}

const EMPTY_USER: UserInputsRaw = {
  weightKg: null,
  ftpWatts: null,
  maxHeartRate: null,
  restingHeartRate: null,
  birthYear: null,
  sex: null,
  bikeWeightKg: null,
  bikeType: null,
};

describe('TestResultDialog', () => {
  it('renderiza titulo, label del input y citas DOI', () => {
    render(
      <TestResultDialog
        templateName="Test FCmáx (Daniels)"
        testProtocol={makeProtocol()}
        user={EMPTY_USER}
        onSaved={() => {}}
        onSkipped={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { name: /resultado del test/i })).toBeInTheDocument();
    expect(screen.getByText(/test fcmáx/i)).toBeInTheDocument();
    expect(screen.getByText(/fc máxima registrada/i)).toBeInTheDocument();
    expect(screen.getByText(/10\.1097\/00005768-200111000-00008/)).toBeInTheDocument();
  });

  it('boton Guardar deshabilitado mientras los inputs estan vacios', () => {
    render(
      <TestResultDialog
        templateName="Daniels"
        testProtocol={makeProtocol()}
        user={EMPTY_USER}
        onSaved={() => {}}
        onSkipped={() => {}}
      />,
    );
    const save = screen.getByRole('button', { name: /guardar resultado/i });
    expect(save).toBeDisabled();
  });

  it('al introducir un input valido aparece el bloque "Tu resultado"', () => {
    render(
      <TestResultDialog
        templateName="Daniels"
        testProtocol={makeProtocol()}
        user={EMPTY_USER}
        onSaved={() => {}}
        onSkipped={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText(/fc máxima registrada/i), {
      target: { value: '192' },
    });
    // El bloque preview tiene un encabezado en mayusculas con tracking
    // distintivo. Buscamos el span exacto para evitar colision con el copy
    // descriptivo "para calcular tu resultado".
    expect(screen.getByText(/^tu resultado$/i)).toBeInTheDocument();
    expect(screen.getByText(/192 bpm/)).toBeInTheDocument();
  });

  it('input fuera de rango deja Guardar deshabilitado y muestra error', () => {
    render(
      <TestResultDialog
        templateName="Daniels"
        testProtocol={makeProtocol()}
        user={EMPTY_USER}
        onSaved={() => {}}
        onSkipped={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText(/fc máxima registrada/i), {
      target: { value: '50' }, // fuera del [100, 230]
    });
    expect(screen.getByText(/valor fuera de rango/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar resultado/i })).toBeDisabled();
  });

  it('Guardar invoca onSaved con el delta del compute', () => {
    const onSaved = vi.fn();
    render(
      <TestResultDialog
        templateName="Daniels"
        testProtocol={makeProtocol()}
        user={EMPTY_USER}
        onSaved={onSaved}
        onSkipped={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText(/fc máxima registrada/i), {
      target: { value: '192' },
    });
    fireEvent.click(screen.getByRole('button', { name: /guardar resultado/i }));
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith({ maxHeartRate: 192 });
  });

  it('Saltar invoca onSkipped sin llamar a onSaved', () => {
    const onSaved = vi.fn();
    const onSkipped = vi.fn();
    render(
      <TestResultDialog
        templateName="Daniels"
        testProtocol={makeProtocol()}
        user={EMPTY_USER}
        onSaved={onSaved}
        onSkipped={onSkipped}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /saltar/i }));
    expect(onSkipped).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('protocolos con 2 inputs requieren ambos para habilitar Guardar', () => {
    const protocol: TestProtocol = {
      id: 'bike-map5',
      inputs: [
        { id: 'meanPowerWatts', label: 'Potencia media (W)', unit: 'W', min: 50, max: 600 },
        { id: 'peakHrBpm', label: 'FCmáx (bpm)', unit: 'bpm', min: 100, max: 230 },
      ],
      compute: (inputs) => ({
        delta: { maxHeartRate: Math.round(inputs.peakHrBpm ?? 0) },
        derived: [
          { label: 'Potencia', value: inputs.meanPowerWatts ?? 0, unit: 'W' },
        ],
      }),
      citationDois: [],
    };
    render(
      <TestResultDialog
        templateName="MAP5"
        testProtocol={protocol}
        user={EMPTY_USER}
        onSaved={() => {}}
        onSkipped={() => {}}
      />,
    );
    const save = screen.getByRole('button', { name: /guardar resultado/i });
    fireEvent.change(screen.getByLabelText(/potencia media/i), {
      target: { value: '280' },
    });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/fcmáx \(bpm\)/i), {
      target: { value: '188' },
    });
    expect(save).toBeEnabled();
  });
});
