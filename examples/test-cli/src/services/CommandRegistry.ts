import type { CliManifest, CommandDefinition, PluginSource } from '../commands/types';

interface DiscoveryResult {
  commands: CommandDefinition[];
  errors: Array<{ scope: string; error: string }>;
}

export class CommandRegistry {
  private commands: CommandDefinition[] = [];
  private commandsByScope: Map<string, CommandDefinition[]> = new Map();
  private commandByName: Map<string, CommandDefinition> = new Map();

  async discover(sources: PluginSource[]): Promise<DiscoveryResult> {
    const errors: Array<{ scope: string; error: string }> = [];

    const results = await Promise.allSettled(
      sources.map((source) => this.fetchCliManifest(source)),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const source = sources[i];

      if (result.status === 'fulfilled') {
        this.registerManifest(source.scope, result.value);
      } else {
        errors.push({ scope: source.scope, error: result.reason?.message ?? String(result.reason) });
      }
    }

    return { commands: this.commands, errors };
  }

  getCommands(): CommandDefinition[] {
    return this.commands;
  }

  findCommand(name: string): CommandDefinition | undefined {
    return this.commandByName.get(name);
  }

  getCommandsByScope(scope: string): CommandDefinition[] {
    return this.commandsByScope.get(scope) ?? [];
  }

  private async fetchCliManifest(source: PluginSource): Promise<CliManifest> {
    const response = await fetch(source.cliManifestLocation);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch CLI manifest for "${source.scope}" at ${source.cliManifestLocation}: ${response.status} ${response.statusText}`,
      );
    }
    const manifest: CliManifest = await response.json();
    this.validateManifest(manifest, source.scope);
    return manifest;
  }

  private validateManifest(manifest: CliManifest, expectedScope: string): void {
    if (!manifest.name) {
      throw new Error(`CLI manifest for "${expectedScope}" is missing the "name" field`);
    }
    if (!Array.isArray(manifest.commands)) {
      throw new Error(`CLI manifest for "${expectedScope}" has no "commands" array`);
    }
    for (const cmd of manifest.commands) {
      if (!cmd.name || !cmd.module) {
        throw new Error(
          `CLI manifest for "${expectedScope}" contains a command entry missing "name" or "module"`,
        );
      }
    }
  }

  private registerManifest(scope: string, manifest: CliManifest): void {
    const scopeCommands: CommandDefinition[] = manifest.commands.map((entry) => ({
      name: entry.name,
      description: entry.description ?? '',
      scope,
      module: entry.module,
      usage: entry.usage,
    }));

    for (const cmd of scopeCommands) {
      if (this.commandByName.has(cmd.name)) {
        const existing = this.commandByName.get(cmd.name)!;
        console.warn(
          `[CommandRegistry] Command "${cmd.name}" from "${scope}" conflicts with existing command from "${existing.scope}". Skipping.`,
        );
        continue;
      }
      this.commands.push(cmd);
      this.commandByName.set(cmd.name, cmd);
    }

    this.commandsByScope.set(scope, scopeCommands);
  }
}
