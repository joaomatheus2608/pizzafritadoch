// ========================================================
// PIZZA FRITA DO CH - NETLIFY FUNCTION (API SERVER-SIDE)
// Todas as chamadas ao Supabase passam por aqui.
// As credenciais NUNCA chegam ao browser.
// ========================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

function supabaseHeaders() {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}

async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...supabaseHeaders(), ...(options.headers || {}) }
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Supabase error ${res.status}`);
  }
  return data;
}

async function supabaseRpc(funcName, params = {}) {
  const url = `${SUPABASE_URL}/rest/v1/rpc/${funcName}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: supabaseHeaders(),
    body: JSON.stringify(params)
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) throw new Error(data?.message || `RPC error ${res.status}`);
  return data;
}

// Upload de imagem via Supabase Storage
async function uploadToStorage(base64Data, fileName, mimeType) {
  const cleanFileName = String(fileName || '').replace(/^products\//, '').replace(/[^a-zA-Z0-9_.-]/g, '_');
  const url = `${SUPABASE_URL}/storage/v1/object/products/${cleanFileName}`;
  const buffer = Buffer.from(base64Data, 'base64');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': mimeType || 'image/jpeg',
      'cache-control': '31536000',
      'x-upsert': 'true'
    },
    body: buffer
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Storage error: ${err}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/products/${cleanFileName}`;
}

const SALT = 'boydegusta_secure_salt_2026_';

async function hashPassword(pass) {
  const { createHash } = await import('crypto');
  return createHash('sha256').update(SALT + pass).digest('hex');
}

async function hashPasswordRaw(pass) {
  const { createHash } = await import('crypto');
  return createHash('sha256').update(pass).digest('hex');
}

function respond(statusCode, body, cacheMaxAge = 0) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS'
  };
  if (cacheMaxAge > 0) {
    headers['Cache-Control'] = `public, max-age=${cacheMaxAge}, s-maxage=${cacheMaxAge * 2}, stale-while-revalidate=300`;
  }
  return {
    statusCode,
    headers,
    body: JSON.stringify(body)
  };
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return respond(200, {});
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return respond(500, { error: 'Variáveis de ambiente do servidor não configuradas.' });
  }

  const method = event.httpMethod;
  const path = event.queryStringParameters?.action || '';
  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; } catch {}

  try {
    // -------------------------------------------------------
    // GET BOOTSTRAP (Carregamento unificado em 1 requisição com Cache)
    // -------------------------------------------------------
    if (method === 'GET' && path === 'get-bootstrap') {
      const [settingsData, hoursData, categories, products, optionals, promotions, neighborhoods, couriers] = await Promise.all([
        supabaseFetch('/settings?limit=1').catch(() => null),
        supabaseFetch('/operating_hours?order=day_of_week').catch(() => []),
        supabaseFetch('/categories?order=order_index').catch(() => []),
        supabaseFetch('/products?order=name').catch(() => []),
        supabaseFetch('/optionals?order=name').catch(() => []),
        supabaseFetch('/promotions?order=created_at.desc').catch(() => []),
        supabaseFetch('/neighborhoods?order=name').catch(() => []),
        supabaseFetch('/couriers?order=name').catch(() => [])
      ]);
      return respond(200, {
        data: {
          settings: Array.isArray(settingsData) ? settingsData[0] : settingsData,
          hours: hoursData || [],
          categories: categories || [],
          products: products || [],
          optionals: optionals || [],
          promotions: promotions || [],
          neighborhoods: neighborhoods || [],
          couriers: couriers || []
        }
      }, 60); // 60 segundos de cache CDN para não estourar requisições
    }

    // -------------------------------------------------------
    // GET SETTINGS
    // -------------------------------------------------------
    if (method === 'GET' && path === 'get-settings') {
      const data = await supabaseFetch('/settings?limit=1');
      return respond(200, { data: Array.isArray(data) ? data[0] : data });
    }

    // -------------------------------------------------------
    // UPDATE SETTINGS
    // -------------------------------------------------------
    if (method === 'POST' && path === 'update-settings') {
      const { id, ...fields } = body;
      fields.updated_at = new Date().toISOString();
      if (id) {
        const data = await supabaseFetch(`/settings?id=eq.${id}`, {
          method: 'PATCH',
          body: JSON.stringify(fields)
        });
        return respond(200, { data });
      } else {
        const data = await supabaseFetch('/settings', {
          method: 'POST',
          body: JSON.stringify(fields)
        });
        return respond(200, { data: Array.isArray(data) ? data[0] : data });
      }
    }

    // -------------------------------------------------------
    // ADMIN LOGIN
    // -------------------------------------------------------
    if (method === 'POST' && path === 'admin-login') {
      const { password } = body;
      if (!password) return respond(400, { error: 'Senha não informada.' });

      // Tenta via RPC primeiro
      try {
        const rpcResult = await supabaseRpc('verify_admin_password', { input_password: password });
        if (typeof rpcResult === 'boolean') {
          if (rpcResult) {
            return respond(200, { success: true });
          } else {
            return respond(401, { error: 'Senha incorreta.' });
          }
        }
      } catch {}

      // Fallback: verifica via coluna admin_password_hash na tabela settings
      const settingsData = await supabaseFetch('/settings?limit=1');
      const settings = Array.isArray(settingsData) ? settingsData[0] : settingsData;
      const storedHash = settings?.admin_password_hash;

      if (!storedHash) {
        return respond(500, { error: 'Senha admin não configurada no banco de dados.' });
      }

      const saltedHash = await hashPassword(password);
      const rawHash = await hashPasswordRaw(password);
      const storedLower = String(storedHash).trim().toLowerCase();

      const isValid = password === storedHash ||
                      rawHash.toLowerCase() === storedLower ||
                      saltedHash.toLowerCase() === storedLower;

      if (isValid) {
        return respond(200, { success: true });
      } else {
        return respond(401, { error: 'Senha incorreta.' });
      }
    }

    // -------------------------------------------------------
    // GET CATEGORIES
    // -------------------------------------------------------
    if (method === 'GET' && path === 'get-categories') {
      const data = await supabaseFetch('/categories?order=order_index');
      return respond(200, { data });
    }

    // -------------------------------------------------------
    // SAVE CATEGORY
    // -------------------------------------------------------
    if (method === 'POST' && path === 'save-category') {
      const cat = body;
      const cleanPayload = {
        name: String(cat.name || '').trim(),
        slug: String(cat.slug || cat.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        order_index: Number(cat.order_index) || 0,
        is_active: cat.is_active !== false
      };
      let data;
      if (cat.id && /^[0-9a-f-]{36}$/i.test(cat.id)) {
        data = await supabaseFetch(`/categories?id=eq.${cat.id}`, {
          method: 'PATCH', body: JSON.stringify(cleanPayload)
        });
        if (!data || (Array.isArray(data) && data.length === 0)) {
          data = await supabaseFetch('/categories', {
            method: 'POST', body: JSON.stringify({ id: cat.id, ...cleanPayload })
          });
        }
      } else {
        data = await supabaseFetch('/categories', {
          method: 'POST', body: JSON.stringify(cleanPayload)
        });
      }
      return respond(200, { data: Array.isArray(data) ? data[0] : data });
    }

    // -------------------------------------------------------
    // DELETE CATEGORY
    // -------------------------------------------------------
    if (method === 'DELETE' && path === 'delete-category') {
      const { id } = body;
      await supabaseFetch(`/categories?id=eq.${id}`, { method: 'DELETE' });
      return respond(200, { success: true });
    }

    // -------------------------------------------------------
    // GET PRODUCTS
    // -------------------------------------------------------
    if (method === 'GET' && path === 'get-products') {
      const data = await supabaseFetch('/products?order=order_index');
      return respond(200, { data });
    }

    // -------------------------------------------------------
    // SAVE PRODUCT
    // -------------------------------------------------------
    if (method === 'POST' && path === 'save-product') {
      const prod = body;
      const isExistingUuid = prod.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(prod.id);
      
      // Valida e resolve category_id
      let categoryId = prod.category_id || null;
      if (categoryId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryId)) {
        const LEGACY_MAP = {
          'cat-promo': 'promocoes-do-boy',
          'cat-acomp': 'acompanhamentos-do-boy',
          'cat-pao': 'pao-de-alho-do-boy-degusta',
          'cat-adic': 'adicional',
          'cat-burguer': 'boy-degusta-burguer',
          'cat-brasa': 'boy-degusta-na-brasa',
          'cat-beirute': 'beirute-boy-degusta',
          'cat-batata': 'batatas-boy-degusta',
          'cat-bebidas': 'bebidas-do-boy'
        };
        const targetSlug = LEGACY_MAP[categoryId] || categoryId;
        try {
          const cats = await supabaseFetch(`/categories?slug=eq.${targetSlug}&limit=1`);
          if (Array.isArray(cats) && cats[0]?.id) {
            categoryId = cats[0].id;
          } else {
            const allCats = await supabaseFetch('/categories?limit=1');
            categoryId = allCats[0]?.id || null;
          }
        } catch {
          categoryId = null;
        }
      }

      // Reconstrói sizes para pizzas com tamanhos
      let sizesArr = [];
      if (Array.isArray(prod.sizes) && prod.sizes.length > 0) {
        sizesArr = prod.sizes;
      } else if (prod.has_sizes) {
        const pP = (prod.price_p !== null && prod.price_p !== undefined && prod.price_p !== '') ? Number(prod.price_p) : Number(prod.price || 0);
        const pM = (prod.price_m !== null && prod.price_m !== undefined && prod.price_m !== '') ? Number(prod.price_m) : 0;
        const pG = (prod.price_g !== null && prod.price_g !== undefined && prod.price_g !== '') ? Number(prod.price_g) : 0;
        if (pP > 0 || pM > 0 || pG > 0) {
          sizesArr = [
            { size_key: 'P', name: 'P (Pequena)', price: pP },
            { size_key: 'M', name: 'M (Média)', price: pM },
            { size_key: 'G', name: 'G (Grande)', price: pG }
          ];
        }
      }

      // Payload usando APENAS colunas conhecidas do schema real do banco
      const cleanPayload = {
        name: String(prod.name || '').trim(),
        category_id: categoryId,
        description: prod.description ? String(prod.description).trim() : '',
        price: (prod.price !== null && prod.price !== undefined && prod.price !== '') ? Number(prod.price) : null,
        price_p: (prod.price_p !== null && prod.price_p !== undefined && prod.price_p !== '') ? Number(prod.price_p) : null,
        price_m: (prod.price_m !== null && prod.price_m !== undefined && prod.price_m !== '') ? Number(prod.price_m) : null,
        price_g: (prod.price_g !== null && prod.price_g !== undefined && prod.price_g !== '') ? Number(prod.price_g) : null,
        has_sizes: Boolean(prod.has_sizes),
        sizes: sizesArr,
        image_url: prod.image_url ? String(prod.image_url).trim() : null,
        is_available: prod.is_available !== false,
        is_active: prod.is_active !== false,
        is_promo: Boolean(prod.is_promo),
        promo_days: Array.isArray(prod.promo_days) ? prod.promo_days : [],
        promo_price: (prod.promo_price !== null && prod.promo_price !== undefined && prod.promo_price !== '') ? Number(prod.promo_price) : null,
        monday_price: (prod.monday_price !== null && prod.monday_price !== undefined && prod.monday_price !== '') ? Number(prod.monday_price) : null,
        sales_channel: prod.sales_channel ? String(prod.sales_channel).trim() : 'todos',
        order_index: Number(prod.order_index) || 0,
        updated_at: new Date().toISOString()
      };

      let data;
      try {
        if (isExistingUuid) {
          data = await supabaseFetch(`/products?id=eq.${prod.id}`, {
            method: 'PATCH', body: JSON.stringify(cleanPayload)
          });
        } else {
          data = await supabaseFetch('/products', {
            method: 'POST', body: JSON.stringify(cleanPayload)
          });
        }
      } catch (err) {
        console.warn('Falha ao salvar produto completo, tentando payload sem colunas opcionais:', err.message);
        // Fallback 1: sem has_sizes/sizes (caso essas colunas não existam no DB)
        const safePayload = {
          name: cleanPayload.name,
          category_id: cleanPayload.category_id,
          description: cleanPayload.description,
          price: cleanPayload.price,
          price_p: cleanPayload.price_p,
          price_m: cleanPayload.price_m,
          price_g: cleanPayload.price_g,
          image_url: cleanPayload.image_url,
          is_available: cleanPayload.is_available,
          is_active: cleanPayload.is_active,
          is_promo: cleanPayload.is_promo,
          promo_days: cleanPayload.promo_days,
          promo_price: cleanPayload.promo_price,
          monday_price: cleanPayload.monday_price,
          order_index: cleanPayload.order_index,
          updated_at: cleanPayload.updated_at
        };
        try {
          if (isExistingUuid) {
            data = await supabaseFetch(`/products?id=eq.${prod.id}`, {
              method: 'PATCH', body: JSON.stringify(safePayload)
            });
          } else {
            data = await supabaseFetch('/products', {
              method: 'POST', body: JSON.stringify(safePayload)
            });
          }
        } catch (err2) {
          console.warn('Fallback 1 falhou, tentando payload mínimo:', err2.message);
          // Fallback 2: payload absolutamente mínimo
          const minPayload = {
            name: cleanPayload.name,
            category_id: cleanPayload.category_id,
            description: cleanPayload.description,
            price: cleanPayload.price,
            image_url: cleanPayload.image_url,
            is_available: cleanPayload.is_available,
            is_active: cleanPayload.is_active,
            is_promo: cleanPayload.is_promo,
            promo_days: cleanPayload.promo_days,
            promo_price: cleanPayload.promo_price,
            monday_price: cleanPayload.monday_price,
            order_index: cleanPayload.order_index,
            updated_at: cleanPayload.updated_at
          };
          if (isExistingUuid) {
            data = await supabaseFetch(`/products?id=eq.${prod.id}`, {
              method: 'PATCH', body: JSON.stringify(minPayload)
            });
          } else {
            data = await supabaseFetch('/products', {
              method: 'POST', body: JSON.stringify(minPayload)
            });
          }
        }
      }
      // Retorna produto salvo com campos opcionais mesclados para consistência no front-end
      const savedProduct = Array.isArray(data) ? data[0] : data;
      if (savedProduct) {
        if (savedProduct.has_sizes === undefined) savedProduct.has_sizes = cleanPayload.has_sizes;
        if (!savedProduct.sizes || savedProduct.sizes.length === 0) savedProduct.sizes = cleanPayload.sizes;
        if (savedProduct.price_p === undefined) savedProduct.price_p = cleanPayload.price_p;
        if (savedProduct.price_m === undefined) savedProduct.price_m = cleanPayload.price_m;
        if (savedProduct.price_g === undefined) savedProduct.price_g = cleanPayload.price_g;
      }
      return respond(200, { data: savedProduct });
    }

    // -------------------------------------------------------
    // DELETE PRODUCT
    // -------------------------------------------------------
    if (method === 'DELETE' && path === 'delete-product') {
      const { id } = body;
      await supabaseFetch(`/products?id=eq.${id}`, { method: 'DELETE' });
      return respond(200, { success: true });
    }

    // -------------------------------------------------------
    // GET OPTIONALS
    // -------------------------------------------------------
    if (method === 'GET' && path === 'get-optionals') {
      const data = await supabaseFetch('/optionals?order=order_index');
      return respond(200, { data });
    }

    // -------------------------------------------------------
    // SAVE OPTIONAL
    // -------------------------------------------------------
    if (method === 'POST' && path === 'save-optional') {
      const opt = body;
      let data;
      const isExistingUuid = opt.id && /^[0-9a-f-]{36}$/i.test(opt.id);

      const cleanPayload = {
        name: String(opt.name || '').trim(),
        price: Number(opt.price) || 0,
        is_active: opt.is_active !== false,
        order_index: Number(opt.order_index) || 0,
        target: opt.target ? String(opt.target).trim() : 'all',
        applicable_category_ids: Array.isArray(opt.applicable_category_ids) ? opt.applicable_category_ids : []
      };

      try {
        if (isExistingUuid) {
          data = await supabaseFetch(`/optionals?id=eq.${opt.id}`, {
            method: 'PATCH', body: JSON.stringify(cleanPayload)
          });
        } else {
          data = await supabaseFetch('/optionals', {
            method: 'POST', body: JSON.stringify(opt.id ? { id: opt.id, ...cleanPayload } : cleanPayload)
          });
        }
      } catch (err) {
        console.warn('Falha ao salvar adicional completo no Supabase, tentando campos padrão:', err.message);
        const safePayload = {
          name: cleanPayload.name,
          price: cleanPayload.price,
          is_active: cleanPayload.is_active,
          order_index: cleanPayload.order_index
        };
        if (isExistingUuid) {
          data = await supabaseFetch(`/optionals?id=eq.${opt.id}`, {
            method: 'PATCH', body: JSON.stringify(safePayload)
          });
        } else {
          data = await supabaseFetch('/optionals', {
            method: 'POST', body: JSON.stringify(opt.id ? { id: opt.id, ...safePayload } : safePayload)
          });
        }
      }
      const finalData = Array.isArray(data) ? data[0] : (data || cleanPayload);
      return respond(200, { data: { ...cleanPayload, ...finalData, id: finalData?.id || opt.id } });
    }

    // -------------------------------------------------------
    // DELETE OPTIONAL
    // -------------------------------------------------------
    if (method === 'DELETE' && path === 'delete-optional') {
      const { id } = body;
      await supabaseFetch(`/optionals?id=eq.${id}`, { method: 'DELETE' });
      return respond(200, { success: true });
    }

    // -------------------------------------------------------
    // GET PROMOTIONS
    // -------------------------------------------------------
    if (method === 'GET' && path === 'get-promotions') {
      const data = await supabaseFetch('/promotions?order=created_at.desc');
      return respond(200, { data });
    }

    // -------------------------------------------------------
    // SAVE PROMOTION
    // -------------------------------------------------------
    if (method === 'POST' && path === 'save-promotion') {
      const promo = body;
      let data;
      if (promo.id && /^[0-9a-f-]{36}$/i.test(promo.id)) {
        data = await supabaseFetch(`/promotions?id=eq.${promo.id}`, {
          method: 'PATCH', body: JSON.stringify(promo)
        });
      } else {
        const { id, ...payload } = promo;
        data = await supabaseFetch('/promotions', {
          method: 'POST', body: JSON.stringify(payload)
        });
      }
      return respond(200, { data: Array.isArray(data) ? data[0] : data });
    }

    // -------------------------------------------------------
    // DELETE PROMOTION
    // -------------------------------------------------------
    if (method === 'DELETE' && path === 'delete-promotion') {
      const { id } = body;
      await supabaseFetch(`/promotions?id=eq.${id}`, { method: 'DELETE' });
      return respond(200, { success: true });
    }

    // -------------------------------------------------------
    // GET ORDERS
    // -------------------------------------------------------
    if (method === 'GET' && path === 'get-orders') {
      const limit = Number(event.queryStringParameters?.limit) || 150;
      let data = [];
      try {
        data = await supabaseFetch(`/orders?order=created_at.desc&limit=${limit}`);
      } catch (err) {
        try {
          data = await supabaseFetch(`/orders?select=*&order=created_at.desc&limit=${limit}`);
        } catch (e2) {
          console.warn('Erro ao buscar pedidos no Supabase REST:', e2.message);
        }
      }
      return respond(200, { data: Array.isArray(data) ? data : [] });
    }

    // -------------------------------------------------------
    // CREATE ORDER
    // -------------------------------------------------------
    if (method === 'POST' && path === 'create-order') {
      const { items, ...orderData } = body;

      // Garante ID único válido para compatibilidade total (UUID / TEXT)
      let orderId = orderData.id;
      if (!orderId || typeof orderId !== 'string' || orderId.trim().length === 0) {
        orderId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : ('ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9));
      } else {
        orderId = orderId.trim();
      }

      // Obtém o maior order_number atual no banco para gerar o próximo sequencial único
      let nextOrderNumber = 1001;
      try {
        const lastOrders = await supabaseFetch('/orders?select=order_number&order=order_number.desc&limit=1');
        const maxOrderNumber = (Array.isArray(lastOrders) && lastOrders[0]?.order_number) ? Number(lastOrders[0].order_number) : 0;
        nextOrderNumber = maxOrderNumber > 0 ? (maxOrderNumber + 1) : 1001;
      } catch (e) {
        console.warn('Erro ao consultar maior order_number:', e);
        nextOrderNumber = Number(orderData.order_number) || 1001;
      }

      // Normaliza payment_method para atender ao check constraint do PostgreSQL
      let paymentMethod = 'pix';
      if (orderData.payment_method) {
        const pm = String(orderData.payment_method).toLowerCase().trim();
        if (pm.includes('pix')) paymentMethod = 'pix';
        else if (pm.includes('dinheiro')) paymentMethod = 'dinheiro';
        else if (pm.includes('credito') || pm.includes('crédito')) paymentMethod = 'cartao_credito';
        else if (pm.includes('debito') || pm.includes('débito')) paymentMethod = 'cartao_debito';
        else if (pm.includes('cartao') || pm.includes('cartão')) paymentMethod = 'cartao';
        else if (pm.includes('pendente')) paymentMethod = 'pendente';
      }

      // Normaliza order_type
      let orderType = 'delivery';
      if (orderData.order_type) {
        const ot = String(orderData.order_type).toLowerCase().trim();
        if (ot === 'retirada' || ot === 'pickup') orderType = 'pickup';
        else if (ot === 'mesa') orderType = 'mesa';
        else if (ot === 'balcao' || ot === 'balcão') orderType = 'balcao';
      }

      const addr = orderData.delivery_address || {};

      // Constrói payload limpo e seguro para a tabela orders
      const orderItemsList = Array.isArray(items) ? items : (Array.isArray(orderData.items) ? orderData.items : []);
      const cleanOrderPayload = {
        id: orderId,
        order_number: nextOrderNumber,
        customer_name: String(orderData.customer_name || 'Cliente').trim(),
        customer_phone: String(orderData.customer_phone || '').trim(),
        order_type: orderType,
        status: orderData.status || 'novo',
        delivery_address: orderData.delivery_address || (addr.street ? { street: addr.street, number: addr.number, neighborhood: addr.neighborhood, complement: addr.complement, reference: addr.reference } : null),
        address_street: addr.street || orderData.address_street || null,
        address_number: addr.number || orderData.address_number || null,
        address_neighborhood: addr.neighborhood || orderData.address_neighborhood || null,
        address_complement: addr.complement || orderData.address_complement || null,
        address_reference: addr.reference || orderData.address_reference || null,
        items: orderItemsList,
        payment_method: paymentMethod,
        change_for: (orderData.change_for !== null && orderData.change_for !== undefined && orderData.change_for !== '') ? Number(orderData.change_for) : null,
        subtotal: Number(orderData.subtotal) || 0,
        delivery_fee: Number(orderData.delivery_fee) || 0,
        discount: Number(orderData.discount) || 0,
        total: Number(orderData.total) || 0,
        notes: orderData.notes ? String(orderData.notes).trim() : null,
        table_number: (orderData.table_number !== null && orderData.table_number !== undefined && orderData.table_number !== '') ? Number(orderData.table_number) : null,
        courier_name: orderData.courier_name ? String(orderData.courier_name).trim() : null,
        created_at: orderData.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Só envia user_id se for um UUID ou string válida
      if (orderData.user_id && typeof orderData.user_id === 'string' && orderData.user_id.trim()) {
        cleanOrderPayload.user_id = orderData.user_id.trim();
      }

      let insertedOrders;
      try {
        insertedOrders = await supabaseFetch('/orders', {
          method: 'POST',
          body: JSON.stringify(cleanOrderPayload)
        });
      } catch (err) {
        console.warn('Erro ao inserir pedido com payload completo, tentando com fallback:', err.message);
        cleanOrderPayload.order_number = nextOrderNumber + Math.floor(Math.random() * 10) + 1;
        insertedOrders = await supabaseFetch('/orders', {
          method: 'POST',
          body: JSON.stringify(cleanOrderPayload)
        });
      }

      let insertedOrder = Array.isArray(insertedOrders) ? insertedOrders[0] : (insertedOrders || cleanOrderPayload);
      if (!insertedOrder || typeof insertedOrder !== 'object') {
        insertedOrder = { ...cleanOrderPayload };
      }
      if (!insertedOrder.items || !Array.isArray(insertedOrder.items) || insertedOrder.items.length === 0) {
        insertedOrder.items = cleanOrderPayload.items;
      }

      return respond(200, { data: insertedOrder });
    }

    // -------------------------------------------------------
    // UPDATE ORDER STATUS
    // -------------------------------------------------------
    if (method === 'POST' && path === 'update-order') {
      const { id, status, payment_method, courier_name } = body;
      const payload = { status, updated_at: new Date().toISOString() };
      if (payment_method) payload.payment_method = payment_method;
      if (courier_name !== undefined) payload.courier_name = courier_name;
      const data = await supabaseFetch(`/orders?id=eq.${id}`, {
        method: 'PATCH', body: JSON.stringify(payload)
      });
      return respond(200, { data: Array.isArray(data) ? data[0] : data });
    }

    // -------------------------------------------------------
    // DELETE ORDERS (limpeza de pedidos)
    // -------------------------------------------------------
    if ((method === 'DELETE' || method === 'POST') && path === 'delete-orders') {
      const { ids } = body;
      if (ids && Array.isArray(ids) && ids.length > 0) {
        try {
          await supabaseFetch(`/order_items?order_id=in.(${ids.map(encodeURIComponent).join(',')})`, { method: 'DELETE' });
        } catch {}
        try {
          await supabaseFetch(`/orders?id=in.(${ids.map(encodeURIComponent).join(',')})`, { method: 'DELETE' });
        } catch (e) {
          console.warn('Erro ao deletar pedidos específicos:', e.message);
        }
      } else {
        // Deleta todos os pedidos
        try {
          await supabaseFetch('/order_items?id=not.is.null', { method: 'DELETE' });
        } catch {}
        try {
          await supabaseFetch('/orders?id=not.is.null', { method: 'DELETE' });
        } catch (e1) {
          try {
            await supabaseFetch('/orders?order_number=gt.0', { method: 'DELETE' });
          } catch (e2) {
            console.warn('Erro ao deletar todos os pedidos no Supabase:', e2.message);
          }
        }
      }
      return respond(200, { success: true });
    }

    // -------------------------------------------------------
    // GET NEIGHBORHOODS
    // -------------------------------------------------------
    if (method === 'GET' && path === 'get-neighborhoods') {
      const data = await supabaseFetch('/neighborhoods?order=name');
      return respond(200, { data });
    }

    // -------------------------------------------------------
    // SAVE NEIGHBORHOOD
    // -------------------------------------------------------
    if (method === 'POST' && path === 'save-neighborhood') {
      const n = body;
      const cleanPayload = {
        name: String(n.name || '').trim(),
        delivery_fee: Number(n.delivery_fee) || 0,
        delivery_time_min: Number(n.delivery_time_min) || 60,
        is_active: n.is_active !== false
      };
      let data;
      if (n.id && /^[0-9a-f-]{36}$/i.test(n.id)) {
        data = await supabaseFetch(`/neighborhoods?id=eq.${n.id}`, {
          method: 'PATCH', body: JSON.stringify(cleanPayload)
        });
        if (!data || (Array.isArray(data) && data.length === 0)) {
          data = await supabaseFetch('/neighborhoods', {
            method: 'POST', body: JSON.stringify({ id: n.id, ...cleanPayload })
          });
        }
      } else {
        data = await supabaseFetch('/neighborhoods', {
          method: 'POST', body: JSON.stringify(cleanPayload)
        });
      }
      return respond(200, { data: Array.isArray(data) ? data[0] : data });
    }

    // -------------------------------------------------------
    // DELETE NEIGHBORHOOD
    // -------------------------------------------------------
    if (method === 'DELETE' && path === 'delete-neighborhood') {
      const { id } = body;
      await supabaseFetch(`/neighborhoods?id=eq.${id}`, { method: 'DELETE' });
      return respond(200, { success: true });
    }

    // -------------------------------------------------------
    // GET COURIERS
    // -------------------------------------------------------
    if (method === 'GET' && path === 'get-couriers') {
      const data = await supabaseFetch('/couriers?order=name');
      return respond(200, { data });
    }

    // -------------------------------------------------------
    // SAVE COURIER
    // -------------------------------------------------------
    if (method === 'POST' && path === 'save-courier') {
      const c = body;
      const cleanPayload = {
        name: String(c.name || '').trim(),
        phone: String(c.phone || '').trim(),
        is_active: c.is_active !== false
      };
      let data;
      if (c.id && /^[0-9a-f-]{36}$/i.test(c.id)) {
        data = await supabaseFetch(`/couriers?id=eq.${c.id}`, {
          method: 'PATCH', body: JSON.stringify(cleanPayload)
        });
        if (!data || (Array.isArray(data) && data.length === 0)) {
          data = await supabaseFetch('/couriers', {
            method: 'POST', body: JSON.stringify({ id: c.id, ...cleanPayload })
          });
        }
      } else {
        data = await supabaseFetch('/couriers', {
          method: 'POST', body: JSON.stringify(cleanPayload)
        });
      }
      return respond(200, { data: Array.isArray(data) ? data[0] : data });
    }

    // -------------------------------------------------------
    // DELETE COURIER
    // -------------------------------------------------------
    if (method === 'DELETE' && path === 'delete-courier') {
      const { id } = body;
      await supabaseFetch(`/couriers?id=eq.${id}`, { method: 'DELETE' });
      return respond(200, { success: true });
    }

    // -------------------------------------------------------
    // GET CASH CLOSINGS
    // -------------------------------------------------------
    if (method === 'GET' && path === 'get-cash-closings') {
      const data = await supabaseFetch('/cash_closings?order=closed_at.desc');
      return respond(200, { data });
    }

    // -------------------------------------------------------
    // SAVE CASH CLOSING
    // -------------------------------------------------------
    if (method === 'POST' && path === 'save-cash-closing') {
      const c = body;
      let data;
      if (c.id && /^[0-9a-f-]{36}$/i.test(c.id)) {
        data = await supabaseFetch(`/cash_closings?id=eq.${c.id}`, {
          method: 'PATCH', body: JSON.stringify(c)
        });
      } else {
        const { id, ...payload } = c;
        data = await supabaseFetch('/cash_closings', {
          method: 'POST', body: JSON.stringify(payload)
        });
      }
      return respond(200, { data: Array.isArray(data) ? data[0] : data });
    }

    // -------------------------------------------------------
    // GET OPERATING HOURS
    // -------------------------------------------------------
    if (method === 'GET' && path === 'get-hours') {
      const data = await supabaseFetch('/operating_hours?order=day_of_week');
      return respond(200, { data });
    }

    // -------------------------------------------------------
    // UPDATE OPERATING HOURS
    // -------------------------------------------------------
    if (method === 'POST' && path === 'update-hours') {
      const { hours } = body;
      const data = await supabaseFetch('/operating_hours', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(hours)
      });
      return respond(200, { data });
    }

    // -------------------------------------------------------
    // UPLOAD IMAGE
    // -------------------------------------------------------
    if (method === 'POST' && path === 'upload-image') {
      const { base64, fileName, mimeType } = body;
      if (!base64 || !fileName) return respond(400, { error: 'base64 e fileName são obrigatórios.' });
      const publicUrl = await uploadToStorage(base64, fileName, mimeType);
      return respond(200, { url: publicUrl });
    }

    // -------------------------------------------------------
    // GET PROFILES (users)
    // -------------------------------------------------------
    if (method === 'GET' && path === 'get-user-by-phone') {
      const { phone } = event.queryStringParameters || {};
      const data = await supabaseFetch(`/profiles?phone=eq.${phone}&limit=1`);
      return respond(200, { data: Array.isArray(data) ? data[0] : data });
    }

    if (method === 'POST' && path === 'save-user') {
      const user = body;
      let data;
      if (user.id && /^[0-9a-f-]{36}$/i.test(user.id)) {
        data = await supabaseFetch(`/profiles?id=eq.${user.id}`, {
          method: 'PATCH', body: JSON.stringify(user)
        });
      } else {
        const { id, ...payload } = user;
        data = await supabaseFetch('/profiles', {
          method: 'POST', body: JSON.stringify(payload)
        });
      }
      return respond(200, { data: Array.isArray(data) ? data[0] : data });
    }

    // -------------------------------------------------------
    // DAY PROMOTIONS
    // -------------------------------------------------------
    if (method === 'GET' && path === 'get-day-promotions') {
      const data = await supabaseFetch('/day_promotions');
      return respond(200, { data });
    }

    if (method === 'POST' && path === 'save-day-promotion') {
      const promo = body;
      let data;
      if (promo.id && /^[0-9a-f-]{36}$/i.test(promo.id)) {
        data = await supabaseFetch(`/day_promotions?id=eq.${promo.id}`, {
          method: 'PATCH', body: JSON.stringify(promo)
        });
      } else {
        const { id, ...payload } = promo;
        data = await supabaseFetch('/day_promotions', {
          method: 'POST', body: JSON.stringify(payload)
        });
      }
      return respond(200, { data: Array.isArray(data) ? data[0] : data });
    }

    if (method === 'DELETE' && path === 'delete-day-promotion') {
      const { id } = body;
      await supabaseFetch(`/day_promotions?id=eq.${id}`, { method: 'DELETE' });
      return respond(200, { success: true });
    }

    return respond(404, { error: `Ação desconhecida: ${path}` });

  } catch (err) {
    console.error('[API Error]', err);
    return respond(500, { error: err.message || 'Erro interno do servidor.' });
  }
};
