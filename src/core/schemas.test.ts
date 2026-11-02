import { describe, expect, it } from "vitest";
import * as v from "valibot";
import { SettingsUpdatedSchema } from "./schemas";

describe("SettingsUpdatedSchema", () => {
  it("accepts a settings update", () => {
    const r = v.safeParse(SettingsUpdatedSchema, {
      action: "SETTINGS_UPDATED",
      settings: { anything: 1 },
    });
    expect(r.success).toBe(true);
  });

  it.each([null, undefined, "SETTINGS_UPDATED", 42, {}, { action: "OTHER" }])(
    "rejects %j",
    (input) => {
      expect(v.safeParse(SettingsUpdatedSchema, input).success).toBe(false);
    },
  );
});
