import React, { useState, useCallback } from 'react';
import { Box, Text, useApp } from 'ink';

import { ScalprumProvider } from '@scalprum/react-core';
import type { MFRuntimeLoader, AppsConfig } from '@scalprum/core';

import { Header } from './components/Header';
import { ShellInput, ShellOutput, useShellOutput } from './components/Shell';
import { CommandRunner } from './components/CommandRunner';
import { usePlugins } from './hooks/usePlugins';
import type { CommandHintResult } from './types';

interface AppProps {
  appsConfig: AppsConfig;
  loader: MFRuntimeLoader;
}

const BUILTIN_COMMANDS = [
  { name: 'help', description: 'Show available commands' },
  { name: 'plugins', description: 'List registered plugins and their scopes' },
  { name: 'hint', description: 'Show hints for a command: hint <partial>' },
  { name: 'clear', description: 'Clear the output' },
  { name: 'exit', description: 'Exit the CLI' },
];

export function App({ appsConfig, loader }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const { lines, addOutput, clearOutput } = useShellOutput();
  const { commands, loading, errors, findCommand, commandHint, getCommandsByScope } =
    usePlugins(appsConfig);

  const [activeCommand, setActiveCommand] = useState<{
    scope: string;
    module: string;
    args: string[];
  } | null>(null);

  const handleHintRequest = useCallback(
    (partial: string): CommandHintResult[] => {
      const pluginHints = commandHint(partial);

      const builtinHints: CommandHintResult[] = BUILTIN_COMMANDS
        .filter((b) => b.name.startsWith(partial.split(' ')[0]))
        .map((b) => ({
          command: { name: b.name, description: b.description, scope: 'builtin', module: '' },
          usage: b.name,
          remainingArgs: [],
          availableOptions: [],
        }));

      return [...builtinHints, ...pluginHints];
    },
    [commandHint],
  );

  const handleCommandComplete = useCallback(() => {
    setActiveCommand(null);
  }, []);

  const handleSubmit = useCallback(
    (input: string) => {
      const [cmd, ...args] = input.split(' ');
      setActiveCommand(null);
      addOutput(`> ${input}`, 'gray');

      switch (cmd) {
        case 'help': {
          addOutput('');
          addOutput('Built-in Commands:', 'yellow');
          for (const b of BUILTIN_COMMANDS) {
            addOutput(`  ${b.name.padEnd(20)} ${b.description}`, 'green');
          }
          addOutput('');
          addOutput('Plugin Commands:', 'yellow');
          if (commands.length === 0) {
            addOutput('  No plugin commands discovered', 'gray');
          } else {
            for (const c of commands) {
              const hints = commandHint(c.name);
              const usage = hints[0]?.usage ?? c.name;
              addOutput(`  ${usage.padEnd(35)} ${c.description}`, 'green');
            }
          }
          addOutput('');
          break;
        }

        case 'plugins': {
          addOutput('');
          const scopes = Object.keys(appsConfig);
          addOutput(`Registered Scopes (${scopes.length}):`, 'yellow');
          for (const scope of scopes) {
            const config = appsConfig[scope];
            const scopeCmds = getCommandsByScope(scope);
            addOutput(`  ${scope}`, 'cyan');
            addOutput(`    manifest: ${config.manifestLocation ?? 'inline'}`, 'gray');
            addOutput(
              `    commands: ${scopeCmds.length > 0 ? scopeCmds.map((c) => c.name).join(', ') : 'none'}`,
              'gray',
            );
          }
          addOutput('');
          break;
        }

        case 'hint': {
          const partial = args.join(' ');
          if (!partial) {
            addOutput('Usage: hint <partial-command>', 'yellow');
            break;
          }
          const hints = commandHint(partial);
          if (hints.length === 0) {
            addOutput(`No matches for "${partial}"`, 'gray');
          } else {
            for (const h of hints) {
              addOutput(`  ${h.usage}`, 'yellow');
              addOutput(`    ${h.command.description}`, 'gray');
              if (h.remainingArgs.length > 0) {
                addOutput(
                  `    args: ${h.remainingArgs.map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`)).join(' ')}`,
                  'gray',
                );
              }
              if (h.availableOptions.length > 0) {
                addOutput(
                  `    opts: ${h.availableOptions.map((o) => `--${o.name}`).join(' ')}`,
                  'gray',
                );
              }
            }
          }
          break;
        }

        case 'clear':
          clearOutput();
          break;

        case 'exit':
        case 'quit':
          addOutput('Goodbye!', 'magenta');
          setTimeout(() => exit(), 100);
          break;

        default: {
          const pluginCmd = findCommand(cmd);
          if (pluginCmd) {
            addOutput(`Running: ${pluginCmd.name} [${pluginCmd.scope}]`, 'cyan');
            setActiveCommand({
              scope: pluginCmd.scope,
              module: pluginCmd.module,
              args,
            });
          } else {
            addOutput(`Unknown command: "${cmd}". Type "help" or press <tab> for hints.`, 'red');
          }
          break;
        }
      }
    },
    [commands, addOutput, clearOutput, exit, findCommand, commandHint, getCommandsByScope, appsConfig],
  );

  return (
    <ScalprumProvider config={appsConfig} loader={loader}>
      <Box flexDirection="column" padding={1}>
        <Header />

        {loading && <Text color="yellow">Discovering plugins...</Text>}

        {errors.length > 0 && (
          <Box flexDirection="column">
            {errors.map((err, i) => (
              <Text key={i} color="red">
                [{err.scope}] {err.error}
              </Text>
            ))}
          </Box>
        )}

        <ShellOutput lines={lines} />

        {activeCommand && (
          <CommandRunner
            scope={activeCommand.scope}
            module={activeCommand.module}
            args={activeCommand.args}
            appsConfig={appsConfig}
            onOutput={addOutput}
            onComplete={handleCommandComplete}
          />
        )}

        <ShellInput
          onSubmit={handleSubmit}
          onHintRequest={handleHintRequest}
          prompt="ome"
          disabled={loading}
        />
      </Box>
    </ScalprumProvider>
  );
}
