import React, { useEffect, useState } from 'react';

interface PluginCommandProps {
  args: string[];
  onOutput: (text: string, color?: string) => void;
  onComplete: () => void;
}

/**
 * A CLI-compatible federated module.
 * Uses only React (shared) — no DOM, no browser APIs, no UI framework.
 * Communicates with the host CLI via the onOutput callback.
 */
const CliGreet = ({ args, onOutput, onComplete }: PluginCommandProps): React.ReactElement | null => {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const name = args[0] || 'World';
    onOutput(`Hello, ${name}!`, 'green');
    onOutput(`This message comes from a dynamically loaded federated module.`, 'cyan');
    onOutput(`Received args: [${args.join(', ')}]`, 'gray');
    onOutput(`Timestamp: ${new Date().toISOString()}`, 'gray');
    setDone(true);
    onComplete();
  }, [args, onOutput, onComplete]);

  if (!done) {
    return null;
  }

  return null;
};

export default CliGreet;
