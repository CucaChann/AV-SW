/**
 * Loading saved data (project files, the recovery copy, older app storage):
 * keep each stored value only if it has the same kind as the default for that
 * field, otherwise use the default and record the field's path in `repairs`
 * so the user can be told. Unknown fields are dropped.
 */

function sameKind(value: unknown, expected: unknown) {
  if (typeof expected === "number") return typeof value === "number" && Number.isFinite(value);
  if (Array.isArray(expected)) return Array.isArray(value);
  if (expected !== null && typeof expected === "object") {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  return typeof value === typeof expected;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function withDefaults<T extends object>(
  stored: unknown,
  defaults: T,
  path: string,
  repairs?: string[],
): T {
  if (stored === undefined) return { ...defaults };
  if (!isRecord(stored)) {
    repairs?.push(path);
    return { ...defaults };
  }
  const result: Record<string, unknown> = { ...(defaults as Record<string, unknown>) };
  for (const [key, expected] of Object.entries(defaults)) {
    if (!(key in stored)) continue;
    const value = stored[key];
    if (sameKind(value, expected)) result[key] = value;
    else repairs?.push(`${path}.${key}`);
  }
  return result as T;
}

/** Each object item filled from `defaults()`; non-object items are dropped. */
export function listWithDefaults<T extends object>(
  stored: unknown,
  defaults: () => T,
  path: string,
  repairs?: string[],
): T[] {
  if (stored === undefined) return [];
  if (!Array.isArray(stored)) {
    repairs?.push(path);
    return [];
  }
  const items: T[] = [];
  stored.forEach((item, index) => {
    if (!isRecord(item)) {
      repairs?.push(`${path}[${index}]`);
      return;
    }
    items.push(withDefaults(item, defaults(), `${path}[${index}]`, repairs));
  });
  return items;
}
