// apps/web/src/lib/fiscal/numeracao.ts
// Reserva atômica de número fiscal (NF-e ou NFC-e) via compare-and-set.
// Adaptado de Kyra Lovi: usa company_id em vez de empresa_id.

import type { SupabaseClient } from '@supabase/supabase-js'

export class NumeracaoError extends Error {
  constructor(message: string, readonly kind: 'db'|'contention'|'config') {
    super(message)
  }
}

export interface NumeroReservado {
  configId: string
  numero: number
  serie: string
}

export async function reservarNumeroNfe(
  db: SupabaseClient,
  companyId: string,
  maxTentativas = 5
): Promise<NumeroReservado> {
  return _reservar(db, companyId, 'nfe', maxTentativas)
}

export async function reservarNumeroNfce(
  db: SupabaseClient,
  companyId: string,
  maxTentativas = 5
): Promise<NumeroReservado> {
  return _reservar(db, companyId, 'nfce', maxTentativas)
}

async function _reservar(
  db: SupabaseClient,
  companyId: string,
  tipo: 'nfe'|'nfce',
  maxTentativas: number
): Promise<NumeroReservado> {
  if (!companyId) throw new NumeracaoError('company_id não resolvido para numeração fiscal.', 'config')

  const colNumero = tipo === 'nfe' ? 'ultimo_numero_nfe' : 'ultimo_numero_nfce'
  const colSerie  = tipo === 'nfe' ? 'serie_nfe' : 'serie_nfce'

  for (let tentativa = 0; tentativa < maxTentativas; tentativa++) {
    const { data: atual, error: errLeitura } = await (db as any)
      .from('fiscal_config')
      .select(`id, ${colNumero}, ${colSerie}`)
      .eq('company_id', companyId)
      .single()

    if (errLeitura) throw new NumeracaoError(`Falha ao ler numeração: ${errLeitura.message}`, 'db')
    if (!atual) throw new NumeracaoError('Configuração fiscal não encontrada.', 'config')

    const corrente = Number(atual[colNumero] ?? 0)
    if (!Number.isInteger(corrente) || corrente < 0) throw new NumeracaoError('Numeração fiscal inválida.', 'config')
    const proximo = corrente + 1

    const { data: atualizadas, error: errUpdate } = await (db as any)
      .from('fiscal_config')
      .update({ [colNumero]: proximo })
      .eq('id', atual.id)
      .eq('company_id', companyId)
      .eq(colNumero, corrente)
      .select('id')

    if (errUpdate) throw new NumeracaoError(`Falha ao reservar número: ${errUpdate.message}`, 'db')
    if (Array.isArray(atualizadas) && atualizadas.length === 1) {
      return { configId: atual.id, numero: proximo, serie: String(atual[colSerie] ?? '1') }
    }
    // Concorrência: outra requisição avançou o contador — tenta novamente
  }

  throw new NumeracaoError('Não foi possível reservar o número fiscal (concorrência). Tente novamente.', 'contention')
}
