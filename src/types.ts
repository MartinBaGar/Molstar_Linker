// src/types.ts

import { ColorTheme } from 'molstar/lib/mol-theme/color';
import { StructureRepresentationRegistry } from 'molstar/lib/mol-repr/structure/registry';
import { CartoonParams } from 'molstar/lib/mol-repr/structure/representation/cartoon';
import type { StructureRepresentationBuiltInProps } from 'molstar/lib/mol-plugin-state/helpers/structure-representation-params';

// ---------------------------------------------------------------------------
// 1. Representation types
// ---------------------------------------------------------------------------
// 1a. Main representation type
type RepType = StructureRepresentationRegistry.BuiltIn | 'off';

// 1b. Custom rules representation type
export type RuleRepType = RepType | "highlight";

// ---------------------------------------------------------------------------
// 3. Custom Rule — the full data model for a user-defined visual rule
// ---------------------------------------------------------------------------
// Block A: Base info every rule must have
export interface RuleMetadata {
  id: string;
  name: string;
  tooltip?: string;
}

// Block B: Where to apply the rule
export interface SelectionCriteria {
  // mode: "simple" | "expert";
  scheme: "auth" | "label";
  chain?: string;
  ranges?: string;
  specific?: string;
  atomName?: string;
  element?: string;
  selector?: Record<string, unknown> | Record<string, unknown>[] | string; // What is it ?
}

// Block C: 3D Label specific settings
export interface LabelConfig {
  text: string;
  size?: string;
  textColor?: string;
  borderWidth?: string;
  borderColor?: string;
}

export interface CustomRuleBase {
  meta?: RuleMetadata;
  selection?: SelectionCriteria;
  label?: LabelConfig;
  focus?: boolean;
}

export interface CustomRule extends CustomRuleBase {
  repprop: StructureRepresentationBuiltInProps;
}

// ---------------------------------------------------------------------------
// 4. Extension settings — stored in chrome.storage.sync
// ---------------------------------------------------------------------------
export interface ExtensionSettings {
  canvas_color: string;
  camera_json: string;
  customRules: CustomRule[];
  [key: string]: unknown;
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
