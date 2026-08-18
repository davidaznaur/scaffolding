import { useState, useEffect, useCallback } from 'react';
import { getModule } from '@scalprum/core';
import type { PluginCommandProps } from '../types';

type CommandComponent = React.ComponentType<PluginCommandProps>;

export interface UseCommandLoaderState {
  /** The loaded component, or null if not yet loaded / failed */
  Component: CommandComponent | null;
  /** Whether the module is currently being loaded */
  loading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Retry loading the module */
  retry: () => void;
}

/**
 * Loads a federated module from a scalprum scope and returns it as a React component.
 * Handles loading state, errors, and retry.
 *
 * This hook contains no UI framework dependencies (no Ink, no DOM).
 * The consumer decides how to render loading/error/success states.
 */
export function useCommandLoader(
  scope: string | null,
  module: string | null,
): UseCommandLoaderState {
  const [Component, setComponent] = useState<CommandComponent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!scope || !module) {
      setComponent(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setComponent(null);

    const load = async (): Promise<void> => {
      try {
        const mod = await getModule<CommandComponent>(scope, module);
        if (!cancelled) {
          setComponent(() => mod);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [scope, module, attempt]);

  const retry = useCallback(() => {
    setAttempt((prev) => prev + 1);
  }, []);

  return { Component, loading, error, retry };
}
