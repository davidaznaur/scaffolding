import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { getModule } from '@scalprum/core';
import type { PluginCommandProps } from './types';

interface DynamicCommandProps {
  scope: string;
  module: string;
  args: string[];
  onOutput: (text: string, color?: string) => void;
  onComplete: () => void;
}

/**
 * Loads and renders a plugin command component from a federated remote.
 * The remote module is expected to export a React component (Ink-compatible)
 * as its default export.
 */
export function DynamicCommand({
  scope,
  module,
  args,
  onOutput,
  onComplete,
}: DynamicCommandProps): React.ReactElement {
  const [Component, setComponent] = useState<React.ComponentType<PluginCommandProps> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadCommand = async (): Promise<void> => {
      try {
        const mod = await getModule<React.ComponentType<PluginCommandProps>>(scope, module);
        if (isMounted) {
          setComponent(() => mod);
          setLoading(false);
        }
      } catch (err) {
        console.error('[DynamicCommand] Load failed:', err);
        if (isMounted) {
          const message = err instanceof Error ? err.message : String(err);
          const stack = err instanceof Error ? err.stack : '';
          setError(message);
          setLoading(false);
          onOutput(`Error loading command: ${message}`, 'red');
          if (stack) {
            onOutput(stack, 'gray');
          }
          onComplete();
        }
      }
    };

    loadCommand();

    return () => {
      isMounted = false;
    };
  }, [scope, module]);

  if (loading) {
    return (
      <Box>
        <Text color="yellow">⏳ Loading plugin command from {scope}...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Text color="red">✗ Failed to load: {error}</Text>
      </Box>
    );
  }

  if (!Component) {
    return (
      <Box>
        <Text color="red">✗ No component found in {scope}/{module}</Text>
      </Box>
    );
  }

  return <Component args={args} onOutput={onOutput} />;
}
