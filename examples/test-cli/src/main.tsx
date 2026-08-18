#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';

import { MFRuntimeLoader } from '@scalprum/core';
import type { AppsConfig } from '@scalprum/core';
import nodeRemoteLoader from '@scalprum/core/nodePlugin';

import { App } from './App';

const PLUGIN_SCOPES = [
  {
    scope: 'sdk-plugin',
    manifestLocation: 'http://127.0.0.1:8001/plugin-manifest.json',
  },
];

function createConfig(): { appsConfig: AppsConfig; loader: MFRuntimeLoader } {
  const loader = new MFRuntimeLoader({
    hostName: 'test_cli2',
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
    PLUGIN_SCOPES.map((s) => [
      s.scope,
      { name: s.scope, manifestLocation: s.manifestLocation },
    ]),
  );

  return { appsConfig, loader };
}

function main(): void {
  const { appsConfig, loader } = createConfig();
  render(<App appsConfig={appsConfig} loader={loader} />);
}

main();
