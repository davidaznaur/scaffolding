const { resolve } = require('path');
const webpack = require('webpack');

/** @type { import("webpack").Configuration } */
module.exports = {
  entry: resolve(__dirname, './src/main.tsx'),
  target: 'node',
  mode: 'production',
  output: {
    path: resolve(__dirname, './dist'),
    filename: 'cli.mjs',
    clean: true,
    module: true,
    chunkFormat: 'module',
    library: { type: 'module' },
  },
  experiments: {
    outputModule: true,
  },
  plugins: [
    new webpack.BannerPlugin({ banner: '#!/usr/bin/env node', raw: true }),
  ],
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@scalprum/core': resolve(__dirname, '../../packages/core/src'),
      '@scalprum/react-core': resolve(__dirname, '../../packages/react-core/src'),
    },
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
              transform: {
                react: {
                  runtime: 'automatic',
                },
              },
            },
          },
        },
      },
    ],
  },
  externalsType: 'module',
  externals: {
    react: 'react',
    'react/jsx-runtime': 'react/jsx-runtime',
    ink: 'ink',
    'yoga-layout': 'yoga-layout',
    'react-devtools-core': 'react-devtools-core',
    bufferutil: 'bufferutil',
    'utf-8-validate': 'utf-8-validate',
  },
  optimization: {
    minimize: false,
  },
};
