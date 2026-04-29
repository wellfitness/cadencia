import { describe, it, expect } from 'vitest';
import { render, within } from '@testing-library/react';
import { ZoneReferenceTable } from './ZoneReferenceTable';

describe('ZoneReferenceTable', () => {
  it('muestra las 6 zonas Z1-Z6', () => {
    const { getAllByText } = render(<ZoneReferenceTable />);
    // Cada zona aparece dos veces: en la tabla desktop y en las cards mobile.
    expect(getAllByText('Z1').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Z2').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Z3').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Z4').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Z5').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Z6').length).toBeGreaterThanOrEqual(1);
  });

  it('incluye los porcentajes %FTP criticos del XLSX', () => {
    const { getAllByText } = render(<ZoneReferenceTable />);
    expect(getAllByText('< 55%').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('55-75%').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('75-90%').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('90-105%').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('105-120%').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('> 120%').length).toBeGreaterThanOrEqual(1);
  });

  it('incluye RPE descrito por niveles', () => {
    const { getAllByText } = render(<ZoneReferenceTable />);
    expect(getAllByText('1-2 / Muy suave').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('5-6 / Moderado').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('9-10 / Máximo').length).toBeGreaterThanOrEqual(1);
  });

  it('renderiza una tabla con encabezados de columna en desktop', () => {
    const { getByRole } = render(<ZoneReferenceTable />);
    const table = getByRole('table');
    const headers = within(table).getAllByRole('columnheader');
    const headerTexts = headers.map((h) => h.textContent);
    expect(headerTexts).toEqual(['Zona', '% FTP', '% P5', '% FCmáx', 'RPE', 'Color en la app']);
  });
});
