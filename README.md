# GastroPOS · Plataforma SaaS de Gestión Gastronómica Multi-Local

Sistema web integral y en tiempo real para bares, restaurantes y cafeterías. Diseñado para centralizar la operación completa del negocio: atención en salón y mesas, comanda móvil independiente para mozos vía QR, mostrador, take away y delivery, control de arqueos de caja, directorio de proveedores, registro de facturas/comprobantes, recetario con escandallo estandarizado (`g`, `ml`, `u`) y módulo avanzado de cuentas corrientes para clientes, proveedores y personal (rendición de sueldos, adelantos y consumos).

Diseñado bajo la identidad de interfaz táctil documentada en [`DESIGN.md`](./DESIGN.md), con tipografía tabular (`IBM Plex Mono`), jerarquía visual clara (`Bricolage Grotesque`, `Plus Jakarta Sans`), iconografía Font Awesome 6 y cumplimiento de contraste WCAG AA.

---

## Características Principales

### 1. Arquitectura Multi-Local y Acceso por Establecimiento
* **Acceso corporativo e inicio de sesión por local:** Selección dinámica de sucursal (ej. Local 1, Local 2, Local 3) y credenciales por establecimiento (`admin@prueba1.gp.com`).
* **Control de acceso por roles y PIN táctil:** Autenticación rápida de 4 dígitos para agilizar la rotación de turnos entre Administradores, Cajeros y Mozos.
* **Persistencia local y remota sincronizada:** Todo el estado operativo (pedidos, stock, arqueos y movimientos de cuentas corrientes) se almacena y sincroniza de forma transparente.

### 2. Comanda Móvil Independiente para Mozos (QR / Smartphone)
* **PWA / Web Mobile desacoplada:** Los mozos acceden desde sus propios teléfonos escaneando el código QR de vinculación en cabecera o mediante URL directa.
* **Toma de pedidos en mesa:** Apertura de mesas, selección de comensales, adicionales tarifados y aclaraciones a cocina en tiempo real.
* **Solicitud de cuenta:** El mozo puede pedir la precuenta desde el celular, actualizando instantáneamente el estado de la mesa en el puesto de caja y emitiendo una notificación sonora y visual.

### 3. Ciclo de Vida del Salón y Notificaciones en Vivo
* **Estados de mesa:**
  * **Cerrada / Libre:** Mesa disponible para apertura.
  * **Abierta:** En servicio, con comensales y adiciones activas.
  * **Cuenta solicitada (Celeste):** El cliente solicitó la precuenta. Si luego se agrega un nuevo ítem (ej. postre o café), la mesa regresa automáticamente a estado abierta.
  * **Pendiente de cobro (Rojo):** Mesa lista para abonar en caja con opción directa de emisión de ticket/precuenta con descuentos aplicables.
* **Notificaciones sonoras y de pantalla:** Reemplazo de impresión física innecesaria mediante avisos interactivos que tras unos segundos se trasladan a la barra de avisos para su atención diferida.

### 4. Multicanal: Mostrador, Take Away y Delivery
* **Mostrador y Take Away:** Cobro rápido y emisión de comandas para consumo al paso.
* **Delivery con integración a WhatsApp:** Validación de número telefónico argentino (código de área, remoción automática de 0 y 15) y botón directo de contacto por WhatsApp para notificar "Pedido en camino" o "Pedido listo para retirar".
* **Categorías y buscador en comanda:** Filtro rápido por rubros (Pizzas, Lomitos, Hamburguesas, Bebidas, etc.) para acelerar la carga de pedidos.

### 5. Arqueo y Turnos de Caja
* **Apertura de turno:** Registro de usuario responsable, fecha y hora exacta, con efectivo inicial predeterminado en cero.
* **Desglose unificado de métodos de pago:**
  * Efectivo en caja
  * Tarjeta Débito
  * Tarjeta Crédito
  * QR / Transferencia bancaria
  * Cuenta Corriente
* **Control de movimientos manuales:** Ingresos de cambio y egresos de caja justificados.
* **Cierre y balance detallado:** Comparación automática entre efectivo esperado y conteo real físico (sobrante/faltante) y finalización segura de sesión.

