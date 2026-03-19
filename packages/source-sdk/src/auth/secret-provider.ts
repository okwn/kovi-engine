import type { SecretProvider } from './types.js';

const normalizeRef = (value: string): string =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');

export class EnvironmentSecretProvider implements SecretProvider {
  public constructor(private readonly prefix = 'KOVI_SECRET_') {}

  public async getSecret(secretRef: string): Promise<string> {
    const key = `${this.prefix}${normalizeRef(secretRef)}`;
    const value = process.env[key];
    if (!value) {
      throw new Error(`missing secret for ref ${secretRef}`);
    }
    return value;
  }
}
