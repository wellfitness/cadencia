# Auditoría pre-lanzamiento — Cadencia

**Fecha**: 2026-04-30  
**Estado**: snapshot inmutable de hallazgos. Ningún cambio aplicado todavía.  
**Alcance**: funcionalidad, lógica, seguridad, UI/UX, configuración cliente, calidad del código.  
**Metodología**: análisis estático del repositorio (sin ejecución E2E ni navegador real). Auditor humano (Claude) revisando módulo a módulo + agente automatizado de TypeScript/ESLint completado con éxito. Los agentes de seguridad, code-review y UI/UX no completaron por límite de presupuesto; sus dominios fueron asumidos por el auditor humano con menor profundidad.

---

## Resumen ejecutivo

| Severidad | Hallazgos | Bloqueantes pre-lanzamiento |
|---|---|---|
| **Crítico** | 2 | Sí — corregir antes de promoción pública |
| **Alto** | 5 | Sí — corregir antes de promoción pública |
| **Medio** | 8 | Recomendable corregir; ninguno rompe el flujo principal |
| **Bajo** | 5 | Mejoras, no bloqueantes |
| **Nice-to-have** | 6 | Calidad y mantenibilidad a medio plazo |

**Estado de calidad base** (vía agente automatizado): 0 errores TypeScript, 0 warnings ESLint, 670/670 tests verdes, 93,4 % cobertura sobre `src/core/`, 0 ocurrencias de `any`, 0 `@ts-ignore`, 0 `console.log` huérfanos. **El código ESTÁ bien escrito**; los hallazgos son lógica, seguridad de configuración y propagación de un campo de dominio nuevo (sport).

---

## CRÍTICOS

### C1 — Multisport: el `sport` no llega al motor de matching

**Síntoma observable**: cualquier sesión de **running** (indoor desde plantilla/builder o GPX outdoor) genera la lista musical filtrando tracks por rangos de **cadencia de ciclismo** (70-90 rpm flat / 55-80 rpm climb / 90-115 rpm sprint), no por los rangos espećificos de carrera por zona (150-162 spm Z1 → 180-200 spm Z6).

**Causa raíz**: el campo `sport: 'bike' | 'run'` viaja correctamente desde el wizard hasta `EditableSessionPlan` y `SessionPlan`, **pero se pierde en la conversión a `ClassifiedSegment`** porque el tipo `ClassifiedSegment` no lleva `sport`. Los cuatro call sites del matcher invocan `getZoneCriteria(seg.zone, seg.cadenceProfile)` sin tercer argumento, y la firma `getZoneCriteria(zone, profile, sport: Sport = 'bike')` tiene default `'bike'`. Resultado: TypeScript no avisa, los tests existentes solo cubren la rama bike, y el bug pasa desapercibido.

**Archivos**:
- `src/core/segmentation/types.ts` — tipo `ClassifiedSegment` sin `sport`.
- `src/core/segmentation/fromSessionBlocks.ts:74-103` — `classifySessionPlan` recibe `plan.sport` pero no lo propaga al `ClassifiedSegment`.
- `src/core/matching/match.ts:133` — `getZoneCriteria(seg.zone, seg.cadenceProfile)` sin sport.
- `src/core/matching/match.ts:195` — idem.
- `src/core/matching/replaceTrack.ts:59` — idem (afecta al dropdown «Otro tema»).
- `src/core/matching/poolCoverage.ts:104` — idem (afecta al pre-check de cobertura).

**Impacto**: el matching de running está **funcionalmente roto**. La regla del CLAUDE.md «en sport 'run': cadenceMin/max vienen de CADENCE_BY_RUN_ZONE» nunca se aplica en runtime para sesiones reales. Los tests unitarios de `zoneCriteria.test.ts` pasan porque invocan `getZoneCriteria(zone, 'flat')` de forma aislada; ningún test integración valida el flujo `SessionPlan(sport='run') → ClassifiedSegment[] → matchTracksToSegments → output`.

**Severidad**: CRÍTICO. Con esto en producción, los usuarios de running reciben listas con tracks fuera de rango de cadencia.

