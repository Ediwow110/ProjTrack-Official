import { Injectable, Logger } from '@nestjs/common';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Lightweight in-memory cache with TTL support.
 * For production at scale, replace the internal Map with a Redis-backed store
 * implementing the same interface — no consumer code changes needed.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly DEFAULT_TTL_MS = 60_000; // 60 seconds
  private readonly MAX_ENTRIES = 200;

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    // Evict oldest entries if at capacity
    if (this.store.size >= this.MAX_ENTRIES) {
      this.evictStale();
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.DEFAULT_TTL_MS),
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Delete all entries whose key starts with the given prefix.
   * Useful for cache invalidation after mutations on an entity type.
   */
  deleteByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }

  /** One-shot stats for monitoring */
  stats() {
    return {
      size: this.store.size,
      maxEntries: this.MAX_ENTRIES,
      keys: Array.from(this.store.keys()),
    };
  }

  private evictStale(): void {
    const now = Date.now();
    let evicted = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        evicted++;
      }
    }

    // If still at capacity, evict the oldest quarter of entries
    if (this.store.size >= this.MAX_ENTRIES) {
      const entries = Array.from(this.store.entries()).sort(
        (a, b) => a[1].expiresAt - b[1].expiresAt,
      );
      const toRemove = Math.max(1, Math.floor(this.MAX_ENTRIES * 0.25));
      for (let i = 0; i < toRemove && i < entries.length; i++) {
        this.store.delete(entries[i][0]);
        evicted++;
      }
    }

    if (evicted > 0) {
      this.logger.debug(`Evicted ${evicted} stale cache entries`);
    }
  }
}
