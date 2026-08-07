export interface PluginCommandProps {
  args: string[];
  onOutput: (text: string, color?: string) => void;
}

export interface CommandDefinition {
  name: string;
  description: string;
  scope: string;
  module: string;
  usage?: string;
}

export interface CliManifest {
  name: string;
  version: string;
  commands: CliCommandEntry[];
}

export interface CliCommandEntry {
  name: string;
  description: string;
  module: string;
  usage?: string;
}

export interface PluginSource {
  scope: string;
  manifestLocation: string;
  cliManifestLocation: string;
}
