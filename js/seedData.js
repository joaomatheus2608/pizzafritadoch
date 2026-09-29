// ========================================================
// PIZZA FRITA DO CH - DADOS OFICIAIS DO CARDÁPIO & SISTEMA
// ========================================================

const INITIAL_SETTINGS = {
  id: 'store-settings',
  name: 'Pizza Frita do CH',
  slogan: 'Não é pizza, muito menos pastel. É uma experiência única!',
  address: 'Jaboatão Centro - PE',
  whatsapp: '5581991421295',
  instagram: '@pizzafritadoch',
  delivery_fee: 5.00,
  min_order_value: 15.00,
  store_status_mode: 'auto', // 'auto', 'force_open', 'force_closed'
  closed_message: 'Estamos fechados no momento. Nosso horário de funcionamento é das 18:00 às 23:00 (Apenas Delivery).',
  admin_password_hash: 'admin123', // Senha padrão de acesso admin local
  pix_key: '5581991421295',
  pix_type: 'Telefone',
  pix_beneficiary: 'Pizza Frita do CH'
};

const INITIAL_OPERATING_HOURS = [
  { day_of_week: 0, day_name: 'Domingo', open_time: '18:00', close_time: '23:00', is_open: true },
  { day_of_week: 1, day_name: 'Segunda-feira', open_time: '18:00', close_time: '23:00', is_open: true },
  { day_of_week: 2, day_name: 'Terça-feira', open_time: '18:00', close_time: '23:00', is_open: true },
  { day_of_week: 3, day_name: 'Quarta-feira', open_time: '18:00', close_time: '23:00', is_open: true },
  { day_of_week: 4, day_name: 'Quinta-feira', open_time: '18:00', close_time: '23:00', is_open: true },
  { day_of_week: 5, day_name: 'Sexta-feira', open_time: '18:00', close_time: '23:00', is_open: true },
  { day_of_week: 6, day_name: 'Sábado', open_time: '18:00', close_time: '23:00', is_open: true }
];

const INITIAL_CATEGORIES = [
  { id: 'cat-salgadas', name: 'Sabores Salgados', slug: 'sabores-salgados', order_index: 1, is_active: true },
  { id: 'cat-premium', name: 'Linha Premium (Cream Cheese)', slug: 'linha-premium', order_index: 2, is_active: true },
  { id: 'cat-doces', name: 'Pizzas Doces', slug: 'pizzas-doces', order_index: 3, is_active: true },
  { id: 'cat-bebidas', name: 'Bebidas', slug: 'bebidas', order_index: 4, is_active: true }
];

const INITIAL_OPTIONALS = [
  { id: 'opt-cream-cheese', name: 'Adicional Cream Cheese', price: 5.00, is_active: true, order_index: 1 },
  { id: 'opt-cheddar', name: 'Adicional Cheddar', price: 4.00, is_active: true, order_index: 2 },
  { id: 'opt-bacon', name: 'Adicional Bacon Crocante', price: 4.00, is_active: true, order_index: 3 },
  { id: 'opt-queijo', name: 'Adicional Mussarela', price: 4.00, is_active: true, order_index: 4 },
  { id: 'opt-ovo', name: 'Adicional Ovo Cozido', price: 2.00, is_active: true, order_index: 5 }
];

const INITIAL_PROMOTIONS = [];

const INITIAL_NEIGHBORHOODS = [
  { id: 'bairro-1', name: 'Jaboatão Centro', delivery_fee: 5.00, is_active: true, order_index: 1 },
  { id: 'bairro-2', name: 'Santo Aleixo', delivery_fee: 6.00, is_active: true, order_index: 2 },
  { id: 'bairro-3', name: 'Vista Alegre', delivery_fee: 6.00, is_active: true, order_index: 3 },
  { id: 'bairro-4', name: 'Vila Rica', delivery_fee: 7.00, is_active: true, order_index: 4 },
  { id: 'bairro-5', name: 'Floriano', delivery_fee: 7.00, is_active: true, order_index: 5 },
  { id: 'bairro-6', name: 'Bulhões', delivery_fee: 8.00, is_active: true, order_index: 6 },
  { id: 'bairro-7', name: 'Socorro', delivery_fee: 8.00, is_active: true, order_index: 7 },
  { id: 'bairro-8', name: 'Cavaleiro', delivery_fee: 9.00, is_active: true, order_index: 8 }
];

