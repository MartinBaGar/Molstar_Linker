// src/config.ts

import { CartoonParams } from 'molstar/lib/mol-repr/structure/representation/cartoon';
// import { PD } from 'molstar/lib/mol-util/param-definition';
import type { TargetDefinition, Preset, ExtensionSettings } from './types.js';
import { ColorTheme } from 'molstar/lib/mol-theme/color';

// ---------------------------------------------------------------------------
// RepSchema — defines every allowed representation and its configurable params.
// Keys here are the canonical RepType values used everywhere else.
// ---------------------------------------------------------------------------
const RepSchema: Record<string, { label: string; params: Record<string, unknown> }> = {
  cartoon:           { label: "Cartoon",           params: { tubular_helices: 'boolean' } },
  backbone:          { label: "Backbone",          params: {} },
  ball_and_stick:    { label: "Ball & Stick",      params: { ignore_hydrogens: 'boolean' } },
  line:              { label: "Line",              params: { ignore_hydrogens: 'boolean' } },
  spacefill:         { label: "Spacefill",         params: { ignore_hydrogens: 'boolean' } },
  carbohydrate:      { label: "Carbohydrate",      params: {} },
  putty:             { label: "Putty",             params: { size_theme: ['uniform', 'uncertainty'] } },
  molecular_surface: { label: "Molecular Surface", params: { ignore_hydrogens: 'boolean' } },
  gaussian_surface:  { label: "Gaussian Surface",  params: { ignore_hydrogens: 'boolean' } },
  off:               { label: "Hide / Off",        params: {} },
};

// ---------------------------------------------------------------------------
// Targets — the built-in molecular component categories.
// ---------------------------------------------------------------------------

const targets: TargetDefinition[] = [
  { id: "protein",  selector: "protein",  label: "Proteins",                  rep: "cartoon",           color: "chain-id",       alpha: 1.0, quality: "auto", size: null },
  { id: "nucleic",  selector: "nucleic",  label: "Nucleic Acids (DNA/RNA)",   rep: "cartoon",           color: "chain-id",       alpha: 1.0, quality: "auto", size: null },
  { id: "ligand",   selector: "ligand",   label: "Ligands & Small Molecules", rep: "ball-and-stick",    color: "element-symbol", alpha: 1.0, quality: "auto", size: 0.2  },
  { id: "carbs",    selector: "branched", label: "Carbohydrates & Glycans",   rep: "carbohydrate",      color: "chain-id",       alpha: 1.0, quality: "auto", size: null },
  { id: "ion",      selector: "ion",      label: "Single Ions",               rep: "spacefill",         color: "element-symbol", alpha: 1.0, quality: "auto", size: 0.1  },
  { id: "lipid",    selector: "lipid",    label: "Lipids",                    rep: "ball-and-stick",    color: "element-symbol", alpha: 1.0, quality: "auto", size: 0.3  },
  { id: "water", selector: "water", label: "Water / Solvent", rep: "gaussian-surface", color: "element-symbol", alpha: 0.3, quality: "low", size: 2.0 },
];


