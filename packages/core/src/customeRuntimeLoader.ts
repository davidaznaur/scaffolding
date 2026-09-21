import type {
    PluginManifest,
    RemotePluginManifest,
    PluginEntryModule,
    PluginLoadResult,
    LoadedExtension,
    Extension,
    EncodedCodeRef,
    AnyObject,
  } from '@openshift/dynamic-plugin-sdk';
  import { applyCodeRefSymbol, parseEncodedCodeRef, isEncodedCodeRef, visitDeep } from '@openshift/dynamic-plugin-sdk';
  import { createInstance } from '@module-federation/enhanced/runtime';
  import type { ModuleFederation } from '@module-federation/enhanced/runtime';
  
  export interface CustomRuntimeLoaderOptions {
    /** Name for the MF runtime host instance */
    hostName?: string;
    /** Shared modules config passed to MF runtime init */
    shared?: Record<string, any>;
    /** Custom fetch implementation for manifest loading */
    fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
    /** Transform manifest before processing */
    transformPluginManifest?: <T extends PluginManifest>(manifest: T) => T;
    /** Runtime plugins for @module-federation/enhanced */
    runtimePlugins?: any[];
  }
  
  function isRemoteManifest(manifest: PluginManifest): manifest is RemotePluginManifest {
    return manifest.registrationMethod === 'callback' || manifest.registrationMethod === 'custom';
  }
  
  function generateUID(): string {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  
  /**
   * Creates a PluginEntryModule adapter that delegates to the MF runtime's loadRemote.
   * This satisfies the SDK's container interface (init/get) without DOM script injection.
   */
  function createMFEntryModuleAdapter(
    mfInstance: ModuleFederation,
    pluginName: string,
  ): PluginEntryModule {
    return {
      init: async () => {
        // No-op: MF runtime handles shared scope initialization internally
        // via createInstance({ shared: ... })
      },
      get: async <TModule extends AnyObject>(moduleRequest: string): Promise<() => TModule> => {
        // moduleRequest comes in as './ModuleName' from the SDK
        // MF Runtime expects 'remoteName/expose' without leading './' — it adds the prefix internally
        const expose = moduleRequest.startsWith('./') ? moduleRequest.slice(2) : moduleRequest;
        const remotePath = `${pluginName}/${expose}`;
        const module = await mfInstance.loadRemote<TModule>(remotePath);
        if (!module) {
          throw new Error(`Module '${moduleRequest}' not found in remote '${pluginName}'`);
        }
        // The SDK expects get() to return a factory function
        return () => module;
      },
    };
  }
  
  /**
   * Decodes EncodedCodeRef values in extension properties into CodeRef functions
   * that load modules via the MF runtime entry module adapter.
   */
  function decodeExtensionCodeRefs(
    extension: Extension & { pluginName: string; uid: string },
    entryModule: PluginEntryModule,
  ): LoadedExtension {
    visitDeep(
      extension.properties as AnyObject,
      isEncodedCodeRef,
      (encodedCodeRef: EncodedCodeRef, key: string, container: AnyObject) => {
        const refData = parseEncodedCodeRef(encodedCodeRef);
        if (!refData) {
          return;
        }
        const { moduleName, exportName } = refData;
        const codeRef = async () => {
          const moduleFactory = await entryModule.get(moduleName);
          const referencedModule = moduleFactory();
          return referencedModule[exportName];
        };
        Object.defineProperty(codeRef, 'name', {
          value: `$codeRef_${extension.pluginName}[${encodedCodeRef.$codeRef}]`,
          configurable: true,
        });
        container[key] = applyCodeRefSymbol(codeRef);
      },
    );
    return extension as LoadedExtension;
  }
  
  /**
   * PluginLoaderInterface implementation using @module-federation/enhanced/runtime.
   * 
   * Replaces the SDK's default PluginLoader which uses DOM script injection.
   * Works in both browser and Node.js (Ink CLI) environments.
   */
  export class CustomRuntimeLoader {
    private mfInstance: ModuleFederation;
    private options: Required<Pick<CustomRuntimeLoaderOptions, 'fetchImpl' | 'transformPluginManifest'>>;
    private registeredRemotes: Set<string> = new Set();
  
    constructor(options: CustomRuntimeLoaderOptions = {}) {
      const {
        hostName = 'scalprum_host',
        shared = {},
        fetchImpl = (url, init) => fetch(url, init),
        transformPluginManifest = <T extends PluginManifest>(m: T) => m,
        runtimePlugins = [],
      } = options;
  
      this.options = { fetchImpl, transformPluginManifest };
  
      this.mfInstance = createInstance({
        name: hostName,
        shared,
        plugins: runtimePlugins,
        remotes: [],
      });
    }
  
    async loadPluginManifest(manifestURL: string): Promise<RemotePluginManifest> {
      const response = await this.options.fetchImpl(manifestURL, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`Failed to load manifest from ${manifestURL}: ${response.status} ${response.statusText}`);
      }
      const manifest: RemotePluginManifest = await response.json();
      return manifest;
    }
  
    transformPluginManifest<T extends PluginManifest>(manifest: T): T {
      return this.options.transformPluginManifest(manifest);
    }
  
    async loadPlugin(manifest: PluginManifest): Promise<PluginLoadResult> {
      const pluginName = manifest.name;
  
      try {
        // Local manifests have no remote entry — just process extensions
        if (!isRemoteManifest(manifest)) {
          const loadedExtensions = manifest.extensions.map((ext, index) => ({
            ...ext,
            pluginName,
            uid: `${pluginName}[${index}]_${generateUID()}`,
          })) as LoadedExtension[];
  
          return { success: true, loadedExtensions };
        }
  
        // Build the remote entry URL from manifest
        const remoteEntryUrl = this.resolveRemoteEntry(manifest);
  
        // Register or update the remote with MF runtime
        if (this.registeredRemotes.has(pluginName)) {
          this.mfInstance.registerRemotes(
            [{ name: pluginName, entry: remoteEntryUrl }],
            { force: true },
          );
        } else {
          this.mfInstance.registerRemotes([{ name: pluginName, entry: remoteEntryUrl }]);
          this.registeredRemotes.add(pluginName);
        }
  
        // Create an entry module adapter that wraps loadRemote
        const entryModule = createMFEntryModuleAdapter(this.mfInstance, pluginName);
  
        // Process extensions — decode CodeRef values
        const loadedExtensions = manifest.extensions.map((ext, index) => {
          const loadedExt = {
            ...ext,
            pluginName,
            uid: `${pluginName}[${index}]_${generateUID()}`,
          };
          return decodeExtensionCodeRefs(loadedExt, entryModule);
        });
  
        return {
          success: true,
          loadedExtensions,
          entryModule,
        };
      } catch (error) {
        return {
          success: false,
          errorMessage: `Failed to load plugin '${pluginName}' via MF Runtime`,
          errorCause: error,
        };
      }
    }
  
    private resolveRemoteEntry(manifest: RemotePluginManifest): string {
      const { baseURL, loadScripts } = manifest;
      const entryScript = loadScripts[0];
  
      if (!entryScript) {
        throw new Error(`Plugin '${manifest.name}' has no entry scripts in manifest`);
      }
  
      // If entry script is already absolute, use it directly
      if (entryScript.startsWith('http://') || entryScript.startsWith('https://')) {
        return entryScript;
      }
  
      // Resolve relative to baseURL
      if (baseURL === 'auto' || !baseURL) {
        throw new Error(
          `Plugin '${manifest.name}' has baseURL='auto' which requires the host to provide a resolved baseURL via transformPluginManifest`,
        );
      }
  
      const base = baseURL.endsWith('/') ? baseURL : `${baseURL}/`;
      return `${base}${entryScript}`;
    }
  
    /** Expose the MF instance for advanced usage */
    getMFInstance(): ModuleFederation {
      return this.mfInstance;
    }
  }