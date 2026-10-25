import type { InitMolstarMessage } from "~/types/index.js";
import { ALL_EXTENSIONS } from "~/core/extensions";

const FORMAT_RE = /^[a-z0-9]{1,16}$/i;

export function isValidInit(msg: any): msg is InitMolstarMessage {
  if (!msg || typeof msg !== "object") return false;
  if (msg.buffer === null) return true;

  const isValidFormat =
    typeof msg.format === "string" &&
    ALL_EXTENSIONS.has(msg.format.toLowerCase());

  return (
    msg.buffer instanceof ArrayBuffer &&
    isValidFormat &&
    (msg.mimeType == null || typeof msg.mimeType === "string") &&
    (msg.originalUrl == null || typeof msg.originalUrl === "string")
  );
}
