# MapFlow — Design System & Screen Specifications

> **Fuente**: Proyecto Stitch `MapFlow Dashboard Financiero` (ID: `13148426259663261839`)
> **Paleta**: Serene Navigator · **Tipografía**: Inter · **Dispositivo**: Desktop (1280px)
> **Última actualización Stitch**: 3 Jul 2026

---

## 1. Filosofía de Diseño

### Brand & Style — "Serene Navigator"

El sistema de diseño está diseñado para PYMEs que navegan paisajes financieros complejos.
Prioriza **claridad, confiabilidad y precisión**, evocando una sensación de control organizado
y crecimiento profesional.

**Estilo visual**: Modern Corporate con alta densidad de información que se mantiene legible y
sin saturación. Usa espacios blancos generosos para separar conjuntos de datos financieros.

**Narrativa visual**: Un "norte financiero" — guiando a los dueños de negocio a través de sus
datos con mano firme y confiable.

---

## 2. Paleta de Colores

### 2.1 Colores Semánticos del Negocio

| Nombre | Hex | Uso |
|---|---|---|
| **Ink Blue** | `#0F172A` | Color primario: autoridad y estabilidad profesional |
| **Emerald Health** | `#10B981` | Rendimiento positivo, crecimiento, estado "Pagado" |
| **Caution Amber** | `#F59E0B` | Estado "Pendiente" |
| **Urgent Red** | `#EF4444` | Estado "Vencido", alertas, tendencias negativas |
| **Slate Neutral** | `#64748B` | Color neutral para textos secundarios |

### 2.2 Paleta Completa del Design System (Material Design 3 — Serene Navigator)

#### Superficies

| Token | Hex | Uso |
|---|---|---|
| `surface` | `#FAF9F4` | Fondo principal de la app |
| `surface-dim` | `#DBDAD5` | Superficie atenuada |
| `surface-bright` | `#FAF9F4` | Superficie brillante |
| `surface-container-lowest` | `#FFFFFF` | Cards y contenido Level 1 |
| `surface-container-low` | `#F5F4EF` | Fondos de cabeceras de tabla, sidebar |
| `surface-container` | `#EFEEE9` | Contenedores intermedios |
| `surface-container-high` | `#E9E8E3` | Chips, filtros |
| `surface-container-highest` | `#E3E2DE` | Surface variant máxima |
| `surface-variant` | `#E3E2DE` | Hover en filas de tabla |
| `background` | `#FAF9F4` | Fondo global |
| `inverse-surface` | `#30312E` | Superficies inversas (tooltips) |

#### Colores Primarios

| Token | Hex | Uso |
|---|---|---|
| `primary` | `#4E6544` | Botones principales, enlaces activos |
| `on-primary` | `#FFFFFF` | Texto sobre primary |
| `primary-container` | `#B7D1A9` | Fondos de contenedores primarios, avatares |
| `on-primary-container` | `#445A3B` | Texto sobre primary-container |
| `primary-fixed` | `#D0EAC1` | Elementos fijos primarios |
| `primary-fixed-dim` | `#B4CEA6` | Variante atenuada |
| `inverse-primary` | `#B4CEA6` | Primario inverso |

#### Colores Secundarios

| Token | Hex | Uso |
|---|---|---|
| `secondary` | `#42682F` | Acciones de éxito, botón "Enviar", "Pagada" |
| `on-secondary` | `#FFFFFF` | Texto sobre secondary |
| `secondary-container` | `#C2EFA7` | Badges de éxito, nav activo |
| `on-secondary-container` | `#486E34` | Texto sobre secondary-container |
| `secondary-fixed` | `#C2EFA7` | Elementos fijos secundarios |
| `secondary-fixed-dim` | `#A7D38E` | Variante atenuada |

#### Colores Terciarios

| Token | Hex | Uso |
|---|---|---|
| `tertiary` | `#7B5264` | Acentos, badges "Por vencer" |
| `on-tertiary` | `#FFFFFF` | Texto sobre tertiary |
| `tertiary-container` | `#EFBBD0` | Fondo badges terciarios |
| `on-tertiary-container` | `#70485A` | Texto sobre tertiary-container |
| `tertiary-fixed` | `#FFD8E7` | Elementos fijos terciarios |
| `tertiary-fixed-dim` | `#ECB8CD` | Variante atenuada |

#### Error

