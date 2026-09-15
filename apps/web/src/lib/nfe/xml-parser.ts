// ── NF-e XML Parser — Sprint 19b ─────────────────────────────────────────────
// Parse de XML NF-e (layout 4.00) para importação de notas de compra.
// Usa DOMParser (server-side via @xmldom/xmldom) ou browser nativo.
// Suporta: <nfeProc>, <NFe>, <nfeProcLote>

export interface NfeParseResult {
  chaveAcesso: string
  numero: string
  serie: string
  modelo: string
  dataEmissao: string        // ISO date YYYY-MM-DD
  emitenteCnpj: string
  emitenteNome: string
  emitenteUf: string
  destinatarioCnpj: string
  destinatarioNome: string
  valorProdutosCents: number
  valorFreteCents: number
  valorDescontoCents: number
  valorIpiCents: number
  valorIcmsCents: number
  valorPisCents: number
  valorCoffinsCents: number
  valorTotalCents: number
  items: NfeItem[]
}

export interface NfeItem {
  descricao: string
  ncm: string
  cfop: string
  cean: string
  quantidade: number
  unidade: string
  valorUnitarioCents: number
  valorTotalCents: number
  cstIcms?: string
  aliquotaIcms?: number
}

// ── Helper para extrair texto de uma tag XML ──────────────────────────────────

function getText(el: Element | null, tag: string): string {
  if (!el) return ''
  const found = el.getElementsByTagName(tag)[0]
  return found?.textContent?.trim() ?? ''
}

function getCents(el: Element | null, tag: string): number {
  const raw = getText(el, tag)
  if (!raw) return 0
  return Math.round(parseFloat(raw) * 100)
}

// ── Parser principal ──────────────────────────────────────────────────────────

export function parseNfeXml(xmlString: string): NfeParseResult {
  // Node.js não tem DOMParser nativo — usamos regex/string search para tags simples
  // (evita dependência de xmldom em server action)
  const doc = parseXmlString(xmlString)
  const root = doc

  // infNFe pode estar dentro de <NFe> ou <nfeProc>
  const infNFe = findElement(root, 'infNFe')
  if (!infNFe) throw new Error('XML inválido: elemento <infNFe> não encontrado')

  const ide  = findElement(infNFe, 'ide')
  const emit = findElement(infNFe, 'emit')
  const dest = findElement(infNFe, 'dest')
  const total = findElement(infNFe, 'total')
  const ICMSTot = total ? findElement(total, 'ICMSTot') : null

  // Chave de acesso: atributo Id do infNFe (sem prefixo 'NFe')
  const idAttr = getAttr(infNFe, 'Id') ?? ''
  const chaveAcesso = idAttr.replace(/^NFe/, '')

  // Data de emissão: dhEmi ou dEmi
  const dhEmi = getTagText(infNFe, 'dhEmi') || getTagText(infNFe, 'dEmi')
  const dataEmissao = dhEmi ? dhEmi.split('T')[0] : ''

  // Items
  const detEls = findAllElements(infNFe, 'det')
  const items: NfeItem[] = detEls.map(det => {
    const prod   = findElement(det, 'prod')
    const imposto = findElement(det, 'imposto')
    const icmsEl = imposto ? findFirstChildOf(findElement(imposto, 'ICMS')) : null
    return {
      descricao:          getTagText(prod, 'xProd'),
      ncm:                getTagText(prod, 'NCM'),
      cfop:               getTagText(prod, 'CFOP'),
      cean:               getTagText(prod, 'cEAN'),
      quantidade:         parseFloat(getTagText(prod, 'qCom') || '0'),
      unidade:            getTagText(prod, 'uCom'),
      valorUnitarioCents: Math.round(parseFloat(getTagText(prod, 'vUnCom') || '0') * 100),
      valorTotalCents:    Math.round(parseFloat(getTagText(prod, 'vProd') || '0') * 100),
      cstIcms:            icmsEl ? (getTagText(icmsEl, 'orig') + getTagText(icmsEl, 'CST')) : undefined,
      aliquotaIcms:       icmsEl ? parseFloat(getTagText(icmsEl, 'pICMS') || '0') : undefined,
    }
  })

  return {
    chaveAcesso,
    numero:               getTagText(ide, 'nNF'),
    serie:                getTagText(ide, 'serie'),
    modelo:               getTagText(ide, 'mod'),
    dataEmissao,
    emitenteCnpj:         getTagText(emit, 'CNPJ') || getTagText(emit, 'CPF'),
    emitenteNome:         getTagText(emit, 'xNome'),
    emitenteUf:           getTagText(findElement(emit, 'enderEmit'), 'UF'),
    destinatarioCnpj:     getTagText(dest, 'CNPJ') || getTagText(dest, 'CPF'),
    destinatarioNome:     getTagText(dest, 'xNome'),
    valorProdutosCents:   Math.round(parseFloat(getTagText(ICMSTot, 'vProd') || '0') * 100),
    valorFreteCents:      Math.round(parseFloat(getTagText(ICMSTot, 'vFrete') || '0') * 100),
    valorDescontoCents:   Math.round(parseFloat(getTagText(ICMSTot, 'vDesc') || '0') * 100),
    valorIpiCents:        Math.round(parseFloat(getTagText(ICMSTot, 'vIPI') || '0') * 100),
    valorIcmsCents:       Math.round(parseFloat(getTagText(ICMSTot, 'vICMS') || '0') * 100),
    valorPisCents:        Math.round(parseFloat(getTagText(ICMSTot, 'vPIS') || '0') * 100),
    valorCoffinsCents:    Math.round(parseFloat(getTagText(ICMSTot, 'vCOFINS') || '0') * 100),
    valorTotalCents:      Math.round(parseFloat(getTagText(ICMSTot, 'vNF') || '0') * 100),
    items,
  }
}

