// src/config.ts
import type { ExtensionSettings } from './types.js';


export const ViewerConfig = {
    viewerUrl: "viewer.html", // Relative to extension root
};

// ---------------------------------------------------------------------------
// getDefaults — generates the full settings object with sensible default values.
// This is the single source of truth for what keys exist in storage.
// ---------------------------------------------------------------------------
function getDefaults(): ExtensionSettings {
    const defaults: ExtensionSettings = {
        canvas_color: "#ffffff",
        camera_json: "",
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