| Token | Hex | Uso |
|---|---|---|
| `error` | `#BA1A1A` | Estados "Vencida", alertas de error |
| `on-error` | `#FFFFFF` | Texto sobre error |
| `error-container` | `#FFDAD6` | Fondo badges "Vencida" |
| `on-error-container` | `#93000A` | Texto sobre error-container |

#### Outline & Texto

| Token | Hex | Uso |
|---|---|---|
| `outline` | `#74796F` | Bordes de inputs, separadores |
| `outline-variant` | `#C4C8BD` | Bordes sutiles (cards, tablas) |
| `on-surface` | `#1B1C19` | Texto principal |
| `on-surface-variant` | `#444840` | Texto secundario, labels |
| `on-background` | `#1B1C19` | Texto sobre fondo |
| `inverse-on-surface` | `#F2F1EC` | Texto sobre superficies inversas |
| `surface-tint` | `#4E6544` | Tinte de elevación |

---

## 3. Tipografía

**Font Family**: `Inter` (Google Fonts) — utilizada exclusivamente en todos los niveles.

> **Regla**: Para cifras financieras, siempre habilitar **tabular figures (tnum)** para alinear
> decimales y símbolos de moneda verticalmente.

### Escala Tipográfica

| Token | Tamaño | Peso | Line Height | Letter Spacing | Uso |
|---|---|---|---|---|---|
| `display-lg` | 48px | 700 | 56px | -0.02em | Títulos hero (no usado en app) |
| `headline-lg` | 40px | 700 | 48px | -0.02em | Títulos de página desktop |
| `headline-lg-mobile` | 32px | 700 | 38px | -0.02em | Títulos de página mobile |
| `headline-md` | 28px | 700 | 34px | -0.01em | Valores financieros grandes |
| `headline-sm` | 20px | 700 | 26px | — | Subtítulos de sección, cards |
| `body-lg` | 18px | 300 | 28px | — | Descripciones principales |
| `body-md` | 16px | 300 | 24px | — | Texto body general |
| `body-sm` | 14px | 300 | 20px | — | Texto secundario, datos de tabla |
| `label-bold` | 12px | 700 | 16px | 0.05em | Labels, badges, headers tabla |
| `label-light` | 12px | 300 | 16px | — | Captions, meta info |
| `numeric-data` | 14px | 600 | 20px | — | Cifras en tablas (tnum) |

---

## 4. Layout & Espaciado

### Grid System

| Breakpoint | Columnas | Gutters | Sidebar | Notas |
|---|---|---|---|---|
| **Desktop** (≥1280px) | 12 columnas | 24px | 256px fijo | Max-width container: 1280px |
| **Tablet** (768–1279px) | 8 columnas | 20px | Collapsed (icon rail) | Sidebar → hamburger |
| **Mobile** (<768px) | 4 columnas | 16px | Hidden | Tablas → card-based layouts |

### Spacing Tokens

| Token | Valor | Uso |
|---|---|---|
| `unit` | `8px` | Base grid unit |
| `gutter` | `24px` | Espacio entre columnas y cards |
| `stack-sm` | `8px` | Espaciado vertical mínimo |
| `stack-md` | `16px` | Espaciado vertical medio |
| `stack-lg` | `24px` | Padding interno de cards |
| `margin-mobile` | `16px` | Márgenes laterales mobile |
| `margin-desktop` | `48px` | Márgenes laterales desktop |
| `container-max` | `1280px` | Ancho máximo del contenedor |

---

## 5. Elevación & Profundidad

| Nivel | Uso | Estilo |
|---|---|---|
| **Level 0** (Background) | Fondo base | `#FAF9F4` sin sombra |
| **Level 1** (Cards) | Cards, contenido | `#FFFFFF` con `border: 1px solid #C4C8BD`, shadow: `0 2px 4px rgba(15,23,42,0.04)` |
| **Level 2** (Modals) | Modals, popovers | `#FFFFFF` con shadow: `0 8px 16px rgba(15,23,42,0.08)` |
| **Glass Card** | Cards destacadas | `background: rgba(255,255,255,0.7)`, `backdrop-filter: blur(8px)`, `border: 1px solid #B7D1A9` |

> **Principio**: Flat-but-tactile — bordes como definición estructural primaria, evitar sombras
> pesadas o glows.

---

## 6. Formas (Border Radius)

