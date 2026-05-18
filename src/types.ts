// src/types.ts

import { StructureRepresentationRegistry } from 'molstar/lib/mol-repr/structure/registry';


// ---------------------------------------------------------------------------
// 1. Representation types
// ---------------------------------------------------------------------------
// 1a. Main representation type
type RepType = StructureRepresentationRegistry.BuiltIn | 'off';

// 1b. Custom rules representation type
export type RuleRepType = RepType | "highlight";

// 1c. Custom rules representation type
// export interface RepSchema {
//   name: string;

// }

// ---------------------------------------------------------------------------
// 2. Target definition — one entry per molecular component category
// ---------------------------------------------------------------------------
export interface TargetDefinition {
  id: string;
  selector: string;
  label: string;
  rep: RepType;
  color: string;
  alpha: number | null;
  quality: string;
  size: number | null;
}

// ---------------------------------------------------------------------------
// 3. Custom Rule — the full data model for a user-defined visual rule
// ---------------------------------------------------------------------------
export interface CustomRule {
  name: string;
  rep: RuleRepType;
  colorType: "theme" | "solid";
  colorVal: string;
  size: string;
  alpha: string;
  quality: string;
  mode: "simple" | "expert";
  scheme: "auth" | "label";
  chain: string;
  ranges: string;
  specific: string;
  atomName: string;
  element: string;
  atomIndex: string;
  label: string;
  labelSize?: string;
  labelTextColor?: string;
  labelBorderWidth?: string;
  labelBorderColor?: string;
  tooltip: string;
  focus: boolean;
  rawJson: string;
  rawParamsJson: string;
  subParams: Record<string, boolean | string>;
  // Computed at save-time from simple/expert mode fields
  selector?: Record<string, unknown> | Record<string, unknown>[] | string;
  advancedParams?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// 4. Extension settings — stored in chrome.storage.sync
// ---------------------------------------------------------------------------
export interface ExtensionSettings {
  canvas_color: string;
  camera_json: string;
  customRules: CustomRule[];
  customPresets: Record<string, Preset>;
  // Dynamic keys: e.g. "protein_rep", "ligand_colorVal", "ion_size"
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// 5. Presets / Templates
// ---------------------------------------------------------------------------
export interface Preset {
  name: string;
  settings: Partial<ExtensionSettings>;
}

// ---------------------------------------------------------------------------
// 6. Message protocol: content script → background
// ---------------------------------------------------------------------------
export interface OpenViewerMessage {
  action: "open_viewer";
  url: string;
  format: string;
}

// ---------------------------------------------------------------------------
// 7. Message protocol: viewer ↔ sandbox iframe
// ---------------------------------------------------------------------------
export interface SandboxReadyMessage {
  action: "SANDBOX_READY";
}

export interface InitMolstarMessage {
  action: "INIT_MOLSTAR";
  /** data: URI string, or null for an empty workspace */
  url: string | null;
  /** Mol* format string, or null for an empty workspace */
  format: string | null;
  settings: ExtensionSettings;
  /** The original remote URL, used to extract a filename for the blob URL hash */
  originalUrl: string | null;
}

// export type SandboxInboundMessage = InitMolstarMessage;
// export type SandboxOutboundMessage = SandboxReadyMessage;
