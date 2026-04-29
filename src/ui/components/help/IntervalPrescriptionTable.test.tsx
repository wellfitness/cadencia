import { describe, it, expect } from 'vitest';
import { render, within } from '@testing-library/react';
import { IntervalPrescriptionTable } from './IntervalPrescriptionTable';

describe('IntervalPrescriptionTable', () => {
  it('muestra las 4 zonas con prescripcion (Z3, Z4, Z5, Z6)', () => {
    const { getAllByText } = render(<IntervalPrescriptionTable />);
    expect(getAllByText('Z3').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Z4').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Z5').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Z6').length).toBeGreaterThanOrEqual(1);
  });

  it('incluye los rangos TMM criticos del XLSX', () => {
    const { getAllByText } = render(<IntervalPrescriptionTable />);
    expect(getAllByText('> 8 min, < 15 min').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('> 3 min, < 8 min').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('≥ 1 min, < 3 min').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('≥ 45 s, < 60 s').length).toBeGreaterThanOrEqual(1);
  });

  it('distingue recuperacion en Z2 (Z3-Z4) vs Z1 (Z5-Z6)', () => {
    const { getAllByText } = render(<IntervalPrescriptionTable />);
    expect(getAllByText('3-5 min en Z2').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('1,5-2 min en Z2').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('1-1,5 min en Z1').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('45-60 s en Z1').length).toBeGreaterThanOrEqual(1);
  });

  it('renderiza encabezados de columna correctos en desktop', () => {
    const { getByRole } = render(<IntervalPrescriptionTable />);
    const table = getByRole('table');
    const headers = within(table).getAllByRole('columnheader');
    const headerTexts = headers.map((h) => h.textContent);
    expect(headerTexts).toEqual([
      'Zona',
      'TMM',
      'Recuperación',
      'TTA novato',
      'TTA avanzado',
      'Objetivo',
    ]);
  });
});