const INITIAL_COURIERS = [
  { id: 'cour-1', name: 'Entregador 01', phone: '5581999990001', is_active: true },
  { id: 'cour-2', name: 'Entregador 02', phone: '5581999990002', is_active: true }
];

const INITIAL_PRODUCTS = [
  // ==========================================
  // 1. SABORES SALGADOS
  // ==========================================
  {
    id: 'prod-mussarela',
    category_id: 'cat-salgadas',
    name: 'Mussarela',
    description: 'Queijo mussarela, requeijão e tomate.',
    price: 25.00,
    price_p: 25.00,
    price_m: 34.00,
    price_g: 44.00,
    has_sizes: true,
    sizes: [
      { size_key: 'P', name: 'P (Pequena)', price: 25.00 },
      { size_key: 'M', name: 'M (Média)', price: 34.00 },
      { size_key: 'G', name: 'G (Grande)', price: 44.00 }
    ],
    image_url: "logo.jpg",
    is_promo: false,
    is_active: true,
    is_available: true,
    order_index: 1
  },
  {
    id: 'prod-calabresa',
    category_id: 'cat-salgadas',
    name: 'Calabresa',
    description: 'Calabresa, mussarela, requeijão e cebola.',
    price: 25.00,
    price_p: 25.00,
    price_m: 35.00,
    price_g: 45.00,
    has_sizes: true,
    sizes: [
      { size_key: 'P', name: 'P (Pequena)', price: 25.00 },
      { size_key: 'M', name: 'M (Média)', price: 35.00 },
      { size_key: 'G', name: 'G (Grande)', price: 45.00 }
    ],
    image_url: "logo.jpg",
    is_promo: false,
    is_active: true,
    is_available: true,
    order_index: 2
  },
  {
    id: 'prod-frango',
    category_id: 'cat-salgadas',
    name: 'Frango',
    description: 'Mussarela, requeijão, frango e milho.',
    price: 25.00,
    price_p: 25.00,
    price_m: 35.00,
    price_g: 45.00,
    has_sizes: true,
    sizes: [
      { size_key: 'P', name: 'P (Pequena)', price: 25.00 },
      { size_key: 'M', name: 'M (Média)', price: 35.00 },
      { size_key: 'G', name: 'G (Grande)', price: 45.00 }
    ],
    image_url: "logo.jpg",
    is_promo: false,
    is_active: true,
    is_available: true,
    order_index: 3
  },
  {
    id: 'prod-portuguesa',
    category_id: 'cat-salgadas',
    name: 'Portuguesa',
    description: 'Mussarela, requeijão, presunto, bacon, ovo, cebola, ervilha e azeitona.',
    price: 29.00,
    price_p: 29.00,
    price_m: 38.00,
    price_g: 48.00,
    has_sizes: true,
    sizes: [
      { size_key: 'P', name: 'P (Pequena)', price: 29.00 },
      { size_key: 'M', name: 'M (Média)', price: 38.00 },
      { size_key: 'G', name: 'G (Grande)', price: 48.00 }
    ],
    image_url: "logo.jpg",
    is_promo: false,
    is_active: true,
    is_available: true,
    order_index: 4
  },
  {
    id: 'prod-charque',
    category_id: 'cat-salgadas',
    name: 'Charque',
    description: 'Mussarela, requeijão, charque e cebola.',
    price: 30.00,
    price_p: 30.00,
    price_m: 39.00,
    price_g: 49.00,
    has_sizes: true,
    sizes: [
      { size_key: 'P', name: 'P (Pequena)', price: 30.00 },
      { size_key: 'M', name: 'M (Média)', price: 39.00 },
      { size_key: 'G', name: 'G (Grande)', price: 49.00 }
    ],
    image_url: "logo.jpg",
    is_promo: false,
    is_active: true,
    is_available: true,
    order_index: 5
  },
  {
    id: 'prod-frango-bacon',
    category_id: 'cat-salgadas',
    name: 'Frango com Bacon',
    description: 'Mussarela, requeijão, frango e bacon.',
    price: 28.00,
    price_p: 28.00,
    price_m: 37.00,
    price_g: 47.00,
    has_sizes: true,
    sizes: [
      { size_key: 'P', name: 'P (Pequena)', price: 28.00 },
      { size_key: 'M', name: 'M (Média)', price: 37.00 },
      { size_key: 'G', name: 'G (Grande)', price: 47.00 }
    ],
    image_url: "logo.jpg",
    is_promo: false,
    is_active: true,
    is_available: true,
    order_index: 6
  },
  {
    id: 'prod-camarao',
    category_id: 'cat-salgadas',
    name: 'Camarão',
    description: 'Mussarela, requeijão, camarão e tomate.',
    price: 30.00,
    price_p: 30.00,
    price_m: 40.00,
    price_g: 50.00,
    has_sizes: true,
    sizes: [
      { size_key: 'P', name: 'P (Pequena)', price: 30.00 },
      { size_key: 'M', name: 'M (Média)', price: 40.00 },
      { size_key: 'G', name: 'G (Grande)', price: 50.00 }
    ],
    image_url: "logo.jpg",
    is_promo: false,
    is_active: true,
    is_available: true,
    order_index: 7
  },
  {
    id: 'prod-frango-cheddar',
    category_id: 'cat-salgadas',
    name: 'Frango com Cheddar',
    description: 'Mussarela, requeijão, frango e cheddar.',
    price: 27.00,
    price_p: 27.00,
    price_m: 37.00,
    price_g: 47.00,
    has_sizes: true,
    sizes: [
      { size_key: 'P', name: 'P (Pequena)', price: 27.00 },
      { size_key: 'M', name: 'M (Média)', price: 37.00 },
      { size_key: 'G', name: 'G (Grande)', price: 47.00 }
    ],
    image_url: "logo.jpg",
    is_promo: false,
    is_active: true,
    is_available: true,
    order_index: 8
  },
  {
    id: 'prod-quatro-queijos',
    category_id: 'cat-salgadas',
    name: 'Quatro Queijos',
    description: 'Mussarela, requeijão, cheddar e coalho.',
    price: 28.00,
    price_p: 28.00,
    price_m: 37.00,
    price_g: 47.00,
    has_sizes: true,
    sizes: [
      { size_key: 'P', name: 'P (Pequena)', price: 28.00 },
      { size_key: 'M', name: 'M (Média)', price: 37.00 },
      { size_key: 'G', name: 'G (Grande)', price: 47.00 }
    ],
    image_url: "logo.jpg",
    is_promo: false,
    is_active: true,
    is_available: true,
    order_index: 9
  },
  {
    id: 'prod-file-alcatra',
    category_id: 'cat-salgadas',
    name: 'Filé de Alcatra',
    description: 'Mussarela, requeijão, cubos de alcatra e cebola.',
    price: 33.00,
    price_p: 33.00,
    price_m: 42.00,
    price_g: 52.00,
    has_sizes: true,
    sizes: [
      { size_key: 'P', name: 'P (Pequena)', price: 33.00 },
      { size_key: 'M', name: 'M (Média)', price: 42.00 },
      { size_key: 'G', name: 'G (Grande)', price: 52.00 }
    ],
    image_url: "logo.jpg",
    is_promo: false,
    is_active: true,
    is_available: true,
    order_index: 10
  },
  {
    id: 'prod-calabresa-cheddar',
    category_id: 'cat-salgadas',
    name: 'Calabresa com Cheddar',
    description: 'Mussarela, calabresa, cheddar e cebola.',
    price: 26.00,
    price_p: 26.00,
    price_m: 36.00,
    price_g: 46.00,
    has_sizes: true,
    sizes: [
      { size_key: 'P', name: 'P (Pequena)', price: 26.00 },
      { size_key: 'M', name: 'M (Média)', price: 36.00 },
      { size_key: 'G', name: 'G (Grande)', price: 46.00 }
    ],
    image_url: "logo.jpg",
    is_promo: false,
    is_active: true,
    is_available: true,
    order_index: 11
  },
  {
    id: 'prod-lombo-canadense',
    category_id: 'cat-salgadas',
    name: 'Lombo Canadense',
    description: 'Mussarela, requeijão, lombo e tomate.',
    price: 30.00,
    price_p: 30.00,
    price_m: 39.00,
    price_g: 49.00,
    has_sizes: true,
    sizes: [
      { size_key: 'P', name: 'P (Pequena)', price: 30.00 },
      { size_key: 'M', name: 'M (Média)', price: 39.00 },
      { size_key: 'G', name: 'G (Grande)', price: 49.00 }
    ],
    image_url: "logo.jpg",
    is_promo: false,
    is_active: true,
    is_available: true,
    order_index: 12
  },
  {
    id: 'prod-baiana',
    category_id: 'cat-salgadas',
    name: 'Baiana',
    description: 'Mussarela, requeijão, calabresa, ovo cozido e cebola.',
    price: 27.00,
    price_p: 27.00,
    price_m: 37.00,
    price_g: 47.00,
    has_sizes: true,
    sizes: [
      { size_key: 'P', name: 'P (Pequena)', price: 27.00 },
      { size_key: 'M', name: 'M (Média)', price: 37.00 },
      { size_key: 'G', name: 'G (Grande)', price: 47.00 }
    ],
    image_url: "logo.jpg",
    is_promo: false,
    is_active: true,
    is_available: true,
    order_index: 13
  },

  // ==========================================
  // 2. LINHA PREMIUM - CREAM CHEESE
  // ==========================================
  {
    id: 'prod-camarao-cc',
    category_id: 'cat-premium',
    name: 'Camarão com Cream Cheese',
    description: 'Mussarela, camarão, tomate e Cream Cheese especial.',
    price: 35.00,
    price_p: 35.00,
    price_m: 45.00,
    price_g: 55.00,
    has_sizes: true,
    sizes: [
      { size_key: 'P', name: 'P (Pequena)', price: 35.00 },
      { size_key: 'M', name: 'M (Média)', price: 45.00 },
      { size_key: 'G', name: 'G (Grande)', price: 55.00 }
    ],
    image_url: "logo.jpg",
    is_promo: false,
    is_active: true,
    is_available: true,
    order_index: 1
  },
  {
    id: 'prod-maminha-cc',
    category_id: 'cat-premium',
    name: 'Maminha com Cream Cheese',
    description: 'Mussarela, maminha desfiada selecionada, cebola e Cream Cheese.',
    price: 36.00,
    price_p: 36.00,
    price_m: 46.00,
    price_g: 56.00,
    has_sizes: true,
    sizes: [
      { size_key: 'P', name: 'P (Pequena)', price: 36.00 },
      { size_key: 'M', name: 'M (Média)', price: 46.00 },
      { size_key: 'G', name: 'G (Grande)', price: 56.00 }
    ],
    image_url: "logo.jpg",
    is_promo: false,
    is_active: true,
    is_available: true,
    order_index: 2
  },

  // ==========================================
  // 3. PIZZAS DOCES
  // ==========================================
  {
    id: 'prod-nutella',
    category_id: 'cat-doces',
    name: 'Nutella',
    description: 'Mussarela e Nutella pura com granulado.',
    price: 32.00,
    price_p: 32.00,
    price_m: 41.00,
    price_g: 51.00,
    has_sizes: true,
    sizes: [
      { size_key: 'P', name: 'P (Pequena)', price: 32.00 },
      { size_key: 'M', name: 'M (Média)', price: 41.00 },
      { size_key: 'G', name: 'G (Grande)', price: 51.00 }
    ],
    image_url: "logo.jpg",
    is_promo: false,
    is_active: true,
    is_available: true,
    order_index: 1
  },
  {
    id: 'prod-romeu-julieta',
    category_id: 'cat-doces',
    name: 'Romeu e Julieta',
    description: 'Mussarela especial com deliciosa goiabada cremosa.',
    price: 25.00,
    price_p: 25.00,
    price_m: 35.00,
    price_g: 45.00,
    has_sizes: true,
    sizes: [
      { size_key: 'P', name: 'P (Pequena)', price: 25.00 },
      { size_key: 'M', name: 'M (Média)', price: 35.00 },
      { size_key: 'G', name: 'G (Grande)', price: 45.00 }
    ],
    image_url: "logo.jpg",
    is_promo: false,
    is_active: true,
    is_available: true,
    order_index: 2
  },

  // ==========================================
  // 4. BEBIDAS
  // ==========================================
  {
    id: 'prod-coca-2l',
    category_id: 'cat-bebidas',
    name: 'Coca-Cola 2 Litros',
    description: 'Refrigerante Coca-Cola garrafa 2L bem gelada.',
    price: 14.00,
    image_url: "logo.jpg",
    is_promo: false,
    is_active: true,
    is_available: true,
    order_index: 1
  },
  {
    id: 'prod-guarana-2l',
    category_id: 'cat-bebidas',
    name: 'Guaraná Antarctica 2 Litros',
    description: 'Refrigerante Guaraná Antarctica garrafa 2L bem gelada.',
    price: 12.00,
    image_url: "logo.jpg",
    is_promo: false,
    is_active: true,
    is_available: true,
    order_index: 2
  },
  {
    id: 'prod-coca-lata',
    category_id: 'cat-bebidas',
    name: 'Coca-Cola Lata 350ml',
    description: 'Refrigerante Coca-Cola lata 350ml gelada.',
    price: 6.00,
    image_url: "logo.jpg",
    is_promo: false,
    is_active: true,
    is_available: true,
    order_index: 3
  },
  {
    id: 'prod-guarana-lata',
    category_id: 'cat-bebidas',
    name: 'Guaraná Antarctica Lata 350ml',
    description: 'Refrigerante Guaraná Antarctica lata 350ml gelada.',
    price: 6.00,
    image_url: "logo.jpg",
    is_promo: false,
    is_active: true,
    is_available: true,
    order_index: 4
  },
  {
    id: 'prod-agua',
    category_id: 'cat-bebidas',
    name: 'Água Mineral sem Gás 500ml',
    description: 'Garrafa de água mineral 500ml natural ou gelada.',
    price: 4.00,
    image_url: "logo.jpg",
    is_promo: false,
    is_active: true,
    is_available: true,
    order_index: 5
  }
];

// Exporta globalmente
window.INITIAL_SETTINGS = INITIAL_SETTINGS;
window.INITIAL_OPERATING_HOURS = INITIAL_OPERATING_HOURS;
window.INITIAL_CATEGORIES = INITIAL_CATEGORIES;
window.INITIAL_PRODUCTS = INITIAL_PRODUCTS;
window.INITIAL_OPTIONALS = INITIAL_OPTIONALS;
window.INITIAL_PROMOTIONS = INITIAL_PROMOTIONS;
window.INITIAL_NEIGHBORHOODS = INITIAL_NEIGHBORHOODS;
window.INITIAL_COURIERS = INITIAL_COURIERS;
