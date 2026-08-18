import React, { useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import type { AppsConfig } from '@scalprum/core';
import { useCommandLoader } from '../hooks/useCommandLoader';

interface CommandRunnerProps {
  scope: string;
  module: string;
  args: string[];
  appsConfig: AppsConfig;
  onOutput: (text: string, color?: string) => void;
  onComplete: () => void;
}

/**
 * Thin Ink wrapper that uses useCommandLoader to load a federated command,
 * then renders it. All logic lives in the hook; this component only provides
 * the visual loading/error/success states.
 */
export function CommandRunner({
  scope,
  module,
  args,
  appsConfig,
  onOutput,
  onComplete,
}: CommandRunnerProps): React.ReactElement {
  const { Component, loading, error } = useCommandLoader(scope, module);
  const completedRef = useRef(false);

  useEffect(() => {
    if (error && !completedRef.current) {
      completedRef.current = true;
      onOutput(`Error loading ${scope}/${module}: ${error}`, 'red');
      onComplete();
    }
  }, [error, scope, module, onOutput, onComplete]);

  if (loading) {
    return (
      <Box>
        <Text color="yellow">Loading {scope}/{module}...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Text color="red">Failed: {error}</Text>
      </Box>
    );
  }

  if (!Component) {
    return (
      <Box>
        <Text color="red">No component found in {scope}/{module}</Text>
      </Box>
    );
  }

  return <Component args={args} appsConfig={appsConfig} onOutput={onOutput} onComplete={onComplete} />;
}
