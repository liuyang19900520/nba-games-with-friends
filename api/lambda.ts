// AWS Lambda adapter: Function URL / API Gateway HTTP API (payload 2.0) and REST API (1.0). Thin: maps event -> Req, Res -> result.
import { route } from "./handlers.ts";
export const handler = async (event: any) => {
  const r = await route({ method: event.requestContext?.http?.method ?? event.httpMethod ?? "GET", path: event.rawPath ?? event.path ?? "/",
    query: event.queryStringParameters ?? {} });
  return { statusCode: r.status, headers: r.headers, body: r.body };
};
