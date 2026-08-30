import type {
  PlatformUser,
  Project,
  Workspace,
  WorkspaceMembership,
} from './contracts'

const platformUsers = new WeakSet<object>()
const workspaces = new WeakSet<object>()
const projects = new WeakSet<object>()
const workspaceMemberships = new WeakSet<object>()

export function authorizePlatformUser(user: PlatformUser): PlatformUser {
  const snapshot = Object.freeze(user)
  platformUsers.add(snapshot)
  return snapshot
}

export function authorizeWorkspace(workspace: Workspace): Workspace {
  const snapshot = Object.freeze(workspace)
  workspaces.add(snapshot)
  return snapshot
}

export function authorizeProject(project: Project): Project {
  const snapshot = Object.freeze(project)
  projects.add(snapshot)
  return snapshot
}

export function authorizeWorkspaceMembership(
  membership: WorkspaceMembership,
): WorkspaceMembership {
  const snapshot = Object.freeze(membership)
  workspaceMemberships.add(snapshot)
  return snapshot
}

export function isAuthorizedPlatformUser(value: object): boolean {
  return platformUsers.has(value) && Object.isFrozen(value)
}

export function isAuthorizedWorkspace(value: object): boolean {
  return workspaces.has(value) && Object.isFrozen(value)
}

export function isAuthorizedProject(value: object): boolean {
  return projects.has(value) && Object.isFrozen(value)
}

export function isAuthorizedWorkspaceMembership(value: object): boolean {
  return workspaceMemberships.has(value) && Object.isFrozen(value)
}
