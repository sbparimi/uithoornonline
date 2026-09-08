import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

let initialized = false;

export function register() {
  if (initialized) return;
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    console.info('LANGFUSE_OBSERVABILITY_DISABLED');
    return;
  }

  const processor = new LangfuseSpanProcessor({ exportMode: 'immediate' });
  const provider = new NodeTracerProvider({ spanProcessors: [processor] });
  provider.register();
  initialized = true;
  console.info('LANGFUSE_OBSERVABILITY_ENABLED');
}
