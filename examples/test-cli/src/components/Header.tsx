import React from 'react';
import { Box, Text } from 'ink';

export function Header(): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="magenta">
        ╔══════════════════════════════════════════════╗
      </Text>
      <Text bold color="magenta">
        ║   Scalprum CLI Shell - Dynamic Plugin Demo   ║
      </Text>
      <Text bold color="magenta">
        ╚══════════════════════════════════════════════╝
      </Text>
      <Text color="gray">Type &quot;help&quot; for available commands, &quot;exit&quot; to quit</Text>
    </Box>
  );
}