// ── Mini XML parser sem dependências ─────────────────────────────────────────
// Implementação leve baseada em regex para uso server-side sem xmldom.

interface SimpleElement {
  tag: string
  attrs: Record<string, string>
  text: string
  children: SimpleElement[]
}

function parseXmlString(xml: string): SimpleElement {
  // Remove declaration e namespaces para simplificar
  const clean = xml
    .replace(/<\?xml[^?]*\?>/g, '')
    .replace(/\s+xmlns(?::[a-z]+)?="[^"]*"/g, '')
    .replace(/<([a-z]+):/gi, '<')   // remove namespace prefixes
    .replace(/<\/([a-z]+):/gi, '</')
  return parseElement(clean.trim()) ?? { tag: 'root', attrs: {}, text: '', children: [] }
}

function parseElement(xml: string): SimpleElement | null {
  const tagMatch = xml.match(/^<([^\s/>]+)([^>]*)>/)
  if (!tagMatch) return null
  const tag = tagMatch[1]
  const attrsStr = tagMatch[2]
  const attrs = parseAttrs(attrsStr)
  const inner = xml.slice(tagMatch[0].length, xml.lastIndexOf(`</${tag}>`))
  const children = parseChildren(inner)
  const text = children.length === 0 ? inner.trim() : ''
  return { tag, attrs, text, children }
}

function parseAttrs(s: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /([a-zA-Z_:][a-zA-Z0-9_:.-]*)="([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) attrs[m[1]] = m[2]
  return attrs
}

function parseChildren(inner: string): SimpleElement[] {
  const children: SimpleElement[] = []
  const tagRe = /<([^\s/>!?][^>]*)>/g
  let m: RegExpExecArray | null
  let i = 0
  while ((m = tagRe.exec(inner)) !== null) {
    const rawTag = m[1]
    if (rawTag.startsWith('/') || rawTag.endsWith('/')) continue
    const tag = rawTag.split(/\s/)[0]
    const start = m.index
    const closeTag = `</${tag}>`
    const end = inner.indexOf(closeTag, start)
    if (end === -1) continue
    const chunk = inner.slice(start, end + closeTag.length)
    const child = parseElement(chunk)
    if (child) children.push(child)
    i = end + closeTag.length
    tagRe.lastIndex = i
  }
  return children
}

function findElement(el: SimpleElement | null, tag: string): SimpleElement | null {
  if (!el) return null
  if (el.tag === tag) return el
  for (const c of el.children) {
    const found = findElement(c, tag)
    if (found) return found
  }
  return null
}

function findAllElements(el: SimpleElement | null, tag: string): SimpleElement[] {
  if (!el) return []
  const results: SimpleElement[] = []
  if (el.tag === tag) results.push(el)
  for (const c of el.children) results.push(...findAllElements(c, tag))
  return results
}

function findFirstChildOf(el: SimpleElement | null): SimpleElement | null {
  return el?.children[0] ?? null
}

function getTagText(el: SimpleElement | null, tag: string): string {
  return findElement(el, tag)?.text ?? ''
}

function getAttr(el: SimpleElement | null, attr: string): string | undefined {
  return el?.attrs[attr]
}
