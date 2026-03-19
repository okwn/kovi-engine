import type { DestinationPlugin } from './types.js';

export class DestinationRegistry {
  private readonly plugins = new Map<string, DestinationPlugin>();

  public register(plugin: DestinationPlugin): void {
    this.plugins.set(plugin.type, plugin);
  }

  public get(type: string): DestinationPlugin {
    const plugin = this.plugins.get(type);
    if (!plugin) {
      throw new Error(`destination plugin not registered: ${type}`);
    }
    return plugin;
  }

  public list(): DestinationPlugin[] {
    return Array.from(this.plugins.values());
  }
}
