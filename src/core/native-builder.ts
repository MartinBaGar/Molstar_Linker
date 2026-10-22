import { Script } from "molstar/lib/mol-script/script";
import type { PluginContext } from "molstar/lib/mol-plugin/context";
import type { ExtensionSettings } from "~/types/index.js";

// Structure reference of the most recently loaded model (rules are applied to it).
let _lastStructure: any = null;

const REP_TYPE_RE = /^[a-z-]{1,40}$/;
const MAX_RULES = 100;
const MAX_EXPRESSION_LENGTH = 10_000;
let componentCounter = 0;

export interface RuleResult {
  applied: number;
  errors: string[];
}

export async function customRuleToRep(
  plugin: PluginContext,
  settings: ExtensionSettings,
): Promise<RuleResult> {
  const result: RuleResult = { applied: 0, errors: [] };

  if (!_lastStructure) {
    result.errors.push("No structure is loaded yet.");
    return result;
  }

  const rules: any[] = Array.isArray(settings?.customRules)
    ? settings.customRules.slice(0, MAX_RULES)
    : [];

  for (const rule of rules) {
    const label = String(rule?.meta?.name ?? "Custom Rule").slice(0, 100);

    try {
      const script = rule?.selection?.script;
      if (
        !script ||
        typeof script.expression !== "string" ||
        typeof script.language !== "string" ||
        script.expression.length > MAX_EXPRESSION_LENGTH
      ) {
        throw new Error("Selection script is missing or invalid");
      }

      const repType = rule?.repprop?.type;
      if (typeof repType !== "string" || !REP_TYPE_RE.test(repType)) {
        throw new Error("Representation type is missing or invalid");
      }

      const expression = Script.toExpression(script as Script);

      const component =
        await plugin.builders.structure.tryCreateComponentFromExpression(
          _lastStructure,
          expression,
          `custom-rule-${++componentCounter}`,
          { label },
        );

      if (!component) {
        throw new Error(
          "Selection matched nothing or component creation failed",
        );
      }

      await plugin.builders.structure.representation.addRepresentation(
        component,
        { type: repType as any },
      );
      result.applied++;
    } catch (e) {
      // One bad rule must not stop the others.
      result.errors.push(
        `${label}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return result;
}

export const NativeBuilder = {
  async buildNativeScene(
    plugin: PluginContext,
    url: string,
    format: string,
    filename: string,
  ): Promise<void> {
    _lastStructure = null;

    const isBinary = format === "bcif";
    const parsedFormat = format === "cif" ? "mmcif" : format;

    const data = await plugin.builders.data.download({
      url,
      label: filename,
      isBinary,
    });
    const trajectory = await plugin.builders.structure.parseTrajectory(
      data,
      parsedFormat as any,
    );

    // Apply Mol*'s built-in preset.
    const presetResult = await plugin.builders.structure.hierarchy.applyPreset(
      trajectory,
      "default",
    );

    // applyPreset can fail and return undefined, so it must be checked.
    if (!presetResult || !presetResult.structure) {
      throw new Error("Mol* could not build a structure from this file.");
    }

    _lastStructure = presetResult.structure;
  },
};
