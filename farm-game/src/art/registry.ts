/** Texture keys currently showing atlas art (filled by `applyArt`); no imports, so anything may use it. */
export const artKeys = new Set<string>();

/** True when a texture key shows atlas art rather than its generated placeholder. */
export const hasArt = (key: string): boolean => artKeys.has(key);
