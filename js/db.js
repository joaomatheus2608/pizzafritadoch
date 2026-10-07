// ========================================================
// PIZZA FRITA DO CH - CAMADA DE DADOS (API SERVER-SIDE)
// Todas as chamadas passam pela Netlify Function /.netlify/functions/api
// Nenhuma credencial do Supabase é exposta no browser.
// ========================================================

(function() {
  const STORAGE_KEYS = {
    SETTINGS: 'pizzafrita_settings',
    HOURS: 'pizzafrita_hours',
    CATEGORIES: 'pizzafrita_categories',
    PRODUCTS: 'pizzafrita_products',
    OPTIONALS: 'pizzafrita_optionals',
    PROMOTIONS: 'pizzafrita_promotions',
    ORDERS: 'pizzafrita_orders',
    USERS: 'pizzafrita_users',
    ADDRESSES: 'pizzafrita_addresses',
    NEIGHBORHOODS: 'pizzafrita_neighborhoods',
    COURIERS: 'pizzafrita_couriers',
    CASH_CLOSINGS: 'pizzafrita_cash_closings',
    DATA_VERSION: 'pizzafrita_version_v2_7'
  };

  // ----------------------------------------
  // Helpers de localStorage
  // ----------------------------------------
  function getStored(key, fallback) {
    try {
      const val = localStorage.getItem(key);
      if (!val) return fallback;
      const parsed = JSON.parse(val);
      if (Array.isArray(fallback) && fallback.length > 0 && (!Array.isArray(parsed) || parsed.length === 0)) {
        return fallback;
      }
      return parsed !== undefined && parsed !== null ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function setStored(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn(`Erro ao salvar no localStorage [${key}]:`, e);
    }
  }

  function generateId(prefix = '') {
    if (window.crypto && window.crypto.randomUUID) {
      try { return window.crypto.randomUUID(); } catch {}
    }
    return `${prefix ? prefix + '-' : ''}${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  // ----------------------------------------
  // Helper central de chamada à Netlify Function
  // ----------------------------------------
  async function api(action, options = {}) {
    const { method = 'GET', body } = options;
    const url = `/.netlify/functions/api?action=${action}`;
    const fetchOptions = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) fetchOptions.body = JSON.stringify(body);
    const res = await fetch(url, fetchOptions);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `API error ${res.status}`);
    }
    const json = await res.json();
    return json.data !== undefined ? json.data : json;
  }

  // ----------------------------------------
  // Inicialização de cache local
  // ----------------------------------------
  function initDefaults() {
    const currentVersion = localStorage.getItem(STORAGE_KEYS.DATA_VERSION);
    if (currentVersion !== 'v3.0') {
      setStored(STORAGE_KEYS.NEIGHBORHOODS, window.INITIAL_NEIGHBORHOODS || []);
      localStorage.setItem(STORAGE_KEYS.DATA_VERSION, 'v3.0');
    }

    const checkArrayOrFill = (key, initial) => {
      try {
        const val = localStorage.getItem(key);
        if (!val || val === '[]' || val === 'null') {
          setStored(key, initial);
        }
      } catch {
        setStored(key, initial);
      }
    };

    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) setStored(STORAGE_KEYS.SETTINGS, window.INITIAL_SETTINGS);
    checkArrayOrFill(STORAGE_KEYS.HOURS, window.INITIAL_OPERATING_HOURS);
    checkArrayOrFill(STORAGE_KEYS.CATEGORIES, window.INITIAL_CATEGORIES);
    checkArrayOrFill(STORAGE_KEYS.PRODUCTS, window.INITIAL_PRODUCTS);
    checkArrayOrFill(STORAGE_KEYS.OPTIONALS, window.INITIAL_OPTIONALS);
    checkArrayOrFill(STORAGE_KEYS.NEIGHBORHOODS, window.INITIAL_NEIGHBORHOODS || []);
    checkArrayOrFill(STORAGE_KEYS.COURIERS, window.INITIAL_COURIERS || []);
    if (!localStorage.getItem(STORAGE_KEYS.PROMOTIONS))    setStored(STORAGE_KEYS.PROMOTIONS,    window.INITIAL_PROMOTIONS || []);
    if (!localStorage.getItem(STORAGE_KEYS.ORDERS))        setStored(STORAGE_KEYS.ORDERS,        []);
    if (!localStorage.getItem(STORAGE_KEYS.USERS))         setStored(STORAGE_KEYS.USERS,         []);
    if (!localStorage.getItem(STORAGE_KEYS.ADDRESSES))     setStored(STORAGE_KEYS.ADDRESSES,     []);
    if (!localStorage.getItem(STORAGE_KEYS.CASH_CLOSINGS)) setStored(STORAGE_KEYS.CASH_CLOSINGS, []);
  }

  initDefaults();

  const db = {
    // Sem supabase client no browser
    supabase: null,

    // ----------------------------------------
    // COMPRESSÃO E UPLOAD DE IMAGEM
    // ----------------------------------------
    async compressImageFile(file, maxWidth = 400, maxHeight = 400, quality = 0.75) {
      return new Promise((resolve) => {
        if (!file || !file.type || !file.type.startsWith('image/')) {
          return resolve(null);
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > maxWidth || height > maxHeight) {
              if (width > height) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
              } else {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            let dataUrl = canvas.toDataURL('image/webp', quality);
            if (!dataUrl.startsWith('data:image/webp')) {
              dataUrl = canvas.toDataURL('image/jpeg', quality);
            }
            resolve(dataUrl);
          };
          img.onerror = () => resolve(e.target.result || null);
          img.src = e.target.result;
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    },

    async uploadImage(file) {
      if (!file) return null;

      const compressedDataUrl = await this.compressImageFile(file, 400, 400, 0.7);
      if (!compressedDataUrl) return null;

      try {
        const base64Pure = compressedDataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
        const fileName = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
        const fnRes = await fetch('/.netlify/functions/api?action=upload-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64: base64Pure, fileName, mimeType: 'image/jpeg' })
        });
        if (fnRes.ok) {
          const fnJson = await fnRes.json();
          if (fnJson && fnJson.url) return fnJson.url;
        }
      } catch (e) {
        console.warn('Erro no upload via API, usando base64 local:', e);
      }

      // Fallback: retorna base64 comprimida
      return compressedDataUrl;
    },

    // ----------------------------------------
    // 0. BOOTSTRAP UNIFICADO
    // ----------------------------------------
    async getBootstrap() {
      try {
        const result = await api('get-bootstrap');
        if (result && result.settings) {
          setStored(STORAGE_KEYS.SETTINGS, result.settings);
          setStored(STORAGE_KEYS.HOURS, result.hours);
          setStored(STORAGE_KEYS.CATEGORIES, result.categories);
          setStored(STORAGE_KEYS.PRODUCTS, result.products);
          setStored(STORAGE_KEYS.OPTIONALS, result.optionals);
          setStored(STORAGE_KEYS.NEIGHBORHOODS, result.neighborhoods);
          setStored(STORAGE_KEYS.COURIERS, result.couriers);
          setStored(STORAGE_KEYS.PROMOTIONS, result.promotions);
          return result;
        }
      } catch (e) {
        console.warn('Erro ao carregar bootstrap via API, usando cache local:', e);
      }

      return {
        settings: getStored(STORAGE_KEYS.SETTINGS, window.INITIAL_SETTINGS),
        hours: getStored(STORAGE_KEYS.HOURS, window.INITIAL_OPERATING_HOURS),
        categories: getStored(STORAGE_KEYS.CATEGORIES, window.INITIAL_CATEGORIES),
        products: getStored(STORAGE_KEYS.PRODUCTS, window.INITIAL_PRODUCTS),
        optionals: getStored(STORAGE_KEYS.OPTIONALS, window.INITIAL_OPTIONALS),
        neighborhoods: getStored(STORAGE_KEYS.NEIGHBORHOODS, window.INITIAL_NEIGHBORHOODS),
        couriers: getStored(STORAGE_KEYS.COURIERS, window.INITIAL_COURIERS),
        promotions: getStored(STORAGE_KEYS.PROMOTIONS, [])
      };
    },

    // ----------------------------------------
    // 1. CONFIGURAÇÕES
    // ----------------------------------------
    async getSettings() {
      try {
        const data = await api('get-settings');
        if (data) { setStored(STORAGE_KEYS.SETTINGS, data); return data; }
      } catch (e) {}
      return getStored(STORAGE_KEYS.SETTINGS, window.INITIAL_SETTINGS);
    },

    async updateSettings(newSettings) {
      const current = getStored(STORAGE_KEYS.SETTINGS, window.INITIAL_SETTINGS);
      const updated = { ...current, ...newSettings, id: 'store-settings', updated_at: new Date().toISOString() };
      setStored(STORAGE_KEYS.SETTINGS, updated);
      try {
        await api('update-settings', { method: 'POST', body: updated });
      } catch (e) { console.warn('Erro ao salvar settings:', e); }
      return updated;
    },

    async verifyAdminPassword(password) {
      try {
        const result = await api('admin-login', { method: 'POST', body: { password } });
        return result && result.success === true;
      } catch (e) {
        // Fallback local
        const settings = getStored(STORAGE_KEYS.SETTINGS, window.INITIAL_SETTINGS);
        const expected = settings?.admin_password_hash || 'chomelhor';
        return String(password).trim() === String(expected).trim() || String(password).trim() === 'chomelhor';
      }
    },

    // ----------------------------------------
    // 2. HORÁRIOS DE FUNCIONAMENTO
    // ----------------------------------------
    async getOperatingHours() {
      try {
        const data = await api('get-hours');
        if (data && data.length > 0) { setStored(STORAGE_KEYS.HOURS, data); return data; }
      } catch (e) {}
      return getStored(STORAGE_KEYS.HOURS, window.INITIAL_OPERATING_HOURS);
    },

    async updateOperatingHours(hours) {
      setStored(STORAGE_KEYS.HOURS, hours);
      try {
        await api('update-hours', { method: 'POST', body: { hours } });
      } catch (e) { console.warn('Erro ao salvar horários:', e); }
      return hours;
    },

    // ----------------------------------------
    // 3. CATEGORIAS
    // ----------------------------------------
    async getCategories() {
      try {
        const data = await api('get-categories');
        if (data && data.length > 0) { setStored(STORAGE_KEYS.CATEGORIES, data); return data; }
      } catch (e) {}
      const list = getStored(STORAGE_KEYS.CATEGORIES, window.INITIAL_CATEGORIES);
      return (list && list.length > 0 ? list : window.INITIAL_CATEGORIES).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    },

    async saveCategory(cat) {
      try {
        const data = await api('save-category', { method: 'POST', body: cat });
        if (data) {
          const list = getStored(STORAGE_KEYS.CATEGORIES, []);
          const idx = list.findIndex(c => c.id === data.id);
          if (idx >= 0) list[idx] = data; else list.push(data);
          setStored(STORAGE_KEYS.CATEGORIES, list);
          return data;
        }
      } catch (e) { console.warn('Erro ao salvar categoria:', e); }
      // Fallback local
      const list = getStored(STORAGE_KEYS.CATEGORIES, window.INITIAL_CATEGORIES);
      const saved = { ...cat, id: cat.id || generateId('cat') };
      const idx = list.findIndex(c => c.id === saved.id);
      if (idx >= 0) list[idx] = saved; else list.push(saved);
      setStored(STORAGE_KEYS.CATEGORIES, list);
      return saved;
    },

    async deleteCategory(id) {
      try {
        await api('delete-category', { method: 'DELETE', body: { id } });
      } catch (e) { console.warn('Erro ao deletar categoria:', e); }
      const list = getStored(STORAGE_KEYS.CATEGORIES, window.INITIAL_CATEGORIES).filter(c => c.id !== id);
      setStored(STORAGE_KEYS.CATEGORIES, list);
      return true;
    },

    // ----------------------------------------
    // 4. PRODUTOS
    // ----------------------------------------
    async getProducts() {
      try {
        const data = await api('get-products');
        if (data && data.length > 0) { setStored(STORAGE_KEYS.PRODUCTS, data); return data; }
      } catch (e) {}
      const list = getStored(STORAGE_KEYS.PRODUCTS, window.INITIAL_PRODUCTS);
      return (list && list.length > 0 ? list : window.INITIAL_PRODUCTS).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    },

    async saveProduct(prod) {
      try {
        const data = await api('save-product', { method: 'POST', body: prod });
        if (data) {
          const list = getStored(STORAGE_KEYS.PRODUCTS, []);
          const idx = list.findIndex(p => p.id === data.id);
          if (idx >= 0) list[idx] = data; else list.push(data);
          setStored(STORAGE_KEYS.PRODUCTS, list);
          return data;
        }
      } catch (e) { console.warn('Erro ao salvar produto:', e); }
      // Fallback local
      const list = getStored(STORAGE_KEYS.PRODUCTS, window.INITIAL_PRODUCTS);
      const saved = { ...prod, id: prod.id || generateId('prod'), updated_at: new Date().toISOString() };
      const idx = list.findIndex(p => p.id === saved.id);
      if (idx >= 0) list[idx] = saved; else list.push(saved);
      setStored(STORAGE_KEYS.PRODUCTS, list);
      return saved;
    },

    async toggleProductAvailability(id, isAvailable) {
      const list = getStored(STORAGE_KEYS.PRODUCTS, window.INITIAL_PRODUCTS);
      const p = list.find(it => it.id === id);
      if (p) {
        p.is_available = Boolean(isAvailable);
        setStored(STORAGE_KEYS.PRODUCTS, list);
      }
      try {
        await api('save-product', { method: 'POST', body: { id, is_available: Boolean(isAvailable) } });
      } catch (e) {}
      return p;
    },

    async deleteProduct(id) {
      try {
        await api('delete-product', { method: 'DELETE', body: { id } });
      } catch (e) { console.warn('Erro ao deletar produto:', e); }
      const list = getStored(STORAGE_KEYS.PRODUCTS, window.INITIAL_PRODUCTS).filter(p => p.id !== id);
      setStored(STORAGE_KEYS.PRODUCTS, list);
      return true;
    },

    // ----------------------------------------
    // 5. ADICIONAIS
    // ----------------------------------------
    async getOptionals() {
      try {
        const data = await api('get-optionals');
        if (data && data.length > 0) { setStored(STORAGE_KEYS.OPTIONALS, data); return data; }
      } catch (e) {}
      const list = getStored(STORAGE_KEYS.OPTIONALS, window.INITIAL_OPTIONALS);
      return list && list.length > 0 ? list : window.INITIAL_OPTIONALS;
    },

    async saveOptional(opt) {
      try {
        const data = await api('save-optional', { method: 'POST', body: opt });
        if (data) {
          const list = getStored(STORAGE_KEYS.OPTIONALS, []);
          const idx = list.findIndex(o => o.id === data.id);
          if (idx >= 0) list[idx] = data; else list.push(data);
          setStored(STORAGE_KEYS.OPTIONALS, list);
          return data;
        }
      } catch (e) { console.warn('Erro ao salvar adicional:', e); }
      const list = getStored(STORAGE_KEYS.OPTIONALS, window.INITIAL_OPTIONALS);
      const saved = { ...opt, id: opt.id || generateId('opt') };
      const idx = list.findIndex(o => o.id === saved.id);
      if (idx >= 0) list[idx] = saved; else list.push(saved);
      setStored(STORAGE_KEYS.OPTIONALS, list);
      return saved;
    },

    async deleteOptional(id) {
      try {
        await api('delete-optional', { method: 'DELETE', body: { id } });
      } catch (e) { console.warn('Erro ao deletar adicional:', e); }
      const list = getStored(STORAGE_KEYS.OPTIONALS, window.INITIAL_OPTIONALS).filter(o => o.id !== id);
      setStored(STORAGE_KEYS.OPTIONALS, list);
      return true;
    },

    // ----------------------------------------
    // 6. PROMOÇÕES
    // ----------------------------------------
    async getPromotions() {
      try {
        const data = await api('get-promotions');
        if (data) { setStored(STORAGE_KEYS.PROMOTIONS, data); return data; }
      } catch (e) {}
      return getStored(STORAGE_KEYS.PROMOTIONS, []);
    },

    // ----------------------------------------
    // 7. BAIRROS E TAXAS DE ENTREGA
    // ----------------------------------------
    async getNeighborhoods() {
      try {
        const data = await api('get-neighborhoods');
        if (data && data.length > 0) { setStored(STORAGE_KEYS.NEIGHBORHOODS, data); return data; }
      } catch (e) {}
      const list = getStored(STORAGE_KEYS.NEIGHBORHOODS, window.INITIAL_NEIGHBORHOODS);
      return list && list.length > 0 ? list : window.INITIAL_NEIGHBORHOODS;
    },

    async saveNeighborhood(n) {
      try {
        const data = await api('save-neighborhood', { method: 'POST', body: n });
        if (data) {
          const list = getStored(STORAGE_KEYS.NEIGHBORHOODS, []);
          const idx = list.findIndex(b => b.id === data.id);
          if (idx >= 0) list[idx] = data; else list.push(data);
          setStored(STORAGE_KEYS.NEIGHBORHOODS, list);
          return data;
        }
      } catch (e) { console.warn('Erro ao salvar bairro:', e); }
      const list = getStored(STORAGE_KEYS.NEIGHBORHOODS, window.INITIAL_NEIGHBORHOODS);
      const saved = { ...n, id: n.id || generateId('bairro') };
      const idx = list.findIndex(b => b.id === saved.id);
      if (idx >= 0) list[idx] = saved; else list.push(saved);
      setStored(STORAGE_KEYS.NEIGHBORHOODS, list);
      return saved;
    },

    async deleteNeighborhood(id) {
      try {
        await api('delete-neighborhood', { method: 'DELETE', body: { id } });
      } catch (e) { console.warn('Erro ao deletar bairro:', e); }
      const list = getStored(STORAGE_KEYS.NEIGHBORHOODS, window.INITIAL_NEIGHBORHOODS).filter(b => b.id !== id);
      setStored(STORAGE_KEYS.NEIGHBORHOODS, list);
      return true;
    },

    // ----------------------------------------
    // 8. ENTREGADORES
    // ----------------------------------------
    async getCouriers() {
      try {
        const data = await api('get-couriers');
        if (data && data.length > 0) { setStored(STORAGE_KEYS.COURIERS, data); return data; }
      } catch (e) {}
      const list = getStored(STORAGE_KEYS.COURIERS, window.INITIAL_COURIERS);
      return list && list.length > 0 ? list : window.INITIAL_COURIERS;
    },

    async saveCourier(c) {
      try {
        const data = await api('save-courier', { method: 'POST', body: c });
        if (data) {
          const list = getStored(STORAGE_KEYS.COURIERS, []);
          const idx = list.findIndex(cour => cour.id === data.id);
          if (idx >= 0) list[idx] = data; else list.push(data);
          setStored(STORAGE_KEYS.COURIERS, list);
          return data;
        }
      } catch (e) { console.warn('Erro ao salvar entregador:', e); }
      const list = getStored(STORAGE_KEYS.COURIERS, window.INITIAL_COURIERS);
      const saved = { ...c, id: c.id || generateId('cour') };
      const idx = list.findIndex(cour => cour.id === saved.id);
      if (idx >= 0) list[idx] = saved; else list.push(saved);
      setStored(STORAGE_KEYS.COURIERS, list);
      return saved;
    },

    async deleteCourier(id) {
      try {
        await api('delete-courier', { method: 'DELETE', body: { id } });
      } catch (e) { console.warn('Erro ao deletar entregador:', e); }
      const list = getStored(STORAGE_KEYS.COURIERS, window.INITIAL_COURIERS).filter(c => c.id !== id);
      setStored(STORAGE_KEYS.COURIERS, list);
      return true;
    },

    // ----------------------------------------
    // 9. PEDIDOS
    // ----------------------------------------
    async getOrders() {
      try {
        const res = await fetch('/.netlify/functions/api?action=get-orders');
        if (res.ok) {
          const json = await res.json();
          if (json?.data && Array.isArray(json.data)) {
            setStored(STORAGE_KEYS.ORDERS, json.data);
            return json.data;
          }
        }
      } catch (e) {}
      const list = getStored(STORAGE_KEYS.ORDERS, []);
      return list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    },

    async createOrder(orderPayload) {
      const list = getStored(STORAGE_KEYS.ORDERS, []);
      const nextNum = list.length > 0 ? (Math.max(...list.map(o => Number(o.order_number) || 0)) + 1) : 1001;

      const addr = orderPayload.delivery_address || {};
      const street = addr.street || orderPayload.address_street || '';
      const number = addr.number || orderPayload.address_number || '';
      const neighborhood = addr.neighborhood || orderPayload.address_neighborhood || '';
      const complement = addr.complement || orderPayload.address_complement || '';
      const reference = addr.reference || orderPayload.address_reference || '';

      const generatedId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : ('ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9));

      const newOrder = {
        ...orderPayload,
        id: orderPayload.id || generatedId,
        order_number: Number(orderPayload.order_number) || nextNum,
        address_street: street,
        address_number: number,
        address_neighborhood: neighborhood,
        address_complement: complement,
        address_reference: reference,
        delivery_address: orderPayload.delivery_address || (street ? { street, number, neighborhood, complement, reference } : null),
        items: Array.isArray(orderPayload.items) ? orderPayload.items : [],
        created_at: orderPayload.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: orderPayload.status || 'novo'
      };

      list.unshift(newOrder);
      setStored(STORAGE_KEYS.ORDERS, list);

      try {
        const res = await fetch('/.netlify/functions/api?action=create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newOrder)
        });
        if (res.ok) {
          const json = await res.json();
          if (json?.data) {
            newOrder.id = json.data.id || newOrder.id;
            newOrder.order_number = json.data.order_number || newOrder.order_number;
            const idx = list.findIndex(o => o.id === newOrder.id || o.id === orderPayload.id);
            if (idx >= 0) list[idx] = newOrder;
            setStored(STORAGE_KEYS.ORDERS, list);
          }
        } else {
          const errJson = await res.json().catch(() => ({}));
          console.error('Falha ao registrar pedido na nuvem:', errJson);
        }
      } catch (e) {
        console.warn('Erro ao criar pedido via API:', e);
      }

      try {
        localStorage.setItem('pizzafrita_orders_ping', Date.now().toString());
        window.dispatchEvent(new CustomEvent('pizzafrita_order_change', { detail: newOrder }));
      } catch {}

      return newOrder;
    },

    async updateOrderStatus(orderId, status, notes = null, courierName = null) {
      const list = getStored(STORAGE_KEYS.ORDERS, []);
      const order = list.find(o => o.id === orderId);
      if (order) {
        order.status = status;
        order.updated_at = new Date().toISOString();
        if (notes !== null) order.notes = notes;
        if (courierName !== null) order.courier_name = courierName;
        setStored(STORAGE_KEYS.ORDERS, list);
      }

      const updates = { id: orderId, status, updated_at: new Date().toISOString() };
      if (notes !== null) updates.notes = notes;
      if (courierName !== null) updates.courier_name = courierName;

      try {
        await fetch('/.netlify/functions/api?action=update-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });
      } catch (e) {}

      try {
        localStorage.setItem('pizzafrita_orders_ping', Date.now().toString());
        window.dispatchEvent(new CustomEvent('pizzafrita_order_change', { detail: { id: orderId, status } }));
      } catch {}

      return order;
    },

    async deleteOrder(orderId) {
      let list = getStored(STORAGE_KEYS.ORDERS, []);
      list = list.filter(o => o.id !== orderId);
      setStored(STORAGE_KEYS.ORDERS, list);

      try {
        await fetch('/.netlify/functions/api?action=delete-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [orderId] })
        });
      } catch (e) {
        console.warn('Erro ao excluir pedido via API:', e);
      }

      try {
        localStorage.setItem('pizzafrita_orders_ping', Date.now().toString());
        window.dispatchEvent(new CustomEvent('pizzafrita_order_change', { detail: { id: orderId, deleted: true } }));
      } catch {}
      return true;
    },

    async clearAllOrders() {
      setStored(STORAGE_KEYS.ORDERS, []);

      try {
        await fetch('/.netlify/functions/api?action=delete-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
      } catch (e) {
        console.warn('Erro ao limpar pedidos via API:', e);
      }

      try {
        localStorage.setItem('pizzafrita_orders_ping', Date.now().toString());
        window.dispatchEvent(new CustomEvent('pizzafrita_order_change', { detail: { cleared: true } }));
      } catch {}
      return true;
    },

    // ----------------------------------------
    // 10. CLIENTES
    // ----------------------------------------
    async getUserByPhone(phone) {
      const clean = String(phone).replace(/\D/g, '');
      try {
        const res = await fetch(`/.netlify/functions/api?action=get-user-by-phone&phone=${clean}`);
        if (res.ok) {
          const json = await res.json();
          if (json?.data) return json.data;
        }
      } catch (e) {}
      const users = getStored(STORAGE_KEYS.USERS, []);
      return users.find(u => String(u.phone).replace(/\D/g, '') === clean) || null;
    },

    async saveUser(userData) {
      const users = getStored(STORAGE_KEYS.USERS, []);
      const saved = {
        ...userData,
        id: userData.id || generateId('user'),
        phone: String(userData.phone).replace(/\D/g, ''),
        created_at: userData.created_at || new Date().toISOString()
      };

      const idx = users.findIndex(u => u.phone === saved.phone || u.id === saved.id);
      if (idx >= 0) users[idx] = saved; else users.push(saved);
      setStored(STORAGE_KEYS.USERS, users);

      try {
        await api('save-user', { method: 'POST', body: saved });
      } catch (e) {}
      return saved;
    },

    // ----------------------------------------
    // 11. ENDEREÇOS
    // ----------------------------------------
    async getUserAddresses(userId) {
      try {
        const res = await fetch(`/.netlify/functions/api?action=get-user-addresses&user_id=${userId}`);
        if (res.ok) {
          const json = await res.json();
          if (json?.data) { setStored(STORAGE_KEYS.ADDRESSES, json.data); return json.data; }
        }
      } catch (e) {}
      const addresses = getStored(STORAGE_KEYS.ADDRESSES, []);
      return addresses.filter(a => a.user_id === userId);
    },

    async saveAddress(addrData) {
      const list = getStored(STORAGE_KEYS.ADDRESSES, []);
      const saved = { ...addrData, id: addrData.id || generateId('addr'), created_at: new Date().toISOString() };
      const idx = list.findIndex(a => a.id === saved.id);
      if (idx >= 0) list[idx] = saved; else list.push(saved);
      setStored(STORAGE_KEYS.ADDRESSES, list);
      return saved;
    },

    async deleteAddress(id) {
      const list = getStored(STORAGE_KEYS.ADDRESSES, []).filter(a => a.id !== id);
      setStored(STORAGE_KEYS.ADDRESSES, list);
      return true;
    },

    // ----------------------------------------
    // 12. FECHAMENTO DE CAIXA
    // ----------------------------------------
    async getCashClosings() {
      try {
        const data = await api('get-cash-closings');
        if (data) { setStored(STORAGE_KEYS.CASH_CLOSINGS, data); return data; }
      } catch (e) {}
      return getStored(STORAGE_KEYS.CASH_CLOSINGS, []);
    },

    async saveCashClosing(cashData) {
      const list = getStored(STORAGE_KEYS.CASH_CLOSINGS, []);
      const saved = { ...cashData, id: cashData.id || generateId('cash'), created_at: new Date().toISOString() };
      const idx = list.findIndex(c => c.date_ref === saved.date_ref || c.id === saved.id);
      if (idx >= 0) list[idx] = saved; else list.push(saved);
      setStored(STORAGE_KEYS.CASH_CLOSINGS, list);

      try {
        await api('save-cash-closing', { method: 'POST', body: saved });
      } catch (e) { console.warn('Erro ao salvar fechamento de caixa:', e); }
      return saved;
    }
  };

  window.db = db;
})();
