import { continueAsNew, executeChild, sleep } from '@temporalio/workflow';
import { sourceRunWorkflow } from './source-run.workflow.js';
import type { SourceWorkflowConfig } from './types.js';

export interface SourceScheduleWorkflowInput {
  config: SourceWorkflowConfig;
  iteration?: number;
}

const MAX_ITERATIONS_BEFORE_CONTINUE_AS_NEW = 500;

export const sourceScheduleWorkflow = async (input: SourceScheduleWorkflowInput): Promise<void> => {
  const iteration = input.iteration ?? 0;

  await executeChild(sourceRunWorkflow, {
    args: [{ config: input.config }],
    workflowId: `source-run-${input.config.sourceId}-${Date.now()}`,
    taskQueue: 'kovi-orchestrator'
  });

  if (iteration >= MAX_ITERATIONS_BEFORE_CONTINUE_AS_NEW) {
    await continueAsNew<typeof sourceScheduleWorkflow>({
      config: input.config,
      iteration: 0
    });
    return;
  }

  await sleep(input.config.intervalSeconds * 1000);
  await sourceScheduleWorkflow({
    config: input.config,
    iteration: iteration + 1
  });
};
