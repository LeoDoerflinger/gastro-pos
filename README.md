# GastroGestión POS · Sistema Integral de Gestión Gastronómica

Sistema web dinámico para restaurantes, bares y locales gastronómicos con gestión multicanal (**Salón / Mesas**, **Mostrador**, **Take Away** y **Delivery**), control de acceso por roles (Mozo, Cajero, Encargado/Admin), arqueos de caja, ingreso de facturas/remitos de proveedores y recetario con escandallo y descuento automático de stock por porción.

Diseñado bajo estándares de ingeniería de interfaces de alta densidad: paleta carbon grafito, geometría micro-radius (2px-4px), controles segmentados con borde unificado, tipografía tabular monoespaciada para valores numéricos e iconografía vectorial Font Awesome 6.

---

## Puesta en Marcha

El proyecto cuenta con un entorno fullstack listo para correr:

```bash
cd gastro-pos
npm run dev
```

Esto inicia simultáneamente:
- **Backend API (Express + JSON Store persistente):** `http://localhost:3001`
- **Frontend Web SPA (React 19 + Vite + Tailwind CSS):** `http://localhost:5173`

> Acceso desde celulares y tablets en la misma red Wi-Fi:
> Ejecuta `npm run client -- --host` o accede directamente a `http://<IP-DE-TU-PC>:5173`. La aplicación incluye un botón en la cabecera (**Simulador Celular**) para evaluar la experiencia táctil móvil directamente en el navegador de escritorio.

---

## Roles de Usuario y Permisos (RBAC con PIN Numérico)

En el entorno gastronómico, la alternancia de personal en terminales compartidas requiere inmediatez y seguridad. El sistema implementa un teclado numérico PIN de 4 dígitos con persistencia de sesión:

| Personal | Rol | PIN | Alcance y Permisos |
| :--- | :--- | :---: | :--- |
| **Lucas / Sofía** | **Mozo** | `1111` / `1112` | Acceso exclusivo a Salón y Mesas. Apertura de mesas, selección de comensales, comanda de platos con notas a cocina y adicionales tarifados. Consulta de tiempo transcurrido desde la última comanda. No tiene acceso a precuenta, cobros ni inventario. |
| **Martín** | **Cajero** | `2222` | Caja y cobros de todos los canales (Mesas, Mostrador, Take Away, Delivery). Indicadores en tiempo real de puntos de venta activos. Múltiples medios de pago (Efectivo con cálculo de vuelto, Débito, Crédito, Mercado Pago QR y Transferencia). Historial en lista vertical con estado, mozo y saldo. Arqueo ciego con detección de sobrantes/faltantes y registro de movimientos (ingresos y gastos). Carga de comprobantes de compras y stock. |
| **Rodrigo** | **Encargado / Admin** | `9999` | Acceso global: Tablero de métricas y analítica de ventas, gestión de recetas y escandallos, control de stock con alertas críticas y mermas, configuración de plano de mesas y administración de personal. |

---

## Recetario, Escandallos y Descuento Automático de Stock

Cada producto del menú se vincula a su composición exacta de materia prima e insumos:

- **Pizza Muzzarella Grande (8 porciones):**
  - Descuenta `0.25 kg` (250g) de Queso Muzzarella.
  - Descuenta `0.08 kg` (80g) de Salsa de Tomate Pomodoro.
  - Descuenta `1 u` de Bollo de Masa Madre.
  - Descuenta `8 u` de Aceitunas Verdes.
- **Pizza Muzzarella Individual (4 porciones):**
  - Descuenta `0.125 kg` (125g) de Muzzarella.
  - Descuenta `0.04 kg` (40g) de Salsa de Tomate.
  - Descuenta `0.5 u` (1/2 bollo) de Masa Madre.
  - Descuenta `4 u` de Aceitunas Verdes.
- **Hamburguesa Doble Smash Cheddar & Bacon:**
  - Descuenta `2 u` de Medallones Smash (160g de carne).
  - Descuenta `4 u` de Fetas de Cheddar Americano.
  - Descuenta `1 u` de Pan Brioche.
  - Descuenta `0.04 kg` (40g) de Panceta crocante.

### Cálculo de Costo y Margen Bruto
En la sección **Recetario & Escandallos**, el sistema evalúa dinámicamente el costo unitario de producción según los precios vigentes de compras y expone el margen bruto porcentual exacto: `((Precio - Costo) / Precio) * 100`.

---

## Módulo de Delivery y Zonas de Reparto con Maps

El gestor de entregas cuenta con:
- Integración directa con **OpenStreetMap / Google Maps** para geo-localización y cálculo de distancia real en kilómetros.
- Tarifación dinámica escalonada por distancia con tope operativo máximo (radio no infinito) para evitar pedidos fuera de cobertura.
- Estados de comanda en cocina, despacho y entrega sin redirecciones forzadas de vista.

---

## Control de Insumos y Comprobantes de Proveedores

1. Carga de comprobantes oficiales (Factura A, B, C o Remito Oficial).
2. Selección de materias primas recibidas, cantidades y costos unitarios.
3. Actualización inmediata del inventario y recalculo automático de los escandallos del menú.
4. Registro de auditoría con trazabilidad de usuario, fecha y variaciones de inventario.

---

## Estándares de Diseño e Interfaz

- **Paleta Carbon Neutro:** `#09090b` (fondo), `#121215` (paneles), `#18181c` (interactivos), `#27272a` (bordes estructurales). Sin colores neón ni saturaciones excesivas.
- **Micro-Radius:** Bordes finos `rounded` (4px) y `rounded-sm` (2px) que maximizan el área útil de trabajo.
- **Iconografía:** Font Awesome 6 Solid (`fa-solid`) para una lectura visual unívoca y profesional.
- **Tipografía:** Valores numéricos tabulares (`font-mono tabular-nums`) para alineación perfecta de importes, pesos y horas.
- **Responsive:** Drawer lateral colapsable, vista de comanda táctil y soporte optimizado para terminales móviles y de escritorio.
