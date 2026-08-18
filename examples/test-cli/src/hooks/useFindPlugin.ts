import { useMemo } from 'react';
import type { CommandDefinition, CommandHintResult } from '../types';

export interface UseFindPluginResult {
  /** The matched command, or undefined if not found */
  command: CommandDefinition | undefined;
  /** Usage hint for the matched command */
  hint: CommandHintResult | undefined;
}

/**
 * Finds a specific plugin command by name from the discovered commands list.
 * Also returns the usage hint for that command if found.
 *
 * This hook contains no UI framework dependencies (no Ink, no DOM).
 */
export function useFindPlugin(
  name: string,
  commands: CommandDefinition[],
  commandHint: (input: string) => CommandHintResult[],
): UseFindPluginResult {
  return useMemo(() => {
    const command = commands.find((cmd) => cmd.name === name);
    const hints = command ? commandHint(name) : [];
    const hint = hints[0];
    return { command, hint };
  }, [name, commands, commandHint]);
}
