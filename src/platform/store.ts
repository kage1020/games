import { useSyncExternalStore } from "react";

export interface Store<T> {
  get(): T;
  set(next: T | ((current: T) => T)): void;
  subscribe(listener: () => void): () => void;
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * localStorage に置く値。読むたびに保存先と照らし、変わっていなければ同じ参照を返す。
 * 保存できない環境では、この画面を開いている間だけ覚えておく。
 */
export function createPersistentStore<T>(key: string, parse: (raw: string | null) => T): Store<T> {
  let cache: { raw: string | null; value: T } | null = null;
  let memory: { value: T } | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) notify();
  };
  const get = () => {
    if (memory) return memory.value;
    const raw = readStorage(key);
    if (cache === null || cache.raw !== raw) cache = { raw, value: parse(raw) };
    return cache.value;
  };
  return {
    get,
    set(next) {
      const value = typeof next === "function" ? (next as (current: T) => T)(get()) : next;
      const raw = JSON.stringify(value);
      if (writeStorage(key, raw)) cache = { raw, value };
      else memory = { value };
      notify();
    },
    subscribe(listener) {
      if (listeners.size === 0) window.addEventListener("storage", onStorage);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener("storage", onStorage);
      };
    },
  };
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
