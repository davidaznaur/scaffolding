/**
 * Minimal MF Runtime plugin for Node.js.
 * Provides the `loadEntry` hook to fetch and evaluate remote entry scripts
 * using Node.js `vm` module instead of DOM `<script>` injection.
 *
 * Also provides browser-like globals (document, self, window) needed by
 * webpack's runtime in the remote entry, and overrides chunk loading to
 * use fetch + vm instead of script tags.
 */
import * as vm from 'node:vm';

let globalsInitialized = false;

function ensureBrowserGlobals(entryUrl: string): void {
  if (globalsInitialized) return;
  globalsInitialized = true;

  (globalThis as any).self = globalThis;
  (globalThis as any).window = globalThis;
  (globalThis as any).document = {
    currentScript: { src: entryUrl, tagName: 'SCRIPT' },
    defaultView: globalThis,
    head: {
      appendChild: () => {},
      removeChild: () => {},
    },
    createElement: (tag: string) => {
      if (tag === 'script') {
        const scriptEl: any = {
          src: '',
          onload: null,
          onerror: null,
          setAttribute: () => {},
        };
        // When webpack sets .src and appends to head, we intercept it
        setTimeout(async () => {
          if (!scriptEl.src) return;
          try {
            const response = await fetch(scriptEl.src);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const code = await response.text();
            const s = new vm.Script(`(function(){\n${code}\n})()`, { filename: scriptEl.src });
            s.runInThisContext();
            if (scriptEl.onload) scriptEl.onload();
          } catch (err) {
            if (scriptEl.onerror) scriptEl.onerror(err);
          }
        }, 0);
        return scriptEl;
      }
      return {};
    },
    getElementsByTagName: () => [],
  };
}

export default function nodeRemoteLoader() {
  return {
    name: 'node-remote-loader',
    async loadEntry({ remoteInfo, remoteEntryExports }: any) {
      if (remoteEntryExports) {
        return remoteEntryExports;
      }

      const entryUrl = remoteInfo.entry;
      if (!entryUrl || typeof entryUrl !== 'string') {
        throw new Error(
          `[node-remote-loader] Remote "${remoteInfo.name}" has no valid entry URL`,
        );
      }

      ensureBrowserGlobals(entryUrl);

      const response = await fetch(entryUrl);
      if (!response.ok) {
        throw new Error(
          `[node-remote-loader] Failed to fetch ${entryUrl}: ${response.status}`,
        );
      }
      const scriptContent = await response.text();

      let capturedContainer: any = null;
      (globalThis as any).__load_plugin_entry__ = (_name: string, container: any) => {
        capturedContainer = container;
      };

      // Update currentScript.src for this specific entry
      (globalThis as any).document.currentScript = { src: entryUrl, tagName: 'SCRIPT' };

      const script = new vm.Script(
        `(function() {\n${scriptContent}\n})()`,
        { filename: entryUrl },
      );
      script.runInThisContext();

      if (capturedContainer) {
        return capturedContainer;
      }

      throw new Error(
        `[node-remote-loader] Remote "${remoteInfo.name}" did not register a container`,
      );
    },
  };
}