export interface IntegrationAdapter {
  name: string
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
}
