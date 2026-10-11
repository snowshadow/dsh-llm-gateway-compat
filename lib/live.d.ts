/** A loader-owned config reference. Snapshots are read per operation; the reference itself stays stable. */
export interface Live<T> {
    get(): T;
}
/** Read a volatile reference or a plain test/config value. */
export declare function readLive<T>(value: T | Live<T>): T;
