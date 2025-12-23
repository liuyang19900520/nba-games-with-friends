/**
 * Environment configuration
 *
 * Centralizes environment variable access and provides type-safe defaults.
 * This improves maintainability and makes it easier to test different configurations.
 */

/**
 * Check if we're in development mode
 * Useful for enabling debug logs, dev tools, etc.
 *
 * Note:
 * - In Vite we used import.meta.env.DEV/PROD
 * - In Next.js we should use process.env.NODE_ENV
 */
export const IS_DEV = process.env.NODE_ENV === "development";

/**
 * Check if we're in production mode
 */
export const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Enable debug logging
 *
 * 默认行为：
 * - development：开启 debug 日志（除非显式设置 NEXT_PUBLIC_ENABLE_DEBUG_LOGS="false"）
 * - production：关闭 debug/info/warn 日志（除非显式设置 NEXT_PUBLIC_ENABLE_DEBUG_LOGS="true"）
 *
 * 在 Vercel 上启用生产环境调试：
 * - 在 Project Settings → Environment Variables 中新增：
 *   - KEY: NEXT_PUBLIC_ENABLE_DEBUG_LOGS
 *   - VALUE: "true"
 *   - Environment: Preview / Production（按需选择）
 */
export const ENABLE_DEBUG_LOGS =
  (IS_DEV && process.env.NEXT_PUBLIC_ENABLE_DEBUG_LOGS !== "false") ||
  (!IS_DEV && process.env.NEXT_PUBLIC_ENABLE_DEBUG_LOGS === "true");

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
    if (ENABLE_DEBUG_LOGS) {
      console.warn(...args);
    }
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};
