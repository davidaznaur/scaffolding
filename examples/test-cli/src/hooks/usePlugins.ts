import { useState, useEffect, useCallback, useRef } from 'react';
import type { AppsConfig } from '@scalprum/core';
import { CommandRegistry } from '../services/CommandRegistry';
import type { CommandDefinition, CommandHintResult } from '../types';

export interface UsePluginsState {
  /** All discovered plugin commands */
  commands: CommandDefinition[];
  /** Whether plugin discovery is in progress */
  loading: boolean;
  /** Errors encountered during discovery */
  errors: Array<{ scope: string; error: string }>;
  /** Look up a command by exact name */
  findCommand: (name: string) => CommandDefinition | undefined;
  /** Get autocomplete/discovery hints for partial input */
  commandHint: (partialInput: string) => CommandHintResult[];
  /** Get all commands provided by a specific scope */
  getCommandsByScope: (scope: string) => CommandDefinition[];
}

/**
 * Discovers CLI plugin commands from scalprum appsConfig manifests.
 * Reads command metadata from customProperties.scalprum.cli.commands —
 * no separate CLI manifest fetch needed.
 *
 * This hook contains no UI framework dependencies (no Ink, no DOM).
 * It provides the data and lookup functions; the consumer wires them
 * into whatever rendering layer they use.
 */
export function usePlugins(appsConfig: AppsConfig): UsePluginsState {
  const [commands, setCommands] = useState<CommandDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Array<{ scope: string; error: string }>>([]);
  const registryRef = useRef<CommandRegistry>(new CommandRegistry());

  useEffect(() => {
    let cancelled = false;

    const discover = async (): Promise<void> => {
      setLoading(true);
      const registry = new CommandRegistry();
      const result = await registry.discoverFromConfig(appsConfig);

      if (!cancelled) {
        registryRef.current = registry;
        setCommands(result.commands);
        setErrors(result.errors);
        setLoading(false);
      }
    };

    discover();

    return () => {
      cancelled = true;
    };
  }, [appsConfig]);

  const findCommand = useCallback(
    (name: string): CommandDefinition | undefined =>
      registryRef.current.findCommand(name),
    [],
  );

  const commandHint = useCallback(
    (partialInput: string): CommandHintResult[] =>
      registryRef.current.commandHint(partialInput),
    [],
  );

  const getCommandsByScope = useCallback(
    (scope: string): CommandDefinition[] =>
      registryRef.current.getCommandsByScope(scope),
    [],
  );

  return { commands, loading, errors, findCommand, commandHint, getCommandsByScope };
}
