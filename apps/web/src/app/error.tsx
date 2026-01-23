'use client';

import { useEffect } from "react";
import { logger } from "@/config/env";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    logger.error("[GlobalErrorBoundary]", {
      message: error.message,
      stack: error.stack,
      digest: (error as { digest?: string }).digest,
    });
  }, [error]);

  return (
    <html>
      <body className="min-h-screen bg-brand-dark text-brand-text-light">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="max-w-md w-full rounded-xl bg-brand-card border border-brand-card-border p-6 text-center shadow-lg">
            <h1 className="text-xl font-semibold text-white mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-brand-text-dim mb-6">
              An unexpected error occurred while rendering this page. You can
              try again, or come back later.
            </p>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center justify-center rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-brand-dark hover:bg-brand-blue/90 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 focus:ring-offset-brand-dark transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

