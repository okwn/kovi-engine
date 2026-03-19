import { continueAsNew, startChild, sleep } from '@temporalio/workflow';
import { sourceScheduleWorkflow } from './source-schedule.workflow.js';
import type { SourceWorkflowConfig } from './types.js';

interface CoordinatorActivities {
  listSchedulableSources(): Promise<SourceWorkflowConfig[]>;
  emitRunMetric(input: { metric: string; sourceId: string; value: number; tags: Record<string, string> }): Promise<void>;
}

import { proxyActivities } from '@temporalio/workflow';

const activities = proxyActivities<CoordinatorActivities>({
  startToCloseTimeout: '2 minutes',
  taskQueue: 'kovi-orchestrator',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '20s'
  }
});

export interface CoordinatorWorkflowInput {
  knownSourceIds?: string[];
  cycle?: number;
  reconcileSeconds: number;
}

const MAX_CYCLES_BEFORE_CONTINUE_AS_NEW = 250;

export const coordinatorWorkflow = async (input: CoordinatorWorkflowInput): Promise<void> => {
  const known = new Set(input.knownSourceIds ?? []);
  const cycle = input.cycle ?? 0;

  const sources = await activities.listSchedulableSources();
  for (const source of sources) {
    if (known.has(source.sourceId)) {
      continue;
    }

    known.add(source.sourceId);
    await startChild(sourceScheduleWorkflow, {
      workflowId: `source-schedule-${source.sourceId}`,
      args: [{ config: source }],
      taskQueue: 'kovi-orchestrator'
    });
  }

  await activities.emitRunMetric({
    metric: 'orchestrator.coordinator.sources.active',
    sourceId: 'coordinator',
    value: known.size,
    tags: { cycle: String(cycle) }
  });

  if (cycle >= MAX_CYCLES_BEFORE_CONTINUE_AS_NEW) {
    await continueAsNew<typeof coordinatorWorkflow>({
      knownSourceIds: Array.from(known),
      cycle: 0,
      reconcileSeconds: input.reconcileSeconds
    });
    return;
  }

  await sleep(input.reconcileSeconds * 1000);
  await coordinatorWorkflow({
    knownSourceIds: Array.from(known),
    cycle: cycle + 1,
    reconcileSeconds: input.reconcileSeconds
  });
};
