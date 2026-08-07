import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

export interface CommandInputProps {
  onSubmit: (input: string) => void;
  prompt?: string;
  disabled?: boolean;
}

export function CommandInput({ onSubmit, prompt = '>', disabled = false }: CommandInputProps): React.ReactElement {
  const [value, setValue] = useState('');

  useInput((input, key) => {
    if (disabled) return;

    if (key.return) {
      const trimmed = value.trim();
      if (trimmed) {
        onSubmit(trimmed);
      }
      setValue('');
      return;
    }

    if (key.backspace || key.delete) {
      setValue((prev) => prev.slice(0, -1));
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      setValue((prev) => prev + input);
    }
  });

  return (
    <Box>
      <Text color="cyan" bold>{prompt} </Text>
      <Text>{value}</Text>
      <Text color="gray">█</Text>
    </Box>
  );
}

export interface OutputLine {
  id: string;
  text: string;
  color?: string;
}

export interface CommandOutputProps {
  lines: OutputLine[];
  maxLines?: number;
}

export function CommandOutput({ lines, maxLines = 20 }: CommandOutputProps): React.ReactElement {
  const visibleLines = lines.slice(-maxLines);

  return (
    <Box flexDirection="column">
      {visibleLines.map((line) => (
        <Text key={line.id} color={line.color as any}>{line.text}</Text>
      ))}
    </Box>
  );
}
