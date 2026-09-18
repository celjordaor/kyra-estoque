# Phase 8 — Lint / TypeScript

Data: 2026-09-17 | Status: PARCIALMENTE EXECUTADO

## Limitação de ambiente
O ambiente Linux VM não consegue resolver os symlinks do pnpm do Windows.
TSC rodou com TypeScript 5.9.3 (projeto usa 5.8.3) sem os packages resolvidos.
Erros TS2307/TS2503/TS2614/TS7026/TS7006 são **artefatos de ambiente**, não bugs reais.

## Erros genuínos identificados (TS2741 — children missing)

### layout.tsx (app)
- `AppShell` chamado sem `children` prop em `src/app/(app)/layout.tsx:50`

### products/new/manual/page.tsx
- `FormFieldProps` usado sem `children` em 13+ ocorrências

### products/new/upload/page.tsx  
- Componente wrapper sem `children` em 6+ ocorrências

### (legal)/privacy/page.tsx
- Componentes de seção sem `children` em 15+ ocorrências

### products/[id]/edit/page.tsx
- Arquivo aparentemente incompleto / WIP — 100+ erros de tipos
- Todos os imports de terceiros sem resolução no ambiente de teste

## Classificação
- **F-018 (INFO):** Múltiplos erros TypeScript `children` prop missing
  Impacto: build pode falhar em CI com `tsc --noEmit`
  Não são bugs de segurança, mas indicam componentes com API pública divergente

## Recomendação
Executar `pnpm tsc --noEmit` e `pnpm lint` no ambiente Windows com pnpm completo
para relatório definitivo. Os erros de `children` devem ser corrigidos antes do deploy.
