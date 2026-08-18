import type { PluginManifest } from '@openshift/dynamic-plugin-sdk';
import { getCliCommands } from '@scalprum/core';
import type { AppsConfig } from '@scalprum/core';
import type { CommandDefinition, CommandHintResult } from '../types';

interface DiscoveryResult {
  commands: CommandDefinition[];
  errors: Array<{ scope: string; error: string }>;
}

export class CommandRegistry {
  private commands: CommandDefinition[] = [];
  private commandsByScope: Map<string, CommandDefinition[]> = new Map();
  private commandByName: Map<string, CommandDefinition> = new Map();

  /**
   * Fetches manifests for all scopes in appsConfig, then extracts CLI commands
   * from customProperties.scalprum.cli.commands. Single-fetch per scope.
   */
  async discoverFromConfig(
    appsConfig: AppsConfig,
    fetchImpl: typeof fetch = fetch,
  ): Promise<DiscoveryResult> {
    const errors: Array<{ scope: string; error: string }> = [];

    const entries = Object.entries(appsConfig).filter(
      ([, config]) => config.manifestLocation,
    );

    const results = await Promise.allSettled(
      entries.map(async ([scope, config]) => {
        const response = await fetchImpl(config.manifestLocation!, {
          cache: 'no-cache',
        });
        if (!response.ok) {
          throw new Error(
            `Failed to fetch manifest for "${scope}": ${response.status} ${response.statusText}`,
          );
        }
        const manifest: PluginManifest = await response.json();
        return { scope, manifest };
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { scope, manifest } = result.value;
        const cliEntries = getCliCommands(manifest);
        if (cliEntries.length > 0) {
          this.registerCommands(scope, cliEntries);
        }
      } else {
        const message =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        errors.push({ scope: 'unknown', error: message });
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

  /**
   * Returns hints for autocomplete/discovery given partial CLI input.
   *
   * - No input → all available commands
   * - Partial command name → matching command names
   * - Full command name + partial args → argument/option hints for that command
   */
  commandHint(partialInput: string): CommandHintResult[] {
    const parts = partialInput.trim().split(/\s+/);
    const inputCmd = parts[0] ?? '';
    const typedArgs = parts.slice(1);

    const exactMatch = this.commandByName.get(inputCmd);
    if (exactMatch) {
      return [this.buildHintForCommand(exactMatch, typedArgs)];
    }

    const prefixMatches = this.commands.filter((cmd) =>
      cmd.name.startsWith(inputCmd),
    );

    return prefixMatches.map((cmd) => this.buildHintForCommand(cmd, []));
  }

  private buildHintForCommand(
    cmd: CommandDefinition,
    typedArgs: string[],
  ): CommandHintResult {
    const allArgs = cmd.arguments ?? [];
    const remainingArgs = allArgs.slice(typedArgs.length);
    const availableOptions = cmd.options ?? [];

    const argTokens = allArgs.map((arg) =>
      arg.required ? `<${arg.name}>` : `[${arg.name}]`,
    );
    const optionTokens = availableOptions.map(
      (opt) => `[--${opt.name}${opt.alias ? ` | -${opt.alias}` : ''}]`,
    );
    const usage = [cmd.name, ...argTokens, ...optionTokens].join(' ');

    return { command: cmd, usage, remainingArgs, availableOptions };
  }

  private registerCommands(
    scope: string,
    entries: ReturnType<typeof getCliCommands>,
  ): void {
    const scopeCommands: CommandDefinition[] = entries.map((entry) => ({
      name: entry.name,
      description: entry.description ?? '',
      scope,
      module: entry.module,
      arguments: entry.arguments,
      options: entry.options,
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