// ---------------------------------------------------------------------------
// Built-in Presets — Mol* built-in presets mapped to your system
// ---------------------------------------------------------------------------
const builtInPresets: Record<string, Preset> = {
  auto: {
    name: "Automatic (Mol* Default)",
    settings: {},
  },
  "atomic-detail": {
    name: "Atomic Detail",
    settings: {
      protein_rep: "ball_and_stick",
      nucleic_rep: "ball_and_stick",
      ligand_rep: "ball_and_stick",
      carbs_rep: "carbohydrate",
      ion_rep: "spacefill",
      lipid_rep: "ball_and_stick",
      water_rep: "line",
      canvas_color: "#ffffff",
    },
  },
  "polymer-cartoon": {
    name: "Polymer Cartoon",
    settings: {
      protein_rep: "cartoon",
      nucleic_rep: "cartoon",
      ligand_rep: "off",
      carbs_rep: "off",
      ion_rep: "off",
      lipid_rep: "off",
      water_rep: "off",
      canvas_color: "#ffffff",
    },
  },
  "polymer-and-ligand": {
    name: "Polymer & Ligand",
    settings: {
      protein_rep: "cartoon",
      nucleic_rep: "cartoon",
      ligand_rep: "ball_and_stick",
      carbs_rep: "carbohydrate",
      ion_rep: "spacefill",
      lipid_rep: "ball_and_stick",
      water_rep: "gaussian_surface",
      water_alpha: 0.3,
      canvas_color: "#ffffff",
    },
  },
  "protein-and-nucleic": {
    name: "Protein & Nucleic",
    settings: {
      protein_rep: "cartoon",
      nucleic_rep: "gaussian_surface",
      ligand_rep: "off",
      carbs_rep: "off",
      ion_rep: "off",
      lipid_rep: "off",
      water_rep: "off",
      canvas_color: "#ffffff",
    },
  },
  "coarse-surface": {
    name: "Coarse Surface",
    settings: {
      protein_rep: "gaussian_surface",
      nucleic_rep: "gaussian_surface",
      ligand_rep: "off",
      carbs_rep: "off",
      ion_rep: "off",
      lipid_rep: "gaussian_surface",
      water_rep: "off",
      canvas_color: "#ffffff",
    },
  },
  illustrative: {
    name: "Illustrative",
    settings: {
      protein_rep: "spacefill",
      nucleic_rep: "spacefill",
      ligand_rep: "spacefill",
      carbs_rep: "spacefill",
      ion_rep: "spacefill",
      lipid_rep: "spacefill",
      water_rep: "spacefill",
      canvas_color: "#ffffff",
    },
  },
  "molecular-surface": {
    name: "Molecular Surface",
    settings: {
      protein_rep: "molecular_surface",
      nucleic_rep: "molecular_surface",
      ligand_rep: "molecular_surface",
      carbs_rep: "molecular_surface",
      ion_rep: "molecular_surface",
      lipid_rep: "molecular_surface",
      water_rep: "off",
      canvas_color: "#ffffff",
    },
  },
  "auto-lod": {
    name: "Automatic Detail (LOD)",
    settings: {
      protein_rep: "cartoon",
      nucleic_rep: "cartoon",
      ligand_rep: "ball_and_stick",
      carbs_rep: "carbohydrate",
      ion_rep: "spacefill",
      lipid_rep: "ball_and_stick",
      water_rep: "gaussian_surface",
      water_alpha: 0.3,
      canvas_color: "#ffffff",
    },
  },
  dark_mode: {
    name: "Dark Mode Canvas",
    settings: { canvas_color: "#111111" },
  },
};

// ---------------------------------------------------------------------------
// Custom Presets — stored in extApi.storage.sync
// ---------------------------------------------------------------------------
// Function to merge built-in and custom presets
function getAllPresets(customPresets: Record<string, Preset> = {}): Record<string, Preset> {
  return { ...builtInPresets, ...customPresets };
}

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

  for (const t of targets) {
    defaults[`${t.id}_rep`]       = t.rep;
    defaults[`${t.id}_colorType`] = t.color in Object.keys(ColorTheme.BuiltIn) ? 'theme' : 'solid';
    defaults[`${t.id}_colorVal`]  = t.color;
    if (t.size !== null) defaults[`${t.id}_size`] = t.size;
    if (t.alpha !== null) defaults[`${t.id}_alpha`] = t.alpha;

    defaults[`${t.id}_quality`] = t.quality;
  }

  return defaults;
}

// ---------------------------------------------------------------------------
// Export as a single namespace object so it can be loaded as a plain script
// (content scripts, sandbox) or as an ES module.
// ---------------------------------------------------------------------------
export const AppConfig = {
  RepSchema,
  targets,
  getAllPresets,
  builtInPresets,
  getDefaults,
} as const;
