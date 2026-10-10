// ========================================================
// BOYDEGUSTA - APLICAÇÃO PRINCIPAL (VANILLA JAVASCRIPT)
// ========================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Estado local da UI
  let state = {
    settings: null,
    operatingHours: [],
    categories: [],
    products: [],
    optionals: [],
    promotions: [],
    searchQuery: '',
    selectedCategory: null,
    isStoreOpen: true,
    currentUser: null,
    currentModalProduct: null,
    modalQty: 1,
    modalSelectedOptionals: [],
    modalNotes: '',
    modalComboCounts: {},
    modalSelectedFlavor: '',
    modalSelectedSize: null
  };

  // Elementos do DOM
  const dom = {
    // Header & Navegação
    storeStatusBadge: document.getElementById('storeStatusBadge'),
    storeClosedAlert: document.getElementById('storeClosedAlert'),
    categoryNavScroll: document.getElementById('categoryNavScroll'),
    menuSectionsContainer: document.getElementById('menuSectionsContainer'),
    searchInput: document.getElementById('searchInput'),
    btnClearSearch: document.getElementById('btnClearSearch'),
    headerCartBtn: document.getElementById('headerCartBtn'),
    headerCartCount: document.getElementById('headerCartCount'),
    userProfileBtn: document.getElementById('userProfileBtn'),
    mobileCartBar: document.getElementById('mobileCartBar'),
    mobileCartCount: document.getElementById('mobileCartCount'),
    mobileCartTotal: document.getElementById('mobileCartTotal'),
    
    // Modal Produto
    productModal: document.getElementById('productModal'),
    productModalTitle: document.getElementById('productModalTitle'),
    productModalCover: document.getElementById('productModalCover'),
    productModalDesc: document.getElementById('productModalDesc'),
    productModalPrice: document.getElementById('productModalPrice'),
    productModalSizesSection: document.getElementById('productModalSizesSection'),
    productModalSizesList: document.getElementById('productModalSizesList'),
    productModalFlavorSection: document.getElementById('productModalFlavorSection'),
    productModalFlavorLabel: document.getElementById('productModalFlavorLabel'),
    productModalFlavorList: document.getElementById('productModalFlavorList'),
    productModalOptionalsSection: document.getElementById('productModalOptionalsSection'),
    productModalOptionalsList: document.getElementById('productModalOptionalsList'),
    productModalComboSection: document.getElementById('productModalComboSection'),
    productModalComboList: document.getElementById('productModalComboList'),
    productModalComboCountText: document.getElementById('productModalComboCountText'),
    productModalNotes: document.getElementById('productModalNotes'),
    productModalQtyVal: document.getElementById('productModalQtyVal'),
    btnModalQtyMinus: document.getElementById('btnModalQtyMinus'),
    btnModalQtyPlus: document.getElementById('btnModalQtyPlus'),
    btnModalAddToCart: document.getElementById('btnModalAddToCart'),
    btnModalClose: document.getElementById('btnModalClose'),

    // Cart Drawer
    cartDrawer: document.getElementById('cartDrawer'),
    cartDrawerClose: document.getElementById('cartDrawerClose'),
    cartDrawerItems: document.getElementById('cartDrawerItems'),
    cartSubtotalVal: document.getElementById('cartSubtotalVal'),
    cartDeliveryFeeVal: document.getElementById('cartDeliveryFeeVal'),
    cartTotalVal: document.getElementById('cartTotalVal'),
    cartMinOrderWarning: document.getElementById('cartMinOrderWarning'),
    btnGoCheckout: document.getElementById('btnGoCheckout'),

    // Checkout Modal
    checkoutModal: document.getElementById('checkoutModal'),
    checkoutModalClose: document.getElementById('checkoutModalClose'),
    tabDelivery: document.getElementById('tabDelivery'),
    tabPickup: document.getElementById('tabPickup'),
    deliveryAddressFields: document.getElementById('deliveryAddressFields'),
    pickupAddressNotice: document.getElementById('pickupAddressNotice'),
    savedAddressesSelect: document.getElementById('savedAddressesSelect'),
    inputCustName: document.getElementById('inputCustName'),
    inputCustPhone: document.getElementById('inputCustPhone'),
    inputStreet: document.getElementById('inputStreet'),
    inputNumber: document.getElementById('inputNumber'),
    inputComplement: document.getElementById('inputComplement'),
    inputNeighborhood: document.getElementById('inputNeighborhood'),
    inputReference: document.getElementById('inputReference'),
    paymentMethodCards: document.querySelectorAll('.payment-method-card'),
    cashChangeSection: document.getElementById('cashChangeSection'),
    inputChangeFor: document.getElementById('inputChangeFor'),
    inputOrderGeneralNotes: document.getElementById('inputOrderGeneralNotes'),
    checkoutSubtotalVal: document.getElementById('checkoutSubtotalVal'),
    checkoutFeeVal: document.getElementById('checkoutFeeVal'),
    checkoutTotalVal: document.getElementById('checkoutTotalVal'),
    btnConfirmOrder: document.getElementById('btnConfirmOrder'),

    // Success Modal
    successModal: document.getElementById('successModal'),
    successOrderNum: document.getElementById('successOrderNum'),
    successSummaryText: document.getElementById('successSummaryText'),
    btnOpenWhatsAppDirect: document.getElementById('btnOpenWhatsAppDirect'),
    btnSuccessClose: document.getElementById('btnSuccessClose'),

    // Auth & Portal Modal
    authModal: document.getElementById('authModal'),
    authModalClose: document.getElementById('authModalClose'),
    authModalTitle: document.getElementById('authModalTitle'),
    authLoginForm: document.getElementById('authLoginForm'),
    authRegisterForm: document.getElementById('authRegisterForm'),
    customerPortal: document.getElementById('customerPortal'),
    portalUserName: document.getElementById('portalUserName'),
    portalUserPhone: document.getElementById('portalUserPhone'),
    portalAddressList: document.getElementById('portalAddressList'),
    portalOrdersList: document.getElementById('portalOrdersList'),
    btnNewAddress: document.getElementById('btnNewAddress'),
    newAddressForm: document.getElementById('newAddressForm'),
    btnSaveNewAddress: document.getElementById('btnSaveNewAddress'),
    btnCancelNewAddress: document.getElementById('btnCancelNewAddress'),
    btnLogoutCustomer: document.getElementById('btnLogoutCustomer'),
    btnToggleToRegister: document.getElementById('btnToggleToRegister'),
    btnToggleToLogin: document.getElementById('btnToggleToLogin')
  };

  let selectedPaymentMethod = 'dinheiro';

  // ==========================================
  // INICIALIZAÇÃO E CARREGAMENTO DE DADOS
  // ==========================================
  async function init() {
    try {
      const bootstrap = await window.db.getBootstrap();

      state.settings = bootstrap.settings || window.INITIAL_SETTINGS;
      state.operatingHours = bootstrap.hours || window.INITIAL_OPERATING_HOURS;
      state.categories = (bootstrap.categories || []).filter(c => c.is_active !== false).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      state.products = (bootstrap.products || []).filter(p => p.is_active !== false);
      state.optionals = (bootstrap.optionals || []).filter(o => o.is_active !== false);
      state.promotions = (bootstrap.promotions || []).filter(p => p.is_active !== false);
      state.neighborhoods = bootstrap.neighborhoods || [];
      state.currentUser = window.auth.getCurrentUser();

      checkStoreStatus();
      renderCategoryNav();
      renderMenu();
      updateCartUI();
      setupEventListeners();
      setupPhoneMasks();

      // Intervalo de verificação da loja a cada 1 minuto
      setInterval(checkStoreStatus, 60000);
    } catch (err) {
      console.error('Erro ao inicializar aplicativo:', err);
    }
  }

  // ==========================================
  // STATUS DA LOJA (17:00 - 22:00 & MODO MANUAL)
  // ==========================================
  function checkStoreStatus() {
    if (!state.settings) return;

    if (state.settings.store_status_mode === 'force_open') {
      state.isStoreOpen = true;
    } else if (state.settings.store_status_mode === 'force_closed') {
      state.isStoreOpen = false;
    } else {
      // Modo Automático (Quarta a Domingo, 17:00 às 22:00)
      const now = new Date();
      const currentDay = now.getDay();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const dayConfig = state.operatingHours.find(h => h.day_of_week === currentDay);
      if (!dayConfig || !dayConfig.is_open) {
        state.isStoreOpen = false;
      } else {
        const [openH, openM] = (dayConfig.open_time || '17:00').split(':').map(Number);
        const [closeH, closeM] = (dayConfig.close_time || '22:00').split(':').map(Number);
        const openMin = openH * 60 + (openM || 0);
        const closeMin = closeH * 60 + (closeM || 0);
        state.isStoreOpen = currentMinutes >= openMin && currentMinutes <= closeMin;
      }
    }

    if (dom.storeStatusBadge) {
      dom.storeStatusBadge.className = `store-status-pill ${state.isStoreOpen ? 'status-open' : 'status-closed'}`;
      dom.storeStatusBadge.innerHTML = `
        <span class="status-indicator-dot"></span>
        ${state.isStoreOpen ? '<i class="fi fi-sr-circle" style="color: #22c55e; font-size: 0.75em;"></i> Aberto' : '<i class="fi fi-sr-circle" style="color: #ef4444; font-size: 0.75em;"></i> Fechado'}
      `;
    }

    if (dom.welcomeStatusIndicator) {
      dom.welcomeStatusIndicator.className = `welcome-status-text ${state.isStoreOpen ? 'is-open' : 'is-closed'}`;
      const now = new Date();
      const currentDay = now.getDay();
      const dayConfig = (state.operatingHours || []).find(h => h.day_of_week === currentDay);
      const isDayClosed = dayConfig ? !dayConfig.is_open : (currentDay === 1 || currentDay === 2);
      let statusText = '';
      if (state.isStoreOpen) {
        statusText = '<i class="fi fi-sr-circle" style="color: #22c55e; font-size: 0.75em;"></i> Aberto agora • Fecha às 22:00';
      } else if (isDayClosed) {
        statusText = '<i class="fi fi-sr-circle" style="color: #ef4444; font-size: 0.75em;"></i> Fechado hoje (Seg/Ter) • Abre Quarta às 17:00';
      } else {
        statusText = '<i class="fi fi-sr-circle" style="color: #ef4444; font-size: 0.75em;"></i> Fechado • Abre hoje, às 17:00';
      }
      dom.welcomeStatusIndicator.innerHTML = `
        <span class="status-indicator-dot"></span>
        <span>${statusText}</span>
      `;
    }

    const escape = window.escapeHtml || (s => s);
    if (dom.storeClosedAlert) {
      if (!state.isStoreOpen) {
        dom.storeClosedAlert.style.display = 'flex';
        dom.storeClosedAlert.innerHTML = `
          <div class="store-alert-icon"><i class="fi fi-sr-clock"></i></div>
          <div class="store-alert-text">
            <strong>Estamos fechados no momento.</strong>
            ${escape(state.settings?.closed_message || 'Nosso horário de funcionamento é de Quarta a Domingo, das 17:00 às 22:00 (Segunda e Terça fechado).')}
          </div>
        `;
      } else {
        dom.storeClosedAlert.style.display = 'none';
      }
    }
  }

  // ==========================================
  // ==========================================
  // HELPERS DE CATEGORIAS E PRODUTOS
  // ==========================================
  function isCategoryHiddenFromMainMenu(cat) {
    if (!cat) return false;
    const id = (cat.id || '').toLowerCase();
    const slug = (cat.slug || '').toLowerCase();
    const name = (cat.name || '').toLowerCase();

    // Apenas a categoria pura de Adicionais (ingredientes extras) não aparece como seção solta no cardápio
    if (id === 'cat-adic' || id === 'c1ef7a89-7486-49d4-ad22-475e4a623754') return true;
    if (slug === 'adicional' || slug === 'adicionais') return true;
    if (name === 'adicional' || name === 'adicionais') return true;
    return false;
  }

  function isProductInCategory(prod, cat) {
    if (!prod || !cat) return false;
    if (prod.category_id === cat.id) return true;
    if (prod.category_id && cat.slug && prod.category_id.toLowerCase() === cat.slug.toLowerCase()) return true;
    
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
    if (LEGACY_MAP[prod.category_id] && (LEGACY_MAP[prod.category_id] === cat.slug || LEGACY_MAP[prod.category_id] === cat.id)) return true;
    if (LEGACY_MAP[cat.id] && (LEGACY_MAP[cat.id] === prod.category_id)) return true;
    return false;
  }

  function isProductNaBrasa(product) {
    if (!product) return false;
    const catId = (product.category_id || '').toLowerCase();
    const cat = (state.categories || []).find(c => c.id === product.category_id);
    const catSlug = cat ? (cat.slug || '').toLowerCase() : '';
    const catName = cat ? (cat.name || '').toLowerCase() : '';
    const prodName = (product.name || '').toLowerCase();
    const prodDesc = (product.description || '').toLowerCase();

    const norm = str => (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const normCatSlug = norm(catSlug);
    const normCatName = norm(catName);
    const normProdName = norm(prodName);
    const normProdDesc = norm(prodDesc);

    return catId === 'cat-brasa' ||
           normCatSlug.includes('brasa') ||
           normCatName.includes('brasa') ||
           normProdName.includes('brasa') ||
           normProdDesc.includes('na brasa') ||
           normProdDesc.includes('burguer na brasa') ||
           normProdDesc.includes('burger na brasa');
  }

  function isProductNaChapa(product) {
    if (!product) return false;
    if (isProductNaBrasa(product)) return false;
    const catId = (product.category_id || '').toLowerCase();
    const cat = (state.categories || []).find(c => c.id === product.category_id);
    const catSlug = cat ? (cat.slug || '').toLowerCase() : '';
    const catName = cat ? (cat.name || '').toLowerCase() : '';
    const prodName = (product.name || '').toLowerCase();
    const prodDesc = (product.description || '').toLowerCase();

    const norm = str => (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const normCatSlug = norm(catSlug);
    const normCatName = norm(catName);
    const normProdName = norm(prodName);
    const normProdDesc = norm(prodDesc);

    // Excluir explicitamente categorias que não são hambúrguer
    if (catId === 'cat-bebidas' || normCatSlug.includes('bebida') || normCatName.includes('bebida') || normCatSlug.includes('suco') || normCatName.includes('suco')) return false;
    if (catId === 'cat-acomp' || normCatSlug.includes('acomp') || normCatName.includes('acompanha')) return false;
    if (catId === 'cat-pao' || normCatSlug.includes('pao') || normCatName.includes('pao') || normProdName.startsWith('pao')) return false;
    if (catId === 'cat-beirute' || normCatSlug.includes('beirute') || normCatName.includes('beirute') || normProdName.includes('beirute')) return false;
    if (catId === 'cat-batata' || normCatSlug.includes('batata') || normCatName.includes('batata') || normProdName.includes('batata') || normProdName.includes('fritas')) return false;
    if (catId === 'cat-adic' || normCatSlug.includes('adic') || normCatName.includes('adicional')) return false;

    return catId === 'cat-burguer' ||
           catId === 'cat-burger' ||
           catId === 'cat-hamburguer' ||
           normCatSlug.includes('burguer') ||
           normCatSlug.includes('burger') ||
           normCatSlug.includes('hamburguer') ||
           normCatSlug.includes('hamburger') ||
           normCatSlug.includes('chapa') ||
           normCatSlug.includes('smash') ||
           normCatSlug.includes('sanduiche') ||
           normCatSlug.includes('lanche') ||
           normCatName.includes('burguer') ||
           normCatName.includes('burger') ||
           normCatName.includes('hamburguer') ||
           normCatName.includes('hamburger') ||
           normCatName.includes('chapa') ||
           normCatName.includes('smash') ||
           normCatName.includes('sanduiche') ||
           normCatName.includes('lanche') ||
           normProdName.includes('burguer') ||
           normProdName.includes('burger') ||
           normProdName.includes('hamburguer') ||
           normProdName.includes('hamburger') ||
           normProdName.includes('smash') ||
           normProdName.includes('cheddar') ||
           normProdName.includes('bacon') ||
           normProdName.startsWith('x-') ||
           normProdName.startsWith('x ') ||
           normProdName.includes(' x-') ||
           normProdName.includes(' x ') ||
           normProdDesc.includes('pao brioche') ||
           normProdDesc.includes('pao australiano') ||
           normProdDesc.includes('pao bola') ||
           normProdDesc.includes('burguer') ||
           normProdDesc.includes('burger') ||
           normProdDesc.includes('hamburguer') ||
           normProdDesc.includes('blend');
  }

  function isBurgerProduct(product) {
    if (!product) return false;
    if (product.burger_type === 'none') return false;
    if (product.burger_type === 'both' || product.burger_type === 'tradicional' || product.burger_type === 'duplo') return true;
    const prodNameLower = (product.name || '').toLowerCase().trim();
    if (product.is_promo && (prodNameLower.includes('combo') || prodNameLower.includes('2 beirute') || prodNameLower.includes('promocao') || prodNameLower.includes('promoção'))) {
      return false;
    }
    return isProductNaBrasa(product) || isProductNaChapa(product);
  }

  function getFilteredOptionalsForProduct(product) {
    if (!product) return [];
    const productCategoryId = String(product.category_id || '').trim();

    return (state.optionals || []).filter(opt => {
      if (opt.is_active === false) return false;

      const target = String(opt.target || 'all').toLowerCase().trim();
      const applicableCats = Array.isArray(opt.applicable_category_ids)
        ? opt.applicable_category_ids.map(String)
        : [];

      // 1. Se configurado para categorias específicas
      if (target === 'custom' || applicableCats.length > 0) {
        if (applicableCats.length > 0) {
          return applicableCats.includes(productCategoryId);
        }
      }

      // 2. Se configurado para todas as categorias
      return true;
    });
  }

  function getProductEffectivePrice(product) {
    if (!product) return 0;
    if (window.getProductEffectivePrice) {
      return window.getProductEffectivePrice(product);
    }
    const todayDay = new Date().getDay();
    const regularPrice = (product.price !== null && product.price !== undefined && product.price !== '') ? Number(product.price) : 0;
    const promoDays = window.normalizePromoDays ? window.normalizePromoDays(product.promo_days, product.monday_price) : (Array.isArray(product.promo_days) ? product.promo_days.map(Number) : (product.monday_price ? [1] : []));
    const promoPrice = Number(product.promo_price) || Number(product.monday_price) || 0;

    if (promoPrice > 0 && promoDays.length > 0 && (product.is_promo !== false)) {
      if (promoDays.includes(todayDay)) return promoPrice;
      return regularPrice > 0 ? regularPrice : promoPrice;
    }
    return regularPrice;
  }

  function getPromoEffectivePrice(promo) {
    if (!promo) return 0;
    return getProductEffectivePrice(promo);
  }

  // ==========================================
  // RENDERIZAÇÃO DAS CATEGORIAS & CARDÁPIO
  // ==========================================
  function renderCategoryNav() {
    if (!dom.categoryNavScroll) return;

    let html = `
      <button class="category-pill-btn active" data-cat="all">
        <i class="fi fi-sr-hamburger"></i> Todos os Itens
      </button>
    `;

    state.categories.forEach(cat => {
      if (isCategoryHiddenFromMainMenu(cat)) return;
      html += `
        <button class="category-pill-btn" data-cat="${cat.id}">
          ${cat.name}
        </button>
      `;
    });

    dom.categoryNavScroll.innerHTML = html;

    dom.categoryNavScroll.querySelectorAll('.category-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        dom.categoryNavScroll.querySelectorAll('.category-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Centraliza a categoria clicada na barra horizontal
        btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });

        const catId = btn.getAttribute('data-cat');
        if (catId === 'all') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          const sectionEl = document.getElementById(`section-${catId}`);
          if (sectionEl) {
            sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    });

    // Suporte para rolagem horizontal com mouse drag e rodinha (wheel)
    setupCategoryHorizontalDrag();
  }

  function setupCategoryHorizontalDrag() {
    const slider = dom.categoryNavScroll;
    if (!slider || slider.dataset.dragInitialized) return;
    slider.dataset.dragInitialized = 'true';

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let hasMoved = false;

    slider.addEventListener('mousedown', (e) => {
      isDown = true;
      hasMoved = false;
      slider.classList.add('is-dragging');
      startX = e.pageX - slider.offsetLeft;
      scrollLeft = slider.scrollLeft;
    });

    slider.addEventListener('mouseleave', () => {
      isDown = false;
      slider.classList.remove('is-dragging');
    });

    slider.addEventListener('mouseup', () => {
      isDown = false;
      slider.classList.remove('is-dragging');
    });

    slider.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - slider.offsetLeft;
      const walk = (x - startX) * 1.5;
      if (Math.abs(walk) > 3) hasMoved = true;
      slider.scrollLeft = scrollLeft - walk;
    });

    // Converte scroll vertical da rodinha em scroll horizontal na barra
    slider.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        slider.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }

  function isProductAvailableForCurrentChannel(prod) {
    const channel = prod.sales_channel || 'todos';
    if (channel === 'todos') return true;
    const currentDeliveryType = (window.cart && window.cart.deliveryType) ? window.cart.deliveryType : 'delivery';
    if (currentDeliveryType === 'delivery') {
      return channel === 'delivery' || channel === 'todos';
    }
    if (currentDeliveryType === 'pickup') {
      return channel === 'local_balcao' || channel === 'todos';
    }
    return true;
  }

  function renderMenu() {
    if (!dom.menuSectionsContainer) return;

    const query = state.searchQuery.toLowerCase().trim();
    const todayDay = new Date().getDay();
    const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const DAY_NAMES_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    let html = '';
    let totalMatchingProducts = 0;

    state.categories.forEach(cat => {
      if (isCategoryHiddenFromMainMenu(cat)) return;

      let categoryProducts = state.products.filter(p => isProductInCategory(p, cat) && isProductAvailableForCurrentChannel(p));

      // Filtro de busca por nome, descrição ou categoria
      if (query) {
        categoryProducts = categoryProducts.filter(p => {
          const nameMatch = (p.name || '').toLowerCase().includes(query);
          const descMatch = (p.description || '').toLowerCase().includes(query);
          const catMatch = (cat.name || '').toLowerCase().includes(query);
          return nameMatch || descMatch || catMatch;
        });
      }

      if (categoryProducts.length > 0) {
        totalMatchingProducts += categoryProducts.length;
        html += `
          <section class="category-group-section" id="section-${cat.id}">
            <div class="category-section-header">
              <h2 class="category-section-title">${cat.name}</h2>
              <span class="category-items-count">${categoryProducts.length} ${categoryProducts.length === 1 ? 'item' : 'itens'}</span>
            </div>
            <div class="products-grid-layout">
        `;

        categoryProducts.forEach(prod => {
          const isUnavailable = prod.is_available === false;
          const promoDays = window.normalizePromoDays ? window.normalizePromoDays(prod.promo_days, prod.monday_price) : (Array.isArray(prod.promo_days) ? prod.promo_days.map(Number) : (prod.monday_price ? [1] : []));
          const promoPrice = Number(prod.promo_price) || Number(prod.monday_price) || 0;
          const isPromoActive = prod.is_promo !== false;
          const hasDayPromo = isPromoActive && promoPrice > 0 && promoDays.length > 0;
          const isPromoToday = hasDayPromo && promoDays.includes(todayDay);

          const regularPrice = Number(prod.price) || 0;
          const effectivePrice = getProductEffectivePrice(prod);

          let priceDisplayHtml = '';
          let promoBadgeHtml = '';

          const hasPizzaSizes = Boolean(prod.has_sizes === true || prod.has_sizes === 'true');
          const priceP = prod.price_p || prod.price || 0;
          const priceM = prod.price_m || 0;
          const priceG = prod.price_g || 0;

          if (hasPizzaSizes && (priceP > 0 || priceM > 0 || priceG > 0)) {
            // Pizza com tamanhos: verifica se há promoção ativa hoje
            const promoPriceP = prod.promo_price_p || prod.sizes?.find(s => s.size_key === 'P')?.promo_price || 0;
            const promoPriceM = prod.promo_price_m || prod.sizes?.find(s => s.size_key === 'M')?.promo_price || 0;
            const promoPriceG = prod.promo_price_g || prod.sizes?.find(s => s.size_key === 'G')?.promo_price || 0;
            const hasPromoSizes = isPromoActive && (promoPriceP > 0 || promoPriceM > 0 || promoPriceG > 0);

            if (isPromoToday && hasPromoSizes) {
              // Mostra preços promoGionais P/M/G
              const buildSizePromo = (lbl, regular, promo) => promo > 0 ? `
                <span style="font-size:0.7rem;line-height:1.2;display:flex;align-items:center;gap:3px;">
                  <b style="color:var(--primary-yellow)">${lbl}</b>
                  <s style="color:var(--text-muted);font-size:0.65rem">${window.formatCurrency(regular)}</s>
                  <span style="color:#22c55e;font-weight:800">${window.formatCurrency(promo)}</span>
                </span>` : '';
              priceDisplayHtml = `<div style="display:flex;flex-direction:column;gap:2px">
                ${buildSizePromo('P', priceP, promoPriceP)}
                ${buildSizePromo('M', priceM, promoPriceM)}
                ${buildSizePromo('G', priceG, promoPriceG)}
              </div>`;
              const dayLabel = DAY_NAMES_FULL[todayDay].toUpperCase();
              promoBadgeHtml = `<span class="badge-tag-promo" style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);">🔥 PROMO HOJE (${dayLabel})</span>`;
            } else if (hasDayPromo && hasPromoSizes) {
              // Mostra badge com dias e preço menor da promo
              const minPromo = Math.min(...[promoPriceP, promoPriceM, promoPriceG].filter(v => v > 0));
              priceDisplayHtml = `<div style="display:flex;flex-direction:column;gap:1px">
                ${priceP > 0 ? `<span style="font-size:0.7rem"><b style="color:var(--primary-yellow)">P</b> ${window.formatCurrency(priceP)}</span>` : ''}
                ${priceM > 0 ? `<span style="font-size:0.7rem"><b style="color:var(--primary-yellow)">M</b> ${window.formatCurrency(priceM)}</span>` : ''}
                ${priceG > 0 ? `<span style="font-size:0.7rem"><b style="color:var(--primary-yellow)">G</b> ${window.formatCurrency(priceG)}</span>` : ''}
              </div>`;
              const daysText = promoDays.map(d => DAY_NAMES[d] || d).join(', ');
              promoBadgeHtml = `<span class="badge-tag-promo" style="background: linear-gradient(135deg, #d97706 0%, #b45309 100%);">📅 A partir de ${window.formatCurrency(minPromo)} na ${daysText}</span>`;
            } else {
              // Mostra P/M/G sem promo
              priceDisplayHtml = `<div style="display:flex;flex-direction:column;gap:1px">
                ${priceP > 0 ? `<span style="font-size:0.72rem;line-height:1.3"><b style="color:var(--primary-yellow)">P</b> <span class="food-card-price-val" style="font-size:0.85rem">${window.formatCurrency(priceP)}</span></span>` : ''}
                ${priceM > 0 ? `<span style="font-size:0.72rem;line-height:1.3"><b style="color:var(--primary-yellow)">M</b> <span class="food-card-price-val" style="font-size:0.85rem">${window.formatCurrency(priceM)}</span></span>` : ''}
                ${priceG > 0 ? `<span style="font-size:0.72rem;line-height:1.3"><b style="color:var(--primary-yellow)">G</b> <span class="food-card-price-val" style="font-size:0.85rem">${window.formatCurrency(priceG)}</span></span>` : ''}
              </div>`;
            }
          } else if (isPromoToday) {
            priceDisplayHtml = `
              <div style="display: flex; flex-direction: column;">
                ${regularPrice > 0 && regularPrice !== effectivePrice ? `<s style="font-size: 0.75rem; color: var(--text-muted); line-height: 1;">${window.formatCurrency(regularPrice)}</s>` : ''}
                <span class="food-card-price-val" style="color: #22c55e; font-weight: 900;">${window.formatCurrency(effectivePrice)}</span>
              </div>
            `;
            const dayLabel = DAY_NAMES_FULL[todayDay].toUpperCase();
            promoBadgeHtml = `<span class="badge-tag-promo" style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);">🔥 PROMO HOJE (${dayLabel})</span>`;
          } else if (hasDayPromo) {
            priceDisplayHtml = `<span class="food-card-price-val">${window.formatCurrency(regularPrice || effectivePrice)}</span>`;
            const daysText = promoDays.map(d => DAY_NAMES[d] || d).join(', ');
            promoBadgeHtml = `<span class="badge-tag-promo" style="background: linear-gradient(135deg, #d97706 0%, #b45309 100%);">📅 ${window.formatCurrency(promoPrice)} na ${daysText}</span>`;
          } else if (hasPizzaSizes && priceM > 0) {
            priceDisplayHtml = `<span class="food-card-price-val">${window.formatCurrency(priceP)}</span>`;
          } else {
            const formattedPrice = prod.price !== null && prod.price !== undefined
              ? window.formatCurrency(effectivePrice)
              : 'Preço a definir';
            priceDisplayHtml = `<span class="food-card-price-val ${prod.price === null ? 'unpriced-notice' : ''}">${formattedPrice}</span>`;
            if (prod.is_promo) {
              promoBadgeHtml = '<span class="badge-tag-promo">PROMO</span>';
            }
          }

          const optimizedImgUrl = window.optimizeImageUrl ? window.optimizeImageUrl(prod.image_url, { width: 450, quality: 75 }) : (prod.image_url || 'logo.jpg');
          html += `
            <div class="food-card ${isUnavailable ? 'card-unavailable' : ''}" data-product-id="${prod.id}">
              <div class="food-card-img-box">
                <img class="food-card-img" src="${optimizedImgUrl}" alt="${prod.name}" loading="lazy" />
                ${promoBadgeHtml}
              </div>
              <div class="food-card-content">
                <div>
                  <h3 class="food-card-name">${prod.name}</h3>
                  <p class="food-card-description">${prod.description || ''}</p>
                </div>
                <div class="food-card-bottom">
                  ${priceDisplayHtml}
                  <button class="btn-card-add" ${isUnavailable ? 'disabled' : ''}>
                    ${isUnavailable ? 'Esgotado' : '+ Adicionar'}
                  </button>
                </div>
              </div>
            </div>
          `;
        });

        html += `
            </div>
          </section>
        `;
      }
    });

    if (totalMatchingProducts === 0) {
      html = `
        <div style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
          <div style="font-size: 3rem; margin-bottom: 12px;"><i class="fi fi-rr-search"></i></div>
          <h3 style="color: #fff; margin-bottom: 8px;">Nenhuma pizza encontrada</h3>
          <p>Tente buscar por outro termo ou navegue pelas categorias acima.</p>
        </div>
      `;
    }

    dom.menuSectionsContainer.innerHTML = html;

    // Vincula clique nos cards de produto
    dom.menuSectionsContainer.querySelectorAll('.food-card').forEach(card => {
      card.addEventListener('click', () => {
        const prodId = card.getAttribute('data-product-id');
        const product = state.products.find(p => p.id === prodId);
        if (product && product.is_available !== false) {
          openProductModal(product);
        }
      });
    });
  }

  // ==========================================
  // MODAL DE PRODUTO & TAMANHOS (PIZZA FRITA)
  // ==========================================
  function renderPizzaSizes(product) {
    if (!dom.productModalSizesList || !dom.productModalSizesSection) return;

    const hasSizes = Boolean(product.has_sizes === true || product.has_sizes === 'true');
    
    if (!hasSizes) {
      dom.productModalSizesSection.style.display = 'none';
      state.modalSelectedSize = null;
      return;
    }

    let sizes = product.sizes;
    if (!sizes || sizes.length === 0) {
      sizes = [
        { size_key: 'P', name: 'P (Pequena)', price: Number(product.price_p || product.price || 25) },
        { size_key: 'M', name: 'M (Média)', price: Number(product.price_m || 35) },
        { size_key: 'G', name: 'G (Grande)', price: Number(product.price_g || 45) }
      ];
    }

    dom.productModalSizesSection.style.display = 'block';

    // Default to M if available, else first
    const defaultSize = sizes.find(s => s.size_key === 'M') || sizes[0];
    state.modalSelectedSize = defaultSize;

    let html = '';
    sizes.forEach(s => {
      const isSelected = state.modalSelectedSize && state.modalSelectedSize.size_key === s.size_key;
      html += `
        <div class="pizza-size-pill ${isSelected ? 'active' : ''}" data-size-key="${s.size_key}" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px 8px; border-radius: 12px; background: ${isSelected ? 'rgba(217, 119, 6, 0.2)' : 'rgba(255,255,255,0.04)'}; border: 2px solid ${isSelected ? 'var(--primary-yellow)' : 'rgba(255,255,255,0.15)'}; cursor: pointer; transition: all 0.2s;">
          <div style="font-weight: 900; font-size: 1.15rem; color: #fff;">${s.size_key}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted); margin: 2px 0;">${s.name.includes('Pequena') ? 'Pequena' : s.name.includes('Média') ? 'Média' : s.name.includes('Grande') ? 'Grande' : s.name}</div>
          <div style="font-weight: 800; font-size: 0.88rem; color: var(--primary-yellow); margin-top: 4px;">${window.formatCurrency(s.price)}</div>
        </div>
      `;
    });

    dom.productModalSizesList.innerHTML = html;

    dom.productModalSizesList.querySelectorAll('.pizza-size-pill').forEach(card => {
      card.addEventListener('click', () => {
        const skey = card.getAttribute('data-size-key');
        const found = sizes.find(s => s.size_key === skey);
        if (found) {
          state.modalSelectedSize = found;
          dom.productModalSizesList.querySelectorAll('.pizza-size-pill').forEach(c => {
            c.classList.remove('active');
            c.style.borderColor = 'rgba(255,255,255,0.15)';
            c.style.background = 'rgba(255,255,255,0.04)';
          });
          card.classList.add('active');
          card.style.borderColor = 'var(--primary-yellow)';
          card.style.background = 'rgba(217, 119, 6, 0.2)';
          updateModalDynamicPrice();
        }
      });
    });
  }

  function openProductModal(product) {
    state.currentModalProduct = product;
    state.modalQty = 1;
    state.modalSelectedOptionals = [];
    state.modalNotes = '';
    state.modalComboCounts = {};
    state.modalSelectedFlavor = '';
    state.modalSelectedSize = null;

    dom.productModalTitle.textContent = product.name;
    const modalImgUrl = window.optimizeImageUrl ? window.optimizeImageUrl(product.image_url, { width: 700, quality: 80 }) : (product.image_url || 'logo.jpg');
    dom.productModalCover.src = modalImgUrl;
    dom.productModalCover.alt = product.name;
    dom.productModalDesc.textContent = product.description || '';
    dom.productModalQtyVal.textContent = '1';
    dom.productModalNotes.value = '';

    // Renderiza tamanhos (P, M, G)
    renderPizzaSizes(product);

    // Adicionais filtrados por categoria
    const filteredOptionals = getFilteredOptionalsForProduct(product);
    if (filteredOptionals.length > 0 && dom.productModalOptionalsSection) {
      dom.productModalOptionalsSection.style.display = 'block';
      renderOptionalsList(product);
    } else if (dom.productModalOptionalsSection) {
      dom.productModalOptionalsSection.style.display = 'none';
      state.modalSelectedOptionals = [];
    }

    updateModalDynamicPrice();
    dom.productModal.style.display = 'flex';
  }

  function renderFlavorsList(allowedItems, label = 'Escolha o Sabor') {
    if (!dom.productModalFlavorList) return;
    if (dom.productModalFlavorLabel) {
      dom.productModalFlavorLabel.textContent = label;
    }
    const escape = window.escapeHtml || (s => s);
    let html = '';
    state.modalSelectedFlavor = allowedItems[0] || '';

    allowedItems.forEach((flv, idx) => {
      const isSelected = idx === 0;
      html += `
        <div class="optional-row ${isSelected ? 'selected' : ''}" data-flavor="${escape(flv)}" style="cursor: pointer;">
          <div class="optional-left">
            <div class="fake-checkbox" style="border-radius: 50%;">✓</div>
            <span class="optional-title-text">${escape(flv)}</span>
          </div>
          <span class="optional-price-tag" style="color: #22c55e;">Opção</span>
        </div>
      `;
    });

    dom.productModalFlavorList.innerHTML = html;

    dom.productModalFlavorList.querySelectorAll('.optional-row').forEach(row => {
      row.addEventListener('click', () => {
        const flv = row.getAttribute('data-flavor');
        state.modalSelectedFlavor = flv;
        dom.productModalFlavorList.querySelectorAll('.optional-row').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
      });
    });
  }

  function renderOptionalsList(product) {
    if (!dom.productModalOptionalsList) return;

    const currentProduct = product || state.currentModalProduct;
    const filteredOptionals = getFilteredOptionalsForProduct(currentProduct);

    if (filteredOptionals.length === 0) {
      dom.productModalOptionalsSection.style.display = 'none';
      return;
    }

    let html = '';
    filteredOptionals.forEach(opt => {
      const isSelected = state.modalSelectedOptionals.some(o => o.id === opt.id);
      html += `
        <div class="optional-row ${isSelected ? 'selected' : ''}" data-opt-id="${opt.id}">
          <div class="optional-left">
            <div class="fake-checkbox">✓</div>
            <span class="optional-title-text">${opt.name}</span>
          </div>
          <span class="optional-price-tag">+ ${window.formatCurrency(opt.price)}</span>
        </div>
      `;
    });

    dom.productModalOptionalsList.innerHTML = html;

    dom.productModalOptionalsList.querySelectorAll('.optional-row').forEach(row => {
      row.addEventListener('click', () => {
        const optId = row.getAttribute('data-opt-id');
        const opt = state.optionals.find(o => o.id === optId);
        if (!opt) return;

        const isSelected = state.modalSelectedOptionals.some(o => o.id === optId);
        if (isSelected) {
          state.modalSelectedOptionals = state.modalSelectedOptionals.filter(o => o.id !== optId);
          row.classList.remove('selected');
        } else {
          state.modalSelectedOptionals.push(opt);
          row.classList.add('selected');
        }
        updateModalDynamicPrice();
      });
    });
  }

  function renderComboSelectors(allowedItems, requiredQty) {
    if (!dom.productModalComboList) return;

    let html = '';
    allowedItems.forEach(item => {
      const count = state.modalComboCounts[item] || 0;
      html += `
        <div class="combo-option-card">
          <span class="optional-title-text">${item}</span>
          <div class="combo-stepper-control">
            <button class="btn-stepper btn-combo-minus" data-item="${item}" ${count === 0 ? 'disabled' : ''}>-</button>
            <span class="stepper-count-display">${count}</span>
            <button class="btn-stepper btn-combo-plus" data-item="${item}">+</button>
          </div>
        </div>
      `;
    });

    dom.productModalComboList.innerHTML = html;

    // Atualiza cabeçalho do combo
    const currentSum = Object.values(state.modalComboCounts).reduce((a, b) => a + b, 0);
    dom.productModalComboCountText.textContent = `${currentSum} de ${requiredQty} escolhidos`;

    if (currentSum === requiredQty) {
      const effectivePrice = state.currentModalProduct ? getProductEffectivePrice(state.currentModalProduct) : 40.00;
      dom.btnModalAddToCart.disabled = false;
      dom.btnModalAddToCart.textContent = `Adicionar Combo — ${window.formatCurrency(effectivePrice)}`;
    } else {
      dom.btnModalAddToCart.disabled = true;
      dom.btnModalAddToCart.textContent = `Escolha mais ${requiredQty - currentSum} item(ns)`;
    }

    // Ações dos botões do combo
    dom.productModalComboList.querySelectorAll('.btn-combo-plus').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const itemName = btn.getAttribute('data-item');
        const sum = Object.values(state.modalComboCounts).reduce((a, b) => a + b, 0);
        if (sum < requiredQty) {
          state.modalComboCounts[itemName] = (state.modalComboCounts[itemName] || 0) + 1;
          renderComboSelectors(allowedItems, requiredQty);
        }
      });
    });

    dom.productModalComboList.querySelectorAll('.btn-combo-minus').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const itemName = btn.getAttribute('data-item');
        if ((state.modalComboCounts[itemName] || 0) > 0) {
          state.modalComboCounts[itemName] -= 1;
          renderComboSelectors(allowedItems, requiredQty);
        }
      });
    });
  }

  function updateModalDynamicPrice() {
    if (!state.currentModalProduct) return;
    let basePrice = getProductEffectivePrice(state.currentModalProduct);
    if (state.modalSelectedSize && state.modalSelectedSize.price) {
      basePrice = Number(state.modalSelectedSize.price);
    }
    const optsPrice = (state.modalSelectedOptionals || []).reduce((sum, opt) => sum + (Number(opt.price) || 0), 0);
    const unitTotal = basePrice + optsPrice;
    const finalTotal = unitTotal * state.modalQty;

    const formattedUnit = basePrice > 0 ? window.formatCurrency(unitTotal) : 'A definir no painel';
    dom.productModalPrice.textContent = formattedUnit;
    dom.btnModalAddToCart.textContent = `Adicionar • ${window.formatCurrency(finalTotal)}`;
    dom.btnModalAddToCart.disabled = false;
  }

  function closeProductModal() {
    dom.productModal.style.display = 'none';
    state.currentModalProduct = null;
  }

  // ==========================================
  // CARRINHO DE COMPRAS
  // ==========================================
  async function updateCartUI() {
    const count = window.cart.getCount();
    const subtotal = window.cart.getSubtotal();
    const fee = await window.cart.getDeliveryFee();
    const total = await window.cart.getTotal();
    const isMinMet = await window.cart.isMinOrderMet();

    // Badges no Header
    if (dom.headerCartCount) {
      dom.headerCartCount.textContent = count;
      dom.headerCartCount.style.display = count > 0 ? 'inline-block' : 'none';
    }

    // Barra flutuante Mobile
    if (dom.mobileCartBar) {
      if (count > 0) {
        dom.mobileCartBar.style.display = 'flex';
        dom.mobileCartCount.textContent = `${count} ${count === 1 ? 'item' : 'itens'}`;
        dom.mobileCartTotal.textContent = window.formatCurrency(subtotal);
      } else {
        dom.mobileCartBar.style.display = 'none';
      }
    }

    // Gaveta do Carrinho (Cart Drawer)
    if (dom.cartDrawerItems) {
      if (window.cart.items.length === 0) {
        dom.cartDrawerItems.innerHTML = `
          <div class="cart-empty-state">
            <i><i class="fi fi-sr-shopping-cart" style="font-size: 2.5rem; color: var(--primary-yellow);"></i></i>
            <h3>Seu carrinho está vazio</h3>
            <p>Adicione pizzas fritas e delícias da Pizza Frita do CH para começar!</p>
          </div>
        `;
        dom.btnGoCheckout.disabled = true;
      } else {
        let itemsHtml = '';
        const escape = window.escapeHtml || (s => s);
        window.cart.items.forEach(item => {
          let customDetails = '';

          if (item.burger_version === 'duplo' || (item.name && item.name.includes('(Duplo)'))) {
            customDetails += `<div style="color: #ec4899; font-weight: 800;">🍔 Versão: DUPLO (+ R$ 5,00)</div>`;
          }

          if (item.flavor) {
            customDetails += `<div><strong>🥤 Sabor:</strong> ${escape(item.flavor.toUpperCase())}</div>`;
          }

          if (item.is_combo && item.combo_choices && item.combo_choices.length > 0) {
            const choicesStr = item.combo_choices
              .filter(c => c.qty > 0)
              .map(c => `${escape(c.qty)}x ${escape(c.name)}`)
              .join(', ');
            if (choicesStr) {
              customDetails += `<div><strong>🍔 Escolhas:</strong> ${choicesStr}</div>`;
            }
          }

          if (item.optionals && item.optionals.length > 0) {
            const optStr = item.optionals.map(o => `+ ${escape(o.name)}`).join(', ');
            customDetails += `<div><strong>Adicionais:</strong> ${optStr}</div>`;
          }

          if (item.notes) {
            customDetails += `<div><strong>Obs:</strong> ${escape(item.notes)}</div>`;
          }

          itemsHtml += `
            <div class="cart-product-item">
              <div class="cart-item-top">
                <span class="cart-item-title">${escape(item.name)}</span>
                <span class="cart-item-total-price">${window.formatCurrency(item.subtotal)}</span>
              </div>
              ${customDetails ? `<div class="cart-item-customs">${customDetails}</div>` : ''}
              <div class="cart-item-controls">
                <div class="combo-stepper-control">
                  <button class="btn-stepper btn-cart-minus" data-cart-id="${escape(item.cartItemId)}">-</button>
                  <span class="stepper-count-display">${Number(item.quantity) || 1}</span>
                  <button class="btn-stepper btn-cart-plus" data-cart-id="${escape(item.cartItemId)}">+</button>
                </div>
                <button class="btn-remove-item" data-cart-id="${escape(item.cartItemId)}"><i class="fi fi-sr-trash"></i> Remover</button>
              </div>
            </div>
          `;
        });

        dom.cartDrawerItems.innerHTML = itemsHtml;
        dom.btnGoCheckout.disabled = !isMinMet || !state.isStoreOpen;

        // Botões de quantidade e exclusão
        dom.cartDrawerItems.querySelectorAll('.btn-cart-plus').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-cart-id');
            const itm = window.cart.items.find(i => i.cartItemId === id);
            if (itm) window.cart.updateQuantity(id, itm.quantity + 1);
          });
        });

        dom.cartDrawerItems.querySelectorAll('.btn-cart-minus').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-cart-id');
            const itm = window.cart.items.find(i => i.cartItemId === id);
            if (itm) window.cart.updateQuantity(id, itm.quantity - 1);
          });
        });

        dom.cartDrawerItems.querySelectorAll('.btn-remove-item').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-cart-id');
            window.cart.removeItem(id);
          });
        });
      }

      dom.cartSubtotalVal.textContent = window.formatCurrency(subtotal);
      dom.cartDeliveryFeeVal.textContent = window.cart.deliveryType === 'pickup' ? 'Grátis' : (fee !== null ? window.formatCurrency(fee) : 'A calcular');
      dom.cartTotalVal.textContent = window.formatCurrency(total);

      if (dom.cartMinOrderWarning) {
        dom.cartMinOrderWarning.style.display = (subtotal > 0 && !isMinMet) ? 'flex' : 'none';
      }
    }
  }

  window.addEventListener('cart:updated', updateCartUI);

  // ==========================================
  // CHECKOUT & FINALIZAÇÃO
  // ==========================================
  async function openCheckout() {
    if (!state.isStoreOpen) {
      alert('Estamos fechados no momento. Nosso horário de funcionamento é de Quarta a Domingo, das 17:00 às 22:00 (Segunda e Terça fechado).');
      return;
    }

    const isMinMet = await window.cart.isMinOrderMet();
    if (!isMinMet) {
      alert('O valor mínimo do pedido é de R$ 10,00.');
      return;
    }

    dom.cartDrawer.style.display = 'none';
    dom.checkoutModal.style.display = 'flex';

    // Carrega opções de bairros cadastrados
    await populateNeighborhoodsDropdown();

    // Se o usuário estiver logado, pré-preenche dados e endereços salvos
    if (state.currentUser) {
      dom.inputCustName.value = state.currentUser.name || '';
      dom.inputCustPhone.value = formatPhone(state.currentUser.phone || '');
      loadSavedAddressesDropdown();
    } else {
      dom.savedAddressesSelect.style.display = 'none';
    }

    updateCheckoutTotals();
  }

  async function populateNeighborhoodsDropdown() {
    const neighborhoods = await window.db.getNeighborhoods();
    state.neighborhoods = neighborhoods || [];
    const active = state.neighborhoods
      .filter(n => n.is_active !== false)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }));
    
    let html = '<option value="">Selecione o seu bairro...</option>';
    active.forEach(n => {
      html += `<option value="${n.name}" data-fee="${n.delivery_fee}">${n.name} — ${window.formatCurrency(n.delivery_fee)} (${n.delivery_time_min || 60} min)</option>`;
    });
    dom.inputNeighborhood.innerHTML = html;

    dom.inputNeighborhood.onchange = async () => {
      const selectedName = dom.inputNeighborhood.value;
      const found = active.find(n => n.name === selectedName);
      window.cart.setSelectedNeighborhood(found || null);
      updateCheckoutTotals();
    };
  }

  async function loadSavedAddressesDropdown() {
    if (!state.currentUser) return;
    const addrs = await window.db.getAddresses(state.currentUser.id);
    if (addrs && addrs.length > 0) {
      dom.savedAddressesSelect.style.display = 'block';
      let html = '<option value="">Escolher endereço salvo...</option>';
      addrs.forEach(a => {
        html += `<option value="${a.id}">${a.label || 'Endereço'} — ${a.street}, ${a.number} (${a.neighborhood})</option>`;
      });
      dom.savedAddressesSelect.innerHTML = html;

      dom.savedAddressesSelect.onchange = async () => {
        const selectedId = dom.savedAddressesSelect.value;
        const found = addrs.find(a => a.id === selectedId);
        if (found) {
          dom.inputStreet.value = found.street || '';
          dom.inputNumber.value = found.number || '';
          dom.inputComplement.value = found.complement || '';
          dom.inputNeighborhood.value = found.neighborhood || '';
          dom.inputReference.value = found.reference || '';

          const neighborhoods = await window.db.getNeighborhoods();
          const neigh = neighborhoods.find(n => n.name.toLowerCase() === (found.neighborhood || '').toLowerCase());
          window.cart.setSelectedNeighborhood(neigh || null);
          updateCheckoutTotals();
        }
      };
    } else {
      dom.savedAddressesSelect.style.display = 'none';
    }
  }

  async function updateCheckoutTotals() {
    const subtotal = window.cart.getSubtotal();
    const fee = await window.cart.getDeliveryFee();
    const total = await window.cart.getTotal();

    dom.checkoutSubtotalVal.textContent = window.formatCurrency(subtotal);
    if (window.cart.deliveryType === 'pickup') {
      dom.checkoutFeeVal.textContent = 'R$ 0,00 (Retirada)';
    } else if (fee !== null) {
      dom.checkoutFeeVal.textContent = window.formatCurrency(fee);
    } else {
      dom.checkoutFeeVal.textContent = 'Selecione o bairro acima';
    }
    dom.checkoutTotalVal.textContent = window.formatCurrency(total);
  }

  async function confirmAndSendOrder() {
    if (!state.isStoreOpen) {
      alert('Não é possível finalizar pedidos enquanto a loja estiver fechada.');
      return;
    }

    const custName = dom.inputCustName.value.trim();
    const custPhone = dom.inputCustPhone.value.trim();

    if (!custName || custName.length < 2) {
      alert('Por favor, informe seu nome.');
      dom.inputCustName.focus();
      return;
    }

    if (!custPhone || custPhone.replace(/\D/g, '').length < 10) {
      alert('Por favor, informe um telefone de WhatsApp válido com DDD.');
      dom.inputCustPhone.focus();
      return;
    }

    let deliveryAddress = null;
    if (window.cart.deliveryType === 'delivery') {
      const street = dom.inputStreet.value.trim();
      const number = dom.inputNumber.value.trim();
      const neighborhood = dom.inputNeighborhood.value.trim();

      if (!street) {
        alert('Por favor, informe a rua/avenida para entrega.');
        dom.inputStreet.focus();
        return;
      }
      if (!number) {
        alert('Por favor, informe o número do endereço.');
        dom.inputNumber.focus();
        return;
      }
      if (!neighborhood) {
        alert('Por favor, informe o bairro.');
        dom.inputNeighborhood.focus();
        return;
      }

      deliveryAddress = {
        street,
        number,
        complement: dom.inputComplement.value.trim(),
        neighborhood,
        city: 'Jaboatão dos Guararapes',
        state: 'PE',
        reference: dom.inputReference.value.trim()
      };
    }

    const subtotal = window.cart.getSubtotal();
    const fee = await window.cart.getDeliveryFee();
    const total = await window.cart.getTotal();
    let changeFor = null;

    if (selectedPaymentMethod === 'dinheiro') {
      const changeInputVal = parseFloat(dom.inputChangeFor.value.replace(',', '.'));
      if (changeInputVal) {
        if (changeInputVal < total) {
          alert(`O valor do troco (${window.formatCurrency(changeInputVal)}) não pode ser menor que o total do pedido (${window.formatCurrency(total)}).`);
          dom.inputChangeFor.focus();
          return;
        }
        changeFor = changeInputVal;
      }
    }

    const generalNotes = dom.inputOrderGeneralNotes.value.trim();

    // Criação do Pedido no Banco de Dados
    const orderPayload = {
      user_id: state.currentUser ? state.currentUser.id : null,
      customer_name: custName,
      customer_phone: custPhone,
      order_type: window.cart.deliveryType,
      delivery_address: deliveryAddress,
      payment_method: selectedPaymentMethod,
      change_for: changeFor,
      subtotal,
      delivery_fee: fee,
      total,
      notes: generalNotes,
      items: window.cart.items
    };

    dom.btnConfirmOrder.disabled = true;
    dom.btnConfirmOrder.textContent = 'Enviando Pedido...';

    try {
      const savedOrder = await window.db.createOrder(orderPayload);
      const formattedMessage = window.cart.formatWhatsAppMessage({
        orderNumber: savedOrder.order_number,
        customerName: custName,
        customerPhone: custPhone,
        orderType: window.cart.deliveryType,
        deliveryAddress,
        paymentMethod: selectedPaymentMethod,
        changeFor,
        generalNotes,
        subtotal,
        deliveryFee: fee,
        total
      });

      // Abre WhatsApp automaticamente
      const whatsappUrl = `https://wa.me/${window.APP_CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(formattedMessage)}`;
      window.open(whatsappUrl, '_blank');

      // Abre Modal de Sucesso
      dom.checkoutModal.style.display = 'none';
      dom.successModal.style.display = 'flex';
      dom.successOrderNum.textContent = `Pedido #${String(savedOrder.order_number).padStart(4, '0')}`;
      dom.successSummaryText.textContent = `Total: ${window.formatCurrency(total)} • ${window.cart.deliveryType === 'delivery' ? 'Entrega' : 'Retirada no Local'}`;
      
      dom.btnOpenWhatsAppDirect.onclick = () => {
        window.open(whatsappUrl, '_blank');
      };

      // Limpa carrinho
      window.cart.clear();
    } catch (err) {
      console.error('Erro ao registrar pedido:', err);
      alert('Ocorreu um erro ao registrar o pedido. Verifique sua conexão.');
    } finally {
      dom.btnConfirmOrder.disabled = false;
      dom.btnConfirmOrder.textContent = 'Confirmar e Enviar para WhatsApp';
    }
  }

  // ==========================================
  // AUTENTICAÇÃO DO CLIENTE & PORTAL
  // ==========================================
  function openAuthOrPortal() {
    if (state.currentUser) {
      openCustomerPortal();
    } else {
      dom.authLoginForm.style.display = 'block';
      dom.authRegisterForm.style.display = 'none';
      dom.customerPortal.style.display = 'none';
      dom.authModalTitle.textContent = 'Acessar Conta';
      dom.authModal.style.display = 'flex';
    }
  }

  async function openCustomerPortal() {
    dom.authLoginForm.style.display = 'none';
    dom.authRegisterForm.style.display = 'none';
    dom.customerPortal.style.display = 'block';
    dom.authModalTitle.textContent = 'Minha Conta';
    
    dom.portalUserName.textContent = state.currentUser.name;
    dom.portalUserPhone.textContent = formatPhone(state.currentUser.phone);

    // Carrega endereços salvos
    const escape = window.escapeHtml || (s => s);
    const addrs = await window.db.getAddresses(state.currentUser.id);
    let addrHtml = '';
    if (addrs.length === 0) {
      addrHtml = '<p style="font-size: 0.82rem; color: var(--text-muted);">Nenhum endereço salvo ainda.</p>';
    } else {
      addrs.forEach(a => {
        addrHtml += `
          <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px 12px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 0.85rem;">
              <strong>${escape(a.label || 'Casa')}</strong>: ${escape(a.street)}, ${escape(a.number)} - ${escape(a.neighborhood)}
              ${a.reference ? `<span style="font-size: 0.78rem; color: var(--text-muted); display: block;">Ref: ${escape(a.reference)}</span>` : ''}
            </div>
            <button class="btn-delete-addr" data-addr-id="${escape(a.id)}" style="color: var(--primary-red); font-size: 0.85rem;" title="Excluir Endereço"><i class="fi fi-sr-trash"></i></button>
          </div>
        `;
      });
    }
    dom.portalAddressList.innerHTML = addrHtml;

    dom.portalAddressList.querySelectorAll('.btn-delete-addr').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-addr-id');
        await window.db.deleteAddress(id);
        openCustomerPortal();
      });
    });

    // Carrega histórico de pedidos
    const allOrders = await window.db.getOrders();
    const userOrders = allOrders.filter(o => o.user_id === state.currentUser.id || o.customer_phone === state.currentUser.phone);
    let ordersHtml = '';

    if (userOrders.length === 0) {
      ordersHtml = '<p style="font-size: 0.82rem; color: var(--text-muted);">Você ainda não realizou pedidos.</p>';
    } else {
      userOrders.forEach(o => {
        ordersHtml += `
          <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px 12px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
              <strong style="color: var(--primary-yellow);">#${String(escape(o.order_number)).padStart(4, '0')}</strong>
              <span style="font-size: 0.78rem; text-transform: uppercase; font-weight: 700; color: var(--primary-yellow);">${escape(o.status)}</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${new Date(o.created_at).toLocaleString('pt-BR')} • Total: ${window.formatCurrency(o.total)}</div>
          </div>
        `;
      });
    }
    dom.portalOrdersList.innerHTML = ordersHtml;

    dom.authModal.style.display = 'flex';
  }

  // ==========================================
  // EVENT LISTENERS GERAIS
  // ==========================================
  function showToast(message) {
    if (!dom.appToastNotification) return;
    dom.appToastNotification.innerHTML = `<span>${message}</span>`;
    dom.appToastNotification.classList.add('show');
    setTimeout(() => {
      dom.appToastNotification.classList.remove('show');
    }, 3000);
  }

  function setupEventListeners() {
    // 1. Ações do Card de Boas-Vindas / Entrada
    if (dom.btnToggleHours && dom.hoursAccordionContent) {
      dom.btnToggleHours.addEventListener('click', () => {
        const isShown = dom.hoursAccordionContent.style.display === 'block';
        dom.hoursAccordionContent.style.display = isShown ? 'none' : 'block';
        if (dom.hoursArrow) {
          dom.hoursArrow.textContent = isShown ? '▾' : '▴';
        }
      });
    }

    if (dom.btnShareRestaurant) {
      dom.btnShareRestaurant.addEventListener('click', async () => {
        const shareData = {
          title: 'Pizza Frita do CH',
          text: 'Confira o cardápio online e faça seu pedido na Pizza Frita do CH!',
          url: window.location.href
        };
        if (navigator.share) {
          try {
            await navigator.share(shareData);
          } catch (err) {
            // Compartilhamento cancelado pelo usuário
          }
        } else {
          try {
            await navigator.clipboard.writeText(window.location.href);
            showToast('<i class="fi fi-sr-check-circle"></i> Link copiado para a área de transferência!');
          } catch {
            showToast('<i class="fi fi-sr-check-circle"></i> Link: ' + window.location.href);
          }
        }
      });
    }

    // Busca em tempo real (com atalho secreto /adm para a área administrativa)
    if (dom.searchInput) {
      dom.searchInput.addEventListener('input', (e) => {
        const val = e.target.value.trim().toLowerCase();
        if (val === '/adm') {
          window.location.href = 'admin.html';
          return;
        }
        state.searchQuery = e.target.value;
        if (dom.btnClearSearch) {
          dom.btnClearSearch.style.display = state.searchQuery ? 'block' : 'none';
        }
        renderMenu();
      });
    }

    if (dom.btnClearSearch) {
      dom.btnClearSearch.addEventListener('click', () => {
        dom.searchInput.value = '';
        state.searchQuery = '';
        dom.btnClearSearch.style.display = 'none';
        renderMenu();
      });
    }

    // Abertura e fechamento do Carrinho
    if (dom.headerCartBtn) {
      dom.headerCartBtn.addEventListener('click', () => {
        dom.cartDrawer.style.display = 'flex';
      });
    }

    if (dom.mobileCartBar) {
      dom.mobileCartBar.addEventListener('click', () => {
        dom.cartDrawer.style.display = 'flex';
      });
    }

    if (dom.cartDrawerClose) {
      dom.cartDrawerClose.addEventListener('click', () => {
        dom.cartDrawer.style.display = 'none';
      });
    }

    if (dom.btnGoCheckout) {
      dom.btnGoCheckout.addEventListener('click', openCheckout);
    }

    // Modal de Produto
    if (dom.btnModalClose) dom.btnModalClose.addEventListener('click', closeProductModal);
    
    if (dom.btnModalQtyPlus) {
      dom.btnModalQtyPlus.addEventListener('click', () => {
        state.modalQty += 1;
        dom.productModalQtyVal.textContent = state.modalQty;
        updateModalDynamicPrice();
      });
    }

    if (dom.btnModalQtyMinus) {
      dom.btnModalQtyMinus.addEventListener('click', () => {
        if (state.modalQty > 1) {
          state.modalQty -= 1;
          dom.productModalQtyVal.textContent = state.modalQty;
          updateModalDynamicPrice();
        }
      });
    }

    if (dom.btnModalAddToCart) {
      dom.btnModalAddToCart.addEventListener('click', () => {
        if (!state.currentModalProduct) return;

        let effectivePrice = getProductEffectivePrice(state.currentModalProduct);
        if (state.modalSelectedSize && state.modalSelectedSize.price) {
          effectivePrice = Number(state.modalSelectedSize.price);
        }

        const productToAdd = {
          ...state.currentModalProduct,
          price: effectivePrice
        };
        const notes = dom.productModalNotes ? dom.productModalNotes.value : '';
        window.cart.addItem(
          productToAdd,
          state.modalQty,
          state.modalSelectedOptionals,
          notes,
          [],
          '',
          state.modalSelectedSize
        );

        closeProductModal();
      });
    }

    // Checkout Tabs (Entrega / Retirada)
    if (dom.tabDelivery) {
      dom.tabDelivery.addEventListener('click', () => {
        dom.tabDelivery.classList.add('active');
        dom.tabPickup.classList.remove('active');
        dom.deliveryAddressFields.style.display = 'block';
        dom.pickupAddressNotice.style.display = 'none';
        window.cart.setDeliveryType('delivery');
        renderMenu();
        updateCheckoutTotals();
      });
    }

    if (dom.tabPickup) {
      dom.tabPickup.addEventListener('click', () => {
        dom.tabPickup.classList.add('active');
        dom.tabDelivery.classList.remove('active');
        dom.deliveryAddressFields.style.display = 'none';
        dom.pickupAddressNotice.style.display = 'block';
        window.cart.setDeliveryType('pickup');
        renderMenu();
        updateCheckoutTotals();
      });
    }

    // Formas de Pagamento
    if (dom.paymentMethodCards) {
      dom.paymentMethodCards.forEach(card => {
        card.addEventListener('click', () => {
          dom.paymentMethodCards.forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          selectedPaymentMethod = card.getAttribute('data-payment');
          dom.cashChangeSection.style.display = selectedPaymentMethod === 'dinheiro' ? 'block' : 'none';
        });
      });
    }

    if (dom.checkoutModalClose) {
      dom.checkoutModalClose.addEventListener('click', () => {
        dom.checkoutModal.style.display = 'none';
      });
    }

    if (dom.btnConfirmOrder) {
      dom.btnConfirmOrder.addEventListener('click', confirmAndSendOrder);
    }

    if (dom.btnSuccessClose) {
      dom.btnSuccessClose.addEventListener('click', () => {
        dom.successModal.style.display = 'none';
      });
    }

    // Perfil / Login
    if (dom.userProfileBtn) {
      dom.userProfileBtn.addEventListener('click', openAuthOrPortal);
    }

    if (dom.authModalClose) {
      dom.authModalClose.addEventListener('click', () => {
        dom.authModal.style.display = 'none';
      });
    }

    if (dom.btnToggleToRegister) {
      dom.btnToggleToRegister.addEventListener('click', () => {
        dom.authLoginForm.style.display = 'none';
        dom.authRegisterForm.style.display = 'block';
        dom.authModalTitle.textContent = 'Criar Nova Conta';
      });
    }

    if (dom.btnToggleToLogin) {
      dom.btnToggleToLogin.addEventListener('click', () => {
        dom.authRegisterForm.style.display = 'none';
        dom.authLoginForm.style.display = 'block';
        dom.authModalTitle.textContent = 'Acessar Conta';
      });
    }

    // Login Submit
    const loginForm = document.getElementById('loginFormElement');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const phone = document.getElementById('loginPhone').value;
        const pass = document.getElementById('loginPassword').value;
        try {
          const user = await window.auth.loginCustomer({ phone, password: pass });
          state.currentUser = user;
          openCustomerPortal();
        } catch (err) {
          alert(err.message || 'Erro ao realizar login.');
        }
      });
    }

    // Register Submit
    const registerForm = document.getElementById('registerFormElement');
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('regName').value;
        const phone = document.getElementById('regPhone').value;
        const pass = document.getElementById('regPassword').value;
        try {
          const user = await window.auth.registerCustomer({ name, phone, password: pass });
          state.currentUser = user;
          openCustomerPortal();
        } catch (err) {
          alert(err.message || 'Erro ao realizar cadastro.');
        }
      });
    }

    // Logout
    if (dom.btnLogoutCustomer) {
      dom.btnLogoutCustomer.addEventListener('click', () => {
        window.auth.logoutCustomer();
        state.currentUser = null;
        dom.authModal.style.display = 'none';
      });
    }

    // Adicionar novo endereço
    if (dom.btnNewAddress) {
      dom.btnNewAddress.addEventListener('click', async () => {
        const selectEl = document.getElementById('newAddrNeighborhood');
        if (selectEl) {
          const neighborhoods = await window.db.getNeighborhoods();
          const active = neighborhoods.filter(n => n.is_active !== false);
          let opts = '<option value="">Selecione o seu bairro...</option>';
          active.forEach(n => {
            opts += `<option value="${n.name}">${n.name} — ${window.formatCurrency(n.delivery_fee)}</option>`;
          });
          selectEl.innerHTML = opts;
        }
        dom.newAddressForm.style.display = 'block';
      });
    }

    if (dom.btnCancelNewAddress) {
      dom.btnCancelNewAddress.addEventListener('click', () => {
        dom.newAddressForm.style.display = 'none';
      });
    }

    if (dom.btnSaveNewAddress) {
      dom.btnSaveNewAddress.addEventListener('click', async () => {
        const label = document.getElementById('newAddrLabel').value.trim() || 'Casa';
        const street = document.getElementById('newAddrStreet').value.trim();
        const number = document.getElementById('newAddrNumber').value.trim();
        const neighborhood = document.getElementById('newAddrNeighborhood').value.trim();
        const reference = document.getElementById('newAddrRef').value.trim();

        if (!street || !number) {
          alert('Por favor, preencha a rua e o número.');
          return;
        }
        if (!neighborhood) {
          alert('Por favor, selecione o bairro de entrega.');
          return;
        }

        await window.db.saveAddress({
          user_id: state.currentUser.id,
          label,
          street,
          number,
          neighborhood,
          city: 'Jaboatão dos Guararapes',
          state: 'PE',
          reference
        });

        dom.newAddressForm.style.display = 'none';
        openCustomerPortal();
      });
    }
  }

  // ==========================================
  // MÁSCARAS & FORMATADORES
  // ==========================================
  function setupPhoneMasks() {
    const phoneInputs = document.querySelectorAll('input[type="tel"]');
    phoneInputs.forEach(input => {
      input.addEventListener('input', (e) => {
        e.target.value = formatPhone(e.target.value);
      });
    });
  }

  function formatPhone(v) {
    let r = v.replace(/\D/g, '');
    if (r.length > 11) r = r.substring(0, 11);
    if (r.length > 6) {
      return `(${r.substring(0, 2)}) ${r.substring(2, 7)}-${r.substring(7)}`;
    } else if (r.length > 2) {
      return `(${r.substring(0, 2)}) ${r.substring(2)}`;
    } else if (r.length > 0) {
      return `(${r}`;
    }
    return r;
  }

  // Inicializa a aplicação
  init();
});
