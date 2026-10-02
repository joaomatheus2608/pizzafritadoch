-- ========================================================
-- PIZZA FRITA DO CH - SCHEMA E DADOS INICIAIS DO SUPABASE
-- Execute este script completo no SQL Editor do seu Supabase Dashboard:
-- https://supabase.com/dashboard/project/_/sql
-- ========================================================

-- 1. HABILITAR EXTENSÕES NECESSÁRIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================================
-- 2. CRIAÇÃO DAS TABELAS
-- ========================================================

-- TABELA: settings (Configurações da Loja)
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY DEFAULT 'store-settings',
    name TEXT NOT NULL DEFAULT 'Pizza Frita do CH',
    slogan TEXT DEFAULT 'Não é pizza, muito menos pastel. É uma experiência única!',
    address TEXT DEFAULT 'Jaboatão Centro - PE',
    whatsapp TEXT DEFAULT '5581991421295',
    instagram TEXT DEFAULT '@pizzafritadoch',
    delivery_fee NUMERIC(10,2) DEFAULT 5.00,
    min_order_value NUMERIC(10,2) DEFAULT 15.00,
    store_status_mode TEXT DEFAULT 'auto',
    closed_message TEXT DEFAULT 'Estamos fechados no momento. Nosso horário de funcionamento é das 18:00 às 23:00 (Apenas Delivery).',
    admin_password_hash TEXT DEFAULT 'chomelhor',
    pix_key TEXT DEFAULT '5581991421295',
    pix_type TEXT DEFAULT 'Telefone',
    pix_beneficiary TEXT DEFAULT 'Pizza Frita do CH',
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- TABELA: operating_hours (Horários de Funcionamento)
CREATE TABLE IF NOT EXISTS public.operating_hours (
    id SERIAL PRIMARY KEY,
    day_of_week INTEGER NOT NULL UNIQUE CHECK (day_of_week BETWEEN 0 AND 6),
    day_name TEXT NOT NULL,
    open_time TEXT NOT NULL DEFAULT '18:00',
    close_time TEXT NOT NULL DEFAULT '23:00',
    is_open BOOLEAN NOT NULL DEFAULT true
);

