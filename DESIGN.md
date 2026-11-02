# DESIGN.md : GastroPOS Sistema de Diseño Táctil

## 1. Design Read & Dirección Visual
> Reading this as: Comandera y punto de venta gastronómico multicanal (web/mobile) for mozos, cajeros y encargados de gastronomía, in an Arquitectura Gastronómica Táctil style, dial ENERGY 2 / RHYTHM 2 / MOTION 1.

- **Producto:** Comandera y punto de venta gastronómico web (Salón, Mostrador, Take Away, Delivery, Caja, Escandallos y Stock) usado en simultáneo desde computadoras de mostrador y teléfonos de mozos en movimiento.
- **Identidad estética:** *Arquitectura Gastronómica Táctil*. Inspirada en hardware de caja registradora contemporáneo (teclas físicas mate, papel térmico, pizarra mineral y acero cepillado), alejándose tanto del negro vacío genérico como de los gradientes neón de plantillas SaaS.
- **Three Dials (`antislop` Part 3):** `ENERGY 2 / RHYTHM 2 / MOTION 1`
  - **ENERGY 2 (Calma táctica con acento deliberado):** El operador pasa horas frente a la pantalla; las superficies neutras descansan la vista mientras los estados de mesa (Abierta, Pendiente de cobro) destacan al instante.
  - **RHYTHM 2 (Densidad operativa respirable):** Grillas precisas para planos de mesas y catálogos rápidos, combinadas con listas contables abiertas con divisores de 1px sin anidar cajas dentro de cajas.
  - **MOTION 1 (Respuesta física inmediata):** Transiciones cortas de presión (`120ms`) en botones y apertura limpia de paneles laterales, sin animaciones infinitas ni distracciones.

## 2. Decisiones Fundamentales (1-Line Reasons, R-31)
- **Display Font (`Bricolage Grotesque`):** Aporta carácter editorial moderno y lectura instantánea en títulos de vistas, KPIs y nombres de platos sin recurrir a Inter o Roboto.
- **UI Body Font (`Plus Jakarta Sans`):** Mantiene legibilidad nítida en etiquetas operativas, formularios y filtros a tamaño real de lectura (`13px` a `15px`), eliminando el abuso de mayúsculas monoespaciadas diminutas.
- **Tabular Data Font (`IBM Plex Mono` con `tabular-nums`):** Alinea verticalmente precios en pesos, códigos de mesa (`S1`, `T5`, `G3`), tiempos de espera, cantidades y PINs sin saltos visuales al actualizarse.
- **Dual Theme System (`Grafito Táctil` + `Papel Técnico`):** Ofrece por defecto un gris piedra intermedio cálido (`#17191c` / `#1f2226`) ideal para salones con luz tenue, y un modo claro mineral (`#eeebe4` / `#faf9f5`) para mostradores diurnos, ambos verificados con `contrast-check.py` (>= 4.5:1 texto, >= 3.0:1 bordes interactivos).
- **Acento Deliberado (`Terracota Cobre` `#eb855e` / `#9e3c16`):** Conecta con materiales gastronómicos reales (horno de barro, cobre, madera) para marcar navegación activa e indicadores clave sin saturar los botones de acción.
- **Botones Tipo Tecla Física (`Acero / Marfil Táctil`):** Resuelve el pedido explícito de botones sobrios en gama de grises/piedra mediante relieve sutil superior, borde definido >= 3:1 y área mínima de `44x44px` para dedos en pantalla táctil.
- **Semántica de Mesas No Neón (Salvia, Ocre, Grafito):** Diferencia por color, borde lateral e ícono las mesas *Cerradas* (neutro recedido), *Abiertas* (verde salvia mineral) y *Pendientes de cobro* (ocre cálido prioritario).

## 3. Tokens de Color Verificados (WCAG AA)

### Tema `graphite` (Grafito Táctil, Predeterminado)
- `--bg-canvas`: `#17191c` | `--bg-surface`: `#1f2226` | `--bg-elevated`: `#282c31` | `--bg-subtle`: `#131518`
- `--border-subtle`: `#343940` | `--border-strong`: `#6e7582` (`3.44:1` sobre surface)
- `--text-primary`: `#f3f1ec` (`14.15:1`) | `--text-secondary`: `#c2c6ce` (`9.32:1`) | `--text-muted`: `#a1a7b3` (`6.61:1`)
- `--btn-primary-bg`: `#edeae2` | `--btn-primary-fg`: `#17191c` (`14.65:1`)
- `--accent-brand`: `#eb855e` (`6.12:1`)
- Estados: Abierta (`#7be0a8` sobre `#1a2821`, `9.54:1`), Pendiente cobro (`#f6bd6a` sobre `#2a2217`, `9.26:1`), Crítico (`#f99696` sobre `#2b1c1e`, `7.64:1`).

### Tema `paper` (Papel Técnico, Modo Claro Cálido)
- `--bg-canvas`: `#eeebe4` | `--bg-surface`: `#faf9f5` | `--bg-elevated`: `#ffffff` | `--bg-subtle`: `#e5e1d8`
- `--border-subtle`: `#cfc9be` | `--border-strong`: `#767168` (`4.60:1` sobre surface)
- `--text-primary`: `#18191b` (`16.70:1`) | `--text-secondary`: `#43464c` (`8.98:1`) | `--text-muted`: `#565a61` (`6.58:1`)
- `--btn-primary-bg`: `#1f2226` | `--btn-primary-fg`: `#faf9f5` (`15.16:1`)
- `--accent-brand`: `#9e3c16` (`6.41:1`)
- Estados: Abierta (`#185936` sobre `#e4f1e9`, `7.16:1`), Pendiente cobro (`#7d4305` sobre `#faefe0`, `6.91:1`), Crítico (`#961e1e` sobre `#fae8e8`, `7.11:1`).

## 4. Geometría, Ergonomía e Íconos
- **Radios:** Micro-radio arquitectónico de `4px` a `6px` (`rounded` / `rounded-md`). Prohibidas las píldoras (`rounded-full`) en botones y las tarjetas burbuja (`rounded-2xl`+).
- **Objetivos táctiles:** Mínimo `44px` de alto (`min-h-[44px]`) en todo botón, pestaña, selector de cantidad, campo de texto e ícono interactivo.
- **Iconografía:** Exclusivamente Font Awesome 6 (`fa-solid`) con `aria-hidden="true"`. Cero emojis en código, interfaz y base de datos.
- **Tono verbal:** Español rioplatense natural con voseo (*seleccioná*, *cargá*, *ingresá*, *mirá*), directo y sin guiones largos.
