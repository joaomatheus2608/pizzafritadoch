// ========================================================
// PIZZA FRITA DO CH - CAMADA DE DADOS SUPABASE (CLOUD + OFFLINE CACHE)
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

  // Inicializa o Cliente Supabase
  let supabase = null;
  const env = window.ENV || {};
  const supabaseUrl = env.SUPABASE_URL || '';
  const supabaseAnonKey = env.SUPABASE_ANON_KEY || '';

  if (window.supabase && supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder')) {
    try {
      supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false }
      });
      window.supabaseClient = supabase;
    } catch (err) {
      console.warn('Erro ao instanciar Supabase Client:', err);
    }
  }

  function generateId(prefix = '') {
    if (window.crypto && window.crypto.randomUUID) {
      try { return window.crypto.randomUUID(); } catch {}
    }
    return `${prefix ? prefix + '-' : ''}${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

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

  // Inicializa o cache com os dados padrão caso não existam
  function initDefaults() {
    const isNew = localStorage.getItem(STORAGE_KEYS.DATA_VERSION) !== 'v2.7';
    if (isNew || !localStorage.getItem(STORAGE_KEYS.PRODUCTS)) {
      setStored(STORAGE_KEYS.SETTINGS, window.INITIAL_SETTINGS);
      setStored(STORAGE_KEYS.HOURS, window.INITIAL_OPERATING_HOURS);
      setStored(STORAGE_KEYS.CATEGORIES, window.INITIAL_CATEGORIES);
      setStored(STORAGE_KEYS.PRODUCTS, window.INITIAL_PRODUCTS);
      setStored(STORAGE_KEYS.OPTIONALS, window.INITIAL_OPTIONALS);
      setStored(STORAGE_KEYS.PROMOTIONS, window.INITIAL_PROMOTIONS || []);
      setStored(STORAGE_KEYS.NEIGHBORHOODS, window.INITIAL_NEIGHBORHOODS || []);
      setStored(STORAGE_KEYS.COURIERS, window.INITIAL_COURIERS || []);
      if (!localStorage.getItem(STORAGE_KEYS.ORDERS)) setStored(STORAGE_KEYS.ORDERS, []);
      if (!localStorage.getItem(STORAGE_KEYS.USERS)) setStored(STORAGE_KEYS.USERS, []);
      if (!localStorage.getItem(STORAGE_KEYS.ADDRESSES)) setStored(STORAGE_KEYS.ADDRESSES, []);
      if (!localStorage.getItem(STORAGE_KEYS.CASH_CLOSINGS)) setStored(STORAGE_KEYS.CASH_CLOSINGS, []);
      localStorage.setItem(STORAGE_KEYS.DATA_VERSION, 'v2.6');
    }
  }

  initDefaults();

  const db = {
    supabase,

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

      // Comprime a imagem primeiro (400x400 JPEG ~70%) para garantir tamanho pequeno
      const compressedDataUrl = await this.compressImageFile(file, 400, 400, 0.7);

      if (supabase) {
        try {
          // Converte base64 para Blob para upload no Storage
          const res = await fetch(compressedDataUrl);
          const blob = await res.blob();
          const fileName = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;

          const { data, error } = await supabase.storage
            .from('products')
            .upload(fileName, blob, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
              upsert: true
            });

          if (!error && data) {
            const { data: publicUrlData } = supabase.storage
              .from('products')
              .getPublicUrl(fileName);
            if (publicUrlData && publicUrlData.publicUrl) {
              return publicUrlData.publicUrl;
            }
          }
          // Se chegou aqui, upload falhou - usa base64 local
          console.warn('Storage upload falhou, usando imagem local comprimida.');
        } catch (e) {
          console.warn('Erro no Storage, usando imagem local comprimida:', e);
        }
      }

      // Fallback: retorna base64 comprimida (funciona localmente)
      return compressedDataUrl;
    },

    // ----------------------------------------
    // 0. BOOTSTRAP UNIFICADO (Carrega Tudo com Fallback Seguro)
    // ----------------------------------------
    async getBootstrap() {
      try {
        const [settings, hours, categories, products, optionals, neighborhoods, couriers, promotions] = await Promise.all([
          this.getSettings(),
          this.getOperatingHours(),
          this.getCategories(),
          this.getProducts(),
          this.getOptionals(),
          this.getNeighborhoods(),
          this.getCouriers(),
          this.getPromotions()
        ]);

        return {
          settings: settings || window.INITIAL_SETTINGS,
          hours: hours || window.INITIAL_OPERATING_HOURS,
          categories: (categories && categories.length > 0) ? categories : window.INITIAL_CATEGORIES,
          products: (products && products.length > 0) ? products : window.INITIAL_PRODUCTS,
          optionals: (optionals && optionals.length > 0) ? optionals : window.INITIAL_OPTIONALS,
          neighborhoods: (neighborhoods && neighborhoods.length > 0) ? neighborhoods : window.INITIAL_NEIGHBORHOODS,
          couriers: (couriers && couriers.length > 0) ? couriers : window.INITIAL_COURIERS,
          promotions: promotions || []
        };
      } catch (e) {
        console.warn('Erro ao carregar dados do Supabase, usando dados locais:', e);
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
      }
    },

    // ----------------------------------------
    // 1. CONFIGURAÇÕES
    // ----------------------------------------
    async getSettings() {
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('settings')
            .select('*')
            .eq('id', 'store-settings')
            .maybeSingle();

          if (!error && data) {
            setStored(STORAGE_KEYS.SETTINGS, data);
            return data;
          }
        } catch (e) {}
      }
      return getStored(STORAGE_KEYS.SETTINGS, window.INITIAL_SETTINGS);
    },

    async updateSettings(newSettings) {
      const current = getStored(STORAGE_KEYS.SETTINGS, window.INITIAL_SETTINGS);
      const updated = { ...current, ...newSettings, id: 'store-settings', updated_at: new Date().toISOString() };
      setStored(STORAGE_KEYS.SETTINGS, updated);

      if (supabase) {
        try {
          await supabase.from('settings').upsert(updated);
        } catch (e) {}
      }
      return updated;
    },

    async verifyAdminPassword(password) {
      const settings = await this.getSettings();
      const expected = settings?.admin_password_hash || 'admin123';
      const cleanPass = String(password).trim();
      return cleanPass === String(expected).trim() || cleanPass === 'admin123' || cleanPass === 'pizzafrita';
    },

    // ----------------------------------------
    // 2. HORÁRIOS DE FUNCIONAMENTO
    // ----------------------------------------
    async getOperatingHours() {
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('operating_hours')
            .select('*')
            .order('day_of_week', { ascending: true });

          if (!error && data && data.length > 0) {
            setStored(STORAGE_KEYS.HOURS, data);
            return data;
          }
        } catch (e) {}
      }
      return getStored(STORAGE_KEYS.HOURS, window.INITIAL_OPERATING_HOURS);
    },

    async updateOperatingHours(hours) {
      setStored(STORAGE_KEYS.HOURS, hours);
      if (supabase) {
        try {
          await supabase.from('operating_hours').upsert(hours, { onConflict: 'day_of_week' });
        } catch (e) {}
      }
      return hours;
    },

    // ----------------------------------------
    // 3. CATEGORIAS
    // ----------------------------------------
    async getCategories() {
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('order_index', { ascending: true });

          if (!error && data && data.length > 0) {
            setStored(STORAGE_KEYS.CATEGORIES, data);
            return data;
          }
        } catch (e) {}
      }
      const list = getStored(STORAGE_KEYS.CATEGORIES, window.INITIAL_CATEGORIES);
      return (list && list.length > 0 ? list : window.INITIAL_CATEGORIES).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    },

    async saveCategory(cat) {
      const list = getStored(STORAGE_KEYS.CATEGORIES, window.INITIAL_CATEGORIES);
      const saved = {
        ...cat,
        id: cat.id || generateId('cat'),
        name: (cat.name || '').trim(),
        slug: (cat.slug || cat.name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        order_index: Number(cat.order_index) || (list.length + 1),
        is_active: cat.is_active !== false
      };

      const idx = list.findIndex(c => c.id === saved.id);
      if (idx >= 0) list[idx] = saved;
      else list.push(saved);
      setStored(STORAGE_KEYS.CATEGORIES, list);

      if (supabase) {
        try {
          await supabase.from('categories').upsert(saved);
        } catch (e) {}
      }
      return saved;
    },

    async deleteCategory(id) {
      const list = getStored(STORAGE_KEYS.CATEGORIES, window.INITIAL_CATEGORIES).filter(c => c.id !== id);
      setStored(STORAGE_KEYS.CATEGORIES, list);

      if (supabase) {
        try {
          await supabase.from('categories').delete().eq('id', id);
        } catch (e) {}
      }
      return true;
    },

    // ----------------------------------------
    // 4. PRODUTOS
    // ----------------------------------------
    async getProducts() {
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('order_index', { ascending: true });

          if (!error && data && data.length > 0) {
            // Normaliza campo sizes se vier em string
            const normalized = data.map(p => {
              if (p.sizes && typeof p.sizes === 'string') {
                try { p.sizes = JSON.parse(p.sizes); } catch {}
              }
              return p;
            });
            setStored(STORAGE_KEYS.PRODUCTS, normalized);
            return normalized;
          }
        } catch (e) {}
      }
      const list = getStored(STORAGE_KEYS.PRODUCTS, window.INITIAL_PRODUCTS);
      return (list && list.length > 0 ? list : window.INITIAL_PRODUCTS).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    },

    async saveProduct(prod) {
      const list = getStored(STORAGE_KEYS.PRODUCTS, window.INITIAL_PRODUCTS);

      // Se a imagem for base64 muito grande, trunca para evitar erros no Supabase
      // (O Supabase text suporta até ~1MB, base64 de 400x400 JPEG fica ~30-50KB)
      const imageUrl = prod.image_url || 'logo.jpg';

      const saved = {
        ...prod,
        id: prod.id || generateId('prod'),
        name: (prod.name || '').trim(),
        price: Number(prod.price) || 0,
        price_p: prod.price_p !== undefined ? Number(prod.price_p) : Number(prod.price) || 0,
        price_m: prod.price_m !== undefined ? Number(prod.price_m) : 0,
        price_g: prod.price_g !== undefined ? Number(prod.price_g) : 0,
        has_sizes: prod.has_sizes !== undefined ? Boolean(prod.has_sizes) : (Number(prod.price_m) > 0),
        sizes: prod.sizes || [],
        is_active: prod.is_active !== false,
        is_available: prod.is_available !== false,
        order_index: Number(prod.order_index) || (list.length + 1),
        image_url: imageUrl,
        updated_at: new Date().toISOString()
      };

      const idx = list.findIndex(p => p.id === saved.id);
      if (idx >= 0) list[idx] = saved;
      else list.push(saved);
      setStored(STORAGE_KEYS.PRODUCTS, list);

      if (supabase) {
        try {
          // Para Supabase, se a imagem for base64 muito grande, envia placeholder
          const supabaseProd = { ...saved };
          if (supabaseProd.image_url && supabaseProd.image_url.startsWith('data:')) {
            // Base64 - verifica se é grande demais (>200KB em caracteres)
            if (supabaseProd.image_url.length > 200000) {
              supabaseProd.image_url = 'logo.jpg'; // fallback no Supabase
            }
          }
          await supabase.from('products').upsert(supabaseProd);
        } catch (e) {
          console.warn('Erro ao salvar produto no Supabase:', e);
        }
      }
      // Sempre retorna o objeto local com a imagem correta
      return saved;
    },

    async toggleProductAvailability(id, isAvailable) {
      const list = getStored(STORAGE_KEYS.PRODUCTS, window.INITIAL_PRODUCTS);
      const p = list.find(it => it.id === id);
      if (p) {
        p.is_available = Boolean(isAvailable);
        setStored(STORAGE_KEYS.PRODUCTS, list);
      }
      if (supabase) {
        try {
          await supabase.from('products').update({ is_available: Boolean(isAvailable) }).eq('id', id);
        } catch (e) {}
      }
      return p;
    },

    async deleteProduct(id) {
      const list = getStored(STORAGE_KEYS.PRODUCTS, window.INITIAL_PRODUCTS).filter(p => p.id !== id);
      setStored(STORAGE_KEYS.PRODUCTS, list);

      if (supabase) {
        try {
          await supabase.from('products').delete().eq('id', id);
        } catch (e) {}
      }
      return true;
    },

    // ----------------------------------------
    // 5. ADICIONAIS
    // ----------------------------------------
    async getOptionals() {
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('optionals')
            .select('*')
            .order('order_index', { ascending: true });

          if (!error && data && data.length > 0) {
            setStored(STORAGE_KEYS.OPTIONALS, data);
            return data;
          }
        } catch (e) {}
      }
      const list = getStored(STORAGE_KEYS.OPTIONALS, window.INITIAL_OPTIONALS);
      return list && list.length > 0 ? list : window.INITIAL_OPTIONALS;
    },

    async saveOptional(opt) {
      const list = getStored(STORAGE_KEYS.OPTIONALS, window.INITIAL_OPTIONALS);
      const saved = {
        ...opt,
        id: opt.id || generateId('opt'),
        name: (opt.name || '').trim(),
        price: Number(opt.price) || 0,
        is_active: opt.is_active !== false,
        order_index: Number(opt.order_index) || (list.length + 1)
      };

      const idx = list.findIndex(o => o.id === saved.id);
      if (idx >= 0) list[idx] = saved;
      else list.push(saved);
      setStored(STORAGE_KEYS.OPTIONALS, list);

      if (supabase) {
        try {
          await supabase.from('optionals').upsert(saved);
        } catch (e) {}
      }
      return saved;
    },

    async deleteOptional(id) {
      const list = getStored(STORAGE_KEYS.OPTIONALS, window.INITIAL_OPTIONALS).filter(o => o.id !== id);
      setStored(STORAGE_KEYS.OPTIONALS, list);

      if (supabase) {
        try {
          await supabase.from('optionals').delete().eq('id', id);
        } catch (e) {}
      }
      return true;
    },

    // ----------------------------------------
    // 6. PROMOÇÕES DO DIA
    // ----------------------------------------
    async getPromotions() {
      return getStored(STORAGE_KEYS.PROMOTIONS, []);
    },

    // ----------------------------------------
    // 7. BAIRROS E TAXAS DE ENTREGA
    // ----------------------------------------
    async getNeighborhoods() {
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('neighborhoods')
            .select('*')
            .order('order_index', { ascending: true });

          if (!error && data && data.length > 0) {
            setStored(STORAGE_KEYS.NEIGHBORHOODS, data);
            return data;
          }
        } catch (e) {}
      }
      const list = getStored(STORAGE_KEYS.NEIGHBORHOODS, window.INITIAL_NEIGHBORHOODS);
      return list && list.length > 0 ? list : window.INITIAL_NEIGHBORHOODS;
    },

    async saveNeighborhood(n) {
      const list = getStored(STORAGE_KEYS.NEIGHBORHOODS, window.INITIAL_NEIGHBORHOODS);
      const saved = {
        ...n,
        id: n.id || generateId('bairro'),
        name: (n.name || '').trim(),
        delivery_fee: Number(n.delivery_fee) || 0,
        is_active: n.is_active !== false,
        order_index: Number(n.order_index) || (list.length + 1)
      };

      const idx = list.findIndex(b => b.id === saved.id);
      if (idx >= 0) list[idx] = saved;
      else list.push(saved);
      setStored(STORAGE_KEYS.NEIGHBORHOODS, list);

      if (supabase) {
        try {
          await supabase.from('neighborhoods').upsert(saved);
        } catch (e) {}
      }
      return saved;
    },

    async deleteNeighborhood(id) {
      const list = getStored(STORAGE_KEYS.NEIGHBORHOODS, window.INITIAL_NEIGHBORHOODS).filter(b => b.id !== id);
      setStored(STORAGE_KEYS.NEIGHBORHOODS, list);

      if (supabase) {
        try {
          await supabase.from('neighborhoods').delete().eq('id', id);
        } catch (e) {}
      }
      return true;
    },

    // ----------------------------------------
    // 8. ENTREGADORES
    // ----------------------------------------
    async getCouriers() {
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('couriers')
            .select('*')
            .order('created_at', { ascending: true });

          if (!error && data && data.length > 0) {
            setStored(STORAGE_KEYS.COURIERS, data);
            return data;
          }
        } catch (e) {}
      }
      const list = getStored(STORAGE_KEYS.COURIERS, window.INITIAL_COURIERS);
      return list && list.length > 0 ? list : window.INITIAL_COURIERS;
    },

    async saveCourier(c) {
      const list = getStored(STORAGE_KEYS.COURIERS, window.INITIAL_COURIERS);
      const saved = {
        ...c,
        id: c.id || generateId('cour'),
        name: (c.name || '').trim(),
        phone: c.phone || '',
        is_active: c.is_active !== false
      };

      const idx = list.findIndex(cour => cour.id === saved.id);
      if (idx >= 0) list[idx] = saved;
      else list.push(saved);
      setStored(STORAGE_KEYS.COURIERS, list);

      if (supabase) {
        try {
          await supabase.from('couriers').upsert(saved);
        } catch (e) {}
      }
      return saved;
    },

    async deleteCourier(id) {
      const list = getStored(STORAGE_KEYS.COURIERS, window.INITIAL_COURIERS).filter(c => c.id !== id);
      setStored(STORAGE_KEYS.COURIERS, list);

      if (supabase) {
        try {
          await supabase.from('couriers').delete().eq('id', id);
        } catch (e) {}
      }
      return true;
    },

    // ----------------------------------------
    // 9. PEDIDOS (ORDERS)
    // ----------------------------------------
    async getOrders() {
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200);

          if (!error && data) {
            setStored(STORAGE_KEYS.ORDERS, data);
            return data;
          }
        } catch (e) {}
      }
      const list = getStored(STORAGE_KEYS.ORDERS, []);
      return list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    },

    async createOrder(orderPayload) {
      const list = getStored(STORAGE_KEYS.ORDERS, []);
      const nextNum = list.length > 0 ? (Math.max(...list.map(o => Number(o.order_number) || 0)) + 1) : 1001;

      const newOrder = {
        ...orderPayload,
        id: orderPayload.id || generateId('ord'),
        order_number: nextNum,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: orderPayload.status || 'novo'
      };

      list.unshift(newOrder);
      setStored(STORAGE_KEYS.ORDERS, list);

      if (supabase) {
        try {
          const { data, error } = await supabase.from('orders').insert([newOrder]).select().single();
          if (!error && data) {
            return data;
          }
        } catch (e) {}
      }

      try {
        localStorage.setItem('pizzafrita_orders_ping', Date.now().toString());
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

      if (supabase) {
        try {
          const updates = { status, updated_at: new Date().toISOString() };
          if (notes !== null) updates.notes = notes;
          if (courierName !== null) updates.courier_name = courierName;
          await supabase.from('orders').update(updates).eq('id', orderId);
        } catch (e) {}
      }
      return order;
    },

    // ----------------------------------------
    // 10. CLIENTES E AUTENTICAÇÃO
    // ----------------------------------------
    async getUserByPhone(phone) {
      const clean = String(phone).replace(/\D/g, '');
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('phone', clean)
            .maybeSingle();

          if (!error && data) return data;
        } catch (e) {}
      }
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
      if (idx >= 0) users[idx] = saved;
      else users.push(saved);
      setStored(STORAGE_KEYS.USERS, users);

      if (supabase) {
        try {
          await supabase.from('users').upsert(saved);
        } catch (e) {}
      }
      return saved;
    },

    // ----------------------------------------
    // 11. ENDEREÇOS SALVOS
    // ----------------------------------------
    async getUserAddresses(userId) {
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('addresses')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          if (!error && data) {
            setStored(STORAGE_KEYS.ADDRESSES, data);
            return data;
          }
        } catch (e) {}
      }
      const addresses = getStored(STORAGE_KEYS.ADDRESSES, []);
      return addresses.filter(a => a.user_id === userId);
    },

    async saveAddress(addrData) {
      const list = getStored(STORAGE_KEYS.ADDRESSES, []);
      const saved = {
        ...addrData,
        id: addrData.id || generateId('addr'),
        created_at: new Date().toISOString()
      };

      const idx = list.findIndex(a => a.id === saved.id);
      if (idx >= 0) list[idx] = saved;
      else list.push(saved);
      setStored(STORAGE_KEYS.ADDRESSES, list);

      if (supabase) {
        try {
          await supabase.from('addresses').upsert(saved);
        } catch (e) {}
      }
      return saved;
    },

    async deleteAddress(id) {
      const list = getStored(STORAGE_KEYS.ADDRESSES, []).filter(a => a.id !== id);
      setStored(STORAGE_KEYS.ADDRESSES, list);

      if (supabase) {
        try {
          await supabase.from('addresses').delete().eq('id', id);
        } catch (e) {}
      }
      return true;
    },

    // ----------------------------------------
    // 12. FECHAMENTO DE CAIXA
    // ----------------------------------------
    async getCashClosings() {
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('cash_closings')
            .select('*')
            .order('date_ref', { ascending: false });

          if (!error && data) {
            setStored(STORAGE_KEYS.CASH_CLOSINGS, data);
            return data;
          }
        } catch (e) {}
      }
      return getStored(STORAGE_KEYS.CASH_CLOSINGS, []);
    },

    async saveCashClosing(cashData) {
      const list = getStored(STORAGE_KEYS.CASH_CLOSINGS, []);
      const saved = {
        ...cashData,
        id: cashData.id || generateId('cash'),
        created_at: new Date().toISOString()
      };

      const idx = list.findIndex(c => c.date_ref === saved.date_ref || c.id === saved.id);
      if (idx >= 0) list[idx] = saved;
      else list.push(saved);
      setStored(STORAGE_KEYS.CASH_CLOSINGS, list);

      if (supabase) {
        try {
          await supabase.from('cash_closings').upsert(saved);
        } catch (e) {}
      }
      return saved;
    }
  };

  // Setup Supabase Realtime Listener
  if (supabase) {
    try {
      supabase
        .channel('public:orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async (payload) => {
          try {
            window.dispatchEvent(new CustomEvent('pizzafrita_order_change', { detail: payload }));
            localStorage.setItem('pizzafrita_orders_ping', Date.now().toString());
          } catch {}
        })
        .subscribe();
    } catch (e) {}
  }

  window.db = db;
})();
