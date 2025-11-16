import { Result, Ok, Err } from './result';
import { TimeoutError, CancellationError } from './errors';

/**
 * Async utilities for better async operations
 */

/**
 * Run promise with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage?: string
): Promise<Result<T, TimeoutError>> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(
        timeoutMessage || 'Operation timed out',
        timeoutMs
      ));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return Ok(result);
  } catch (error) {
    clearTimeout(timeoutId!);
    if (error instanceof TimeoutError) {
      return Err(error);
    }
    throw error;
  }
}

/**
 * Run promise with cancellation token
 */
export async function withCancellation<T>(
  promise: Promise<T>,
  isCancelled: () => boolean
): Promise<Result<T, CancellationError>> {
  // Check before starting
  if (isCancelled()) {
    return Err(new CancellationError());
  }

  try {
    const result = await promise;

    // Check after completion
    if (isCancelled()) {
      return Err(new CancellationError());
    }

    return Ok(result);
  } catch (error) {
    throw error;
  }
}

/**
 * Retry with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    shouldRetry = () => true,
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if we shouldn't
      if (!shouldRetry(error)) {
        throw error;
      }

      // Don't delay on last attempt
      if (attempt < maxRetries - 1) {
        const delay = Math.min(
          initialDelayMs * Math.pow(2, attempt),
          maxDelayMs
        );
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run tasks in parallel with limit
 */
export async function parallelLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const [index, task] of tasks.entries()) {
    const promise = task().then(result => {
      results[index] = result;
    });

    executing.push(promise);

    if (executing.length >= limit) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex(p => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}
