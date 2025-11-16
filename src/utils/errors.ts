/**
 * Base error class for the extension
 */
export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly userMessage: string;
  abstract readonly recoverable: boolean;

  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Binary-related errors
 */
export class BinaryError extends AppError {
  readonly code = 'BINARY_ERROR';
  readonly recoverable = false;

  constructor(message: string, cause?: Error) {
    super(message, cause);
  }

  get userMessage(): string {
    return `Analyzer binary error: ${this.message}. Please reinstall the extension.`;
  }
}

/**
 * File system errors
 */
export class FileSystemError extends AppError {
  readonly code = 'FS_ERROR';
  readonly recoverable = false;

  constructor(
    message: string,
    public readonly filePath?: string,
    cause?: Error
  ) {
    super(message, cause);
  }

  get userMessage(): string {
    const path = this.filePath ? ` (${this.filePath})` : '';
    return `File system error${path}: ${this.message}`;
  }
}

/**
 * Analysis errors
 */
export class AnalysisError extends AppError {
  readonly code = 'ANALYSIS_ERROR';
  readonly recoverable = true;

  constructor(message: string, cause?: Error) {
    super(message, cause);
  }

  get userMessage(): string {
    return `Analysis failed: ${this.message}. Please try again.`;
  }
}

/**
 * AI service errors
 */
export class AIServiceError extends AppError {
  readonly code = 'AI_ERROR';
  readonly recoverable = true;

  constructor(
    message: string,
    public readonly statusCode?: number,
    cause?: Error
  ) {
    super(message, cause);
  }

  get userMessage(): string {
    if (this.statusCode === 401) {
      return 'Invalid API key. Please configure your API key.';
    }
    if (this.statusCode === 429) {
      return 'API rate limit exceeded. Please try again later.';
    }
    return `AI service error: ${this.message}`;
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends AppError {
  readonly code = 'CONFIG_ERROR';
  readonly recoverable = true;

  constructor(message: string, public readonly setting?: string) {
    super(message);
  }

  get userMessage(): string {
    const setting = this.setting ? ` (${this.setting})` : '';
    return `Configuration error${setting}: ${this.message}`;
  }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly recoverable = true;

  constructor(message: string, public readonly field?: string) {
    super(message);
  }

  get userMessage(): string {
    const field = this.field ? ` in field '${this.field}'` : '';
    return `Validation error${field}: ${this.message}`;
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends AppError {
  readonly code = 'TIMEOUT_ERROR';
  readonly recoverable = true;

  constructor(
    message: string,
    public readonly timeoutMs: number
  ) {
    super(message);
  }

  get userMessage(): string {
    return `Operation timed out after ${this.timeoutMs}ms. ${this.message}`;
  }
}

/**
 * Cancellation errors
 */
export class CancellationError extends AppError {
  readonly code = 'CANCELLED';
  readonly recoverable = false;

  constructor(message: string = 'Operation was cancelled by user') {
    super(message);
  }

  get userMessage(): string {
    return this.message;
  }
}

/**
 * Helper to convert unknown errors to AppError
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AnalysisError(error.message, error);
  }

  return new AnalysisError(String(error));
}

/**
 * Check if error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.recoverable;
  }
  return false;
}
