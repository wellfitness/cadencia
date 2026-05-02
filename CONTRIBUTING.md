# Contributing to Cadencia

¡Gracias por querer colaborar! Antes de abrir un PR lee esto.

---

## Licencia

Este proyecto se distribuye bajo **MIT License** (ver [LICENSE](./LICENSE)).

Cualquier persona puede usar, modificar, redistribuir y contribuir al código
libremente, incluido para uso comercial. La única condición es mantener el
aviso de copyright original.

---

## Developer Certificate of Origin (DCO)

Para que el proyecto pueda mantenerse y eventualmente relicenciarse o usarse
comercialmente por la autora, **todos los commits deben llevar la firma DCO**.

DCO es un mecanismo simple por el que tú, como contributor, certificas que:

1. Tienes derecho a aportar el código que envías.
2. Aceptas que tu contribución se distribuya bajo la licencia del proyecto.

El texto completo está en <https://developercertificate.org/>.

### Cómo firmar tus commits

Añade la flag `-s` (o `--signoff`) cada vez que hagas commit:

```bash
git commit -s -m "fix: corregir cálculo de pendiente en GPX parser"
```

Esto añade automáticamente al mensaje del commit:

```
Signed-off-by: Tu Nombre <tu@email.com>
```

Para no tener que recordarlo cada vez, configura git:

```bash
git config --global format.signoff true
```

Los PRs sin commits firmados no se mergean. Si te olvidas, puedes
re-firmar con `git commit --amend -s` (o rebase signoff sobre todos los
commits).

---

## Antes de abrir un PR

1. `pnpm install`
2. `pnpm typecheck` → 0 errores
3. `pnpm lint` → 0 errores, 0 warnings
4. `pnpm test:run` → todos los tests verdes
5. Si tu cambio afecta lógica en `src/core/` → añade tests unitarios
6. Si tu cambio afecta la UI → corre `pnpm test:e2e` y verifica visualmente

El pre-commit hook de Husky corre `typecheck` + `lint` automáticamente.
**Nunca uses `git commit --no-verify`**: si algo falla, arregla la causa.

---

## Reglas del proyecto

Las reglas vinculantes (arquitectura, separación de capas, qué se puede y no
se puede hacer) viven en [CLAUDE.md](./CLAUDE.md). Léelo antes de hacer
cambios estructurales.

Resumen rápido:

- Sin backend, sin base de datos, sin sistema de cuentas.
- Cálculos físicos en `src/core/` puro (sin React, sin DOM).
- Nada de `any` en TypeScript.
- Identificadores de código en inglés, comentarios en español OK.
- El motor de matching debe ser determinista.

---

## Cómo proponer cambios grandes

Antes de invertir tiempo en un cambio grande (nuevo módulo, refactor amplio,
nueva integración), abre un **issue** describiendo qué quieres hacer y por qué.
Ahorra trabajo a todos.
