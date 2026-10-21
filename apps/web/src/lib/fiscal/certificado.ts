// src/lib/fiscal/certificado.ts
//
// Extrai chave privada + certificado de um arquivo PFX (PKCS#12) — o
// certificado digital A1 usado para assinar NFC-e. O PFX é salvo em
// fiscal_config.certificado_pfx como string base64 (o front-end lê o
// arquivo com FileReader e manda o base64 puro, sem o prefixo
// "data:...;base64,").
//
// Usa node-forge porque é puro JavaScript (não depende de bibliotecas
// nativas/OpenSSL do sistema operacional) — importante porque isso roda
// dentro de uma Vercel Function.

import forge from 'node-forge'

export interface CertificadoInfo {
  privateKeyPem: string
  certPem: string
  /** Certificado em base64 "cru" (DER), sem cabeçalho PEM — é o que vai
   *  dentro de <X509Certificate> na assinatura XML. */
  certBase64: string
  /** CNPJ extraído do campo CN do certificado (só dígitos), quando aplicável. */
  cnpj: string | null
  nomeTitular: string | null
  validoAte: Date
  validoDe: Date
}

export class CertificadoError extends Error {}

/**
 * Decodifica um PFX (base64) + senha e devolve a chave privada e o
 * certificado prontos para assinatura. Lança CertificadoError com
 * mensagens amigáveis para os erros mais comuns.
 */
export function lerCertificadoPFX(pfxBase64: string, senha: string): CertificadoInfo {
  let p12Asn1: forge.asn1.Asn1
  try {
    const p12Der = forge.util.decode64(pfxBase64)
    p12Asn1 = forge.asn1.fromDer(p12Der)
  } catch {
    throw new CertificadoError('Arquivo de certificado inválido ou corrompido.')
  }

  let p12: forge.pkcs12.Pkcs12Pfx
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, senha)
  } catch (e: any) {
    // node-forge lança "Invalid password" ou erro de MAC quando a senha está errada
    const msg = String(e?.message ?? '')
    if (/invalid password|mac could not be verified/i.test(msg)) {
      throw new CertificadoError('Senha do certificado incorreta.')
    }
    throw new CertificadoError('Não foi possível ler o certificado. Verifique o arquivo e a senha.')
  }

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag as string]?.[0]
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
  const certBag = certBags[forge.pki.oids.certBag as string]?.[0]

  if (!keyBag?.key || !certBag?.cert) {
    throw new CertificadoError('O arquivo não contém uma chave privada e certificado válidos (PKCS#12).')
  }

  const privateKey = keyBag.key
  const cert = certBag.cert

  const agora = new Date()
  if (cert.validity.notAfter < agora) {
    throw new CertificadoError(
      `Certificado vencido em ${cert.validity.notAfter.toLocaleDateString('pt-BR')}. Providencie um novo certificado A1.`
    )
  }
  if (cert.validity.notBefore > agora) {
    throw new CertificadoError('Certificado ainda não é válido (data de início no futuro).')
  }

  const cnMatch = cert.subject.getField('CN')?.value ?? ''
  // CN de e-CNPJ costuma vir como "RAZAO SOCIAL:12345678000199"
  const cnpjMatch = cnMatch.match(/(\d{14})/)

  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()

  return {
    privateKeyPem: forge.pki.privateKeyToPem(privateKey),
    certPem: forge.pki.certificateToPem(cert),
    certBase64: forge.util.encode64(certDer),
    cnpj: cnpjMatch ? cnpjMatch[1] : null,
    nomeTitular: cnMatch || null,
    validoAte: cert.validity.notAfter,
    validoDe: cert.validity.notBefore,
  }
}
