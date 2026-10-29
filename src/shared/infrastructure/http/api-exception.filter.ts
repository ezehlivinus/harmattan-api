import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { DomainError } from '../../domain/domain-error.js';
import { DOMAIN_ERROR_STATUS } from './domain-error-status.js';
import { RequestValidationException } from './request-validation.exception.js';

/** Body of every error response: `{ "error": { "code", "message", "details" } }`. */
export interface ApiErrorBody {
  error: { code: string; message: string; details: Record<string, unknown> };
}

/** Keys of the body Nest builds for `new NotFoundException('...')` and friends. */
const NEST_DEFAULT_BODY_KEYS = new Set(['statusCode', 'message', 'error']);

/**
 * Renders every error in the API envelope: domain errors by their code, request validation as
 * VALIDATION_ERROR, Nest HTTP exceptions by status name, anything else as a generic 500.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.adapterHost;
    const response: unknown = host.switchToHttp().getResponse();
    if (httpAdapter.isHeadersSent(response)) {
      // A reply already started; mirror Nest's base filter and just end it.
      this.logger.error('Error after the response started', errorStack(exception));
      httpAdapter.end(response);
      return;
    }
    const { status, body } = this.toErrorResponse(exception);
    httpAdapter.reply(response, body, status);
  }

  private toErrorResponse(exception: unknown): { status: number; body: ApiErrorBody } {
    if (exception instanceof DomainError) {
      return envelope(DOMAIN_ERROR_STATUS[exception.code], exception.code, exception.message, {
        ...exception.details,
      });
    }
    if (exception instanceof RequestValidationException) {
      return envelope(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', exception.message, {
        issues: exception.issues,
      });
    }
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }
    this.logger.error('Unhandled error', errorStack(exception));
    return envelope(HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', 'Internal server error');
  }

  private fromHttpException(exception: HttpException): { status: number; body: ApiErrorBody } {
    const status = exception.getStatus();
    const code = (HttpStatus as Record<number, string | undefined>)[status] ?? 'HTTP_ERROR';
    const response = exception.getResponse();
    if (status >= 500) {
      this.logger.error(`HTTP ${status}`, errorStack(exception));
    }
    if (typeof response === 'string') {
      return envelope(status, code, response);
    }
    const fields = response as Record<string, unknown>;
    if (Object.keys(fields).every((key) => NEST_DEFAULT_BODY_KEYS.has(key))) {
      const message = typeof fields.message === 'string' ? fields.message : titleCase(code);
      return envelope(status, code, message);
    }
    // A custom object body (e.g. the Terminus health result) is kept as details.
    return envelope(status, code, titleCase(code), fields);
  }
}

function envelope(
  status: number,
  code: string,
  message: string,
  details: Record<string, unknown> = {},
): { status: number; body: ApiErrorBody } {
  return { status, body: { error: { code, message, details } } };
}

/** `SERVICE_UNAVAILABLE` → `Service Unavailable`. */
function titleCase(code: string): string {
  return code
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function errorStack(error: unknown): string {
  return error instanceof Error ? (error.stack ?? error.message) : String(error);
}
