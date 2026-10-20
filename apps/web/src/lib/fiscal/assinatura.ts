// src/lib/fiscal/assinatura.ts
//
// Assinatura digital do XML da NFC-e, seguindo o padrão exigido pela SEFAZ:
//   - Enveloped Signature + Canonical XML 1.0 (C14N "puro", NÃO exclusive-c14n)
//   - Digest SHA-1
//   - Assinatura RSA-SHA1
//   - <KeyInfo><X509Data><X509Certificate> com o certificado do emissor
//   - <Signature> inserido como último filho de <NFe>, irmão de <infNFe>
//
// Referência: Nota Técnica de padronização da NF-e (assinatura digital) —
// as NFe/NFC-e de todo o Brasil usam este mesmo esquema, independente do
// estado emissor.

import { SignedXml } from 'xml-crypto'

const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature'
const SHA1 = 'http://www.w3.org/2000/09/xmldsig#sha1'
const RSA_SHA1 = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'

export class AssinaturaError extends Error {}

/**
 * Assina o elemento <infNFe> (localizado via seu atributo Id) e devolve o
 * XML completo da NFe com o bloco <Signature> inserido.
 */
export function assinarNFe(xml: string, privateKeyPem: string, certPem: string): string {
  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certPem,
    signatureAlgorithm: RSA_SHA1,
    canonicalizationAlgorithm: C14N,
    getKeyInfoContent: SignedXml.getKeyInfoContent,
  })

  sig.addReference({
    xpath: "//*[local-name(.)='infNFe']",
    transforms: [ENVELOPED, C14N],
    digestAlgorithm: SHA1,
  })

  try {
    sig.computeSignature(xml, {
      // Anexa a <Signature> como último filho de <NFe> (irmão de <infNFe>),
      // exatamente onde a SEFAZ espera encontrá-la.
      location: { reference: "//*[local-name(.)='infNFe']", action: 'after' },
    })
  } catch (e: any) {
    throw new AssinaturaError(`Falha ao assinar XML da nota: ${e?.message ?? e}`)
  }

  return sig.getSignedXml()
}

/**
 * Verifica se a assinatura de um XML de NFe é válida para o certificado
 * informado — usado nos testes locais (com certificado de teste) para
 * confirmar que a assinatura foi gerada corretamente antes de haver um
 * certificado A1 real para testar contra a SEFAZ de verdade.
 */
export function verificarAssinaturaNFe(xmlAssinado: string, certPem: string): { valido: boolean; erros: string[] } {
  const sig = new SignedXml({ publicCert: certPem })

  const { DOMParser } = require('@xmldom/xmldom')
  const xpath = require('xpath')
  const doc = new DOMParser().parseFromString(xmlAssinado, 'text/xml')
  const signatureNode = xpath.select(
    "//*[local-name(.)='Signature' and namespace-uri(.)='http://www.w3.org/2000/09/xmldsig#']",
    doc
  )[0]

  if (!signatureNode) return { valido: false, erros: ['Nenhum elemento <Signature> encontrado no XML.'] }

  sig.loadSignature(signatureNode)
  try {
    const valido = sig.checkSignature(xmlAssinado)
    const erros = sig.getReferences()
      .map(ref => ref.validationError)
      .filter((e): e is Error => e != null)
      .map(e => e.message)
    return { valido: !!valido, erros }
  } catch (e: any) {
    return { valido: false, erros: [String(e?.message ?? e)] }
  }
}
