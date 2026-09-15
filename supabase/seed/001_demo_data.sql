-- ═══════════════════════════════════════════════════════════════
-- Seed: dados de demonstração (desenvolvimento apenas)
-- ═══════════════════════════════════════════════════════════════
-- Execute: supabase db reset (recriar) ou supabase db seed

do $$
declare
  v_company_id  uuid := '00000000-0000-0000-0000-000000000001';
  v_cat_id      uuid;
  v_prod_id     uuid;
begin
  -- Company demo
  insert into public.companies (id, name, slug, email, plan)
  values (v_company_id, 'Loja Demo', 'loja-demo', 'demo@kyra.app', 'pro')
  on conflict (id) do nothing;

  -- Categories
  insert into public.categories (company_id, name, slug, color)
  values
    (v_company_id, 'Vestuário',    'vestuario',    '#16a34a'),
    (v_company_id, 'Eletrônicos',  'eletronicos',  '#2563eb'),
    (v_company_id, 'Alimentos',    'alimentos',    '#ca8a04')
  on conflict (company_id, slug) do nothing;

  -- Sample products
  select id into v_cat_id from public.categories
  where company_id = v_company_id and slug = 'vestuario' limit 1;

  insert into public.products (company_id, category_id, name, sku, cost_price, sale_price, min_stock, unit)
  values
    (v_company_id, v_cat_id, 'Camiseta Branca M',   'CAM-BRA-M', 18.00, 49.90,  5, 'un'),
    (v_company_id, v_cat_id, 'Camiseta Preta P',    'CAM-PTA-P', 18.00, 49.90,  5, 'un'),
    (v_company_id, v_cat_id, 'Calça Jeans 42',      'CAL-JNS-42', 55.00, 149.90, 3, 'un')
  on conflict (company_id, sku) do nothing;

  -- Entrada inicial de estoque
  for v_prod_id in
    select id from public.products where company_id = v_company_id
  loop
    insert into public.stock_movements (company_id, product_id, type, quantity, unit_cost, notes)
    values (v_company_id, v_prod_id, 'ENTRADA', 50, 20.00, 'Estoque inicial');
  end loop;

end $$;
