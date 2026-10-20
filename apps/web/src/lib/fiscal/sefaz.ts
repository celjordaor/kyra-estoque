// apps/web/src/lib/fiscal/sefaz.ts
//
// Cliente SOAP para os webservices NFeAutorizacao4 da SEFAZ.
// Autenticação via TLS mútuo (mTLS): o certificado A1 do emitente é
// apresentado como certificado cliente — não depende de intermediário.
//
// Suporta múltiplas UFs: cada empresa configura sua UF em fiscal_config.uf
// e as URLs são resolvidas dinamicamente por estado + ambiente.

import https from 'https'

// ── URLs por UF e ambiente ────────────────────────────────────────────────────
// Ponto de entrada autorização síncrona (NFC-e e NF-e com indSinc=1)
// Fontes: Portal NFe https://www.nfe.fazenda.gov.br/portal/webServiceNFe.aspx

const URLS_POR_UF: Record<string, { producao: { autorizacao: string; retAutorizacao: string }; homologacao: { autorizacao: string; retAutorizacao: string } }> = {
  AC: { producao: { autorizacao: 'https://nfe.sefaznet.ac.gov.br/nfe/services/NFeAutorizacao4', retAutorizacao: 'https://nfe.sefaznet.ac.gov.br/nfe/services/NFeRetAutorizacao4' }, homologacao: { autorizacao: 'https://hnfe.sefaznet.ac.gov.br/nfe/services/NFeAutorizacao4', retAutorizacao: 'https://hnfe.sefaznet.ac.gov.br/nfe/services/NFeRetAutorizacao4' } },
  AL: { producao: { autorizacao: 'https://nfe.sefaz.al.gov.br/nfe/services/NFeAutorizacao4', retAutorizacao: 'https://nfe.sefaz.al.gov.br/nfe/services/NFeRetAutorizacao4' }, homologacao: { autorizacao: 'https://nfe.sefaz.al.gov.br/nfe/services/NFeAutorizacao4', retAutorizacao: 'https://nfe.sefaz.al.gov.br/nfe/services/NFeRetAutorizacao4' } },
  AM: { producao: { autorizacao: 'https://nfe.sefaz.am.gov.br/services/NFeAutorizacao4', retAutorizacao: 'https://nfe.sefaz.am.gov.br/services/NFeRetAutorizacao4' }, homologacao: { autorizacao: 'https://hnfe.sefaz.am.gov.br/services/NFeAutorizacao4', retAutorizacao: 'https://hnfe.sefaz.am.gov.br/services/NFeRetAutorizacao4' } },
  BA: { producao: { autorizacao: 'https://nfe.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx', retAutorizacao: 'https://nfe.sefaz.ba.gov.br/webservices/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx' }, homologacao: { autorizacao: 'https://hnfe.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx', retAutorizacao: 'https://hnfe.sefaz.ba.gov.br/webservices/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx' } },
  CE: { producao: { autorizacao: 'https://nfe.sefaz.ce.gov.br/nfe/services/NFeAutorizacao4', retAutorizacao: 'https://nfe.sefaz.ce.gov.br/nfe/services/NFeRetAutorizacao4' }, homologacao: { autorizacao: 'https://nfeh.sefaz.ce.gov.br/nfe/services/NFeAutorizacao4', retAutorizacao: 'https://nfeh.sefaz.ce.gov.br/nfe/services/NFeRetAutorizacao4' } },
  DF: { producao: { autorizacao: 'https://nfe.fazenda.df.gov.br/nfe/services/NFeAutorizacao4', retAutorizacao: 'https://nfe.fazenda.df.gov.br/nfe/services/NFeRetAutorizacao4' }, homologacao: { autorizacao: 'https://nfe-homologacao.fazenda.df.gov.br/nfe/services/NFeAutorizacao4', retAutorizacao: 'https://nfe-homologacao.fazenda.df.gov.br/nfe/services/NFeRetAutorizacao4' } },
  ES: { producao: { autorizacao: 'https://nfe.sefaz.es.gov.br/nfe/services/NFeAutorizacao4', retAutorizacao: 'https://nfe.sefaz.es.gov.br/nfe/services/NFeRetAutorizacao4' }, homologacao: { autorizacao: 'https://nfeh.sefaz.es.gov.br/nfe/services/NFeAutorizacao4', retAutorizacao: 'https://nfeh.sefaz.es.gov.br/nfe/services/NFeRetAutorizacao4' } },
  GO: { producao: { autorizacao: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeAutorizacao4', retAutorizacao: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeRetAutorizacao4' }, homologacao: { autorizacao: 'https://hnfe.sefaz.go.gov.br/nfe/services/NFeAutorizacao4', retAutorizacao: 'https://hnfe.sefaz.go.gov.br/nfe/services/NFeRetAutorizacao4' } },
  MA: { producao: { autorizacao: 'https://www.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx', retAutorizacao: 'https://www.sefazvirtual.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx' }, homologacao: { autorizacao: 'https://hom.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx', retAutorizacao: 'https://hom.sefazvirtual.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx' } },
  MG: { producao: { autorizacao: 'https://nfe.fazenda.mg.gov.br/nfe/services/NFeAutorizacao4', retAutorizacao: 'https://nfe.fazenda.mg.gov.br/nfe/services/NFeRetAutorizacao4' }, homologacao: { autorizacao: 'https://hnfe.fazenda.mg.gov.br/nfe/services/NFeAutorizacao4', retAutorizacao: 'https://hnfe.fazenda.mg.gov.br/nfe/services/NFeRetAutorizacao4' } },
  MS: { producao: { autorizacao: 'https://nfe.sefaz.ms.gov.br/ws/NFeAutorizacao4', retAutorizacao: 'https://nfe.sefaz.ms.gov.br/ws/NFeRetAutorizacao4' }, homologacao: { autorizacao: 'https://hom.nfe.sefaz.ms.gov.br/ws/NFeAutorizacao4', retAutorizacao: 'https://hom.nfe.sefaz.ms.gov.br/ws/NFeRetAutorizacao4' } },
  MT: { producao: { autorizacao: 'https://nfe.sefaz.mt.gov.br/nfe/services/NFeAutorizacao4', retAutorizacao: 'https://nfe.sefaz.mt.gov.br/nfe/services/NFeRetAutorizacao4' }, homologacao: { autorizacao: 'https://homologacao.sefaz.mt.gov.br/nfe/services/NFeAutorizacao4', retAutorizacao: 'https://homologacao.sefaz.mt.gov.br/nfe/services/NFeRetAutorizacao4' } },
  PA: { producao: { autorizacao: 'https://www.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx', retAutorizacao: 'https://www.sefazvirtual.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx' }, homologacao: { autorizacao: 'https://hom.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx', retAutorizacao: 'https://hom.sefazvirtual.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx' } },
  PB: { producao: { autorizacao: 'https://www.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx', retAutorizacao: 'https://www.sefazvirtual.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx' }, homologacao: { autorizacao: 'https://hom.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx', retAutorizacao: 'https://hom.sefazvirtual.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx' } },
  PE: { producao: { autorizacao: 'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeAutorizacao4', retAutorizacao: 'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeRetAutorizacao4' }, homologacao: { autorizacao: 'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeAutorizacao4', retAutorizacao: 'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeRetAutorizacao4' } },
  PI: { producao: { autorizacao: 'https://www.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx', retAutorizacao: 'https://www.sefazvirtual.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx' }, homologacao: { autorizacao: 'https://hom.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx', retAutorizacao: 'https://hom.sefazvirtual.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx' } },
  PR: { producao: { autorizacao: 'https://nfe.fazenda.pr.gov.br/nfe/services/NFeAutorizacao4', retAutorizacao: 'https://nfe.fazenda.pr.gov.br/nfe/services/NFeRetAutorizacao4' }, homologacao: { autorizacao: 'https://homologacao.nfe.fazenda.pr.gov.br/nfe/services/NFeAutorizacao4', retAutorizacao: 'https://homologacao.nfe.fazenda.pr.gov.br/nfe/services/NFeRetAutorizacao4' } },
  RJ: { producao: { autorizacao: 'https://nfe.fazenda.rj.gov.br/nfe/services/NFeAutorizacao4', retAutorizacao: 'https://nfe.fazenda.rj.gov.br/nfe/services/NFeRetAutorizacao4' }, homologacao: { autorizacao: 'https://nfeh.fazenda.rj.gov.br/nfe/services/NFeAutorizacao4', retAutorizacao: 'https://nfeh.fazenda.rj.gov.br/nfe/services/NFeRetAutorizacao4' } },
  RN: { producao: { autorizacao: 'https://www.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx', retAutorizacao: 'https://www.sefazvirtual.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx' }, homologacao: { autorizacao: 'https://hom.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx', retAutorizacao: 'https://hom.sefazvirtual.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx' } },
  RO: { producao: { autorizacao: 'https://nfe.sefin.ro.gov.br/nfe/services/NFeAutorizacao4', retAutorizacao: 'https://nfe.sefin.ro.gov.br/nfe/services/NFeRetAutorizacao4' }, homologacao: { autorizacao: 'https://hnfe.sefin.ro.gov.br/nfe/services/NFeAutorizacao4', retAutorizacao: 'https://hnfe.sefin.ro.gov.br/nfe/services/NFeRetAutorizacao4' } },
  RR: { producao: { autorizacao: 'https://www.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx', retAutorizacao: 'https://www.sefazvirtual.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx' }, homologacao: { autorizacao: 'https://hom.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx', retAutorizacao: 'https://hom.sefazvirtual.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx' } },
  RS: { producao: { autorizacao: 'https://nfe.sefaz.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx', retAutorizacao: 'https://nfe.sefaz.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx' }, homologacao: { autorizacao: 'https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx', retAutorizacao: 'https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx' } },
  SC: { producao: { autorizacao: 'https://nfe.sef.sc.gov.br/nfe/services/NFeAutorizacao4', retAutorizacao: 'https://nfe.sef.sc.gov.br/nfe/services/NFeRetAutorizacao4' }, homologacao: { autorizacao: 'https://homologacao.nfe.sef.sc.gov.br/nfe/services/NFeAutorizacao4', retAutorizacao: 'https://homologacao.nfe.sef.sc.gov.br/nfe/services/NFeRetAutorizacao4' } },
  SE: { producao: { autorizacao: 'https://www.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx', retAutorizacao: 'https://www.sefazvirtual.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx' }, homologacao: { autorizacao: 'https://hom.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx', retAutorizacao: 'https://hom.sefazvirtual.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx' } },
  SP: { producao: { autorizacao: 'https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx', retAutorizacao: 'https://nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx' }, homologacao: { autorizacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx', retAutorizacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx' } },
  TO: { producao: { autorizacao: 'https://www.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx', retAutorizacao: 'https://www.sefazvirtual.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx' }, homologacao: { autorizacao: 'https://hom.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx', retAutorizacao: 'https://hom.sefazvirtual.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx' } },
}

