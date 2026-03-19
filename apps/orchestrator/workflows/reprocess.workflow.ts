import { proxyActivities, sleep } from '@temporalio/workflow';

interface ReprocessActivities {
  updateReplayJobStatus(input: {
    replayJobId: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    resultSummary?: Record<string, unknown>;
  }): Promise<void>;
}

const activities = proxyActivities<ReprocessActivities>({
  startToCloseTimeout: '2 minutes',
  taskQueue: 'kovi-orchestrator'
});

export interface ReprocessWorkflowInput {
  replayJobId: string;
  tenantId: string;
  sourceId: string | null;
  dryRun: boolean;
  params: Record<string, unknown>;
}

export const reprocessWorkflow = async (input: ReprocessWorkflowInput): Promise<void> => {
  await activities.updateReplayJobStatus({ replayJobId: input.replayJobId, status: 'running' });
  await sleep(500);
  await activities.updateReplayJobStatus({
    replayJobId: input.replayJobId,
    status: 'completed',
    resultSummary: {
      mode: 'reprocess',
      dryRun: input.dryRun,
      tenantId: input.tenantId,
      sourceId: input.sourceId,
      params: input.params
    }
  });
};
