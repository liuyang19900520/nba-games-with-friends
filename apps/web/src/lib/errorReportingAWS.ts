/**
 * AWS Native Error Reporting Utility for Vercel/Next.js
 * Pushes formatted JSON to the central SNS Topic.
 */
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

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
let snsClient: SNSClient | null = null;

function getSNSClient() {
    if (!snsClient) {
        // Requires AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY in env
        snsClient = new SNSClient({
            region: process.env.AWS_REGION || 'ap-northeast-1',
        });
    }
    return snsClient;
}

/**
 * Sends a standardized error payload to the central AWS SNS Topic.
 * Fails silently if the Topic ARN is not configured or if the request fails
 * to prevent error handling from crashing the app.
 */
export async function reportErrorToAWS(
    source: ErrorSource,
    level: ErrorLevel,
    message: string,
    errorObj?: Error | unknown,
    additionalContext?: Record<string, any>
) {
    try {
        const topicArn = process.env.NEXT_PUBLIC_SNS_ERROR_TOPIC_ARN || process.env.SNS_ERROR_TOPIC_ARN;

        if (!topicArn) {
            console.warn('SNS_ERROR_TOPIC_ARN is not configured. Cannot send error alert to AWS.');
            return;
        }

        let detailsStr = '';
        if (errorObj instanceof Error) {
            detailsStr = `Name: ${errorObj.name}\nMessage: ${errorObj.message}\nStack: ${errorObj.stack || 'N/A'}`;
        } else if (errorObj !== undefined) {
            detailsStr = typeof errorObj === 'object' ? JSON.stringify(errorObj, null, 2) : String(errorObj);
        }

        if (additionalContext) {
            detailsStr += `\n\nContext:\n${JSON.stringify(additionalContext, null, 2)}`;
        }

        // This JSON structure matches what the n8n Parse JSON Node expects inside $input.item.json.snsData
        const payload: ErrorPayload = {
            source,
            level,
            message,
            details: detailsStr.trim(),
            timestamp: new Date().toISOString(),
        };

        const client = getSNSClient();

        // We send it as a JSON string within the "Message" property of SNS 
        await client.send(
            new PublishCommand({
                TopicArn: topicArn,
                Subject: `[${level.toUpperCase()}] Alert from ${source}`,
                Message: JSON.stringify(payload)
            })
        );

    } catch (e) {
        // Ultimate fallback, ensure reporting function never throws
        console.error('CRITICAL: Error in reportErrorToAWS utility itself:', e);
    }
}
