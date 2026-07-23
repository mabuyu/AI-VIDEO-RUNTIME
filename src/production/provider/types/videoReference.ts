export type ProviderMetadataPrimitive = string | number | boolean | null

export type ProviderMetadataValue =
  | ProviderMetadataPrimitive
  | readonly ProviderMetadataValue[]
  | { readonly [key: string]: ProviderMetadataValue }

export interface VideoReference {
  readonly referenceId: string
  readonly sourceType: 'provider-output'
  readonly location: string
  readonly metadata?: Readonly<Record<string, ProviderMetadataValue>>
}
