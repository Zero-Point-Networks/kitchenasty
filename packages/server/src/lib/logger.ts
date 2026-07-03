import pino from 'pino';

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// pino-pretty is a dev-only dependency and is absent from the --omit=dev
// runtime image (e.g. the Docker server image). Use it for readable logs only
// when it's actually installed and we're not in production; otherwise fall back
// to pino's default JSON output so the server still boots.
function prettyTransport(): pino.TransportSingleOptions | undefined {
  if (process.env.NODE_ENV === 'production') return undefined;
  try {
    require.resolve('pino-pretty');
    return { target: 'pino-pretty', options: { colorize: true } };
  } catch {
    return undefined;
  }
}

const transport = prettyTransport();

const logger = pino({
  level: process.env.NODE_ENV === 'test' ? 'silent' : level,
  ...(transport && { transport }),
});

export default logger;

export const serverLogger = logger.child({ module: 'server' });
export const emailLogger = logger.child({ module: 'email' });
export const smsLogger = logger.child({ module: 'sms' });
export const automationLogger = logger.child({ module: 'automation' });
export const metricsLogger = logger.child({ module: 'metrics' });
