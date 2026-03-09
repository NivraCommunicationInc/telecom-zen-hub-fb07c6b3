/**
 * Shared environment filter type for test/live separation.
 * Core-local copy for deployment decoupling.
 */
export type EnvironmentFilter = 'live' | 'test' | 'all';
