-- Sprint 19c: Adiciona NCM e CFOP nos produtos para emissão de NF-e
alter table public.products
  add column if not exists ncm  text check (length(replace(ncm,  '.', '')) between 8 and 8 or ncm is null),
  add column if not exists cfop text check (length(cfop) = 4 or cfop is null);

comment on column public.products.ncm  is 'Nomenclatura Comum do Mercosul — 8 dígitos (ex: 61091000)';
comment on column public.products.cfop is 'Código Fiscal de Operações — 4 dígitos (ex: 5102)';