| Token | Valor | Uso |
|---|---|---|
| `sm` | `0.125rem` (2px) | Micro-elementos |
| `DEFAULT` | `0.25rem` (4px) | Botones, inputs, small cards |
| `md` | `0.375rem` (6px) | Elementos intermedios |
| `lg` | `0.5rem` (8px) | Cards de dashboard, contenedores |
| `xl` | `0.75rem` (12px) | Cards grandes, sidebar nav items |
| `2xl` | `1rem` (16px) | Cards hero, modals |
| `full` | `9999px` | Badges pill, avatares, search bar |

---

## 7. Iconografía

**Sistema**: Material Symbols Outlined (Google Fonts)

```
font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
```

### Iconos por Sección

| Sección | Icono | Variación |
|---|---|---|
| Dashboard | `dashboard` | Default |
| Facturas | `description` | `FILL 1` cuando activo |
| Egresos | `payments` | Default |
| Reportes | `analytics` / `bar_chart` | `FILL 1` cuando activo |
| Configuración | `settings` | `FILL 1` cuando activo |
| Notificaciones | `notifications` | Default |
| Ayuda | `help_outline` / `help` | Default |
| Buscar | `search` | Default |
| Agregar | `add` / `add_circle` | `FILL 1` para add_circle |
| WhatsApp | `chat` / `chat_bubble` | Default |
| Descargar | `file_download` / `download` | Default |
| IA Asistente | `smart_toy` | `FILL 1` |
| Mapa/Explore | `explore` / `map` | `FILL 1` |

---

## 8. Componentes

### 8.1 Sidebar (SideNavBar)

```
Ancho: 256px (w-64), fijo a la izquierda
Fondo: surface-container-low (#F5F4EF)
Borde: border-right 1px outline-variant
Padding: 24px vertical, 16px horizontal
```

**Estructura**:
- Logo + nombre "MapFlow" (`headline-sm`, color `primary`)
- Subtítulo "Copiloto Financiero" / "Financial Co-pilot" (`label-light`)
- Nav items: icono + texto, `rounded-xl`, hover: `bg-secondary-container/20`
- Estado activo: `text-primary font-bold`, `bg-secondary-container/10`, `border-r-2 border-primary`
- Botón CTA inferior: "Nueva Factura", `bg-primary text-on-primary`, `rounded-xl`

### 8.2 TopAppBar

```
Alto: 64px (h-16), sticky top
Fondo: surface (#FAF9F4)
Borde: border-bottom 1px outline-variant
Posición: left offset = sidebar width (ml-64)
```

**Estructura**:
- Título de sección o barra de búsqueda (izquierda)
- Search: `rounded-full`, `bg-surface-container-low`, icono `search`
- Notificaciones + Ayuda + Avatar usuario (derecha)

### 8.3 Botones

