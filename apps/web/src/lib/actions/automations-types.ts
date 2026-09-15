// Tipos e constantes de automações — sem 'use server'
// Importar daqui nos componentes cliente; importar de automations.ts só as funções async.

export type AutomationTrigger =
  | 'low_stock'
  | 'no_sales'
  | 'slow_moving'      // alias legado
  | 'delayed_purchase'
  | 'sale_happened'
  | 'weekly'
  | 'weekly_report'    // alias legado
  | 'monthly'

export type AutomationAction =
  | 'email'
  | 'notification'
  | 'whatsapp'
  | 'create_task'
  | 'generate_analysis'
  | 'suggest_purchase'
  | 'register_occurrence'

export type AutomationRecipient =
  | 'self'
  | 'stock_manager'
  | 'sales_team'

// Legacy alias kept for page component
export type AutomationType = AutomationTrigger

export interface CompanyAutomation {
  id: string
  automation_type: AutomationTrigger
  title: string | null
  action_type: AutomationAction
  recipient_type: AutomationRecipient
  enabled: boolean
  config: Record<string, unknown>
  n8n_workflow_id: string | null
  n8n_webhook_url: string | null
  last_run_at: string | null
  run_count: number
  updated_at: string
}

export interface AutomationRun {
  id: string
  automation_type: AutomationTrigger
  status: 'running' | 'success' | 'failed' | 'partial'
  triggered_by: 'schedule' | 'manual'
  error_message: string | null
  payload: Record<string, unknown>
  started_at: string
  finished_at: string | null
  duration_ms: number | null
}

export interface AutomationLog {
  id: string
  workflow_name: string
  trigger_type: string
  status: 'running' | 'success' | 'failed' | 'partial'
  error_message: string | null
  started_at: string
  finished_at: string | null
  duration_ms: number | null
}

export const TRIGGER_LABELS: Record<string, string> = {
  low_stock:        'Um produto ficar com estoque baixo',
  no_sales:         'Um produto ficar sem vendas',
  slow_moving:      'Um produto ficar sem vendas',
  delayed_purchase: 'Uma compra atrasar',
  sale_happened:    'Uma venda acontecer',
  weekly:           'Toda semana',
  weekly_report:    'Toda semana',
  monthly:          'Todo mês',
}

export const ACTION_LABELS: Record<string, string> = {
  email:               'Enviar um e-mail',
  notification:        'Enviar uma notificação',
  whatsapp:            'Enviar WhatsApp',
  create_task:         'Criar uma tarefa',
  generate_analysis:   'Gerar uma análise',
  suggest_purchase:    'Sugerir uma compra',
  register_occurrence: 'Registrar uma ocorrência',
}

export const RECIPIENT_LABELS: Record<string, string> = {
  self:          'Você',
  stock_manager: 'Responsável pelo estoque',
  sales_team:    'Equipe comercial',
}
