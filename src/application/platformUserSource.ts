import { isAuthorizedPlatformUser } from '../platform/authorityProvenance'
import type { PlatformUser } from '../platform'
import type { PlatformUserSource } from './contracts'

export function createInMemoryPlatformUserSource(
  users: readonly PlatformUser[] = [],
): PlatformUserSource {
  const records = new Map<string, PlatformUser>()
  for (const user of users) {
    if (!isAuthorizedPlatformUser(user) || records.has(user.userId)) {
      throw new TypeError(
        'PlatformUserSource requires unique authorized PlatformUser snapshots',
      )
    }
    records.set(user.userId, user)
  }

  return Object.freeze({
    getById(userId: string) {
      return records.get(userId)
    },
  })
}
