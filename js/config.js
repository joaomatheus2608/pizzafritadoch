// ========================================================
// CONFIGURAÇÕES GERAIS (PIZZA FRITA DO CH)
// ========================================================

const APP_CONFIG = {
  // Dados Oficiais
  RESTAURANT_NAME: 'Pizza Frita do CH',
  WHATSAPP_NUMBER: '5581991421295',
  INSTAGRAM_HANDLE: '@pizzafritadoch',
  DEFAULT_DELIVERY_FEE: 5.00,
  MIN_ORDER_VALUE: 15.00,
  PICKUP_ADDRESS: 'Jaboatão Centro - PE (Apenas Delivery)',
  OPERATING_HOURS_DESC: 'Quarta a Domingo — 17:00 às 22:00 (Segunda e Terça fechado)'
};

// Exporta globalmente para o navegador
window.APP_CONFIG = APP_CONFIG;

window.DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
window.DAY_NAMES_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

// Formatação oficial de moeda brasileira (R$ 0,00)
window.formatCurrency = function(val) {
  const num = Number(val) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Escapamento de caracteres HTML para prevenir injeções
window.escapeHtml = function(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Normaliza qualquer formato de dias da semana para um array de números [0..6]
window.normalizePromoDays = function(promoDays, mondayPrice) {
  if (promoDays === null || promoDays === undefined) {
    return (mondayPrice !== null && mondayPrice !== undefined && Number(mondayPrice) > 0) ? [1] : [];
  }
  if (Array.isArray(promoDays)) {
    return promoDays.map(d => Number(d)).filter(d => !isNaN(d) && d >= 0 && d <= 6);
  }
  if (typeof promoDays === 'number' && promoDays >= 0 && promoDays <= 6) {
    return [promoDays];
  }
  if (typeof promoDays === 'string') {
    const trimmed = promoDays.trim();
    if (!trimmed) {
      return (mondayPrice !== null && mondayPrice !== undefined && Number(mondayPrice) > 0) ? [1] : [];
    }
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const arr = JSON.parse(trimmed);
        if (Array.isArray(arr)) {
          return arr.map(d => Number(d)).filter(d => !isNaN(d) && d >= 0 && d <= 6);
        }
      } catch (e) {}
    }
    const cleaned = trimmed.replace(/[{}[\]"]/g, '').trim();
    if (!cleaned) return (mondayPrice !== null && mondayPrice !== undefined && Number(mondayPrice) > 0) ? [1] : [];
    return cleaned.split(',')
      .map(s => Number(s.trim()))
      .filter(d => !isNaN(d) && d >= 0 && d <= 6);
  }
  return (mondayPrice !== null && mondayPrice !== undefined && Number(mondayPrice) > 0) ? [1] : [];
};

// Verifica se um produto ou promoção está com preço promocional ativo no dia especificado (padrão: hoje)
window.isPromoActiveToday = function(product, todayDay) {
  if (!product) return false;
  if (todayDay === undefined || todayDay === null) {
    todayDay = new Date().getDay();
  } else {
    todayDay = Number(todayDay);
  }

  const promoPrice = Number(product.promo_price) || Number(product.monday_price) || 0;
  if (promoPrice <= 0) return false;
  if (product.is_promo === false) return false;

  const promoDays = window.normalizePromoDays(product.promo_days, product.monday_price);
  if (promoDays.length === 0) return false;

  return promoDays.includes(todayDay);
};

// Retorna o preço efetivo do produto considerando o dia da semana atual
window.getProductEffectivePrice = function(product, todayDay) {
  if (!product) return 0;
  if (todayDay === undefined || todayDay === null) {
    todayDay = new Date().getDay();
  } else {
    todayDay = Number(todayDay);
  }

  const regularPrice = (product.price !== null && product.price !== undefined && product.price !== '') ? Number(product.price) : 0;
  const promoPrice = Number(product.promo_price) || Number(product.monday_price) || 0;
  const isTodayPromo = window.isPromoActiveToday(product, todayDay);

  if (isTodayPromo) {
    return promoPrice;
  }
  return regularPrice > 0 ? regularPrice : (promoPrice > 0 ? promoPrice : 0);
};

// Otimiza URLs de imagens para formato WebP ultraleve
window.optimizeImageUrl = function(url, options = {}) {
  if (!url || typeof url !== 'string') return 'logo.jpg';
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'boylogo.jpg' || trimmed === 'logo.jpg') return 'logo.jpg';

  // Se for base64 ou imagem local relativa/absoluta simples
  if (trimmed.startsWith('data:image') || trimmed.startsWith('/') || trimmed.startsWith('./') || (!trimmed.startsWith('http://') && !trimmed.startsWith('https://'))) {
    return trimmed;
  }

  // Se já for uma URL otimizada pelo wsrv.nl, retorna diretamente
  if (trimmed.includes('wsrv.nl')) return trimmed;

  const width = options.width || 600;
  const quality = options.quality || 80;
  const format = options.format || 'webp';

  return `https://wsrv.nl/?url=${encodeURIComponent(trimmed)}&w=${width}&q=${quality}&output=${format}&we=1`;
};


