import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { RequestValidationException } from './request-validation.exception.js';

/**
 * Global HTTP behaviour, registered through DI so e2e tests get it from AppModule:
 * the error envelope filter and Zod (Standard Schema) validation of `@Body/@Query/@Param({ schema })`.
 */
@Module({
  providers: [
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    {
      provide: APP_PIPE,
      useFactory: () =>
        new StandardSchemaValidationPipe({
          exceptionFactory: (issues) => RequestValidationException.fromStandardSchemaIssues(issues),
        }),
    },
  ],
})
export class ApiHttpModule {}
