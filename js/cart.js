// ========================================================
// PIZZA FRITA DO CH - GERENCIADOR DE CARRINHO & CHECKOUT
// ========================================================

(function() {
  const CART_KEY = 'pizzafrita_cart';

  const cart = {
    items: [],
    deliveryType: 'delivery', // Exclusivo delivery

    init() {
      try {
        const saved = localStorage.getItem(CART_KEY);
        this.items = saved ? JSON.parse(saved) : [];
      } catch {
        this.items = [];
      }
      this.notifyUpdate();
    },

    save() {
      try {
        localStorage.setItem(CART_KEY, JSON.stringify(this.items));
      } catch (e) {
        console.error('Erro ao persistir carrinho:', e);
      }
      this.notifyUpdate();
    },

    notifyUpdate() {
      window.dispatchEvent(new CustomEvent('cart:updated', { detail: this }));
    },

    addItem(product, quantity = 1, optionals = [], notes = '', comboChoices = [], flavor = '', selectedSize = null) {
      let itemPrice = Number(product.price) || 0;
      let sizeLabel = '';

      if (selectedSize) {
        if (typeof selectedSize === 'object') {
          itemPrice = Number(selectedSize.price) || itemPrice;
          sizeLabel = selectedSize.name || selectedSize.size_key || '';
        } else if (typeof selectedSize === 'string') {
          sizeLabel = selectedSize;
          if (selectedSize === 'P' && product.price_p) itemPrice = Number(product.price_p);
          else if (selectedSize === 'M' && product.price_m) itemPrice = Number(product.price_m);
          else if (selectedSize === 'G' && product.price_g) itemPrice = Number(product.price_g);
        }
      }

      const optionalsPrice = (optionals || []).reduce((sum, opt) => sum + (Number(opt.price) || 0), 0);
      const unitTotal = itemPrice + optionalsPrice;
      const cartItemId = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

      let displayTitle = product.name;
      if (sizeLabel && !displayTitle.toLowerCase().includes(`(${sizeLabel.toLowerCase()})`)) {
        displayTitle = `${product.name} (${sizeLabel})`;
      }

      const cartItem = {
        cartItemId,
        id: product.id,
        name: displayTitle,
        base_name: product.name,
        image_url: product.image_url,
        price: itemPrice,
        unitTotal,
        quantity: Number(quantity) || 1,
        subtotal: unitTotal * (Number(quantity) || 1),
        selected_size: sizeLabel || '',
        optionals: optionals || [],
        notes: notes ? notes.trim() : '',
        is_combo: Boolean(product.is_promo || product.promo_id || (comboChoices && comboChoices.length > 0)),
        combo_choices: comboChoices || [],
        flavor: flavor || product.flavor || ''
      };

      this.items.push(cartItem);
      this.save();
      return cartItem;
    },

    removeItem(cartItemId) {
      this.items = this.items.filter(item => item.cartItemId !== cartItemId);
      this.save();
    },

    updateQuantity(cartItemId, newQty) {
      const qty = Number(newQty);
      if (qty <= 0) {
        this.removeItem(cartItemId);
        return;
      }
      const item = this.items.find(i => i.cartItemId === cartItemId);
      if (item) {
        item.quantity = qty;
        item.subtotal = item.unitTotal * qty;
        this.save();
      }
    },

    clear() {
      this.items = [];
      this.save();
    },

    getCount() {
      return this.items.reduce((sum, i) => sum + (i.quantity || 1), 0);
    },

    getSubtotal() {
      return this.items.reduce((sum, i) => sum + (i.subtotal || 0), 0);
    },

    selectedNeighborhood: null,

    setSelectedNeighborhood(neighborhood) {
      this.selectedNeighborhood = neighborhood;
      this.notifyUpdate();
    },

    async getDeliveryFee() {
      if (this.selectedNeighborhood && this.selectedNeighborhood.delivery_fee !== undefined) {
        return Number(this.selectedNeighborhood.delivery_fee);
      }
      const settings = await window.db.getSettings();
      return settings ? Number(settings.delivery_fee || 5.00) : 5.00;
    },

    async getTotal() {
      const sub = this.getSubtotal();
      const fee = await this.getDeliveryFee();
      return sub + fee;
    },

    async isMinOrderMet() {
      const settings = await window.db.getSettings();
      const min = settings ? Number(settings.min_order_value) : 15.00;
      return this.getSubtotal() >= min;
    },

    setDeliveryType(type) {
      this.deliveryType = 'delivery';
      this.notifyUpdate();
    },

    // Formata mensagem oficial do WhatsApp
    formatWhatsAppMessage({
      orderNumber,
      customerName,
      customerPhone,
      deliveryAddress,
      paymentMethod,
      changeFor,
      generalNotes,
      subtotal,
      deliveryFee,
      total
    }) {
      const orderNumStr = String(orderNumber).padStart(4, '0');
      
      let itemsListText = '';
      this.items.forEach(item => {
        itemsListText += `${item.quantity}x ${item.name} — ${window.formatCurrency(item.unitTotal * item.quantity)}\n`;

        if (item.selected_size) {
          itemsListText += `  • Tamanho: ${item.selected_size}\n`;
        }

        if (item.flavor) {
          itemsListText += `  • Sabor: ${item.flavor.toUpperCase()}\n`;
        }

        if (item.optionals && item.optionals.length > 0) {
          itemsListText += `  Adicionais:\n`;
          item.optionals.forEach(opt => {
            itemsListText += `  • 1x ${opt.name} — ${window.formatCurrency(opt.price)}\n`;
          });
        }

        if (item.notes) {
          itemsListText += `  Obs: ${item.notes}\n`;
        }
        itemsListText += `\n`;
      });

      let addressText = '';
      if (deliveryAddress) {
        addressText = `📍 *ENDEREÇO DE ENTREGA:*\n${deliveryAddress.street}, ${deliveryAddress.number}${deliveryAddress.complement ? ` - ${deliveryAddress.complement}` : ''}\nBairro: ${deliveryAddress.neighborhood}\nCidade: ${deliveryAddress.city || 'Jaboatão dos Guararapes'} - ${deliveryAddress.state || 'PE'}${deliveryAddress.reference ? `\nRef: ${deliveryAddress.reference}` : ''}\n\n`;
      }

      let paymentText = `💳 *PAGAMENTO:*\n${paymentMethod === 'dinheiro' ? 'Dinheiro' : paymentMethod === 'pix' ? 'Pix' : 'Cartão'}\n`;
      if (paymentMethod === 'dinheiro' && changeFor) {
        paymentText += `Troco para: ${window.formatCurrency(changeFor)}\n`;
      }
      paymentText += `\n`;

      let notesText = '';
      if (generalNotes && generalNotes.trim()) {
        notesText = `📝 *OBSERVAÇÃO GERAL:*\n${generalNotes.trim()}\n\n`;
      }

      const message = 
`🍕 *NOVO PEDIDO — PIZZA FRITA DO CH*
*Pedido #${orderNumStr}*
*Cliente:* ${customerName}
*Telefone:* ${customerPhone}

🛒 *ITENS:*
${itemsListText.trim()}

${notesText ? notesText : ''}🛵 *TIPO:* Delivery Exclusivo

${addressText ? addressText : ''}${paymentText}Subtotal: ${window.formatCurrency(subtotal)}
Taxa de Entrega: ${window.formatCurrency(deliveryFee)}
*VALOR TOTAL: ${window.formatCurrency(total)}*`;

      return message;
    }
  };

  cart.init();
  window.cart = cart;
})();
