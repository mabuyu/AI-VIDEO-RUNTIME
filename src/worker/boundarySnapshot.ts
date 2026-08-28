function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

function materialize(
  value: unknown,
  ancestors: WeakSet<object>,
): unknown {
  if (!isObject(value)) return value
  if (ancestors.has(value)) {
    throw new TypeError('Boundary data cannot contain cycles')
  }

  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      const items: unknown[] = []
      for (let index = 0; index < value.length; index += 1) {
        if (!(index in value)) {
          throw new TypeError('Boundary arrays cannot contain holes')
        }
        items.push(materialize(value[index], ancestors))
      }
      return items
    }

    const snapshot: Record<string, unknown> = {}
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') {
        throw new TypeError('Boundary data cannot contain symbol keys')
      }
      snapshot[key] = materialize(
        (value as Record<string, unknown>)[key],
        ancestors,
      )
    }
    return snapshot
  } finally {
    ancestors.delete(value)
  }
}

function freezeDeep(value: unknown, seen: WeakSet<object>): void {
  if (!isObject(value) || seen.has(value)) return
  seen.add(value)

  for (const child of Object.values(value)) freezeDeep(child, seen)
  Object.freeze(value)
}

export function materializeImmutableBoundaryValue(value: unknown): unknown {
  const snapshot = materialize(value, new WeakSet<object>())
  freezeDeep(snapshot, new WeakSet<object>())
  return snapshot
}
