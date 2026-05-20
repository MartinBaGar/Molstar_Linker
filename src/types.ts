// src/types.ts

import { StructureRepresentationRegistry } from 'molstar/lib/mol-repr/structure/registry';
import { CartoonParams } from 'molstar/lib/mol-repr/structure/representation/cartoon';

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
  meta?: RuleMetadata;  // Changed from required to optional
  selection?: SelectionCriteria;
  label?: LabelConfig;
  focus?: boolean;
}

// export interface CustomRuleBase {
//   meta: RuleMetadata;
//   selection: SelectionCriteria;
//   label?: LabelConfig;
//   focus?: boolean;
//   // name: string;
//   // tooltip?: string;
//   // rawJson: string;
//   // rawParamsJson: string;
//   // subParams: Record<string, boolean | string>;
//   // selector?: Record<string, unknown> | Record<string, unknown>[] | string;
//   // advancedParams?: Record<string, unknown>;
// }

// Cartoon Representation
// export interface CartoonRule extends CustomRuleBase {
//   type: "cartoon";
//   colorType: "theme" | "solid";
//   colorVal: string; // e.g., "#00ff00"
//   // No props field needed!
// }

export interface CartoonRule extends CustomRuleBase {
  type: "cartoon";
  colorType?: "theme" | "solid";
  colorVal?: string;
}

export type CustomRule =
  | CartoonRule
  ;

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
