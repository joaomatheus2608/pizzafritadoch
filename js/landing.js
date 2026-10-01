/**
 * BOYDEGUSTA - LANDING / PÁGINA DE APRESENTAÇÃO
 * Controla status da loja em tempo real, expansão de horários e compartilhamento.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const dom = {
    welcomeStatusIndicator: document.getElementById('welcomeStatusIndicator'),
    btnToggleHours: document.getElementById('btnToggleHours'),
    hoursAccordionContent: document.getElementById('hoursAccordionContent'),
    hoursArrow: document.getElementById('hoursArrow'),
    btnShareRestaurant: document.getElementById('btnShareRestaurant'),
    appToastNotification: document.getElementById('appToastNotification')
  };

  function showToast(message) {
    if (!dom.appToastNotification) return;
    dom.appToastNotification.innerHTML = `<span>${message}</span>`;
    dom.appToastNotification.classList.add('show');
    setTimeout(() => {
      dom.appToastNotification.classList.remove('show');
    }, 3000);
  }

  // Obter configurações do banco ou fallback
  let settings = null;
  let operatingHours = [];

  try {
    if (window.db) {
      const [s, h] = await Promise.all([
        window.db.getSettings(),
        window.db.getOperatingHours()
      ]);
      settings = s;
      operatingHours = h;
    }
  } catch (e) {
    console.warn('Usando dados locais para horário da loja');
  }

  function updateStoreStatus() {
    let isOpen = true;

    if (settings && settings.store_status_mode === 'force_open') {
      isOpen = true;
    } else if (settings && settings.store_status_mode === 'force_closed') {
      isOpen = false;
    } else {
      // Automático: Quarta a Domingo, 17:00 às 22:00 (Seg e Ter fechado)
      const now = new Date();
      const currentDay = now.getDay();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const dayConfig = operatingHours.find(h => h.day_of_week === currentDay) || {
        is_open: currentDay >= 3 || currentDay === 0,
        open_time: '17:00',
        close_time: '22:00'
      };

      if (!dayConfig.is_open) {
        isOpen = false;
      } else {
        const [openH, openM] = (dayConfig.open_time || '17:00').split(':').map(Number);
        const [closeH, closeM] = (dayConfig.close_time || '22:00').split(':').map(Number);
        const openMin = openH * 60 + (openM || 0);
        const closeMin = closeH * 60 + (closeM || 0);
        isOpen = currentMinutes >= openMin && currentMinutes <= closeMin;
      }
    }

    if (dom.welcomeStatusIndicator) {
      dom.welcomeStatusIndicator.className = `welcome-status-text ${isOpen ? 'is-open' : 'is-closed'}`;
      const now = new Date();
      const currentDay = now.getDay();
      const dayConfig = (operatingHours || []).find(h => h.day_of_week === currentDay);
      const isDayClosed = dayConfig ? !dayConfig.is_open : (currentDay === 1 || currentDay === 2);
      let statusText = '';
      if (isOpen) {
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
  }

  updateStoreStatus();
  setInterval(updateStoreStatus, 60000);

  // Toggle do menu de horários
  if (dom.btnToggleHours && dom.hoursAccordionContent) {
    dom.btnToggleHours.addEventListener('click', () => {
      const isShown = dom.hoursAccordionContent.style.display === 'block';
      dom.hoursAccordionContent.style.display = isShown ? 'none' : 'block';
      if (dom.hoursArrow) {
        dom.hoursArrow.textContent = isShown ? '▾' : '▴';
      }
    });
  }

  // Compartilhar cardápio
  if (dom.btnShareRestaurant) {
    dom.btnShareRestaurant.addEventListener('click', async () => {
      const shareData = {
        title: 'Hamburgueria Boy Degusta',
        text: 'Confira o cardápio e faça seu pedido na Boy Degusta!',
        url: window.location.href
      };
      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch (err) {}
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
});
