// src/config.ts

import { CartoonParams } from 'molstar/lib/mol-repr/structure/representation/cartoon';
// import { PD } from 'molstar/lib/mol-util/param-definition';
// import type { TargetDefinition, Preset, ExtensionSettings } from './types.js';
import type { ExtensionSettings } from './types.js';
import { ColorTheme } from 'molstar/lib/mol-theme/color';


// ---------------------------------------------------------------------------
// getDefaults — generates the full settings object with sensible default values.
// This is the single source of truth for what keys exist in storage.
// ---------------------------------------------------------------------------
function getDefaults(): ExtensionSettings {
  const defaults: ExtensionSettings = {
    canvas_color:  "#ffffff",
    camera_json:   "",
    customRules:   [],
    customPresets: {},
  };
  defaults.customRules

  return defaults;
}

// ---------------------------------------------------------------------------
// Export as a single namespace object so it can be loaded as a plain script
// (content scripts, sandbox) or as an ES module.
// ---------------------------------------------------------------------------
export const AppConfig = {
  getDefaults,
} as const;
