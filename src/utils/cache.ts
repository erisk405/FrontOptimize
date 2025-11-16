/**
 * Simple LRU cache for AI requests and analysis results
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hits: number;
}

export class Cache<K, V> {
  private cache = new Map<string, CacheEntry<V>>();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize: number = 100, ttlMs: number = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  /**
   * Generate cache key from object
   */
  private generateKey(key: K): string {
    if (typeof key === 'string') {
      return key;
    }
    return JSON.stringify(key);
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<V>): boolean {
    return Date.now() - entry.timestamp > this.ttlMs;
  }

  /**
   * Get value from cache
   */
  get(key: K): V | undefined {
    const cacheKey = this.generateKey(key);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      return undefined;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(cacheKey);
      return undefined;
    }

    entry.hits++;
    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: K, value: V): void {
    const cacheKey = this.generateKey(key);

    // Evict least recently used if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(cacheKey)) {
      this.evictLRU();
    }

    this.cache.set(cacheKey, {
      value,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let minHits = Infinity;
    let oldestKey: string | null = null;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.hits < minHits) {
        minHits = entry.hits;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Check if key exists in cache
   */
  has(key: K): boolean {
    const cacheKey = this.generateKey(key);
    const entry = this.cache.get(cacheKey);
    return entry !== undefined && !this.isExpired(entry);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number
): T {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  return ((...args: any[]) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= delayMs) {
      lastCall = now;
      fn(...args);
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        fn(...args);
      }, delayMs - timeSinceLastCall);
    }
  }) as T;
}

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number
): T {
  let timeoutId: NodeJS.Timeout | null = null;

  return ((...args: any[]) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => fn(...args), delayMs);
  }) as T;
}

/**
 * Async cache wrapper - automatically cache async function results
 */
export function withCache<K, V>(
  fn: (key: K) => Promise<V>,
  cache: Cache<K, V>
): (key: K) => Promise<V> {
  return async (key: K) => {
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await fn(key);
    cache.set(key, value);
    return value;
  };
}