**Recomendación**:
1. Añadir `sport: Sport` a `ClassifiedSegment` (tipo).
2. Propagar `plan.sport ?? 'bike'` en `classifySessionPlan` al construir cada segmento.
3. Propagar `'bike' | 'run'` desde el procesador de GPX outdoor (en `RouteStep` el sport viene del paso 0 del wizard).
4. Pasar `seg.sport` a `getZoneCriteria` en los 4 call sites.
5. Añadir test: «matchTracksToSegments con sport=run filtra por rangos spm» (input sintético: track 75 BPM y track 165 BPM, zona Z1 run; el filtro 1:1 debe aceptar 165 BPM, el 0.5:1 debe aceptar 75 BPM).

---

### C2 — Falta Content-Security-Policy y headers de seguridad

**Observación**: `public/.htaccess` solo configura SPA fallback, gzip, cache y force-HTTPS. **Ninguna directiva de seguridad** (CSP, X-Frame-Options, Referrer-Policy, Strict-Transport-Security, X-Content-Type-Options, Permissions-Policy).

**Archivo**: `public/.htaccess`.

**Impacto**: una app cliente-only que maneja **dos OAuth (Spotify + Google Drive)** y procesa **inputs no confiables (GPX, CSV, .zwo)** sin CSP queda expuesta a:
- Inyección de `<script src=…>` por una dependencia npm comprometida → exfiltración del access token de Spotify/Drive presente en sessionStorage/localStorage.
- Clickjacking de `cadencia.movimientofuncional.app` en un iframe de un sitio malicioso para fingir el botón «Crear playlist en Spotify».
- Leak de `Referer` con tokens en query si alguna llamada los pasa por URL (no es el caso ahora, pero defensa en profundidad).
- Cookie hijacking por downgrade HTTP en redes hostiles (sin HSTS).

**Severidad**: CRÍTICO. Es el plano de seguridad mínimo viable para una app pública que maneja OAuth.

**Recomendación**: añadir al `.htaccess`:

```apache
<IfModule mod_headers.c>
  Header always set Content-Security-Policy "default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; connect-src 'self' https://accounts.spotify.com https://api.spotify.com https://accounts.google.com https://www.googleapis.com https://oauth2.googleapis.com; frame-src https://accounts.google.com; img-src 'self' data: https://i.scdn.co; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; manifest-src 'self'; base-uri 'self'; form-action 'self' https://accounts.spotify.com; frame-ancestors 'none'"
  Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=(), usb=()"
  Header always set X-Frame-Options "DENY"
</IfModule>
```

