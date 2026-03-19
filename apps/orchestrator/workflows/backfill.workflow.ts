import { proxyActivities, sleep } from '@temporalio/workflow';

interface BackfillActivities {
  updateReplayJobStatus(input: {
    replayJobId: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    resultSummary?: Record<string, unknown>;
  }): Promise<void>;
}

const activities = proxyActivities<BackfillActivities>({
  startToCloseTimeout: '2 minutes',
  taskQueue: 'kovi-orchestrator'
});

export interface BackfillWorkflowInput {
  replayJobId: string;
  tenantId: string;
  sourceId: string | null;
  dryRun: boolean;
  params: Record<string, unknown>;
}

export const backfillWorkflow = async (input: BackfillWorkflowInput): Promise<void> => {
  await activities.updateReplayJobStatus({ replayJobId: input.replayJobId, status: 'running' });
  await sleep(500);
  await activities.updateReplayJobStatus({
    replayJobId: input.replayJobId,
    status: 'completed',
    resultSummary: {
      mode: 'backfill',
      dryRun: input.dryRun,
      tenantId: input.tenantId,
      sourceId: input.sourceId,
      params: input.params
    }
  });
};