// UF → cUF (código IBGE do estado)
export const UF_PARA_CUF: Record<string, string> = {
  AC:'12',AL:'27',AM:'13',AP:'16',BA:'29',CE:'23',DF:'53',ES:'32',GO:'52',
  MA:'21',MG:'31',MS:'50',MT:'51',PA:'15',PB:'25',PE:'26',PI:'22',PR:'41',
  RJ:'33',RN:'24',RO:'11',RR:'14',RS:'43',SC:'42',SE:'28',SP:'35',TO:'17',
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface EnvioResultado {
  autorizada: boolean
  cStat: string
  xMotivo: string
  protocolo?: string
  dhRecbto?: string
  nfeProc?: string
  emProcessamento?: boolean
}

// ── Helpers internos ──────────────────────────────────────────────────────────

function extrairTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`))
  return m ? m[1] : null
}

function montarEnvelope(nfeDadosMsgConteudo: string, wsdlNamespace: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="${wsdlNamespace}">${nfeDadosMsgConteudo}</nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`
}

function urlsParaUf(uf: string, ambiente: 1 | 2) {
  const entry = URLS_POR_UF[uf.toUpperCase()]
  if (!entry) throw new Error(`UF não suportada para emissão direta: ${uf}`)
  return ambiente === 1 ? entry.producao : entry.homologacao
}

