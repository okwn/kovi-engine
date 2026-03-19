import pino, { type LoggerOptions } from 'pino';
export * from './types.js';

export interface LoggerContext {
  service: string;
  env: string;
  version?: string;
}

export const createLogger = (context: LoggerContext): pino.Logger => {
  const options: LoggerOptions = {
    level: process.env.LOG_LEVEL ?? 'info',
    base: {
      service: context.service,
      env: context.env,
      version: context.version ?? 'dev'
    },
    timestamp: pino.stdTimeFunctions.isoTime
  };

  return pino(options);
};

export const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
