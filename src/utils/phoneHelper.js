/**
 * Utilidades para validación y formateo de números de teléfono en Argentina
 * adaptado específicamente a Córdoba Capital (código de área 351).
 *
 * Reglas de telefonía celular argentina para enlaces de WhatsApp (wa.me):
 * 1. Código internacional: +54 9
 * 2. Se quita el prefijo interurbano '0' (ej. 0351 -> 351)
 * 3. Se quita el prefijo celular '15' (ej. 155123456 -> 5123456 o 0351 15 5123456 -> 3515123456)
 * 4. Si el número ingresado tiene 7 u 8 dígitos locales, se asume el código de área 351 (Córdoba Capital).
 * 5. El número celular final nacional debe tener exactamente 10 dígitos (área + abonado).
 */

export const CORDOBA_AREA_CODE = '351';

export function normalizeArgentinePhone(rawPhone, defaultArea = CORDOBA_AREA_CODE) {
  if (!rawPhone) {
    return {
      isValid: false,
      formattedDisplay: '',
      waNumber: '',
      digits: '',
      error: 'Ingresá un número de teléfono'
    };
  }

  let digits = String(rawPhone).replace(/\D/g, '');
  if (!digits) {
    return {
      isValid: false,
      formattedDisplay: '',
      waNumber: '',
      digits: '',
      error: 'El teléfono no contiene números'
    };
  }

  // Quitar prefijo internacional si fue tipeado (+54 9 o 54)
  if (digits.startsWith('549')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('54')) {
    digits = digits.slice(2);
  }

  // Quitar el 0 inicial si existe (prefijo interurbano)
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Quitar el 15 inicial si fue colocado como celular local (ej: 155123456)
  if (digits.startsWith('15')) {
    digits = digits.slice(2);
  }

  // Resolver código de área con 15 intermedio:
  // Casos de 3 dígitos de área (ej. Córdoba 351, Rosario 341, Tucumán 381): 351 15 XXXXXXX (12 dígitos)
  const area3Match = digits.match(/^(\d{3})15(\d{7})$/);
  if (area3Match) {
    digits = `${area3Match[1]}${area3Match[2]}`;
  } else {
    // Casos de 2 dígitos de área (ej. Buenos Aires 11): 11 15 XXXXXXXX (11 dígitos)
    const area2Match = digits.match(/^(\d{2})15(\d{8})$/);
    if (area2Match) {
      digits = `${area2Match[1]}${area2Match[2]}`;
    } else {
      // Casos de 4 dígitos de área (ej. Carlos Paz 3541): 3541 15 XXXXXX (12 dígitos)
      const area4Match = digits.match(/^(\d{4})15(\d{6})$/);
      if (area4Match) {
        digits = `${area4Match[1]}${area4Match[2]}`;
      }
    }
  }

  // Si quedaron 7 dígitos (línea local de Córdoba sin código de área), anteponer 351
  if (digits.length === 7) {
    digits = `${defaultArea}${digits}`;
  } else if (digits.length === 8 && defaultArea.length === 2) {
    digits = `${defaultArea}${digits}`;
  }

  // En Argentina un celular completo (área + abonado) tiene exactamente 10 dígitos
  if (digits.length !== 10) {
    return {
      isValid: false,
      formattedDisplay: rawPhone,
      waNumber: '',
      digits,
      error: `Debe tener 10 cifras (ej. 351 512-3456). Actuales: ${digits.length}`
    };
  }

  const area = digits.slice(0, 3);
  const mid = digits.slice(3, 6);
  const end = digits.slice(6);

  const formattedDisplay = `+54 9 ${area} ${mid}-${end}`;
  const waNumber = `549${digits}`;

  return {
    isValid: true,
    formattedDisplay,
    waNumber,
    digits,
    error: null
  };
}

export function buildWhatsAppLink(rawPhone, message = '', defaultArea = CORDOBA_AREA_CODE) {
  const norm = normalizeArgentinePhone(rawPhone, defaultArea);
  if (!norm.isValid) return null;
  const encodedMsg = encodeURIComponent(message || '');
  return `https://wa.me/${norm.waNumber}${encodedMsg ? `?text=${encodedMsg}` : ''}`;
}

export function getDefaultDeliveryMessage(order) {
  const customer = order.customerName || 'Estimado/a cliente';
  const orderNum = order.orderNumber || order.id || '';
  const isTakeAway = order.channel === 'take_away';
  const address = order.deliveryAddress ? ` a ${order.deliveryAddress}` : '';

  if (isTakeAway) {
    return `¡Hola ${customer}! Te avisamos desde GastroPOS Córdoba que tu pedido #${orderNum} ya está listo para retirar por mostrador en Av. Hipólito Yrigoyen 450 (Nueva Córdoba). ¡Te esperamos!`;
  }

  return `¡Hola ${customer}! Te avisamos desde GastroPOS Córdoba que tu pedido #${orderNum} ya está en camino${address}. ¡Que lo disfrutes mucho!`;
}
