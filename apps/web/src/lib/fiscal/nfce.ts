// apps/web/src/lib/fiscal/nfce.ts
// Gerador de XML NFC-e (modelo 65) — Kyra Estoque
// Adaptado de Kyra Lovi: UF e cUF dinâmicos (não mais hardcoded MG/31)

import { UF_PARA_CUF } from './sefaz'

export interface ItemNFCe {
  codigo:    string
  descricao: string
  ncm:       string
  cest?:     string
  cfop:      string
  unidade:   string
  quantidade: number
  valor_unit: number
  valor_total: number
}

export interface PagamentoNFCe {
  tipo: '01'|'02'|'03'|'04'|'05'|'10'|'11'|'12'|'13'|'15'|'16'|'17'|'18'|'19'|'90'|'99'
  valor: number
  integracao?: '1'|'2'
}

export interface EmissorNFCe {
  cnpj:          string
  razao_social:  string
  nome_fantasia: string
  ie:            string
  crt:           number
  logradouro:    string
  numero:        string
  bairro:        string
  municipio:     string
  cod_municipio: string
  uf:            string   // 2 letras — usado para cUF e URLs
  cep:           string
  telefone:      string
  nat_op:        string
  csosn:         string
  cfop_dentro:   string
  cfop_fora:     string
  csc_id:        string
  csc_token:     string
  serie:         number
  numero_nf:     number
  ambiente:      1|2      // 1=produção 2=homologação
}

export interface DestinatarioNFCe {
  cpf?:    string
  nome?:   string
  email?:  string
}

function pad(n: number, size: number): string {
  return String(n).padStart(size, '0')
}

function gerarCNF(): string {
  return pad(Math.floor(Math.random() * 99999999), 8)
}

function calcularDV(chave: string): number {
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9]
  let soma = 0
  let idx = 0
  for (let i = chave.length - 1; i >= 0; i--) {
    soma += parseInt(chave[i]!) * pesos[idx % 8]!
    idx++
  }
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

export function gerarChaveAcesso(params: {
  uf: string
  data: Date
  cnpj: string
  mod: string
  serie: number
  numero: number
  tpEmis: string
  cNF: string
}): string {
  const { uf, data, cnpj, mod, serie, numero, tpEmis, cNF } = params
  const cUF = UF_PARA_CUF[uf.toUpperCase()] ?? '31'
  // AAMM = 2 dígitos do ano + 2 do mês (YYMM, 4 posições)
  const aamm = `${pad(data.getFullYear() % 100, 2)}${pad(data.getMonth() + 1, 2)}`
  const cnpjLimpo = cnpj.replace(/\D/g, '')
  const chave = `${cUF}${aamm}${cnpjLimpo}${mod}${pad(serie, 3)}${pad(numero, 9)}${tpEmis}${cNF}`
  const dv = calcularDV(chave)
  return `${chave}${dv}`
}

