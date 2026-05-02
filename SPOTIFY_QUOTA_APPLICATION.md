# Spotify Extended Quota Mode — Application Pack

Materiales preparados para rellenar el cuestionario de Extended Quota
Mode en el Developer Dashboard de Spotify. Copia-pega los bloques
correspondientes en cada campo del formulario.

> Este archivo NO debe ser distribuido públicamente con la app: contiene
> el plan estratégico de la solicitud. Si quieres mantenerlo fuera del
> repo público, añádelo a `.gitignore`.

---

## 0. Datos básicos de la entidad legal

| Campo | Valor |
|---|---|
| App name | Cadencia |
| Public URL | https://cadencia.movimientofuncional.app |
| Repo público | https://github.com/wellfitness/cadencia |
| Privacy Policy | https://cadencia.movimientofuncional.app/privacy.html |
| Terms of Service | https://cadencia.movimientofuncional.app/terms.html |
| Contact email | movimientofuncional.net@gmail.com |
| Organization name | Movimiento Funcional (Elena Cruces Domínguez, autónoma) |
| Country / Markets | Spain (primary), available globally where Spotify operates |
| Legal name | Elena Cruces Domínguez |
| NIF | 36114681N |
| Business address | Rúa Médico José Mato Soto, 22 - 9B, 36210 Vigo (Pontevedra), España |

---

## 1. App description (campo «What does your app do?»)

**~150 palabras, copia tal cual al campo corto del cuestionario:**

> Cadencia is a web application that synchronizes Spotify music with the
> physical intensity of cardiovascular workouts (cycling and running),
> outdoor (from a GPX file) or indoor (from interval-based sessions). For
> each workout segment the app derives a target heart-rate or power zone
> using validated physiology models (Karvonen, Coggan, Minetti) and
> matches a Spotify track whose tempo (BPM), energy and valence align
> with that intensity. The result is an ordered private playlist created
> in the user's Spotify account, ready to be played during the workout.
>
> Cadencia is fully client-side: there is no backend, no database, no
> user accounts. Audio Features metadata comes bundled with the app or
> is uploaded by the user. The Spotify integration is opt-in and only
> activated when the user explicitly clicks "Create playlist".

---

## 2. Detailed use case (campo largo, ~500 palabras)

**Copia el bloque entero al campo «Detailed description» / «Use case»:**

