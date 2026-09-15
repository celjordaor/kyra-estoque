import React from 'react'
export const metadata = {
  title: 'Termos de Uso | Kyra Estoque',
  description: 'Termos e condições de uso da plataforma Kyra Estoque.',
}

const LAST_UPDATED = '08 de setembro de 2025'
const COMPANY_NAME = 'Kyra Tecnologia Ltda.'
const COMPANY_CNPJ = '[CNPJ da empresa]'
const COMPANY_ADDRESS = '[Endereço completo da empresa]'
const CONTACT_EMAIL = 'contato@kyraestoque.com.br'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold text-slate-900 mb-3 tracking-tight">{title}</h2>
      <div className="space-y-3 text-slate-600 text-sm leading-relaxed">{children}</div>
    </section>
  )
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-semibold text-slate-800 mb-1">{title}</h3>
      <div className="text-slate-600 text-sm leading-relaxed">{children}</div>
    </div>
  )
}

export default function TermsPage() {
  return (
    <>
      <header className="mb-10 pb-8 border-b border-slate-200">
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-600 mb-2">Legal</p>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-3">Termos de Uso</h1>
        <p className="text-slate-500 text-sm">
          Última atualização: <strong>{LAST_UPDATED}</strong>
        </p>
      </header>

      <div className="prose-sm max-w-none">
        <p className="text-slate-600 text-sm leading-relaxed mb-8">
          Ao acessar ou utilizar a plataforma <strong>Kyra Estoque</strong>, operada por{' '}
          <strong>{COMPANY_NAME}</strong> (CNPJ {COMPANY_CNPJ}), você concorda com estes Termos de
          Uso. Leia-os com atenção antes de utilizar os serviços. Caso não concorde, não utilize a
          plataforma.
        </p>

        <Section title="1. Definições">
          <p>Para os fins destes Termos:</p>
          <ul className="list-none space-y-1 mt-2">
            {[
              ['Plataforma', 'o sistema Kyra Estoque, incluindo o aplicativo web, APIs e serviços relacionados.'],
              ['Usuário', 'qualquer pessoa física que acessa a Plataforma em nome de uma Empresa.'],
              ['Empresa', 'pessoa jurídica que contrata o plano e concede acesso aos seus Usuários.'],
              ['Conta', 'conjunto de credenciais que identificam uma Empresa e seus Usuários na Plataforma.'],
              ['Dados', 'informações inseridas, processadas ou armazenadas na Plataforma pela Empresa ou Usuários.'],
              ['Conteúdo', 'textos, imagens, relatórios, layouts e qualquer material disponibilizado pela Kyra na Plataforma.'],
            ].map(([term, def]) => (
              <li key={term}><strong>{term}:</strong> {def}</li>
            ))}
          </ul>
        </Section>

        <Section title="2. Aceitação dos Termos">
          <p>
            O acesso e uso da Plataforma constituem aceitação integral destes Termos, da nossa{' '}
            <a href="/privacy" className="text-teal-600 hover:underline">Política de Privacidade</a> e
            de quaisquer políticas complementares publicadas. Os Termos aplicam-se a todos os Usuários,
            incluindo visitantes, empresas cadastradas e administradores.
          </p>
          <p>
            Caso a Empresa seja pessoa jurídica, o representante que aceitar estes Termos declara ter
            poderes para vincular a Empresa.
          </p>
        </Section>

        <Section title="3. Cadastro e Conta">
          <Sub title="3.1 Informações verdadeiras">
            <p>
              O Usuário é responsável por fornecer informações verídicas, precisas e atualizadas no
              cadastro. A Kyra poderá suspender ou encerrar Contas com informações falsas ou
              desatualizadas.
            </p>
          </Sub>
          <Sub title="3.2 Segurança das credenciais">
            <p>
              A Empresa é responsável por manter em sigilo as credenciais de acesso (login e senha) de
              todos os seus Usuários. A Kyra não será responsável por prejuízos decorrentes de acesso
              não autorizado causado por negligência da Empresa ou do Usuário.
            </p>
          </Sub>
          <Sub title="3.3 Uso individual e intransferível">
            <p>
              Cada conta de Usuário é pessoal e intransferível. É vedado compartilhar credenciais entre
              pessoas físicas distintas ou utilizá-las para acessar a Plataforma em nome de terceiros
              não autorizados.
            </p>
          </Sub>
          <Sub title="3.4 Notificação de incidente">
            <p>
              Em caso de suspeita de comprometimento de credenciais, o Usuário deve notificar
              imediatamente a Kyra pelo e-mail{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-teal-600 hover:underline">{CONTACT_EMAIL}</a>{' '}
              e alterar a senha sem demora.
            </p>
          </Sub>
        </Section>

        <Section title="4. Uso Permitido e Proibições">
          <Sub title="4.1 Uso permitido">
            <p>A Plataforma destina-se exclusivamente à gestão de estoque, compras, vendas e operações
            relacionadas da Empresa contratante, conforme o plano contratado.</p>
          </Sub>
          <Sub title="4.2 Condutas proibidas">
            <p>É expressamente vedado ao Usuário:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Utilizar a Plataforma para fins ilegais ou em violação à legislação brasileira;</li>
              <li>Tentar aceder, explorar ou testar vulnerabilidades do sistema sem autorização prévia por escrito;</li>
              <li>Realizar engenharia reversa, descompilar ou desmontar qualquer componente da Plataforma;</li>
              <li>Utilizar bots, scripts ou meios automatizados não autorizados para acessar a Plataforma;</li>
              <li>Transmitir vírus, malware ou qualquer código malicioso;</li>
              <li>Vender, sublicenciar, ceder ou transferir o acesso a terceiros não autorizados;</li>
              <li>Introduzir dados falsos ou fraudulentos que causem prejuízo a terceiros;</li>
              <li>Infringir direitos de propriedade intelectual da Kyra ou de terceiros.</li>
            </ul>
          </Sub>
        </Section>

        <Section title="5. Planos, Pagamentos e Cancelamento">
          <Sub title="5.1 Planos">
            <p>
              A Plataforma é oferecida em planos com características e preços descritos na página de
              Planos. A Kyra reserva-se o direito de alterar planos e preços mediante aviso prévio de
              30 dias por e-mail.
            </p>
          </Sub>
          <Sub title="5.2 Cobrança">
            <p>
              As cobranças são realizadas de forma recorrente (mensal ou anual, conforme o plano),
              antecipadamente ao período de uso. A Empresa autoriza o débito automático no cartão de
              crédito ou via boleto bancário cadastrado.
            </p>
          </Sub>
          <Sub title="5.3 Reembolso">
            <p>
              Em conformidade com o Código de Defesa do Consumidor (art. 49), contratos celebrados fora
              do estabelecimento comercial dão direito a cancelamento sem custo em até 7 dias corridos
              da contratação, com reembolso integral. Após esse prazo, não há reembolso de valores já
              cobrados, salvo disposição contratual específica.
            </p>
          </Sub>
          <Sub title="5.4 Inadimplência">
            <p>
              O não pagamento em até 10 dias após o vencimento poderá acarretar suspensão do acesso.
              Após 30 dias de inadimplência, a Kyra poderá encerrar a Conta e excluir os Dados,
              respeitando o aviso prévio mínimo de 15 dias.
            </p>
          </Sub>
          <Sub title="5.5 Cancelamento pela Empresa">
            <p>
              A Empresa poderá cancelar a assinatura a qualquer momento pelo painel de configurações ou
              pelo e-mail {CONTACT_EMAIL}. O acesso permanece ativo até o fim do período já pago.
            </p>
          </Sub>
        </Section>

        <Section title="6. Propriedade Intelectual">
          <p>
            Todos os direitos de propriedade intelectual sobre a Plataforma, incluindo código-fonte,
            interfaces, marcas, logotipos, textos e documentação, pertencem exclusivamente à{' '}
            <strong>{COMPANY_NAME}</strong> ou a seus licenciadores. Nenhuma disposição destes Termos
            transfere ao Usuário qualquer direito sobre tais ativos.
          </p>
          <p>
            A Empresa retém a titularidade de todos os Dados por ela inseridos na Plataforma. A Kyra
            recebe licença limitada, não exclusiva e revogável para processar e armazenar esses Dados
            exclusivamente para fins de prestação do serviço contratado.
          </p>
        </Section>

        <Section title="7. Proteção de Dados e LGPD">
          <p>
            O tratamento de dados pessoais pela Kyra está descrito na{' '}
            <a href="/privacy" className="text-teal-600 hover:underline">Política de Privacidade</a>,
            em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD). A Empresa,
            na condição de controladora dos dados de seus clientes e funcionários inseridos na
            Plataforma, é responsável por garantir que tais tratamentos possuam base legal adequada.
          </p>
          <p>
            A Kyra atua como operadora em relação a esses dados, processando-os apenas conforme
            instrução da Empresa e nos limites dos serviços contratados.
          </p>
        </Section>

        <Section title="8. Disponibilidade e SLA">
          <Sub title="8.1 Disponibilidade">
            <p>
              A Kyra empenha esforços razoáveis para manter a Plataforma disponível 24/7, mas não
              garante disponibilidade ininterrupta. Manutenções programadas serão avisadas com
              antecedência mínima de 24 horas.
            </p>
          </Sub>
          <Sub title="8.2 Sem garantia de resultados">
            <p>
              A Plataforma é fornecida "como está" (as is). A Kyra não garante que a Plataforma estará
              livre de erros ou que atenderá plenamente às necessidades específicas de cada Empresa.
            </p>
          </Sub>
        </Section>

        <Section title="9. Limitação de Responsabilidade">
          <p>
            Na máxima extensão permitida pela legislação aplicável, a Kyra não será responsável por:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Lucros cessantes, danos indiretos, incidentais ou consequenciais;</li>
            <li>Perda de dados decorrente de falha do Usuário em manter backups externos;</li>
            <li>Danos causados por uso indevido da Plataforma por Usuários;</li>
            <li>Indisponibilidade por força maior, caso fortuito ou atos de terceiros (ex.: falha de infraestrutura de terceiros).</li>
          </ul>
          <p className="mt-3">
            Em qualquer caso, a responsabilidade total da Kyra perante a Empresa ficará limitada ao
            valor pago nos últimos 3 meses de serviço.
          </p>
        </Section>

        <Section title="10. Suspensão e Encerramento">
          <p>
            A Kyra poderá suspender ou encerrar o acesso de qualquer Usuário ou Empresa, com ou sem
            aviso prévio, nos seguintes casos:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Violação destes Termos;</li>
            <li>Uso que cause risco à segurança da Plataforma ou de outros usuários;</li>
            <li>Inadimplência persistente (conforme item 5.4);</li>
            <li>Determinação legal ou judicial.</li>
          </ul>
          <p className="mt-3">
            No encerramento, a Empresa poderá solicitar exportação dos seus Dados em até 30 dias. Após
            esse prazo, os Dados poderão ser excluídos permanentemente, salvo obrigação legal de
            retenção.
          </p>
        </Section>

        <Section title="11. Comunicações">
          <p>
            As comunicações oficiais da Kyra serão feitas pelo e-mail cadastrado na Conta ou mediante
            avisos publicados na própria Plataforma. O Usuário é responsável por manter o e-mail
            atualizado e verificar as notificações.
          </p>
        </Section>

        <Section title="12. Alterações nos Termos">
          <p>
            A Kyra pode atualizar estes Termos a qualquer momento. Em caso de alterações materiais,
            notificaremos por e-mail ou aviso na Plataforma com antecedência mínima de 15 dias. O uso
            continuado após a data de vigência das alterações constitui aceitação dos novos Termos.
          </p>
        </Section>

        <Section title="13. Legislação Aplicável e Foro">
          <p>
            Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro
            da comarca do domicílio da Empresa ({COMPANY_ADDRESS}) para dirimir quaisquer controvérsias
            decorrentes destes Termos, com renúncia expressa a qualquer outro foro, por mais
            privilegiado que seja.
          </p>
        </Section>

        <Section title="14. Contato">
          <p>
            Para dúvidas, solicitações ou notificações relacionadas a estes Termos, entre em contato:
          </p>
          <address className="not-italic mt-2 space-y-1">
            <p><strong>{COMPANY_NAME}</strong></p>
            <p>{COMPANY_ADDRESS}</p>
            <p>CNPJ: {COMPANY_CNPJ}</p>
            <p>
              E-mail:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-teal-600 hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
          </address>
        </Section>
      </div>
    </>
  )
}
