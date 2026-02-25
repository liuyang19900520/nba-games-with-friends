import { reportErrorToAWS } from './errorReportingAWS';
import { config } from 'dotenv';
import path from 'path';

// Load env variables
config({ path: path.resolve(__dirname, '../../.env.development') });

// Explicitly set the topic ARN if missing
if (!process.env.NEXT_PUBLIC_SNS_ERROR_TOPIC_ARN) {
    process.env.NEXT_PUBLIC_SNS_ERROR_TOPIC_ARN = 'arn:aws:sns:ap-northeast-1:324971275476:nba-error-alerts';
    console.log('Using default Topic ARN:', process.env.NEXT_PUBLIC_SNS_ERROR_TOPIC_ARN);
}

async function testAlert() {
    console.log('Sending test error alert to SNS...');
    try {
        throw new Error('This is a simulated Next.js Vercel Error generated for testing the AWS SNS Topic pipeline!');
    } catch (err) {
        await reportErrorToAWS(
            'web-api',
            'critical',
            'Simulated database connection crash during user login test.',
            err,
            {
                userId: 'test-user-123',
                endpoint: '/api/login',
                region: 'us-west'
            }
        );
    }
    console.log('Notification sent. Check n8n/LINE!');
}

testAlert().catch(console.error);