Verificar después con [securityheaders.com](https://securityheaders.com) que la app obtiene grado A o A+. Probar el flow de Spotify y de Drive tras aplicar (la CSP puede romper alguna llamada inesperada — iterar). El `'unsafe-inline'` en `style-src` es necesario por Tailwind y por el JSON-LD inline; en el futuro se puede reemplazar por nonce.

---

## ALTOS

### A1 — Anglicismos en copy de usuario

**Hallazgo**: el CLAUDE.md prohíbe anglicismos en copy narrativo (wizard→asistente, playlist→lista, popup→ventana emergente, dropdown→menú, track→tema). Inspección encuentra:

- `src/ui/pages/CalendarPage.tsx:165` — JSX visible al usuario: «Tienes un plan en curso en el **wizard**…». Debe ser «asistente».
- `src/ui/pages/ResultStep.tsx:398` — `<Card title="Crear en Spotify" titleIcon="playlist_add">` (correcto, «playlist_add» es nombre del Material Icon, no copy).
- `src/ui/pages/ResultStep.tsx:764-765` — usa «Tu lista «{playlist.name}»…» (correcto).

Comentarios internos con «wizard» en `CalendarPage.tsx:25`, `CatalogEditorPage.tsx:23`, `MyPreferencesPage.tsx:139`, `ResultStep.tsx:77,86` son comentarios de código (no copy de usuario) — el CLAUDE.md tolera el inglés en variables y nombres técnicos pero la doc del módulo se redacta en castellano. Conviene homogeneizar a «asistente» también ahí por consistencia (no es bloqueante).

**Impacto**: incoherencia de tono. El usuario no técnico ve «wizard» en un diálogo modal y rompe la promesa de copy castellano cuidado de Movimiento Funcional.

**Recomendación**: cambiar el JSX visible. Auditar también `src/ui/pages/help/articles/*.tsx` con el mismo grep — el agente de UI/UX no completó y no pude cubrir esos artículos.

---

### A2 — Drive sync: `init()` no es idempotente bajo doble llamada

**Archivo**: `src/integrations/gdrive/sync.ts:89-94`.

**Síntoma**: la flag `_initialized = true` se asigna **antes** del `await getTokenSilent()` y antes de los `addEventListener`. Si `init()` se invoca dos veces en paralelo (improbable pero posible en dev con HMR de Vite, o en futuro con StrictMode), las dos llamadas pasan el guard `if (_initialized) return`, y los listeners se registran por duplicado.

**Consecuencia**: cada cambio en `cadenciaStore` dispara `debouncedPush` dos veces. No hay corrupción de datos (el debounce los colapsa en el segundo pero el doble listener no se anula entre sí), pero hay tráfico duplicado a Drive y posibles 429.

**Recomendación**: cachear el promise de inicialización:

```typescript
let _initPromise: Promise<void> | null = null;
export function init(): Promise<void> {
  if (_initPromise) return _initPromise;
  _initPromise = doInit();
  return _initPromise;
}
```

---

### A3 — Drive sync: listeners no se desregistran en `disconnect()`

**Archivo**: `src/integrations/gdrive/sync.ts:113-124, 149-158`.

**Síntoma**: `init()` añade listeners de `'cadencia-data-saved'` y `'visibilitychange'` con callbacks anónimos. `disconnect()` solo llama a `stopPolling()` y borra el syncState. Si el usuario hace `connect → disconnect → connect` varias veces, cada `connect` no añade nuevos listeners (porque el guard de `_initialized` ya pasó), pero **`disconnect()` sí debería desactivar el comportamiento de los listeners cuando no estás conectado**. Hoy lo hace por el chequeo `if (isConnected())` dentro del callback — funcionalmente correcto, pero los listeners siguen ahí gastando ciclos en cada cambio.

**Severidad**: ALTO porque el síntoma se camufla con A2 — combinados, listeners apilados pueden dar comportamiento errático difícil de reproducir.

**Recomendación**: extraer los handlers a constantes nombradas y desregistrarlos en `disconnect()`. O, alternativamente, dejar los listeners pero confiar en el guard interno (la solución actual). Documentar explícitamente la decisión y eliminar la ambigüedad.

---

### A4 — Drive `readFile` no valida estructura del JSON descargado

**Archivo**: `src/integrations/gdrive/drive-api.ts:80-83`.

**Síntoma**: `readFile` hace `return res.json() as Promise<SyncedData>` sin validar. Si Drive devuelve un blob malformado (corrupción, edición manual del archivo en `appDataFolder`, o escritura concurrente de versión futura del schema), el motor de sync downstream crashea con `cannot read properties of undefined (reading 'filter')` en `mergeData`.

**Vector**: el usuario abre Drive en otra cuenta donde alguien (él mismo, otra app de testing) escribió un JSON inválido. La app rompe en arranque.

**Recomendación**: usar `isSyncedData` de `core/sync/schema.ts` antes de devolver. Si falla, lanzar `DriveApiError('archivo corrupto', 200)` y que el caller lo maneje (probablemente: notificar al usuario + restaurar local sin tocar remote).

---

### A5 — Spotify storage usa keys legacy `vatios:`

**Archivo**: `src/integrations/spotify/storage.ts:12-13`.

**Hallazgo**:
```typescript
const FLOW_KEY = 'vatios:spotify:authFlow:v1';
const TOKENS_KEY = 'vatios:spotify:tokens:v1';
```

**Impacto**: legado del rebrand Vatios → Cadencia. No es bug funcional (las keys son arbitrarias), pero:
- Inconsistente con `cadencia:gdrive:token` y `cadencia:data:v1` (resto del proyecto).
- En herramientas de inspección (DevTools Application → Storage) el usuario ve un nombre que no corresponde a la app que está usando — fricción mínima, pero al fin y al cabo «Cadencia» debe ser end-to-end.

**Recomendación**: renombrar a `cadencia:spotify:authFlow:v1` y `cadencia:spotify:tokens:v1`. Como el storage es `sessionStorage` (vida de pestaña), no hace falta migración: solo cambiar los strings y aceptar que cualquier sesión OAuth en curso se pierde (quien tenga la pestaña abierta tendrá que repulsar «Crear playlist»). Si se quiere migración silenciosa, leer ambas keys y preferir la nueva.

---

## MEDIOS

### M1 — `isSyncedData` no valida arrays adicionales

**Archivo**: `src/core/sync/schema.ts:18-28`.

**Síntoma**: el guard solo verifica `schemaVersion`, `updatedAt`, `_sectionMeta`, `savedSessions`. Si Drive devuelve un blob con `uploadedCsvs: null`, `dismissedTrackUris: null`, `plannedEvents: null` o `nativeCatalogPrefs: undefined`, el guard pasa y luego `mergeData` revienta.

**Recomendación**: añadir `Array.isArray(v['uploadedCsvs'])`, `Array.isArray(v['dismissedTrackUris'])`, `Array.isArray(v['plannedEvents'])` al guard. Considerar también validar `userInputs`, `musicPreferences`, `nativeCatalogPrefs` como `null | object`.

---

### M2 — Parser GPX sin límite de tamaño

**Archivo**: `src/core/gpx/parser.ts` (parser) + `src/ui/components/FileDropzone` (entrada).

**Síntoma**: `DOMParser.parseFromString` carga el XML entero en memoria. Un GPX de 100 MB cuelga la pestaña.

**Severidad**: MEDIO porque es DoS local (no atacante remoto), pero un usuario que sube por error un dump grande tiene mala UX (pestaña sin respuesta).

**Recomendación**: validar `file.size < 10 * 1024 * 1024` (10 MB) en el FileDropzone antes de parsear. Mensaje al usuario: «GPX demasiado grande (X MB). El máximo soportado es 10 MB. Usa una versión recortada de tu ruta».

---

### M3 — `fetchUserEmail` requiere scope que no está pedido

**Archivo**: `src/integrations/gdrive/auth.ts:193-206`.

**Síntoma**: `fetchUserEmail` llama a `https://www.googleapis.com/oauth2/v2/userinfo`, que requiere scope `openid`, `email` o `profile`. El scope configurado en `config.ts:18` es solo `https://www.googleapis.com/auth/drive.appdata`.

**Consecuencia**: la respuesta es 403 Forbidden, el catch silencioso lo absorbe, y `fetchUserEmail` devuelve `''`. Si la UI muestra «Conectado: {email}», acaba mostrando «Conectado: » con email vacío.

**Recomendación**:
- **Opción A**: añadir scope `email` (`https://www.googleapis.com/auth/userinfo.email`). Implica actualizar la consent screen en GCP. Coste UX: el usuario ve un permiso adicional al conectar.
- **Opción B (preferida)**: eliminar `fetchUserEmail` y mostrar solo «Conectado a Google Drive» sin email. Más simple, scope mínimo intacto, coherente con la promesa de privacidad de la app.

Confirmar viendo la UI real (no pude verificarla; probablemente `GoogleSyncCard.tsx`).

---

### M4 — Best-effort cross-zone puede elegir tracks musicalmente fuera de rango

**Archivo**: `src/core/matching/match.ts:80-87`.

**Síntoma**: cuando todos los strict (cadencia OK + no usados) están agotados, el motor cae a `allTracks.filter(t => !used.has(t.uri))` sin ningún pre-filtro de cadencia. Esto puede asignar a Z1 un track de 220 BPM porque era el «mejor del catálogo libre».

**Política actual** (documentada en CLAUDE.md): «variedad sobre coincidencia exacta de cadencia». Decisión consciente.

**Severidad**: MEDIO porque el hallazgo no es bug, es trade-off. Pero merece doble-check con la usuaria.

**Recomendación**: confirmar que esta política es la deseada. Alternativa: mantener un floor de score por componente cadencia (ej. cadenceScore ≥ 0.3) en best-effort, descartando los outliers más extremos. Hoy no hay floor.

---

### M5 — `createPlaylist` no valida longitud de name/description

**Archivo**: `src/integrations/spotify/api.ts:101-109`.

**Síntoma**: Spotify limita name a 100 caracteres y description a 300. Si el usuario teclea más, el POST falla con un mensaje genérico de Spotify (`Invalid request data`).

**Recomendación**: en `ResultStep.tsx` antes del POST, truncar con `.slice(0, 100)` y `.slice(0, 300)` o mostrar contador junto al input. Mensajes en castellano.

---

### M6 — `mergeData` usa `JSON.stringify` para detectar conflictos

**Archivo**: `src/core/sync/merge.ts:67`.

**Síntoma**: `JSON.stringify(lv) !== JSON.stringify(rv)` da falso positivo cuando dos objetos tienen las mismas propiedades en distinto orden de claves (puede ocurrir tras serializar/deserializar entre dispositivos con motores JS diferentes — improbable pero posible).

**Impacto**: solo afecta al log `conflicts[]` (cosmético). Los datos merged son correctos.

**Recomendación**: usar deep-equal (escribir uno chico) o `JSON.stringify` con keys ordenadas. Baja prioridad.

---

### M7 — `calculateDataRichness` mezcla dimensiones heterogéneas

**Archivo**: `src/core/sync/richness.ts:12-30`.

**Síntoma**: suma valores de `userInputs` (#campos no-null), `savedSessions.length`, `uploadedCsvs.length`, `excludedUris.length`, etc. Un usuario con 50 sesiones y nada más tiene richness 50; uno con perfil completo (8 campos) + 1 sesión + 2 CSVs tiene richness 11. La regla `local < remote * 0.3` puede dispararse en casos legítimos donde el usuario limpia su histórico.

**Vector**: usuario en dispositivo A borra 49 de 50 sesiones del histórico. Sync push ocurre. En dispositivo B (que aún tenía 50), al pull, `richness(remote)=1, richness(local)=50` → no aplica anti-regresión, mergea normal por LWW: gana el push porque sus tombstones son más recientes. **Funciona OK**. Pero el caso inverso (dispositivo A vacío + dispositivo B con 50) sí dispara la anti-regresión y aplica remote sin merge — correcto.

**Análisis**: el riesgo real es bajo. La heurística está implementada de forma defensiva (anti-regresión solo cuando local << remote, no al revés). 

**Recomendación**: documentar mejor la heurística en el código. Considerar caso límite: usuario con catálogo vacío + 49 dismissedTrackUris → richness=49, sí cuenta. OK.

---

### M8 — JSON-LD inline sin escapar `<` antes de `JSON.stringify`

**Archivo**: `src/ui/pages/Landing.tsx:1142`.

**Síntoma**: `dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}`. `JSON.stringify` no escapa `<`, `>`, `&`. Si en algún momento alguna pregunta o respuesta del FAQ contiene literal `</script>`, el navegador cierra el `<script type="application/ld+json">` antes de tiempo y abre vector XSS.

**Hoy no hay riesgo**: `faqJsonLd` se construye desde un array de pares `{q, a}` hardcoded. No hay input de usuario.

**Recomendación**: escapar como `JSON.stringify(faqJsonLd).replace(/</g, '\\u003c')`. Práctica estándar para JSON-LD inline. Coste: un `.replace`. Beneficio: defensa en profundidad ante futuras ediciones del FAQ.

---

## BAJOS

### B1 — `hashSeed(0, slotIndex)` produce secuencia con patrón

**Archivo**: `src/core/matching/random.ts:35-37`.

**Síntoma**: con `seed=0`, `hashSeed(0, slotIndex) = (Math.imul(slotIndex, 2654435761)) ^ (slotIndex << 13)`. Pierde el primer término del XOR. La secuencia sigue siendo una función pura de `slotIndex` y la distribución no es necesariamente mala, pero está degradada respecto a `seed > 0`.

**Probabilidad**: `seed = Math.floor(Math.random() * 0xffffffff)` puede dar 0 con probabilidad ~2⁻³² (extremadamente improbable).

**Recomendación**: en el caller que genera la seed, forzar `seed | 1` o sumar 1 si sale 0. Coste cero.

---

### B2 — Z6 Karvonen rango degenerado `[maxHr, maxHr]`

**Archivo**: `src/core/physiology/karvonen.ts:18`.

**Síntoma**: `6: [1.0, 1.0]`. Por diseño (la FC se satura en máxima en supramáximo). El comentario en el código lo justifica.

**Verificación pendiente**: confirmar que la UI (`SessionBuilder` BlockList y BlockEditor; chip de rango) no muestra «138-138 bpm» como rango sino algo más sensato como «≥138 bpm» o «FC saturada». La doc CLAUDE.md dice «La banda de FC se omite en Z6». No pude verificar el render real sin el agente UI/UX.

**Recomendación**: revisar manualmente el render de Z6 en el SessionBuilder. Si muestra «138-138 bpm», cambiar el formatter de zonas.

---

### B3 — `Math.max(...arr)` con arrays grandes

**Archivos**: `src/core/sync/merge.ts:102, 126, 150, 158-159`.

**Síntoma**: spread de arrays potencialmente grandes (cientos de SavedSessions). Funciona pero degrada con N alto y puede dar `Maximum call stack size exceeded` en el límite (V8 ~125 000 args, mucho más alto que el caso real, así que es teórico).

**Recomendación**: `arr.reduce((a, b) => a > b ? a : b, -Infinity)`. Coste cero.

---

### B4 — Discrepancia doc CLAUDE.md vs código en fórmula de potencia

**Archivos**: `CLAUDE.md` (sección «Cálculo de potencia») vs `src/core/power/equation.ts:37`.

**Síntoma**: la doc dice `P_rodadura = Crr × m × g × v` (sin `cos(angle)`). El código usa `Crr × m × g × v × cos(angle)` (con `cos`, físicamente correcto: la fuerza normal proyectada).

**Severidad**: BAJO porque el código es el correcto y los tests pasan. Solo la doc está desactualizada.

**Recomendación**: actualizar `CLAUDE.md` con `cos(atan(slope/100))` en `P_rodadura`. NO tocar el código.

---

### B5 — Sourcemaps en producción

**Archivo**: `vite.config.ts:62`.

**Síntoma**: `sourcemap: true` también en build de producción. Expone el código fuente legible.

**Impacto**: en proyecto source-available no es secreto. Pero pesa en bandwidth de Hostinger y puede confundir al inspector casual («¿esto es código del usuario o de la app?»).

**Recomendación**: dejar `sourcemap: 'hidden'` (genera .map pero sin la línea `//# sourceMappingURL` al final del .js). Útil para debugging propio si subes los .map al servidor sin servirlos públicamente.

---

## NICE-TO-HAVE

### N1 — Cobertura de `src/core/user/validation.ts` 76 % (debería ser >90 %)

**Detectado por**: agente automatizado de TypeScript+ESLint.

Líneas 266-271 y 357-458 sin tests. Es la pieza con más ramas (sport × mode × campos), justo lo que el CLAUDE.md marca como crítico. Las ramas no testeadas suelen ser combinaciones (ej. `run + gpx + sin maxHeartRate + con birthYear sin sex`). Candidatas a regresión silenciosa.

**Recomendación**: tabla parametrizada con `it.each` cubriendo los 4 modos `(bike|run) × (gpx|session)` × las 4 combinaciones de campos opcionales. Objetivo 90 %.

---

### N2 — Subir reglas ESLint de `warn` a `error`

**Detectado por**: agente automatizado.

`react-hooks/exhaustive-deps` y `@typescript-eslint/consistent-type-imports` están en `warn`. El repo tiene solo 2 disables intencionales en todo `src/`, ambos justificados. Subirlas a `error` blinda contra regresiones.

---

### N3 — Code splitting del bundle principal

**Detectado por**: agente automatizado.

Bundle de 1,08 MB minified (322 KB gz). Vite ya avisa («chunk supera 500 kB»). Candidatos a chunks separados: `recharts`, páginas `/ayuda/*` (lazy import), `SessionTVMode`. Mejora primer paint en móvil/PWA.

---

### N4 — Falta cobertura E2E de `/calendario`, `/preferencias`, modo TV

**Detectado por**: agente automatizado.

Hoy 33 tests E2E (smoke wizard + catalog editor). CRUD del calendario, hub de preferencias y modo TV sin cobertura. Páginas con bugs potenciales (dialogs, reordering, hot-reload de session, etc.).

---

### N5 — PWA manifest sin `id` ni `screenshots`

**Archivo**: `vite.config.ts` plugin PWA.

Sin `id`, el navegador genera el id desde `start_url`. Cambiar `start_url` en futuro reinstala el PWA como nueva app. Sin `screenshots`, el prompt Add to Home Screen en Android no muestra preview.

**Recomendación**: añadir `id: '/'` y `screenshots: [...]` (3-5 capturas) al manifest.

---

### N6 — Falta componente `<ExternalLink>` reutilizable

**Hallazgo**: hay 15 ocurrencias de `target="_blank" rel="noopener noreferrer"` escritas a mano en distintos componentes. Todas correctas hoy, pero la próxima ocurrencia puede olvidar el `rel`.

**Recomendación**: extraer a `<ExternalLink href=… >…</ExternalLink>` que aplica `rel` por defecto. Añadir regla ESLint `react/jsx-no-target-blank` para alertar de las que no la usen.

---

## Verificaciones que NO se pudieron hacer

1. **Render real de la UI**: contraste WCAG, foco visible, tamaños táctiles, copy de los artículos de ayuda (`src/ui/pages/help/articles/*.tsx`). Requiere navegador + DevTools, no análisis estático. Recomendación: ejecución manual con axe DevTools y captura de pantalla por página.
2. **Auditoría exhaustiva de copy**: solo se hizo grep heurístico de anglicismos (`wizard`, `playlist`, `popup`, `dropdown`). Términos como «track», «default», «setup» en JSX requieren revisión manual.
3. **Pruebas de OAuth real**: PKCE de Spotify y GIS de Google requieren credenciales reales y navegador.
4. **Performance en device físico**: Recharts en móvil de gama baja, splash de PWA en Android, LCP/INP reales.
5. **`pnpm audit`**: el agente de seguridad no llegó a ejecutarlo. Recomendable correrlo a mano antes del lanzamiento.

---

## Plan de remediación propuesto

**Fase 1 — bloqueantes (recomendado antes del lanzamiento público)**:
- C1 (sport en matching) — ~1 h: cambio de tipo + 4 call sites + 1 test integración.
- C2 (CSP + headers) — ~30 min: editar `.htaccess`, validar con securityheaders.com, probar OAuth.
- A1 (anglicismos copy) — ~15 min: cambiar string en `CalendarPage.tsx:165`. Revisar artículos de ayuda.
- A2, A3 (sync init/disconnect) — ~30 min juntos.
- A4 (validar JSON Drive) — ~15 min.
- A5 (renombrar keys spotify) — ~10 min.

**Total fase 1**: ~3 horas de trabajo.

**Fase 2 — recomendados** (M1-M8): ~3-4 horas adicionales.

**Fase 3 — pulido**: nice-to-have, sin urgencia.

---

## Próximos pasos

Esperando confirmación del usuario para empezar por **fase 1**. Cada hallazgo se aborda en un commit independiente con mensaje siguiendo el estilo del repo, y validando `pnpm typecheck && pnpm lint && pnpm test:run` después de cada uno. El bug C1 incluye su propio test de regresión.
