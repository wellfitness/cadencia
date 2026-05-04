# Contributing to Cadencia

¡Gracias por tu interés en Cadencia!

---

## Issues bienvenidos, PRs cerrados

Cadencia se distribuye como **código fuente público de uso no comercial** (licencia [PolyForm Noncommercial 1.0.0](./LICENSE)). El proyecto lo mantiene una sola autora con una visión específica del producto, así que las vías de colaboración son limitadas pero claras:

- **Issues — bienvenidos.** Si encuentras un bug, quieres proponer una mejora o pedir una feature, abre uno en [GitHub Issues](https://github.com/wellfitness/cadencia/issues). Describe el caso de uso, el comportamiento esperado y el actual; si es un bug, añade pasos para reproducirlo.
- **Forks personales — bienvenidos** para cualquier uso no comercial (estudio, hobby, adaptarlo a tu club ciclista, investigación). Mantén el aviso de copyright original.
- **Pull requests externos — no se aceptan.** Mergear contribuciones bajo una licencia no comercial introduce fricciones legales (cesión de copyright, ambigüedad sobre derechos de la autora a relicenciar en el futuro) que no compensan el beneficio para un proyecto de este tamaño. Si tienes una idea concreta, ábrela como issue y la discutimos.

---

## Uso comercial

El uso, despliegue o modificación con fines comerciales (incluyendo SaaS, productos derivados de pago, integraciones en servicios comerciales, etc.) **requiere permiso expreso del autor**. Escribe a [movimientofuncional.net@gmail.com](mailto:movimientofuncional.net@gmail.com) describiendo el caso de uso.

---

## Reglas del proyecto

Las reglas vinculantes (arquitectura, separación de capas, qué se puede y no se puede hacer) viven en [CLAUDE.md](./CLAUDE.md). Si abres un issue proponiendo un cambio estructural, léelo primero.

Resumen rápido:

- Sin backend, sin base de datos, sin sistema de cuentas.
- Cálculos físicos en `src/core/` puro (sin React, sin DOM).
- Nada de `any` en TypeScript.
- Identificadores de código en inglés, comentarios en español OK.
- El motor de matching debe ser determinista.
