-- Sprint 19c refactor: NCM por categoria, CFOP na configuração da empresa
-- 1. Adiciona NCM na tabela de categorias
alter table public.categories
  add column if not exists ncm text;

comment on column public.categories.ncm is 'NCM padrão dos produtos desta categoria — 8 dígitos (ex: 61091000)';

-- 2. Remove CFOP de products (vai para kyra_config.fiscal.cfop)
--    Mantém products.ncm como override opcional por produto
alter table public.products
  drop column if exists cfop;
