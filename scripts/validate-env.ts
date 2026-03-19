import { loadAdminConfig, loadApiConfig, loadOrchestratorConfig, loadWorkerConfig } from '@kovi/config';

const target = process.argv[2] ?? 'all';

const run = (): void => {
  if (target === 'all' || target === 'api') {
    loadApiConfig();
  }
  if (target === 'all' || target === 'admin') {
    loadAdminConfig();
  }
  if (target === 'all' || target === 'worker') {
    loadWorkerConfig();
  }
  if (target === 'all' || target === 'orchestrator') {
    loadOrchestratorConfig();
  }
};

try {
  run();
  process.stdout.write(`[env-validation] success for target=${target}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[env-validation] failed for target=${target}: ${message}\n`);
  process.exit(1);
}
