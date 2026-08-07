# Scalprum Scaffolding Repository - Complete Expert Guide

## 1. What Is Scalprum?

Scalprum is a **micro-frontend framework for React** built on top of [Module Federation](https://module-federation.io/). It provides a developer-friendly abstraction over Module Federation that lets you:

- **Dynamically load remote React components** at runtime from separate bundles/servers
- **Share React hooks** across micro-frontend boundaries ("Remote Hooks")
- **Share state** across micro-frontends via an event-driven store system ("Shared Stores")
- **Build plugin-based architectures** where independent teams ship features as federated modules

The core use case: a **host application** loads a configuration describing remote modules, then uses `<ScalprumComponent>` to render those remote components at runtime - without bundling them at build time.

---

## 2. Repository Architecture (Monorepo Layout)

This is an **Nx-managed npm workspaces monorepo**. Here's the structure:

```
scaffolding/
├── packages/
│   ├── core/                  # @scalprum/core - framework-agnostic runtime
│   ├── react-core/            # @scalprum/react-core - React bindings (components, hooks, context)
│   ├── build-utils/           # @scalprum/build-utils - Nx executors for building federated modules
│   └── react-test-utils/      # @scalprum/react-test-utils - Testing utilities
├── examples/
│   ├── test-app/              # Example host app using scalprum
│   └── test-app-e2e/          # Cypress E2E tests for the test-app
├── federation-cdn-mock/       # Mock CDN server for testing federated modules
├── .github/
│   ├── workflows/             # CI/CD pipelines
│   └── actions/               # Reusable composite actions
├── nx.json                    # Nx configuration (build graph, caching, release)
├── package.json               # Root workspace config
├── commitlint.config.js       # Conventional commit enforcement
└── tsconfig.base.json         # Shared TypeScript paths
```

### Package Dependency Graph

```
@scalprum/core          ← foundational, no scalprum dependencies
    ↑
@scalprum/react-core    ← depends on @scalprum/core
    ↑
@scalprum/react-test-utils  ← depends on react-core and core

@scalprum/build-utils   ← independent, Nx executors
```

---

## 3. Package Deep Dives

### 3.1 `@scalprum/core` - The Foundation

**Purpose:** Framework-agnostic runtime that manages the lifecycle of federated modules. It knows nothing about React - it handles module loading, registry management, and the global scalprum state.

**Key Source Files:**

| File | Purpose |
|------|---------|
| `src/scalprum.ts` | The singleton `Scalprum` class - the heart of the framework |
| `src/index.ts` | Barrel re-export of all public APIs |
| `src/createSharedStore.ts` | Event-driven shared state store factory |
| `src/warnDuplicatePkg.ts` | Dev-time duplicate package warnings |

#### The `Scalprum` Singleton

Scalprum is not a class — it's a **type alias** with a module-level singleton instance (`let scalprum: Scalprum | undefined`). All behavior is implemented as standalone exported functions that operate on the singleton via `getScalprum()`.

The type is defined in `packages/core/src/scalprum.ts` (line 37):

```typescript
export type Scalprum<T extends Record<string, any> = Record<string, any>> = {
  appsConfig: AppsConfig;                              // registry of all known remote apps
  pendingInjections: { [key: string]: Promise<any> };  // dedup in-flight manifest loads per scope
  pendingLoading: { [key: string]: Promise<ScalprumModule> }; // in-flight module loads
  pendingPrefetch: { [key: string]: Promise<unknown> };       // active prefetch operations
  existingScopes: Set<string>;                         // scopes already loaded
  exposedModules: { [moduleId: string]: ExposedScalprumModule }; // module cache keyed by "scope#module"
  scalprumOptions: ScalprumOptions;                    // { cacheTimeout: number; enableScopeWarning: boolean }
  api: T;                                              // shared context passed to prefetch hooks
  pluginStore: PluginStore;                            // from @openshift/dynamic-plugin-sdk
};
```

Key functions:

- `initialize(config)` - Bootstraps the singleton with app configurations
- `getScalprum()` - Returns the singleton; throws if not initialized
- `removeScalprum()` - Clears the singleton (for testing)
- `getModule(scope, module, importName?)` - Loads a remote module export (default `'default'`)
- `preloadModule(scope, module, processor?)` - Preloads without importing; triggers prefetch if available
- `processManifest(manifest, scope, module, processor?)` - Fetches/parses manifest and loads plugin via SDK
- `getCachedModule(scope, module)` - Returns cached module + optional prefetch promise
- `getModuleIdentifier(scope, module)` - Returns `"scope#module"` key
- `getAppData(name)` - Looks up app config by scope name
- `initSharedScope()` - Calls `__webpack_init_sharing__('default')`
- `getSharedScope(enableScopeWarning?)` - Returns webpack share scope; optionally warns on duplicates

#### Manifest Processing Flow

1. Host provides config: `{ myRemote: { name: 'myRemote', manifestLocation: '/api/manifest.json' } }`
2. `processManifest()` fetches that URL, gets back something like `{ "entry": ["remote-entry.js"], "extensions": {}, "name": "myRemote" }`
3. It calls the plugin SDK to load the remote entry JS file
4. The remote entry registers itself as a Module Federation container in the global scope
5. Later, `getModule('myRemote', './MyComponent')` pulls the actual component out of that container

#### `createSharedStore` - Pub/Sub State

Lightweight Redux-like store without external dependencies:

- **Closure-based state** — `let state` mutated only via `onEventChange` reducer
- **Event-specific subscriptions** — `Map<event, Set<callback>>` pattern
- **Global wildcard subscription** — reserved `'*'` event for `subscribeAll`
- **Validation at creation** — requires `initialState`, non-empty string events, forbids `'*'` as event name
- **Unsubscribe pattern** — all subscribe methods return cleanup functions

```typescript
createSharedStore<S, E extends readonly string[]>(config): {
  getState(): S
  updateState(event: E[number], payload?: any): void
  subscribe(event: E[number], callback: () => void): () => void
  subscribeAll(callback: () => void): () => void
}
```

#### Dependencies

| Dependency | Version | Why |
|------------|---------|-----|
| `@openshift/dynamic-plugin-sdk` | ^9.1.0 | Provides `PluginStore`, `PluginManifest`, plugin loading infrastructure |
| `tslib` | ^2.6.2 | TypeScript helper runtime for ES5 target output |

---

### 3.2 `@scalprum/react-core` - React Bindings

**Purpose:** The main package developers interact with. Provides React components, hooks, and context for using scalprum in React applications. This is the largest and most complex package with three major subsystems.

#### A) Core Component System

| File | Exports | Purpose |
|------|---------|---------|
| `src/scalprum-provider.tsx` | `ScalprumProvider` | Root context provider - initializes scalprum and provides context to the tree |
| `src/scalprum-component.tsx` | `ScalprumComponent` | Renders a remote federated component by scope + module name |
| `src/use-module.ts` | `useModule` | Hook to imperatively load a module from a federated scope |
| `src/use-load-module.ts` | `useLoadModule` | Advanced module loading with `[module, error]` tuple |
| `src/use-scalprum.ts` | `useScalprum` | Hook to access the scalprum context directly |
| `src/scalprum-context.ts` | `ScalprumContext` | The React context definition |
| `src/async-loader.tsx` | `loadComponent` | Async module loading helper |
| `src/default-error-component.tsx` | `DefaultErrorComponent` | Default error UI with cause chain unwrapping |

**`ScalprumProvider`** - The root of every scalprum app:

```tsx
<ScalprumProvider
  config={config}           // Map of remote app configurations
  api={{ chrome: {...} }}   // Shared API object available to all remotes
  pluginLoaderOptions={{}}  // Options for the plugin loading strategy
  pluginSDKOptions={{}}     // Options passed to @openshift/dynamic-plugin-sdk
>
  <App />
</ScalprumProvider>
```

Under the hood, it:
1. Calls `initialize()` from `@scalprum/core`
2. Stores the config + API in React context
3. Nests three providers: `ScalprumContext` → `PluginStoreProvider` → `RemoteHookProvider`

**`ScalprumComponent`** - The workhorse:

```tsx
<ScalprumComponent
  scope="myRemote"            // Which federated container
  module="./MyComponent"      // Which exposed module
  fallback={<Spinner />}      // Loading state
  ErrorComponent={ErrorPage}  // Error boundary fallback
  innerRef={ref}              // Ref forwarding
  processor={(items) => items} // Transform loaded items
  {...propsForRemoteComponent}
/>
```

Under the hood, it:
1. Looks up the scope in scalprum's registry
2. Calls `processManifest()` if the manifest hasn't been loaded yet
3. Uses `React.lazy()` + `Suspense` to async-load the module
4. Wraps everything in a `BaseScalprumComponent` error boundary (class component)
5. First error → retry with `skipCache` (self-repair); second error → render `ErrorComponent`
6. Passes remaining props to the loaded remote component

**React Component Tree:**

```
ScalprumProvider
├── ScalprumContext.Provider ← config, api, initialized, pluginStore
│   └── PluginStoreProvider ← @openshift/dynamic-plugin-sdk
│       └── RemoteHookProvider ← remote hook execution engine
│           ├── HookExecutor (×N) ← hidden null-rendering components
│           └── {children}
```

#### B) Remote Hooks System

This is a unique Scalprum feature that lets micro-frontends **share React hooks across federation boundaries**.

| File | Exports | Purpose |
|------|---------|---------|
| `src/remote-hook-provider.tsx` | `RemoteHookProvider` | Context provider & hook execution engine |
| `src/use-remote-hook.ts` | `useRemoteHook` | Hook to consume a remote hook by scope + module |
| `src/use-remote-hook-manager.ts` | `useRemoteHookManager` | Hook to manage multiple remote hook lifecycles dynamically |
| `src/remote-hooks-types.ts` | Types | All shared TypeScript interfaces |

**How Remote Hooks work:**

The key problem: React hooks can't be called conditionally or outside components. Remote hooks live in federated modules and must still obey Rules of Hooks while being loaded dynamically.

The solution: `RemoteHookProvider` spawns invisible `HookExecutor` components (rendering `null`) that actually call the remote hooks, then propagate results via a mutable state map + notify callbacks.

**Lifecycle:**

1. **Subscribe**: Consumer calls `subscribe(forceUpdate)` → UUID assigned, entry created in `state` map
2. **Load**: `getModule(scope, module, importName)` fetches remote hook function asynchronously
3. **Register**: `registerHook(id, fn)` adds to `availableHooks` → provider renders `HookExecutor`
4. **Execute**: `HookExecutor` calls `hookFunction(...args)` on every render (valid because it's a real component)
5. **Update state**: Result pushed to `state[id].value`, `notify()` triggers consumer re-render
6. **Args update**: `updateArgs(id, newArgs)` → notifies `HookExecutor`'s `setArgs` without remounting
7. **Cleanup**: `unsubscribe()` removes state entry, arg subscriptions, and `HookExecutor`

**Usage example:**

```tsx
const { id, loading, error, hookResult } = useRemoteHook({
  scope: 'authModule',
  module: './useAuth',
  args: [{ token }],  // must be memoized!
});
```

**Critical constraint:** `useRemoteHook` shallow-compares `args` array elements. Objects/arrays recreated each render cause infinite update loops. Always `useMemo` for non-primitive args.

**Manager vs single hook:**

| | `useRemoteHook` | `useRemoteHookManager` |
|---|---|---|
| Hook count | 1 (fixed at mount) | N (dynamic add/remove) |
| Re-renders | Automatic via subscribe | Via `hookResults` memo on `update` counter |
| Cleanup | Automatic on unmount | Manual `cleanup()` or per-handle `remove()` |
| Args update | `useEffect` shallow compare | `handle.updateArgs()` |

#### C) Shared Stores System

Event-driven cross-micro-frontend state management.

| File | Exports | Purpose |
|------|---------|---------|
| `src/useGetState.ts` | `useGetState` | Subscribe to all shared store changes |
| `src/useSubscribeStore.ts` | `useSubscribeStore` | Subscribe to specific shared store event |
| `src/ensureImmutability.ts` | `ensureImmutability` | Shallow copy utility for store values |

**`useGetState(store)`** - Subscribes to `store.subscribeAll()`, re-renders on **any** state change, returns shallow-immutable copy of full state.

**`useSubscribeStore(store, event, selector)`** - Subscribes to `store.subscribe(event, ...)`, re-renders **only** when that specific event fires, selector extracts derived value.

**Typical remote module pattern:**

```typescript
// In federated remote module
let store = null;
const getStore = () => store ??= createSharedStore({ ... });

export const useCounterStore = () => {
  const state = useGetState(getStore());
  return { count: state.count, increment: () => getStore().updateState('INCREMENT') };
};
```

Host consumes via `useRemoteHook({ scope, module: './useCounterStore' })`.

#### All Exported APIs Summary

**Components:** `ScalprumProvider` (also default export), `ScalprumComponent`, `RemoteHookProvider`, `PrefetchProvider`

**Hooks:** `useScalprum`, `useModule`, `useLoadModule`, `usePrefetch`, `useRemoteHook`, `useRemoteHookManager`, `useGetState`, `useSubscribeStore`

**Utilities:** `ensureImmutability`

**Types:** `ScalprumProviderProps`, `ScalprumComponentProps`, `ModuleDefinition`, `PrefetchState`, `HookConfig`, `UseRemoteHookResult<T>`, `HookHandle`, `RemoteHookHandle<T>`, `RemoteHookManager<R>`, `RemoteHookContextType`, `ScalprumFeed` (deprecated alias)

---

### 3.3 `@scalprum/build-utils` - Build Tooling

**Purpose:** Internal Nx plugin for the monorepo. Provides custom Nx executors used to build publishable libraries and keep workspace dependency versions in sync. **Not published as a consumer-facing package.**

#### Nx Executors

| Executor | Implementation | Purpose |
|----------|----------------|---------|
| `@scalprum/build-utils:builder` | `src/executors/builder/executor.ts` | Dual CJS/ESM TypeScript build |
| `@scalprum/build-utils:sync-dependencies` | `src/executors/sync-dependencies/executor.ts` | Workspace dependency version sync |

#### `builder` executor

1. Validates options with Zod (`esmTsConfig`, `cjsTsConfig`, `outputPath`, `assets`)
2. Validates files exist via `fs.stat`
3. Runs `tsc` twice via `execSync`: ESM → `{outputPath}/esm/`, CJS → `{outputPath}/`
4. Copies assets via `cp -r` (always includes `package.json`, plus configured files like `*.md`)

#### `sync-dependencies` executor

1. Loads the Nx project dependency graph via `createProjectGraphAsync()`
2. Filters workspace dependencies (excludes `npm:` externals)
3. Uses semver to decide if dependency ranges need bumping
4. If `package.json` changed, writes it and runs `git add`, `commit`, `push`

---

### 3.4 `@scalprum/react-test-utils` - Testing Utilities

**Purpose:** Published devDependency (v0.3.4) providing Jest/jsdom testing utilities for Scalprum apps. Mocks the Module Federation environment so components using `ScalprumProvider`/`ScalprumComponent` can be tested without real remote bundles.

#### Exported APIs

| Export | Type | Description |
|--------|------|-------------|
| `mockScalprum()` | function | Calls `mockWebpackShareScope()` + `mockFetch()` |
| `mockWebpackShareScope()` | function | Sets `globalThis.__webpack_share_scopes__ = { default: {} }` |
| `mockFetch()` | function | Assigns `whatwg-fetch` polyfill if `globalThis.fetch` is missing |
| `mockPluginData(options?, api?)` | function | Returns `{ response, TestScalprumProvider }` |
| `DEFAULT_MODULE_TEST_ID` | const | `'default-module-test-id'` |

#### Usage

```tsx
import { render } from '@testing-library/react';
import { mockPluginData } from '@scalprum/react-test-utils';

const { TestScalprumProvider } = mockPluginData({
  moduleMock: { default: () => <div>Mock Component</div> },
});

render(
  <TestScalprumProvider>
    <ScalprumComponent scope="test-plugin" module="ExposedModule" />
  </TestScalprumProvider>
);
```

`TestScalprumProvider` wraps `ScalprumProvider` with a `ScalprumInitGate` that waits for initialization, then writes mock modules directly into `getScalprum().exposedModules`, bypassing real Module Federation loading.

**Side effect on import:** importing the package automatically calls `mockScalprum()` to set up webpack share scope and fetch polyfill.

---

## 4. Build System

### Nx Configuration

The monorepo uses **Nx 22.7.5** for:

- **Task orchestration**: `nx run-many -t build`, `nx run-many -t test`
- **Dependency-aware builds**: `build` tasks depend on `^build` (build dependencies first)
- **Caching**: All tasks (`build`, `lint`, `test`, `typecheck`, `component-test`) are cached
- **Release management**: Nx Release handles versioning, changelogs, and npm publishing

**Build pipeline order** (enforced by `dependsOn: ["^build"]`):
1. `@scalprum/core` builds first (no scalprum dependencies)
2. `@scalprum/react-core` builds next (depends on core)
3. `@scalprum/react-test-utils` builds last (depends on both)
4. `@scalprum/build-utils` is independent

Each publishable package uses `@scalprum/build-utils:builder` (dual `tsc` execution), while `build-utils` itself uses `@nx/js:tsc`.

### TypeScript Configuration

The root `tsconfig.base.json` defines **path aliases** so packages can import each other by npm name during development:

```json
{
  "paths": {
    "@scalprum/core": ["packages/core/src/index.ts"],
    "@scalprum/react-core": ["packages/react-core/src/index.ts"],
    "@scalprum/build-utils": ["packages/build-utils/src/index.ts"],
    "@scalprum/react-test-utils": ["packages/react-test-utils/src/index.ts"]
  }
}
```

### Dual-Format Builds

Each package produces both CJS and ESM:

```json
"main": "./index.js",          // CJS
"module": "./esm/index.js",    // ESM
"typings": "./index.d.ts"      // Type declarations
```

---

## 5. CI/CD Pipeline

### GitHub Workflows

#### 1. `ci.yml` - Main CI Pipeline

**Triggers:** Push to `main`, all pull requests

**Job dependency graph:**

```
install
├── commitlint
├── lint
├── test (unit)
├── test-component
├── typecheck
└── build
    └── test-e2e
        └── release (push to main only)
```

| Job | What It Does |
|-----|--------------|
| `install` | Checkout (full history), `setup-environment`, Cypress cache |
| `commitlint` | Jest tests on commitlint config; validates commits |
| `lint` | `nx affected -t lint` |
| `test` | `nx affected -t test --configuration=ci` (with code coverage) |
| `test-component` | `nx affected -t component-test --configuration=ci` |
| `typecheck` | `nx run-many -t typecheck` |
| `build` | `nx affected -t build` |
| `test-e2e` | Starts servers, runs Cypress E2E; uploads screenshots on failure |
| `release` | Only on push (not PRs); OIDC trusted publishing to npm |

#### 2. `pr-title.yaml` - PR Title Lint

Validates PR titles against commitlint rules (same conventional commit format as commit messages).

### Composite Actions (`.github/actions/`)

| Action | Role |
|--------|------|
| `setup-environment` | Node from `.nvmrc`, optional `registry-url`, `nrwl/nx-set-shas@v4`, node_modules cache, `npm ci` |
| `node-cache` | Caches `**/node_modules` keyed on `package-lock.json` |
| `cypress-cache` | Caches `/home/runner/.cache/Cypress` |
| `webpack-cache` | Caches `**/.webpack-cache` |
| `lint` | setup-environment + `nx affected -t lint` |
| `test-unit` | setup-environment + `nx affected -t test --configuration=ci` |
| `test-component` | setup-environment + cypress/webpack caches + `nx affected -t component-test --configuration=ci` |
| `test-e2e` | setup-environment + caches + `npm run build` + `npm run test:e2e`; uploads screenshots on failure |
| `release` | Full release pipeline |

---

## 6. Release Process

Configured in `nx.json` under `release`:

### Publishable Packages (independent versioning)

- `@scalprum/core`
- `@scalprum/react-core`
- `@scalprum/react-test-utils`

### How It Works

- `projectsRelationship: "independent"` — each package versions on its own semver
- **Conventional commits** with commit scopes (`useCommitScope: true`)
- Version bumps derived from commit messages: `fix` = patch, `feat` = minor, breaking = major
- **Git:** commits, tags, pushes with message `chore: bump {projectName} to {version} [skip ci]`
- **Tag pattern:** `{projectName}-{version}` (e.g. `@scalprum/core-1.2.3`)
- **Changelogs:** Per-project with GitHub Releases (`createRelease: "github"`)
- **Publishing:** npm OIDC trusted publishing (no npm tokens needed)

### Release CI Job Flow

1. Setup with `registry-url: https://registry.npmjs.org` (OIDC trusted publishing)
2. Git user config from secrets
3. `npx nx run-many -t build` (full build)
4. `npx nx release version` — bump versions from conventional commits
5. Clean rebuild (skip Nx cache)
6. `npx nx release publish` — publish to npm
7. Force-push `last-release` tag

---

## 7. Code Quality Tooling

| Tool | Config File | Purpose |
|------|-------------|---------|
| **ESLint** | `.eslintrc.json` | Linting with TypeScript, React, Prettier plugins |
| **Prettier** | `.prettierrc` | Code formatting (single quotes, 150 print width, trailing commas) |
| **Husky** | `.husky/commit-msg` | Git hooks - runs commitlint on commit messages |
| **EditorConfig** | `.editorconfig` | Editor settings (2-space indent, LF line endings, UTF-8) |
| **Engine enforcement** | `.npmrc` (`engine-strict=true`) | Blocks npm install on wrong Node/npm versions |

### Commitlint Configuration

`commitlint.config.js` enforces conventional commits with a **custom rule** `scope-full-name-for-versioning`:

- `fix(core): some fix` → valid
- `fix(@scalprum/core): some fix` → INVALID (use short scope names)
- `feat(react-core): new feature` → valid

Valid scopes are derived from package directory names: `core`, `react-core`, `build-utils`, `react-test-utils`.

For `feat` and `breaking` commits, the scope must use the full Nx project name so Nx release can attribute version bumps correctly.

The custom rule has its own Jest test suite in `commitlint.config.test.js`.

---

## 8. Development Workflow

### npm Scripts

| Script | Command |
|--------|---------|
| `dev` | `node dev-script.js` |
| `test:e2e` | `node e2e-script.js` |
| `test:unit` | `nx run-many -t test` |
| `test:component` | `nx run-many -t component-test` |
| `build` | `nx run-many -t build` |
| `lint` | `nx run-many -t lint` |
| `typecheck` | `nx run-many -t typecheck` |
| `prepare` | `husky install` |
| `postinstall` | `rm -rf .webpack-cache` |

### Dev Script (`dev-script.js`)

Starts three concurrent processes:
1. **federation-cdn-mock** `npm run watch` (webpack rebuild on change)
2. **federation-cdn-mock** `npm run serve` (static server on **port 8001**)
3. **test-app** `nx run test-app:serve` (webpack dev server on **port 4200**)

### E2E Script (`e2e-script.js`)

Orchestrates end-to-end testing:
1. Starts cdn-server (8001) and test-app (4200)
2. Uses `wait-on` to wait for both servers
3. Runs `nx run test-app-e2e:e2e --skipNxCache`
4. Exits with e2e exit code, cleans up processes

### Federation CDN Mock (`federation-cdn-mock/`)

A standalone webpack project simulating a **remote plugin CDN** for testing.

- Webpack with `@module-federation/enhanced` and `@openshift/dynamic-plugin-sdk-webpack`
- Two plugin manifests: `sdk-plugin` (main) and `full-manifest` (inline)
- Aliases `@scalprum/core` and `@scalprum/react-core` to built workspace packages

**Exposed remote modules:**

| Module | Purpose |
|--------|---------|
| `./ModuleOne`–`./ModuleFour` | Basic federated components |
| `./SDKComponent` | Default + named exports |
| `./ErrorModule` | Runtime error testing |
| `./PreLoadedModule`, `./NestedModule` | Preload/nested loading |
| `./DelayedModule` | Delayed lazy load |
| `./ApiModule` | `useScalprum` API consumer/changer |
| `./useCounterHook`, `./useApiHook`, `./useTimerHook` | Remote hooks |
| `./useSharedStoreHook` | Shared store demo |

### Verdaccio (`.verdaccio/`)

Local npm registry configuration for testing the publishing flow locally. Not used in day-to-day development - packages are consumed from `dist/` via webpack aliases and `file:` deps.

---

## 9. Test App Example (`examples/test-app/`)

A working host application demonstrating Scalprum's full API surface:

- **Entry:** `main.ts` → dynamic import of `bootstrap.tsx` → `entry.tsx`
- **`ScalprumProvider`** wraps the app with plugin config pointing at CDN mock
- **Webpack:** Module Federation shell + aliases to local `dist/packages` builds
- **Routing:** React Router with dedicated routes per Scalprum feature

### Routes and Features Demonstrated

| Route | Scalprum APIs Demonstrated |
|-------|---------------------------|
| `/` | Landing page |
| `/legacy` | `ScalprumComponent`, `preloadModule`, custom `LoadingComponent`, grid layout |
| `/sdk` | Default/named imports, inline `pluginManifest`, delayed module loading |
| `/use-module` | `useModule` hook |
| `/api` | `useScalprum` host API sharing between host and remotes |
| `/remote-hooks` | `useRemoteHook` (counter, API, timer hooks) |
| `/remote-hook-manager` | `useRemoteHookManager` |
| `/shared-store` | `useRemoteHook` + shared store singleton pattern |
| `/runtime-error` | Error boundary / runtime error handling |
| `/not-found-error` | Manifest fetch 404 handling |

---

## 10. E2E Tests (`examples/test-app-e2e/`)

Cypress E2E suite covering every major Scalprum feature:

| File | Coverage |
|------|----------|
| `scalprum-api.cy.ts` | Host API (`isBeta` toggle) |
| `sdk-plugin-loading.cy.ts` | SDK components, full-manifest, delayed module |
| `named-export-scalprum-component.cy.ts` | Named export loading |
| `use-module-loading.cy.ts` | `useModule` hook |
| `module-prefetch-data.cy.ts` | Prefetch data |
| `module-loading-errors.cy.ts` | Chunk errors, runtime errors, 404 manifests |
| `remote-hooks.cy.ts` | Counter, API, timer remote hooks |
| `remote-hook-manager.cy.ts` | Hook manager |
| `shared-store.cy.ts` | Shared store state across instances |
| `app.cy.ts` | Basic app smoke |

Custom command: `cy.handleMetaError()` suppresses `import.meta` uncaught exceptions.

---

## 11. Key Design Patterns

### Singleton Pattern

`Scalprum` is a module-level singleton (`getScalprum()` + `initialize()`). This ensures all parts of the application share the same module registry.

### Provider Composition

Layered React contexts: `ScalprumContext` → `PluginStoreProvider` → `RemoteHookProvider`.

### Error Boundary with Self-Repair

`BaseScalprumComponent` is a class component that retries once with cache bypass on first error, then renders `ErrorComponent` on second error.

### Lazy Loading + Suspense

Remote components are loaded with `React.lazy()` wrapped in `Suspense` with fallbacks.

### Fake Component Hook Execution

The most architecturally interesting pattern. `RemoteHookProvider` spawns invisible `HookExecutor` components (rendering `null`) that actually call remote hooks inside real React components, obeying the Rules of Hooks.

### Promise Deduplication

`pendingInjections` and `pendingLoading` prevent duplicate manifest fetches and module loads for the same scope/module.

### Pub/Sub with BroadcastChannel

Shared Stores use event-driven pub/sub. `useGetState` re-renders on every event; `useSubscribeStore` re-renders only on the subscribed event.

### Strategy Pattern

`@scalprum/build-utils` uses different strategies for different bundlers (Webpack postbuild, Rspack, MF Runtime).

### Adapter Pattern

Wraps `@openshift/dynamic-plugin-sdk`'s `PluginStore` with Scalprum-specific manifest normalization.

---

## 12. The Module Loading Flow (End to End)

Here's what happens when you render `<ScalprumComponent scope="myRemote" module="./Widget" />`:

```
1. ScalprumProvider initialized → calls core initialize()
   → stores config: { myRemote: { name, manifestLocation } }

2. ScalprumComponent renders
   → looks up "myRemote" in scalprum registry
   → finds manifestLocation hasn't been fetched yet

3. processManifest() called
   → fetch(manifestLocation) → gets plugin-manifest.json
   → discovers entry: ["remote-entry.js"]
   → pluginStore.loadPlugin(sdkManifest)

4. Plugin SDK injects <script src="http://cdn/remote-entry.js">
   → appends to document.head
   → waits for onload event

5. Remote entry script executes
   → registers Module Federation container in window scope
   → container has init() and get() methods

6. pluginStore.getExposedModule(scope, module) called
   → container.init(shareScopes)  // share React, react-dom, etc.
   → container.get("./Widget")    // returns factory
   → factory()                     // returns { default: WidgetComponent }

7. React.lazy resolves
   → Suspense boundary removes fallback
   → WidgetComponent renders with forwarded props
```

---

## 13. Testing Architecture

| Package | Test Runner | Test Files |
|---------|-------------|------------|
| `core` | Jest (via Nx) | `src/scalprum.test.ts`, `src/createSharedStore.test.ts` |
| `react-core` | Jest (via Nx) | `src/*.test.tsx` (7 test files) |
| `react-core` | Cypress Component | `src/ScalprumProvider.cy.tsx` |
| `build-utils` | Jest (via Nx) | `src/executors/*/executor.spec.ts` |
| `react-test-utils` | None | No test files (passes via `passWithNoTests`) |
| `test-app-e2e` | Cypress E2E | `cypress/e2e/*.cy.ts` (10 test files) |
| Root | Jest | `commitlint.config.test.js` |

Tests mock `@openshift/dynamic-plugin-sdk` and use `@testing-library/react` for React component testing.

---

## 14. Quick Reference: All Public APIs

### `@scalprum/core`

**Functions:** `initialize`, `getScalprum`, `removeScalprum`, `getModule`, `preloadModule`, `processManifest`, `getCachedModule`, `getModuleIdentifier`, `getAppData`, `initSharedScope`, `getSharedScope`, `handlePrefetchPromise`, `setPendingPrefetch`, `getPendingPrefetch`, `removePrefetch`, `resolvePendingInjection`, `setPendingLoading`, `getPendingLoading`, `createSharedStore`, `warnDuplicatePkg`

**Types:** `AppMetadata<T>`, `AppsConfig<T>`, `PrefetchFunction<T>`, `ExposedScalprumModule<T,P>`, `ScalprumModule<T,P>`, `Factory<T,P>`, `ScalprumOptions`, `Scalprum<T>`, `Container`, `SharedStoreConfig<S,E>`

**Constants:** `GLOBAL_NAMESPACE`

### `@scalprum/react-core`

**Components:** `ScalprumProvider`, `ScalprumComponent`, `RemoteHookProvider`, `PrefetchProvider`

**Hooks:** `useScalprum`, `useModule`, `useLoadModule`, `usePrefetch`, `useRemoteHook`, `useRemoteHookManager`, `useGetState`, `useSubscribeStore`

**Utilities:** `ensureImmutability`

**Types:** `ScalprumProviderProps`, `ScalprumComponentProps`, `ModuleDefinition`, `PrefetchState`, `HookConfig`, `UseRemoteHookResult<T>`, `HookHandle`, `RemoteHookHandle<T>`, `RemoteHookManager<R>`, `RemoteHookContextType`, `ScalprumFeed` (deprecated)

### `@scalprum/build-utils`

**Nx Executors:** `builder`, `sync-dependencies`

### `@scalprum/react-test-utils`

**Functions:** `mockScalprum`, `mockWebpackShareScope`, `mockFetch`, `mockPluginData`

**Constants:** `DEFAULT_MODULE_TEST_ID`

---

## 15. Cross-Cutting Insights

1. **The `@openshift/dynamic-plugin-sdk` integration** is deep - scalprum wraps the SDK's `PluginStore` for manifest fetching and script injection, but adds its own caching layer (`exposedModules`, `pendingInjections`, `pendingLoading`) on top.

2. **Dual CJS/ESM builds** are produced by the custom `builder` executor running `tsc` twice with different tsconfig files. Every published package has both `main` (CJS) and `module` (ESM) entry points.

3. **The test-app + federation-cdn-mock** combination serves as both a development environment and a comprehensive integration test fixture. The cdn-mock exposes ~15 different remote modules covering every Scalprum feature.

4. **Release versioning uses conventional commit scopes** to independently version packages. A custom commitlint rule ensures `feat` and `breaking` commits use full project names so Nx can attribute version bumps correctly.

5. **CI is Nx-affected-first** for lint/test/build (only runs on changed packages), while E2E and release do full builds.
