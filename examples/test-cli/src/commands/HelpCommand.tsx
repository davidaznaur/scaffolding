import React from 'react';
import { Box, Text } from 'ink';
import type { CommandDefinition } from './types';

interface HelpCommandProps {
  commands: CommandDefinition[];
  builtins: Array<{ name: string; description: string }>;
}

export function HelpCommand({ commands, builtins }: HelpCommandProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      <Text bold color="yellow">Built-in Commands:</Text>
      {builtins.map((cmd) => (
        <Box key={cmd.name} marginLeft={2}>
          <Text color="green">{cmd.name.padEnd(20)}</Text>
          <Text color="gray">{cmd.description}</Text>
        </Box>
      ))}
      <Text />
      <Text bold color="yellow">Plugin Commands:</Text>
      {commands.length === 0 ? (
        <Box marginLeft={2}>
          <Text color="gray">No plugin commands loaded</Text>
        </Box>
      ) : (
        commands.map((cmd) => (
          <Box key={cmd.name} marginLeft={2}>
            <Text color="green">{cmd.name.padEnd(20)}</Text>
            <Text color="gray">{cmd.description}</Text>
            <Text color="gray" dimColor> [{cmd.scope}]</Text>
          </Box>
        ))
      )}
    </Box>
  );
}
