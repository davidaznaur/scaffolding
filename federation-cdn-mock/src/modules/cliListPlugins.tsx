import React, { useEffect, useState } from 'react';
import { getCliCommands, hasCapability } from '@scalprum/core';
import type { PluginManifest } from '@openshift/dynamic-plugin-sdk';

interface PluginCommandProps {
  args: string[];
  onOutput: (text: string, color?: string) => void;
  onComplete: () => void;
  appsConfig: Record<string, { name: string; manifestLocation?: string; [key: string]: unknown }>;
}

/**
 * Federated CLI module that lists all registered plugins and their capabilities.
 * Receives appsConfig via props (injected by the host shell), then uses
 * getCliCommands / hasCapability to introspect each manifest.
 * Same pattern as usePlugins, running inside a dynamically loaded module.
 */
const CliListPlugins = ({ args, onOutput, onComplete, appsConfig }: PluginCommandProps): React.ReactElement | null => {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const run = async (): Promise<void> => {
      try {
        const scopes = Object.keys(appsConfig);
        const verbose = args.includes('--verbose') || args.includes('-v');

        onOutput(`Registered Plugins (${scopes.length}):`, 'yellow');
        onOutput('', undefined);

        for (const scope of scopes) {
          const entry = appsConfig[scope];
          onOutput(`  ${scope}`, 'cyan');
          onOutput(`    manifest: ${entry.manifestLocation ?? 'inline'}`, 'gray');

          if (entry.manifestLocation) {
            try {
              const response = await fetch(entry.manifestLocation, { cache: 'no-cache' });
              if (response.ok) {
                const manifest: PluginManifest = await response.json();
                const isWeb = hasCapability(manifest, 'web');
                const isCli = hasCapability(manifest, 'cli');
                const capabilities = [isWeb ? 'web' : null, isCli ? 'cli' : null]
                  .filter(Boolean)
                  .join(', ');
                onOutput(`    capabilities: ${capabilities || 'none declared'}`, 'green');

                const commands = getCliCommands(manifest);
                if (commands.length > 0) {
                  onOutput(`    cli commands (${commands.length}):`, 'yellow');
                  for (const cmd of commands) {
                    const argList = (cmd.arguments ?? [])
                      .map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`))
                      .join(' ');
                    onOutput(`      ${cmd.name} ${argList}`, 'green');
                    if (verbose && cmd.description) {
                      onOutput(`        ${cmd.description}`, 'gray');
                    }
                  }
                }

                if (verbose && 'loadScripts' in manifest) {
                  const scripts = (manifest as any).loadScripts as string[];
                  onOutput(`    entry scripts: ${scripts.join(', ')}`, 'gray');
                }
              } else {
                onOutput(`    manifest fetch failed: ${response.status}`, 'red');
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              onOutput(`    error reading manifest: ${msg}`, 'red');
            }
          }
          onOutput('', undefined);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        onOutput(`Error: ${msg}`, 'red');
      }
      setDone(true);
      onComplete();
    };

    run();
  }, [args, appsConfig, onOutput, onComplete]);

  return done ? null : null;
};

export default CliListPlugins;
