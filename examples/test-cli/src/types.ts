import type { ScalprumCommandArgument, ScalprumCommandOption } from '@scalprum/core';

/** Props contract for any federated CLI command component. */
export interface PluginCommandProps {
  args: string[];
  onOutput: (text: string, color?: string) => void;
  onComplete: () => void;
  /** Injected scalprum apps config — avoids relying on shared context across federation boundaries. */
  appsConfig: Record<string, { name: string; manifestLocation?: string; [key: string]: unknown }>;
}

/** A resolved command registered from a plugin manifest. */
export interface CommandDefinition {
  name: string;
  description: string;
  scope: string;
  module: string;
  arguments?: ScalprumCommandArgument[];
  options?: ScalprumCommandOption[];
}

/** Result of matching partial input against available commands. */
export interface CommandHintResult {
  command: CommandDefinition;
  /** Formatted usage string: "command-name <required> [optional]" */
  usage: string;
  /** Remaining arguments the user hasn't typed yet */
  remainingArgs: ScalprumCommandArgument[];
  /** Available option flags */
  availableOptions: ScalprumCommandOption[];
}

/** Output line rendered in the shell. */
export interface OutputLine {
  id: string;
  text: string;
  color?: string;
}
