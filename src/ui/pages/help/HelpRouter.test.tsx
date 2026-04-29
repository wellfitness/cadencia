import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { HelpRouter } from './HelpRouter';

describe('HelpRouter', () => {
  it('renderiza el HelpHome para "/ayuda"', () => {
    const { getByRole } = render(<HelpRouter pathname="/ayuda" />);
    // El HelpHome tiene un h1 con "Centro de ayuda"
    const heading = getByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('Centro de ayuda');
  });

  it('renderiza el articulo correspondiente para cada slug conocido', () => {
    const slugs = [
      ['/ayuda/sesion-indoor', 'Cómo construir una sesión indoor'],
      ['/ayuda/zonas', 'Zonas de entrenamiento'],
      ['/ayuda/intervalos', 'Prescripción de intervalos'],
      ['/ayuda/plantillas', 'Plantillas y cuándo usarlas'],
      ['/ayuda/musica', 'Cómo se elige la música de cada bloque'],
      ['/ayuda/spotify', 'Spotify y preguntas frecuentes'],
    ] as const;
    for (const [pathname, expectedTitle] of slugs) {
      const { getByRole, unmount } = render(<HelpRouter pathname={pathname} />);
      const heading = getByRole('heading', { level: 1 });
      expect(heading.textContent).toBe(expectedTitle);
      unmount();
    }
  });

  it('cae al HelpHome para paths desconocidos bajo /ayuda', () => {
    const { getByRole } = render(<HelpRouter pathname="/ayuda/inexistente" />);
    const heading = getByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('Centro de ayuda');
  });

  it('acepta trailing slash', () => {
    const { getByRole } = render(<HelpRouter pathname="/ayuda/zonas/" />);
    const heading = getByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('Zonas de entrenamiento');
  });
});
