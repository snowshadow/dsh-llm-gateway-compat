/** A loader-owned config reference. Snapshots are read per operation; the reference itself stays stable. */
export interface Live<T> {
  get(): T
}

function isLive<T>(value: T | Live<T>): value is Live<T> {
  return value !== null && typeof value === 'object' && 'get' in value && typeof value.get === 'function'
}

/** Read a volatile reference or a plain test/config value. */
export function readLive<T>(value: T | Live<T>): T {
  if (isLive(value)) return value.get()
  return value
}
