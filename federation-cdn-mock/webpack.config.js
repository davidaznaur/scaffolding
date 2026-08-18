const { resolve } = require('path');
const { ModuleFederationPlugin, ContainerPlugin } = require('@module-federation/enhanced');
const { DynamicRemotePlugin } = require('@openshift/dynamic-plugin-sdk-webpack');

console.log('Entry tests:', resolve(__dirname, './src/modules/moduleOne.tsx'));

const sharedModules = {
  react: {
    singleton: true,
    requiredVersion: '*',
    version: '18.2.0',
  },
  'react-dom': {
    singleton: true,
    requiredVersion: '*',
    version: '18.2.0',
  },
  '@scalprum/core': {
    singleton: true,
    requiredVersion: '*',
  },
  '@scalprum/react-core': {
    singleton: true,
    requiredVersion: '*',
  },
  '@openshift/dynamic-plugin-sdk': {
    singleton: true,
    requiredVersion: '*',
  },
};

const TestSDKPlugin = new DynamicRemotePlugin({
  extensions: [],
  sharedModules,
  entryScriptFilename: 'sdk-plugin.[contenthash].js',
  moduleFederationSettings: {
    // Use non native webpack plugins
    pluginOverride: {
      ModuleFederationPlugin,
      ContainerPlugin,
    },
  },
  pluginMetadata: {
    name: 'sdk-plugin',
    version: '1.0.0',
    exposedModules: {
      './ModuleOne': resolve(__dirname, './src/modules/moduleOne.tsx'),
      './ModuleTwo': resolve(__dirname, './src/modules/moduleTwo.tsx'),
      './ModuleThree': resolve(__dirname, './src/modules/moduleThree.tsx'),
      './ErrorModule': resolve(__dirname, './src/modules/errorModule.tsx'),
      './PreLoadedModule': resolve(__dirname, './src/modules/preLoad.tsx'),
      './NestedModule': resolve(__dirname, './src/modules/nestedModule.tsx'),
      './ModuleThree': resolve(__dirname, './src/modules/moduleThree.tsx'),
      './ModuleFour': resolve(__dirname, './src/modules/moduleFour.tsx'),
      './SDKComponent': resolve(__dirname, './src/modules/SDKComponent.tsx'),
      './ApiModule': resolve(__dirname, './src/modules/apiModule.tsx'),
      './DelayedModule': resolve(__dirname, './src/modules/delayedModule.tsx'),
      './CliGreet': resolve(__dirname, './src/modules/cliGreet.tsx'),
      './CliListPlugins': resolve(__dirname, './src/modules/cliListPlugins.tsx'),
      './CliFindCommand': resolve(__dirname, './src/modules/cliFindCommand.tsx'),
      './useCounterHook': resolve(__dirname, './src/modules/useCounterHook.tsx'),
      './useApiHook': resolve(__dirname, './src/modules/useApiHook.tsx'),
      './useTimerHook': resolve(__dirname, './src/modules/useTimerHook.tsx'),
      './useSharedStoreHook': resolve(__dirname, './src/modules/useSharedStoreHook.tsx'),
    },
    customProperties: {
      scalprum: {
        capabilities: ['web', 'cli'],
        cli: {
          commands: [
            {
              name: 'cli-greet',
              description: 'Greet from a federated CLI module',
              module: './CliGreet',
              arguments: [
                { name: 'name', required: false, default: 'World', description: 'Name to greet' },
              ],
            },
            {
              name: 'list-plugins',
              description: 'List all registered plugins, capabilities, and CLI commands',
              module: './CliListPlugins',
              options: [
                { name: 'verbose', alias: 'v', type: 'boolean', default: false, description: 'Show descriptions and entry scripts' },
              ],
            },
            {
              name: 'find-command',
              description: 'Find and inspect a CLI command by name (supports partial match)',
              module: './CliFindCommand',
              arguments: [
                { name: 'name', required: true, description: 'Command name or partial name to search for' },
              ],
            },
          ],
        },
      },
    },
  }
});

const FullManifest = new DynamicRemotePlugin({
  extensions: [],
  sharedModules,
  pluginManifestFilename: 'full-manifest.json',
  entryScriptFilename: 'full-manifest.js',
  moduleFederationSettings: {
    // Use non native webpack plugins
    pluginOverride: {
      ModuleFederationPlugin,
      ContainerPlugin,
    },
  },
  pluginMetadata: {
    name: 'full-manifest',
    version: '1.0.0',
    exposedModules: {
      './SDKComponent': resolve(__dirname, './src/modules/SDKComponent.tsx'),
    },
  },
});

function init() {
  /** @type { import("webpack").Configuration } */
  const config = {
    entry: {
      mock: resolve(__dirname, './src/index.tsx'),
    },
    cache: { type: 'filesystem', cacheDirectory: resolve(__dirname, '.cdn-cache') },
    output: {
      publicPath: 'auto',
    },
    mode: 'development',
    plugins: [TestSDKPlugin, FullManifest],
    resolve: {
      alias: {
        '@scalprum/react-core': resolve(__dirname, '../dist/packages/react-core/esm'),
        '@scalprum/core': resolve(__dirname, '../dist/packages/core/esm'),
      }
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'swc-loader',
            options: {
              jsc: {
                parser: {
                  syntax: 'typescript',
                  tsx: true,
                },
              },
            },
          },
        },
      ],
    },
  };

  return config;
}

// Nx plugins for webpack to build config object from Nx options and context.
module.exports = init;
