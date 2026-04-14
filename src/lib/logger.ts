const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args: unknown[]) => isDev && console.log('[Nivra]', ...args),
  warn: (...args: unknown[]) => isDev && console.warn('[Nivra]', ...args),
  error: (...args: unknown[]) => console.error('[Nivra Error]', ...args),
  debug: (...args: unknown[]) => isDev && console.debug('[Nivra Debug]', ...args),
};
