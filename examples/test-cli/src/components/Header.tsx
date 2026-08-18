import React from 'react';
import { Box, Text } from 'ink';

export function Header(): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="magenta">
        {'╔══════════════════════════════════════════════╗'}
      </Text>
      <Text bold color="magenta">
        {'║    OME CLI Shell — Plugin System v2     ║'}
      </Text>
      <Text bold color="magenta">
        {'╚══════════════════════════════════════════════╝'}
      </Text>
      <Text color="gray">Type &quot;help&quot; for commands, &lt;tab&gt; for hints, &quot;exit&quot; to quit</Text>
    </Box>
  );
}
