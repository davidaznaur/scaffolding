import React from 'react';
import { Box, Text } from 'ink';
import { useScalprum } from '@scalprum/react-core';

export function ListPluginsCommand(): React.ReactElement {
  const { config, initialized } = useScalprum();
  const plugins = Object.entries(config);

  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      <Text bold color="yellow">Registered Plugins ({plugins.length}):</Text>
      <Text color="gray">Initialized: {initialized ? 'yes' : 'no'}</Text>
      <Text />
      {plugins.map(([key, plugin]) => (
        <Box key={key} marginLeft={2} flexDirection="column">
          <Text color="cyan" bold>{plugin.name}</Text>
          <Box marginLeft={2}>
            <Text color="gray">
              manifest: {plugin.manifestLocation ?? 'inline'}
            </Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
