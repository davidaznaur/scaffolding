import type { PluginManifest } from '@openshift/dynamic-plugin-sdk';

export interface ScalprumCommandArgument {
  name: string;
  description?: string;
  required?: boolean;
  default?: string;
}

export interface ScalprumCommandOption {
  name: string;
  alias?: string;
  description?: string;
  type: 'string' | 'boolean' | 'number';
  default?: unknown;
}

export interface ScalprumCommandEntry {
  name: string;
  description: string;
  module: string;
  arguments?: ScalprumCommandArgument[];
  options?: ScalprumCommandOption[];
}

export interface ScalprumCliProperties {
  commands: ScalprumCommandEntry[];
}

export type ScalprumCapability = 'web' | 'cli';

export interface ScalprumCustomProperties {
  capabilities?: ScalprumCapability[];
  cli?: ScalprumCliProperties;
}

/**
 * Extracts scalprum-specific custom properties from an SDK PluginManifest.
 * Returns undefined if the manifest has no scalprum custom properties.
 */
export function getScalprumProperties(
  manifest: PluginManifest,
): ScalprumCustomProperties | undefined {
  const raw = manifest as unknown as Record<string, unknown>;
  const customProps = raw.customProperties as Record<string, unknown> | undefined;
  return customProps?.scalprum as ScalprumCustomProperties | undefined;
}

/**
 * Extracts CLI command entries from a manifest's scalprum custom properties.
 * Returns an empty array if no CLI commands are defined.
 */
export function getCliCommands(
  manifest: PluginManifest,
): ScalprumCommandEntry[] {
  return getScalprumProperties(manifest)?.cli?.commands ?? [];
}

/**
 * Checks whether a manifest declares a specific scalprum capability.
 */
export function hasCapability(
  manifest: PluginManifest,
  capability: ScalprumCapability,
): boolean {
  const props = getScalprumProperties(manifest);
  return props?.capabilities?.includes(capability) ?? false;
}
