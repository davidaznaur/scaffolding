import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import type { OutputLine, CommandHintResult } from '../types';

interface ShellInputProps {
  onSubmit: (input: string) => void;
  onHintRequest: (partial: string) => CommandHintResult[];
  prompt?: string;
  disabled?: boolean;
}

export function ShellInput({
  onSubmit,
  onHintRequest,
  prompt = '>',
  disabled = false,
}: ShellInputProps): React.ReactElement {
  const [value, setValue] = useState('');
  const [hints, setHints] = useState<CommandHintResult[]>([]);
  const [selectedHint, setSelectedHint] = useState(-1);
  const [inlineGhost, setInlineGhost] = useState('');

  const updateGhost = useCallback(
    (input: string, currentHints: CommandHintResult[]) => {
      if (!input.trim() || currentHints.length === 0) {
        setInlineGhost('');
        return;
      }
      const best = currentHints[0];
      const bestName = best.command.name;
      const trimmed = input.trim();
      setInlineGhost(
        bestName.startsWith(trimmed) ? bestName.slice(trimmed.length) : '',
      );
    },
    [],
  );

  useInput((input, key) => {
    if (disabled) return;

    if (key.return) {
      const trimmed = value.trim();
      if (trimmed) {
        onSubmit(trimmed);
      }
      setValue('');
      setHints([]);
      setSelectedHint(-1);
      setInlineGhost('');
      return;
    }

    if (key.tab) {
      const currentHints =
        hints.length > 0 ? hints : onHintRequest(value.trim());

      if (currentHints.length === 0) return;

      if (currentHints.length === 1) {
        const completed = currentHints[0].usage.split(' ')[0] + ' ';
        setValue(completed);
        setHints([]);
        setSelectedHint(-1);
        setInlineGhost('');
        return;
      }

      setHints(currentHints);
      const nextIndex = (selectedHint + 1) % currentHints.length;
      setSelectedHint(nextIndex);
      const selected = currentHints[nextIndex];
      setValue(selected.command.name + ' ');
      setInlineGhost('');
      return;
    }

    if (key.backspace || key.delete) {
      setValue((prev) => {
        const next = prev.slice(0, -1);
        const trimmed = next.trim();
        if (trimmed) {
          const newHints = onHintRequest(trimmed);
          setHints(newHints);
          updateGhost(trimmed, newHints);
        } else {
          setHints([]);
          setInlineGhost('');
        }
        setSelectedHint(-1);
        return next;
      });
      return;
    }

    if (key.escape) {
      setHints([]);
      setSelectedHint(-1);
      setInlineGhost('');
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      const next = value + input;
      setValue(next);
      setSelectedHint(-1);

      const trimmed = next.trim();
      if (trimmed) {
        const newHints = onHintRequest(trimmed);
        setHints(newHints);
        updateGhost(trimmed, newHints);
      } else {
        setHints([]);
        setInlineGhost('');
      }
    }
  });

  return (
    <Box flexDirection="column">
      {hints.length > 0 && (
        <Box flexDirection="column" marginBottom={0}>
          {hints.map((hint, i) => (
            <Box key={hint.command.name} marginLeft={2}>
              <Text
                color={i === selectedHint ? 'cyan' : 'yellow'}
                bold={i === selectedHint}
              >
                {i === selectedHint ? '> ' : '  '}
                {hint.usage}
              </Text>
              <Text color="gray" dimColor>
                {'  '}
                {hint.command.description}
              </Text>
            </Box>
          ))}
        </Box>
      )}
      <Box>
        <Text color="cyan" bold>
          {prompt}{' '}
        </Text>
        <Text>{value}</Text>
        <Text color="gray" dimColor>
          {inlineGhost}
        </Text>
        <Text color="gray">█</Text>
      </Box>
    </Box>
  );
}

interface ShellOutputProps {
  lines: OutputLine[];
  maxLines?: number;
}

export function ShellOutput({
  lines,
  maxLines = 30,
}: ShellOutputProps): React.ReactElement {
  const visibleLines = lines.slice(-maxLines);

  return (
    <Box flexDirection="column">
      {visibleLines.map((line) => (
        <Text key={line.id} color={line.color as any}>
          {line.text}
        </Text>
      ))}
    </Box>
  );
}

export function useShellOutput(): {
  lines: OutputLine[];
  addOutput: (text: string, color?: string) => void;
  clearOutput: () => void;
} {
  const [lines, setLines] = useState<OutputLine[]>([]);
  const [counter, setCounter] = useState(0);

  const addOutput = useCallback((text: string, color?: string) => {
    setCounter((prev) => {
      const id = `line-${prev}`;
      setLines((existing) => [...existing, { id, text, color }]);
      return prev + 1;
    });
  }, []);

  const clearOutput = useCallback(() => {
    setLines([]);
  }, []);

  return { lines, addOutput, clearOutput };
}
