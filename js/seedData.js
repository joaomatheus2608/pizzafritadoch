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
  closed_message: 'Estamos fechados no momento. Nosso horário de funcionamento é de Quarta a Domingo, das 17:00 às 22:00 (Segunda e Terça fechado).',
  admin_password_hash: 'chomelhor', // Senha padrão de acesso admin local
  pix_key: '5581991421295',
  pix_type: 'Telefone',
  pix_beneficiary: 'Pizza Frita do CH'
};

const INITIAL_OPERATING_HOURS = [
  { day_of_week: 0, day_name: 'Domingo', open_time: '17:00', close_time: '22:00', is_open: true },
  { day_of_week: 1, day_name: 'Segunda-feira', open_time: '17:00', close_time: '22:00', is_open: false },
  { day_of_week: 2, day_name: 'Terça-feira', open_time: '17:00', close_time: '22:00', is_open: false },
  { day_of_week: 3, day_name: 'Quarta-feira', open_time: '17:00', close_time: '22:00', is_open: true },
  { day_of_week: 4, day_name: 'Quinta-feira', open_time: '17:00', close_time: '22:00', is_open: true },
  { day_of_week: 5, day_name: 'Sexta-feira', open_time: '17:00', close_time: '22:00', is_open: true },
  { day_of_week: 6, day_name: 'Sábado', open_time: '17:00', close_time: '22:00', is_open: true }
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
  { id: 'bairro-1', name: 'Alphaville', delivery_fee: 15.00, is_active: true, order_index: 1 },
  { id: 'bairro-2', name: 'Alto da Fábrica', delivery_fee: 6.00, is_active: true, order_index: 2 },
  { id: 'bairro-3', name: 'Alto do Vento', delivery_fee: 15.00, is_active: true, order_index: 3 },
  { id: 'bairro-4', name: 'Bulhões', delivery_fee: 6.00, is_active: true, order_index: 4 },
  { id: 'bairro-5', name: 'Cascata', delivery_fee: 7.00, is_active: true, order_index: 5 },
  { id: 'bairro-6', name: 'Coqueiral', delivery_fee: 20.00, is_active: true, order_index: 6 },
  { id: 'bairro-7', name: 'Cavaleiro (Antes da Estação)', delivery_fee: 15.00, is_active: true, order_index: 7 },
  { id: 'bairro-8', name: 'Cavaleiro (Bairros)', delivery_fee: 20.00, is_active: true, order_index: 8 },
  { id: 'bairro-9', name: 'Curado 1 / 2 / 3 / 4', delivery_fee: 20.00, is_active: true, order_index: 9 },
  { id: 'bairro-10', name: 'Dois Carneiros (Até Fund. Bradesco / Yapoatam)', delivery_fee: 15.00, is_active: true, order_index: 10 },
  { id: 'bairro-11', name: 'Dois Carneiros (Após Fund. Bradesco)', delivery_fee: 20.00, is_active: true, order_index: 11 },
  { id: 'bairro-12', name: 'Engenho Velho', delivery_fee: 7.00, is_active: true, order_index: 12 },
  { id: 'bairro-13', name: 'Floriano', delivery_fee: 10.00, is_active: true, order_index: 13 },
  { id: 'bairro-14', name: 'Lote 56 (Terminal)', delivery_fee: 7.00, is_active: true, order_index: 14 },
  { id: 'bairro-15', name: 'Lote 56 (Casinhas)', delivery_fee: 10.00, is_active: true, order_index: 15 },
  { id: 'bairro-16', name: 'Lote 92', delivery_fee: 7.00, is_active: true, order_index: 16 },
  { id: 'bairro-17', name: 'Lote 92 (Colônia dos Padres)', delivery_fee: 8.00, is_active: true, order_index: 17 },
  { id: 'bairro-18', name: 'Tenda', delivery_fee: 6.00, is_active: true, order_index: 18 },
  { id: 'bairro-19', name: 'Malvinas', delivery_fee: 7.00, is_active: true, order_index: 19 },
  { id: 'bairro-20', name: 'Marcos Freire', delivery_fee: 20.00, is_active: true, order_index: 20 },
  { id: 'bairro-21', name: 'Manassu', delivery_fee: 10.00, is_active: true, order_index: 21 },
  { id: 'bairro-22', name: 'Moenda', delivery_fee: 6.00, is_active: true, order_index: 22 },
  { id: 'bairro-23', name: 'Muribeca', delivery_fee: 20.00, is_active: true, order_index: 23 },
  { id: 'bairro-24', name: 'Zumbi do Pacheco', delivery_fee: 20.00, is_active: true, order_index: 24 },
  { id: 'bairro-25', name: "UR's / Ibura", delivery_fee: 20.00, is_active: true, order_index: 25 },
  { id: 'bairro-26', name: 'Pacheco', delivery_fee: 20.00, is_active: true, order_index: 26 },
  { id: 'bairro-27', name: 'Padre Roma', delivery_fee: 7.00, is_active: true, order_index: 27 },
  { id: 'bairro-28', name: 'Quadro', delivery_fee: 7.00, is_active: true, order_index: 28 },
  { id: 'bairro-29', name: 'Vila Natal (Na Portaria)', delivery_fee: 7.00, is_active: true, order_index: 29 },
  { id: 'bairro-30', name: 'Vila Natal (No Apartamento)', delivery_fee: 10.00, is_active: true, order_index: 30 },
  { id: 'bairro-31', name: 'Vila Natal (Condomínio sem entrada de moto)', delivery_fee: 12.00, is_active: true, order_index: 31 },
  { id: 'bairro-32', name: 'Retiro', delivery_fee: 12.00, is_active: true, order_index: 32 },
  { id: 'bairro-33', name: 'Sancho', delivery_fee: 20.00, is_active: true, order_index: 33 },
  { id: 'bairro-34', name: 'Santo Aleixo', delivery_fee: 7.00, is_active: true, order_index: 34 },
  { id: 'bairro-35', name: 'Santo Aleixo (Após Nazareno)', delivery_fee: 9.00, is_active: true, order_index: 35 },
  { id: 'bairro-36', name: 'Socorro (Antes da Granja)', delivery_fee: 8.00, is_active: true, order_index: 36 },
  { id: 'bairro-37', name: 'Socorro (Entrada da Granja)', delivery_fee: 10.00, is_active: true, order_index: 37 },
  { id: 'bairro-38', name: 'Suassuna (Portaria)', delivery_fee: 10.00, is_active: true, order_index: 38 },
  { id: 'bairro-39', name: 'Suassuna (Porta do Apartamento)', delivery_fee: 12.00, is_active: true, order_index: 39 },
  { id: 'bairro-40', name: 'Sucupira', delivery_fee: 15.00, is_active: true, order_index: 40 },
  { id: 'bairro-41', name: 'Vila Piedade', delivery_fee: 10.00, is_active: true, order_index: 41 },
  { id: 'bairro-42', name: 'Vila Rica', delivery_fee: 6.00, is_active: true, order_index: 42 },
  { id: 'bairro-43', name: 'Vila Rica (Porta do Apt das Cohab)', delivery_fee: 8.00, is_active: true, order_index: 43 },
  { id: 'bairro-44', name: 'Santo Antônio (Terminal / Cachimbinho)', delivery_fee: 6.00, is_active: true, order_index: 44 },
  { id: 'bairro-45', name: 'Vista Alegre', delivery_fee: 6.00, is_active: true, order_index: 45 },
  { id: 'bairro-46', name: 'Batoreu', delivery_fee: 6.00, is_active: true, order_index: 46 },
  { id: 'bairro-47', name: 'Gruta do Amor', delivery_fee: 9.00, is_active: true, order_index: 47 },
  { id: 'bairro-48', name: 'Moreno', delivery_fee: 20.00, is_active: true, order_index: 48 },
  { id: 'bairro-49', name: 'Barro', delivery_fee: 25.00, is_active: true, order_index: 49 },
  { id: 'bairro-50', name: 'Areias', delivery_fee: 25.00, is_active: true, order_index: 50 },
  { id: 'bairro-51', name: 'San Martin', delivery_fee: 25.00, is_active: true, order_index: 51 },
  { id: 'bairro-52', name: 'Ipsep', delivery_fee: 25.00, is_active: true, order_index: 52 },
  { id: 'bairro-53', name: 'Várzea', delivery_fee: 30.00, is_active: true, order_index: 53 },
  { id: 'bairro-54', name: 'Imbiribeira', delivery_fee: 25.00, is_active: true, order_index: 54 },
  { id: 'bairro-55', name: 'Centro do Recife', delivery_fee: 35.00, is_active: true, order_index: 55 },
  { id: 'bairro-56', name: 'Afogados', delivery_fee: 30.00, is_active: true, order_index: 56 },
  { id: 'bairro-57', name: 'Cajueiro Seco / Prazeres', delivery_fee: 25.00, is_active: true, order_index: 57 },
  { id: 'bairro-58', name: 'Piedade / Boa Viagem', delivery_fee: 30.00, is_active: true, order_index: 58 },
  { id: 'bairro-59', name: 'Candeias', delivery_fee: 35.00, is_active: true, order_index: 59 },
  { id: 'bairro-60', name: 'Barra de Jangada', delivery_fee: 40.00, is_active: true, order_index: 60 }
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
