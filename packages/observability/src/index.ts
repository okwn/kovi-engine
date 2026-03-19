import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | undefined;

export interface OTelBootstrapOptions {
  serviceName: string;
  serviceVersion: string;
  endpoint: string;
  enabled: boolean;
}

export const bootstrapOtel = async (options: OTelBootstrapOptions): Promise<void> => {
  if (!options.enabled) {
    return;
  }

  sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({ url: `${options.endpoint}/v1/traces` }),
    instrumentations: [getNodeAutoInstrumentations()],
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: options.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: options.serviceVersion
    })
  });

  await sdk.start();
};

export const shutdownOtel = async (): Promise<void> => {
  if (sdk) {
    await sdk.shutdown();
  }
};
