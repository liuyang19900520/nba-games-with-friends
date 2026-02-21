/**
 * AWS Native Error Reporting Utility for Vercel/Next.js
 * Pushes formatted JSON to AWS CloudWatch Logs.
 */
import { CloudWatchLogsClient, PutLogEventsCommand, CreateLogStreamCommand } from "@aws-sdk/client-cloudwatch-logs";

export type ErrorLevel = 'info' | 'warning' | 'error' | 'critical';
export type ErrorSource = 'web-client' | 'web-api' | 'local-worker';

export interface ErrorPayload {
    source: ErrorSource;
    level: ErrorLevel;
    message: string;
    details?: string;
    timestamp: string;
}

// AWS Client is lazy-initialized
let cwClient: CloudWatchLogsClient | null = null;
const LOG_GROUP_NAME = '/aws/vercel/nba-web';

function getCWClient() {
    if (!cwClient) {
        // Requires AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY in env
        cwClient = new CloudWatchLogsClient({
            region: process.env.AWS_REGION || 'ap-northeast-1',
        });
    }
    return cwClient;
}

/**
 * Ensures the log stream exists for today.
 */
async function ensureLogStream(client: CloudWatchLogsClient, logStreamName: string) {
    try {
        await client.send(new CreateLogStreamCommand({
            logGroupName: LOG_GROUP_NAME,
            logStreamName: logStreamName
        }));
    } catch (e: unknown) {
        // Ignore if the stream already exists
        if (e && typeof e === 'object' && 'name' in e && e.name !== 'ResourceAlreadyExistsException') {
            console.error('Error creating log stream:', e);
        } else if (!e || typeof e !== 'object' || !('name' in e)) {
            console.error('Unknown error creating log stream:', e);
        }
    }
}

/**
 * Sends a standardized error payload to AWS CloudWatch Logs.
 * Fails silently to prevent error handling from crashing the app.
 */
export async function reportErrorToAWS(
    source: ErrorSource,
    level: ErrorLevel,
    message: string,
    errorObj?: Error | unknown,
    additionalContext?: Record<string, unknown>
) {
    try {
        let detailsStr = '';
        if (errorObj instanceof Error) {
            detailsStr = `Name: ${errorObj.name}\nMessage: ${errorObj.message}\nStack: ${errorObj.stack || 'N/A'}`;
        } else if (errorObj !== undefined) {
            detailsStr = typeof errorObj === 'object' ? JSON.stringify(errorObj, null, 2) : String(errorObj);
        }

        if (additionalContext) {
            detailsStr += `\n\nContext:\n${JSON.stringify(additionalContext, null, 2)}`;
        }

        const payload: ErrorPayload = {
            source,
            level,
            message,
            details: detailsStr.trim(),
            timestamp: new Date().toISOString(),
        };

        const client = getCWClient();

        // Use a daily log stream to group logs neatly
        const dateStr = new Date().toISOString().split('T')[0];
        const logStreamName = `vercel-alerts-${dateStr}`;

        await ensureLogStream(client, logStreamName);

        // Send to CloudWatch Logs
        await client.send(
            new PutLogEventsCommand({
                logGroupName: LOG_GROUP_NAME,
                logStreamName: logStreamName,
                logEvents: [
                    {
                        timestamp: Date.now(),
                        message: JSON.stringify(payload) // The JSON structure is watched by the Metric Filter
                    }
                ]
            })
        );

    } catch (e) {
        // Ultimate fallback, ensure reporting function never throws
        console.error('CRITICAL: Error in reportErrorToAWS utility itself:', e);
    }
}
