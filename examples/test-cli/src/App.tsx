import React, { useState, useCallback } from 'react';
import { Box, Text, useApp } from 'ink';
import { ScalprumProvider } from '@scalprum/react-core';
import { MFRuntimeLoader } from '@scalprum/core';
import type { AppsConfig } from '@scalprum/core';

import { Header } from './components/Header';
import { CommandInput, CommandOutput, OutputLine } from './components/Shell';
import { HelpCommand } from './commands/HelpCommand';
import { ListPluginsCommand } from './commands/ListPluginsCommand';
import { DynamicCommand } from './commands/DynamicCommand';
import type { CommandDefinition } from './commands/types';

interface AppProps {
  appsConfig: AppsConfig;
  loader: MFRuntimeLoader;
  commands: CommandDefinition[];
}

const BUILTIN_COMMANDS = [
  { name: 'help', description: 'Show available commands' },
  { name: 'plugins', description: 'List registered plugins and their status' },
  { name: 'load', description: 'Load a remote module: load <scope> <module>' },
  { name: 'clear', description: 'Clear the output' },
  { name: 'exit', description: 'Exit the CLI' },
];

export function App({ appsConfig, loader, commands }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const [outputLines, setOutputLines] = useState<OutputLine[]>([]);
  const [activeCommand, setActiveCommand] = useState<{
    scope: string;
    module: string;
    args: string[];
  } | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showPlugins, setShowPlugins] = useState(false);
  const [lineCounter, setLineCounter] = useState(0);

  const addOutput = useCallback((text: string, color?: string) => {
    setLineCounter((prev) => {
      const id = `line-${prev}`;
      setOutputLines((lines) => [...lines, { id, text, color }]);
      return prev + 1;
    });
  }, []);

  const handleCommand = useCallback((input: string) => {
    const [cmd, ...args] = input.split(' ');
    setShowHelp(false);
    setShowPlugins(false);
    setActiveCommand(null);

    addOutput(`> ${input}`, 'gray');

    switch (cmd) {
      case 'help':
        setShowHelp(true);
        break;

      case 'plugins':
        setShowPlugins(true);
        break;

      case 'clear':
        setOutputLines([]);
        break;

      case 'exit':
      case 'quit':
        addOutput('Goodbye!', 'magenta');
        setTimeout(() => exit(), 100);
        break;

      case 'load': {
        const [scope, module] = args;
        if (!scope || !module) {
          addOutput('Usage: load <scope> <module>', 'yellow');
          addOutput('Example: load sdk-plugin ./ModuleOne', 'gray');
          break;
        }
        addOutput(`Loading ${scope}/${module}...`, 'cyan');
        setActiveCommand({ scope, module, args: args.slice(2) });
        break;
      }

      default: {
        const pluginCmd = commands.find((c) => c.name === cmd);
        if (pluginCmd) {
          addOutput(`Running plugin command: ${pluginCmd.name}`, 'cyan');
          setActiveCommand({
            scope: pluginCmd.scope,
            module: pluginCmd.module,
            args,
          });
        } else {
          addOutput(`Unknown command: "${cmd}". Type "help" for available commands.`, 'red');
        }
        break;
      }
    }
  }, [addOutput, exit, commands]);

  const handleCommandComplete = useCallback(() => {
    setActiveCommand(null);
  }, []);

  return (
    <ScalprumProvider config={appsConfig} loader={loader}>
      <Box flexDirection="column" padding={1}>
        <Header />
        <CommandOutput lines={outputLines} />

        {showHelp && (
          <HelpCommand commands={commands} builtins={BUILTIN_COMMANDS} />
        )}

        {showPlugins && <ListPluginsCommand />}

        {activeCommand && (
          <DynamicCommand
            scope={activeCommand.scope}
            module={activeCommand.module}
            args={activeCommand.args}
            onOutput={addOutput}
            onComplete={handleCommandComplete}
          />
        )}

        <CommandInput
          onSubmit={handleCommand}
          prompt="scalprum"
          disabled={false}
        />
      </Box>
    </ScalprumProvider>
  );
}
