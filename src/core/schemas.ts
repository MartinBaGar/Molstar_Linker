import * as v from "valibot";
import { ALL_EXTENSIONS } from "~/core/extensions";
import { MAX_URL_LENGTH } from "~/utils/links";

// A file extension Mol* can read. The output is lowercased, so the value you
// use later is the same value that was validated.
const FormatSchema = v.pipe(
  v.string(),
  v.toLowerCase(),
  v.check((s) => ALL_EXTENSIONS.has(s), "Unsupported format"),
);

// "Open an empty workspace": no file, nothing else needed.
const EmptyInitSchema = v.object({
  action: v.literal("INIT_MOLSTAR"),
  buffer: v.null(),
});

// "Load a file": a buffer AND a valid format are both required.
const LoadInitSchema = v.object({
  action: v.literal("INIT_MOLSTAR"),
  buffer: v.instance(ArrayBuffer),
  format: FormatSchema,
  mimeType: v.nullish(v.string()),
  originalUrl: v.nullish(v.pipe(v.string(), v.maxLength(MAX_URL_LENGTH))),
});

export const InitMolstarMessageSchema = v.union([
  EmptyInitSchema,
  LoadInitSchema,
]);

export const SettingsUpdatedSchema = v.object({
  action: v.literal("SETTINGS_UPDATED"),
  settings: v.unknown(),
});

export type InitMolstarMessage = v.InferOutput<typeof InitMolstarMessageSchema>;
