import { describe, it, expect } from 'vitest';
import { sanitizeFilename } from './filename';

describe('sanitizeFilename', () => {
  it('mantiene letras, dígitos, espacios y acentos', () => {
    expect(sanitizeFilename('Mi ruta del Domingo')).toBe('Mi ruta del Domingo');
    expect(sanitizeFilename('Tour de França — etapa 1')).toBe('Tour de França — etapa 1');
  });

  it('elimina caracteres reservados de Windows/macOS', () => {
    expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe('abcdefghij');
  });

  it('hace trim de espacios al principio y al final', () => {
    expect(sanitizeFilename('   Mi ruta   ')).toBe('Mi ruta');
  });

  it('vacío o solo caracteres reservados → fallback "workout"', () => {
    expect(sanitizeFilename('')).toBe('workout');
    expect(sanitizeFilename('   ')).toBe('workout');
    expect(sanitizeFilename('///')).toBe('workout');
  });

  it('preserva mayúsculas, minúsculas y números', () => {
    expect(sanitizeFilename('HIIT 4x4 Noruego v2')).toBe('HIIT 4x4 Noruego v2');
  });
});
