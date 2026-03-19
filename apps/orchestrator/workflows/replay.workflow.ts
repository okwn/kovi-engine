import { proxyActivities, sleep } from '@temporalio/workflow';

interface ReplayActivities {
  updateReplayJobStatus(input: {
    replayJobId: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    resultSummary?: Record<string, unknown>;
  }): Promise<void>;
}

const activities = proxyActivities<ReplayActivities>({
  startToCloseTimeout: '2 minutes',
  taskQueue: 'kovi-orchestrator'
});

export interface ReplayWorkflowInput {
  replayJobId: string;
  tenantId: string;
  sourceId: string | null;
  dryRun: boolean;
  params: Record<string, unknown>;
}

export const replayWorkflow = async (input: ReplayWorkflowInput): Promise<void> => {
  await activities.updateReplayJobStatus({ replayJobId: input.replayJobId, status: 'running' });
  await sleep(500);
  await activities.updateReplayJobStatus({
    replayJobId: input.replayJobId,
    status: 'completed',
    resultSummary: {
      mode: 'replay',
      dryRun: input.dryRun,
      tenantId: input.tenantId,
      sourceId: input.sourceId,
      params: input.params
    }
  });
};
