import { BadRequestException, type StandardSchemaValidationPipeOptions } from '@nestjs/common';

type StandardSchemaIssue = Parameters<
  NonNullable<StandardSchemaValidationPipeOptions['exceptionFactory']>
>[0][number];

export interface ValidationIssue {
  /** Dotted path to the offending field, e.g. `amount` or `items.0.currency`; `''` for the root. */
  path: string;
  message: string;
}

/** Thrown by the global StandardSchemaValidationPipe; rendered as 400 VALIDATION_ERROR. */
export class RequestValidationException extends BadRequestException {
  constructor(readonly issues: ValidationIssue[]) {
    super('Request validation failed');
  }

  static fromStandardSchemaIssues(
    issues: readonly StandardSchemaIssue[],
  ): RequestValidationException {
    return new RequestValidationException(
      issues.map((issue) => ({
        path: (issue.path ?? [])
          .map((segment) => String(typeof segment === 'object' ? segment.key : segment))
          .join('.'),
        message: issue.message,
      })),
    );
  }
}
