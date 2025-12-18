/**
 * Environment configuration
 * 
 * Centralizes environment variable access and provides type-safe defaults.
 * This improves maintainability and makes it easier to test different configurations.
 */

/**
 * Check if we're in development mode
 * Useful for enabling debug logs, dev tools, etc.
 */
export const IS_DEV = import.meta.env.DEV;

/**
 * Check if we're in production mode
 */
export const IS_PROD = import.meta.env.PROD;

/**
 * Enable debug logging in development
 * Set to false to disable all debug logs even in dev mode
 */
export const ENABLE_DEBUG_LOGS = IS_DEV && import.meta.env.VITE_ENABLE_DEBUG_LOGS !== 'false';

/**
 * Logger utility that respects environment settings
 * 
 * @example
 * ```ts
 * logger.debug('Debug message'); // Only logs in dev if ENABLE_DEBUG_LOGS is true
 * logger.error('Error message'); // Always logs
 * ```
 */
export const logger = {
  debug: (...args: unknown[]) => {
    if (ENABLE_DEBUG_LOGS) {
      console.log(...args);
    }
  },
  info: (...args: unknown[]) => {
    if (ENABLE_DEBUG_LOGS) {
      console.info(...args);
    }
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};

