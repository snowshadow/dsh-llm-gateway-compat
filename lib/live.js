function isLive(value) {
    return value !== null && typeof value === 'object' && 'get' in value && typeof value.get === 'function';
}
/** Read a volatile reference or a plain test/config value. */
export function readLive(value) {
    if (isLive(value))
        return value.get();
    return value;
}