export function gerarXMLNFCe(params: {
  emissor:       EmissorNFCe
  destinatario?: DestinatarioNFCe
  itens:         ItemNFCe[]
  pagamentos:    PagamentoNFCe[]
  desconto?:     number
  data:          Date
}): { xml: string; chave: string } {
  const { emissor, destinatario, itens, pagamentos, desconto = 0, data } = params
  const cUF = UF_PARA_CUF[emissor.uf.toUpperCase()] ?? '31'

  const cNF = gerarCNF()
  const chave = gerarChaveAcesso({
    uf: emissor.uf,
    data,
    cnpj: emissor.cnpj,
    mod: '65',
    serie: emissor.serie,
    numero: emissor.numero_nf,
    tpEmis: '1',
    cNF,
  })

  const totalProd = itens.reduce((s, i) => s + i.valor_total, 0)
  const totalNF = totalProd - desconto
  const totalPag = pagamentos.reduce((s, p) => s + p.valor, 0)
  const dhEmi = data.toISOString().replace('Z', '-03:00').replace(/\.\d+/, '')
  const vTotTrib = (totalNF * 0.3145).toFixed(2)
  const cfop = emissor.cfop_dentro

  const xmlItens = itens.map((item, idx) => `
  <det nItem="${idx + 1}">
    <prod>
      <cProd>${item.codigo}</cProd>
      <cEAN>SEM GTIN</cEAN>
      <xProd>${item.descricao.toUpperCase().slice(0, 120)}</xProd>
      <NCM>${item.ncm.replace(/\D/g, '')}</NCM>
      ${item.cest ? `<CEST>${item.cest.replace(/\D/g, '')}</CEST>` : ''}
      <indEscala>S</indEscala>
      <CFOP>${cfop}</CFOP>
      <uCom>${item.unidade || 'UN'}</uCom>
      <qCom>${item.quantidade.toFixed(4)}</qCom>
      <vUnCom>${item.valor_unit.toFixed(10)}</vUnCom>
      <vProd>${item.valor_total.toFixed(2)}</vProd>
      <cEANTrib>SEM GTIN</cEANTrib>
      <uTrib>${item.unidade || 'UN'}</uTrib>
      <qTrib>${item.quantidade.toFixed(4)}</qTrib>
      <vUnTrib>${item.valor_unit.toFixed(10)}</vUnTrib>
      <indTot>1</indTot>
    </prod>
    <imposto>
      <vTotTrib>${(item.valor_total * 0.3145).toFixed(2)}</vTotTrib>
      <ICMS>
        <ICMSSN${emissor.csosn}>
          <orig>0</orig>
          <CSOSN>${emissor.csosn}</CSOSN>
        </ICMSSN${emissor.csosn}>
      </ICMS>
    </imposto>
  </det>`).join('\n')

  const xmlPag = pagamentos.map(p => `
    <detPag>
      <indPag>1</indPag>
      <tPag>${p.tipo}</tPag>
      <vPag>${p.valor.toFixed(2)}</vPag>
      ${(p.tipo === '03' || p.tipo === '04') ? `<card><tpIntegra>${p.integracao ?? '2'}</tpIntegra></card>` : ''}
    </detPag>`).join('\n')

  const xmlDest = destinatario?.cpf ? `
  <dest>
    <CPF>${destinatario.cpf.replace(/\D/g, '')}</CPF>
    ${destinatario.nome ? `<xNome>${destinatario.nome.slice(0, 60)}</xNome>` : ''}
    ${destinatario.email ? `<email>${destinatario.email.slice(0, 60)}</email>` : ''}
    <indIEDest>9</indIEDest>
  </dest>` : ''

  const urlQRBase = emissor.ambiente === 1
    ? `https://portalsped.fazenda.${emissor.uf.toLowerCase()}.gov.br/portalnfce/sistema/qrcode.xhtml`
    : `https://hnfe.fazenda.${emissor.uf.toLowerCase()}.gov.br/portalnfce/sistema/qrcode.xhtml`

  const ibptFed = (totalNF * 0.1624).toFixed(2)
  const ibptEst = (totalNF * 0.1521).toFixed(2)
  const infAdic = `Obrigado - Volte sempre! | ${emissor.nome_fantasia} - ${emissor.telefone}`

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${chave}" versao="4.00">
    <ide>
      <cUF>${cUF}</cUF>
      <cNF>${cNF}</cNF>
      <natOp>${emissor.nat_op}</natOp>
      <mod>65</mod>
      <serie>${emissor.serie}</serie>
      <nNF>${emissor.numero_nf}</nNF>
      <dhEmi>${dhEmi}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>${emissor.cod_municipio}</cMunFG>
      <tpImp>4</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${chave.slice(-1)}</cDV>
      <tpAmb>${emissor.ambiente}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <indIntermed>0</indIntermed>
      <procEmi>0</procEmi>
      <verProc>KyraEstoque-1.0</verProc>
    </ide>
    <emit>
      <CNPJ>${emissor.cnpj.replace(/\D/g, '')}</CNPJ>
      <xNome>${emissor.razao_social}</xNome>
      <xFant>${emissor.nome_fantasia}</xFant>
      <enderEmit>
        <xLgr>${emissor.logradouro}</xLgr>
        <nro>${emissor.numero}</nro>
        <xBairro>${emissor.bairro}</xBairro>
        <cMun>${emissor.cod_municipio}</cMun>
        <xMun>${emissor.municipio}</xMun>
        <UF>${emissor.uf.toUpperCase()}</UF>
        <CEP>${emissor.cep.replace(/\D/g, '')}</CEP>
        <cPais>1058</cPais>
        <xPais>BRASIL</xPais>
        ${emissor.telefone ? `<fone>${emissor.telefone.replace(/\D/g, '')}</fone>` : ''}
      </enderEmit>
      <IE>${emissor.ie}</IE>
      <CRT>${emissor.crt}</CRT>
    </emit>
    ${xmlDest}
    ${xmlItens}
    <total>
      <ICMSTot>
        <vBC>0.00</vBC><vICMS>0.00</vICMS><vICMSDeson>0.00</vICMSDeson>
        <vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST>
        <vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet>
        <vProd>${totalProd.toFixed(2)}</vProd>
        <vFrete>0.00</vFrete><vSeg>0.00</vSeg>
        <vDesc>${desconto.toFixed(2)}</vDesc>
        <vII>0.00</vII><vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol>
        <vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro>
        <vNF>${totalNF.toFixed(2)}</vNF>
        <vTotTrib>${vTotTrib}</vTotTrib>
      </ICMSTot>
    </total>
    <transp><modFrete>9</modFrete></transp>
    <pag>
      ${xmlPag}
      <vTroco>${Math.max(0, totalPag - totalNF).toFixed(2)}</vTroco>
    </pag>
    <infAdic>
      <infCpl>Trib aprox R$: ${ibptFed} Fed e ${ibptEst} Est;Fonte: IBPT/empresometro.com.br;${infAdic}</infCpl>
    </infAdic>
    <infNFeSupl>
      <qrCode>${urlQRBase}?p=${chave}|2|${emissor.ambiente}|${emissor.csc_id ?? '1'}|HASH_PLACEHOLDER</qrCode>
      <urlChave>${urlQRBase.replace('/sistema/qrcode.xhtml', '')}</urlChave>
    </infNFeSupl>
  </infNFe>
</NFe>`

  return { xml, chave }
}

export function mapFormaParaTpPag(forma: string): PagamentoNFCe['tipo'] {
  const mapa: Record<string, PagamentoNFCe['tipo']> = {
    dinheiro: '01', cartao_credito: '03', cartao_debito: '04',
    pix: '17', cartao: '03', boleto: '15', misto: '99',
  }
  return mapa[forma] ?? '99'
}
