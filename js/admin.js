// ========================================================
// BOYDEGUSTA - CONTROLADOR DO PAINEL ADMINISTRATIVO COM PDV, MESAS, ENTREGADORES E CAIXA
// ========================================================

// Retorna a data de expediente do restaurante (YYYY-MM-DD no horário local do Brasil).
// Turnos/pedidos que avançam pela madrugada (antes das 05h da manhã) pertencem ao expediente do dia anterior!
function getBusinessDateString(dateInput = new Date()) {
  if (!dateInput) return '';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '';

  const businessDate = new Date(d.getTime());
  // Se o pedido foi feito na madrugada (entre 00:00 e 04:59), pertence ao expediente da noite anterior
  if (businessDate.getHours() < 5) {
    businessDate.setDate(businessDate.getDate() - 1);
  }

  const year = businessDate.getFullYear();
  const month = String(businessDate.getMonth() + 1).padStart(2, '0');
  const day = String(businessDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ========================================================
// POPUPS CUSTOMIZADOS (substituem confirm/prompt nativos)
// ========================================================

/**
 * Exibe o popup de escolha de tamanho do hambúrguer.
 * Retorna Promise<'tradicional' | 'duplo' | null> (null = cancelado)
 */
function showBurgerChoicePopup(productName) {
  return new Promise(resolve => {
    const modal = document.getElementById('popupChoiceModal');
    const nameEl = document.getElementById('popupChoiceProductName');
    if (!modal) { resolve(confirm('Duplo? (+R$5)') ? 'duplo' : 'tradicional'); return; }

    nameEl.textContent = productName;
    modal.style.display = 'flex';

    const cleanup = (result) => {
      modal.style.display = 'none';
      document.getElementById('popupChoiceTradicional').onclick = null;
      document.getElementById('popupChoiceDuplo').onclick = null;
      document.getElementById('popupChoiceCancel').onclick = null;
      resolve(result);
    };

    document.getElementById('popupChoiceTradicional').onclick = () => cleanup('tradicional');
    document.getElementById('popupChoiceDuplo').onclick       = () => cleanup('duplo');
    document.getElementById('popupChoiceCancel').onclick      = () => cleanup(null);
  });
}

/**
 * Exibe o popup de campo de texto (observações).
 * Retorna Promise<string | null> (null = cancelado, string vazia = sem obs)
 */
function showInputPopup(title, subtitle, placeholder) {
  return new Promise(resolve => {
    const modal    = document.getElementById('popupInputModal');
    const titleEl  = document.getElementById('popupInputTitle');
    const subEl    = document.getElementById('popupInputSubtitle');
    const field    = document.getElementById('popupInputField');
    const btnOk    = document.getElementById('popupInputConfirm');
    const btnCancel= document.getElementById('popupInputCancel');
    if (!modal) { resolve(prompt(title, '') || ''); return; }

    titleEl.textContent  = title || 'Observações';
    subEl.textContent    = subtitle || 'Alguma observação especial?';
    field.placeholder    = placeholder || 'Ex: sem cebola...';
    field.value          = '';
    modal.style.display  = 'flex';
    setTimeout(() => field.focus(), 80);

    const cleanup = (result) => {
      modal.style.display = 'none';
      btnOk.onclick     = null;
      btnCancel.onclick = null;
      field.onkeydown   = null;
      resolve(result);
    };

    btnOk.onclick     = () => cleanup(field.value.trim());
    btnCancel.onclick = () => cleanup(null);
    field.onkeydown   = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); cleanup(field.value.trim()); } };
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  // ==========================================
  // ESTADO DE ALERTAS SONOROS (declarado aqui para evitar TDZ)
  // ==========================================
  let knownOrderIds = new Set();
  let isFirstLoad = true;
  let isSoundEnabled = true;
  let audioCtx = null;
  let pendingBeep = false; // toca no próximo clique se autoplay foi bloqueado

  let adminState = {
    settings: null,
    orders: [],
    products: [],
    categories: [],
    optionals: [],
    promotions: [],
    neighborhoods: [],
    couriers: [],
    activeTab: 'orders',
    orderFilter: 'all',
    productSearch: '',
    productCategoryFilter: 'all',
    neighborhoodSearch: '',
    selectedCashDate: getBusinessDateString(new Date()),
    
    // Estado do PDV / Salão
    posTarget: { type: 'mesa', tableNumber: 1 },
    posCart: [],
    posActiveCategory: 'all',
    posSearch: '',
    posCustomItemState: null,
    activeTableDetailsNum: null,

    // Estado do Pedido WhatsApp
    waOrderType: 'delivery', // 'delivery' | 'pickup'
    waCart: []
  };

  const dom = {
    adminLoginModal: document.getElementById('adminLoginModal'),
    adminLoginForm: document.getElementById('adminLoginForm'),
    adminPasswordInput: document.getElementById('adminPasswordInput'),
    adminApp: document.getElementById('adminApp'),
    btnToggleStoreStatus: document.getElementById('btnToggleStoreStatus'),
    adminStoreStatusText: document.getElementById('adminStoreStatusText'),
    btnQuickOpenStore: document.getElementById('btnQuickOpenStore'),
    btnAdminLogout: document.getElementById('btnAdminLogout'),
    btnQuickPos: document.getElementById('btnQuickPos'),
    btnQuickWhatsapp: document.getElementById('btnQuickWhatsapp'),

    // Tabs
    tabButtons: document.querySelectorAll('.admin-tab-btn'),
    tabContents: document.querySelectorAll('.admin-tab-content'),

    // Salão & PDV (Tab 0)
    posFreeCount: document.getElementById('posFreeCount'),
    posBusyCount: document.getElementById('posBusyCount'),
    btnOpenBalcaoPos: document.getElementById('btnOpenBalcaoPos'),
    btnOpenWhatsappOrder: document.getElementById('btnOpenWhatsappOrder'),
    btnRefreshPos: document.getElementById('btnRefreshPos'),
    posTablesGrid: document.getElementById('posTablesGrid'),

    // Modal PDV Lançador de Pedidos
    posOrderModal: document.getElementById('posOrderModal'),
    posTargetBadge: document.getElementById('posTargetBadge'),
    btnPosModalClose: document.getElementById('btnPosModalClose'),
    posCustomerName: document.getElementById('posCustomerName'),
    posCustomerPhone: document.getElementById('posCustomerPhone'),
    posCategoryFilters: document.getElementById('posCategoryFilters'),
    posSearchProductInput: document.getElementById('posSearchProductInput'),
    posProductsCatalogGrid: document.getElementById('posProductsCatalogGrid'),
    posCartItemsList: document.getElementById('posCartItemsList'),
    btnPosClearCart: document.getElementById('btnPosClearCart'),
    posGeneralNotes: document.getElementById('posGeneralNotes'),
    posPaymentSelect: document.getElementById('posPaymentSelect'),
    posCartTotalValue: document.getElementById('posCartTotalValue'),
    btnSubmitPosOrder: document.getElementById('btnSubmitPosOrder'),

    // Modal Customização de Item PDV
    posItemCustomModal: document.getElementById('posItemCustomModal'),
    posCustomItemTitle: document.getElementById('posCustomItemTitle'),
    btnPosCustomItemClose: document.getElementById('btnPosCustomItemClose'),
    posCustomItemDescription: document.getElementById('posCustomItemDescription'),
    posCustomItemBasePrice: document.getElementById('posCustomItemBasePrice'),
    posCustomFlavorSection: document.getElementById('posCustomFlavorSection'),
    posCustomFlavorTitle: document.getElementById('posCustomFlavorTitle'),
    posCustomFlavorChoices: document.getElementById('posCustomFlavorChoices'),
    posCustomComboSection: document.getElementById('posCustomComboSection'),
    posCustomComboTitle: document.getElementById('posCustomComboTitle'),
    posCustomComboChoices: document.getElementById('posCustomComboChoices'),
    posCustomOptionalsSection: document.getElementById('posCustomOptionalsSection'),
    posCustomOptionalsList: document.getElementById('posCustomOptionalsList'),
    posCustomItemNotes: document.getElementById('posCustomItemNotes'),
    btnPosCustomQtyMinus: document.getElementById('btnPosCustomQtyMinus'),
    posCustomItemQty: document.getElementById('posCustomItemQty'),
    btnPosCustomQtyPlus: document.getElementById('btnPosCustomQtyPlus'),
    btnConfirmCustomItem: document.getElementById('btnConfirmCustomItem'),
    posCustomItemSubtotal: document.getElementById('posCustomItemSubtotal'),

    // Modal Extrato da Mesa
    tableDetailsModal: document.getElementById('tableDetailsModal'),
    tableDetailsTitle: document.getElementById('tableDetailsTitle'),
    tableDetailsStatusBadge: document.getElementById('tableDetailsStatusBadge'),
    btnTableDetailsClose: document.getElementById('btnTableDetailsClose'),
    tableDetailsCustomer: document.getElementById('tableDetailsCustomer'),
    tableDetailsTime: document.getElementById('tableDetailsTime'),
    tableDetailsOrdersCount: document.getElementById('tableDetailsOrdersCount'),
    tableDetailsItemsBody: document.getElementById('tableDetailsItemsBody'),
    tableDetailsGrandTotal: document.getElementById('tableDetailsGrandTotal'),
    tableClosePaymentMethod: document.getElementById('tableClosePaymentMethod'),
    tableCloseChangeGroup: document.getElementById('tableCloseChangeGroup'),
    tableCloseChangeFor: document.getElementById('tableCloseChangeFor'),
    btnTableAddMoreItems: document.getElementById('btnTableAddMoreItems'),
    btnTablePrintBill: document.getElementById('btnTablePrintBill'),
    btnTableCloseBill: document.getElementById('btnTableCloseBill'),

    // Dashboard
    statOrdersToday: document.getElementById('statOrdersToday'),
    statRevenueToday: document.getElementById('statRevenueToday'),
    statOrdersOngoing: document.getElementById('statOrdersOngoing'),
    statAverageTicket: document.getElementById('statAverageTicket'),
    topProductsList: document.getElementById('topProductsList'),

    // Pedidos
    btnRefreshOrders: document.getElementById('btnRefreshOrders'),
    orderFilterChips: document.querySelectorAll('.filter-chip'),
    ordersListContainer: document.getElementById('ordersListContainer'),

    // Despacho de Entregador
    dispatchCourierModal: document.getElementById('dispatchCourierModal'),
    dispatchModalSubtitle: document.getElementById('dispatchModalSubtitle'),
    dispatchOrderId: document.getElementById('dispatchOrderId'),
    dispatchCouriersList: document.getElementById('dispatchCouriersList'),
    btnDispatchModalClose: document.getElementById('btnDispatchModalClose'),
    btnAddOtherCourier: document.getElementById('btnAddOtherCourier'),
    btnConfirmDispatchNoCourier: document.getElementById('btnConfirmDispatchNoCourier'),

    // Produtos
    btnOpenAddProduct: document.getElementById('btnOpenAddProduct'),
    adminSearchProductInput: document.getElementById('adminSearchProductInput'),
    adminFilterCategory: document.getElementById('adminFilterCategory'),
    adminProductsTableBody: document.getElementById('adminProductsTableBody'),
    productEditModal: document.getElementById('productEditModal'),
    productEditModalTitle: document.getElementById('productEditModalTitle'),
    productEditForm: document.getElementById('productEditForm'),
    btnProductEditClose: document.getElementById('btnProductEditClose'),
    btnProductEditCancel: document.getElementById('btnProductEditCancel'),
    editProdId: document.getElementById('editProdId'),
    editProdName: document.getElementById('editProdName'),
    editProdCategory: document.getElementById('editProdCategory'),
    editProdBurgerType: document.getElementById('editProdBurgerType'),
    editProdDescription: document.getElementById('editProdDescription'),
    editProdPrice: document.getElementById('editProdPrice'),
    editProdPriceP: document.getElementById('editProdPriceP'),
    editProdPriceM: document.getElementById('editProdPriceM'),
    editProdPriceG: document.getElementById('editProdPriceG'),
    editProdHasSizes: document.getElementById('editProdHasSizes'),
    editProdSizesFields: document.getElementById('editProdSizesFields'),
    editProdAvailable: document.getElementById('editProdAvailable'),
    editProdSalesChannel: document.getElementById('editProdSalesChannel'),
    editProdImage: document.getElementById('editProdImage'),
    editProdFileInput: document.getElementById('editProdFileInput'),
    editProdImagePreviewWrap: document.getElementById('editProdImagePreviewWrap'),
    editProdImagePreview: document.getElementById('editProdImagePreview'),
    editProdFileName: document.getElementById('editProdFileName'),
    btnRemoveProdImage: document.getElementById('btnRemoveProdImage'),
    editProdHasDayPromo: document.getElementById('editProdHasDayPromo'),
    editProdDayPromoFields: document.getElementById('editProdDayPromoFields'),
    editProdPromoPrice: document.getElementById('editProdPromoPrice'),
    editProdPromoLabel: document.getElementById('editProdPromoLabel'),
    editProdHasCustomization: document.getElementById('editProdHasCustomization'),
    editProdCustomizationFields: document.getElementById('editProdCustomizationFields'),
    editProdCustomType: document.getElementById('editProdCustomType'),
    editProdCustomMaxQtyGroup: document.getElementById('editProdCustomMaxQtyGroup'),
    editProdCustomMaxQty: document.getElementById('editProdCustomMaxQty'),
    editProdCustomLabel: document.getElementById('editProdCustomLabel'),
    editProdCustomOptions: document.getElementById('editProdCustomOptions'),

    // Promoções por Dia da Semana (Modal Exclusivo)
    btnOpenDayPromoModal: document.getElementById('btnOpenDayPromoModal'),
    dayPromoModal: document.getElementById('dayPromoModal'),
    dayPromoModalTitle: document.getElementById('dayPromoModalTitle'),
    dayPromoForm: document.getElementById('dayPromoForm'),
    btnDayPromoModalClose: document.getElementById('btnDayPromoModalClose'),
    btnDayPromoModalCancel: document.getElementById('btnDayPromoModalCancel'),
    btnRemoveDayPromo: document.getElementById('btnRemoveDayPromo'),
    dayPromoProdId: document.getElementById('dayPromoProdId'),
    dayPromoProdSelect: document.getElementById('dayPromoProdSelect'),
    dayPromoRegularPrice: document.getElementById('dayPromoRegularPrice'),
    dayPromoPrice: document.getElementById('dayPromoPrice'),
    dayPromoLabel: document.getElementById('dayPromoLabel'),
    dayPromoActive: document.getElementById('dayPromoActive'),

    // Aba de Promoções do Dia
    btnOpenAddPromotionTab: document.getElementById('btnOpenAddPromotionTab'),
    adminPromotionsTableBody: document.getElementById('adminPromotionsTableBody'),
    adminSearchPromoInput: document.getElementById('adminSearchPromoInput'),
    adminFilterPromoDay: document.getElementById('adminFilterPromoDay'),
    promoStatTotal: document.getElementById('promoStatTotal'),
    promoStatToday: document.getElementById('promoStatToday'),

    // Categorias
    btnOpenAddCategory: document.getElementById('btnOpenAddCategory'),
    adminCategoriesTableBody: document.getElementById('adminCategoriesTableBody'),
    categoryEditModal: document.getElementById('categoryEditModal'),
    categoryModalTitle: document.getElementById('categoryModalTitle'),
    categoryEditForm: document.getElementById('categoryEditForm'),
    btnCategoryModalClose: document.getElementById('btnCategoryModalClose'),
    btnCategoryModalCancel: document.getElementById('btnCategoryModalCancel'),
    editCatId: document.getElementById('editCatId'),
    editCatName: document.getElementById('editCatName'),
    editCatOrder: document.getElementById('editCatOrder'),
    editCatActive: document.getElementById('editCatActive'),

    // Adicionais

    btnOpenAddOptional: document.getElementById('btnOpenAddOptional'),
    adminOptionalsTableBody: document.getElementById('adminOptionalsTableBody'),
    optionalEditModal: document.getElementById('optionalEditModal'),
    optionalModalTitle: document.getElementById('optionalModalTitle'),
    optionalEditForm: document.getElementById('optionalEditForm'),
    btnOptionalModalClose: document.getElementById('btnOptionalModalClose'),
    btnOptionalModalCancel: document.getElementById('btnOptionalModalCancel'),
    editOptId: document.getElementById('editOptId'),
    editOptName: document.getElementById('editOptName'),
    editOptPrice: document.getElementById('editOptPrice'),
    editOptActive: document.getElementById('editOptActive'),
    editOptTarget: document.getElementById('editOptTarget'),

    // Bairros & Taxas de Entrega
    btnOpenAddNeighborhood: document.getElementById('btnOpenAddNeighborhood'),
    adminSearchNeighborhoodInput: document.getElementById('adminSearchNeighborhoodInput'),
    adminNeighborhoodsTableBody: document.getElementById('adminNeighborhoodsTableBody'),
    neighborhoodEditModal: document.getElementById('neighborhoodEditModal'),
    neighborhoodModalTitle: document.getElementById('neighborhoodModalTitle'),
    neighborhoodEditForm: document.getElementById('neighborhoodEditForm'),
    btnNeighborhoodModalClose: document.getElementById('btnNeighborhoodModalClose'),
    btnNeighborhoodModalCancel: document.getElementById('btnNeighborhoodModalCancel'),
    editNeighborhoodId: document.getElementById('editNeighborhoodId'),
    editNeighborhoodName: document.getElementById('editNeighborhoodName'),
    editNeighborhoodFee: document.getElementById('editNeighborhoodFee'),
    editNeighborhoodTime: document.getElementById('editNeighborhoodTime'),
    editNeighborhoodActive: document.getElementById('editNeighborhoodActive'),

    // Fechamento de Caixa & Entregadores
    cashReportDatePicker: document.getElementById('cashReportDatePicker'),
    btnCashToday: document.getElementById('btnCashToday'),
    btnCashYesterday: document.getElementById('btnCashYesterday'),
    btnPrintDailyCash: document.getElementById('btnPrintDailyCash'),
    cashStatTotalRevenue: document.getElementById('cashStatTotalRevenue'),
    cashStatCashTotal: document.getElementById('cashStatCashTotal'),
    cashStatPixTotal: document.getElementById('cashStatPixTotal'),
    cashStatCardTotal: document.getElementById('cashStatCardTotal'),
    cashChannelMesa: document.getElementById('cashChannelMesa'),
    cashChannelBalcao: document.getElementById('cashChannelBalcao'),
    cashChannelDelivery: document.getElementById('cashChannelDelivery'),
    cashTotalDeliveryFees: document.getElementById('cashTotalDeliveryFees'),
    couriersReportContainer: document.getElementById('couriersReportContainer'),
    btnOpenAddCourier: document.getElementById('btnOpenAddCourier'),
    adminCouriersTableBody: document.getElementById('adminCouriersTableBody'),
    courierEditModal: document.getElementById('courierEditModal'),
    courierModalTitle: document.getElementById('courierModalTitle'),
    courierEditForm: document.getElementById('courierEditForm'),
    btnCourierModalClose: document.getElementById('btnCourierModalClose'),
    btnCourierModalCancel: document.getElementById('btnCourierModalCancel'),
    editCourierId: document.getElementById('editCourierId'),
    editCourierName: document.getElementById('editCourierName'),
    editCourierPhone: document.getElementById('editCourierPhone'),
    editCourierActive: document.getElementById('editCourierActive'),
    btnOpenManualCashClose: document.getElementById('btnOpenManualCashClose'),
    cashCurrentStatusBadge: document.getElementById('cashCurrentStatusBadge'),
    cashClosingsHistoryTableBody: document.getElementById('cashClosingsHistoryTableBody'),
    manualCashCloseModal: document.getElementById('manualCashCloseModal'),
    btnManualCashCloseModalClose: document.getElementById('btnManualCashCloseModalClose'),
    btnCancelManualCashClose: document.getElementById('btnCancelManualCashClose'),
    btnConfirmManualCashClose: document.getElementById('btnConfirmManualCashClose'),
    closeModalDate: document.getElementById('closeModalDate'),
    closeModalOrdersCount: document.getElementById('closeModalOrdersCount'),
    closeModalCashTotal: document.getElementById('closeModalCashTotal'),
    closeModalPixTotal: document.getElementById('closeModalPixTotal'),
    closeModalCardTotal: document.getElementById('closeModalCardTotal'),
    closeModalDeliveryFeesTotal: document.getElementById('closeModalDeliveryFeesTotal'),
    closeModalGrandTotal: document.getElementById('closeModalGrandTotal'),
    closeModalInitialFund: document.getElementById('closeModalInitialFund'),
    closeModalCountedCash: document.getElementById('closeModalCountedCash'),
    closeModalExpectedCash: document.getElementById('closeModalExpectedCash'),
    closeModalDiffText: document.getElementById('closeModalDiffText'),
    closeModalNotes: document.getElementById('closeModalNotes'),

    // Configurações
    adminSettingsForm: document.getElementById('adminSettingsForm'),
    settingStatusMode: document.getElementById('settingStatusMode'),
    settingClosedMessage: document.getElementById('settingClosedMessage'),
    settingMinOrder: document.getElementById('settingMinOrder'),
    settingWhatsApp: document.getElementById('settingWhatsApp'),
    settingInstagram: document.getElementById('settingInstagram'),
    settingAddress: document.getElementById('settingAddress'),
    settingPixKey: document.getElementById('settingPixKey'),

    // Pedido WhatsApp Modal
    whatsappOrderModal: document.getElementById('whatsappOrderModal'),
    btnWhatsappModalClose: document.getElementById('btnWhatsappModalClose'),
    waBtnDelivery: document.getElementById('waBtnDelivery'),
    waBtnPickup: document.getElementById('waBtnPickup'),
    waCustomerName: document.getElementById('waCustomerName'),
    waCustomerPhone: document.getElementById('waCustomerPhone'),
    waDeliveryAddressSection: document.getElementById('waDeliveryAddressSection'),
    waStreet: document.getElementById('waStreet'),
    waNumber: document.getElementById('waNumber'),
    waNeighborhoodSelect: document.getElementById('waNeighborhoodSelect'),
    waComplement: document.getElementById('waComplement'),
    waReference: document.getElementById('waReference'),
    btnWaAddItem: document.getElementById('btnWaAddItem'),
    waItemsList: document.getElementById('waItemsList'),
    waItemsEmpty: document.getElementById('waItemsEmpty'),
    waSubtotalDisplay: document.getElementById('waSubtotalDisplay'),
    waDeliveryFee: document.getElementById('waDeliveryFee'),
    waPaymentMethod: document.getElementById('waPaymentMethod'),
    waChangeGroup: document.getElementById('waChangeGroup'),
    waChangeFor: document.getElementById('waChangeFor'),
    waGeneralNotes: document.getElementById('waGeneralNotes'),
    waTotalDisplay: document.getElementById('waTotalDisplay'),
    btnSubmitWhatsappOrder: document.getElementById('btnSubmitWhatsappOrder'),
    waProductPickerModal: document.getElementById('waProductPickerModal'),
    btnWaPickerClose: document.getElementById('btnWaPickerClose'),
    waPickerSearch: document.getElementById('waPickerSearch'),
    waPickerProductsList: document.getElementById('waPickerProductsList'),

    // Navegação Mobile & Áudio
    adminSidebar: document.getElementById('adminSidebar'),
    btnToggleMobileNav: document.getElementById('btnToggleMobileNav'),
    btnCloseMobileNav: document.getElementById('btnCloseMobileNav'),
    adminMobileNavBackdrop: document.getElementById('adminMobileNavBackdrop'),
    adminMobileActiveTabLabel: document.getElementById('adminMobileActiveTabLabel'),
    btnSidebarLogout: document.getElementById('btnSidebarLogout'),
    btnToggleSound: document.getElementById('btnToggleSound'),
    soundIcon: document.getElementById('soundIcon'),
    soundText: document.getElementById('soundText')
  };

  // ==========================================
  // NAVEGAÇÃO POR ABAS & MENU MOBILE (ATIVO IMEDIATAMENTE)
  // ==========================================
  function closeMobileNav() {
    if (dom.adminSidebar) dom.adminSidebar.classList.remove('mobile-open');
    if (dom.adminMobileNavBackdrop) dom.adminMobileNavBackdrop.classList.remove('active');
  }

  function openMobileNav() {
    if (dom.adminSidebar) dom.adminSidebar.classList.add('mobile-open');
    if (dom.adminMobileNavBackdrop) dom.adminMobileNavBackdrop.classList.add('active');
  }

  function switchToTab(tabId) {
    if (!tabId) return;
    adminState.activeTab = tabId;

    if (dom.tabButtons) {
      dom.tabButtons.forEach(b => {
        if (b.getAttribute('data-tab') === tabId) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });
    }

    if (dom.tabContents) {
      dom.tabContents.forEach(c => {
        c.style.display = 'none';
      });
    }

    const targetContent = document.getElementById(`tab-${tabId}`);
    if (targetContent) {
      targetContent.style.display = 'block';
    }

    if (dom.adminMobileActiveTabLabel) {
      const activeBtn = Array.from(dom.tabButtons || []).find(b => b.getAttribute('data-tab') === tabId);
      if (activeBtn) dom.adminMobileActiveTabLabel.textContent = activeBtn.textContent.trim();
    }

    closeMobileNav();

    try {
      if (tabId === 'pos' && typeof renderSalonTables === 'function') renderSalonTables();
      if (tabId === 'orders') {
        if (typeof renderOrders === 'function') renderOrders();
        // Busca dados frescos do servidor ao entrar na aba de pedidos
        if (typeof syncOrdersQuietly === 'function') syncOrdersQuietly();
      }
      if (tabId === 'dashboard' && typeof renderDashboard === 'function') renderDashboard();
      if (tabId === 'products' && typeof renderProducts === 'function') renderProducts();
      if (tabId === 'categories' && typeof renderCategories === 'function') renderCategories();
      if (tabId === 'promotions' && typeof renderPromotions === 'function') renderPromotions();
      if (tabId === 'optionals' && typeof renderOptionals === 'function') renderOptionals();
      if (tabId === 'neighborhoods' && typeof renderNeighborhoods === 'function') renderNeighborhoods();
      if (tabId === 'cash-closing' && typeof renderCashReport === 'function') renderCashReport();
      if (tabId === 'settings' && typeof populateSettingsForm === 'function') populateSettingsForm();
    } catch (e) {
      console.warn('Erro ao renderizar aba:', tabId, e);
    }
  }

  if (dom.btnToggleMobileNav) {
    dom.btnToggleMobileNav.addEventListener('click', () => {
      if (dom.adminSidebar && dom.adminSidebar.classList.contains('mobile-open')) {
        closeMobileNav();
      } else {
        openMobileNav();
      }
    });
  }

  if (dom.btnCloseMobileNav) {
    dom.btnCloseMobileNav.addEventListener('click', closeMobileNav);
  }

  if (dom.adminMobileNavBackdrop) {
    dom.adminMobileNavBackdrop.addEventListener('click', closeMobileNav);
  }

  if (dom.tabButtons) {
    dom.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        switchToTab(tabId);
      });
    });
  }

  // ==========================================
  // AUTENTICAÇÃO
  // ==========================================
  function checkAuth() {
    if (window.auth && window.auth.isAdminLoggedIn()) {
      if (dom.adminLoginModal) dom.adminLoginModal.style.display = 'none';
      if (dom.adminApp) dom.adminApp.style.display = 'flex';
      switchToTab(adminState.activeTab || 'orders');
      loadAdminData();
    } else {
      if (dom.adminLoginModal) dom.adminLoginModal.style.display = 'flex';
      if (dom.adminApp) dom.adminApp.style.display = 'none';
    }
  }

  // Executa imediatamente a checagem de autenticação
  checkAuth();

  if (dom.adminLoginForm) {
    dom.adminLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = dom.adminPasswordInput ? dom.adminPasswordInput.value.trim() : '';
      try {
        await window.auth.loginAdmin(password);
        if (dom.adminPasswordInput) dom.adminPasswordInput.value = '';
        checkAuth();
      } catch (err) {
        alert(err.message || 'Senha incorreta.');
      }
    });
  }

  const handleLogout = () => {
    window.auth.logoutAdmin();
    checkAuth();
  };

  if (dom.btnAdminLogout) dom.btnAdminLogout.addEventListener('click', handleLogout);
  if (dom.btnSidebarLogout) dom.btnSidebarLogout.addEventListener('click', handleLogout);

  // ==========================================
  // CARREGAMENTO GERAL DE DADOS
  // ==========================================
  async function loadAdminData() {
    try {
      const [bootstrap, orders] = await Promise.all([
        window.db.getBootstrap(),
        window.db.getOrders()
      ]);

      adminState.settings = bootstrap.settings || window.INITIAL_SETTINGS;
      adminState.orders = orders || [];

      // Inicializa os IDs conhecidos logo no carregamento inicial
      if (Array.isArray(orders)) {
        knownOrderIds.clear();
        orders.forEach(o => { if (o?.id) knownOrderIds.add(String(o.id)); });
        isFirstLoad = false;
      }
      adminState.products = (bootstrap.products && bootstrap.products.length > 0) ? bootstrap.products : (window.INITIAL_PRODUCTS || []);
      adminState.categories = (bootstrap.categories && bootstrap.categories.length > 0) ? bootstrap.categories : (window.INITIAL_CATEGORIES || []);
      adminState.optionals = (bootstrap.optionals && bootstrap.optionals.length > 0) ? bootstrap.optionals : (window.INITIAL_OPTIONALS || []);
      adminState.promotions = bootstrap.promotions || [];
      adminState.neighborhoods = (bootstrap.neighborhoods && bootstrap.neighborhoods.length > 0) ? bootstrap.neighborhoods : (window.INITIAL_NEIGHBORHOODS || []);
      const defaultCouriers = window.INITIAL_COURIERS || [
        { id: 'courier-1', name: 'Paulo', phone: '', is_active: true },
        { id: 'courier-2', name: 'Marcos', phone: '', is_active: true },
        { id: 'courier-3', name: 'Hernandes', phone: '', is_active: true }
      ];
      adminState.couriers = (bootstrap.couriers && bootstrap.couriers.length > 0) ? bootstrap.couriers : defaultCouriers;

      console.log(`[PizzaFrita Admin] Dados carregados com sucesso: ${adminState.products.length} produtos, ${adminState.categories.length} categorias, ${adminState.orders.length} pedidos.`);

      try { updateStatusIndicator(); } catch(e) { console.warn(e); }
      try { renderSalonTables(); } catch(e) { console.warn(e); }
      try { renderDashboard(); } catch(e) { console.warn(e); }
      try { renderOrders(); } catch(e) { console.warn(e); }
      try { renderProducts(); } catch(e) { console.warn(e); }
      try { renderCategories(); } catch(e) { console.warn(e); }
      try { renderOptionals(); } catch(e) { console.warn(e); }
      try { renderPromotions(); } catch(e) { console.warn(e); }
      try { renderNeighborhoods(); } catch(e) { console.warn(e); }
      try { renderCashReport(); } catch(e) { console.warn(e); }
      try { populateSettingsForm(); } catch(e) { console.warn(e); }
      try { populateWaNeighborhoodsSelect(); } catch(e) { console.warn(e); }
    } catch (err) {
      console.error('Erro ao carregar dados administrativos:', err);
    }
  }

  function updateStatusIndicator() {
    if (!adminState.settings) return;
    const mode = adminState.settings.store_status_mode || 'auto';
    let isOpen = false;

    if (mode === 'force_open') isOpen = true;
    else if (mode === 'force_closed') isOpen = false;
    else {
      const now = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      isOpen = mins >= (18 * 60) && mins <= (23 * 60);
    }

    if (dom.btnToggleStoreStatus) {
      dom.btnToggleStoreStatus.className = `store-status-pill ${isOpen ? 'status-open' : 'status-closed'}`;
      dom.btnToggleStoreStatus.style.borderColor = isOpen ? '#10b981' : '#ef4444';
      
      let shortLabel = isOpen ? 'Aberto' : 'Fechado';
      let fullLabel = '';
      if (mode === 'force_open') fullLabel = 'Aberto Agora (Forçado)';
      else if (mode === 'force_closed') fullLabel = 'Fechado (Forçado)';
      else fullLabel = isOpen ? 'Aberto (18h-23h)' : 'Fechado (18h-23h)';

      dom.btnToggleStoreStatus.innerHTML = `
        <span class="status-indicator-dot"></span>
        <span class="status-text-full"><i class="fi fi-sr-circle" style="color: ${isOpen ? '#10b981' : '#ef4444'}; font-size: 0.8em;"></i> ${fullLabel}</span>
        <span class="status-text-short"><i class="fi fi-sr-circle" style="color: ${isOpen ? '#10b981' : '#ef4444'}; font-size: 0.8em;"></i> ${shortLabel}</span>
      `;
    }

    if (dom.btnQuickOpenStore) {
      if (mode === 'force_open' || isOpen) {
        dom.btnQuickOpenStore.innerHTML = '<i class="fi fi-sr-check-circle"></i> Sistema Aberto (Online)';
        dom.btnQuickOpenStore.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      } else {
        dom.btnQuickOpenStore.innerHTML = '<i class="fi fi-sr-bolt"></i> Abrir Sistema Agora (Cheguei antes das 18h)';
        dom.btnQuickOpenStore.style.background = 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
      }
    }
  }

  async function openStoreImmediately() {
    try {
      const updated = await window.db.updateSettings({ store_status_mode: 'force_open' });
      adminState.settings = updated;
      updateStatusIndicator();
      populateSettingsForm();
      alert('🟢 SISTEMA ABERTO COM SUCESSO!\n\nA loja agora está ABERTA para pedidos online e no salão, mesmo antes do horário normal (18h).\n\nOs clientes já podem acessar o cardápio e finalizar pedidos!');
    } catch (err) {
      console.error('Erro ao abrir loja:', err);
      alert('Erro ao abrir o sistema. Tente novamente.');
    }
  }

  async function toggleStoreStatusModal() {
    const currentMode = adminState.settings?.store_status_mode || 'auto';
    
    if (currentMode !== 'force_open') {
      const confirmOpen = confirm('🟢 Deseja ABRIR o sistema agora para começar a receber pedidos imediatamente (mesmo antes das 17h)?');
      if (confirmOpen) {
        await openStoreImmediately();
      }
    } else {
      const opt = prompt('O sistema está ABERTO AGORA (Forçado Aberto).\n\nDigite uma opção:\n1 - Voltar para Horário Automático (Qua a Dom, 17:00 às 22:00)\n2 - Fechar Sistema Agora\n0 - Cancelar / Manter Aberto', '1');
      if (opt === '1') {
        const updated = await window.db.updateSettings({ store_status_mode: 'auto' });
        adminState.settings = updated;
        updateStatusIndicator();
        populateSettingsForm();
        alert('⏱️ Sistema configurado para Horário Automático (Qua a Dom, 17:00 às 22:00).');
      } else if (opt === '2') {
        const updated = await window.db.updateSettings({ store_status_mode: 'force_closed' });
        adminState.settings = updated;
        updateStatusIndicator();
        populateSettingsForm();
        alert('🔴 Sistema FECHADO agora.');
      }
    }
  }

  if (dom.btnToggleStoreStatus) {
    dom.btnToggleStoreStatus.addEventListener('click', toggleStoreStatusModal);
  }
  if (dom.btnQuickOpenStore) {
    dom.btnQuickOpenStore.addEventListener('click', async () => {
      const currentMode = adminState.settings?.store_status_mode || 'auto';
      if (currentMode === 'force_open') {
        await toggleStoreStatusModal();
      } else {
        await openStoreImmediately();
      }
    });
  }

  // ==========================================
  // 0. SALÃO & GESTÃO DE 10 MESAS + BALCÃO (PDV)
  // ==========================================
  function getActiveTableOrders(tableNum) {
    const num = Number(tableNum);
    const activeStatuses = ['novo', 'confirmado', 'em_preparo', 'pronto_para_retirada', 'saiu_para_entrega'];
    return adminState.orders.filter(o => {
      const orderTable = Number(o.table_number);
      const isMesa = o.order_type === 'mesa' || (!o.order_type && orderTable > 0) || orderTable === num;
      return isMesa && orderTable === num && activeStatuses.includes(o.status);
    });
  }

  function renderSalonTables() {
    if (!dom.posTablesGrid) return;
    let freeCount = 0;
    let busyCount = 0;
    let gridHtml = '';

    for (let i = 1; i <= 10; i++) {
      const activeOrders = getActiveTableOrders(i);
      const isBusy = activeOrders.length > 0;

      if (isBusy) {
        busyCount++;
        const total = activeOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        
        const allItems = [];
        activeOrders.forEach(o => {
          const its = o.items || o.order_items || [];
          its.forEach(it => allItems.push(it));
        });

        const itemsSummary = allItems.slice(0, 3).map(it => `${it.quantity}x ${it.name || it.product_name}`).join(', ') + (allItems.length > 3 ? ` +${allItems.length - 3} itens` : '');
        const firstOrder = activeOrders[activeOrders.length - 1];
        const customerName = firstOrder?.customer_name && !firstOrder.customer_name.startsWith('Mesa ') ? firstOrder.customer_name : 'Cliente no Salão';
        const openTime = firstOrder?.created_at ? new Date(firstOrder.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';

        gridHtml += `
          <div class="table-card busy">
            <div class="table-card-top">
              <span class="table-num"><i class="fi fi-sr-utensils"></i> Mesa 0${i}</span>
              <span class="table-status-tag busy"><i class="fi fi-sr-circle" style="font-size: 0.7em;"></i> Ocupada</span>
            </div>

            <div class="table-customer">
              <i class="fi fi-sr-user"></i> ${customerName} <span style="font-size: 0.75rem; color: #64748b; font-weight: normal;">• Desde ${openTime}</span>
            </div>

            <div class="table-amount">
              ${window.formatCurrency(total)}
            </div>

            <div class="table-items-summary">
              ${itemsSummary || 'Itens em preparo'}
            </div>

            <div class="table-card-actions">
              <button type="button" class="btn-ghost-secondary btn-table-add-more" data-table="${i}" style="color: #d97706; font-weight: 700; border-color: #fcd34d;">
                <i class="fi fi-sr-plus-small"></i> + Itens
              </button>
              <button type="button" class="btn-submit-order btn-table-view-bill" data-table="${i}" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                <i class="fi fi-sr-document"></i> Comanda
              </button>
            </div>
          </div>
        `;
      } else {
        freeCount++;
        gridHtml += `
          <div class="table-card free">
            <div class="table-card-top">
              <span class="table-num"><i class="fi fi-sr-utensils"></i> Mesa 0${i}</span>
              <span class="table-status-tag free"><i class="fi fi-sr-circle" style="font-size: 0.7em;"></i> Livre</span>
            </div>

            <div style="margin: 14px 0 20px; color: #64748b; font-size: 0.84rem;">
              Pronta para receber clientes
            </div>

            <div class="table-card-actions">
              <button type="button" class="btn-submit-order btn-table-open-order" data-table="${i}">
                <i class="fi fi-sr-plus-small"></i> Abrir Pedido
              </button>
            </div>
          </div>
        `;
      }
    }

    dom.posTablesGrid.innerHTML = gridHtml;
    dom.posFreeCount.textContent = freeCount;
    dom.posBusyCount.textContent = busyCount;

    dom.posTablesGrid.querySelectorAll('.btn-table-open-order').forEach(btn => {
      btn.addEventListener('click', () => {
        const tableNum = Number(btn.getAttribute('data-table'));
        openPosOrderModal({ type: 'mesa', tableNumber: tableNum });
      });
    });

    dom.posTablesGrid.querySelectorAll('.btn-table-add-more').forEach(btn => {
      btn.addEventListener('click', () => {
        const tableNum = Number(btn.getAttribute('data-table'));
        openPosOrderModal({ type: 'mesa', tableNumber: tableNum });
      });
    });

    dom.posTablesGrid.querySelectorAll('.btn-table-view-bill').forEach(btn => {
      btn.addEventListener('click', () => {
        const tableNum = Number(btn.getAttribute('data-table'));
        openTableDetailsModal(tableNum);
      });
    });
  }

  // Abertura do PDV Móvel para Mesa ou Balcão
  function openPosOrderModal({ type = 'mesa', tableNumber = 1 }) {
    adminState.posTarget = { type, tableNumber };
    adminState.posCart = [];
    adminState.posActiveCategory = 'all';
    adminState.posSearch = '';

    dom.posSearchProductInput.value = '';
    dom.posGeneralNotes.value = '';

    if (type === 'mesa') {
      const activeOrders = getActiveTableOrders(tableNumber);
      const existingName = activeOrders.find(o => o.customer_name && !o.customer_name.startsWith('Mesa '))?.customer_name || '';
      dom.posCustomerName.value = existingName;
      dom.posCustomerPhone.value = activeOrders[0]?.customer_phone || '';
      dom.posTargetBadge.innerHTML = `<i class="fi fi-sr-utensils"></i> Mesa 0${tableNumber}`;
      dom.posTargetBadge.style.background = '#d97706';
      dom.posPaymentSelect.value = 'pendente';
      dom.btnSubmitPosOrder.innerHTML = `<i class="fi fi-sr-rocket-lunch"></i> Lançar Pedido na Mesa 0${tableNumber}`;
    } else {
      dom.posCustomerName.value = '';
      dom.posCustomerPhone.value = '';
      dom.posTargetBadge.innerHTML = '<i class="fi fi-sr-shopping-bag"></i> Balcão (Viagem)';
      dom.posTargetBadge.style.background = '#8b5cf6';
      dom.posPaymentSelect.value = 'pix';
      dom.btnSubmitPosOrder.innerHTML = '<i class="fi fi-sr-shopping-bag"></i> Concluir Pedido Balcão';
    }

    renderPosCategories();
    renderPosCatalog();
    renderPosCart();

    dom.posOrderModal.style.display = 'flex';
  }

  function renderPosCategories() {
    let html = `<button type="button" class="pos-cat-chip ${adminState.posActiveCategory === 'all' ? 'active' : ''}" data-cat="all">Todas as Opções</button>`;
    
    if (adminState.promotions && adminState.promotions.length > 0) {
      html += `<button type="button" class="pos-cat-chip ${adminState.posActiveCategory === 'promos' ? 'active' : ''}" data-cat="promos">🔥 Promoções & Combos</button>`;
    }

    adminState.categories.forEach(cat => {
      html += `<button type="button" class="pos-cat-chip ${adminState.posActiveCategory === cat.id ? 'active' : ''}" data-cat="${cat.id}">${cat.name}</button>`;
    });

    dom.posCategoryFilters.innerHTML = html;

    dom.posCategoryFilters.querySelectorAll('.pos-cat-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        adminState.posActiveCategory = btn.getAttribute('data-cat');
        renderPosCategories();
        renderPosCatalog();
      });
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

  function renderPosCatalog() {
    const query = (adminState.posSearch || '').toLowerCase().trim();
    let items = [];

    if (adminState.posActiveCategory === 'all' || adminState.posActiveCategory === 'promos') {
      (adminState.promotions || []).forEach(promo => {
        if (promo.is_active !== false) {
          const effPrice = getProductEffectivePrice(promo);
          items.push({
            id: promo.id,
            name: promo.name,
            description: promo.description || 'Combo Promocional',
            price: effPrice,
            is_promo: true,
            required_quantity: promo.required_quantity || 3,
            allowed_items: promo.allowed_items || []
          });
        }
      });
    }

    (adminState.products || []).forEach(prod => {
      if (prod.is_active !== false && prod.is_available !== false) {
        if (adminState.posActiveCategory === 'all' || adminState.posActiveCategory === prod.category_id) {
          const effPrice = getProductEffectivePrice(prod);
          items.push({
            ...prod,
            price: effPrice
          });
        }
      }
    });

    if (query) {
      items = items.filter(i => (i.name || '').toLowerCase().includes(query) || (i.description || '').toLowerCase().includes(query));
    }

    if (items.length === 0) {
      dom.posProductsCatalogGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 30px; color: #64748b;">
          Nenhum item encontrado nesta categoria.
        </div>
      `;
      return;
    }

    let gridHtml = '';
    items.forEach(it => {
      const priceText = it.price !== null && it.price !== undefined ? window.formatCurrency(it.price) : 'R$ 0,00';
      gridHtml += `
        <div class="pos-prod-card" data-item-id="${it.id}" data-is-promo="${it.is_promo ? 'true' : 'false'}">
          <div class="pos-prod-name">${it.is_promo ? '🔥 ' : ''}${it.name}</div>
          <div class="pos-prod-desc">${it.description || ''}</div>
          <div class="pos-prod-bottom">
            <span class="pos-prod-price">${priceText}</span>
            <button type="button" class="pos-btn-add">
              + Adicionar
            </button>
          </div>
        </div>
      `;
    });

    dom.posProductsCatalogGrid.innerHTML = gridHtml;

    dom.posProductsCatalogGrid.querySelectorAll('.pos-prod-card').forEach(card => {
      card.addEventListener('click', () => {
        const itemId = card.getAttribute('data-item-id');
        let foundItem = (adminState.products || []).find(p => p.id === itemId) || (adminState.promotions || []).find(p => p.id === itemId);

        if (foundItem) {
          openPosItemCustomModal(foundItem);
        }
      });
    });
  }

  function isProductNaBrasa(product) {
    if (!product) return false;
    const catId = (product.category_id || '').toLowerCase();
    const cat = (adminState.categories || []).find(c => c.id === product.category_id);
    const catSlug = cat ? (cat.slug || '').toLowerCase() : '';
    const catName = cat ? (cat.name || '').toLowerCase() : '';
    const prodName = (product.name || '').toLowerCase();
    const prodDesc = (product.description || '').toLowerCase();

    return catId === 'cat-brasa' ||
           catSlug.includes('brasa') ||
           catName.includes('brasa') ||
           prodName.includes('brasa') ||
           prodDesc.includes('na brasa') ||
           prodDesc.includes('burguer na brasa');
  }

  function isProductNaChapa(product) {
    if (!product) return false;
    if (isProductNaBrasa(product)) return false;
    const catId = (product.category_id || '').toLowerCase();
    const cat = (adminState.categories || []).find(c => c.id === product.category_id);
    const catSlug = cat ? (cat.slug || '').toLowerCase() : '';
    const catName = cat ? (cat.name || '').toLowerCase() : '';
    const prodName = (product.name || '').toLowerCase();
    const prodDesc = (product.description || '').toLowerCase();

    // Excluir explicitamente categorias que não são hambúrguer
    if (catId === 'cat-bebidas' || catSlug.includes('bebida') || catName.includes('bebida')) return false;
    if (catId === 'cat-acomp' || catSlug.includes('acomp') || catName.includes('acompanha')) return false;
    if (catId === 'cat-pao' || catSlug.includes('pao') || catSlug.includes('pão') || catName.includes('pão') || catName.includes('pao') || prodName.startsWith('pão') || prodName.startsWith('pao')) return false;
    if (catId === 'cat-beirute' || catSlug.includes('beirute') || catName.includes('beirute') || prodName.includes('beirute')) return false;
    if (catId === 'cat-batata' || catSlug.includes('batata') || catName.includes('batata') || prodName.includes('batata') || prodName.includes('fritas')) return false;
    if (catId === 'cat-adic' || catSlug.includes('adic') || catName.includes('adicional')) return false;

    return catId === 'cat-burguer' ||
           catId === 'cat-burger' ||
           catId === 'cat-hamburguer' ||
           catSlug.includes('burguer') ||
           catSlug.includes('burger') ||
           catSlug.includes('hamburguer') ||
           catSlug.includes('hambúrguer') ||
           catSlug.includes('chapa') ||
           catSlug.includes('lanche') ||
           catName.includes('burguer') ||
           catName.includes('burger') ||
           catName.includes('hamburguer') ||
           catName.includes('hambúrguer') ||
           catName.includes('chapa') ||
           catName.includes('lanche') ||
           prodName.includes('burguer') ||
           prodName.includes('burger') ||
           prodName.includes('hamburguer') ||
           prodName.includes('hambúrguer') ||
           prodName.startsWith('x-') ||
           prodName.startsWith('x ') ||
           prodName.includes(' x-') ||
           prodName.includes(' x ') ||
           prodName.includes('cheddar') ||
           prodName.includes('bacon') ||
           prodDesc.includes('pão bola') ||
           prodDesc.includes('pao bola') ||
           prodDesc.includes('burguer') ||
           prodDesc.includes('burger');
  }

  function isBurgerProduct(product) {
    if (!product) return false;
    if (product.burger_type === 'none') return false;
    if (product.burger_type === 'both' || product.burger_type === 'tradicional' || product.burger_type === 'duplo') return true;
    const prodNameLower = (product.name || '').toLowerCase().trim();
    if (product.is_promo && (prodNameLower.includes('combo') || prodNameLower.includes('2 beirute') || prodNameLower.includes('promoção') || prodNameLower.includes('promocao'))) {
      return false;
    }
    return isProductNaBrasa(product) || isProductNaChapa(product);
  }

  function openPosItemCustomModal(product) {
    const matchedPromo = (adminState.promotions || []).find(p => p.id === product.promo_id || p.id === product.id || (p.name && product.name && p.name.trim().toLowerCase() === product.name.trim().toLowerCase()));
    const prodNameLower = (product.name || '').toLowerCase();
    const isCombo3Burguers = prodNameLower.includes('combo 3') || prodNameLower.includes('3 hamburguer') || prodNameLower.includes('3 hambúrguer') || (product.promo_id === 'promo-1') || (product.id === 'promo-1') || (product.id === 'prod-promo-1');
    const isPromo2Beirutes = prodNameLower.includes('2 beirute') || (product.promo_id === 'promo-2') || (product.id === 'promo-2') || (product.id === 'prod-promo-2');

    // Identificação de Tipo de Customização
    const hasCustomConfig = (Array.isArray(product.customization_options) && product.customization_options.length > 0);
    const isExplicitFlavor = product.customization_type === 'flavors';
    const isExplicitSelection = product.customization_type === 'selection';

    let isFlavor = isExplicitFlavor || (hasCustomConfig && (product.customization_max_qty === 1 || !product.customization_max_qty) && !isExplicitSelection);
    let isCombo = isExplicitSelection || (hasCustomConfig && product.customization_max_qty > 1) || isCombo3Burguers || isPromo2Beirutes || (matchedPromo && Array.isArray(matchedPromo.allowed_items) && matchedPromo.allowed_items.length > 0) || (Array.isArray(product.allowed_items) && product.allowed_items.length > 0);

    let allowedItems = [];
    let requiredQty = 1;

    if (isFlavor && hasCustomConfig) {
      allowedItems = product.customization_options;
      requiredQty = 1;
    } else if (isCombo) {
      if (hasCustomConfig) {
        allowedItems = product.customization_options;
        requiredQty = Number(product.customization_max_qty) || 3;
      } else if (matchedPromo && Array.isArray(matchedPromo.allowed_items) && matchedPromo.allowed_items.length > 0) {
        allowedItems = matchedPromo.allowed_items;
        requiredQty = matchedPromo.required_quantity || (isPromo2Beirutes ? 2 : 3);
      } else if (Array.isArray(product.allowed_items) && product.allowed_items.length > 0) {
        allowedItems = product.allowed_items;
        requiredQty = product.required_quantity || (isPromo2Beirutes ? 2 : 3);
      } else if (isPromo2Beirutes) {
        allowedItems = ['1 Beirute Maminha', '1 Beirute Sol', '1 Beirute Camarão 3 Queijos'];
        requiredQty = 2;
      } else if (isCombo3Burguers) {
        allowedItems = ['Burguer Calabresa e Coalho', 'Burguer Cheddar e Bacon', 'Burguer Creme Cheese'];
        requiredQty = 3;
      }
    }

    const isPromo = Boolean(product.is_promo || isCombo);
    const originalBasePrice = getProductEffectivePrice(product);
    const isBurger = !isCombo && !isFlavor && isBurgerProduct(product);

    adminState.posCustomItemState = {
      product,
      isPromo,
      isCombo,
      isFlavor,
      isBurger,
      allowedItems,
      requiredQty,
      originalBasePrice,
      basePrice: originalBasePrice,
      qty: 1,
      selectedOptionals: [],
      selectedFlavor: isFlavor && allowedItems.length > 0 ? allowedItems[0] : '',
      comboChoices: {},
      notes: '',
      burgerVersion: 'tradicional'
    };

    if (isCombo) {
      allowedItems.forEach(item => {
        adminState.posCustomItemState.comboChoices[item] = 0;
      });
    }

    dom.posCustomItemTitle.textContent = `${isPromo ? '🔥 ' : ''}${product.name}`;
    dom.posCustomItemDescription.textContent = product.description || '';
    dom.posCustomItemBasePrice.textContent = window.formatCurrency(originalBasePrice);
    dom.posCustomItemNotes.value = '';
    dom.posCustomItemQty.textContent = '1';

    // Seção de Sabores Únicos (ex: Sucos)
    if (isFlavor && allowedItems.length > 0) {
      if (dom.posCustomFlavorSection) {
        dom.posCustomFlavorSection.style.display = 'block';
        if (dom.posCustomFlavorTitle) {
          dom.posCustomFlavorTitle.textContent = product.customization_label || 'Escolha o Sabor:';
        }
        let flavorHtml = '';
        allowedItems.forEach((flv, idx) => {
          const isChecked = idx === 0;
          flavorHtml += `
            <label style="display: flex; align-items: center; justify-content: space-between; background: ${isChecked ? '#dcfce7' : '#ffffff'}; border: 1px solid ${isChecked ? '#86efac' : '#cbd5e1'}; border-radius: 8px; padding: 8px 12px; cursor: pointer; font-size: 0.88rem; font-weight: 700; color: #1e293b;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <input type="radio" name="posCustomFlavorRadio" value="${window.escapeHtml(flv)}" ${isChecked ? 'checked' : ''} style="accent-color: #16a34a;" />
                <span>${window.escapeHtml(flv)}</span>
              </div>
            </label>
          `;
        });
        dom.posCustomFlavorChoices.innerHTML = flavorHtml;

        dom.posCustomFlavorChoices.querySelectorAll('input[name="posCustomFlavorRadio"]').forEach(r => {
          r.onchange = () => {
            adminState.posCustomItemState.selectedFlavor = r.value;
            dom.posCustomFlavorChoices.querySelectorAll('label').forEach(lbl => {
              const radio = lbl.querySelector('input');
              if (radio && radio.checked) {
                lbl.style.background = '#dcfce7';
                lbl.style.borderColor = '#86efac';
              } else {
                lbl.style.background = '#ffffff';
                lbl.style.borderColor = '#cbd5e1';
              }
            });
          };
        });
      }
    } else {
      if (dom.posCustomFlavorSection) dom.posCustomFlavorSection.style.display = 'none';
    }

    // Seção versão hambúrguer (Tradicional vs Duplo +R$ 5)
    const burgerType = product.burger_type || (isBurger ? 'both' : 'none');
    const allowBurgerSizeChoice = (burgerType === 'both');
    const burgerSizeSection = document.getElementById('posCustomBurgerSizeSection');
    if (burgerSizeSection) {
      if (allowBurgerSizeChoice) {
        burgerSizeSection.style.display = 'block';
        const radios = burgerSizeSection.querySelectorAll('input[name="posBurgerSize"]');
        const labels = burgerSizeSection.querySelectorAll('label');

        const updateRadioVisual = (val) => {
          labels.forEach(lbl => {
            const radio = lbl.querySelector('input');
            if (radio && radio.value === val) {
              lbl.style.borderColor = '#ec4899';
              lbl.style.background = '#fdf2f8';
              lbl.style.color = '#831843';
            } else {
              lbl.style.borderColor = '#cbd5e1';
              lbl.style.background = '#ffffff';
              lbl.style.color = '#334155';
            }
          });
        };

        radios.forEach(r => {
          r.checked = r.value === 'tradicional';
        });
        updateRadioVisual('tradicional');
        adminState.posCustomItemState.burgerVersion = 'tradicional';

        radios.forEach(r => {
          r.onchange = () => {
            adminState.posCustomItemState.burgerVersion = r.value;
            adminState.posCustomItemState.basePrice = originalBasePrice + (r.value === 'duplo' ? 5 : 0);
            updateRadioVisual(r.value);
            updateCustomSubtotal();
          };
        });
      } else {
        burgerSizeSection.style.display = 'none';
        if (burgerType === 'duplo') {
          adminState.posCustomItemState.burgerVersion = 'duplo';
        } else if (burgerType === 'tradicional') {
          adminState.posCustomItemState.burgerVersion = 'tradicional';
        } else {
          adminState.posCustomItemState.burgerVersion = null;
        }
      }
    }

    // Seção de Seleção de Sabores do Combo / Múltipla Escolha
    if (isCombo && allowedItems.length > 0) {
      dom.posCustomComboSection.style.display = 'block';
      if (dom.posCustomComboTitle) {
        dom.posCustomComboTitle.textContent = product.customization_label || `Escolha os ${requiredQty} itens da promoção:`;
      }
      let comboHtml = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h4 style="font-size: 0.88rem; font-weight: 700; color: #92400e; margin: 0;">${window.escapeHtml(product.customization_label || `Escolha os ${requiredQty} itens:`)}</h4>
          <span id="posComboCounterBadge" style="font-size: 0.8rem; font-weight: 800; background: #fef3c7; color: #b45309; padding: 2px 8px; border-radius: 9999px; border: 1px solid #fde68a;">0/${requiredQty}</span>
        </div>
      `;
      
      allowedItems.forEach(allowedName => {
        comboHtml += `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 4px; border-bottom: 1px dashed #fde68a;">
            <span style="font-size: 0.85rem; font-weight: 600; color: #1e293b;">${window.escapeHtml(allowedName)}</span>
            <div style="display: flex; align-items: center; gap: 8px;">
              <button type="button" class="btn-qty-step btn-combo-minus" data-name="${window.escapeHtml(allowedName)}">-</button>
              <span class="combo-qty-count" data-name="${window.escapeHtml(allowedName)}" style="font-weight: 800; font-size: 0.95rem; width: 22px; text-align: center; color: #0f172a;">0</span>
              <button type="button" class="btn-qty-step btn-combo-plus" data-name="${window.escapeHtml(allowedName)}">+</button>
            </div>
          </div>
        `;
      });
      dom.posCustomComboChoices.innerHTML = comboHtml;

      dom.posCustomComboChoices.querySelectorAll('.btn-combo-plus').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const name = btn.getAttribute('data-name');
          const currentTotal = Object.values(adminState.posCustomItemState.comboChoices).reduce((a, b) => a + b, 0);
          if (currentTotal < requiredQty) {
            adminState.posCustomItemState.comboChoices[name] = (adminState.posCustomItemState.comboChoices[name] || 0) + 1;
            updateComboUI();
          }
        });
      });

      dom.posCustomComboChoices.querySelectorAll('.btn-combo-minus').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const name = btn.getAttribute('data-name');
          if (adminState.posCustomItemState.comboChoices[name] > 0) {
            adminState.posCustomItemState.comboChoices[name]--;
            updateComboUI();
          }
        });
      });
    } else {
      dom.posCustomComboSection.style.display = 'none';
    }

    let optHtml = '';
    const isBrasa = isProductNaBrasa(product);
    const isChapa = isProductNaChapa(product);
    const isBurguerItem = isBrasa || isChapa;
    const productCategoryId = product.category_id || '';

    const activeOptionals = (adminState.optionals || []).filter(opt => {
      if (opt.is_active === false) return false;
      const optName = (opt.name || '').toLowerCase();
      const target = (opt.target || 'all').toLowerCase();

      // 1. Verificação por categoria específica personalizada
      if (target === 'custom' && Array.isArray(opt.applicable_category_ids) && opt.applicable_category_ids.length > 0) {
        return opt.applicable_category_ids.includes(productCategoryId);
      }
      
      // 2. Exibe para todas as categorias
      if (target === 'all_categories') return true;

      // 3. Específico de Brasa
      if (target === 'brasa' || optName.includes('brasa')) {
        return isBrasa;
      }

      // 4. Específico de Chapa
      if (target === 'chapa' || optName.includes('chapa')) {
        return isChapa;
      }

      // 5. Adicionais gerais de Hambúrguer (target 'all' ou padrão)
      return isBurguerItem;
    });

    if (!isCombo && activeOptionals.length > 0) {
      dom.posCustomOptionalsSection.style.display = 'block';
      activeOptionals.forEach(opt => {
        const optPrice = Number(opt.price) || 0;
        optHtml += `
          <label style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; cursor: pointer;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="checkbox" class="pos-optional-check" data-id="${opt.id}" data-name="${opt.name}" data-price="${optPrice}" />
              <span style="font-size: 0.85rem; font-weight: 600;">${opt.name}</span>
            </div>
            <span style="font-size: 0.82rem; font-weight: 800; color: #d97706;">+ ${window.formatCurrency(optPrice)}</span>
          </label>
        `;
      });
      dom.posCustomOptionalsList.innerHTML = optHtml;

      dom.posCustomOptionalsList.querySelectorAll('.pos-optional-check').forEach(chk => {
        chk.addEventListener('change', () => {
          updateCustomSubtotal();
        });
      });
    } else {
      dom.posCustomOptionalsSection.style.display = 'none';
    }

    updateCustomSubtotal();
    dom.posItemCustomModal.style.display = 'flex';
  }

  function updateComboUI() {
    if (!adminState.posCustomItemState) return;
    const reqQty = adminState.posCustomItemState.requiredQty || 3;
    const choices = adminState.posCustomItemState.comboChoices || {};
    const currentTotal = Object.values(choices).reduce((a, b) => a + b, 0);

    dom.posCustomComboChoices.querySelectorAll('.combo-qty-count').forEach(span => {
      const name = span.getAttribute('data-name');
      span.textContent = choices[name] || 0;
    });

    const badge = document.getElementById('posComboCounterBadge');
    if (badge) {
      badge.textContent = `${currentTotal}/${reqQty}`;
      if (currentTotal === reqQty) {
        badge.style.background = '#dcfce7';
        badge.style.color = '#15803d';
        badge.style.borderColor = '#86efac';
      } else {
        badge.style.background = '#fef3c7';
        badge.style.color = '#b45309';
        badge.style.borderColor = '#fde68a';
      }
    }
  }

  function updateCustomSubtotal() {
    if (!adminState.posCustomItemState) return;
    const base = adminState.posCustomItemState.basePrice;
    
    let extra = 0;
    const checkedOpts = [];
    dom.posCustomOptionalsList.querySelectorAll('.pos-optional-check:checked').forEach(chk => {
      const price = Number(chk.getAttribute('data-price')) || 0;
      const name = chk.getAttribute('data-name');
      const id = chk.getAttribute('data-id');
      extra += price;
      checkedOpts.push({ id, name, price });
    });

    adminState.posCustomItemState.selectedOptionals = checkedOpts;
    const unitTotal = base + extra;
    const grandTotal = unitTotal * adminState.posCustomItemState.qty;

    dom.posCustomItemSubtotal.textContent = window.formatCurrency(grandTotal);
  }

  if (dom.btnPosCustomQtyMinus) {
    dom.btnPosCustomQtyMinus.addEventListener('click', () => {
      if (adminState.posCustomItemState && adminState.posCustomItemState.qty > 1) {
        adminState.posCustomItemState.qty--;
        if (dom.posCustomItemQty) dom.posCustomItemQty.textContent = adminState.posCustomItemState.qty;
        updateCustomSubtotal();
      }
    });
  }

  if (dom.btnPosCustomQtyPlus) {
    dom.btnPosCustomQtyPlus.addEventListener('click', () => {
      if (adminState.posCustomItemState) {
        adminState.posCustomItemState.qty++;
        if (dom.posCustomItemQty) dom.posCustomItemQty.textContent = adminState.posCustomItemState.qty;
        updateCustomSubtotal();
      }
    });
  }

  if (dom.btnConfirmCustomItem) {
    dom.btnConfirmCustomItem.addEventListener('click', () => {
      if (!adminState.posCustomItemState) return;

      const { product, isPromo, isCombo, isFlavor, isBurger, basePrice, qty, selectedOptionals, burgerVersion, requiredQty, selectedFlavor } = adminState.posCustomItemState;
      const notes = dom.posCustomItemNotes ? dom.posCustomItemNotes.value.trim() : '';

      if (isFlavor && !selectedFlavor) {
        alert('Por favor, selecione um sabor antes de adicionar.');
        return;
      }

      let comboChoicesList = [];
      if (isCombo) {
        const reqQty = requiredQty || 3;
        const totalSelected = Object.values(adminState.posCustomItemState.comboChoices || {}).reduce((a, b) => a + b, 0);
        if (totalSelected < reqQty) {
          alert(`Por favor, selecione os ${reqQty} itens da promoção antes de adicionar. (Selecionados: ${totalSelected}/${reqQty})`);
          return;
        }
        comboChoicesList = Object.entries(adminState.posCustomItemState.comboChoices)
          .filter(([_, count]) => count > 0)
          .map(([name, count]) => ({
            name,
            qty: count
          }));
      }

      const extraPrice = selectedOptionals.reduce((sum, o) => sum + o.price, 0);
      const unitPrice = basePrice + extraPrice;

      // Nome e versão do hambúrguer
      const isBurgerItem = Boolean(isBurger);
      const selectedVersion = isBurgerItem ? (burgerVersion || 'tradicional') : null;
      const versionLabel = isBurgerItem && selectedVersion === 'duplo' ? ' (Duplo)' : '';
      const finalName = product.name + versionLabel;

      addItemToPosCart({
        id: product.id,
        name: finalName,
        price: unitPrice,
        quantity: qty,
        subtotal: unitPrice * qty,
        optionals: selectedOptionals,
        notes: notes,
        is_combo: isCombo || isPromo,
        combo_choices: comboChoicesList,
        flavor: isFlavor ? selectedFlavor : null,
        burger_version: selectedVersion
      });

      if (dom.posItemCustomModal) dom.posItemCustomModal.style.display = 'none';
    });
  }

  if (dom.btnPosCustomItemClose) {
    dom.btnPosCustomItemClose.addEventListener('click', () => {
      if (dom.posItemCustomModal) dom.posItemCustomModal.style.display = 'none';
    });
  }

  function addItemToPosCart(item) {
    const optKey = (item.optionals || []).map(o => o.name).sort().join('|');
    const comboKey = (item.combo_choices || []).map(c => `${c.qty}x${c.name}`).sort().join('|');
    const versionKey = item.burger_version || 'tradicional';
    const flavorKey = item.flavor || '';
    const fullKey = `${item.id}_${versionKey}_${flavorKey}_${item.notes || ''}_${optKey}_${comboKey}`;

    const existingIndex = adminState.posCart.findIndex(cartIt => {
      const cOptKey = (cartIt.optionals || []).map(o => o.name).sort().join('|');
      const cComboKey = (cartIt.combo_choices || []).map(c => `${c.qty}x${c.name}`).sort().join('|');
      const cVersionKey = cartIt.burger_version || 'tradicional';
      const cFlavorKey = cartIt.flavor || '';
      const cFullKey = `${cartIt.id}_${cVersionKey}_${cFlavorKey}_${cartIt.notes || ''}_${cOptKey}_${cComboKey}`;
      return cFullKey === fullKey;
    });

    if (existingIndex > -1) {
      adminState.posCart[existingIndex].quantity += item.quantity;
      adminState.posCart[existingIndex].subtotal = adminState.posCart[existingIndex].quantity * adminState.posCart[existingIndex].price;
    } else {
      adminState.posCart.push({ ...item });
    }

    renderPosCart();
  }

  function renderPosCart() {
    if (adminState.posCart.length === 0) {
      dom.posCartItemsList.innerHTML = `
        <div class="pos-cart-empty">
          <span>Nenhum item adicionado</span>
          <p style="font-size: 0.8rem; color: #94a3b8; margin-top: 4px;">Toque nos produtos ao lado para incluir na comanda.</p>
        </div>
      `;
      dom.posCartTotalValue.textContent = 'R$ 0,00';
      return;
    }

    let html = '';
    let total = 0;

    adminState.posCart.forEach((item, index) => {
      total += item.subtotal;
      let detailsHtml = '';

      if (item.flavor) {
        detailsHtml += `<div style="color: #166534; font-weight: 800;">🥤 Sabor: ${window.escapeHtml(item.flavor.toUpperCase())}</div>`;
      }
      if (item.combo_choices && item.combo_choices.length > 0) {
        detailsHtml += `<div style="color: #92400e; font-weight: 700;">🍔 Escolhas: ${item.combo_choices.map(c => `${c.qty}x ${window.escapeHtml(c.name)}`).join(', ')}</div>`;
      }
      if (item.burger_version === 'duplo') {
        detailsHtml += `<div style="color: #ec4899; font-weight: 800;">🍔 Versão: DUPLO (+ R$ 5,00)</div>`;
      }
      if (item.optionals && item.optionals.length > 0) {
        detailsHtml += `<div>+ ${item.optionals.map(o => window.escapeHtml(o.name)).join(', ')}</div>`;
      }
      if (item.notes) {
        detailsHtml += `<div style="color: #d97706;">Obs: ${window.escapeHtml(item.notes)}</div>`;
      }

      html += `
        <div class="pos-cart-item">
          <div class="pos-cart-item-top">
            <span class="pos-cart-item-name">${window.escapeHtml(item.name)}</span>
            <span class="pos-cart-item-subtotal">${window.formatCurrency(item.subtotal)}</span>
          </div>

          ${detailsHtml ? `<div class="pos-cart-item-details">${detailsHtml}</div>` : ''}

          <div class="pos-cart-item-ctrls">
            <div style="display: flex; align-items: center; gap: 8px;">
              <button type="button" class="btn-qty-step btn-pos-cart-minus" data-idx="${index}">-</button>
              <span style="font-weight: 800; font-size: 0.9rem; width: 20px; text-align: center;">${item.quantity}</span>
              <button type="button" class="btn-qty-step btn-pos-cart-plus" data-idx="${index}">+</button>
            </div>
            <button type="button" class="btn-pos-cart-remove" data-idx="${index}" style="background: none; border: none; color: #ef4444; font-size: 0.8rem; cursor: pointer;">
              🗑️ Remover
            </button>
          </div>
        </div>
      `;
    });

    dom.posCartItemsList.innerHTML = html;
    dom.posCartTotalValue.textContent = window.formatCurrency(total);

    dom.posCartItemsList.querySelectorAll('.btn-pos-cart-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-idx'));
        adminState.posCart[idx].quantity++;
        adminState.posCart[idx].subtotal = adminState.posCart[idx].quantity * adminState.posCart[idx].price;
        renderPosCart();
      });
    });

    dom.posCartItemsList.querySelectorAll('.btn-pos-cart-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-idx'));
        if (adminState.posCart[idx].quantity > 1) {
          adminState.posCart[idx].quantity--;
          adminState.posCart[idx].subtotal = adminState.posCart[idx].quantity * adminState.posCart[idx].price;
        } else {
          adminState.posCart.splice(idx, 1);
        }
        renderPosCart();
      });
    });

    dom.posCartItemsList.querySelectorAll('.btn-pos-cart-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-idx'));
        adminState.posCart.splice(idx, 1);
        renderPosCart();
      });
    });
  }

  if (dom.btnPosClearCart) {
    dom.btnPosClearCart.addEventListener('click', () => {
      adminState.posCart = [];
      renderPosCart();
    });
  }

  if (dom.posSearchProductInput) {
    dom.posSearchProductInput.addEventListener('input', (e) => {
      adminState.posSearch = e.target.value;
      renderPosCatalog();
    });
  }

  // Envio / Lançamento do Pedido no PDV
  if (dom.btnSubmitPosOrder) {
    dom.btnSubmitPosOrder.addEventListener('click', async () => {
      if (adminState.posCart.length === 0) {
        alert('Por favor, adicione ao menos um item ao pedido.');
        return;
      }

      const { type, tableNumber } = adminState.posTarget;
      let customerName = dom.posCustomerName ? dom.posCustomerName.value.trim() : '';
      const customerPhone = (dom.posCustomerPhone ? dom.posCustomerPhone.value.trim() : '') || '0000000000';
      const generalNotes = dom.posGeneralNotes ? dom.posGeneralNotes.value.trim() : '';
      const paymentMethod = dom.posPaymentSelect ? dom.posPaymentSelect.value : 'pix';

      if (!customerName) {
        customerName = type === 'mesa' ? `Mesa 0${tableNumber}` : 'Cliente Balcão';
      }

      const subtotal = adminState.posCart.reduce((sum, it) => sum + it.subtotal, 0);

      const orderPayload = {
        customer_name: customerName,
        customer_phone: customerPhone,
        order_type: type,
        table_number: type === 'mesa' ? tableNumber : null,
        payment_method: paymentMethod,
        subtotal: subtotal,
        delivery_fee: 0.00,
        total: subtotal,
        notes: generalNotes,
        status: 'novo',
        whatsapp_sent: false,
        items: adminState.posCart
      };

      dom.btnSubmitPosOrder.disabled = true;
      dom.btnSubmitPosOrder.textContent = '⏳ Gravando pedido...';

      try {
        await window.db.createOrder(orderPayload);
        if (dom.posOrderModal) dom.posOrderModal.style.display = 'none';
        adminState.posCart = [];
        
        adminState.orders = await window.db.getOrders();
        renderSalonTables();
        renderOrders();
        renderDashboard();
        renderCashReport();

        alert(`✅ Pedido lançado com sucesso ${type === 'mesa' ? `na Mesa 0${tableNumber}` : 'no Balcão'}!`);
      } catch (err) {
        console.error('Erro ao lançar pedido PDV:', err);
        alert('Houve um erro ao lançar o pedido. Tente novamente.');
      } finally {
        dom.btnSubmitPosOrder.disabled = false;
      }
    });
  }

  if (dom.btnPosModalClose) {
    dom.btnPosModalClose.addEventListener('click', () => {
      if (dom.posOrderModal) dom.posOrderModal.style.display = 'none';
    });
  }

  // Modal de Detalhes da Mesa & Fechamento de Conta
  function openTableDetailsModal(tableNum) {
    adminState.activeTableDetailsNum = tableNum;
    const activeOrders = getActiveTableOrders(tableNum);

    if (dom.tableDetailsTitle) dom.tableDetailsTitle.textContent = `Comanda — Mesa 0${tableNum}`;
    
    if (activeOrders.length === 0) {
      alert(`A Mesa 0${tableNum} está livre no momento.`);
      return;
    }

    const firstOrder = activeOrders[activeOrders.length - 1];
    const customerName = firstOrder?.customer_name && !firstOrder.customer_name.startsWith('Mesa ') ? firstOrder.customer_name : 'Cliente no Salão';
    const openTime = firstOrder?.created_at ? new Date(firstOrder.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
    
    if (dom.tableDetailsCustomer) dom.tableDetailsCustomer.textContent = customerName;
    if (dom.tableDetailsTime) dom.tableDetailsTime.textContent = openTime;
    if (dom.tableDetailsOrdersCount) dom.tableDetailsOrdersCount.textContent = `${activeOrders.length} pedido(s) / rodada(s)`;

    let itemsHtml = '';
    let grandTotal = 0;

    activeOrders.forEach((order, ordIdx) => {
      const ordTime = order.created_at ? new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
      itemsHtml += `
        <tr style="background: #f8fafc; font-weight: 700; border-top: 2px solid #e2e8f0;">
          <td colspan="2" style="font-size: 0.8rem; color: #64748b;">
            Rodada #${ordIdx + 1} (Pedido #${String(order.order_number).padStart(4, '0')}) • ${ordTime} • <span class="order-type-badge mesa" style="padding: 1px 6px;">${window.escapeHtml(order.status)}</span>
          </td>
        </tr>
      `;

      const orderItems = order.items || order.order_items || [];
      orderItems.forEach(it => {
        grandTotal += Number(it.subtotal) || 0;
        let itNotes = '';
        if (it.flavor || it.custom_flavor) {
          itNotes += `🥤 Sabor: ${window.escapeHtml((it.flavor || it.custom_flavor).toUpperCase())} `;
        }
        if (it.combo_choices && it.combo_choices.length > 0) {
          itNotes += `🍔 Escolhas: ${it.combo_choices.map(c => `${c.qty}x ${window.escapeHtml(c.name)}`).join(', ')} `;
        }
        if (it.optionals && it.optionals.length > 0) {
          itNotes += `+ ${it.optionals.map(o => window.escapeHtml(o.name)).join(', ')} `;
        }
        if (it.notes) {
          itNotes += `Obs: ${window.escapeHtml(it.notes)}`;
        }

        itemsHtml += `
          <tr>
            <td>
              <strong>${it.quantity}x</strong> ${window.escapeHtml(it.name || it.product_name)}
              ${itNotes ? `<div style="font-size: 0.75rem; color: #64748b;">${itNotes}</div>` : ''}
            </td>
            <td style="text-align: right; font-weight: 700;">${window.formatCurrency(it.subtotal)}</td>
          </tr>
        `;
      });
    });

    if (dom.tableDetailsItemsBody) dom.tableDetailsItemsBody.innerHTML = itemsHtml;
    if (dom.tableDetailsGrandTotal) dom.tableDetailsGrandTotal.textContent = window.formatCurrency(grandTotal);

    if (dom.tableDetailsModal) dom.tableDetailsModal.style.display = 'flex';
  }

  if (dom.btnTableDetailsClose) {
    dom.btnTableDetailsClose.addEventListener('click', () => {
      if (dom.tableDetailsModal) dom.tableDetailsModal.style.display = 'none';
    });
  }

  if (dom.btnTableAddMoreItems) {
    dom.btnTableAddMoreItems.addEventListener('click', () => {
      if (dom.tableDetailsModal) dom.tableDetailsModal.style.display = 'none';
      if (adminState.activeTableDetailsNum) {
        openPosOrderModal({ type: 'mesa', tableNumber: adminState.activeTableDetailsNum });
      }
    });
  }

  if (dom.btnTablePrintBill) {
    dom.btnTablePrintBill.addEventListener('click', () => {
      if (!adminState.activeTableDetailsNum) return;
      const tableNum = adminState.activeTableDetailsNum;
      const activeOrders = getActiveTableOrders(tableNum);
      if (activeOrders.length === 0) return;

      const printWin = window.open('', '_blank', 'width=320,height=400');
      let itemsRowsStr = '';
      let total = 0;

      activeOrders.forEach(o => {
        const orderItems = o.items || o.order_items || [];
        orderItems.forEach(it => {
          total += Number(it.subtotal) || 0;
          itemsRowsStr += `<div class="item-line">${it.quantity}x <strong>${window.escapeHtml(it.name || it.product_name)}</strong> - ${window.formatCurrency(it.subtotal)}</div>`;
          if (it.flavor || it.custom_flavor) {
            itemsRowsStr += `<div class="item-detail"><strong>🥤 SABOR: ${window.escapeHtml((it.flavor || it.custom_flavor).toUpperCase())}</strong></div>`;
          }
          if (it.combo_choices && it.combo_choices.length > 0) {
            itemsRowsStr += `<div class="item-detail"><strong>🍔 ESCOLHAS: ${it.combo_choices.map(c => `${c.qty}x ${window.escapeHtml(c.name)}`).join(', ')}</strong></div>`;
          }
          if (it.optionals && it.optionals.length > 0) {
            itemsRowsStr += `<div class="item-detail"><strong>+ ${it.optionals.map(op => window.escapeHtml(op.name)).join(', ')}</strong></div>`;
          }
          if (it.notes) {
            itemsRowsStr += `<div class="item-obs"><strong>*** OBS: ${window.escapeHtml(it.notes)} ***</strong></div>`;
          }
        });
      });

      printWin.document.write(`
        <html>
          <head>
            <title>Prévia da Conta - Mesa ${tableNum}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; text-align: center !important; }
              html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; background: #fff; text-align: center !important; }
              .ticket-wrapper {
                font-family: Arial, Helvetica, 'Segoe UI', 'Courier New', sans-serif;
                font-size: 15px;
                font-weight: 900;
                color: #000;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 auto !important;
                padding: 4px 7mm 24px 7mm !important;
                word-break: break-word;
                line-height: 1.3;
                text-align: center !important;
                box-sizing: border-box !important;
              }
              h2 { font-size: 20px; font-weight: 900; text-align: center !important; margin: 2px 0; letter-spacing: 0.5px; }
              h3 { font-size: 17px; font-weight: 900; text-align: center !important; margin: 2px 0; }
              hr { border: none; border-top: 2px dashed #000; margin: 5px auto; width: 100%; }
              .data { text-align: center !important; font-size: 13px; font-weight: 900; margin: 2px 0; }
              .item-line { font-size: 16px; font-weight: 900; margin: 5px 0 2px 0; text-align: center !important; }
              .item-detail { font-size: 14px; font-weight: 900; margin: 2px 0; text-align: center !important; }
              .item-obs { font-size: 14px; font-weight: 900; padding: 3px 4px; margin: 3px auto; background: #eee; border: 2px solid #000; text-align: center !important; display: block; }
              .total-line { font-size: 18px; font-weight: 900; text-align: center !important; margin-top: 6px; }
              .obrigado { text-align: center !important; font-size: 14px; font-weight: 900; margin-top: 8px; }
              @media print {
                @page { margin: 0; size: auto; }
                html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; text-align: center !important; }
                .ticket-wrapper {
                  width: 100% !important;
                  max-width: 100% !important;
                  margin: 0 auto !important;
                  padding: 4px 7mm 24px 7mm !important;
                  text-align: center !important;
                  box-sizing: border-box !important;
                }
              }
            </style>
          </head>
          <body>
            <div class="ticket-wrapper">
              <h2>PIZZA FRITA DO CH</h2>
              <h3>CONTA — MESA 0${tableNum}</h3>
              <div class="data">${new Date().toLocaleString('pt-BR')}</div>
              <hr />
              ${itemsRowsStr}
              <hr />
              <div class="total-line">TOTAL: ${window.formatCurrency(total)}</div>
              <div class="obrigado">Obrigado pela preferência!</div>
            </div>
          </body>
        </html>
      `);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => { printWin.print(); printWin.close(); }, 300);
    });
  }

  if (dom.btnTableCloseBill) {
    dom.btnTableCloseBill.addEventListener('click', async () => {
      if (!adminState.activeTableDetailsNum) return;
      const tableNum = adminState.activeTableDetailsNum;
      const payment = dom.tableClosePaymentMethod ? dom.tableClosePaymentMethod.value : 'pix';
      
      if (confirm(`Deseja confirmar o fechamento da conta da Mesa 0${tableNum} com pagamento em ${payment.toUpperCase()} e liberar a mesa?`)) {
        dom.btnTableCloseBill.disabled = true;
        dom.btnTableCloseBill.textContent = 'Fechando mesa...';

        try {
          await window.db.closeTable(tableNum, payment);
          if (dom.tableDetailsModal) dom.tableDetailsModal.style.display = 'none';
          adminState.orders = await window.db.getOrders();
          renderSalonTables();
          renderOrders();
          renderDashboard();
          renderCashReport();
          alert(`✅ Mesa 0${tableNum} finalizada e liberada com sucesso!`);
        } catch (err) {
          console.error('Erro ao fechar mesa:', err);
          alert('Erro ao fechar a mesa. Tente novamente.');
        } finally {
          dom.btnTableCloseBill.disabled = false;
          dom.btnTableCloseBill.textContent = '✅ Receber e Liberar Mesa';
        }
      }
    });
  }

  if (dom.btnOpenBalcaoPos) {
    dom.btnOpenBalcaoPos.addEventListener('click', () => {
      openPosOrderModal({ type: 'balcao' });
    });
  }

  if (dom.btnQuickPos) {
    dom.btnQuickPos.addEventListener('click', () => {
      openPosOrderModal({ type: 'balcao' });
    });
  }

  if (dom.btnRefreshPos) {
    dom.btnRefreshPos.addEventListener('click', async () => {
      adminState.orders = await window.db.getOrders();
      renderSalonTables();
      renderOrders();
    });
  }

  // ==========================================
  // 1. DASHBOARD & MÉTRICAS
  // ==========================================
  function renderDashboard() {
    const todayStr = getBusinessDateString(new Date());
    const todayOrders = adminState.orders.filter(o => getBusinessDateString(o.created_at) === todayStr);
    
    const todayRevenue = todayOrders
      .filter(o => o.status === 'finalizado')
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const ongoingStatuses = ['novo', 'confirmado', 'em_preparo', 'saiu_para_entrega', 'pronto_para_retirada'];
    const ongoingOrders = adminState.orders.filter(o => ongoingStatuses.includes(o.status));

    const validOrdersCount = todayOrders.filter(o => o.status === 'finalizado').length;
    const avgTicket = validOrdersCount > 0 ? (todayRevenue / validOrdersCount) : 0;

    dom.statOrdersToday.textContent = todayOrders.length;
    dom.statRevenueToday.textContent = window.formatCurrency(todayRevenue);
    dom.statOrdersOngoing.textContent = ongoingOrders.length;
    dom.statAverageTicket.textContent = window.formatCurrency(avgTicket);

    const productCounts = {};
    adminState.orders.forEach(order => {
      if (order.status === 'finalizado') {
        const orderItems = order.items || order.order_items || [];
        orderItems.forEach(item => {
          const name = item.name || item.product_name || 'Produto';
          productCounts[name] = (productCounts[name] || 0) + (item.quantity || 1);
        });
      }
    });

    const sortedProducts = Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (sortedProducts.length === 0) {
      dom.topProductsList.innerHTML = '<p style="font-size: 0.85rem; color: var(--text-muted);">Nenhum pedido finalizado ainda.</p>';
    } else {
      let topHtml = '<div style="display: flex; flex-direction: column; gap: 8px;">';
      sortedProducts.forEach(([name, count], index) => {
        topHtml += `
          <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 0.9rem; font-weight: 700; color: #fff;">
              <span style="color: var(--primary-yellow); margin-right: 8px;">#${index + 1}</span> ${name}
            </div>
            <div style="font-size: 0.85rem; font-weight: 800; color: var(--primary-yellow); background: var(--bg-card); padding: 4px 10px; border-radius: var(--radius-full);">
              ${count} vendidos
            </div>
          </div>
        `;
      });
      topHtml += '</div>';
      dom.topProductsList.innerHTML = topHtml;
    }
  }

  // ==========================================
  // 2. GERENCIAMENTO DE PEDIDOS EM TEMPO REAL & DESPACHO
  // ==========================================
  function renderOrders() {
    let list = adminState.orders;
    if (adminState.orderFilter !== 'all') {
      list = list.filter(o => o.status === adminState.orderFilter);
    }

    if (list.length === 0) {
      dom.ordersListContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-muted);">
          <h3>Nenhum pedido encontrado</h3>
        </div>
      `;
      return;
    }

    let html = '';
    list.forEach(order => {
      const orderNum = String(order.order_number || 1).padStart(4, '0');
      const dateStr = order.created_at ? new Date(order.created_at).toLocaleString('pt-BR') : '';

      let itemsRows = '';
      const orderItems = order.items || order.order_items || [];
      if (orderItems.length > 0) {
        orderItems.forEach(item => {
          let customNotes = '';
          if (item.flavor || item.custom_flavor) {
            customNotes += `<div style="color: #16a34a; font-weight: 700;">🥤 Sabor: ${window.escapeHtml((item.flavor || item.custom_flavor).toUpperCase())}</div>`;
          }
          if (item.combo_choices && item.combo_choices.length > 0) {
            customNotes += `<div style="color: #d97706; font-weight: 700;">🍔 Escolhas: ${item.combo_choices.map(c => `${c.qty}x ${window.escapeHtml(c.name)}`).join(', ')}</div>`;
          }
          if (item.optionals && item.optionals.length > 0) {
            customNotes += `<div>Adicionais: ${item.optionals.map(o => window.escapeHtml(o.name)).join(', ')}</div>`;
          }
          if (item.notes) {
            customNotes += `<div>Obs: ${window.escapeHtml(item.notes)}</div>`;
          }

          itemsRows += `
            <tr>
              <td><strong>${item.quantity}x</strong> ${window.escapeHtml(item.name || item.product_name)} ${customNotes ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${customNotes}</div>` : ''}</td>
              <td style="text-align: right;">${window.formatCurrency(item.subtotal || (item.unit_price * item.quantity) || (item.price * item.quantity))}</td>
            </tr>
          `;
        });
      }

      let typeBadge = '';
      let addressDisplay = '';

      if (order.order_type === 'mesa' || order.table_number) {
        typeBadge = `<span class="order-type-badge mesa"><i class="fi fi-sr-utensils"></i> Mesa 0${order.table_number || '?'}</span>`;
        addressDisplay = `Consumo no Local (Mesa 0${order.table_number || '?'})`;
      } else if (order.order_type === 'balcao') {
        typeBadge = `<span class="order-type-badge balcao"><i class="fi fi-sr-shopping-bag"></i> Balcão (Viagem)</span>`;
        addressDisplay = 'Retirada no Balcão';
      } else if (order.order_type === 'delivery') {
        typeBadge = `<span class="order-type-badge delivery"><i class="fi fi-sr-motorcycle"></i> Delivery</span>`;
        if (order.delivery_address) {
          const a = order.delivery_address;
          addressDisplay = `${window.escapeHtml(a.street || '')}, ${window.escapeHtml(String(a.number || ''))}${a.complement ? ` - ${window.escapeHtml(a.complement)}` : ''}, ${window.escapeHtml(a.neighborhood || '')} (Ref: ${window.escapeHtml(a.reference || 'Nenhuma')})`;
        }
      } else {
        typeBadge = `<span class="order-type-badge pickup"><i class="fi fi-sr-shop"></i> Retirada</span>`;
        addressDisplay = 'Retirada no Restaurante';
      }

      const cleanPhone = (order.customer_phone || '').replace(/\D/g, '');

      html += `
        <div class="order-admin-card status-${order.status}" id="order-card-${order.id}">
          <div class="order-card-top">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="order-number-title">Pedido #${orderNum}</span>
              ${typeBadge}
              ${order.courier_name ? `<span class="order-type-badge courier btn-change-courier" data-order-id="${order.id}" style="cursor: pointer;" title="Clique para alterar entregador"><i class="fi fi-sr-motorcycle"></i> Entregador: <strong>${window.escapeHtml(order.courier_name)}</strong> <i class="fi fi-sr-pencil"></i></span>` : ''}
              <span style="font-size: 0.8rem; color: var(--text-muted);">${dateStr}</span>
            </div>
            
            <div>
              <select class="status-dropdown order-status-select" data-order-id="${order.id}">
                <option value="novo" ${order.status === 'novo' ? 'selected' : ''}>Novo</option>
                <option value="confirmado" ${order.status === 'confirmado' ? 'selected' : ''}>Confirmado</option>
                <option value="em_preparo" ${order.status === 'em_preparo' ? 'selected' : ''}>Em Preparo</option>
                <option value="saiu_para_entrega" ${order.status === 'saiu_para_entrega' ? 'selected' : ''}>Saiu p/ Entrega</option>
                <option value="pronto_para_retirada" ${order.status === 'pronto_para_retirada' ? 'selected' : ''}>Pronto / Servir</option>
                <option value="finalizado" ${order.status === 'finalizado' ? 'selected' : ''}>Finalizado</option>
                <option value="cancelado" ${order.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
              </select>
            </div>
          </div>

          <div class="order-customer-info">
            <strong>Cliente:</strong> ${window.escapeHtml(order.customer_name || 'Cliente')} • <strong>WhatsApp:</strong> ${window.escapeHtml(order.customer_phone || 'Não informado')}<br />
            <strong>Local / Endereço:</strong> ${addressDisplay}<br />
            <strong>Pagamento:</strong> ${window.escapeHtml(order.payment_method || '')} ${order.change_for ? `(Troco para: ${window.formatCurrency(order.change_for)})` : ''}
            ${order.notes ? `<br /><strong>Obs Geral:</strong> <span style="color: #d97706; font-weight: 700;">${window.escapeHtml(order.notes)}</span>` : ''}
          </div>

          <table class="order-items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div class="order-actions-bar">
            <div style="font-size: 0.95rem; font-weight: 800;">
              Total: <span style="color: #d97706;">${window.formatCurrency(order.total)}</span>
              <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 500;">(Sub: ${window.formatCurrency(order.subtotal)} + Taxa: ${window.formatCurrency(order.delivery_fee)})</span>
            </div>

            <div style="display: flex; gap: 8px;">
              ${order.order_type === 'delivery' && order.status !== 'finalizado' && order.status !== 'cancelado' ? `
                <button type="button" class="btn-ghost-secondary btn-assign-courier-action" data-order-id="${order.id}" style="font-size: 0.8rem; border-color: #3b82f6; color: #2563eb;">
                  <i class="fi fi-sr-motorcycle"></i> ${order.courier_name ? `Trocar (${window.escapeHtml(order.courier_name)})` : 'Atribuir Entregador'}
                </button>
              ` : ''}

              ${cleanPhone && cleanPhone !== '0000000000' ? `
                <a href="https://wa.me/55${cleanPhone}" target="_blank" class="btn-ghost-secondary" style="font-size: 0.8rem; background: #25d366; color: #fff;">
                  <i class="fi fi-brands-whatsapp"></i> WhatsApp
                </a>
              ` : ''}
              <button class="btn-ghost-secondary btn-print-kitchen" data-order-id="${order.id}" style="font-size: 0.8rem;">
                <i class="fi fi-sr-print"></i> Cozinha
              </button>
              ${order.order_type === 'delivery' ? `
              <button class="btn-ghost-secondary btn-print-motoboy" data-order-id="${order.id}" style="font-size: 0.8rem; border-color: #f59e0b; color: #d97706;">
                <i class="fi fi-sr-motorcycle"></i> Motoboy
              </button>` : ''}
              ${(order.order_type === 'pickup' || order.order_type === 'retirada' || order.order_type === 'balcao' || (!order.order_type && !order.table_number)) ? `
              <button class="btn-ghost-secondary btn-print-balcao" data-order-id="${order.id}" style="font-size: 0.8rem; border-color: #8b5cf6; color: #7c3aed;">
                <i class="fi fi-sr-receipt"></i> Balcão
              </button>` : ''}
            </div>
          </div>
        </div>
      `;
    });

    dom.ordersListContainer.innerHTML = html;

    dom.ordersListContainer.querySelectorAll('.order-status-select').forEach(select => {
      select.addEventListener('change', async (e) => {
        const orderId = select.getAttribute('data-order-id');
        let newStatus = e.target.value;
        const order = adminState.orders.find(o => o.id === orderId);

        // Se mudou para saiu_para_entrega e for delivery, abre modal de escolha do entregador
        if (newStatus === 'saiu_para_entrega' && order && order.order_type === 'delivery') {
          openDispatchCourierModal(orderId);
          return;
        }

        // Pedidos de balcão/retirada: quando marcados como "Pronto / Servir", finalizar automaticamente
        // pois o cliente recebe na hora — não há etapa posterior
        const isCounterOrder = order && (
          order.order_type === 'balcao' ||
          order.order_type === 'pickup' ||
          order.order_type === 'retirada' ||
          (!order.order_type && !order.table_number)
        );
        if (newStatus === 'pronto_para_retirada' && isCounterOrder) {
          newStatus = 'finalizado';
        }

        await window.db.updateOrderStatus(orderId, newStatus);
        if (order) order.status = newStatus;
        renderSalonTables();
        renderDashboard();
        renderOrders();
        renderCashReport();
      });
    });

    dom.ordersListContainer.querySelectorAll('.btn-assign-courier-action, .btn-change-courier').forEach(btn => {
      btn.addEventListener('click', () => {
        const orderId = btn.getAttribute('data-order-id');
        openDispatchCourierModal(orderId);
      });
    });

    dom.ordersListContainer.querySelectorAll('.btn-print-kitchen').forEach(btn => {
      btn.addEventListener('click', () => {
        const orderId = btn.getAttribute('data-order-id');
        const order = adminState.orders.find(o => o.id === orderId);
        if (order) printKitchenTicket(order);
      });
    });

    dom.ordersListContainer.querySelectorAll('.btn-print-motoboy').forEach(btn => {
      btn.addEventListener('click', () => {
        const orderId = btn.getAttribute('data-order-id');
        const order = adminState.orders.find(o => o.id === orderId);
        if (order) printMotoboyTicket(order);
      });
    });

    dom.ordersListContainer.querySelectorAll('.btn-print-balcao').forEach(btn => {
      btn.addEventListener('click', () => {
        const orderId = btn.getAttribute('data-order-id');
        const order = adminState.orders.find(o => o.id === orderId);
        if (order) printBalcaoTicket(order);
      });
    });
  }

  // Modal de Despacho de Entregador
  function openDispatchCourierModal(orderId) {
    const order = adminState.orders.find(o => o.id === orderId);
    if (!order) return;

    dom.dispatchOrderId.value = orderId;
    dom.dispatchModalSubtitle.textContent = `Pedido #${String(order.order_number).padStart(4, '0')} — ${order.customer_name} (${order.delivery_address?.neighborhood || 'Delivery'})`;

    let couriers = adminState.couriers || [];
    if (!couriers || couriers.length === 0) {
      couriers = window.INITIAL_COURIERS || [
        { id: 'courier-1', name: 'Paulo', phone: '', is_active: true },
        { id: 'courier-2', name: 'Marcos', phone: '', is_active: true },
        { id: 'courier-3', name: 'Hernandes', phone: '', is_active: true }
      ];
      adminState.couriers = couriers;
    }

    let couriersHtml = '';
    couriers.forEach(c => {
      if (c.is_active !== false) {
        const isCurrent = order.courier_name === c.name;
        couriersHtml += `
          <div class="courier-pick-btn ${isCurrent ? 'selected' : ''}" data-courier-name="${window.escapeHtml(c.name)}">
            <span style="font-size: 1.8rem;">🛵</span>
            <span class="name">${window.escapeHtml(c.name)}</span>
            <span style="font-size: 0.75rem; color: ${isCurrent ? '#166534' : '#64748b'};">${isCurrent ? '● Atribuído' : 'Selecionar'}</span>
          </div>
        `;
      }
    });

    dom.dispatchCouriersList.innerHTML = couriersHtml;

    dom.dispatchCouriersList.querySelectorAll('.courier-pick-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const courierName = btn.getAttribute('data-courier-name');
        await window.db.updateOrderStatus(orderId, 'saiu_para_entrega', null, courierName);
        order.status = 'saiu_para_entrega';
        order.courier_name = courierName;
        
        dom.dispatchCourierModal.style.display = 'none';
        renderOrders();
        renderCashReport();
        renderDashboard();
      });
    });

    dom.dispatchCourierModal.style.display = 'flex';
  }

  if (dom.btnAddOtherCourier) {
    dom.btnAddOtherCourier.addEventListener('click', async () => {
      const orderId = dom.dispatchOrderId.value;
      const order = adminState.orders.find(o => o.id === orderId);
      if (!order) return;
      const customCourier = await showInputPopup(
        'Outro Entregador',
        'Digite o nome do entregador/motoboy:',
        'Ex: Roberto, Marcelo...'
      );
      if (!customCourier) return;

      const exists = (adminState.couriers || []).some(c => c.name && c.name.toLowerCase() === customCourier.toLowerCase());
      if (!exists) {
        const newC = { id: 'courier-' + Date.now(), name: customCourier, is_active: true };
        adminState.couriers.push(newC);
        try { await window.db.saveCourier(newC); } catch {}
      }

      await window.db.updateOrderStatus(orderId, 'saiu_para_entrega', null, customCourier);
      order.status = 'saiu_para_entrega';
      order.courier_name = customCourier;
      dom.dispatchCourierModal.style.display = 'none';
      renderOrders();
      renderCashReport();
      renderDashboard();
    });
  }

  dom.btnDispatchModalClose.addEventListener('click', () => {
    dom.dispatchCourierModal.style.display = 'none';
  });

  dom.btnConfirmDispatchNoCourier.addEventListener('click', async () => {
    const orderId = dom.dispatchOrderId.value;
    const order = adminState.orders.find(o => o.id === orderId);
    if (order) {
      await window.db.updateOrderStatus(orderId, 'saiu_para_entrega');
      order.status = 'saiu_para_entrega';
      dom.dispatchCourierModal.style.display = 'none';
      renderOrders();
      renderCashReport();
    }
  });

  function printOrderTicket(order) {
    const printWindow = window.open('', '_blank', 'width=320,height=400');
    let itemsStr = '';
    const orderItems = order.items || order.order_items || [];
    orderItems.forEach(i => {
      itemsStr += `<div class="item-line">${i.quantity}x <strong>${window.escapeHtml(i.name || i.product_name)}</strong> - ${window.formatCurrency(i.subtotal)}</div>`;
      if (i.flavor || i.custom_flavor) {
        itemsStr += `<div class="item-detail"><strong>🥤 SABOR: ${window.escapeHtml((i.flavor || i.custom_flavor).toUpperCase())}</strong></div>`;
      }
      if (i.combo_choices && i.combo_choices.length > 0) {
        itemsStr += `<div class="item-detail"><strong>🍔 ESCOLHAS: ${i.combo_choices.map(c => `${c.qty}x ${window.escapeHtml(c.name)}`).join(', ')}</strong></div>`;
      }
      if (i.optionals && i.optionals.length > 0) {
        itemsStr += `<div class="item-detail"><strong>+ ${i.optionals.map(o => window.escapeHtml(o.name)).join(', ')}</strong></div>`;
      }
      if (i.notes) {
        itemsStr += `<div class="item-obs"><strong>*** OBS: ${window.escapeHtml(i.notes)} ***</strong></div>`;
      }
    });

    let typeStr = 'RETIRADA';
    if (order.order_type === 'mesa' || order.table_number) {
      typeStr = `MESA 0${order.table_number || '?'}`;
    } else if (order.order_type === 'balcao') {
      typeStr = 'BALCÃO / VIAGEM';
    } else if (order.order_type === 'delivery') {
      typeStr = 'DELIVERY / ENTREGA';
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Cupom Pedido #${order.order_number}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; text-align: center !important; }
            html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; background: #fff; text-align: center !important; }
            .ticket-wrapper {
              font-family: Arial, Helvetica, 'Segoe UI', 'Courier New', sans-serif;
              font-size: 15px;
              font-weight: 900;
              color: #000;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 auto !important;
              padding: 4px 7mm 24px 7mm !important;
              word-break: break-word;
              line-height: 1.3;
              text-align: center !important;
              box-sizing: border-box !important;
            }
            h2 { font-size: 20px; font-weight: 900; text-align: center !important; margin: 2px 0; letter-spacing: 0.5px; }
            h3 { font-size: 17px; font-weight: 900; text-align: center !important; margin: 2px 0; }
            hr { border: none; border-top: 2px dashed #000; margin: 5px auto; width: 100%; }
            .tipo { text-align: center !important; font-weight: 900; font-size: 16px; margin: 4px auto; padding: 3px 0; border: 2px solid #000; display: block; }
            .data { text-align: center !important; font-size: 13px; font-weight: 900; margin: 2px 0; }
            .entregador { text-align: center !important; font-weight: 900; font-size: 15px; margin: 4px auto; padding: 3px; border: 2px solid #000; display: block; }
            .info { font-size: 15px; font-weight: 800; margin: 3px 0; text-align: center !important; }
            .item-line { font-size: 16px; font-weight: 900; margin: 5px 0 2px 0; text-align: center !important; }
            .item-detail { font-size: 14px; font-weight: 900; margin: 2px 0; text-align: center !important; }
            .item-obs { font-size: 14px; font-weight: 900; padding: 3px 4px; margin: 3px auto; background: #eee; border: 2px solid #000; text-align: center !important; display: block; }
            .total-line { font-size: 18px; font-weight: 900; margin-top: 6px; text-align: center !important; }
            @media print {
              @page { margin: 0; size: auto; }
              html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; text-align: center !important; }
              .ticket-wrapper {
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 auto !important;
                padding: 4px 7mm 24px 7mm !important;
                text-align: center !important;
                box-sizing: border-box !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="ticket-wrapper">
            <h2>BOYDEGUSTA</h2>
            <h3>PEDIDO #${String(order.order_number).padStart(4, '0')}</h3>
            <div class="tipo">[ ${typeStr} ]</div>
            <div class="data">${new Date(order.created_at).toLocaleString('pt-BR')}</div>
            ${order.courier_name ? `<div class="entregador">🛵 ENTREGADOR: ${window.escapeHtml(order.courier_name.toUpperCase())}</div>` : ''}
            <hr />
            <div class="info"><strong>Cliente:</strong> ${window.escapeHtml(order.customer_name || 'Cliente')}</div>
            <div class="info"><strong>Fone:</strong> ${window.escapeHtml(order.customer_phone || 'Não informado')}</div>
            ${order.delivery_address ? `<div class="info"><strong>End.:</strong> ${window.escapeHtml(order.delivery_address.street || '')}, ${window.escapeHtml(String(order.delivery_address.number || ''))} - ${window.escapeHtml(order.delivery_address.neighborhood || '')}</div>` : ''}
            <div class="info"><strong>Pgto:</strong> ${window.escapeHtml(order.payment_method || '')} ${order.change_for ? `(Troco: ${window.formatCurrency(order.change_for)})` : ''}</div>
            ${order.notes ? `<div class="item-obs"><strong>*** OBS GERAL: ${window.escapeHtml(order.notes)} ***</strong></div>` : ''}
            <hr />
            ${itemsStr}
            <hr />
            <div class="info">Subtotal: ${window.formatCurrency(order.subtotal)}</div>
            <div class="info">Taxa Entrega: ${window.formatCurrency(order.delivery_fee)}</div>
            <div class="total-line">TOTAL: ${window.formatCurrency(order.total)}</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  }

  // ==========================================
  // IMPRESSÃO — COZINHA (todos os tipos)
  // Apenas itens e obs, sem preços ou dados do cliente
  // ==========================================
  function printKitchenTicket(order) {
    const printWindow = window.open('', '_blank', 'width=320,height=400');
    let itemsStr = '';
    const orderItems = order.items || order.order_items || [];
    orderItems.forEach(i => {
      itemsStr += `<div class="item-line">${i.quantity}x <strong>${window.escapeHtml(i.name || i.product_name)}</strong></div>`;
      if (i.flavor || i.custom_flavor) {
        itemsStr += `<div class="item-detail"><strong>🥤 SABOR: ${window.escapeHtml((i.flavor || i.custom_flavor).toUpperCase())}</strong></div>`;
      }
      if (i.combo_choices && i.combo_choices.length > 0) {
        itemsStr += `<div class="item-detail"><strong>🍔 ESCOLHAS: ${i.combo_choices.map(c => `${c.qty}x ${window.escapeHtml(c.name)}`).join(', ')}</strong></div>`;
      }
      if (i.optionals && i.optionals.length > 0) {
        itemsStr += `<div class="item-detail"><strong>+ ${i.optionals.map(o => window.escapeHtml(o.name)).join(', ')}</strong></div>`;
      }
      if (i.notes) {
        itemsStr += `<div class="item-obs"><strong>*** OBS: ${window.escapeHtml(i.notes)} ***</strong></div>`;
      }
    });

    let typeStr = 'RETIRADA';
    if (order.order_type === 'mesa' || order.table_number) {
      typeStr = `MESA 0${order.table_number || '?'}`;
    } else if (order.order_type === 'balcao') {
      typeStr = 'BALCÃO / VIAGEM';
    } else if (order.order_type === 'delivery') {
      typeStr = 'DELIVERY';
    }

    if (order.notes) {
      itemsStr += `<div class="item-obs" style="margin-top:4px"><strong>*** OBS GERAL: ${window.escapeHtml(order.notes)} ***</strong></div>`;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Cozinha #${order.order_number}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; text-align: center !important; }
            html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; background: #fff; text-align: center !important; }
            .ticket-wrapper {
              font-family: Arial, Helvetica, 'Segoe UI', 'Courier New', sans-serif;
              font-size: 15px;
              font-weight: 900;
              color: #000;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 auto !important;
              padding: 4px 7mm 24px 7mm !important;
              word-break: break-word;
              line-height: 1.3;
              text-align: center !important;
              box-sizing: border-box !important;
            }
            h2 { font-size: 20px; font-weight: 900; text-align: center !important; margin: 2px 0; letter-spacing: 0.5px; }
            h3 { font-size: 17px; font-weight: 900; text-align: center !important; margin: 2px 0; }
            hr { border: none; border-top: 2px dashed #000; margin: 5px auto; width: 100%; }
            .tipo { text-align: center !important; font-weight: 900; font-size: 16px; margin: 4px auto; padding: 3px 0; border: 2px solid #000; display: block; }
            .item-line { font-size: 16px; font-weight: 900; margin: 5px 0 2px 0; text-align: center !important; }
            .item-detail { font-size: 14px; font-weight: 900; margin: 2px 0; text-align: center !important; }
            .item-obs { font-size: 14px; font-weight: 900; padding: 3px 4px; margin: 3px auto; background: #eee; border: 2px solid #000; text-align: center !important; display: block; }
            @media print {
              @page { margin: 0; size: auto; }
              html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; text-align: center !important; }
              .ticket-wrapper {
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 auto !important;
                padding: 4px 7mm 24px 7mm !important;
                text-align: center !important;
                box-sizing: border-box !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="ticket-wrapper">
            <h2>*** COZINHA ***</h2>
            <h3>PEDIDO #${String(order.order_number).padStart(4, '0')}</h3>
            <div class="tipo">[ ${typeStr} ]</div>
            <hr />
            ${itemsStr}
            <hr />
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  }

  // ==========================================
  // IMPRESSÃO — MOTOBOY (delivery apenas)
  // Informações completas de entrega
  // ==========================================
  function printMotoboyTicket(order) {
    const printWindow = window.open('', '_blank', 'width=320,height=400');
    let itemsStr = '';
    const orderItems = order.items || order.order_items || [];
    orderItems.forEach(i => {
      itemsStr += `<div class="item-line">${i.quantity}x <strong>${window.escapeHtml(i.name || i.product_name)}</strong> — ${window.formatCurrency(i.subtotal)}</div>`;
      if (i.flavor || i.custom_flavor) {
        itemsStr += `<div class="item-detail"><strong>🥤 SABOR: ${window.escapeHtml((i.flavor || i.custom_flavor).toUpperCase())}</strong></div>`;
      }
      if (i.combo_choices && i.combo_choices.length > 0) {
        itemsStr += `<div class="item-detail"><strong>🍔 ESCOLHAS: ${i.combo_choices.map(c => `${c.qty}x ${window.escapeHtml(c.name)}`).join(', ')}</strong></div>`;
      }
      if (i.optionals && i.optionals.length > 0) {
        itemsStr += `<div class="item-detail"><strong>+ ${i.optionals.map(o => window.escapeHtml(o.name)).join(', ')}</strong></div>`;
      }
      if (i.notes) {
        itemsStr += `<div class="item-obs"><strong>*** OBS: ${window.escapeHtml(i.notes)} ***</strong></div>`;
      }
    });

    const addr = order.delivery_address;
    const addrStr = addr
      ? `${window.escapeHtml(addr.street || '')}, ${window.escapeHtml(String(addr.number || ''))} — ${window.escapeHtml(addr.neighborhood || '')}${addr.complement ? ` (${window.escapeHtml(addr.complement)})` : ''}`
      : 'Endereço não informado';

    printWindow.document.write(`
      <html>
        <head>
          <title>Motoboy #${order.order_number}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; text-align: center !important; }
            html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; background: #fff; text-align: center !important; }
            .ticket-wrapper {
              font-family: Arial, Helvetica, 'Segoe UI', 'Courier New', sans-serif;
              font-size: 15px;
              font-weight: 900;
              color: #000;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 auto !important;
              padding: 4px 7mm 24px 7mm !important;
              word-break: break-word;
              line-height: 1.3;
              text-align: center !important;
              box-sizing: border-box !important;
            }
            h2 { font-size: 20px; font-weight: 900; text-align: center !important; margin: 2px 0; letter-spacing: 0.5px; }
            h3 { font-size: 17px; font-weight: 900; text-align: center !important; margin: 2px 0; }
            hr { border: none; border-top: 2px dashed #000; margin: 5px auto; width: 100%; }
            .info { font-size: 15px; font-weight: 800; margin: 3px 0; text-align: center !important; }
            .info-big { font-size: 17px; font-weight: 900; margin: 3px 0; text-align: center !important; }
            .item-line { font-size: 16px; font-weight: 900; margin: 5px 0 2px 0; text-align: center !important; }
            .item-detail { font-size: 14px; font-weight: 900; margin: 2px 0; text-align: center !important; }
            .item-obs { font-size: 14px; font-weight: 900; padding: 3px 4px; margin: 3px auto; background: #eee; border: 2px solid #000; text-align: center !important; display: block; }
            .total-line { font-size: 18px; font-weight: 900; margin-top: 6px; text-align: center !important; }
            @media print {
              @page { margin: 0; size: auto; }
              html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; text-align: center !important; }
              .ticket-wrapper {
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 auto !important;
                padding: 4px 7mm 24px 7mm !important;
                text-align: center !important;
                box-sizing: border-box !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="ticket-wrapper">
            <h2>🛵 MOTOBOY</h2>
            <h3>PEDIDO #${String(order.order_number).padStart(4, '0')}</h3>
            <hr />
            <div class="info-big">${window.escapeHtml(order.customer_name || 'Cliente')}</div>
            <div class="info"><strong>Fone:</strong> ${window.escapeHtml(order.customer_phone || 'Não informado')}</div>
            <div class="info"><strong>End.:</strong> ${addrStr}</div>
            ${order.courier_name ? `<div class="info"><strong>Entregador:</strong> ${window.escapeHtml(order.courier_name)}</div>` : ''}
            <hr />
            ${itemsStr}
            <hr />
            <div class="info">Subtotal: ${window.formatCurrency(order.subtotal)}</div>
            <div class="info">Taxa Entrega: ${window.formatCurrency(order.delivery_fee)}</div>
            <div class="total-line">TOTAL: ${window.formatCurrency(order.total)}</div>
            <div class="info"><strong>Pgto:</strong> ${window.escapeHtml(order.payment_method || '')} ${order.change_for ? `(Troco p/ ${window.formatCurrency(order.change_for)})` : ''}</div>
            ${order.notes ? `<div class="item-obs"><strong>*** OBS: ${window.escapeHtml(order.notes)} ***</strong></div>` : ''}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  }

  // ==========================================
  // IMPRESSÃO — BALCÃO / RETIRADA (atendente)
  // Informações completas para controle da atendente
  // ==========================================
  function printBalcaoTicket(order) {
    const printWindow = window.open('', '_blank', 'width=320,height=400');
    let itemsStr = '';
    const orderItems = order.items || order.order_items || [];
    orderItems.forEach(i => {
      itemsStr += `<div class="item-line">${i.quantity}x <strong>${window.escapeHtml(i.name || i.product_name)}</strong> — ${window.formatCurrency(i.subtotal)}</div>`;
      if (i.flavor || i.custom_flavor) {
        itemsStr += `<div class="item-detail"><strong>🥤 SABOR: ${window.escapeHtml((i.flavor || i.custom_flavor).toUpperCase())}</strong></div>`;
      }
      if (i.combo_choices && i.combo_choices.length > 0) {
        itemsStr += `<div class="item-detail"><strong>🍔 ESCOLHAS: ${i.combo_choices.map(c => `${c.qty}x ${window.escapeHtml(c.name)}`).join(', ')}</strong></div>`;
      }
      if (i.optionals && i.optionals.length > 0) {
        itemsStr += `<div class="item-detail"><strong>+ ${i.optionals.map(o => window.escapeHtml(o.name)).join(', ')}</strong></div>`;
      }
      if (i.notes) {
        itemsStr += `<div class="item-obs"><strong>*** OBS: ${window.escapeHtml(i.notes)} ***</strong></div>`;
      }
    });

    let typeStr = 'RETIRADA NO LOCAL';
    if (order.order_type === 'balcao') {
      typeStr = 'BALCÃO / VIAGEM';
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Balcão #${order.order_number}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; text-align: center !important; }
            html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; background: #fff; text-align: center !important; }
            .ticket-wrapper {
              font-family: Arial, Helvetica, 'Segoe UI', 'Courier New', sans-serif;
              font-size: 15px;
              font-weight: 900;
              color: #000;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 auto !important;
              padding: 4px 7mm 24px 7mm !important;
              word-break: break-word;
              line-height: 1.3;
              text-align: center !important;
              box-sizing: border-box !important;
            }
            h2 { font-size: 20px; font-weight: 900; text-align: center !important; margin: 2px 0; letter-spacing: 0.5px; }
            h3 { font-size: 17px; font-weight: 900; text-align: center !important; margin: 2px 0; }
            hr { border: none; border-top: 2px dashed #000; margin: 5px auto; width: 100%; }
            .info { font-size: 15px; font-weight: 800; margin: 3px 0; text-align: center !important; }
            .info-big { font-size: 17px; font-weight: 900; margin: 3px 0; text-align: center !important; }
            .item-line { font-size: 16px; font-weight: 900; margin: 5px 0 2px 0; text-align: center !important; }
            .item-detail { font-size: 14px; font-weight: 900; margin: 2px 0; text-align: center !important; }
            .item-obs { font-size: 14px; font-weight: 900; padding: 3px 4px; margin: 3px auto; background: #eee; border: 2px solid #000; text-align: center !important; display: block; }
            .total-line { font-size: 18px; font-weight: 900; margin-top: 6px; text-align: center !important; }
            @media print {
              @page { margin: 0; size: auto; }
              html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; text-align: center !important; }
              .ticket-wrapper {
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 auto !important;
                padding: 4px 7mm 24px 7mm !important;
                text-align: center !important;
                box-sizing: border-box !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="ticket-wrapper">
            <h2>🧾 CONTROLE BALCÃO</h2>
            <h3>PEDIDO #${String(order.order_number).padStart(4, '0')}</h3>
            <hr />
            <div class="info-big">${window.escapeHtml(order.customer_name || 'Cliente Balcão')}</div>
            <div class="info"><strong>Fone:</strong> ${window.escapeHtml(order.customer_phone || 'Não informado')}</div>
            <div class="info"><strong>Tipo:</strong> ${typeStr}</div>
            <hr />
            ${itemsStr}
            <hr />
            <div class="total-line">TOTAL: ${window.formatCurrency(order.total)}</div>
            <div class="info"><strong>Pgto:</strong> ${window.escapeHtml(order.payment_method || '')} ${order.change_for ? `(Troco p/ ${window.formatCurrency(order.change_for)})` : ''}</div>
            ${order.notes ? `<div class="item-obs"><strong>*** OBS: ${window.escapeHtml(order.notes)} ***</strong></div>` : ''}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  }

  // ==========================================
  // IMPRESSÃO — CUPOM COMPLETO (legado, mantido para compatibilidade)
  // ==========================================
  function renderProducts() {
    if (!adminState.products || adminState.products.length === 0) {
      adminState.products = (window.INITIAL_PRODUCTS || []).slice();
    }

    let list = adminState.products || [];
    const query = (adminState.productSearch || '').toLowerCase().trim();
    const catFilter = adminState.productCategoryFilter || 'all';

    if (query) {
      list = list.filter(p => (p.name || '').toLowerCase().includes(query) || (p.description || '').toLowerCase().includes(query));
    }
    if (catFilter !== 'all') {
      list = list.filter(p => p.category_id === catFilter);
    }

    // Reconstrói o select de categorias SOMENTE se precisar (evita resetar a seleção)
    if (dom.adminFilterCategory) {
      const categories = adminState.categories && adminState.categories.length > 0 ? adminState.categories : (window.INITIAL_CATEGORIES || []);
      const currentOptionsCount = Array.from(dom.adminFilterCategory.options || []).filter(o => o.value !== 'all').length;
      if (currentOptionsCount !== categories.length) {
        let catOptions = '<option value="all">Todas as categorias</option>';
        categories.forEach(c => {
          catOptions += `<option value="${c.id}">${window.escapeHtml(c.name)}</option>`;
        });
        dom.adminFilterCategory.innerHTML = catOptions;
      }
      dom.adminFilterCategory.value = catFilter;
    }

    // Garante que o campo de busca reflete o estado atual
    if (dom.adminSearchProductInput && dom.adminSearchProductInput.value !== adminState.productSearch) {
      dom.adminSearchProductInput.value = adminState.productSearch;
    }

    const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const todayDay = new Date().getDay();

    let rowsHtml = '';
    if (!list || list.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 48px 20px; color: #64748b;">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">🍕</div>
            <div style="font-weight: 700; font-size: 1rem; color: #1e293b;">Nenhum produto encontrado</div>
            <div style="font-size: 0.82rem; color: #94a3b8; margin-top: 4px;">Tente limpar a busca ou adicione um novo produto pelo botão "+ Novo Produto"</div>
          </td>
        </tr>
      `;
    } else {
      list.forEach(p => {
        const cat = (adminState.categories || []).find(c => c.id === p.category_id);
        const catName = cat ? window.escapeHtml(cat.name) : 'Sem categoria';
        const formattedPrice = p.price !== null && p.price !== undefined ? window.formatCurrency(p.price) : '<span style="color: var(--text-muted); font-style: italic;">A definir</span>';
        const isAvail = p.is_available !== false;
        const isAct = p.is_active !== false;

        // Cálculo e exibição da promoção por dia
        const promoPrice = Number(p.promo_price) || Number(p.monday_price) || 0;
        const promoDays = window.normalizePromoDays ? window.normalizePromoDays(p.promo_days, p.monday_price) : (Array.isArray(p.promo_days) ? p.promo_days.map(Number) : (p.monday_price ? [1] : []));
        const isPromoActive = p.is_promo !== false;
        const hasDayPromo = isPromoActive && promoPrice > 0 && promoDays.length > 0;
        const isPromoToday = hasDayPromo && promoDays.includes(todayDay);

        let promoColHtml = '<span style="color: #94a3b8; font-size: 0.78rem;">Sem promoção</span>';
        if (hasDayPromo) {
          const daysLabel = promoDays.map(d => DAY_NAMES[d] || d).join(', ');
          promoColHtml = `
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <span style="display: inline-flex; align-items: center; gap: 4px; background: ${isPromoToday ? '#dcfce7' : '#fef3c7'}; color: ${isPromoToday ? '#166534' : '#92400e'}; font-weight: 700; font-size: 0.75rem; padding: 2px 7px; border-radius: 5px; border: 1px solid ${isPromoToday ? '#86efac' : '#fde68a'};">
                <i class="fi fi-sr-flame" style="color: ${isPromoToday ? '#16a34a' : '#d97706'};"></i> ${daysLabel}: ${window.formatCurrency(promoPrice)}
              </span>
              ${isPromoToday ? '<span style="font-size: 0.7rem; color: #16a34a; font-weight: 700;">🔥 Ativa Hoje!</span>' : ''}
            </div>
          `;
        }

        const thumbUrl = window.optimizeImageUrl ? window.optimizeImageUrl(p.image_url, { width: 120, quality: 70 }) : (p.image_url || 'logo.jpg');
        rowsHtml += `
          <tr>
            <td>
              <img class="table-img-thumb" src="${thumbUrl}" alt="${window.escapeHtml(p.name)}" onerror="this.src='logo.jpg'" loading="lazy" />
            </td>
            <td>
              <strong>${window.escapeHtml(p.name)}</strong>
              <div style="font-size: 0.75rem; color: #64748b; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${window.escapeHtml(p.description || 'Sem descrição')}
              </div>
            </td>
            <td>${catName}</td>
            <td><strong>${formattedPrice}</strong></td>
            <td>${promoColHtml}</td>
            <td>
              <span class="product-status-pill ${isAct ? 'status-active' : 'status-inactive'}">
                ${isAct ? 'Ativo' : 'Oculto'}
              </span>
            </td>
            <td>
              <button class="btn-ghost-secondary btn-toggle-avail" data-prod-id="${p.id}" style="font-size: 0.78rem; padding: 4px 8px;">
                ${isAvail ? '<i class="fi fi-sr-check-circle" style="color: #10b981;"></i> Disponível' : '<i class="fi fi-sr-cross-circle" style="color: #ef4444;"></i> Esgotado'}
              </button>
            </td>
            <td>
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <button class="btn-ghost-secondary btn-day-promo" data-prod-id="${p.id}" style="font-size: 0.78rem; color: #d97706; font-weight: 700; border-color: #fde68a;" title="Configurar Promoção do Dia">
                  <i class="fi fi-sr-flame"></i> Promoção
                </button>
                <button class="btn-ghost-secondary btn-edit-product" data-prod-id="${p.id}" style="font-size: 0.78rem;">
                  <i class="fi fi-sr-pencil"></i> Editar
                </button>
                <button class="btn-ghost-secondary btn-delete-product" data-prod-id="${p.id}" style="font-size: 0.78rem; color: var(--primary-red);" title="Excluir Produto">
                  <i class="fi fi-sr-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      });
    }

    dom.adminProductsTableBody.innerHTML = rowsHtml;

    dom.adminProductsTableBody.querySelectorAll('.btn-toggle-avail').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-prod-id');
        const prod = adminState.products.find(p => p.id === id);
        if (prod) {
          prod.is_available = !prod.is_available;
          await window.db.saveProduct(prod);
          renderProducts();
        }
      });
    });

    dom.adminProductsTableBody.querySelectorAll('.btn-day-promo').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-prod-id');
        openDayPromoModal(id);
      });
    });

    dom.adminProductsTableBody.querySelectorAll('.btn-edit-product').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-prod-id');
        openProductModal(id);
      });
    });

    dom.adminProductsTableBody.querySelectorAll('.btn-delete-product').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-prod-id');
        if (confirm('Tem certeza que deseja excluir este produto?')) {
          await window.db.deleteProduct(id);
          adminState.products = adminState.products.filter(p => p.id !== id);
          renderProducts();
        }
      });
    });
  }

  if (dom.adminSearchProductInput) {
    dom.adminSearchProductInput.addEventListener('input', (e) => {
      adminState.productSearch = e.target.value;
      renderProducts();
    });
  }

  if (dom.adminFilterCategory) {
    dom.adminFilterCategory.addEventListener('change', (e) => {
      adminState.productCategoryFilter = e.target.value;
      renderProducts();
    });
  }

  function compressImageFile(file, maxWidth = 400, maxHeight = 400, quality = 0.75) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width / height > maxWidth / maxHeight) {
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

          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Erro ao ler a imagem.'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Erro ao carregar o arquivo.'));
      reader.readAsDataURL(file);
    });
  }

  function openProductModal(productId = null) {
    let catOptions = '';
    adminState.categories.forEach(c => {
      catOptions += `<option value="${c.id}">${window.escapeHtml(c.name)}</option>`;
    });
    dom.editProdCategory.innerHTML = catOptions;

    if (dom.editProdFileInput) dom.editProdFileInput.value = '';

    const promoDayCheckboxes = document.querySelectorAll('input[name="editProdPromoDay"]');

    if (productId) {
      const prod = adminState.products.find(p => p.id === productId);
      if (!prod) return;
      dom.productEditModalTitle.textContent = 'Editar Produto';
      dom.editProdId.value = prod.id;
      dom.editProdName.value = prod.name;
      dom.editProdCategory.value = prod.category_id || '';
      dom.editProdDescription.value = prod.description || '';
      dom.editProdPrice.value = prod.price !== null && prod.price !== undefined ? prod.price : '';
      if (dom.editProdPriceP) dom.editProdPriceP.value = prod.price_p || (prod.sizes?.find(s => s.size_key === 'P')?.price) || '';
      if (dom.editProdPriceM) dom.editProdPriceM.value = prod.price_m || (prod.sizes?.find(s => s.size_key === 'M')?.price) || '';
      if (dom.editProdPriceG) dom.editProdPriceG.value = prod.price_g || (prod.sizes?.find(s => s.size_key === 'G')?.price) || '';
      
      const hasSizes = Boolean(prod.has_sizes === true || prod.has_sizes === 'true');
      if (dom.editProdHasSizes) dom.editProdHasSizes.checked = hasSizes;
      if (dom.editProdSizesFields) dom.editProdSizesFields.style.display = hasSizes ? 'grid' : 'none';

      dom.editProdAvailable.value = String(prod.is_available !== false);
      if (dom.editProdSalesChannel) dom.editProdSalesChannel.value = prod.sales_channel || 'todos';
      if (dom.editProdBurgerType) {
        if (prod.burger_type) {
          dom.editProdBurgerType.value = prod.burger_type;
        } else if (isBurgerProduct(prod)) {
          dom.editProdBurgerType.value = 'both';
        } else {
          dom.editProdBurgerType.value = 'none';
        }
      }
      dom.editProdImage.value = prod.image_url || '';

      // Configuração de Promoção por Dia no Produto
      const promoDays = window.normalizePromoDays ? window.normalizePromoDays(prod.promo_days, prod.monday_price).map(String) : (Array.isArray(prod.promo_days) ? prod.promo_days.map(String) : (prod.monday_price ? ['1'] : []));
      const hasPromo = Boolean(prod.is_promo && (prod.promo_price || prod.monday_price || promoDays.length > 0));
      if (dom.editProdHasDayPromo) dom.editProdHasDayPromo.checked = Boolean(hasPromo);
      if (dom.editProdDayPromoFields) dom.editProdDayPromoFields.style.display = hasPromo ? 'block' : 'none';
      if (dom.editProdPromoPrice) dom.editProdPromoPrice.value = prod.promo_price || prod.monday_price || '';
      if (dom.editProdPromoLabel) dom.editProdPromoLabel.value = prod.promo_label || '';
      promoDayCheckboxes.forEach(cb => { cb.checked = promoDays.includes(String(cb.value)); });

      // Configuração de Sabores e Seleção / Combos
      const hasCustom = (prod.customization_type && prod.customization_type !== 'none') || (Array.isArray(prod.customization_options) && prod.customization_options.length > 0);
      if (dom.editProdHasCustomization) dom.editProdHasCustomization.checked = Boolean(hasCustom);
      if (dom.editProdCustomizationFields) dom.editProdCustomizationFields.style.display = hasCustom ? 'block' : 'none';
      if (dom.editProdCustomType) dom.editProdCustomType.value = prod.customization_type || 'flavors';
      if (dom.editProdCustomMaxQtyGroup) dom.editProdCustomMaxQtyGroup.style.display = (prod.customization_type === 'selection') ? 'block' : 'none';
      if (dom.editProdCustomMaxQty) dom.editProdCustomMaxQty.value = prod.customization_max_qty || 1;
      if (dom.editProdCustomLabel) dom.editProdCustomLabel.value = prod.customization_label || '';
      if (dom.editProdCustomOptions) dom.editProdCustomOptions.value = Array.isArray(prod.customization_options) ? prod.customization_options.join('\n') : '';

      if (prod.image_url && dom.editProdImagePreviewWrap) {
        dom.editProdImagePreview.src = prod.image_url;
        dom.editProdFileName.textContent = 'Imagem atual cadastrada';
        dom.editProdImagePreviewWrap.style.display = 'flex';
      } else if (dom.editProdImagePreviewWrap) {
        dom.editProdImagePreviewWrap.style.display = 'none';
      }
    } else {
      dom.productEditModalTitle.textContent = 'Novo Produto';
      dom.editProdId.value = '';
      dom.editProdName.value = '';
      const defaultCatId = adminState.categories[0]?.id || '';
      dom.editProdCategory.value = defaultCatId;
      dom.editProdDescription.value = '';
      dom.editProdPrice.value = '';
      if (dom.editProdPriceP) dom.editProdPriceP.value = '';
      if (dom.editProdPriceM) dom.editProdPriceM.value = '';
      if (dom.editProdPriceG) dom.editProdPriceG.value = '';
      if (dom.editProdHasSizes) dom.editProdHasSizes.checked = false;
      if (dom.editProdSizesFields) dom.editProdSizesFields.style.display = 'none';
      dom.editProdAvailable.value = 'true';
      if (dom.editProdBurgerType) {
        const isBurgerCat = ['cat-brasa', 'cat-burguer', 'cat-burger'].includes(defaultCatId);
        dom.editProdBurgerType.value = isBurgerCat ? 'both' : 'none';
      }
      dom.editProdImage.value = '';
      if (dom.editProdHasDayPromo) dom.editProdHasDayPromo.checked = false;
      if (dom.editProdDayPromoFields) dom.editProdDayPromoFields.style.display = 'none';
      if (dom.editProdPromoPrice) dom.editProdPromoPrice.value = '';
      if (dom.editProdPromoLabel) dom.editProdPromoLabel.value = '';
      promoDayCheckboxes.forEach(cb => { cb.checked = false; });

      if (dom.editProdHasCustomization) dom.editProdHasCustomization.checked = false;
      if (dom.editProdCustomizationFields) dom.editProdCustomizationFields.style.display = 'none';
      if (dom.editProdCustomType) dom.editProdCustomType.value = 'flavors';
      if (dom.editProdCustomMaxQtyGroup) dom.editProdCustomMaxQtyGroup.style.display = 'none';
      if (dom.editProdCustomMaxQty) dom.editProdCustomMaxQty.value = '1';
      if (dom.editProdCustomLabel) dom.editProdCustomLabel.value = '';
      if (dom.editProdCustomOptions) dom.editProdCustomOptions.value = '';

      if (dom.editProdImagePreviewWrap) dom.editProdImagePreviewWrap.style.display = 'none';
    }
    dom.productEditModal.style.display = 'flex';
  }

  if (dom.editProdCategory) {
    dom.editProdCategory.addEventListener('change', () => {
      if (!dom.editProdId.value && dom.editProdBurgerType) {
        const catId = dom.editProdCategory.value || '';
        const cat = adminState.categories.find(c => c.id === catId);
        const catSlug = (cat?.slug || '').toLowerCase();
        const catName = (cat?.name || '').toLowerCase();
        const isBurgerCat = ['cat-brasa', 'cat-burguer', 'cat-burger'].includes(catId) ||
                            catSlug.includes('brasa') || catSlug.includes('burguer') || catSlug.includes('burger') ||
                            catName.includes('brasa') || catName.includes('burguer') || catName.includes('burger');
        dom.editProdBurgerType.value = isBurgerCat ? 'both' : 'none';
      }
    });
  }

  if (dom.editProdHasSizes) {
    dom.editProdHasSizes.addEventListener('change', () => {
      if (dom.editProdSizesFields) {
        dom.editProdSizesFields.style.display = dom.editProdHasSizes.checked ? 'grid' : 'none';
      }
    });
  }

  if (dom.editProdHasDayPromo) {
    dom.editProdHasDayPromo.addEventListener('change', () => {
      if (dom.editProdDayPromoFields) {
        dom.editProdDayPromoFields.style.display = dom.editProdHasDayPromo.checked ? 'block' : 'none';
      }
    });
  }

  if (dom.editProdHasCustomization) {
    dom.editProdHasCustomization.addEventListener('change', () => {
      if (dom.editProdCustomizationFields) {
        dom.editProdCustomizationFields.style.display = dom.editProdHasCustomization.checked ? 'block' : 'none';
      }
    });
  }

  if (dom.editProdCustomType) {
    dom.editProdCustomType.addEventListener('change', () => {
      if (dom.editProdCustomMaxQtyGroup) {
        dom.editProdCustomMaxQtyGroup.style.display = dom.editProdCustomType.value === 'selection' ? 'block' : 'none';
      }
    });
  }

  if (dom.editProdFileInput) {
    dom.editProdFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        const submitBtn = dom.productEditForm ? dom.productEditForm.querySelector('button[type="submit"]') : null;
        try {
          if (dom.editProdFileName) dom.editProdFileName.textContent = '⏳ Enviando imagem para a nuvem...';
          if (dom.editProdImagePreviewWrap) dom.editProdImagePreviewWrap.style.display = 'flex';
          
          // Mostrar preview local imediato
          if (dom.editProdImagePreview) {
            dom.editProdImagePreview.src = URL.createObjectURL(file);
          }
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Enviando foto...';
          }
          
          let uploadedUrl = null;
          if (window.db && window.db.uploadImage) {
            uploadedUrl = await window.db.uploadImage(file);
          }

          if (uploadedUrl) {
            dom.editProdImage.value = uploadedUrl;
            if (dom.editProdImagePreview) dom.editProdImagePreview.src = uploadedUrl;
            if (dom.editProdFileName) dom.editProdFileName.textContent = `✅ ${file.name} (Salvo na Nuvem)`;
          } else {
            console.warn('Upload na nuvem falhou, gerando versão otimizada...');
            const compressedDataUrl = await compressImageFile(file, 400, 400, 0.7);
            dom.editProdImage.value = compressedDataUrl;
            if (dom.editProdImagePreview) dom.editProdImagePreview.src = compressedDataUrl;
            if (dom.editProdFileName) dom.editProdFileName.textContent = `${file.name} (Local)`;
          }
        } catch (err) {
          console.error('Erro ao processar imagem:', err);
          alert('Erro ao carregar a imagem. Tente escolher outra foto.');
          if (dom.editProdFileName) dom.editProdFileName.textContent = 'Erro no upload';
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Salvar Produto';
          }
        }
      }
    });
  }

  if (dom.btnRemoveProdImage) {
    dom.btnRemoveProdImage.addEventListener('click', () => {
      dom.editProdImage.value = '';
      if (dom.editProdFileInput) dom.editProdFileInput.value = '';
      if (dom.editProdImagePreviewWrap) dom.editProdImagePreviewWrap.style.display = 'none';
    });
  }

  dom.btnOpenAddProduct.addEventListener('click', () => openProductModal(null));
  dom.btnProductEditClose.addEventListener('click', () => dom.productEditModal.style.display = 'none');
  dom.btnProductEditCancel.addEventListener('click', () => dom.productEditModal.style.display = 'none');

  dom.productEditForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = dom.productEditForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Salvando produto...';
    }

    try {
      const id = dom.editProdId.value;
      const rawPrice = dom.editProdPrice.value.trim();
      const rawPriceP = dom.editProdPriceP ? dom.editProdPriceP.value.trim() : '';
      const rawPriceM = dom.editProdPriceM ? dom.editProdPriceM.value.trim() : '';
      const rawPriceG = dom.editProdPriceG ? dom.editProdPriceG.value.trim() : '';
      const hasSizes = dom.editProdHasSizes ? dom.editProdHasSizes.checked : false;

      const hasDayPromo = dom.editProdHasDayPromo ? dom.editProdHasDayPromo.checked : false;
      const rawPromoPrice = dom.editProdPromoPrice ? dom.editProdPromoPrice.value.trim() : '';
      const promoDaysChecked = Array.from(document.querySelectorAll('input[name="editProdPromoDay"]:checked')).map(cb => Number(cb.value));

      const hasCustomization = dom.editProdHasCustomization ? dom.editProdHasCustomization.checked : false;
      const customType = hasCustomization && dom.editProdCustomType ? dom.editProdCustomType.value : 'none';
      const customMaxQty = hasCustomization && dom.editProdCustomMaxQty ? (Number(dom.editProdCustomMaxQty.value) || 1) : 1;
      const customLabel = hasCustomization && dom.editProdCustomLabel ? dom.editProdCustomLabel.value.trim() : null;
      const rawCustomOptions = hasCustomization && dom.editProdCustomOptions ? dom.editProdCustomOptions.value : '';
      const customOptions = rawCustomOptions.split('\n').map(s => s.trim()).filter(Boolean);
      const burgerType = dom.editProdBurgerType ? dom.editProdBurgerType.value : 'none';

      const sizes = hasSizes ? [
        { size_key: 'P', name: 'P (Pequena)', price: Number(rawPriceP || rawPrice || 25) },
        { size_key: 'M', name: 'M (Média)', price: Number(rawPriceM || 35) },
        { size_key: 'G', name: 'G (Grande)', price: Number(rawPriceG || 45) }
      ] : [];

      const payload = {
        name: dom.editProdName.value.trim(),
        category_id: dom.editProdCategory.value,
        burger_type: burgerType,
        description: dom.editProdDescription.value.trim(),
        price: rawPrice ? Number(rawPrice) : (hasSizes && rawPriceP ? Number(rawPriceP) : null),
        has_sizes: hasSizes,
        price_p: hasSizes && rawPriceP ? Number(rawPriceP) : null,
        price_m: hasSizes && rawPriceM ? Number(rawPriceM) : null,
        price_g: hasSizes && rawPriceG ? Number(rawPriceG) : null,
        sizes: sizes,
        is_available: dom.editProdAvailable.value === 'true',
        sales_channel: 'todos',
        image_url: dom.editProdImage.value.trim() || 'logo.jpg',
        is_promo: hasDayPromo,
        promo_days: hasDayPromo ? promoDaysChecked : [],
        promo_price: (hasDayPromo && rawPromoPrice) ? Number(rawPromoPrice) : null,
        promo_label: (hasDayPromo && dom.editProdPromoLabel) ? dom.editProdPromoLabel.value.trim() : null,
        monday_price: (hasDayPromo && promoDaysChecked.includes(1) && rawPromoPrice) ? Number(rawPromoPrice) : null,
        customization_type: customType,
        customization_label: customLabel,
        customization_max_qty: customMaxQty,
        customization_min_qty: 1,
        customization_options: customOptions
      };
      if (id) payload.id = id;

      const saved = await window.db.saveProduct(payload);
      
      if (id) {
        adminState.products = adminState.products.map(p => p.id === id ? saved : p);
      } else {
        adminState.products.push(saved);
      }

      // Sincroniza lista atualizada, mas preserva a imagem recém-salva localmente
      const refreshed = await window.db.getProducts();
      if (Array.isArray(refreshed) && refreshed.length > 0) {
        adminState.products = refreshed.map(p => {
          // Se o produto recém-salvo voltou com imagem diferente (ex: logo.jpg do Supabase),
          // mantemos a imagem local que acabou de ser selecionada pelo usuário
          if (p.id === saved.id && saved.image_url && saved.image_url !== 'logo.jpg') {
            return { ...p, image_url: saved.image_url };
          }
          return p;
        });
      }

      dom.productEditModal.style.display = 'none';
      renderProducts();
      renderPromotions();
      alert(`Produto "${saved.name}" salvo com sucesso!`);
    } catch (err) {
      console.error('Erro ao salvar produto:', err);
      alert('Erro ao salvar produto. Verifique sua conexão.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Salvar Produto';
      }
    }
  });

  // ==========================================
  // 4. GERENCIAMENTO DE CATEGORIAS
  // ==========================================
  function renderCategories() {
    let html = '';
    adminState.categories.forEach(c => {
      html += `
        <tr>
          <td>${c.order_index || 0}</td>
          <td><strong>${window.escapeHtml(c.name)}</strong></td>
          <td><code style="color: #64748b;">${window.escapeHtml(c.slug || '')}</code></td>
          <td>
            <span class="product-status-pill ${c.is_active !== false ? 'status-active' : 'status-inactive'}">
              ${c.is_active !== false ? 'Ativa' : 'Inativa'}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn-ghost-secondary btn-edit-cat" data-cat-id="${c.id}" style="font-size: 0.78rem;">
                <i class="fi fi-sr-pencil"></i> Editar
              </button>
              <button class="btn-ghost-secondary btn-delete-cat" data-cat-id="${c.id}" style="font-size: 0.78rem; color: var(--primary-red);" title="Excluir Categoria">
                <i class="fi fi-sr-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });
    dom.adminCategoriesTableBody.innerHTML = html;

    dom.adminCategoriesTableBody.querySelectorAll('.btn-edit-cat').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-cat-id');
        openCategoryModal(id);
      });
    });

    dom.adminCategoriesTableBody.querySelectorAll('.btn-delete-cat').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-cat-id');
        if (confirm('Tem certeza que deseja excluir esta categoria?')) {
          await window.db.deleteCategory(id);
          adminState.categories = adminState.categories.filter(c => c.id !== id);
          renderCategories();
          renderProducts();
        }
      });
    });
  }

  function openCategoryModal(catId = null) {
    if (catId) {
      const cat = adminState.categories.find(c => c.id === catId);
      if (!cat) return;
      dom.categoryModalTitle.textContent = 'Editar Categoria';
      dom.editCatId.value = cat.id;
      dom.editCatName.value = cat.name || '';
      dom.editCatOrder.value = cat.order_index !== undefined ? cat.order_index : 0;
      dom.editCatActive.value = String(cat.is_active !== false);
    } else {
      dom.categoryModalTitle.textContent = 'Nova Categoria';
      dom.editCatId.value = '';
      dom.editCatName.value = '';
      dom.editCatOrder.value = adminState.categories.length + 1;
      dom.editCatActive.value = 'true';
    }
    dom.categoryEditModal.style.display = 'flex';
  }

  if (dom.btnCategoryModalClose) dom.btnCategoryModalClose.addEventListener('click', () => dom.categoryEditModal.style.display = 'none');
  if (dom.btnCategoryModalCancel) dom.btnCategoryModalCancel.addEventListener('click', () => dom.categoryEditModal.style.display = 'none');

  if (dom.categoryEditForm) {
    dom.categoryEditForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = dom.editCatId.value;
      const name = dom.editCatName.value.trim();
      const order_index = Number(dom.editCatOrder.value) || 0;
      const is_active = dom.editCatActive.value === 'true';

      if (!name) return;
      const payload = { name, order_index, is_active };
      if (id) payload.id = id;

      const saved = await window.db.saveCategory(payload);
      if (id) {
        adminState.categories = adminState.categories.map(c => c.id === id ? saved : c);
      } else {
        adminState.categories.push(saved);
      }
      dom.categoryEditModal.style.display = 'none';
      renderCategories();
      renderProducts();
    });
  }

  dom.btnOpenAddCategory.addEventListener('click', () => openCategoryModal(null));

  // ==========================================
  // 5. PROMOÇÕES POR DIA DA SEMANA
  // ==========================================
  function openDayPromoModal(productId = null) {
    if (!dom.dayPromoModal || !dom.dayPromoProdSelect) return;

    // Popula o select de produtos ordenado por categoria e nome
    let optionsHtml = '<option value="">-- Escolha o produto --</option>';
    adminState.products.forEach(p => {
      const isSelected = p.id === productId;
      const formattedPrice = p.price !== null && p.price !== undefined ? window.formatCurrency(p.price) : 'Sem preço';
      optionsHtml += `<option value="${p.id}" ${isSelected ? 'selected' : ''}>${window.escapeHtml(p.name)} (${formattedPrice})</option>`;
    });
    dom.dayPromoProdSelect.innerHTML = optionsHtml;

    const dayCheckboxes = document.querySelectorAll('input[name="dayPromoDayCheckbox"]');

    function fillProductPromoData(prod) {
      if (!prod) {
        dom.dayPromoProdId.value = '';
        dom.dayPromoRegularPrice.value = '';
        dom.dayPromoPrice.value = '';
        if (dom.dayPromoLabel) dom.dayPromoLabel.value = '';
        if (dom.dayPromoActive) dom.dayPromoActive.value = 'true';
        dayCheckboxes.forEach(cb => { cb.checked = false; });
        if (dom.btnRemoveDayPromo) dom.btnRemoveDayPromo.style.display = 'none';
        return;
      }

      dom.dayPromoProdId.value = prod.id;
      dom.dayPromoRegularPrice.value = (prod.price !== null && prod.price !== undefined) ? prod.price : '';
      dom.dayPromoPrice.value = prod.promo_price || prod.monday_price || '';
      if (dom.dayPromoLabel) dom.dayPromoLabel.value = prod.promo_label || '';
      if (dom.dayPromoActive) dom.dayPromoActive.value = String(prod.is_promo !== false);

      const activeDays = window.normalizePromoDays ? window.normalizePromoDays(prod.promo_days, prod.monday_price).map(String) : (Array.isArray(prod.promo_days) ? prod.promo_days.map(String) : (prod.monday_price ? ['1'] : []));
      dayCheckboxes.forEach(cb => { cb.checked = activeDays.includes(String(cb.value)); });

      const hasPromo = Boolean(prod.promo_price || prod.monday_price || (activeDays.length > 0));
      if (dom.btnRemoveDayPromo) dom.btnRemoveDayPromo.style.display = hasPromo ? 'inline-flex' : 'none';
    }

    const initialProd = productId ? adminState.products.find(p => p.id === productId) : null;
    fillProductPromoData(initialProd);

    dom.dayPromoProdSelect.onchange = () => {
      const selectedId = dom.dayPromoProdSelect.value;
      const prod = adminState.products.find(p => p.id === selectedId);
      fillProductPromoData(prod);
    };

    dom.dayPromoModal.style.display = 'flex';
  }

  if (dom.btnOpenDayPromoModal) {
    dom.btnOpenDayPromoModal.addEventListener('click', () => openDayPromoModal(null));
  }
  if (dom.btnOpenAddPromotionTab) {
    dom.btnOpenAddPromotionTab.addEventListener('click', () => openDayPromoModal(null));
  }

  if (dom.btnDayPromoModalClose) {
    dom.btnDayPromoModalClose.addEventListener('click', () => { dom.dayPromoModal.style.display = 'none'; });
  }

  if (dom.btnDayPromoModalCancel) {
    dom.btnDayPromoModalCancel.addEventListener('click', () => { dom.dayPromoModal.style.display = 'none'; });
  }

  if (dom.btnRemoveDayPromo) {
    dom.btnRemoveDayPromo.addEventListener('click', async () => {
      const prodId = dom.dayPromoProdId.value || dom.dayPromoProdSelect.value;
      if (!prodId) return;
      if (!confirm('Deseja remover a promoção por dia da semana deste produto?')) return;

      const prod = adminState.products.find(p => p.id === prodId);
      if (prod) {
        prod.is_promo = false;
        prod.promo_days = [];
        prod.promo_price = null;
        prod.promo_label = null;
        prod.monday_price = null;
        const saved = await window.db.saveProduct(prod);
        adminState.products = adminState.products.map(p => p.id === prodId ? saved : p);
        renderProducts();
        renderPromotions();
      }
      dom.dayPromoModal.style.display = 'none';
    });
  }

  if (dom.dayPromoForm) {
    dom.dayPromoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const prodId = dom.dayPromoProdId.value || dom.dayPromoProdSelect.value;
      if (!prodId) {
        alert('Por favor, selecione um produto.');
        return;
      }

      const prod = adminState.products.find(p => p.id === prodId);
      if (!prod) return;

      const regularPrice = Number(dom.dayPromoRegularPrice.value) || 0;
      const promoPrice = Number(dom.dayPromoPrice.value) || 0;
      const promoLabel = dom.dayPromoLabel ? dom.dayPromoLabel.value.trim() : '';
      const is_promo = dom.dayPromoActive ? dom.dayPromoActive.value === 'true' : true;

      const checkedDays = Array.from(document.querySelectorAll('input[name="dayPromoDayCheckbox"]:checked')).map(cb => Number(cb.value));

      if (checkedDays.length === 0 && is_promo) {
        alert('Selecione pelo menos um dia da semana para a promoção.');
        return;
      }

      prod.price = regularPrice;
      prod.promo_price = promoPrice;
      prod.promo_days = checkedDays;
      prod.promo_label = promoLabel || null;
      prod.is_promo = is_promo;
      prod.monday_price = checkedDays.includes(1) ? promoPrice : null;

      const saved = await window.db.saveProduct(prod);
      adminState.products = adminState.products.map(p => p.id === prodId ? saved : p);

      dom.dayPromoModal.style.display = 'none';
      renderProducts();
      renderPromotions();
    });
  }

  function renderPromotions() {
    if (!dom.adminPromotionsTableBody) return;

    const todayDay = new Date().getDay();
    const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const DAY_NAMES_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    const promoFilter = dom.adminFilterPromoDay ? dom.adminFilterPromoDay.value : 'all';
    const searchQuery = dom.adminSearchPromoInput ? dom.adminSearchPromoInput.value.toLowerCase().trim() : '';

    // Coleta todos os produtos que possuem promoção configurada
    const promoProducts = (adminState.products || []).filter(p => {
      const pPrice = Number(p.promo_price) || Number(p.monday_price) || 0;
      const pDays = window.normalizePromoDays ? window.normalizePromoDays(p.promo_days, p.monday_price) : (Array.isArray(p.promo_days) ? p.promo_days : []);
      return pPrice > 0 && pDays.length > 0;
    });

    // Atualiza contadores
    let countActiveToday = 0;
    promoProducts.forEach(p => {
      if (p.is_promo !== false && window.isPromoActiveToday ? window.isPromoActiveToday(p, todayDay) : false) {
        countActiveToday++;
      }
    });

    if (dom.promoStatTotal) dom.promoStatTotal.textContent = String(promoProducts.length);
    if (dom.promoStatToday) dom.promoStatToday.textContent = `${countActiveToday} (Hoje: ${DAY_NAMES_FULL[todayDay]})`;

    // Filtra lista para a tabela
    let filtered = promoProducts.filter(p => {
      const pDays = window.normalizePromoDays ? window.normalizePromoDays(p.promo_days, p.monday_price) : [];
      
      if (promoFilter === 'today') {
        if (!pDays.includes(todayDay) || p.is_promo === false) return false;
      } else if (promoFilter !== 'all') {
        const filterDayNum = Number(promoFilter);
        if (!pDays.includes(filterDayNum)) return false;
      }

      if (searchQuery) {
        const nameMatch = (p.name || '').toLowerCase().includes(searchQuery);
        const descMatch = (p.description || '').toLowerCase().includes(searchQuery);
        const labelMatch = (p.promo_label || '').toLowerCase().includes(searchQuery);
        if (!nameMatch && !descMatch && !labelMatch) return false;
      }

      return true;
    });

    if (filtered.length === 0) {
      dom.adminPromotionsTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 40px; color: #94a3b8;">
            <i class="fi fi-sr-flame" style="font-size: 2rem; color: #cbd5e1; display: block; margin-bottom: 8px;"></i>
            Nenhuma promoção encontrada com os filtros selecionados.
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    filtered.forEach(p => {
      const pDays = window.normalizePromoDays ? window.normalizePromoDays(p.promo_days, p.monday_price) : [];
      const promoPrice = Number(p.promo_price) || Number(p.monday_price) || 0;
      const regularPrice = Number(p.price) || 0;
      const isToday = pDays.includes(todayDay) && (p.is_promo !== false);
      const isAct = p.is_promo !== false;

      let discountText = '';
      if (regularPrice > 0 && promoPrice > 0 && regularPrice > promoPrice) {
        const discountPct = Math.round(((regularPrice - promoPrice) / regularPrice) * 100);
        discountText = `<span style="font-size: 0.72rem; font-weight: 800; color: #16a34a; background: #dcfce7; padding: 1px 6px; border-radius: 4px; margin-left: 4px;">-${discountPct}%</span>`;
      }

      let dayBadgesHtml = pDays.map(d => {
        const isThisDay = d === todayDay;
        return `<span style="display: inline-block; font-size: 0.74rem; font-weight: 700; padding: 2px 7px; border-radius: 5px; margin-right: 4px; margin-bottom: 3px; background: ${isThisDay ? '#dcfce7' : '#f1f5f9'}; color: ${isThisDay ? '#166534' : '#475569'}; border: 1px solid ${isThisDay ? '#86efac' : '#cbd5e1'};">${DAY_NAMES[d]}${isThisDay ? ' 🔥' : ''}</span>`;
      }).join('');

      html += `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <img class="table-img-thumb" src="${p.image_url || 'boylogo.jpg'}" alt="${window.escapeHtml(p.name)}" />
              <div>
                <strong>${window.escapeHtml(p.name)}</strong>
                ${p.promo_label ? `<div style="font-size: 0.75rem; color: #d97706; font-weight: 700;">🏷️ ${window.escapeHtml(p.promo_label)}</div>` : ''}
              </div>
            </div>
          </td>
          <td><span style="color: #64748b; ${isToday ? 'text-decoration: line-through;' : ''}">${regularPrice > 0 ? window.formatCurrency(regularPrice) : 'A definir'}</span></td>
          <td>
            <strong style="color: #16a34a; font-size: 0.95rem;">${window.formatCurrency(promoPrice)}</strong>
            ${discountText}
          </td>
          <td>
            <div style="display: flex; flex-wrap: wrap; max-width: 260px;">
              ${dayBadgesHtml}
            </div>
          </td>
          <td>
            <span class="product-status-pill ${isAct ? 'status-active' : 'status-inactive'}">
              ${isAct ? (isToday ? '🔥 Ativa Hoje' : 'Ativa') : 'Inativa'}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn-ghost-secondary btn-edit-promo-row" data-prod-id="${p.id}" style="font-size: 0.78rem;">
                <i class="fi fi-sr-pencil"></i> Editar
              </button>
              <button class="btn-ghost-secondary btn-delete-promo-row" data-prod-id="${p.id}" style="font-size: 0.78rem; color: var(--primary-red);" title="Remover Promoção">
                <i class="fi fi-sr-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    dom.adminPromotionsTableBody.innerHTML = html;

    // Conecta botões da tabela de promoções
    dom.adminPromotionsTableBody.querySelectorAll('.btn-edit-promo-row').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-prod-id');
        openDayPromoModal(id);
      });
    });

    dom.adminPromotionsTableBody.querySelectorAll('.btn-delete-promo-row').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-prod-id');
        const prod = adminState.products.find(p => p.id === id);
        if (!prod) return;
        if (confirm(`Remover a promoção de "${prod.name}"?`)) {
          prod.is_promo = false;
          prod.promo_days = [];
          prod.promo_price = null;
          prod.promo_label = null;
          prod.monday_price = null;
          const saved = await window.db.saveProduct(prod);
          adminState.products = adminState.products.map(p => p.id === id ? saved : p);
          renderProducts();
          renderPromotions();
        }
      });
    });
  }

  if (dom.adminSearchPromoInput) {
    dom.adminSearchPromoInput.addEventListener('input', () => renderPromotions());
  }
  if (dom.adminFilterPromoDay) {
    dom.adminFilterPromoDay.addEventListener('change', () => renderPromotions());
  }

  // ==========================================
  // 6. ADICIONAIS / OPCIONAIS
  // ==========================================
  function renderOptionals() {
    let html = '';
    adminState.optionals.forEach(o => {
      const optName = (o.name || '').toLowerCase();
      const target = o.target || (optName.includes('brasa') ? 'brasa' : optName.includes('chapa') ? 'chapa' : 'all');
      
      let targetBadge = '<span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; background: #e0f2fe; color: #0369a1;">Todos (Geral)</span>';
      if (target === 'brasa') {
        targetBadge = '<span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; background: #fee2e2; color: #b91c1c;">🔥 Na Brasa</span>';
      } else if (target === 'chapa') {
        targetBadge = '<span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; background: #fef3c7; color: #b45309;">🍳 Na Chapa</span>';
      }

      html += `
        <tr>
          <td><strong>${window.escapeHtml(o.name)}</strong></td>
          <td><strong>+ ${window.formatCurrency(o.price)}</strong></td>
          <td>${targetBadge}</td>
          <td>
            <span class="product-status-pill ${o.is_active !== false ? 'status-active' : 'status-inactive'}">
              ${o.is_active !== false ? 'Ativo' : 'Inativo'}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn-ghost-secondary btn-edit-opt" data-opt-id="${o.id}" style="font-size: 0.78rem;">
                <i class="fi fi-sr-pencil"></i> Editar
              </button>
              <button class="btn-ghost-secondary btn-delete-opt" data-opt-id="${o.id}" style="font-size: 0.78rem; color: var(--primary-red);" title="Excluir Adicional">
                <i class="fi fi-sr-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });
    dom.adminOptionalsTableBody.innerHTML = html;

    dom.adminOptionalsTableBody.querySelectorAll('.btn-edit-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-opt-id');
        openOptionalModal(id);
      });
    });

    dom.adminOptionalsTableBody.querySelectorAll('.btn-delete-opt').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-opt-id');
        if (confirm('Deseja excluir este adicional?')) {
          await window.db.deleteOptional(id);
          adminState.optionals = adminState.optionals.filter(o => o.id !== id);
          renderOptionals();
        }
      });
    });
  }

  function buildOptCategoryCheckboxes(selectedIds) {
    const container = document.getElementById('optCategoriesCheckboxes');
    if (!container) return;
    const selected = Array.isArray(selectedIds) ? selectedIds.map(String) : [];
    container.innerHTML = adminState.categories.map(cat => `
      <label style="display: flex; align-items: center; gap: 8px; font-size: 0.83rem; cursor: pointer;">
        <input type="checkbox" name="optCatApplicability" value="${cat.id}" ${selected.includes(String(cat.id)) ? 'checked' : ''} style="accent-color: #d97706;" />
        ${window.escapeHtml(cat.name)}
      </label>
    `).join('');
  }

  function openOptionalModal(optId = null) {
    const catSection = document.getElementById('optCategoriesCheckboxesSection');

    if (optId) {
      const opt = adminState.optionals.find(o => o.id === optId);
      if (!opt) return;
      dom.optionalModalTitle.textContent = 'Editar Adicional';
      dom.editOptId.value = opt.id;
      dom.editOptName.value = opt.name || '';
      dom.editOptPrice.value = opt.price !== undefined && opt.price !== null ? opt.price : '3.00';
      dom.editOptActive.value = String(opt.is_active !== false);
      const optName = (opt.name || '').toLowerCase();
      const savedTarget = opt.target || (optName.includes('brasa') ? 'brasa' : optName.includes('chapa') ? 'chapa' : 'all');
      dom.editOptTarget.value = savedTarget;
      buildOptCategoryCheckboxes(opt.applicable_category_ids || []);
      if (catSection) catSection.style.display = savedTarget === 'custom' ? 'block' : 'none';
    } else {
      dom.optionalModalTitle.textContent = 'Novo Adicional';
      dom.editOptId.value = '';
      dom.editOptName.value = '';
      dom.editOptPrice.value = '3.00';
      dom.editOptActive.value = 'true';
      dom.editOptTarget.value = 'all';
      buildOptCategoryCheckboxes([]);
      if (catSection) catSection.style.display = 'none';
    }
    dom.optionalEditModal.style.display = 'flex';
  }

  // Mostrar/ocultar checkboxes ao mudar target
  if (dom.editOptTarget) {
    dom.editOptTarget.addEventListener('change', () => {
      const catSection = document.getElementById('optCategoriesCheckboxesSection');
      if (catSection) catSection.style.display = dom.editOptTarget.value === 'custom' ? 'block' : 'none';
    });
  }

  if (dom.btnOptionalModalClose) dom.btnOptionalModalClose.addEventListener('click', () => dom.optionalEditModal.style.display = 'none');
  if (dom.btnOptionalModalCancel) dom.btnOptionalModalCancel.addEventListener('click', () => dom.optionalEditModal.style.display = 'none');

  if (dom.optionalEditForm) {
    dom.optionalEditForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = dom.editOptId.value;
      const name = dom.editOptName.value.trim();
      const price = Number(dom.editOptPrice.value) || 0;
      const is_active = dom.editOptActive.value === 'true';
      const target = dom.editOptTarget ? dom.editOptTarget.value : 'all';

      // Coleta categorias selecionadas
      const checkedCats = Array.from(document.querySelectorAll('input[name="optCatApplicability"]:checked'));
      const applicable_category_ids = checkedCats.map(cb => cb.value);

      if (!name) return;
      const payload = { name, price, is_active, target, applicable_category_ids };
      if (id) payload.id = id;

      const saved = await window.db.saveOptional(payload);
      if (id) {
        adminState.optionals = adminState.optionals.map(o => o.id === id ? saved : o);
      } else {
        adminState.optionals.push(saved);
      }
      dom.optionalEditModal.style.display = 'none';
      renderOptionals();
    });
  }

  dom.btnOpenAddOptional.addEventListener('click', () => openOptionalModal(null));

  // ==========================================
  // ==========================================
  // 8. GESTÃO DE BAIRROS E TAXAS DE ENTREGA
  // ==========================================
  function renderNeighborhoods() {
    let list = adminState.neighborhoods || [];
    const query = (adminState.neighborhoodSearch || '').toLowerCase().trim();

    if (query) {
      list = list.filter(n => (n.name || '').toLowerCase().includes(query));
    }

    let rowsHtml = '';
    list.forEach(n => {
      const isAct = n.is_active !== false;
      rowsHtml += `
        <tr>
          <td><strong>${n.name}</strong></td>
          <td><span style="font-size: 0.85rem; color: #64748b;">${n.delivery_time_min || 60} min</span></td>
          <td><strong style="color: #d97706; font-size: 1rem;">${window.formatCurrency(n.delivery_fee)}</strong></td>
          <td>
            <span class="product-status-pill ${isAct ? 'status-active' : 'status-inactive'}">
              ${isAct ? 'Ativo' : 'Inativo'}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn-ghost-secondary btn-edit-neighborhood" data-id="${n.id}" style="font-size: 0.78rem;">
                <i class="fi fi-sr-pencil"></i> Editar
              </button>
              <button class="btn-ghost-secondary btn-delete-neighborhood" data-id="${n.id}" style="font-size: 0.78rem; color: var(--primary-red);" title="Excluir Bairro">
                <i class="fi fi-sr-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    dom.adminNeighborhoodsTableBody.innerHTML = rowsHtml || `<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhum bairro encontrado</td></tr>`;

    dom.adminNeighborhoodsTableBody.querySelectorAll('.btn-edit-neighborhood').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        openNeighborhoodModal(id);
      });
    });

    dom.adminNeighborhoodsTableBody.querySelectorAll('.btn-delete-neighborhood').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Deseja excluir este bairro?')) {
          await window.db.deleteNeighborhood(id);
          adminState.neighborhoods = adminState.neighborhoods.filter(n => n.id !== id);
          renderNeighborhoods();
          populateWaNeighborhoodsSelect();
        }
      });
    });
  }

  function openNeighborhoodModal(id = null) {
    if (id) {
      const found = (adminState.neighborhoods || []).find(n => n.id === id);
      if (!found) return;
      dom.neighborhoodModalTitle.textContent = 'Editar Bairro';
      dom.editNeighborhoodId.value = found.id;
      dom.editNeighborhoodName.value = found.name;
      dom.editNeighborhoodFee.value = found.delivery_fee;
      dom.editNeighborhoodTime.value = found.delivery_time_min || 60;
      dom.editNeighborhoodActive.value = String(found.is_active !== false);
    } else {
      dom.neighborhoodModalTitle.textContent = 'Novo Bairro';
      dom.editNeighborhoodId.value = '';
      dom.editNeighborhoodName.value = '';
      dom.editNeighborhoodFee.value = '8.00';
      dom.editNeighborhoodTime.value = '60';
      dom.editNeighborhoodActive.value = 'true';
    }
    dom.neighborhoodEditModal.style.display = 'flex';
  }

  dom.btnOpenAddNeighborhood.addEventListener('click', () => openNeighborhoodModal(null));
  dom.btnNeighborhoodModalClose.addEventListener('click', () => { dom.neighborhoodEditModal.style.display = 'none'; });
  dom.btnNeighborhoodModalCancel.addEventListener('click', () => { dom.neighborhoodEditModal.style.display = 'none'; });

  dom.neighborhoodEditForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = dom.editNeighborhoodId.value;
    const payload = {
      name: dom.editNeighborhoodName.value.trim(),
      delivery_fee: Number(dom.editNeighborhoodFee.value) || 0,
      delivery_time_min: Number(dom.editNeighborhoodTime.value) || 60,
      is_active: dom.editNeighborhoodActive.value === 'true'
    };
    if (id) payload.id = id;

    const saved = await window.db.saveNeighborhood(payload);
    if (id) {
      adminState.neighborhoods = adminState.neighborhoods.map(n => n.id === id ? saved : n);
    } else {
      adminState.neighborhoods.push(saved);
    }

    dom.neighborhoodEditModal.style.display = 'none';
    renderNeighborhoods();
    populateWaNeighborhoodsSelect();
  });

  dom.adminSearchNeighborhoodInput.addEventListener('input', (e) => {
    adminState.neighborhoodSearch = e.target.value;
    renderNeighborhoods();
  });

  // ==========================================
  // 9. FECHAMENTO DE CAIXA DIÁRIO & ACERTO DE ENTREGADORES
  // ==========================================
  function renderCashReport() {
    const reportDate = adminState.selectedCashDate || getBusinessDateString(new Date());
    dom.cashReportDatePicker.value = reportDate;

    // Filtra apenas pedidos finalizados do dia de expediente
    const dayOrders = adminState.orders.filter(o => {
      const oDate = getBusinessDateString(o.created_at);
      return oDate === reportDate && o.status === 'finalizado';
    });

    // Totais Gerais
    let totalRevenue = 0;
    let totalCash = 0;
    let totalPix = 0;
    let totalCard = 0;
    let totalDeliveryFees = 0;

    let mesaRev = 0, mesaCount = 0;
    let balcaoRev = 0, balcaoCount = 0;
    let deliveryRev = 0, deliveryCount = 0;

    dayOrders.forEach(o => {
      const ordTotal = Number(o.total) || 0;
      const ordFee = Number(o.delivery_fee) || 0;
      totalRevenue += ordTotal;
      totalDeliveryFees += ordFee;

      const pay = (o.payment_method || '').toLowerCase();
      if (pay === 'dinheiro') totalCash += ordTotal;
      else if (pay === 'pix') totalPix += ordTotal;
      else if (pay === 'cartao') totalCard += ordTotal;
      else if (pay === 'pendente') totalCash += ordTotal; // pendente fechado

      if (o.order_type === 'mesa' || o.table_number) {
        mesaRev += ordTotal;
        mesaCount++;
      } else if (o.order_type === 'balcao' || o.order_type === 'pickup' || o.order_type === 'retirada') {
        balcaoRev += ordTotal;
        balcaoCount++;
      } else if (o.order_type === 'delivery') {
        deliveryRev += ordTotal;
        deliveryCount++;
      } else {
        // fallback: sem tipo definido e sem mesa → balcão
        balcaoRev += ordTotal;
        balcaoCount++;
      }
    });

    dom.cashStatTotalRevenue.textContent = window.formatCurrency(totalRevenue);
    dom.cashStatCashTotal.textContent = window.formatCurrency(totalCash);
    dom.cashStatPixTotal.textContent = window.formatCurrency(totalPix);
    dom.cashStatCardTotal.textContent = window.formatCurrency(totalCard);

    dom.cashChannelMesa.textContent = `${window.formatCurrency(mesaRev)} (${mesaCount} pedidos)`;
    dom.cashChannelBalcao.textContent = `${window.formatCurrency(balcaoRev)} (${balcaoCount} pedidos)`;
    dom.cashChannelDelivery.textContent = `${window.formatCurrency(deliveryRev)} (${deliveryCount} pedidos)`;
    dom.cashTotalDeliveryFees.textContent = window.formatCurrency(totalDeliveryFees);

    // Acerto individual dos entregadores
    renderCouriersReport(dayOrders, reportDate);

    // Atualiza status do caixa e histórico
    updateCashStatusBadge(reportDate);
    renderCashClosingsHistory();
  }

  async function updateCashStatusBadge(reportDate) {
    const closings = await window.db.getCashClosings();
    const found = closings.find(c => (c.closing_date || c.date) === reportDate);

    if (found) {
      const closedTime = found.closed_at ? new Date(found.closed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
      dom.cashCurrentStatusBadge.innerHTML = `<i class="fi fi-sr-lock"></i> Caixa Fechado às ${closedTime} (Total: ${window.formatCurrency(found.total_revenue)})`;
      dom.cashCurrentStatusBadge.style.color = '#fbbf24';
      dom.btnOpenManualCashClose.innerHTML = '<i class="fi fi-sr-refresh"></i> Re-Fechar / Atualizar Caixa';
    } else {
      dom.cashCurrentStatusBadge.innerHTML = '<i class="fi fi-sr-circle" style="color: #34d399; font-size: 0.8em;"></i> Caixa Aberto (Expediente em Andamento)';
      dom.cashCurrentStatusBadge.style.color = '#34d399';
      dom.btnOpenManualCashClose.innerHTML = '<i class="fi fi-sr-lock"></i> Fechar Caixa Manualmente';
    }
  }

  async function renderCashClosingsHistory() {
    const closings = await window.db.getCashClosings();
    if (!closings || closings.length === 0) {
      dom.cashClosingsHistoryTableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhum fechamento registrado ainda.</td></tr>`;
      return;
    }

    let rowsHtml = '';
    closings.forEach(c => {
      const dateStr = c.closing_date || c.date || '--/--/----';
      const closedAtStr = c.closed_at ? new Date(c.closed_at).toLocaleString('pt-BR') : '--:--';
      const diffStr = c.difference !== null && c.difference !== undefined 
        ? (c.difference === 0 ? '<span style="color:#10b981;font-weight:700;">Batendo (R$ 0,00)</span>' 
        : c.difference > 0 ? `<span style="color:#2563eb;font-weight:700;">+ Sobra: ${window.formatCurrency(c.difference)}</span>` 
        : `<span style="color:#ef4444;font-weight:700;">- Falta: ${window.formatCurrency(Math.abs(c.difference))}</span>`) 
        : '--';

      rowsHtml += `
        <tr>
          <td><strong>${new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR')}</strong></td>
          <td><span style="font-size: 0.8rem; color: #64748b;">${closedAtStr}</span></td>
          <td><strong>${c.orders_count || 0} ped</strong></td>
          <td><strong style="color: #10b981; font-size: 0.95rem;">${window.formatCurrency(c.total_revenue)}</strong></td>
          <td>${window.formatCurrency(c.total_cash)}</td>
          <td>${window.formatCurrency(c.total_pix)}</td>
          <td>${window.formatCurrency(c.total_card)}</td>
          <td><span style="font-size: 0.78rem; color: #475569;">${c.notes || 'Sem observações'}</span></td>
          <td>
            <button type="button" class="btn-ghost-secondary btn-reprint-closing" data-date="${dateStr}" style="font-size: 0.78rem;">
              <i class="fi fi-sr-print"></i> Cupom
            </button>
          </td>
        </tr>
      `;
    });

    dom.cashClosingsHistoryTableBody.innerHTML = rowsHtml;

    dom.cashClosingsHistoryTableBody.querySelectorAll('.btn-reprint-closing').forEach(btn => {
      btn.addEventListener('click', () => {
        const d = btn.getAttribute('data-date');
        printDailyCashSummary(d);
      });
    });
  }

  // Abertura do Modal de Fechamento Manual
  function openManualCashCloseModal() {
    const reportDate = adminState.selectedCashDate || getBusinessDateString(new Date());
    const dayOrders = adminState.orders.filter(o => {
      const oDate = getBusinessDateString(o.created_at);
      return oDate === reportDate && o.status === 'finalizado';
    });

    let totalRevenue = 0;
    let totalCash = 0;
    let totalPix = 0;
    let totalCard = 0;
    let totalDeliveryFees = 0;

    dayOrders.forEach(o => {
      const ordTotal = Number(o.total) || 0;
      const ordFee = Number(o.delivery_fee) || 0;
      totalRevenue += ordTotal;
      totalDeliveryFees += ordFee;

      const pay = (o.payment_method || '').toLowerCase();
      if (pay === 'dinheiro' || pay === 'pendente') totalCash += ordTotal;
      else if (pay === 'pix') totalPix += ordTotal;
      else if (pay === 'cartao') totalCard += ordTotal;
    });

    dom.closeModalDate.textContent = new Date(reportDate + 'T12:00:00').toLocaleDateString('pt-BR');
    dom.closeModalOrdersCount.textContent = `${dayOrders.length} pedidos`;
    dom.closeModalCashTotal.textContent = window.formatCurrency(totalCash);
    dom.closeModalPixTotal.textContent = window.formatCurrency(totalPix);
    dom.closeModalCardTotal.textContent = window.formatCurrency(totalCard);
    dom.closeModalDeliveryFeesTotal.textContent = window.formatCurrency(totalDeliveryFees);
    dom.closeModalGrandTotal.textContent = window.formatCurrency(totalRevenue);

    dom.closeModalInitialFund.value = '0.00';
    dom.closeModalCountedCash.value = totalCash > 0 ? totalCash.toFixed(2) : '0.00';
    dom.closeModalNotes.value = '';

    function recalculateDiff() {
      const fund = Number(dom.closeModalInitialFund.value) || 0;
      const counted = Number(dom.closeModalCountedCash.value) || 0;
      const expected = totalCash + fund;

      dom.closeModalExpectedCash.textContent = window.formatCurrency(expected);
      const diff = counted - expected;

      if (Math.abs(diff) < 0.01) {
        dom.closeModalDiffText.textContent = 'Diferença: R$ 0,00 (Conferência exata ✅)';
        dom.closeModalDiffText.style.color = '#15803d';
      } else if (diff > 0) {
        dom.closeModalDiffText.textContent = `Diferença: + ${window.formatCurrency(diff)} (Sobra em caixa 📈)`;
        dom.closeModalDiffText.style.color = '#1d4ed8';
      } else {
        dom.closeModalDiffText.textContent = `Diferença: - ${window.formatCurrency(Math.abs(diff))} (Falta em caixa ⚠️)`;
        dom.closeModalDiffText.style.color = '#b91c1c';
      }
    }

    dom.closeModalInitialFund.oninput = recalculateDiff;
    dom.closeModalCountedCash.oninput = recalculateDiff;
    recalculateDiff();

    dom.manualCashCloseModal.style.display = 'flex';
  }

  dom.btnOpenManualCashClose.addEventListener('click', openManualCashCloseModal);
  dom.btnManualCashCloseModalClose.addEventListener('click', () => { dom.manualCashCloseModal.style.display = 'none'; });
  dom.btnCancelManualCashClose.addEventListener('click', () => { dom.manualCashCloseModal.style.display = 'none'; });

  dom.btnConfirmManualCashClose.addEventListener('click', async () => {
    const reportDate = adminState.selectedCashDate || getBusinessDateString(new Date());
    const dayOrders = adminState.orders.filter(o => {
      const oDate = getBusinessDateString(o.created_at);
      return oDate === reportDate && o.status === 'finalizado';
    });

    let totalRevenue = 0;
    let totalCash = 0;
    let totalPix = 0;
    let totalCard = 0;
    let totalDeliveryFees = 0;

    dayOrders.forEach(o => {
      const ordTotal = Number(o.total) || 0;
      const ordFee = Number(o.delivery_fee) || 0;
      totalRevenue += ordTotal;
      totalDeliveryFees += ordFee;

      const pay = (o.payment_method || '').toLowerCase();
      if (pay === 'dinheiro' || pay === 'pendente') totalCash += ordTotal;
      else if (pay === 'pix') totalPix += ordTotal;
      else if (pay === 'cartao') totalCard += ordTotal;
    });

    const initialFund = Number(dom.closeModalInitialFund.value) || 0;
    const countedCash = Number(dom.closeModalCountedCash.value) || 0;
    const expected = totalCash + initialFund;
    const diff = countedCash - expected;
    const notes = dom.closeModalNotes.value.trim();

    const closingPayload = {
      closing_date: reportDate,
      closed_at: new Date().toISOString(),
      total_revenue: totalRevenue,
      total_cash: totalCash,
      total_pix: totalPix,
      total_card: totalCard,
      total_delivery_fees: totalDeliveryFees,
      initial_fund: initialFund,
      counted_cash: countedCash,
      difference: diff,
      orders_count: dayOrders.length,
      notes: notes
    };

    dom.btnConfirmManualCashClose.disabled = true;
    dom.btnConfirmManualCashClose.textContent = 'Gravando fechamento...';

    try {
      await window.db.saveCashClosing(closingPayload);
      dom.manualCashCloseModal.style.display = 'none';
      
      printDailyCashSummary(reportDate);
      await updateCashStatusBadge(reportDate);
      await renderCashClosingsHistory();

      alert(`✅ Caixa do dia ${new Date(reportDate + 'T12:00:00').toLocaleDateString('pt-BR')} fechado com sucesso!\n\nO cupom oficial de fechamento foi gerado para impressão.`);
    } catch (err) {
      console.error('Erro ao salvar fechamento de caixa:', err);
      alert('Erro ao registrar fechamento. Tente novamente.');
    } finally {
      dom.btnConfirmManualCashClose.disabled = false;
      dom.btnConfirmManualCashClose.textContent = '✅ Confirmar Fechamento e Emitir Cupom';
    }
  });

  function renderCouriersReport(dayOrders, reportDate) {
    const couriers = adminState.couriers || [];
    let html = '';

    couriers.forEach(courier => {
      const courierName = courier.name;
      // Pedidos despachados ou entregues por este motoboy
      const courierOrders = dayOrders.filter(o => o.courier_name && o.courier_name.toLowerCase() === courierName.toLowerCase());
      
      const totalDeliveries = courierOrders.length;
      let totalCollectedCash = 0; // Dinheiro que o motoboy recebeu do cliente
      let totalFees = 0; // Taxas de entrega dos pedidos dele
      let totalOrdersAmount = 0; // Valor somado dos pedidos dele

      let ordersRowsHtml = '';
      courierOrders.forEach(o => {
        const ordTotal = Number(o.total) || 0;
        const ordFee = Number(o.delivery_fee) || 0;
        totalOrdersAmount += ordTotal;
        totalFees += ordFee;

        if (o.payment_method === 'dinheiro') {
          totalCollectedCash += ordTotal;
        }

        const neighborhoodName = o.delivery_address?.neighborhood || 'Entrega';

        ordersRowsHtml += `
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; padding: 4px 0; border-bottom: 1px dashed #e2e8f0;">
            <div>
              <strong>#${String(o.order_number).padStart(4, '0')}</strong> • ${window.escapeHtml(o.customer_name || 'Cliente')} (${window.escapeHtml(neighborhoodName)})
              <div style="font-size: 0.72rem; color: #64748b;">Pagamento: ${window.escapeHtml((o.payment_method || '').toUpperCase())} ${o.change_for ? `(Troco: ${window.formatCurrency(o.change_for)})` : ''}</div>
            </div>
            <div style="text-align: right;">
              <strong style="color: #0f172a;">${window.formatCurrency(ordTotal)}</strong>
              <div style="font-size: 0.72rem; color: #d97706;">Taxa: ${window.formatCurrency(ordFee)}</div>
            </div>
          </div>
        `;
      });

      html += `
        <div class="courier-report-card">
          <div>
            <div class="courier-report-card-header">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.5rem;"><i class="fi fi-sr-motorcycle"></i></span>
                <div>
                  <h4 style="margin: 0; font-size: 1.05rem; font-weight: 800;">${window.escapeHtml(courierName)}</h4>
                  <span style="font-size: 0.76rem; color: #64748b;">Entregador Oficial</span>
                </div>
              </div>
              <span class="order-type-badge delivery" style="font-size: 0.8rem;">${totalDeliveries} entrega(s)</span>
            </div>

            <div class="courier-stat-row">
              <span>Total de Corridas / Entregas:</span>
              <strong>${totalDeliveries}</strong>
            </div>

            <div class="courier-stat-row">
              <span><i class="fi fi-sr-money-bill-wave"></i> Dinheiro Recebido na Entrega (a repassar):</span>
              <strong style="color: #2563eb;">${window.formatCurrency(totalCollectedCash)}</strong>
            </div>

            <div class="courier-stat-row">
              <span><i class="fi fi-sr-motorcycle"></i> Total das Taxas de Entrega:</span>
              <strong style="color: #16a34a;">${window.formatCurrency(totalFees)}</strong>
            </div>

            <div class="courier-stat-row highlight">
              <span>Total dos Pedidos Entregues:</span>
              <strong>${window.formatCurrency(totalOrdersAmount)}</strong>
            </div>

            <div style="margin-top: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; max-height: 140px; overflow-y: auto;">
              <div style="font-size: 0.76rem; font-weight: 700; color: #64748b; margin-bottom: 4px;">Extrato de Entregas:</div>
              ${ordersRowsHtml || '<div style="font-size: 0.78rem; color: #94a3b8; text-align: center; padding: 8px;">Nenhuma entrega atribuída nesta data.</div>'}
            </div>
          </div>

          <div style="margin-top: 14px; display: flex; gap: 8px;">
            <button type="button" class="btn-ghost-secondary btn-print-courier-settlement" data-courier="${window.escapeHtml(courierName)}" style="flex: 1; font-size: 0.8rem; font-weight: 700;">
              <i class="fi fi-sr-print"></i> Imprimir Acerto (${window.escapeHtml(courierName)})
            </button>
          </div>
        </div>
      `;
    });

    dom.couriersReportContainer.innerHTML = html;

    dom.couriersReportContainer.querySelectorAll('.btn-print-courier-settlement').forEach(btn => {
      btn.addEventListener('click', () => {
        const cName = btn.getAttribute('data-courier');
        printCourierSettlement(cName, reportDate);
      });
    });

    renderCouriersTable();
  }

  function renderCouriersTable() {
    if (!dom.adminCouriersTableBody) return;
    const list = adminState.couriers || [];
    if (list.length === 0) {
      dom.adminCouriersTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #94a3b8; padding: 18px;">Nenhum entregador cadastrado. Clique em + Novo Entregador acima.</td></tr>`;
      return;
    }

    let rowsHtml = '';
    list.forEach(c => {
      const isAct = c.is_active !== false;
      rowsHtml += `
        <tr>
          <td><strong style="color: #0f172a; font-size: 0.95rem;">🛵 ${window.escapeHtml(c.name)}</strong></td>
          <td><span style="font-size: 0.85rem; color: #64748b;">${window.escapeHtml(c.phone || 'Não informado')}</span></td>
          <td>
            <span class="product-status-pill ${isAct ? 'status-active' : 'status-inactive'}">
              ${isAct ? 'Ativo' : 'Inativo'}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn-ghost-secondary btn-edit-courier" data-id="${c.id}" style="font-size: 0.78rem;">
                <i class="fi fi-sr-pencil"></i> Editar
              </button>
              <button class="btn-ghost-secondary btn-delete-courier" data-id="${c.id}" style="font-size: 0.78rem; color: var(--primary-red);" title="Excluir Entregador">
                <i class="fi fi-sr-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    dom.adminCouriersTableBody.innerHTML = rowsHtml;

    dom.adminCouriersTableBody.querySelectorAll('.btn-edit-courier').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        openCourierModal(id);
      });
    });

    dom.adminCouriersTableBody.querySelectorAll('.btn-delete-courier').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const cour = (adminState.couriers || []).find(c => c.id === id);
        if (confirm(`Deseja excluir o entregador ${cour ? cour.name : ''}?`)) {
          await window.db.deleteCourier(id);
          adminState.couriers = adminState.couriers.filter(c => c.id !== id);
          renderCashReport();
        }
      });
    });
  }

  function openCourierModal(id = null) {
    if (!dom.courierEditModal) return;
    if (id) {
      const found = (adminState.couriers || []).find(c => c.id === id);
      if (!found) return;
      if (dom.courierModalTitle) dom.courierModalTitle.textContent = 'Editar Entregador';
      if (dom.editCourierId) dom.editCourierId.value = found.id;
      if (dom.editCourierName) dom.editCourierName.value = found.name;
      if (dom.editCourierPhone) dom.editCourierPhone.value = found.phone || '';
      if (dom.editCourierActive) dom.editCourierActive.value = String(found.is_active !== false);
    } else {
      if (dom.courierModalTitle) dom.courierModalTitle.textContent = 'Novo Entregador';
      if (dom.editCourierId) dom.editCourierId.value = '';
      if (dom.editCourierName) dom.editCourierName.value = '';
      if (dom.editCourierPhone) dom.editCourierPhone.value = '';
      if (dom.editCourierActive) dom.editCourierActive.value = 'true';
    }
    dom.courierEditModal.style.display = 'flex';
  }

  if (dom.btnOpenAddCourier) {
    dom.btnOpenAddCourier.addEventListener('click', () => openCourierModal(null));
  }
  if (dom.btnCourierModalClose) {
    dom.btnCourierModalClose.addEventListener('click', () => { dom.courierEditModal.style.display = 'none'; });
  }
  if (dom.btnCourierModalCancel) {
    dom.btnCourierModalCancel.addEventListener('click', () => { dom.courierEditModal.style.display = 'none'; });
  }

  if (dom.courierEditForm) {
    dom.courierEditForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = dom.editCourierId.value;
      const name = dom.editCourierName.value.trim();
      const phone = dom.editCourierPhone ? dom.editCourierPhone.value.trim() : '';
      const is_active = dom.editCourierActive.value === 'true';

      if (!name) return;

      const payload = {
        name,
        phone,
        is_active
      };
      if (id) payload.id = id;

      try {
        const saved = await window.db.saveCourier(payload);
        if (id) {
          adminState.couriers = adminState.couriers.map(c => c.id === id ? saved : c);
        } else {
          adminState.couriers.push(saved);
        }
        dom.courierEditModal.style.display = 'none';
        renderCashReport();
        alert(`Entregador ${name} salvo com sucesso!`);
      } catch (err) {
        console.error('Erro ao salvar entregador:', err);
        alert('Erro ao salvar entregador. Tente novamente.');
      }
    });
  }

  // Impressão do Acerto Individual do Entregador
  function printCourierSettlement(courierName, reportDate) {
    const dayOrders = adminState.orders.filter(o => {
      const oDate = getBusinessDateString(o.created_at);
      return oDate === reportDate && o.status === 'finalizado' && o.courier_name && o.courier_name.toLowerCase() === courierName.toLowerCase();
    });

    let deliveriesStr = '';
    let totalCash = 0;
    let totalFees = 0;
    let totalOrders = 0;

    dayOrders.forEach((o, idx) => {
      const ordTotal = Number(o.total) || 0;
      const ordFee = Number(o.delivery_fee) || 0;
      totalOrders += ordTotal;
      totalFees += ordFee;
      if (o.payment_method === 'dinheiro') totalCash += ordTotal;

      deliveriesStr += `
        <div>
          ${idx + 1}. Pedido #${String(o.order_number).padStart(4, '0')} - ${window.escapeHtml(o.customer_name || 'Cliente')}<br />
          &nbsp;&nbsp;Bairro: ${window.escapeHtml(o.delivery_address?.neighborhood || 'N/A')}<br />
          &nbsp;&nbsp;Pag: ${window.escapeHtml((o.payment_method || '').toUpperCase())} | Valor: ${window.formatCurrency(ordTotal)} | Taxa: ${window.formatCurrency(ordFee)}
        </div>
        <hr style="border: none; border-top: 1px dotted #ccc; margin: 4px 0;" />
      `;
    });

    const printWin = window.open('', '_blank', 'width=400,height=600');
    printWin.document.write(`
      <html>
        <head>
          <title>Acerto Entregador - ${window.escapeHtml(courierName)}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; text-align: center !important; }
            html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; background: #fff; text-align: center !important; }
            .ticket-wrapper {
              font-family: Arial, Helvetica, 'Segoe UI', 'Courier New', sans-serif;
              font-size: 15px;
              font-weight: 900;
              color: #000;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 auto !important;
              padding: 4px 7mm 24px 7mm !important;
              word-break: break-word;
              line-height: 1.3;
              text-align: center !important;
              box-sizing: border-box !important;
            }
            h2 { font-size: 20px; font-weight: 900; text-align: center !important; margin: 2px 0; letter-spacing: 0.5px; }
            h3 { font-size: 17px; font-weight: 900; text-align: center !important; margin: 2px 0; }
            hr { border: none; border-top: 2px dashed #000; margin: 5px auto; width: 100%; }
            @media print {
              @page { margin: 0; size: auto; }
              html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; text-align: center !important; }
              .ticket-wrapper {
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 auto !important;
                padding: 4px 7mm 24px 7mm !important;
                text-align: center !important;
                box-sizing: border-box !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="ticket-wrapper">
            <h2>BOYDEGUSTA</h2>
            <h3>ACERTO DE ENTREGADOR</h3>
            <div style="text-align: center; font-weight: 900; font-size: 16px; margin: 4px auto; padding: 3px; border: 2px solid #000; display: block;">🛵 ${window.escapeHtml(courierName.toUpperCase())}</div>
            <div style="text-align: center; font-size: 13px; font-weight: 900; margin: 2px 0;">Data: ${new Date(reportDate + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
            <hr />
            <div><strong>Total de Entregas:</strong> ${dayOrders.length}</div>
            <div><strong>Dinheiro em Mãos:</strong> ${window.formatCurrency(totalCash)}</div>
            <div><strong>Total de Taxas:</strong> ${window.formatCurrency(totalFees)}</div>
            <div style="font-size: 16px; font-weight: 900; margin-top: 4px;">Total Pedidos: ${window.formatCurrency(totalOrders)}</div>
            <hr />
            <div style="font-weight: 900; margin-bottom: 4px; font-size: 15px;">LISTAGEM DAS ENTREGAS:</div>
            ${deliveriesStr || '<div>Nenhuma entrega registrada.</div>'}
            <hr />
            <div style="text-align: center; margin-top: 16px; font-size: 12px; font-weight: 900;">
              ___________________________<br />
              Assinatura do Entregador
            </div>
          </div>
        </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    printWin.print();
  }

  // Impressão do Fechamento de Caixa Geral do Dia
  function printDailyCashSummary(reportDate) {
    const dayOrders = adminState.orders.filter(o => {
      const oDate = getBusinessDateString(o.created_at);
      return oDate === reportDate && o.status === 'finalizado';
    });

    let totalRevenue = 0;
    let totalCash = 0;
    let totalPix = 0;
    let totalCard = 0;
    let totalDeliveryFees = 0;

    let mesaRev = 0, mesaCount = 0;
    let balcaoRev = 0, balcaoCount = 0;
    let deliveryRev = 0, deliveryCount = 0;

    dayOrders.forEach(o => {
      const ordTotal = Number(o.total) || 0;
      const ordFee = Number(o.delivery_fee) || 0;
      totalRevenue += ordTotal;
      totalDeliveryFees += ordFee;

      const pay = (o.payment_method || '').toLowerCase();
      if (pay === 'dinheiro' || pay === 'pendente') totalCash += ordTotal;
      else if (pay === 'pix') totalPix += ordTotal;
      else if (pay === 'cartao') totalCard += ordTotal;

      if (o.order_type === 'mesa' || o.table_number) {
        mesaRev += ordTotal;
        mesaCount++;
      } else if (o.order_type === 'balcao' || o.order_type === 'pickup' || o.order_type === 'retirada') {
        balcaoRev += ordTotal;
        balcaoCount++;
      } else if (o.order_type === 'delivery') {
        deliveryRev += ordTotal;
        deliveryCount++;
      } else {
        // fallback: sem tipo definido e sem mesa → balcão
        balcaoRev += ordTotal;
        balcaoCount++;
      }
    });

    // Entregadores
    let couriersStr = '';
    const couriers = adminState.couriers || [];
    couriers.forEach(c => {
      const cOrders = dayOrders.filter(o => o.courier_name && o.courier_name.toLowerCase() === c.name.toLowerCase());
      const cCash = cOrders.filter(o => o.payment_method === 'dinheiro').reduce((s, o) => s + (Number(o.total) || 0), 0);
      const cFees = cOrders.reduce((s, o) => s + (Number(o.delivery_fee) || 0), 0);
      couriersStr += `
        <div style="margin: 3px auto; text-align: center;">🛵 <strong>${window.escapeHtml(c.name)}:</strong> ${cOrders.length} ped | ${window.formatCurrency(cFees)} | Dinheiro: ${window.formatCurrency(cCash)}</div>
      `;
    });

    const printWin = window.open('', '_blank', 'width=400,height=600');
    printWin.document.write(`
      <html>
        <head>
          <title>Fechamento de Caixa - ${reportDate}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; text-align: center !important; }
            html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; background: #fff; text-align: center !important; }
            .ticket-wrapper {
              font-family: Arial, Helvetica, 'Segoe UI', 'Courier New', sans-serif;
              font-size: 15px;
              font-weight: 900;
              color: #000;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 auto !important;
              padding: 4px 7mm 24px 7mm !important;
              word-break: break-word;
              line-height: 1.3;
              text-align: center !important;
              box-sizing: border-box !important;
            }
            h2 { font-size: 20px; font-weight: 900; text-align: center !important; margin: 2px 0; letter-spacing: 0.5px; }
            h3 { font-size: 17px; font-weight: 900; text-align: center !important; margin: 2px 0; }
            hr { border: none; border-top: 2px dashed #000; margin: 5px auto; width: 100%; }
            @media print {
              @page { margin: 0; size: auto; }
              html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; text-align: center !important; }
              .ticket-wrapper {
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 auto !important;
                padding: 4px 7mm 24px 7mm !important;
                text-align: center !important;
                box-sizing: border-box !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="ticket-wrapper">
            <h2>BOYDEGUSTA</h2>
            <h3>FECHAMENTO DE CAIXA DIÁRIO</h3>
            <div style="text-align: center; font-size: 13px; font-weight: 900;">Data: ${new Date(reportDate + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
            <div style="text-align: center; font-size: 11px; color: #333; font-weight: bold;">Gerado em: ${new Date().toLocaleString('pt-BR')}</div>
            <hr />
            <div style="font-size: 17px; font-weight: 900; margin: 4px 0;">FATURAMENTO: ${window.formatCurrency(totalRevenue)}</div>
            <div style="font-weight: 900; font-size: 15px;">Total Pedidos: ${dayOrders.length}</div>
            <hr />
            <div style="font-weight: 900; font-size: 15px; margin-bottom: 2px;">FORMA DE PAGAMENTO:</div>
            <div>💵 Dinheiro: ${window.formatCurrency(totalCash)}</div>
            <div>📱 PIX: ${window.formatCurrency(totalPix)}</div>
            <div>💳 Cartão: ${window.formatCurrency(totalCard)}</div>
            <hr />
            <div style="font-weight: 900; font-size: 15px; margin-bottom: 2px;">CANAIS DE VENDA:</div>
            <div>🪑 Mesas: ${window.formatCurrency(mesaRev)} (${mesaCount} ped)</div>
            <div>🥡 Balcão: ${window.formatCurrency(balcaoRev)} (${balcaoCount} ped)</div>
            <div>🛵 Delivery: ${window.formatCurrency(deliveryRev)} (${deliveryCount} ped)</div>
            <div>🛵 Taxas Entrega: ${window.formatCurrency(totalDeliveryFees)}</div>
            <hr />
            <div style="font-weight: 900; font-size: 15px; margin-bottom: 2px;">ENTREGADORES (MOTOBOYS):</div>
            ${couriersStr || '<div>Nenhuma entrega vinculada.</div>'}
          </div>
        </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    printWin.print();
  }

  dom.cashReportDatePicker.addEventListener('change', (e) => {
    adminState.selectedCashDate = e.target.value;
    renderCashReport();
  });

  dom.btnCashToday.addEventListener('click', () => {
    adminState.selectedCashDate = getBusinessDateString(new Date());
    renderCashReport();
  });

  dom.btnCashYesterday.addEventListener('click', () => {
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    adminState.selectedCashDate = getBusinessDateString(yest);
    renderCashReport();
  });

  dom.btnPrintDailyCash.addEventListener('click', () => {
    printDailyCashSummary(adminState.selectedCashDate);
  });

  // ==========================================
  // 7. CONFIGURAÇÕES DO ESTABELECIMENTO
  // ==========================================
  function populateSettingsForm() {
    if (!adminState.settings) return;
    const s = adminState.settings;
    dom.settingStatusMode.value = s.store_status_mode || 'auto';
    dom.settingClosedMessage.value = s.closed_message || '';
    dom.settingMinOrder.value = s.min_order_value !== undefined ? s.min_order_value : 10.00;
    dom.settingWhatsApp.value = s.whatsapp || '5581991421295';
    dom.settingInstagram.value = s.instagram || '@pizzafritadoch';
    dom.settingAddress.value = s.address || '';
    dom.settingPixKey.value = s.pix_key || '';
  }

  dom.adminSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const updatedPayload = {
      store_status_mode: dom.settingStatusMode.value,
      closed_message: dom.settingClosedMessage.value.trim(),
      min_order_value: Number(dom.settingMinOrder.value) || 10.00,
      whatsapp: dom.settingWhatsApp.value.trim(),
      instagram: dom.settingInstagram.value.trim(),
      address: dom.settingAddress.value.trim(),
      pix_key: dom.settingPixKey.value.trim()
    };

    const saved = await window.db.updateSettings(updatedPayload);
    adminState.settings = saved;
    updateStatusIndicator();
    alert('✅ Configurações salvas com sucesso!');
  });

  // ==========================================
  // PEDIDO VIA WHATSAPP COM SELEÇÃO DE BAIRRO
  // ==========================================
  function populateWaNeighborhoodsSelect() {
    const list = (adminState.neighborhoods || []).filter(n => n.is_active !== false);
    let html = '<option value="">Selecione o bairro...</option>';
    list.forEach(n => {
      html += `<option value="${n.name}" data-fee="${n.delivery_fee}">${n.name} — ${window.formatCurrency(n.delivery_fee)} (${n.delivery_time_min || 60} min)</option>`;
    });
    dom.waNeighborhoodSelect.innerHTML = html;

    dom.waNeighborhoodSelect.onchange = () => {
      const selectedName = dom.waNeighborhoodSelect.value;
      const found = list.find(n => n.name === selectedName);
      if (found) {
        dom.waDeliveryFee.value = found.delivery_fee;
      }
      updateWaTotal();
    };
  }

  function openWhatsappOrderModal() {
    adminState.waCart = [];
    adminState.waOrderType = 'delivery';

    dom.waCustomerName.value = '';
    dom.waCustomerPhone.value = '';
    dom.waStreet.value = '';
    dom.waNumber.value = '';
    dom.waNeighborhoodSelect.value = '';
    dom.waComplement.value = '';
    dom.waReference.value = '';
    dom.waGeneralNotes.value = '';
    dom.waChangeFor.value = '';
    dom.waPaymentMethod.value = 'pix';
    dom.waChangeGroup.style.display = 'none';

    populateWaNeighborhoodsSelect();
    dom.waDeliveryFee.value = '0.00';

    dom.waBtnDelivery.style.border = '2px solid #25d366';
    dom.waBtnDelivery.style.background = '#dcfce7';
    dom.waBtnDelivery.style.color = '#166534';
    dom.waBtnPickup.style.border = '2px solid #e2e8f0';
    dom.waBtnPickup.style.background = '#f8fafc';
    dom.waBtnPickup.style.color = '#475569';
    dom.waDeliveryAddressSection.style.display = 'block';

    renderWaCart();
    dom.whatsappOrderModal.style.display = 'flex';
  }

  function setWaOrderType(type) {
    adminState.waOrderType = type;
    if (type === 'delivery') {
      dom.waBtnDelivery.style.border = '2px solid #25d366';
      dom.waBtnDelivery.style.background = '#dcfce7';
      dom.waBtnDelivery.style.color = '#166534';
      dom.waBtnPickup.style.border = '2px solid #e2e8f0';
      dom.waBtnPickup.style.background = '#f8fafc';
      dom.waBtnPickup.style.color = '#475569';
      dom.waDeliveryAddressSection.style.display = 'block';
      
      const selectedName = dom.waNeighborhoodSelect.value;
      const found = (adminState.neighborhoods || []).find(n => n.name === selectedName);
      dom.waDeliveryFee.value = found ? found.delivery_fee : 5.00;
    } else {
      dom.waBtnPickup.style.border = '2px solid #25d366';
      dom.waBtnPickup.style.background = '#dcfce7';
      dom.waBtnPickup.style.color = '#166534';
      dom.waBtnDelivery.style.border = '2px solid #e2e8f0';
      dom.waBtnDelivery.style.background = '#f8fafc';
      dom.waBtnDelivery.style.color = '#475569';
      dom.waDeliveryAddressSection.style.display = 'none';
      dom.waDeliveryFee.value = 0;
    }
    updateWaTotal();
  }

  function updateWaTotal() {
    const subtotal = adminState.waCart.reduce((s, i) => s + i.subtotal, 0);
    const fee = adminState.waOrderType === 'delivery' ? (Number(dom.waDeliveryFee.value) || 0) : 0;
    dom.waSubtotalDisplay.textContent = window.formatCurrency(subtotal);
    dom.waTotalDisplay.textContent = window.formatCurrency(subtotal + fee);
  }

  function renderWaCart() {
    if (adminState.waCart.length === 0) {
      dom.waItemsList.innerHTML = `<div id="waItemsEmpty" style="text-align: center; padding: 16px; color: #94a3b8; font-size: 0.85rem;">Nenhum item adicionado. Clique em + Adicionar Item.</div>`;
      updateWaTotal();
      return;
    }

    let html = '';
    adminState.waCart.forEach((item, idx) => {
      html += `
        <div style="display: flex; align-items: center; justify-content: space-between; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; gap: 8px;">
          <div style="flex: 1;">
            <div style="font-weight: 700; font-size: 0.88rem;">${item.name}</div>
            ${item.notes ? `<div style="font-size: 0.75rem; color: #d97706;">Obs: ${item.notes}</div>` : ''}
            <div style="font-size: 0.8rem; color: #64748b;">${window.formatCurrency(item.price)} / un</div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button type="button" class="btn-qty-step wa-cart-minus" data-idx="${idx}">-</button>
            <span style="font-weight: 800; width: 20px; text-align: center;">${item.quantity}</span>
            <button type="button" class="btn-qty-step wa-cart-plus" data-idx="${idx}">+</button>
          </div>
          <div style="font-weight: 800; color: #d97706; min-width: 68px; text-align: right; font-size: 0.88rem;">${window.formatCurrency(item.subtotal)}</div>
          <button type="button" class="wa-cart-remove" data-idx="${idx}" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 1rem; padding: 0 4px;">✕</button>
        </div>
      `;
    });

    dom.waItemsList.innerHTML = html;
    updateWaTotal();

    dom.waItemsList.querySelectorAll('.wa-cart-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-idx'));
        adminState.waCart[idx].quantity++;
        adminState.waCart[idx].subtotal = adminState.waCart[idx].price * adminState.waCart[idx].quantity;
        renderWaCart();
      });
    });
    dom.waItemsList.querySelectorAll('.wa-cart-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-idx'));
        if (adminState.waCart[idx].quantity > 1) {
          adminState.waCart[idx].quantity--;
          adminState.waCart[idx].subtotal = adminState.waCart[idx].price * adminState.waCart[idx].quantity;
        } else {
          adminState.waCart.splice(idx, 1);
        }
        renderWaCart();
      });
    });
    dom.waItemsList.querySelectorAll('.wa-cart-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-idx'));
        adminState.waCart.splice(idx, 1);
        renderWaCart();
      });
    });
  }

  function openWaProductPicker() {
    dom.waPickerSearch.value = '';
    renderWaPickerList('');
    dom.waProductPickerModal.style.display = 'flex';
  }

  function renderWaPickerList(query) {
    const q = (query || '').toLowerCase().trim();
    let items = [];

    (adminState.promotions || []).forEach(p => {
      if (p.is_active !== false) {
        const effPrice = getProductEffectivePrice(p);
        items.push({ id: p.id, name: `🔥 ${p.name}`, price: effPrice, description: p.description || 'Combo Promocional' });
      }
    });
    (adminState.products || []).forEach(p => {
      if (p.is_active !== false && p.is_available !== false) {
        const effPrice = getProductEffectivePrice(p);
        items.push({ id: p.id, name: p.name, price: effPrice, description: p.description || '' });
      }
    });

    if (q) items = items.filter(i => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));

    if (items.length === 0) {
      dom.waPickerProductsList.innerHTML = `<div style="text-align:center;padding:20px;color:#94a3b8;">Nenhum produto encontrado.</div>`;
      return;
    }

    let html = '';
    items.forEach(item => {
      html += `
        <div class="wa-picker-item" data-id="${item.id}" data-name="${item.name}" data-price="${item.price}"
          style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;cursor:pointer;transition:background 0.15s;">
          <div>
            <div style="font-weight:700;font-size:0.88rem;">${item.name}</div>
            <div style="font-size:0.76rem;color:#64748b;">${item.description}</div>
          </div>
          <span style="font-weight:800;color:#d97706;font-size:0.9rem;">${window.formatCurrency(item.price)}</span>
        </div>
      `;
    });
    dom.waPickerProductsList.innerHTML = html;

    dom.waPickerProductsList.querySelectorAll('.wa-picker-item').forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.getAttribute('data-id');
        const name = el.getAttribute('data-name');

        // Detecta se é hambúrguer buscando o produto completo
        const fullProduct = (adminState.products || []).find(p => p.id === id) ||
                            (adminState.promotions || []).find(p => p.id === id);
        const isBurger = fullProduct ? isBurgerProduct(fullProduct) : false;
        const burgerType = fullProduct?.burger_type || (isBurger ? 'both' : 'none');
        let basePrice = Number(el.getAttribute('data-price'));
        let finalName = name;
        let burgerVersion = null;

        // Se for hambúrguer com escolha (both), exibir popup de escolha de tamanho
        if (burgerType === 'both') {
          const choice = await showBurgerChoicePopup(name);
          if (choice === null) return; // cancelado
          if (choice === 'duplo') {
            basePrice += 5;
            finalName = `${name} (Duplo)`;
            burgerVersion = 'duplo';
          } else {
            burgerVersion = 'tradicional';
          }
        } else if (burgerType === 'duplo') {
          burgerVersion = 'duplo';
          if (!finalName.toLowerCase().includes('duplo')) {
            finalName = `${name} (Duplo)`;
          }
        } else if (burgerType === 'tradicional') {
          burgerVersion = 'tradicional';
        }

        // Popup de observações
        const obs = await showInputPopup(
          `Observações`,
          `Algum detalhe especial para "${finalName}"?`,
          'Ex: sem cebola, ponto da carne, molho extra...'
        );
        if (obs === null) return; // cancelado

        const existingIdx = adminState.waCart.findIndex(c => c.id === id && c.burger_version === burgerVersion && (c.notes || '') === obs);
        if (existingIdx > -1) {
          adminState.waCart[existingIdx].quantity++;
          adminState.waCart[existingIdx].subtotal = adminState.waCart[existingIdx].price * adminState.waCart[existingIdx].quantity;
        } else {
          adminState.waCart.push({ id, name: finalName, price: basePrice, quantity: 1, subtotal: basePrice, notes: obs, burger_version: burgerVersion });
        }

        dom.waProductPickerModal.style.display = 'none';
        renderWaCart();
      });

      el.addEventListener('mouseenter', () => { el.style.background = '#fffbeb'; });
      el.addEventListener('mouseleave', () => { el.style.background = '#f8fafc'; });
    });
  }

  // Event Listeners do Modal WhatsApp
  dom.btnQuickWhatsapp.addEventListener('click', openWhatsappOrderModal);
  dom.btnOpenWhatsappOrder.addEventListener('click', openWhatsappOrderModal);
  dom.btnWhatsappModalClose.addEventListener('click', () => { dom.whatsappOrderModal.style.display = 'none'; });

  dom.waBtnDelivery.addEventListener('click', () => setWaOrderType('delivery'));
  dom.waBtnPickup.addEventListener('click', () => setWaOrderType('pickup'));

  dom.waDeliveryFee.addEventListener('input', updateWaTotal);

  dom.waPaymentMethod.addEventListener('change', () => {
    dom.waChangeGroup.style.display = dom.waPaymentMethod.value === 'dinheiro' ? 'block' : 'none';
  });

  dom.btnWaAddItem.addEventListener('click', openWaProductPicker);
  dom.btnWaPickerClose.addEventListener('click', () => { dom.waProductPickerModal.style.display = 'none'; });

  dom.waPickerSearch.addEventListener('input', (e) => renderWaPickerList(e.target.value));

  dom.btnSubmitWhatsappOrder.addEventListener('click', async () => {
    const customerName = dom.waCustomerName.value.trim();
    const customerPhone = dom.waCustomerPhone.value.trim();

    if (!customerName || !customerPhone) {
      alert('Por favor, preencha o nome e WhatsApp do cliente.');
      return;
    }
    if (adminState.waCart.length === 0) {
      alert('Adicione ao menos um item ao pedido.');
      return;
    }
    if (adminState.waOrderType === 'delivery') {
      if (!dom.waStreet.value.trim() || !dom.waNumber.value.trim() || !dom.waNeighborhoodSelect.value.trim()) {
        alert('Preencha o endereço de entrega (rua, número e selecione o bairro).');
        return;
      }
    }

    const deliveryFee = adminState.waOrderType === 'delivery' ? (Number(dom.waDeliveryFee.value) || 0) : 0;
    const subtotal = adminState.waCart.reduce((s, i) => s + i.subtotal, 0);
    const total = subtotal + deliveryFee;

    const deliveryAddress = adminState.waOrderType === 'delivery' ? {
      street: dom.waStreet.value.trim(),
      number: dom.waNumber.value.trim(),
      neighborhood: dom.waNeighborhoodSelect.value.trim(),
      complement: dom.waComplement.value.trim(),
      reference: dom.waReference.value.trim()
    } : null;

    const orderPayload = {
      customer_name: customerName,
      customer_phone: customerPhone,
      order_type: adminState.waOrderType,
      table_number: null,
      payment_method: dom.waPaymentMethod.value,
      change_for: dom.waPaymentMethod.value === 'dinheiro' && dom.waChangeFor.value ? Number(dom.waChangeFor.value) : null,
      subtotal: subtotal,
      delivery_fee: deliveryFee,
      total: total,
      notes: dom.waGeneralNotes.value.trim(),
      delivery_address: deliveryAddress,
      status: 'novo',
      whatsapp_sent: true,
      items: adminState.waCart.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.subtotal,
        notes: item.notes || '',
        burger_version: item.burger_version || null,
        optionals: [],
        combo_choices: []
      }))
    };

    dom.btnSubmitWhatsappOrder.disabled = true;
    dom.btnSubmitWhatsappOrder.textContent = '⏳ Registrando pedido...';

    try {
      await window.db.createOrder(orderPayload);
      dom.whatsappOrderModal.style.display = 'none';
      adminState.waCart = [];

      adminState.orders = await window.db.getOrders();
      renderOrders();
      renderDashboard();
      renderCashReport();

      alert(`Pedido de ${customerName} registrado com sucesso!\n\nEle já aparece em Pedidos em Tempo Real.`);
    } catch (err) {
      console.error('Erro ao registrar pedido WhatsApp:', err);
      alert('Erro ao registrar o pedido. Tente novamente.');
    } finally {
      dom.btnSubmitWhatsappOrder.disabled = false;
      dom.btnSubmitWhatsappOrder.innerHTML = '<i class="fi fi-brands-whatsapp"></i> Registrar Pedido WhatsApp';
    }
  });

  // ==========================================
  // NAVEGAÇÃO POR ABAS & MENU MOBILE
  // ==========================================
  function closeMobileNav() {
    if (dom.adminSidebar) dom.adminSidebar.classList.remove('mobile-open');
    if (dom.adminMobileNavBackdrop) dom.adminMobileNavBackdrop.classList.remove('active');
  }

  function openMobileNav() {
    if (dom.adminSidebar) dom.adminSidebar.classList.add('mobile-open');
    if (dom.adminMobileNavBackdrop) dom.adminMobileNavBackdrop.classList.add('active');
  }

  if (dom.btnToggleMobileNav) {
    dom.btnToggleMobileNav.addEventListener('click', () => {
      if (dom.adminSidebar && dom.adminSidebar.classList.contains('mobile-open')) {
        closeMobileNav();
      } else {
        openMobileNav();
      }
    });
  }

  if (dom.btnCloseMobileNav) {
    dom.btnCloseMobileNav.addEventListener('click', closeMobileNav);
  }

  if (dom.adminMobileNavBackdrop) {
    dom.adminMobileNavBackdrop.addEventListener('click', closeMobileNav);
  }

  dom.tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.tabButtons.forEach(b => b.classList.remove('active'));
      dom.tabContents.forEach(c => c.style.display = 'none');

      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      const targetContent = document.getElementById(`tab-${tabId}`);
      if (targetContent) targetContent.style.display = 'block';

      // Atualiza o texto do botão de menu mobile
      if (dom.adminMobileActiveTabLabel) {
        dom.adminMobileActiveTabLabel.textContent = btn.textContent.trim();
      }

      // Fecha o menu vertical no mobile ao clicar em qualquer aba
      closeMobileNav();

      if (tabId === 'pos') renderSalonTables();
      if (tabId === 'orders') renderOrders();
      if (tabId === 'dashboard') renderDashboard();
      if (tabId === 'products') renderProducts();
      if (tabId === 'categories') renderCategories();
      if (tabId === 'promotions') renderPromotions();
      if (tabId === 'optionals') renderOptionals();
      if (tabId === 'neighborhoods') renderNeighborhoods();
      if (tabId === 'cash-closing') renderCashReport();
    });
  });

  // Filtros de Pedidos
  dom.orderFilterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      dom.orderFilterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      adminState.orderFilter = chip.getAttribute('data-filter');
      renderOrders();
    });
  });

  dom.btnRefreshOrders.addEventListener('click', async () => {
    adminState.orders = await window.db.getOrders();
    renderSalonTables();
    renderOrders();
    renderDashboard();
    renderCashReport();
  });

  // Filtros de busca de produtos
  dom.adminSearchProductInput.addEventListener('input', (e) => {
    adminState.productSearch = e.target.value;
    renderProducts();
  });

  dom.adminFilterCategory.addEventListener('change', (e) => {
    adminState.productCategoryFilter = e.target.value;
    renderProducts();
  });

  // ==========================================
  // ALERTA SONORO DE NOVO PEDIDO (SINO DE RESTAURANTE DUAL-ENGINE)
  // ==========================================
  // (variáveis declaradas no topo do handler DOMContentLoaded para evitar TDZ)

  // Desbloqueia o AudioContext e o elemento HTML5 Audio no primeiro gesto do usuário
  function unlockAudioContext() {
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!audioCtx && AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const bellEl = document.getElementById('bellAudioElement');
      if (bellEl) {
        // Pré-carrega o áudio
        if (!bellEl.src && window.BELL_SOUND_DATA_URI) {
          bellEl.src = window.BELL_SOUND_DATA_URI;
        }
        bellEl.load();
      }
    } catch (e) {}
  }

  // Ao primeiro gesto: desbloqueia áudio e toca sino pendente
  function handleFirstGesture() {
    unlockAudioContext();
    if (pendingBeep && isSoundEnabled) {
      pendingBeep = false;
      // Pequeno delay para garantir que o audioCtx foi retomado
      setTimeout(() => playOrderNotificationSound(), 150);
    }
  }

  document.addEventListener('click', handleFirstGesture, { passive: true });
  document.addEventListener('touchstart', handleFirstGesture, { passive: true });
  document.addEventListener('keydown', handleFirstGesture, { passive: true });

  /**
   * Toca o sino de delivery com motor duplo (HTML5 Audio + Web Audio API)
   */
  function playOrderNotificationSound() {
    if (!isSoundEnabled) return;

    unlockAudioContext();

    let playedHtml5 = false;

    // Motor 1: HTML5 Audio Element / Audio Object
    try {
      const bellEl = document.getElementById('bellAudioElement');
      if (bellEl) {
        bellEl.currentTime = 0;
        bellEl.volume = 1.0;
        const playPromise = bellEl.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => { playedHtml5 = true; pendingBeep = false; })
            .catch(() => {
              // Autoplay bloqueado — agenda para próximo clique
              pendingBeep = true;
              // Fallback para novo objeto de áudio com Data URI
              try {
                const snd = new Audio(window.BELL_SOUND_DATA_URI || 'sound/bell.wav');
                snd.volume = 1.0;
                snd.play()
                  .then(() => { pendingBeep = false; })
                  .catch(() => { pendingBeep = true; });
              } catch (e) { pendingBeep = true; }
            });
        }
      } else {
        // Sem elemento HTML5: tenta criar um novo objeto
        try {
          const snd = new Audio(window.BELL_SOUND_DATA_URI || 'sound/bell.wav');
          snd.volume = 1.0;
          snd.play()
            .then(() => { pendingBeep = false; })
            .catch(() => { pendingBeep = true; });
        } catch (e) { pendingBeep = true; }
      }
    } catch (e) {}

    // Motor 2: Web Audio API Synthesizer (Sino Harmônico Cristalino Ding-Dong-Ding)
    try {
      if (!audioCtx) {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (AudioCtxClass) audioCtx = new AudioCtxClass();
      }
      if (audioCtx) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const now = audioCtx.currentTime;

        const playBellTone = (fundamentalFreq, startTime, duration, volume = 0.5) => {
          const osc1 = audioCtx.createOscillator();
          const gain1 = audioCtx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(fundamentalFreq, startTime);
          gain1.gain.setValueAtTime(0, startTime);
          gain1.gain.linearRampToValueAtTime(volume, startTime + 0.015);
          gain1.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
          osc1.connect(gain1);
          gain1.connect(audioCtx.destination);
          osc1.start(startTime);
          osc1.stop(startTime + duration);

          // Harmônico brilhante
          const osc2 = audioCtx.createOscillator();
          const gain2 = audioCtx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(fundamentalFreq * 2.01, startTime);
          gain2.gain.setValueAtTime(0, startTime);
          gain2.gain.linearRampToValueAtTime(volume * 0.45, startTime + 0.01);
          gain2.gain.exponentialRampToValueAtTime(0.001, startTime + (duration * 0.7));
          osc2.connect(gain2);
          gain2.connect(audioCtx.destination);
          osc2.start(startTime);
          osc2.stop(startTime + duration);
        };

        playBellTone(784.00, now, 1.3, 0.45);        // Sol (G5)
        playBellTone(1046.50, now + 0.22, 1.5, 0.50); // Dó (C6)
        playBellTone(1318.50, now + 0.44, 1.8, 0.55); // Mi (E6)
      }
    } catch (e) {
      console.warn('Falha no sintetizador Web Audio:', e);
    }
  }

  // Toast Visual de Alerta de Novo Pedido no Topo
  function showNewOrderToast(order) {
    let toast = document.getElementById('newOrderToastBanner');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'newOrderToastBanner';
      toast.style.cssText = `
        position: fixed; top: 16px; right: 16px; z-index: 99999;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: #ffffff; padding: 14px 20px; border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 12px;
        font-family: inherit; font-weight: 800; font-size: 0.95rem; cursor: pointer;
        animation: toastIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      `;
      document.body.appendChild(toast);
    }
    const orderNum = order?.order_number ? `#${String(order.order_number).padStart(4, '0')}` : 'Novo';
    const totalVal = order?.total ? window.formatCurrency(order.total) : '';
    toast.innerHTML = `
      <i class="fi fi-sr-bell" style="font-size: 1.4rem; color: #fef08a;"></i>
      <div>
        <div style="font-size: 1rem;">🔔 NOVO PEDIDO RECEBIDO!</div>
        <div style="font-size: 0.82rem; font-weight: 500; opacity: 0.95;">Pedido ${orderNum} ${totalVal ? `• Total: ${totalVal}` : ''}</div>
      </div>
      <button style="background: none; border: none; color: #fff; font-size: 1.1rem; cursor: pointer; margin-left: 8px;">✕</button>
    `;
    toast.style.display = 'flex';
    toast.onclick = () => { toast.style.display = 'none'; };
    setTimeout(() => { if (toast) toast.style.display = 'none'; }, 8000);
  }

  function updateSoundButtonUI() {
    if (!dom.btnToggleSound) return;
    if (isSoundEnabled) {
      if (dom.soundIcon) {
        dom.soundIcon.className = 'fi fi-sr-bell';
        dom.soundIcon.style.color = '#d97706';
      }
      if (dom.soundText) dom.soundText.textContent = 'Sino Ativo';
      dom.btnToggleSound.title = 'Sino de novos pedidos ATIVADO (Clique para testar o som)';
    } else {
      if (dom.soundIcon) {
        dom.soundIcon.className = 'fi fi-sr-bell-slash';
        dom.soundIcon.style.color = '#94a3b8';
      }
      if (dom.soundText) dom.soundText.textContent = 'Sino Mudo';
      dom.btnToggleSound.title = 'Sino de novos pedidos MUTADO (Clique para ativar)';
    }
  }

  if (dom.btnToggleSound) {
    dom.btnToggleSound.addEventListener('click', () => {
      unlockAudioContext();
      if (!isSoundEnabled) {
        isSoundEnabled = true;
        updateSoundButtonUI();
        playOrderNotificationSound();
      } else {
        // Toca para testar o sino
        playOrderNotificationSound();
      }
    });
  }

  function checkForNewOrdersAndBeep(ordersList) {
    if (!ordersList || !Array.isArray(ordersList)) return;
    
    if (isFirstLoad) {
      ordersList.forEach(o => { if (o?.id) knownOrderIds.add(String(o.id)); });
      isFirstLoad = false;
      return;
    }

    let newestOrder = null;
    ordersList.forEach(o => {
      const oId = String(o?.id);
      if (oId && !knownOrderIds.has(oId)) {
        newestOrder = o;
      }
      if (oId) knownOrderIds.add(oId);
    });

    if (newestOrder) {
      playOrderNotificationSound();
      showNewOrderToast(newestOrder);

      // Alerta visual no título da aba
      const originalTitle = document.title;
      document.title = '🔔 NOVO PEDIDO! — Pizza Frita do CH';
      setTimeout(() => { document.title = originalTitle; }, 6000);
    }
  }

  // Sincronização entre abas
  window.addEventListener('storage', async (e) => {
    if (e.key === 'pizzafrita_orders' || e.key === 'pizzafrita_orders_ping') {
      await syncOrdersQuietly();
    }
  });

  window.addEventListener('pizzafrita_order_change', async (e) => {
    if (e.detail) {
      checkForNewOrdersAndBeep([e.detail]);
    }
    await syncOrdersQuietly();
  });

  // Assinatura Supabase Realtime para capturar pedidos no mesmo segundo
  try {
    const sb = window.db?.supabase || window.supabaseClient;
    if (sb && typeof sb.channel === 'function') {
      sb.channel('admin-orders-realtime-v3')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async (payload) => {
          console.log('[Realtime Admin] Novo evento de pedido:', payload);
          if (payload.new) {
            checkForNewOrdersAndBeep([payload.new]);
          }
          await syncOrdersQuietly();
        })
        .subscribe();
    }
  } catch (e) {
    console.warn('Erro ao inicializar Supabase Realtime channel:', e);
  }

  // Função utilitária para sincronizar pedidos em background
  async function syncOrdersQuietly() {
    if (!window.auth.isAdminLoggedIn()) return;
    try {
      const freshOrders = await window.db.getOrders();
      checkForNewOrdersAndBeep(freshOrders);
      if (JSON.stringify(freshOrders) !== JSON.stringify(adminState.orders)) {
        adminState.orders = freshOrders;
        renderSalonTables();
        renderOrders();
        renderDashboard();
        renderCashReport();
      }
    } catch (err) {
      console.warn('Erro no auto-refresh de pedidos:', err);
    }
  }

  // Atualização automática a cada 1 minuto (60 segundos) sem travar
  setInterval(async () => {
    if (window.auth.isAdminLoggedIn()) {
      await syncOrdersQuietly();
    }
  }, 30000); // Polling a cada 30 segundos

  // Sincroniza imediatamente ao retornar ou focar na aba
  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && window.auth.isAdminLoggedIn()) {
      await syncOrdersQuietly();
    }
  });

  window.addEventListener('focus', async () => {
    if (window.auth.isAdminLoggedIn()) {
      await syncOrdersQuietly();
    }
  });

  // Checa autenticação inicial
  checkAuth();
});
