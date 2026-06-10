import { DataFormatRegistry } from 'molstar/lib/mol-plugin-state/formats/registry';

const _reg = new DataFormatRegistry();

export const ALL_EXTENSIONS = new Set([
  ...Array.from(_reg.extensions),
  ...Array.from(_reg.binaryExtensions),
]);
