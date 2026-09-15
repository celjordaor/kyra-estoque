-- ═══════════════════════════════════════════════════════════════════════
-- Migration 0010 — Clientes, Fornecedores e Marcas
-- ═══════════════════════════════════════════════════════════════════════

-- ── brands ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brands (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  slug        text NOT NULL,
  description text,
  logo_url    text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, slug)
);

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brands_company" ON brands
  USING (company_id = my_company_id());

CREATE TRIGGER brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── customers ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- Pessoa física ou jurídica
  person_type  text NOT NULL DEFAULT 'individual' CHECK (person_type IN ('individual','company')),
  name         text NOT NULL,
  document     text,          -- CPF ou CNPJ
  email        text,
  phone        text,
  -- Endereço
  zipcode      text,
  address      text,
  address_number text,
  complement   text,
  neighborhood text,
  city         text,
  state        text,
  -- Extras
  notes        text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_company" ON customers
  USING (company_id = my_company_id());

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── suppliers ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  person_type  text NOT NULL DEFAULT 'company' CHECK (person_type IN ('individual','company')),
  name         text NOT NULL,
  trade_name   text,          -- nome fantasia
  document     text,          -- CNPJ ou CPF
  email        text,
  phone        text,
  contact_name text,          -- pessoa de contato
  -- Endereço
  zipcode      text,
  address      text,
  address_number text,
  complement   text,
  neighborhood text,
  city         text,
  state        text,
  -- Extras
  notes        text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_company" ON suppliers
  USING (company_id = my_company_id());

CREATE TRIGGER suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── brand_id na tabela products ───────────────────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brands(id) ON DELETE SET NULL;

-- ── indexes ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_brands_company        ON brands(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company     ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_document    ON customers(company_id, document) WHERE document IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_company     ON suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_document    ON suppliers(company_id, document) WHERE document IS NOT NULL;
