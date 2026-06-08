// src/native-builder.ts
import { Script } from "molstar/lib/mol-script/script";
import type { PluginContext } from 'molstar/lib/mol-plugin/context';
import { Color } from 'molstar/lib/mol-util/color';
import type { ExtensionSettings } from './types.js';

let _lastStructure: any  = null;

export async function customRuleToRep(
  plugin: PluginContext,
  settings: ExtensionSettings,
) {
  for (const rule of settings.customRules || []) {
  // Handle undefined expression
    if (!rule.selection?.script) {  // Check for `script` (not `expression`)
    throw new Error("Selection script is required");
    }

    const script: Script = rule.selection.script;  // Use `script` (not `expression`)
    const expression = Script.toExpression(script);

  // Create component from expression
  const component = await plugin.builders.structure.tryCreateComponentFromExpression(
    _lastStructure,
    expression,
    `custom-rule-${Math.random().toString(36).substring(2, 9)}`,
    { label: rule.meta?.name || "Custom Rule" }
  );

  if (component) {
    await plugin.builders.structure.representation.addRepresentation(
      component,
      { type: "ball-and-stick" } // Customize as needed
    );
    return component;
  } else {
    throw new Error("Failed to create component from selection");
  }
  }
}

export async function globalSettingsUpdate(
  plugin: PluginContext,
  settings: ExtensionSettings,
) {
    plugin.canvas3d?.setProps({
        renderer: { backgroundColor: Color.fromHexStyle(settings.canvas_color as string) },
    });
}

export const NativeBuilder = {
  async buildNativeScene(
    plugin: PluginContext,
    url: string,
    format: string,
    filename: string
  ): Promise<void> {
    const isBinary     = format === 'bcif';
    const parsedFormat = format === 'cif' ? 'mmcif' : format;

    const data       = await plugin.builders.data.download({ url, label: filename, isBinary });
    const trajectory = await plugin.builders.structure.parseTrajectory(data, parsedFormat as any);

    // ------------------------------------------------------------------
    // 1. Apply Mol* built-in preset (e.g., 'auto', 'polymer-and-ligand')
    // ------------------------------------------------------------------
    const presetResult = await plugin.builders.structure.hierarchy.applyPreset(
      trajectory,
      'default',
    );

    // 2. applyPreset can theoretically fail (return undefined), so we must check it.
    if (!presetResult || !presetResult.structure) {
        console.warn('NativeBuilder: Preset failed or returned no structure.');
        return;
    }

    _lastStructure  = presetResult.structure;
  },
};

