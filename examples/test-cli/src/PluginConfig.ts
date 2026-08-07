import { MFRuntimeLoader } from '@scalprum/core';
import type { AppsConfig } from '@scalprum/core';
import nodeRemoteLoader from '@scalprum/core/nodePlugin';
import type { PluginSource } from './commands/types';
import React from 'react';

export interface PluginConfig {
  appsConfig: AppsConfig;
  loader: MFRuntimeLoader;
  pluginSources: PluginSource[];
}

const PLUGIN_SOURCES: PluginSource[] = [
  {
    scope: 'sdk-plugin',
    manifestLocation: 'http://127.0.0.1:8001/plugin-manifest.json',
    cliManifestLocation: 'http://127.0.0.1:8001/cli-manifest.json',
  },
];

export function createPluginConfig(): PluginConfig {
  const loader = new MFRuntimeLoader({
    hostName: 'test_cli',
    runtimePlugins: [nodeRemoteLoader()],
    shared: {
      react: {
        version: '18.3.1',
        scope: 'default',
        lib: () => React,
        shareConfig: { singleton: true, requiredVersion: '^18.0.0' },
      },
    },
  });

  const appsConfig: AppsConfig = Object.fromEntries(
    PLUGIN_SOURCES.map((source) => [
      source.scope,
      { name: source.scope, manifestLocation: source.manifestLocation },
    ]),
  );

  return { appsConfig, loader, pluginSources: PLUGIN_SOURCES };
}
