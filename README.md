# AulaRec — Graba tus explicaciones

Web app profesional de **grabación de pantalla** para profesores, formadores, creadores de
tutoriales y creadores de contenido para YouTube. Funciona **100 % en el navegador** y es
**serverless**: sin backend, sin base de datos, sin autenticación y sin subir vídeos a ningún
servidor. Toda la captura, composición, procesamiento y exportación ocurre localmente en el
ordenador del usuario.

Interfaz exclusivamente en **español**.

## Flujo

**Grabar → Revisar → Exportar**

1. **Nueva grabación** → asistente de preparación en 3 pasos: Pantalla, Cámara, Micrófono
   (verificación visual de todo antes de grabar; la grabación nunca empieza sola).
2. Selección de fuente (pantalla completa / ventana / pestaña) y modo **toda la pantalla** o
   **zona personalizada** (drag & drop, mover, redimensionar, dimensiones visibles).
3. Configuración previa en dos columnas con **vista previa en vivo** del resultado final:
   webcam circular superpuesta (4 esquinas, tamaño, ocultar), micrófono con medidor de nivel,
   resolución, FPS y calidad. Opción destacada **«Optimizar para YouTube»**.
4. Cuenta atrás 3-2-1 → **GRABANDO**. Barra flotante con pausa / reanudar / finalizar y
   cronómetro de tiempo realmente grabado.
5. Al finalizar: **«Tu vídeo está listo»** con reproductor, duración, resolución, formato y
   tamaño.
6. Recorte básico (inicio / final) y **exportación**: YouTube 1080p / 720p, Ligero 480p,
   Shorts 9:16, Cuadrado 1:1 y configuración personalizada. MP4 cuando es posible, WebM como
   alternativa. Descarga directa con nombre `grabacion-AAAA-MM-DD-HHMM.mp4`.

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm run dev      # servidor local con HMR
npm test         # tests unitarios (vitest)
npm run lint     # oxlint
```

## Build

```bash
npm run build    # tsc + vite build → dist/
npm run preview  # previsualizar la build de producción
```

## Deploy (Vercel)

1. Importa el repositorio en Vercel (framework: **Vite**).
2. Sin variables de entorno necesarias.
3. Activa **Web Analytics** en el dashboard del proyecto (el código ya está integrado).

## Arquitectura

```
src/
├── lib/            # format.ts (utilidades puras), analytics.ts (eventos de producto)
├── services/       # lógica sin React
│   ├── browserSupport.ts   # detección de getDisplayMedia/getUserMedia/MediaRecorder/captureStream
│   ├── screenCapture.ts    # getDisplayMedia + stopStream
│   ├── camera.ts           # getUserMedia (vídeo)
│   ├── audio.ts            # VoiceMixer: micrófono + audio del sistema vía Web Audio API
│   ├── compositor.ts       # CanvasCompositor: dibuja pantalla recortada + webcam circular
│   ├── recorder.ts         # MediaRecorder, detección de codecs, chunks periódicos
│   └── exporter.ts         # descarga directa o ffmpeg.wasm (lazy) para convertir/recortar/reescalar
├── hooks/          # useBrowserSupport, useScreenCapture, useCamera, useMicrophone,
│                   # useCompositor, useRecorder
├── studio/
│   ├── types.ts            # estados, presets, tipos centrales
│   └── StudioContext.tsx   # máquina de estados: idle → permissions → setup → countdown →
│                           # recording ⇄ paused → processing → preview → exporting → completed (+ error)
└── components/     # Home, wizard (3 pasos), CropSelector, SetupRecorder, RecordingView,
                    # ResultScreen (+ SimpleTrimmer, ExportPanel), PrivacyModal, ...
```

### Pipeline de grabación

```
getDisplayMedia() ─┐
                   ├→ <video> pantalla ─┐
getUserMedia() ────┘  (recorte por Canvas) │
                                          ├→ CanvasCompositor (rAF) → canvas.captureStream(30)
getUserMedia() ─→ VoiceMixer (Web Audio) ─┘         + pistas de audio ─→ MediaRecorder (chunks/5s)
```

El vídeo ya sale **compuesto durante la grabación**: no hay renderizado posterior para el
caso básico. `ffmpeg.wasm` solo se carga (lazy, desde CDN) cuando la exportación necesita
convertir formato, reescalar o aplicar recorte.

### PWA

`manifest.webmanifest` + iconos PNG (192/512/maskable, generados con
`node scripts/gen-icons.mjs`) + service worker manual (`public/sw.js`) con caché de la
interfaz para carga offline. La captura de pantalla depende del navegador y puede no estar
disponible sin conexión.

## APIs del navegador utilizadas

- `navigator.mediaDevices.getDisplayMedia()` — captura de pantalla/ventana/pestaña
- `navigator.mediaDevices.getUserMedia()` — cámara y micrófono
- `MediaRecorder` (+ `MediaRecorder.isTypeSupported()` para detección de codecs)
- `HTMLCanvasElement.captureStream()` — el canvas compuesto se vuelve stream grabable
- Canvas 2D API — composición en tiempo real (recorte + webcam circular)
- Web Audio API — mezcla de micrófono (+ audio del sistema opcional), medidor de nivel,
  control de volumen y constraints de voz (eco, ruido, ganancia automática)
- Service Worker / Web App Manifest — PWA instalable

## Compatibilidad conocida

| Navegador | Estado |
|---|---|
| Chrome / Edge (escritorio, última versión) | ✅ Soportado: MP4 (H.264) directo en la mayoría de versiones recientes |
| Firefox (escritorio) | ✅ Soportado (exporta WebM; MP4 vía conversión local) |
| Safari (escritorio) | ⚠️ Parcial: `getDisplayMedia` limitado según versión |
| Móvil / tablet | ℹ️ La interfaz se puede explorar, pero la captura de pantalla no suele estar permitida; la app lo explica en lugar de forzarla |

La app comprueba al inicio las 4 APIs críticas y muestra un mensaje comprensible si falta
alguna (detalles técnicos solo en consola).

## Privacidad

> Tus vídeos no se suben a ningún servidor. La grabación y el procesamiento se realizan
> localmente en tu navegador.

Los Blob generados viven solo en memoria / almacenamiento temporal del navegador mientras
dura la sesión. Analytics registra únicamente eventos de producto (`recording_started`,
`recording_completed`, `export_started`, …), nunca audio, vídeo, capturas ni nombres de
archivo.

## Limitaciones honestas

- `ffmpeg.wasm` necesita conexión a internet la primera vez (su núcleo se descarga de un CDN).
- No hay E2E automatizado del flujo real de captura en este entorno: `getDisplayMedia()`
  requiere interacción humana con el selector del navegador. Verificado: `tsc`, build de
  producción, 18 tests unitarios y revisión del pipeline.
- WebCodecs no se usa en esta versión: MediaRecorder + ffmpeg.wasm cubren los casos con
  menos complejidad; queda como mejora futura.

---

Una herramienta de **Jon Peciña** · jpecina@gmail.com