-- TABELA: categories (Categorias do Cardápio)
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- TABELA: products (Pizzas e Bebidas)
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    price NUMERIC(10,2) DEFAULT 0.00,
    price_p NUMERIC(10,2) DEFAULT 0.00,
    price_m NUMERIC(10,2) DEFAULT 0.00,
    price_g NUMERIC(10,2) DEFAULT 0.00,
    has_sizes BOOLEAN DEFAULT false,
    sizes JSONB DEFAULT '[]'::jsonb,
    image_url TEXT,
    is_promo BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    is_available BOOLEAN DEFAULT true,
    order_index INTEGER DEFAULT 0,
    sales_channel TEXT DEFAULT 'todos',
    promo_price NUMERIC(10,2) DEFAULT 0.00,
    promo_days JSONB DEFAULT '[]'::jsonb,
    monday_price NUMERIC(10,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- TABELA: optionals (Adicionais / Ingredientes Extras)
CREATE TABLE IF NOT EXISTS public.optionals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC(10,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- TABELA: neighborhoods (Bairros e Taxas de Entrega)
CREATE TABLE IF NOT EXISTS public.neighborhoods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 5.00,
    is_active BOOLEAN DEFAULT true,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- TABELA: couriers (Entregadores / Motoboys)
CREATE TABLE IF NOT EXISTS public.couriers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- TABELA: orders (Pedidos em Tempo Real)
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    order_number BIGSERIAL,
    customer_name TEXT,
    customer_phone TEXT,
    order_type TEXT DEFAULT 'delivery',
    delivery_fee NUMERIC(10,2) DEFAULT 0.00,
    subtotal NUMERIC(10,2) DEFAULT 0.00,
    discount NUMERIC(10,2) DEFAULT 0.00,
    total NUMERIC(10,2) DEFAULT 0.00,
    payment_method TEXT,
    change_for NUMERIC(10,2),
    address_street TEXT,
    address_number TEXT,
    address_neighborhood TEXT,
    address_complement TEXT,
    address_reference TEXT,
    notes TEXT,
    status TEXT DEFAULT 'novo',
    courier_name TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    whatsapp_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- TABELA: users (Clientes Cadastrados)
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    role TEXT DEFAULT 'client',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- TABELA: addresses (Endereços Salvos de Clientes)
CREATE TABLE IF NOT EXISTS public.addresses (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    label TEXT DEFAULT 'Casa',
    street TEXT NOT NULL,
    number TEXT NOT NULL,
    neighborhood TEXT NOT NULL,
    complement TEXT,
    reference TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- TABELA: cash_closings (Fechamento de Caixa)
CREATE TABLE IF NOT EXISTS public.cash_closings (
    id TEXT PRIMARY KEY,
    date_ref TEXT NOT NULL,
    total_orders INTEGER DEFAULT 0,
    total_revenue NUMERIC(10,2) DEFAULT 0.00,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- ========================================================
-- 3. POLÍTICAS DE SEGURANÇA (ROW LEVEL SECURITY - RLS)
-- Permite leitura e escrita públicas (anon) para o funcionamento do Delivery
-- ========================================================

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neighborhoods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_closings ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso Total para anon e authenticated
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Public Access %I" ON public.%I', tbl, tbl);
        EXECUTE format('CREATE POLICY "Public Access %I" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', tbl, tbl);
    END LOOP;
END $$;

-- ========================================================
-- 4. BUCKET DE ARMAZENAMENTO PARA IMAGENS (Storage)
-- ========================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Permissão de leitura e upload público no bucket products
DROP POLICY IF EXISTS "Public Products Storage Read" ON storage.objects;
CREATE POLICY "Public Products Storage Read" ON storage.objects
FOR SELECT TO anon, authenticated USING (bucket_id = 'products');

DROP POLICY IF EXISTS "Public Products Storage Insert" ON storage.objects;
CREATE POLICY "Public Products Storage Insert" ON storage.objects
FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'products');

DROP POLICY IF EXISTS "Public Products Storage Update" ON storage.objects;
CREATE POLICY "Public Products Storage Update" ON storage.objects
FOR UPDATE TO anon, authenticated USING (bucket_id = 'products');

DROP POLICY IF EXISTS "Public Products Storage Delete" ON storage.objects;
CREATE POLICY "Public Products Storage Delete" ON storage.objects
FOR DELETE TO anon, authenticated USING (bucket_id = 'products');

-- ========================================================
-- 5. SUPABASE REALTIME
-- ========================================================

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ========================================================
-- 6. DADOS INICIAIS (SEED DATA - PIZZA FRITA DO CH)
-- ========================================================

-- Configurações da Loja
INSERT INTO public.settings (id, name, slogan, address, whatsapp, instagram, delivery_fee, min_order_value, store_status_mode, closed_message, admin_password_hash, pix_key, pix_type, pix_beneficiary)
VALUES (
    'store-settings',
    'Pizza Frita do CH',
    'Não é pizza, muito menos pastel. É uma experiência única!',
    'Jaboatão Centro - PE',
    '5581991421295',
    '@pizzafritadoch',
    5.00,
    15.00,
    'auto',
    'Estamos fechados no momento. Nosso horário de funcionamento é de Quarta a Domingo, das 17:00 às 22:00 (Segunda e Terça fechado).',
    'chomelhor',
    '5581991421295',
    'Telefone',
    'Pizza Frita do CH'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slogan = EXCLUDED.slogan,
    whatsapp = EXCLUDED.whatsapp,
    instagram = EXCLUDED.instagram,
    pix_key = EXCLUDED.pix_key,
    closed_message = EXCLUDED.closed_message;

-- Horários de Funcionamento (Quarta a Domingo, 17:00 às 22:00 | Segunda e Terça fechado)
INSERT INTO public.operating_hours (day_of_week, day_name, open_time, close_time, is_open)
VALUES 
    (0, 'Domingo', '17:00', '22:00', true),
    (1, 'Segunda-feira', '17:00', '22:00', false),
    (2, 'Terça-feira', '17:00', '22:00', false),
    (3, 'Quarta-feira', '17:00', '22:00', true),
    (4, 'Quinta-feira', '17:00', '22:00', true),
    (5, 'Sexta-feira', '17:00', '22:00', true),
    (6, 'Sábado', '17:00', '22:00', true)
ON CONFLICT (day_of_week) DO UPDATE SET
    open_time = EXCLUDED.open_time,
    close_time = EXCLUDED.close_time,
    is_open = EXCLUDED.is_open;

-- Categorias do Cardápio
INSERT INTO public.categories (id, name, slug, order_index, is_active)
VALUES
    ('cat-salgadas', 'Sabores Salgados', 'sabores-salgados', 1, true),
    ('cat-premium', 'Linha Premium (Cream Cheese)', 'linha-premium', 2, true),
    ('cat-doces', 'Pizzas Doces', 'pizzas-doces', 3, true),
    ('cat-bebidas', 'Bebidas', 'bebidas', 4, true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    order_index = EXCLUDED.order_index;

-- Adicionais
INSERT INTO public.optionals (id, name, price, is_active, order_index)
VALUES
    ('opt-cream-cheese', 'Adicional Cream Cheese', 5.00, true, 1),
    ('opt-cheddar', 'Adicional Cheddar', 4.00, true, 2),
    ('opt-bacon', 'Adicional Bacon Crocante', 4.00, true, 3),
    ('opt-queijo', 'Adicional Mussarela', 4.00, true, 4),
    ('opt-ovo', 'Adicional Ovo Cozido', 2.00, true, 5)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price;

-- Bairros e Taxas
INSERT INTO public.neighborhoods (id, name, delivery_fee, is_active, order_index)
VALUES
    ('bairro-1', 'Alphaville', 15.00, true, 1),
    ('bairro-2', 'Alto da Fábrica', 6.00, true, 2),
    ('bairro-3', 'Alto do Vento', 15.00, true, 3),
    ('bairro-4', 'Bulhões', 6.00, true, 4),
    ('bairro-5', 'Cascata', 7.00, true, 5),
    ('bairro-6', 'Coqueiral', 20.00, true, 6),
    ('bairro-7', 'Cavaleiro (Antes da Estação)', 15.00, true, 7),
    ('bairro-8', 'Cavaleiro (Bairros)', 20.00, true, 8),
    ('bairro-9', 'Curado 1 / 2 / 3 / 4', 20.00, true, 9),
    ('bairro-10', 'Dois Carneiros (Até Fund. Bradesco / Yapoatam)', 15.00, true, 10),
    ('bairro-11', 'Dois Carneiros (Após Fund. Bradesco)', 20.00, true, 11),
    ('bairro-12', 'Engenho Velho', 7.00, true, 12),
    ('bairro-13', 'Floriano', 10.00, true, 13),
    ('bairro-14', 'Lote 56 (Terminal)', 7.00, true, 14),
    ('bairro-15', 'Lote 56 (Casinhas)', 10.00, true, 15),
    ('bairro-16', 'Lote 92', 7.00, true, 16),
    ('bairro-17', 'Lote 92 (Colônia dos Padres)', 8.00, true, 17),
    ('bairro-18', 'Tenda', 6.00, true, 18),
    ('bairro-19', 'Malvinas', 7.00, true, 19),
    ('bairro-20', 'Marcos Freire', 20.00, true, 20),
    ('bairro-21', 'Manassu', 10.00, true, 21),
    ('bairro-22', 'Moenda', 6.00, true, 22),
    ('bairro-23', 'Muribeca', 20.00, true, 23),
    ('bairro-24', 'Zumbi do Pacheco', 20.00, true, 24),
    ('bairro-25', 'UR''s / Ibura', 20.00, true, 25),
    ('bairro-26', 'Pacheco', 20.00, true, 26),
    ('bairro-27', 'Padre Roma', 7.00, true, 27),
    ('bairro-28', 'Quadro', 7.00, true, 28),
    ('bairro-29', 'Vila Natal (Na Portaria)', 7.00, true, 29),
    ('bairro-30', 'Vila Natal (No Apartamento)', 10.00, true, 30),
    ('bairro-31', 'Vila Natal (Condomínio sem entrada de moto)', 12.00, true, 31),
    ('bairro-32', 'Retiro', 12.00, true, 32),
    ('bairro-33', 'Sancho', 20.00, true, 33),
    ('bairro-34', 'Santo Aleixo', 7.00, true, 34),
    ('bairro-35', 'Santo Aleixo (Após Nazareno)', 9.00, true, 35),
    ('bairro-36', 'Socorro (Antes da Granja)', 8.00, true, 36),
    ('bairro-37', 'Socorro (Entrada da Granja)', 10.00, true, 37),
    ('bairro-38', 'Suassuna (Portaria)', 10.00, true, 38),
    ('bairro-39', 'Suassuna (Porta do Apartamento)', 12.00, true, 39),
    ('bairro-40', 'Sucupira', 15.00, true, 40),
    ('bairro-41', 'Vila Piedade', 10.00, true, 41),
    ('bairro-42', 'Vila Rica', 6.00, true, 42),
    ('bairro-43', 'Vila Rica (Porta do Apt das Cohab)', 8.00, true, 43),
    ('bairro-44', 'Santo Antônio (Terminal / Cachimbinho)', 6.00, true, 44),
    ('bairro-45', 'Vista Alegre', 6.00, true, 45),
    ('bairro-46', 'Batoreu', 6.00, true, 46),
    ('bairro-47', 'Gruta do Amor', 9.00, true, 47),
    ('bairro-48', 'Moreno', 20.00, true, 48),
    ('bairro-49', 'Barro', 25.00, true, 49),
    ('bairro-50', 'Areias', 25.00, true, 50),
    ('bairro-51', 'San Martin', 25.00, true, 51),
    ('bairro-52', 'Ipsep', 25.00, true, 52),
    ('bairro-53', 'Várzea', 30.00, true, 53),
    ('bairro-54', 'Imbiribeira', 25.00, true, 54),
    ('bairro-55', 'Centro do Recife', 35.00, true, 55),
    ('bairro-56', 'Afogados', 30.00, true, 56),
    ('bairro-57', 'Cajueiro Seco / Prazeres', 25.00, true, 57),
    ('bairro-58', 'Piedade / Boa Viagem', 30.00, true, 58),
    ('bairro-59', 'Candeias', 35.00, true, 59),
    ('bairro-60', 'Barra de Jangada', 40.00, true, 60)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    delivery_fee = EXCLUDED.delivery_fee;

-- Entregadores
INSERT INTO public.couriers (id, name, phone, is_active)
VALUES
    ('cour-1', 'Entregador 01', '5581999990001', true),
    ('cour-2', 'Entregador 02', '5581999990002', true)
ON CONFLICT (id) DO NOTHING;

-- Produtos / Cardápio Completo da Pizza Frita do CH
INSERT INTO public.products (id, category_id, name, description, price, price_p, price_m, price_g, has_sizes, sizes, image_url, is_promo, is_active, is_available, order_index)
VALUES
    -- Sabores Salgados
    ('prod-mussarela', 'cat-salgadas', 'Mussarela', 'Queijo mussarela, requeijão e tomate.', 25.00, 25.00, 34.00, 44.00, true, '[{"size_key":"P","name":"P (Pequena)","price":25.00},{"size_key":"M","name":"M (Média)","price":34.00},{"size_key":"G","name":"G (Grande)","price":44.00}]'::jsonb, 'logo.jpg', false, true, true, 1),
    ('prod-calabresa', 'cat-salgadas', 'Calabresa', 'Calabresa, mussarela, requeijão e cebola.', 25.00, 25.00, 35.00, 45.00, true, '[{"size_key":"P","name":"P (Pequena)","price":25.00},{"size_key":"M","name":"M (Média)","price":35.00},{"size_key":"G","name":"G (Grande)","price":45.00}]'::jsonb, 'logo.jpg', false, true, true, 2),
    ('prod-frango', 'cat-salgadas', 'Frango', 'Mussarela, requeijão, frango e milho.', 25.00, 25.00, 35.00, 45.00, true, '[{"size_key":"P","name":"P (Pequena)","price":25.00},{"size_key":"M","name":"M (Média)","price":35.00},{"size_key":"G","name":"G (Grande)","price":45.00}]'::jsonb, 'logo.jpg', false, true, true, 3),
    ('prod-portuguesa', 'cat-salgadas', 'Portuguesa', 'Mussarela, requeijão, presunto, bacon, ovo, cebola, ervilha e azeitona.', 29.00, 29.00, 38.00, 48.00, true, '[{"size_key":"P","name":"P (Pequena)","price":29.00},{"size_key":"M","name":"M (Média)","price":38.00},{"size_key":"G","name":"G (Grande)","price":48.00}]'::jsonb, 'logo.jpg', false, true, true, 4),
    ('prod-charque', 'cat-salgadas', 'Charque', 'Mussarela, requeijão, charque e cebola.', 30.00, 30.00, 39.00, 49.00, true, '[{"size_key":"P","name":"P (Pequena)","price":30.00},{"size_key":"M","name":"M (Média)","price":39.00},{"size_key":"G","name":"G (Grande)","price":49.00}]'::jsonb, 'logo.jpg', false, true, true, 5),
    ('prod-frango-bacon', 'cat-salgadas', 'Frango com Bacon', 'Mussarela, requeijão, frango e bacon.', 28.00, 28.00, 37.00, 47.00, true, '[{"size_key":"P","name":"P (Pequena)","price":28.00},{"size_key":"M","name":"M (Média)","price":37.00},{"size_key":"G","name":"G (Grande)","price":47.00}]'::jsonb, 'logo.jpg', false, true, true, 6),
    ('prod-camarao', 'cat-salgadas', 'Camarão', 'Mussarela, requeijão, camarão e tomate.', 30.00, 30.00, 40.00, 50.00, true, '[{"size_key":"P","name":"P (Pequena)","price":30.00},{"size_key":"M","name":"M (Média)","price":40.00},{"size_key":"G","name":"G (Grande)","price":50.00}]'::jsonb, 'logo.jpg', false, true, true, 7),
    ('prod-frango-cheddar', 'cat-salgadas', 'Frango com Cheddar', 'Mussarela, requeijão, frango e cheddar.', 27.00, 27.00, 37.00, 47.00, true, '[{"size_key":"P","name":"P (Pequena)","price":27.00},{"size_key":"M","name":"M (Média)","price":37.00},{"size_key":"G","name":"G (Grande)","price":47.00}]'::jsonb, 'logo.jpg', false, true, true, 8),
    ('prod-quatro-queijos', 'cat-salgadas', 'Quatro Queijos', 'Mussarela, requeijão, cheddar e coalho.', 28.00, 28.00, 37.00, 47.00, true, '[{"size_key":"P","name":"P (Pequena)","price":28.00},{"size_key":"M","name":"M (Média)","price":37.00},{"size_key":"G","name":"G (Grande)","price":47.00}]'::jsonb, 'logo.jpg', false, true, true, 9),
    ('prod-file-alcatra', 'cat-salgadas', 'Filé de Alcatra', 'Mussarela, requeijão, cubos de alcatra e cebola.', 33.00, 33.00, 42.00, 52.00, true, '[{"size_key":"P","name":"P (Pequena)","price":33.00},{"size_key":"M","name":"M (Média)","price":42.00},{"size_key":"G","name":"G (Grande)","price":52.00}]'::jsonb, 'logo.jpg', false, true, true, 10),
    ('prod-calabresa-cheddar', 'cat-salgadas', 'Calabresa com Cheddar', 'Mussarela, calabresa, cheddar e cebola.', 26.00, 26.00, 36.00, 46.00, true, '[{"size_key":"P","name":"P (Pequena)","price":26.00},{"size_key":"M","name":"M (Média)","price":36.00},{"size_key":"G","name":"G (Grande)","price":46.00}]'::jsonb, 'logo.jpg', false, true, true, 11),
    ('prod-lombo-canadense', 'cat-salgadas', 'Lombo Canadense', 'Mussarela, requeijão, lombo e tomate.', 30.00, 30.00, 39.00, 49.00, true, '[{"size_key":"P","name":"P (Pequena)","price":30.00},{"size_key":"M","name":"M (Média)","price":39.00},{"size_key":"G","name":"G (Grande)","price":49.00}]'::jsonb, 'logo.jpg', false, true, true, 12),
    ('prod-baiana', 'cat-salgadas', 'Baiana', 'Mussarela, requeijão, calabresa, ovo cozido e cebola.', 27.00, 27.00, 37.00, 47.00, true, '[{"size_key":"P","name":"P (Pequena)","price":27.00},{"size_key":"M","name":"M (Média)","price":37.00},{"size_key":"G","name":"G (Grande)","price":47.00}]'::jsonb, 'logo.jpg', false, true, true, 13),

    -- Linha Premium (Cream Cheese)
    ('prod-camarao-cc', 'cat-premium', 'Camarão com Cream Cheese', 'Mussarela, camarão, tomate e Cream Cheese especial.', 35.00, 35.00, 45.00, 55.00, true, '[{"size_key":"P","name":"P (Pequena)","price":35.00},{"size_key":"M","name":"M (Média)","price":45.00},{"size_key":"G","name":"G (Grande)","price":55.00}]'::jsonb, 'logo.jpg', false, true, true, 1),
    ('prod-maminha-cc', 'cat-premium', 'Maminha com Cream Cheese', 'Mussarela, maminha desfiada selecionada, cebola e Cream Cheese.', 36.00, 36.00, 46.00, 56.00, true, '[{"size_key":"P","name":"P (Pequena)","price":36.00},{"size_key":"M","name":"M (Média)","price":46.00},{"size_key":"G","name":"G (Grande)","price":56.00}]'::jsonb, 'logo.jpg', false, true, true, 2),

    -- Pizzas Doces
    ('prod-nutella', 'cat-doces', 'Nutella', 'Mussarela e Nutella pura com granulado.', 32.00, 32.00, 41.00, 51.00, true, '[{"size_key":"P","name":"P (Pequena)","price":32.00},{"size_key":"M","name":"M (Média)","price":41.00},{"size_key":"G","name":"G (Grande)","price":51.00}]'::jsonb, 'logo.jpg', false, true, true, 1),
    ('prod-romeu-julieta', 'cat-doces', 'Romeu e Julieta', 'Mussarela especial com deliciosa goiabada cremosa.', 25.00, 25.00, 35.00, 45.00, true, '[{"size_key":"P","name":"P (Pequena)","price":25.00},{"size_key":"M","name":"M (Média)","price":35.00},{"size_key":"G","name":"G (Grande)","price":45.00}]'::jsonb, 'logo.jpg', false, true, true, 2),

    -- Bebidas
    ('prod-coca-2l', 'cat-bebidas', 'Coca-Cola 2 Litros', 'Refrigerante Coca-Cola garrafa 2L bem gelada.', 14.00, 14.00, 0, 0, false, '[]'::jsonb, 'logo.jpg', false, true, true, 1),
    ('prod-guarana-2l', 'cat-bebidas', 'Guaraná Antarctica 2 Litros', 'Refrigerante Guaraná Antarctica garrafa 2L bem gelada.', 12.00, 12.00, 0, 0, false, '[]'::jsonb, 'logo.jpg', false, true, true, 2),
    ('prod-coca-lata', 'cat-bebidas', 'Coca-Cola Lata 350ml', 'Refrigerante Coca-Cola lata 350ml gelada.', 6.00, 6.00, 0, 0, false, '[]'::jsonb, 'logo.jpg', false, true, true, 3),
    ('prod-guarana-lata', 'cat-bebidas', 'Guaraná Antarctica Lata 350ml', 'Refrigerante Guaraná Antarctica lata 350ml gelada.', 6.00, 6.00, 0, 0, false, '[]'::jsonb, 'logo.jpg', false, true, true, 4),
    ('prod-agua', 'cat-bebidas', 'Água Mineral sem Gás 500ml', 'Garrafa de água mineral 500ml natural ou gelada.', 4.00, 4.00, 0, 0, false, '[]'::jsonb, 'logo.jpg', false, true, true, 5)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    price_p = EXCLUDED.price_p,
    price_m = EXCLUDED.price_m,
    price_g = EXCLUDED.price_g,
    has_sizes = EXCLUDED.has_sizes,
    sizes = EXCLUDED.sizes,
    image_url = EXCLUDED.image_url,
    category_id = EXCLUDED.category_id;

