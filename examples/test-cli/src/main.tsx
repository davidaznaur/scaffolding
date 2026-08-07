#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './App';
import { createPluginConfig } from './PluginConfig';
import { CommandRegistry } from './services/CommandRegistry';

async function main(): Promise<void> {
  const { appsConfig, loader, pluginSources } = createPluginConfig();

  const registry = new CommandRegistry();
  const { commands, errors } = await registry.discover(pluginSources);

  for (const err of errors) {
    console.error(`[plugin:${err.scope}] ${err.error}`);
  }

  render(<App appsConfig={appsConfig} loader={loader} commands={commands} />);
}

main();
