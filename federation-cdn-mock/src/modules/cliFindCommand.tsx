import React, { useEffect, useState } from 'react';
import { getCliCommands } from '@scalprum/core';
import type { ScalprumCommandEntry } from '@scalprum/core';
import type { PluginManifest } from '@openshift/dynamic-plugin-sdk';

interface PluginCommandProps {
  args: string[];
  onOutput: (text: string, color?: string) => void;
  onComplete: () => void;
  appsConfig: Record<string, { name: string; manifestLocation?: string; [key: string]: unknown }>;
}

/**
 * Federated CLI module that finds and inspects a specific command across all plugins.
 * Receives appsConfig via props (injected by the host shell), then uses
 * getCliCommands to search manifests — same pattern as useFindPlugin.
 */
const CliFindCommand = ({ args, onOutput, onComplete, appsConfig }: PluginCommandProps): React.ReactElement | null => {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const run = async (): Promise<void> => {
      const searchName = args[0];
      if (!searchName) {
        onOutput('Usage: find-command <name>', 'yellow');
        onOutput('  Searches all plugin manifests for a CLI command by name.', 'gray');
        onOutput('  Supports partial matching.', 'gray');
        onComplete();
        setDone(true);
        return;
      }

      try {
        const scopes = Object.keys(appsConfig);
        const matches: Array<{ scope: string; command: ScalprumCommandEntry }> = [];

        for (const scope of scopes) {
          const entry = appsConfig[scope];
          if (!entry.manifestLocation) continue;

          try {
            const response = await fetch(entry.manifestLocation, { cache: 'no-cache' });
            if (!response.ok) continue;
            const manifest: PluginManifest = await response.json();
            const commands = getCliCommands(manifest);

            for (const cmd of commands) {
              if (cmd.name === searchName || cmd.name.includes(searchName)) {
                matches.push({ scope, command: cmd });
              }
            }
          } catch {
            // skip scopes with unreachable manifests
          }
        }

        if (matches.length === 0) {
          onOutput(`No commands matching "${searchName}" found.`, 'red');
          onComplete();
          setDone(true);
          return;
        }

        onOutput(`Found ${matches.length} match(es) for "${searchName}":`, 'yellow');
        onOutput('', undefined);

        for (const { scope, command } of matches) {
          onOutput(`  ${command.name}`, 'cyan');
          onOutput(`    scope:       ${scope}`, 'gray');
          onOutput(`    module:      ${command.module}`, 'gray');
          onOutput(`    description: ${command.description}`, 'green');

          const cmdArgs = command.arguments ?? [];
          if (cmdArgs.length > 0) {
            onOutput('    arguments:', 'yellow');
            for (const arg of cmdArgs) {
              const req = arg.required ? 'required' : 'optional';
              const def = arg.default ? `, default: "${arg.default}"` : '';
              onOutput(`      <${arg.name}> (${req}${def})`, 'gray');
              if (arg.description) {
                onOutput(`        ${arg.description}`, 'gray');
              }
            }
          }

          const cmdOpts = command.options ?? [];
          if (cmdOpts.length > 0) {
            onOutput('    options:', 'yellow');
            for (const opt of cmdOpts) {
              const alias = opt.alias ? ` | -${opt.alias}` : '';
              const def = opt.default !== undefined ? `, default: ${JSON.stringify(opt.default)}` : '';
              onOutput(`      --${opt.name}${alias} (${opt.type}${def})`, 'gray');
              if (opt.description) {
                onOutput(`        ${opt.description}`, 'gray');
              }
            }
          }
          onOutput('', undefined);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        onOutput(`Error: ${msg}`, 'red');
      }
      onComplete();
      setDone(true);
    };

    run();
  }, [args, appsConfig, onOutput, onComplete]);

  return done ? null : null;
};

export default CliFindCommand;
