export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  timestamp: string;
}

export interface SourceRunMessage {
  sourceId: string;
  runId: string;
  triggeredAt: string;
}
