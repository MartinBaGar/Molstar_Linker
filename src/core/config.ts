import type { ExtensionSettings } from '~/types/index.js';

// ---------------------------------------------------------------------------
// getDefaults — generates the full settings object with sensible default values.
// This is the single source of truth for what keys exist in storage.
// ---------------------------------------------------------------------------
function getDefaults(): ExtensionSettings {
    const defaults: ExtensionSettings = {
        customRules: [],
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
