import { Script } from 'molstar/lib/mol-script/types';
import { StructureRepresentationRegistry } from 'molstar/lib/mol-repr/structure/registry';
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

export interface SelectionCriteria {
    scheme?: "auth" | "label";
    chain?: string;
    ranges?: string;
    specific?: string;
    atomName?: string;
    element?: string;
    prompt?: string;
    script?: Script;
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
}

export interface CustomRule extends CustomRuleBase {
    repprop: StructureRepresentationBuiltInProps;
}

// ---------------------------------------------------------------------------
// 4. Extension settings — stored in chrome.storage.sync
// ---------------------------------------------------------------------------
export interface ExtensionSettings {
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
    url: string | null;
    format: string | null;
    originalUrl: string | null;
}