> ### Problem we solve
>
> Cyclists and runners report that music improves adherence and perceived
> exertion during cardiovascular training (Terry et al. 2020, n = 3,599;
> SMD +0.48 for affective valence, −0.22 for perceived exertion). However,
> standard playlists ignore the underlying physiological intensity profile
> of the workout: a hill climb at 90% FTP and an active recovery at 50%
> FTP both end up paired with whatever happens to be next in the queue.
> Cadencia bridges this gap by mapping each workout segment to a track
> that matches its intensity in tempo, energy and valence.
>
> ### How it works
>
> The user provides one of four inputs:
>
> 1. **Outdoor cycling**: a GPX file with elevation. The app estimates
>    power per segment using gravity + rolling resistance + aerodynamic
>    drag, then maps it to a Coggan zone (Z1–Z6).
> 2. **Outdoor running**: a GPX file. The app derives intensity from
>    terrain slope using Minetti's metabolic polynomial (J Appl Physiol
>    2002), independent of weight or speed.
> 3. **Indoor cycling**: a block-based session (warmup, intervals,
>    recoveries) built from scratch or from scientific templates (SIT,
>    HIIT 10-20-30, Norwegian 4×4).
> 4. **Indoor running**: a treadmill or track session built from
>    templates (Yasso 800s, Daniels Intervals, Threshold Cruise).
>
> The matching engine then ranks Spotify tracks by cadence (1:1 or 2:1
> half-time match against the workout's pedaling/striding cadence),
> energy (Audio Features) and valence, with deterministic scoring. The
> ordered list of track URIs is sent to the Spotify Web API to create a
> private playlist in the user's account.
>
> ### Why Spotify specifically
>
> Spotify is the only consumer streaming service that exposes Audio
> Features (tempo, energy, valence) and a public Web API for creating
> playlists. Apple Music requires a developer-signed JWT that cannot live
> in a client-only architecture; Amazon Music and YouTube Music do not
> expose playlist creation APIs. Cadencia's value proposition depends
> entirely on tempo-aware matching, which Spotify uniquely enables.
>
> ### Audience and business model
>
> Cadencia is a free brand-extension utility under Movimiento Funcional
> (movimientofuncional.com), an established Spanish coaching business
> founded in 2020 specialized in functional training for women aged 40+.
> The app reinforces the parent brand's authority in cardio training and
> serves as a top-of-funnel tool for the broader ecosystem (online
> courses, coaching, content). The app itself is not directly monetized.
>
> ### Privacy posture
>
> Fully client-side. No backend, no database, no analytics. The Spotify
> access token lives in `sessionStorage` and expires when the tab closes.
> The user can disconnect Spotify at any time from the preferences page
> or from spotify.com/account/apps/. Source code is open under the MIT
> license at github.com/wellfitness/cadencia.

---

## 3. Scope justification (campo «Why do you need each scope?»)

**Solo se solicita un scope:**

### `playlist-modify-private`

> Required to create the workout-synced private playlist in the user's
> Spotify account at the end of the wizard, when the user explicitly
> clicks "Create playlist". The app needs `playlist-modify-private`
> rather than `playlist-modify-public` because we deliberately create
> the playlist as private — the user can later make it public from the
> Spotify app if they wish, but we do not assume that consent.
>
> No other scopes are requested. We do not read the user's library, we
> do not track listening history, we do not access user-top-read,
> user-read-recently-played, or any other personal data. The only data
> sent to Spotify is the playlist name, an autogenerated description
> (route summary: distance / elevation / duration), and the array of
> track URIs.

### Optional (Modo TV) — solo si decides incluirlo en esta solicitud

> When the user enters the indoor "TV Mode" of an active session, the
> app additionally requests `user-modify-playback-state`,
> `user-read-playback-state` and `user-read-currently-playing` to allow
> per-block synchronized control of playback (skip to the track that
> matches the current block, pause/resume during rest periods, display
> currently-playing track in the full-screen training view). This is an
> optional path that requires Spotify Premium and is only triggered if
> the user explicitly opens TV Mode after creating the playlist.

> **Recomendación**: en la primera solicitud pedir SOLO
> `playlist-modify-private`. Una vez aprobado, ampliar el scope para
> Modo TV en una segunda solicitud («Scope extension request», explícito
> en la doc). Es más fácil aprobar incrementalmente que de golpe.

---

## 4. Demo video script (2:30)

Graba con OBS / QuickTime, sin edición compleja. Resolución mínima 1080p.
Voz en off opcional (ayuda al revisor pero no obligatoria).

### 0:00 — 0:15 · Intro
- Abre `https://cadencia.movimientofuncional.app` en Chrome.
- Voz: «Cadencia is a web app that synchronizes Spotify music with the
  intensity of your cardiovascular training.»
- Muestra la landing 5 segundos. Pulsa «Probar aplicación».

### 0:15 — 0:35 · Paso 1 (Tipo) y Paso 2 (Datos)
- Selecciona **Bici · Sesión por bloques** (más visual y rápido que GPX).
- Avanza a Datos. Rellena: peso 65, FCmáx 175, FC reposo 55. Avanza.

### 0:35 — 1:00 · Paso 3 (Sesión)
- Abre la galería de plantillas. Selecciona **Noruego 4×4**.
- Voz: «I pick a Norwegian 4×4 template — four 4-minute intervals at
  threshold with 3-minute recoveries.»
- Muestra los bloques y los rangos personalizados (bpm + W). Pulsa
  «Continuar».

### 1:00 — 1:30 · Paso 4 (Música)
- Voz: «The app matches each block to a track whose tempo, energy and
  valence align with that intensity zone.»
- Muestra la previsualización de la lista. Señala un bloque Z4 → un
  track de tempo 165-170 BPM y energy alta.
- Avanza al resultado.

### 1:30 — 2:00 · Paso 5 (Resultado) — el momento Spotify
- Muestra la lista final. Voz: «Now I create the playlist in my Spotify
  account.»
- Pulsa «Crear en Spotify». Pasa por el OAuth (PKCE).
- **Importante**: graba el redirect completo, que se vea spotify.com
  pidiendo autorización del scope `playlist-modify-private`.
- Vuelta a la app: «Lista creada». Pulsa «Abrir en Spotify».

### 2:00 — 2:20 · Verificación en Spotify
- Spotify se abre con la lista creada. Reproduce los primeros 5 segundos
  del primer track para demostrar funcionamiento real.
- Voz: «The playlist is now in my Spotify library, ordered to match the
  intensity of each interval.»

### 2:20 — 2:30 · Cierre
- Vuelve a Cadencia, abre `/preferencias`.
- Muestra la sección «Conexión con Spotify» y pulsa «Desconectar
  Spotify» para demostrar que existe el mecanismo accesible.
- Voz: «Users can disconnect Spotify at any time. The token lives only
  in sessionStorage. No data is sent to any backend.»
- Final.

---

## 5. Branding compliance checklist

Asegurar antes de enviar:

- [ ] Logo Spotify oficial descargado de https://newsroom.spotify.com/media-kit/
- [ ] SVGs subidos a `public/spotify/` con los nombres exactos del README
- [ ] Verificar visual en `MusicStep`, `ResultStep`, `CatalogEditorPage`
      y Modo TV: el wordmark aparece junto a la metadata.
- [ ] Cada track muestra «Abrir en Spotify» como link back (verificado en
      `PlaylistTrackRow`).
- [ ] Cover art se muestra sin manipular (en Cadencia hoy se usa un
      placeholder de zona; si en el futuro se trae cover art real desde
      Spotify, respetar las round corners 4-8 px y no aplicar overlays).
- [ ] App name no contiene «Spotify» y el logo de Cadencia no se parece
      al de Spotify (turquesa #00bec8, no verde, no circular).
- [ ] Mensaje oficial-style de Premium en `MusicControlBar`.

---

## 6. Submission steps (Developer Dashboard)

1. https://developer.spotify.com/dashboard → seleccionar la app
   «Cadencia».
2. Settings → tab «Quota extension request».
3. Rellenar el cuestionario de 4 pasos copiando los bloques de este
   documento.
4. Subir el vídeo demo y enlaces a privacy / terms / repo.
5. Enviar. Estado pasará a «Sent» (azul).
6. Esperar email a `movimientofuncional.net@gmail.com`. Tiempo máximo
   declarado: 6 semanas.

---

## 7. Si la solicitud se rechaza

Lo más probable es rechazo por el criterio MAU (250k). El email
explicará la razón. Pasos:

1. **Si rechazo por MAUs**: anotar la fecha. Volver a aplicar cuando
   tengas tracción real (5-10k usuarios mínimo, idealmente con
   crecimiento mensual visible) — Spotify ha aprobado apps con menos
   de 250k cuando hay caso de uso claro.
2. **Si rechazo por commercial viability**: replantear el modelo. Opción
   más rápida: añadir tier Premium €3/mes que desbloquea Modo TV
   avanzado + plantillas exclusivas. Documentar y reaplicar.
3. **Si rechazo por policy compliance**: revisar el motivo concreto en
   el email, ajustar y reaplicar. Los puntos sensibles ya cubiertos en
   este pase: Modo TV TTS (no es voice control), pestaña «Mi diario»
   (no es analytics sobre Spotify Content), atribución del logo en cada
   superficie.
4. **Si silencio (>6 semanas sin respuesta)**: enviar follow-up al
   contacto del Developer Dashboard. No reaplicar antes de obtener
   respuesta — duplica la cola.
