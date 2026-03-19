#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const helpText = `
Kovi Destination Plugin Scaffolder

Usage: node scripts/scaffold-destination-plugin.mjs <plugin-type> [options]

Options:
  --output, -o    Output directory (default: packages/events/src/destinations/custom)
  --help, -h      Show this help message

Example:
  node scripts/scaffold-destination-plugin.mjs slack-webhook
`;

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(helpText);
    process.exit(0);
  }

  const pluginType = args[0];
  if (!pluginType) {
    console.error('Error: plugin type required\n');
    console.log(helpText);
    process.exit(1);
  }

  const outDir = path.resolve(process.cwd(), 'packages', 'events', 'src', 'destinations', 'custom');
  await mkdir(outDir, { recursive: true });

  const filePath = path.join(outDir, `${pluginType}.plugin.ts`);
  const className = pluginType.replace(/[^a-zA-Z0-9]/g, '') + 'Plugin';
  
  const template = `import type { DestinationPlugin, DestinationPluginContext, DestinationHealthResult, DestinationSendResult, DestinationSecretProvider } from '../types.js';

export class ${className} implements DestinationPlugin {
  public readonly type = '${pluginType}';

  public validateConfig(config: Record<string, unknown>): void {
    if (!config) {
      throw new Error('Configuration is required');
    }
  }

  public async checkHealth(input: { config: Record<string, unknown>; secretProvider: DestinationSecretProvider }): Promise<DestinationHealthResult> {
    void input;
    return { ok: true, message: 'Plugin health check not implemented' };
  }

  public async send(context: DestinationPluginContext): Promise<DestinationSendResult> {
    void context;
    return { acknowledged: true, externalRef: '${pluginType}-plugin' };
  }
}

export const create${className} = () => new ${className}();
`;

  await writeFile(filePath, template, 'utf-8');
  console.log(`✓ Created destination plugin at ${filePath}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Implement validateConfig() with your required config fields`);
  console.log(`  2. Implement checkHealth() to verify connectivity`);
  console.log(`  3. Implement send() with your delivery logic`);
  console.log(`  4. Register in packages/events/src/destinations/plugins.ts`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});