| Variante | Fondo | Texto | Borde | Hover |
|---|---|---|---|---|
| **Primary** | `primary` (#4E6544) | `on-primary` (#FFF) | — | `opacity-90` |
| **Secondary** | `secondary` (#42682F) | `on-secondary` (#FFF) | — | `opacity-90` |
| **Outlined** | Transparente | `secondary` | `1px secondary` | `bg-secondary/5` |
| **Tonal** | `primary-container/20` | `on-primary-container` | — | `bg-primary text-on-primary` |
| **Ghost** | Transparente | `on-surface-variant` | — | `bg-surface-variant` |

**Forma**: `rounded-xl` (12px) · **Padding**: `px-6 py-3` · **Tipografía**: `label-bold`

### 8.4 Status Badges (Pill)

| Estado | Fondo | Texto | Ejemplo |
|---|---|---|---|
| **Vencida** (Overdue) | `error` (#BA1A1A) | `on-error` (#FFF) | `VENCIDA` |
| **Por vencer** (Due Soon) | `tertiary-container` | `on-tertiary-container` | `POR VENCER` |
| **Pendiente** (Pending) | `tertiary-container` | `on-tertiary-container` | `PENDIENTE` |
| **Pagada** (Paid) | `secondary` (#42682F) | `on-secondary` (#FFF) | `PAGADA` |
| **Creciente** (Growing) | `secondary-container` | `on-secondary-container` | `CRECIENTE` |
| **Estable** (Stable) | `secondary-container` | `on-secondary-container` | `ESTABLE` |
| **Optimizar** | `error-container` | `on-error-container` | `OPTIMIZAR` |

**Forma**: `rounded-full` (pill) · **Tipografía**: `label-bold` 11px uppercase

### 8.5 Summary Cards (Bento Grid)

```
Fondo: surface-container-lowest (#FFFFFF) o tactile-card
Borde: 1px solid outline-variant (#C4C8BD)
Border-radius: rounded-xl (12px) o rounded-2xl (16px)
Padding: 24px (p-6)
```

**Estructura interna**:
- Label superior: `label-bold` o `label-light`, uppercase, `text-on-surface-variant`
- Valor principal: `headline-md` o `headline-lg`
- Indicador de tendencia: icono + `label-light`
- Icono decorativo: en circle `w-14 h-14 rounded-full`, color semántico

### 8.6 Data Tables

```
Container: surface-container-lowest, borde outline-variant, rounded-xl
Header row: bg-surface-container-low, border-bottom
```

| Elemento | Estilo |
|---|---|
| **Header cells** | `label-bold`, uppercase, `text-on-surface-variant`, tracking-wider |
| **Data cells** | `body-sm` o `body-md`, `text-on-surface` |
| **Row hover** | `bg-surface-container` (#EFEEE9) transition |
| **Row dividers** | `divide-y divide-outline-variant` |
| **Actions** | Ocultas por defecto, visibles en hover (`opacity-0 → opacity-100`) |
| **Pagination** | Footer: `bg-surface-container-low`, botones numerados |

### 8.7 Input Fields

```
Fondo: surface-container-low (#F5F4EF)
Borde: 1px solid primary-container (#B7D1A9) o outline-variant
Border-radius: rounded-lg (8px)
Padding: p-3 (12px)
Focus: ring-2 ring-primary, border-transparent
Label: label-bold, posicionado arriba del campo
```

### 8.8 Filtros

```
Contenedor: bg-surface, border outline-variant, rounded-xl, p-4
Chips de filtro: bg-surface-container-high, rounded-lg, px-3 py-1.5
Select: bg-transparent, border-none, body-sm
```

### 8.9 AI Assistant Panel

```
Fondo: primary-container/20
Borde: 1px solid primary-container
Border-radius: rounded-xl
Decoración: blur circle en esquina (-right-8 -top-8)
```

**Elementos internos**:
- Header: icono `smart_toy` (FILL 1) + label "Asistente MapFlow"
- Sugerencia: card `bg-surface`, borde `primary-container/50`
- Borrador editable: `bg-surface/50`, borde `outline-variant`
- Botón acción: "Enviar por WhatsApp", `bg-secondary`

### 8.10 Toggle Switch

```css
/* Dimensiones: 44px × 24px */
.switch { width: 44px; height: 24px; }
.slider {
  background-color: #C4C8BD; /* outline-variant - OFF */
  border-radius: 24px;
}
input:checked + .slider {
  background-color: #42682F; /* secondary - ON */
}
/* Knob: 18px × 18px, white, translateX(20px) cuando ON */
```

---

## 9. Micro-interacciones

| Interacción | Efecto | Duración |
|---|---|---|
| **Fade-in de contenido** | `opacity: 0→1`, `translateY: 10px→0` | 600ms ease-out |
| **Hover en filas tabla** | `bg-surface-container`, translateX(4px) opcional | 200ms |
| **Button press** | `scale(0.98)` en mousedown, `scale(1)` en mouseup | Instantáneo |
| **Save button** | Spinner → "¡Guardado!" con cambio de color | 1200ms + 2000ms |
| **Input focus** | `scale(1.01)` en el contenedor padre | 200ms ease-out |
| **Sidebar active** | `cubic-bezier(0.4, 0, 0.2, 1)` transición | 200ms |
| **Login form float** | `translateY(0→-10px→0)` keyframe animation | 6s infinite |
| **Progress bar** | Animación de width `0% → N%` al cargar | 1000ms |

### Scrollbar Custom

```css
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #B7D1A9; border-radius: 10px; }
```

---

## 10. Especificaciones de Pantallas

### 10.1 Login — "Iniciar Sesión"

**Stitch Screen ID**: `750d59fd2c7f4dc3b9100ccae482b4df`
**Título**: Iniciar Sesión - MapFlow (Puntos Verdes Degradados)
**Dimensiones**: 2560×2048 · **Layout**: Full-screen, split 40/60

#### Estructura
```
┌─────────────────────────────────────────────────────┐
│  ┌──────────┐  ┌─────────────────────────────────┐  │
│  │           │  │                                 │  │
│  │  Branding │  │        Login Form Card          │  │
│  │  Panel    │  │                                 │  │
│  │  (40%)    │  │  - Email input con icono mail   │  │
│  │           │  │  - Password input con icono     │  │
│  │  Logo     │  │  - Btn "Iniciar Sesión"         │  │
│  │  Tagline  │  │  - Divider "o continuar con"    │  │
│  │  Desc     │  │  - Btn Google SSO               │  │
│  │           │  │  - Link "Crear cuenta"          │  │
│  │           │  │         (60%)                    │  │
│  └──────────┘  └─────────────────────────────────┘  │
│         ┌──────────────────────────┐                │
│         │  🔒 Acceso Seguro badge  │                │
│         └──────────────────────────┘                │
│  ▓▓▓▓▓ WebGL Shader Background (green dots grid) ▓▓ │
└─────────────────────────────────────────────────────┘
```

#### Elementos clave
- **Fondo interactivo**: WebGL shader con grid de puntos verdes degradados que reaccionan al mouse
- **Panel izquierdo**: Logo "MapFlow" con icono `explore`, tagline "Tu copiloto financiero: cobra, controla y crece"
- **Form card**: Glassmorphism (`bg-white/60 backdrop-blur-md`), `rounded-2xl`, `shadow-xl`
- **Inputs**: Con iconos (`mail`, `lock`), fondo `surface/80`, focus ring `primary`
- **CTA**: "Iniciar Sesión" full-width, `bg-primary`, con flecha
- **SSO**: Botón Google con logo SVG
- **Badge inferior**: "Acceso Seguro & Encriptado" con `verified_user`

---

### 10.2 Dashboard — "Dashboard MapFlow Simplificado"

**Stitch Screen ID**: `0d51ede063834b1db3c3bb57e6e4e635`
**Título**: Dashboard MapFlow Simplificado
**Dimensiones**: 2560×2918 · **Layout**: Sidebar + TopBar + Bento Grid

#### Estructura
```
┌────────┬──────────────────────────────────────────┐
│        │  TopAppBar: Título + Search + Actions    │
│  Side  ├──────────────────────────────────────────┤
│  bar   │                                          │
│        │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│  Logo  │  │ KPI  │ │ KPI  │ │ KPI  │ │ KPI  │    │
│  Nav   │  │ Card │ │ Card │ │ Card │ │ Card │    │
│  Items │  └──────┘ └──────┘ └──────┘ └──────┘    │
│        │                                          │
│        │  ┌──────────────────┐ ┌────────────────┐ │
│        │  │  Flujo de Caja   │ │  Facturas      │ │
│        │  │  (Line Chart)    │ │  Pendientes    │ │
│        │  └──────────────────┘ └────────────────┘ │
│        │                                          │
│  CTA:  │  ┌──────────────────────────────────────┐│
│  Nueva │  │  Tabla últimas transacciones         ││
│ Factura│  └──────────────────────────────────────┘│
└────────┴──────────────────────────────────────────┘
```

#### KPI Cards
- Total por cobrar, Total vencido, Ingresos del mes, etc.
- Icono circular (`w-14 h-14 rounded-full`) + label + valor `headline-md`

---

### 10.3 Cuentas por Cobrar — "Cuentas por Cobrar"

**Stitch Screen ID**: `be36e336f3b54674bd5ed649762f59e0`
**Título**: Cuentas por Cobrar - MapFlow
**Dimensiones**: 2560×2176 · **Layout**: Sidebar + TopBar + Summary + Filters + Table

#### Estructura
```
┌────────┬──────────────────────────────────────────┐
│        │  TopAppBar: "Cuentas por cobrar" + Search│
│  Side  ├──────────────────────────────────────────┤
│  bar   │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│        │  │Total por  │ │Total     │ │Eficiencia│ │
│  Nav:  │  │Cobrar     │ │Vencido   │ │Card      │ │
│ Facturas│ │$125,400   │ │$42,100   │ │+12% más  │ │
│ (activo)│ └──────────┘ └──────────┘ └──────────┘ │
│        │                                          │
│        │  ┌──────────────────────────────────────┐│
│        │  │  Filters: Estado | Cliente | Periodo ││
│        │  └──────────────────────────────────────┘│
│        │                                          │
│        │  ┌──────────────────────────────────────┐│
│        │  │  Table: Cliente, N° factura, Monto,  ││
│        │  │  Emisión, Vencimiento, Estado, Accion││
│        │  │  ─────────────────────────────────── ││
│        │  │  EcoTech     FAC-001  $24,500 VENCIDA││
│        │  │  Nova Log.   FAC-012  $15,200 POR V. ││
│        │  │  Urban Des.  FAC-998   $8,400 PAGADA ││
│        │  │  Global Con. FAC-005  $17,600 VENCIDA││
│        │  ├──────────────────────────────────────┤│
│        │  │  Pagination: 1-10 de 124 facturas    ││
│        │  └──────────────────────────────────────┘│
└────────┴──────────────────────────────────────────┘
```

#### Elementos únicos
- **Summary Bento**: 3 columnas (Total por cobrar, Total vencido, Card de eficiencia)
- **Filtros**: Estado (Todas/Pendientes/Vencidas/Pagadas), Cliente, Periodo (date picker)
- **Tabla**: Avatares con iniciales del cliente, acciones hover (ver detalle, WhatsApp)
- **Paginación**: Botones numéricos con estilo active `bg-primary`

---

### 10.4 Detalle de Factura

**Stitch Screen ID**: `b0ae0bfe68674f70b20bd7972808b1b4`
**Título**: Detalle de Factura - MapFlow
**Dimensiones**: 2560×2458 · **Layout**: Sidebar + TopBar (con "Volver") + Bento Grid

#### Estructura
```
┌────────┬──────────────────────────────────────────┐
│        │  ← VOLVER A LISTADO          🔔 ? 👤    │
│  Side  ├──────────────────────────────────────────┤
│  bar   │                                          │
│        │  FAC-2023-001  [VENCIDA]                 │
│        │  Tech Solutions S.A.                     │
│        │  [Marcar pagada] [Enviar recordatorio]   │
│        │                                          │
│        │  ┌──────────────────┐ ┌────────────────┐ │
│        │  │  Info Card (8col)│ │ AI Panel (4col)│ │
│        │  │  Monto: $8,200  │ │ 🤖 Asistente   │ │
│        │  │  Mora: 15 días  │ │  Sugerencia    │ │
│        │  │  Emisión/Vencim.│ │  Borrador edit │ │
│        │  │  Concepto       │ │  [WhatsApp]    │ │
│        │  └──────────────────┘ └────────────────┘ │
│        │                                          │
│        │  ┌──────────────────────────────────────┐│
│        │  │  Historial de recordatorios (12col)  ││
│        │  │  Fecha | Canal | Tono | Estado       ││
│        │  │  10 Nov │ Email │ AMABLE │ Respondido││
│        │  │  05 Nov │ WhatsApp │ FIRME │ Enviado ││
│        │  └──────────────────────────────────────┘│
└────────┴──────────────────────────────────────────┘
```

#### Elementos únicos
- **Glass Card** para info principal: `rgba(255,255,255,0.7)`, `backdrop-filter: blur(8px)`
- **AI Assistant Panel**: Sugerencias inteligentes + borrador editable de mensaje
- **Historial de recordatorios**: Tabla con canal (Email/WhatsApp), tono (AMABLE/FIRME), estado
- **Tone Badges**: AMABLE → `secondary-container`, FIRME → `tertiary-container`

---

### 10.5 Egresos y Gastos

**Stitch Screen ID**: `4093db3a3a3d4559a9771abcef05259a`
**Título**: Egresos y Gastos - MapFlow
**Dimensiones**: 2560×2048 · **Layout**: Sidebar + TopBar + Bento Cards + Table

#### Estructura
```
┌────────┬──────────────────────────────────────────┐
│        │  SearchBar                    🔔 ? 👤    │
│  Side  ├──────────────────────────────────────────┤
│  bar   │  Egresos y gastos     [Registrar gasto]  │
│        │                                          │
│  Nav:  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ Egresos│  │Total gast.│ │Gasto vs  │ │Donut     │ │
│ (activo)│ │$35,200   │ │Presup.65%│ │Categorías│ │
│        │  │↑12% más  │ │Progress  │ │Nóm40%   │ │
│        │  └──────────┘ └──────────┘ └──────────┘ │
│        │                                          │
│        │  Filtros: Categoría | Periodo  📥 🖨️     │
│        │                                          │
│        │  ┌──────────────────────────────────────┐│
│        │  │  Table: Fecha, Concepto, Categoría,  ││
│        │  │  Proveedor, Monto, Origen, Acciones  ││
│        │  │  ─────────────────────────────────── ││
│        │  │  12 Oct │ Nómina │ $12,450    CSV    ││
│        │  │  10 Oct │ Suministros │ $1,200 Web   ││
│        │  │  08 Oct │ AWS │ $4,820    WhatsApp   ││
│        │  └──────────────────────────────────────┘│
└────────┴──────────────────────────────────────────┘
```

#### Elementos únicos
- **Tactile Cards**: `border: 1px solid #B7D1A9`, hover: `border-color: #4E6544`
- **Progress Bar**: `bg-primary h-full rounded-full`, animación de width
- **Donut Chart SVG**: Segmentos primary/secondary/tertiary/outline
- **Category Badges**: Pill con fondo tonal (`primary-container/20`, `secondary-container/20`, etc.)
- **Origen column**: Iconos (laptop_mac, language, chat_bubble) + tipo (CSV, Web, WhatsApp)

---

### 10.6 Reportes Financieros

**Stitch Screen ID**: `48c69958cfdc4a588f5ff946c9e533de`
**Título**: Reportes Financieros - MapFlow
**Dimensiones**: 2560×2630 · **Layout**: Sidebar + TopBar + Bento Grid + Table + Footer

#### Estructura
```
┌────────┬──────────────────────────────────────────┐
│        │  SearchBar                    🔔 ? JP    │
│  Side  ├──────────────────────────────────────────┤
│  bar   │  Reportes y Análisis                     │
│        │  [Mes actual] [Trimestre] [Año] [Custom] │
│  Nav:  │                                          │
│Reportes│  ┌────────────────────┐ ┌──────────────┐ │
│(activo)│  │  Flujo de Caja     │ │ Downloads:   │ │
│        │  │  Bar Chart (2col)  │ │ • Estado Res.│ │
│        │  │  ENE-JUN barras    │ │ • Balance    │ │
│        │  │  Ingresos/Egresos  │ │ • Egresos    │ │
│        │  │                    │ │ • Proyección │ │
│        │  └────────────────────┘ └──────────────┘ │
│        │                                          │
│        │  ┌──────────────────────────────────────┐│
│        │  │  Resumen Ejecutivo por Categoría      ││
│        │  │  Categoría | Ingresos | Egresos | Net││
│        │  │  Ventas    │ $45,200  │ $12,450 │ +32││
│        │  │  Consultor.│ $18,900  │ $2,100  │ +16││
│        │  │  Gastos Op.│ $0       │ $8,400  │ -8k││
│        │  └──────────────────────────────────────┘│
│        │                                          │
│        │  ┌──────────────────────────────────────┐│
│        │  │  🗺️ Análisis de Ubicación Geográfica  ││
│        │  │  CTA: "Abrir MapFlow Insights"       ││
│        │  └──────────────────────────────────────┘│
└────────┴──────────────────────────────────────────┘
```

#### Elementos únicos
- **Period selector**: Tabs con estilo toggle (`bg-white shadow-sm` para activo)
- **Bar Chart CSS**: Barras con `bg-primary` y `bg-primary-container/30`, hover interactivo
- **Download cards**: Iconos de color por tipo + hover `bg-white`
- **Proyección IA card**: `bg-primary text-white`, icono `auto_awesome`, shadow accent
- **Footer atmosférico**: Card con imagen de fondo de mapa topográfico, blur overlay

---

### 10.7 Configuración

**Stitch Screen ID**: `390739b0704c4ddc87bfefe690f1a814`
**Título**: Configuración - MapFlow
**Dimensiones**: 2560×2048 · **Layout**: Sidebar + TopBar + Tab Nav + Bento Grid

#### Estructura
```
┌────────┬──────────────────────────────────────────┐
│        │  "Configuración"              🔔 ? Admin │
│  Side  ├──────────────────────────────────────────┤
│  bar   │  [Perfil] [Negocio] [Notif.] [Fact.] [Int│
│        │  ─────────────────────────────────────── │
│  Nav:  │                                          │
│  Config│  ┌──────────────────┐ ┌────────────────┐ │
│ (activo)│ │ Detalles Negocio │ │ Canales Alerta │ │
│        │  │ (7col)           │ │ (5col)         │ │
│        │  │ • Nombre negocio │ │ • WhatsApp 🟢  │ │
│        │  │ • NIT / RUT      │ │ • Email fact 🟢│ │
│        │  │ • Dirección      │ │ • Resumen sem⚪│ │
│        │  └──────────────────┘ └────────────────┘ │
│        │                                          │
│        │  ┌──────────────────┐ ┌────────────────┐ │
│        │  │ Identidad Visual │ │ Hero Image     │ │
│        │  │ Logo upload area │ │ "Optimiza tu   │ │
│        │  │ [Cambiar imagen] │ │  flujo"        │ │
│        │  └──────────────────┘ └────────────────┘ │
│        │                                          │
│        │  ℹ️ Los cambios se aplican a toda la org. │
│        │           [Descartar]  [💾 Guardar]       │
└────────┴──────────────────────────────────────────┘
```

#### Elementos únicos
- **Tab Navigation**: Pestañas horizontales con border-bottom indicator activo
- **Form Fields**: Labels `label-bold` arriba, inputs con focus ring `primary`
- **Toggle Switches**: Custom CSS (44×24px), ON: `secondary` (#42682F), OFF: `outline-variant`
- **Hero card**: Background image con parallax hover (`scale(1.1)`), overlay blur
- **Save micro-interaction**: Spinner → "¡Guardado!" con cambio de color (1200ms + 2000ms)

---

## 11. Responsive Behavior

### Mobile Bottom Nav
```
Fijo bottom: 0, h-16, bg-surface-container-high
Items: 4 botones centrados (Inicio, Facturas, Reportes, Ajustes)
Activo: text-primary, icono FILL 1
Inactivo: text-on-surface-variant
```

### Breakpoints de adaptación

| Componente | Desktop | Tablet | Mobile |
|---|---|---|---|
| Sidebar | Visible 256px | Icon rail / hidden | Hidden |
| TopBar search | Visible | Visible | Hidden |
| KPI grid | 3-4 columnas | 2 columnas | 1 columna |
| Data tables | Full table | Table con scroll-x | Card layout |
| Bento grid | 12 col layout | 8 col layout | Stack vertical |
| Bottom nav | Hidden | Hidden | Visible |

---

## 12. CSS Custom Properties Reference

```css
:root {
  /* Brand Colors */
  --color-ink-blue: #0F172A;
  --color-emerald: #10B981;
  --color-amber: #F59E0B;
  --color-red: #EF4444;

  /* Serene Navigator Palette */
  --color-primary: #4E6544;
  --color-secondary: #42682F;
  --color-tertiary: #7B5264;
  --color-surface: #FAF9F4;
  --color-outline: #74796F;
  --color-outline-variant: #C4C8BD;

  /* Typography */
  --font-family: 'Inter', sans-serif;

  /* Spacing */
  --space-unit: 8px;
  --space-gutter: 24px;
  --space-margin-mobile: 16px;
  --space-margin-desktop: 48px;
  --container-max: 1280px;

  /* Border Radius */
  --radius-default: 0.25rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  --radius-full: 9999px;

  /* Elevation */
  --shadow-level-1: 0 2px 4px rgba(15, 23, 42, 0.04);
  --shadow-level-2: 0 8px 16px rgba(15, 23, 42, 0.08);
}
```

---

## 13. Stitch Project Reference

| Campo | Valor |
|---|---|
| **Project ID** | `13148426259663261839` |
| **Project Name** | `projects/13148426259663261839` |
| **Título** | MapFlow Dashboard Financiero |
| **Tipo** | TEXT_TO_UI_PRO |
| **Dispositivo** | DESKTOP |
| **Color Mode** | LIGHT |
| **Font** | INTER |
| **Roundness** | ROUND_FOUR |
| **Color Variant** | FIDELITY |
| **Override Primary** | `#0F172A` |
| **Override Secondary** | `#10B981` |
| **Override Tertiary** | `#F59E0B` |
| **Override Neutral** | `#64748B` |
| **Spacing Scale** | 2 |

### Screen IDs

| Pantalla | Screen ID |
|---|---|
| Login | `750d59fd2c7f4dc3b9100ccae482b4df` |
| Dashboard | `0d51ede063834b1db3c3bb57e6e4e635` |
| Cuentas por Cobrar | `be36e336f3b54674bd5ed649762f59e0` |
| Detalle de Factura | `b0ae0bfe68674f70b20bd7972808b1b4` |
| Egresos y Gastos | `4093db3a3a3d4559a9771abcef05259a` |
| Reportes Financieros | `48c69958cfdc4a588f5ff946c9e533de` |
| Configuración | `390739b0704c4ddc87bfefe690f1a814` |
