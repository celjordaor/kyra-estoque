import React from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidade | Kyra Estoque',
  description: 'Saiba como o Kyra Estoque coleta, usa e protege seus dados pessoais conforme a LGPD.',
}

const LAST_UPDATED = '08 de setembro de 2025'
const DPO_EMAIL = 'privacidade@kyraestoque.com.br'
const COMPANY_NAME = 'Kyra Tecnologia Ltda.'
const COMPANY_CNPJ = '[CNPJ da empresa]'
const COMPANY_ADDRESS = '[Endereço completo da empresa]'

function Section({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-10">
      <h2 className="text-xl font-bold text-foreground mb-4 pb-2 border-b border-border">{title}</h2>
      <div className="space-y-3 text-muted-foreground leading-relaxed text-[15px]">{children}</div>
    </section>
  )
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="font-semibold text-foreground mb-1.5">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
      <span>{children}</span>
    </li>
  )
}

function Table({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border mt-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            <th className="px-4 py-3 text-left font-semibold text-foreground">Dado / Categoria</th>
            <th className="px-4 py-3 text-left font-semibold text-foreground">Finalidade</th>
            <th className="px-4 py-3 text-left font-semibold text-foreground">Base Legal (LGPD)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([dado, finalidade, base], i) => (
            <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/50/50">
              <td className="px-4 py-3 text-foreground font-medium">{dado}</td>
              <td className="px-4 py-3 text-muted-foreground">{finalidade}</td>
              <td className="px-4 py-3 text-muted-foreground text-xs">{base}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function PrivacyPage() {
  return (
    <>
      {/* Header do documento */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          LGPD — Lei 13.709/2018
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">Política de Privacidade</h1>
        <p className="text-muted-foreground text-sm">Última atualização: {LAST_UPDATED}</p>
        <div className="mt-4 p-4 rounded-xl bg-muted/50 border border-border text-sm text-muted-foreground">
          Esta Política descreve como o <strong>Kyra Estoque</strong> coleta, usa, armazena e compartilha seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018) e demais normas aplicáveis.
        </div>
      </div>

      {/* Índice */}
      <nav className="mb-10 p-5 rounded-xl border border-border bg-muted/50">
        <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-3">Índice</p>
        <ol className="space-y-1 text-sm text-primary">
          {[
            ['#controlador', '1. Controlador e Encarregado (DPO)'],
            ['#dados', '2. Dados Coletados e Finalidades'],
            ['#cookies', '3. Cookies e Tecnologias de Rastreamento'],
            ['#compartilhamento', '4. Compartilhamento de Dados'],
            ['#retencao', '5. Retenção e Eliminação'],
            ['#seguranca', '6. Segurança dos Dados'],
            ['#direitos', '7. Direitos do Titular (Art. 18 LGPD)'],
            ['#menores', '8. Menores de Idade'],
            ['#alteracoes', '9. Alterações nesta Política'],
            ['#contato', '10. Contato'],
          ].map(([href, label]) => (
            <li key={href}><a href={href} className="hover:underline">{label}</a></li>
          ))}
        </ol>
      </nav>

      <Section id="controlador" title="1. Controlador e Encarregado (DPO)">
        <p>
          O <strong>controlador</strong> dos seus dados pessoais é a <strong>{COMPANY_NAME}</strong>,
          inscrita no CNPJ sob o nº {COMPANY_CNPJ}, com sede em {COMPANY_ADDRESS}.
        </p>
        <p>
          O <strong>Encarregado pelo Tratamento de Dados Pessoais (DPO)</strong> é o responsável por atender
          solicitações dos titulares e comunicar-se com a Autoridade Nacional de Proteção de Dados (ANPD).
        </p>
        <div className="p-4 rounded-xl border border-primary/20 bg-primary/10 text-sm">
          <p className="font-semibold text-primary mb-1">Contato do Encarregado (DPO)</p>
          <p className="text-primary">E-mail: <a href={`mailto:${DPO_EMAIL}`} className="underline">{DPO_EMAIL}</a></p>
          <p className="text-primary text-xs mt-1">Respondemos em até 15 dias úteis, conforme prazo legal.</p>
        </div>
      </Section>

      <Section id="dados" title="2. Dados Coletados e Finalidades">
        <p>Coletamos dados pessoais nas seguintes situações, sempre respeitando a finalidade declarada e a base legal correspondente na LGPD:</p>

        <Sub title="2.1 Dados fornecidos pelo usuário">
          <Table rows={[
            ['Nome e sobrenome', 'Identificação e personalização da conta', 'Execução de contrato (Art. 7º, V)'],
            ['E-mail', 'Acesso à plataforma, comunicações e suporte', 'Execução de contrato (Art. 7º, V)'],
            ['Telefone', 'Suporte e contato comercial', 'Legítimo interesse (Art. 7º, IX)'],
            ['Nome da empresa / CNPJ', 'Faturamento e personalização do ambiente', 'Execução de contrato (Art. 7º, V)'],
            ['Dados de pagamento (token)', 'Cobrança de assinaturas (processados por gateway)', 'Execução de contrato (Art. 7º, V)'],
            ['Dados de produtos e estoque', 'Operação do serviço contratado', 'Execução de contrato (Art. 7º, V)'],
            ['Informações de clientes e fornecedores', 'Operação do serviço contratado', 'Execução de contrato (Art. 7º, V)'],
          ]} />
        </Sub>

        <Sub title="2.2 Dados coletados automaticamente">
          <Table rows={[
            ['Endereço IP e localização aproximada', 'Segurança, prevenção a fraudes e diagnóstico', 'Legítimo interesse (Art. 7º, IX)'],
            ['Logs de acesso (data, hora, ação)', 'Auditoria e segurança — exigido pelo Marco Civil (Lei 12.965/14)', 'Obrigação legal (Art. 7º, II)'],
            ['Dados de uso e navegação', 'Melhoria do produto e análise de desempenho', 'Consentimento (Art. 7º, I) via cookies'],
            ['Dispositivo e sistema operacional', 'Compatibilidade e diagnóstico técnico', 'Legítimo interesse (Art. 7º, IX)'],
          ]} />
        </Sub>

        <Sub title="2.3 Dados coletados em formulários de contato / demonstração">
          <p>Ao solicitar uma demonstração, coletamos: nome, empresa, telefone, e-mail e suas necessidades declaradas, para fins de contato comercial, com base no <strong>consentimento expresso</strong> (Art. 7º, I da LGPD).</p>
        </Sub>
      </Section>

      <Section id="cookies" title="3. Cookies e Tecnologias de Rastreamento">
        <p>Utilizamos cookies e tecnologias similares em nosso site e plataforma. Você pode gerenciar suas preferências a qualquer momento pelo banner de cookies ou nas configurações do seu navegador.</p>

        <Sub title="Tipos de cookies utilizados">
          <Table rows={[
            ['Essenciais / Técnicos', 'Funcionamento básico da plataforma (autenticação, sessão, segurança)', 'Não requerem consentimento'],
            ['Preferências', 'Memorizar configurações do usuário (idioma, layout)', 'Consentimento'],
            ['Analytics / Desempenho', 'Análise de uso e melhoria da plataforma (ex: Vercel Analytics)', 'Consentimento'],
            ['Marketing', 'Anúncios relevantes em redes de parceiros', 'Consentimento'],
          ]} />
        </Sub>

        <p className="text-sm text-muted-foreground">
          Os cookies essenciais não podem ser desativados, pois são necessários para o funcionamento do sistema.
          Os demais são opcionais e requerem seu consentimento expresso, que pode ser retirado a qualquer momento.
        </p>
      </Section>

      <Section id="compartilhamento" title="4. Compartilhamento de Dados">
        <p>Não vendemos, alugamos ou comercializamos dados pessoais. Compartilhamos dados apenas nas situações abaixo:</p>
        <ul className="space-y-2 mt-2">
          <Li><strong>Prestadores de serviço (operadores):</strong> empresas que processam dados em nosso nome — hospedagem (Supabase / Vercel), gateway de pagamento, e-mail transacional (Resend). Esses parceiros estão sujeitos a contratos de processamento de dados e obrigações de confidencialidade.</Li>
          <Li><strong>Obrigação legal:</strong> quando exigido por lei, regulação, ordem judicial ou autoridade competente (ex: ANPD, Receita Federal).</Li>
          <Li><strong>Proteção de direitos:</strong> quando necessário para proteger direitos, propriedade ou segurança da empresa, usuários ou terceiros.</Li>
          <Li><strong>Com seu consentimento explícito:</strong> em situações não previstas aqui, mediante aprovação do titular.</Li>
        </ul>

        <Sub title="Transferência internacional de dados">
          <p>
            Alguns de nossos fornecedores (ex: Vercel, Supabase) estão sediados nos EUA. Garantimos que essas transferências ocorrem com salvaguardas adequadas — cláusulas contratuais padrão e certificações de proteção de dados compatíveis com a LGPD (Art. 33).
          </p>
        </Sub>
      </Section>

      <Section id="retencao" title="5. Retenção e Eliminação de Dados">
        <Table rows={[
          ['Dados de conta ativa', 'Pelo período da assinatura ativa', '—'],
          ['Dados após cancelamento', 'Até 90 dias (possibilidade de reativação) e depois eliminados', 'Art. 16, I'],
          ['Logs de acesso', '6 meses', 'Marco Civil da Internet, Art. 15'],
          ['Dados fiscais e financeiros', 'Até 5 anos', 'Código Tributário Nacional, Art. 173'],
          ['Dados de formulários de contato', 'Até 2 anos ou até revogação do consentimento', 'Art. 7º, I'],
          ['Backups', 'Eliminados no mesmo prazo, com ciclo de retenção de 30 dias', '—'],
        ]} />
        <p className="text-sm text-muted-foreground mt-3">
          Após o prazo de retenção, os dados são eliminados de forma segura ou anonimizados de modo que não possam
          ser revertidos para identificar o titular.
        </p>
      </Section>

      <Section id="seguranca" title="6. Segurança dos Dados">
        <p>Adotamos medidas técnicas e organizacionais adequadas para proteger seus dados contra acesso não autorizado, perda, destruição ou divulgação indevida:</p>
        <ul className="space-y-2 mt-2">
          <Li>Criptografia em trânsito (TLS/HTTPS) e em repouso</Li>
          <Li>Autenticação multifator (MFA) disponível para administradores</Li>
          <Li>Controle de acesso baseado em perfis (RBAC) com isolamento por empresa (multi-tenancy)</Li>
          <Li>Logs de auditoria imutáveis de todas as operações críticas</Li>
          <Li>Monitoramento de incidentes e plano de resposta a violações de dados</Li>
          <Li>Armazenamento em data centers certificados (ISO 27001)</Li>
        </ul>
        <p className="text-sm">
          Em caso de incidente de segurança com potencial risco aos titulares, comunicaremos a ANPD e os afetados no prazo de <strong>72 horas</strong> após a ciência, conforme Art. 48 da LGPD.
        </p>
      </Section>

      <Section id="direitos" title="7. Direitos do Titular (Art. 18 LGPD)">
        <p>Como titular de dados pessoais, você tem os seguintes direitos, que podem ser exercidos a qualquer momento gratuitamente:</p>
        <ul className="space-y-2 mt-2">
          <Li><strong>Confirmação e acesso:</strong> saber se tratamos seus dados e obter cópia deles</Li>
          <Li><strong>Correção:</strong> corrigir dados incompletos, inexatos ou desatualizados</Li>
          <Li><strong>Anonimização, bloqueio ou eliminação:</strong> de dados desnecessários, excessivos ou tratados em desconformidade</Li>
          <Li><strong>Portabilidade:</strong> receber seus dados em formato estruturado para migração a outro serviço</Li>
          <Li><strong>Eliminação:</strong> solicitar a exclusão de dados tratados com base no consentimento</Li>
          <Li><strong>Informação sobre compartilhamento:</strong> saber com quais entidades compartilhamos seus dados</Li>
          <Li><strong>Revogação do consentimento:</strong> retirar o consentimento quando o tratamento for baseado nele</Li>
          <Li><strong>Oposição:</strong> se opor a tratamentos realizados com base em legítimo interesse</Li>
          <Li><strong>Reclamação à ANPD:</strong> registrar reclamação junto à Autoridade Nacional de Proteção de Dados</Li>
        </ul>
        <div className="p-4 rounded-xl border border-border bg-muted/50 text-sm mt-3">
          <p className="font-semibold text-foreground mb-1">Como exercer seus direitos</p>
          <p>Envie um e-mail para <a href={`mailto:${DPO_EMAIL}`} className="text-primary underline">{DPO_EMAIL}</a> com seu nome completo, e-mail cadastrado e a solicitação desejada. Responderemos em até <strong>15 dias úteis</strong>.</p>
          <p className="text-muted-foreground mt-1">Podemos solicitar confirmação de identidade antes de processar a solicitação.</p>
        </div>
      </Section>

      <Section id="menores" title="8. Menores de Idade">
        <p>
          O Kyra Estoque é um serviço voltado exclusivamente a <strong>pessoas jurídicas e maiores de 18 anos</strong>.
          Não coletamos intencionalmente dados pessoais de menores. Se identificarmos que dados de menores foram
          fornecidos sem o devido consentimento parental, os eliminaremos imediatamente.
        </p>
      </Section>

      <Section id="alteracoes" title="9. Alterações nesta Política">
        <p>
          Podemos atualizar esta Política periodicamente para refletir mudanças na lei, no serviço ou em nossas
          práticas. Alterações relevantes serão comunicadas por e-mail e/ou aviso no sistema com antecedência mínima
          de <strong>15 dias</strong> antes de entrar em vigor.
        </p>
        <p>
          A continuidade do uso da plataforma após a vigência da nova versão implica aceitação das alterações.
          Se você discordar, poderá solicitar o cancelamento da conta e a eliminação dos seus dados.
        </p>
      </Section>

      <Section id="contato" title="10. Contato">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-border bg-muted/50">
            <p className="font-semibold text-foreground mb-2">Encarregado (DPO)</p>
            <p className="text-sm text-muted-foreground">E-mail: <a href={`mailto:${DPO_EMAIL}`} className="text-primary underline">{DPO_EMAIL}</a></p>
            <p className="text-sm text-muted-foreground mt-1">Prazo de resposta: até 15 dias úteis</p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-muted/50">
            <p className="font-semibold text-foreground mb-2">Suporte geral</p>
            <p className="text-sm text-muted-foreground">E-mail: <a href="mailto:contato@kyraestoque.com.br" className="text-primary underline">contato@kyraestoque.com.br</a></p>
            <p className="text-sm text-muted-foreground mt-1">{COMPANY_NAME} — CNPJ {COMPANY_CNPJ}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-4">
          Você também pode registrar reclamação diretamente na{' '}
          <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-primary underline">
            Autoridade Nacional de Proteção de Dados (ANPD)
          </a>.
        </p>
      </Section>
    </>
  )
}
