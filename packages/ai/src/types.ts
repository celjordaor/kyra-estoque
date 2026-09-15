export interface AIProvider {
  name: string
  chat(messages: AIMessage[]): Promise<AIResponse>
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIResponse {
  content: string
  usage?: { promptTokens: number; completionTokens: number }
}

export interface AITool {
  name: string
  description: string
  execute(params: Record<string, unknown>): Promise<unknown>
}