### 6. Cuentas Corrientes: Clientes, Proveedores y Personal
* **Cuentas Corrientes de Clientes:** Límite de crédito asignable, registro de cobranzas y cobro diferido desde mesas o mostrador.
* **Cuentas Corrientes de Proveedores:** Estado de deuda consolidado por compras de insumos, historial de remitos/facturas y registro de pagos.
* **Personal, Sueldos y Consumos:**
  * **Asignación de sueldo (+):** Haber bruto mensual fijado para cada miembro del equipo.
  * **Descuento por consumos (-):** Imputación automática desde la mesa o comanda cuando el personal consume en el local.
  * **Adelantos de sueldo (-):**
    * Discriminación por **Efectivo** o **Transferencia bancaria**.
    * En caso de efectivo, selección de origen: **Caja de turno** (genera egreso automático en el arqueo activo) o **Caja grande / Fondos centrales** (descuenta del sueldo sin alterar la caja física del cajero).
  * **Liquidación de haberes (-):** Pago final del saldo neto resultante.
  * **Ficha individual:** Historial pormenorizado de movimientos y saldo a liquidar por empleado.

### 7. Directorio de Proveedores vs Facturas y Pagos
* **Módulo de Proveedores:** Gestión de contactos comerciales, CUIT, rubros de abastecimiento, teléfonos, bajas/reactivaciones y seguimiento de saldo adeudado.
* **Facturas y Pagos:** Carga de comprobantes (Factura A, B, C o Remito), actualización inmediata de existencias en depósito y cálculo de pasivos.

### 8. Recetario, Insumos y Escandallo Estandarizado
* **Unidades de medida exactas:** Estandarización estricta a gramos (`g`), mililitros (`ml`) y unidades (`u`), eliminando discrepancias de escala.
* **Edición de insumos:** Corrección de materias primas, costos unitarios, stock actual y puntos de reposición mínima.
* **Escandallo y costeo en tiempo real:** Descuento automático de stock según las recetas de cada plato al comandar y cálculo del margen bruto porcentual.

---

## Puesta en Marcha Local

### Requisitos Previos
* Node.js 18 o superior.
* npm 9 o superior.

### Instalación y Ejecución

```bash
# Clonar el repositorio
git clone https://github.com/LeoDoerflinger/gastro-pos.git
cd gastro-pos

# Instalar dependencias
npm install

# Iniciar backend y frontend en paralelo
npm run dev
```

* **Frontend SPA:** `http://localhost:5173`
* **API REST Backend:** `http://localhost:3001/api`

### Acceso Móvil en Red Local
Para vincular celulares de mozos o terminales secundarias en la misma red Wi-Fi:
```bash
npm run client -- --host
```
Accedé desde el navegador del celular a `http://<IP-LOCAL>:5173` o escaneá el código QR visible en la barra superior del sistema.

---

## Credenciales y Perfiles de Demostración

| Local / Sucursal | Usuario | Rol | PIN de Acceso | Correo Corporativo |
| :--- | :--- | :--- | :---: | :--- |
| **Local 1** | **Admin** | Encargado / Admin | `1234` | `admin@prueba1.gp.com` |
| **Local 1** | **Cajero** | Cajero | `2222` | `cajero@prueba1.gp.com` |
| **Local 1** | **Mozo 1** | Mozo de Salón | `1111` | `mozo1@prueba1.gp.com` |
| **Local 1** | **Mozo 2** | Mozo de Salón | `1112` | `mozo2@prueba1.gp.com` |

---

## Tecnologías Utilizadas

* **Frontend:** React 19, Vite, Tailwind CSS, Font Awesome 6.
* **Backend:** Node.js, Express, Base de datos JSON con persistencia dual (memoria, disco y sincronización en cliente).
* **Diseño y UX:** Sistema de diseño táctil con modo oscuro (Grafito Táctil) y modo claro (Papel Técnico / Blanco), diseño responsive adaptativo y sin dependencias superfluas.
