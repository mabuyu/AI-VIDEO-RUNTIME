export interface ArtifactStorageLocation {
  readonly resourceLocation: string
}

export interface ArtifactStorage {
  readonly store: (resource: Uint8Array) => Promise<ArtifactStorageLocation>
  readonly resolve: (
    location: ArtifactStorageLocation,
  ) => Promise<Uint8Array | null>
  readonly exists: (location: ArtifactStorageLocation) => Promise<boolean>
}
