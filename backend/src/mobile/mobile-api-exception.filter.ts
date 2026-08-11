import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";

const codes: Record<number, "SESSION_EXPIRED" | "ACCESS_DENIED" | "RESOURCE_NOT_FOUND"> = {
  [HttpStatus.UNAUTHORIZED]: "SESSION_EXPIRED",
  [HttpStatus.FORBIDDEN]: "ACCESS_DENIED",
  [HttpStatus.NOT_FOUND]: "RESOURCE_NOT_FOUND",
};

@Catch()
export class MobileApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const mobileRequest = request.path.startsWith("/mobile/") || request.path.startsWith("/auth/mobile/");
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const code = codes[status];
    if (!mobileRequest || !code) {
      const body = exception instanceof HttpException ? exception.getResponse() : { statusCode: status, message: "Internal server error" };
      response.status(status).json(body);
      return;
    }
    const body = exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = typeof body === "object" && body !== null && "message" in body
      ? Array.isArray(body.message) ? body.message.join(", ") : String(body.message)
      : code === "SESSION_EXPIRED" ? "Session expired" : code === "ACCESS_DENIED" ? "Access denied" : "Resource not found";
    response.status(status).json({ statusCode: status, code, message });
  }
}
