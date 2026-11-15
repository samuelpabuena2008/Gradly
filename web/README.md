# Gradly · frontend (`web/`)

Interfaz de Gradly: un espacio de trabajo oscuro y violeta, inspirado en la estructura de Obsidian (ribbon, explorador, pestañas, vista de grafo, paleta de comandos y barra de estado), donde el estudiante ve su malla como un grafo y cómo le puede ir en las materias que vienen.

> **Las notas se procesan en el navegador y no salen del computador.** No hay llamadas a la API, ni analítica, ni fuentes o scripts de terceros en tiempo de ejecución (las tipografías vienen empaquetadas con `@fontsource`). Guardar las notas en `localStorage` es opcional (apagado por defecto) y siempre hay un botón visible para borrarlas.

## Cómo correrlo

Requisitos: Node 20 o superior.

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (Vite) |
| `npm run build` | Revisa los tipos (`tsc --noEmit`) y compila a `dist/` |
| `npm run preview` | Sirve la compilación de `dist/` |
| `npm test` | Pruebas unitarias y de componentes (Vitest) |
| `npm run test:e2e` | Pruebas de extremo a extremo y de accesibilidad (Playwright + axe, solo Chromium) |
| `npm run contraste` | Verifica los pares de color de los tokens contra WCAG 2.2 AA |

La primera vez que corras Playwright en una máquina nueva: `npx playwright install chromium`.

Las pruebas E2E levantan su propio servidor en el puerto **5199** (no en el 5173), para no probar por error otra aplicación que ya ocupe el puerto de desarrollo. Si ya tienes uno corriendo en ese puerto, lo reutilizan.

> **Windows:** corre las pruebas desde PowerShell con la unidad en mayúscula (`C:\…`). Desde Git Bash, Vitest falla al resolver las rutas.

## Estructura

```
web/
├─ index.html              CSS crítico y splash en HTML puro (sin flash blanco)
├─ public/                 logo-mark / logo-lockup / logo-mono / favicon (SVG)
├─ scripts/contraste.mjs   verificación de contraste de los tokens
├─ e2e/                    Playwright: flujos, errores, teclado, móvil, axe y fuzz
└─ src/
   ├─ styles/              tokens.css (única fuente de color, espaciado y movimiento) y global.css
   ├─ types/               tipos por dominio (malla, notas, modelo)
   ├─ lib/                 lógica pura, sin React
   │  ├─ graph/ model/ import/   núcleo del proyecto (grafos, predicción, red, importadores): no se toca desde la interfaz
   │  └─ ui/                     lógica propia de la interfaz: estado de nodos, escenario, layout, fusión de notas…
   ├─ store/               estado global (zustand): notas reales, ajustes, paneles, grafo, avisos
   ├─ components/          piezas compartidas: Logo, Semáforo, BarraRango, Cajon, Toaster, ErrorBoundary…
   └─ features/<pantalla>/ cada pantalla con su CSS al lado
      ├─ arranque/ shell/ malla/ materia/ prediccion/ modelo/ laboratorio/
      └─ notas/ simulador/ bienvenida/ ayuda/
```

Las pruebas unitarias viven junto al código (`*.test.ts` / `*.test.tsx`). El entorno global de Vitest es `node`; las pruebas de componentes declaran `// @vitest-environment jsdom` en su propio archivo.

## Decisiones de diseño

- **Un solo tema, «observatorio violeta».** Todo el CSS consume `var(--…)` de `tokens.css`; no hay colores sueltos en los componentes. `--text-faint` se subió para que el texto de apoyo también cumpla AA.
- **El color nunca va solo.** Cada estado del semáforo lleva ícono y texto («Vas bien preparado», «Conviene reforzar», «Dale prioridad»), y los nodos del grafo cambian de forma según su estado.
- **Notas reales y escenario hipotético separados.** El store guarda `notasReales` (lo importado, fuente de verdad) y `ajustes` (lo que se simula). Las notas efectivas se derivan de ambos, así el simulador no pierde lo que importaste y siempre se puede restaurar.
- **React Flow se mantiene** (decisión documentada en `docs/PLAN.md` §5), con nodos y aristas propios, memoizados. El layout orgánico es una simulación de fuerzas propia, cargada bajo demanda.
- **Enrutamiento por hash** (`#/malla`, `#/predicciones`, `#/modelo`, `#/materia/MAT1101`). Nunca se pone una nota en la URL.
- **Honestidad del modelo.** Los estudiantes de entrenamiento son simulados y los pesos son asociaciones, no causas; la vista «Modelo» lo dice de frente y las métricas se leen de `data/pesos.json`, nunca se inventan.
- **Tono.** Español colombiano neutro, tuteo y sin sentencias: las predicciones son estimaciones.

### Responsive

| Ancho | Layout |
|---|---|
| ≥ 1280 px | Tres paneles redimensionables: explorador · centro con pestañas · inspector |
| 900–1279 px | El inspector pasa a **cajón** lateral con telón |
| < 900 px | **Barra inferior** (Malla · Notas · Predicciones · Más), **hoja inferior** para el detalle (se cierra deslizando), y la malla se puede ver como **grafo o lista** por semestre |

En pantallas táctiles todos los controles miden al menos 44 × 44 px y se respetan las zonas seguras (`safe-area-inset`). El modo se detecta con `matchMedia` (`components/usePantalla.ts`).

### Accesibilidad (WCAG 2.2 AA)

Anillo de foco violeta de 2 px, enlace «Saltar al contenido», roles `tree`, `tablist`/`tab`/`tabpanel` y `dialog` con trampa de foco y retorno de foco, anuncios con `aria-live="polite"` al simular, y equivalentes completos para `prefers-reduced-motion`, `forced-colors` y navegación solo con teclado. La suite `e2e/a11y.spec.ts` exige **cero violaciones serias o críticas** de axe en cada vista y en cada modal, en escritorio y en móvil.

### Rendimiento

Presupuesto: JS inicial por debajo de 250 kB gzip. El lector de PDF, el layout orgánico, `html-to-image`, el Laboratorio y la vista Modelo se descargan bajo demanda y muestran esqueletos mientras llegan. Revisa el tamaño con la salida de `npm run build`.

## Datos de la malla y del modelo

La interfaz importa `data/malla_sistemas.json` y `data/pesos.json` (contrato compartido con `model/` y `api/`, ver `docs/PLAN.md` §2). Esta carpeta no los modifica.