function postSoap(url: string, envelope: string, certPem: string, keyPem: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { hostname, pathname, port } = new URL(url)
    const req = https.request(
      {
        hostname,
        port: port || 443,
        path: pathname,
        method: 'POST',
        cert: certPem,
        key: keyPem,
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(envelope),
        },
        timeout: 30000,
      },
      (res) => {
        let body = ''
        res.on('data', (chunk) => (body += chunk))
        res.on('end', () => resolve(body))
      }
    )
    req.on('timeout', () => req.destroy(new Error('Tempo esgotado ao conectar à SEFAZ.')))
    req.on('error', reject)
    req.write(envelope)
    req.end()
  })
}

async function consultarRecibo(
  recibo: string,
  uf: string,
  ambiente: 1 | 2,
  certPem: string,
  keyPem: string
): Promise<EnvioResultado> {
  const urls = urlsParaUf(uf, ambiente)
  const consReciNFe = `<consReciNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${ambiente}</tpAmb><nRec>${recibo}</nRec></consReciNFe>`
  const envelope = montarEnvelope(consReciNFe, 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4')
  const respostaXml = await postSoap(urls.retAutorizacao, envelope, certPem, keyPem)
  return interpretarResposta(respostaXml)
}

export function interpretarResposta(respostaXml: string): EnvioResultado {
  const cStatLote = extrairTag(respostaXml, 'cStat') ?? ''
  const xMotivoLote = extrairTag(respostaXml, 'xMotivo') ?? 'Resposta da SEFAZ não reconhecida.'

  if (cStatLote === '105') {
    return { autorizada: false, cStat: cStatLote, xMotivo: xMotivoLote, emProcessamento: true }
  }

  const protNFeMatch = respostaXml.match(/<protNFe[^>]*>([\s\S]*?)<\/protNFe>/)
  if (!protNFeMatch) {
    return { autorizada: false, cStat: cStatLote, xMotivo: xMotivoLote }
  }

  const infProt = protNFeMatch[1]
  const cStat = extrairTag(infProt, 'cStat') ?? ''
  const xMotivo = extrairTag(infProt, 'xMotivo') ?? ''
  const nProt = extrairTag(infProt, 'nProt') ?? undefined
  const dhRecbto = extrairTag(infProt, 'dhRecbto') ?? undefined

  return {
    autorizada: cStat === '100',
    cStat,
    xMotivo,
    protocolo: nProt,
    dhRecbto,
  }
}

export async function enviarNFeParaSefaz(params: {
  nfeXmlAssinado: string
  uf: string
  ambiente: 1 | 2
  certPem: string
  keyPem: string
  idLote?: string
}): Promise<EnvioResultado> {
  const { nfeXmlAssinado, uf, ambiente, certPem, keyPem, idLote = String(Date.now()).slice(-15) } = params
  const urls = urlsParaUf(uf, ambiente)

  const nfeSemDeclaracao = nfeXmlAssinado.replace(/^<\?xml[^>]*\?>\s*/i, '')
  const enviNFe = `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>${idLote}</idLote><indSinc>1</indSinc>${nfeSemDeclaracao}</enviNFe>`
  const envelope = montarEnvelope(enviNFe, 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4')

  const respostaXml = await postSoap(urls.autorizacao, envelope, certPem, keyPem)
  let resultado = interpretarResposta(respostaXml)

  if (resultado.emProcessamento) {
    const recibo = extrairTag(respostaXml, 'nRec')
    if (recibo) {
      for (let tentativa = 0; tentativa < 3 && resultado.emProcessamento; tentativa++) {
        await new Promise((r) => setTimeout(r, 4000))
        resultado = await consultarRecibo(recibo, uf, ambiente, certPem, keyPem)
      }
    }
  }

  if (resultado.autorizada && resultado.protocolo) {
    const protNFeMatch = respostaXml.match(/<protNFe[\s\S]*?<\/protNFe>/)
    resultado.nfeProc = `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">${nfeSemDeclaracao}${protNFeMatch?.[0] ?? ''}</nfeProc>`
  }

  return resultado
}
