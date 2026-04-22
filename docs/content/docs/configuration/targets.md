+++
title = "Molecular Targets"
author = ["Martin Bari Garnier"]
draft = false
weight = 202
+++

The **Global Target Configurations** panel lets you set the default visual style for each class of molecule. Each target is a collapsible card.


## Available Targets {#available-targets}

| Target                        | Selector   | Default Representation | Default Color  |
|-------------------------------|------------|------------------------|----------------|
| Proteins                      | `protein`  | Cartoon                | Chain ID       |
| Nucleic Acids (DNA/RNA)       | `nucleic`  | Cartoon                | Chain ID       |
| Ligands &amp; Small Molecules | `ligand`   | Ball &amp; Stick       | Element symbol |
| Carbohydrates &amp; Glycans   | `branched` | Ball &amp; Stick       | Element symbol |
| Lipids                        | `lipid`    | Ball &amp; Stick       | Element symbol |
| Single Ions                   | `ion`      | Ball &amp; Stick       | Element symbol |
| Water / Solvent               | `water`    | Hidden (Off)           | —              |
| All Atoms                     | `all`      | Ball &amp; Stick       | Element symbol |

The `all` target is a catch-all that applies to every atom in the structure. It is useful as a fallback representation but is hidden by default. Enable it only when you want a uniform style applied across the entire structure regardless of molecule type.


## Representation Types {#representation-types}

Each target can use any of the following representations:

| Key              | Label            | Extra Options                        |
|------------------|------------------|--------------------------------------|
| `cartoon`        | Cartoon          | Tubular helices on/off               |
| `backbone`       | Backbone         | —                                    |
| `ball_and_stick` | Ball &amp; Stick | Ignore hydrogens on/off              |
| `line`           | Line             | Ignore hydrogens on/off              |
| `spacefill`      | Spacefill        | Ignore hydrogens on/off              |
| `carbohydrate`   | Carbohydrate     | —                                    |
| `putty`          | Putty            | Size theme: uniform / uncertainty    |
| `surface`        | Surface          | Type: molecular / gaussian; ignore H |
| `off`            | Hide             | Omits this target from the scene     |


## Color {#color}

Each target has a color mode toggle:

-   **Theme** — uses a Mol\* built-in coloring scheme applied dynamically to the structure (e.g. `chain-id`, `element-symbol`, `secondary-structure`, `residue-name`, `sequence-id`, `uncertainty`, `b-factor`)
-   **Solid** — a single flat hex color applied uniformly to all atoms in the target


## Size &amp; Opacity {#size-and-opacity}

-   **Size** maps to the `size_factor` parameter in MolViewSpec, scaling atom/bond radius relative to the default
-   **Opacity** (0–1) adds a MolViewSpec `opacity` node; particularly useful for making surfaces semi-transparent while keeping the cartoon underneath visible


## Applying Changes {#applying-changes}

Click **Apply to Mol\*** in the sidebar. Changes are saved to your browser's synced storage and take effect on the next badge click or workspace load.


## Sub-Parameters {#sub-parameters}

Some representations expose additional options in a collapsible drawer below the style selector:

| Representation   | Option           | Effect                                                  |
|------------------|------------------|---------------------------------------------------------|
| Cartoon          | Tubular helices  | Renders helices as cylinders instead of ribbons         |
| Ball &amp; Stick | Ignore hydrogens | Hides hydrogen atoms                                    |
| Line             | Ignore hydrogens | Hides hydrogen atoms                                    |
| Spacefill        | Ignore hydrogens | Hides hydrogen atoms                                    |
| Surface          | Ignore hydrogens | Excludes hydrogens from surface calculation             |
| Surface          | Type             | `molecular` (VdW) or `gaussian` (smooth density)        |
| Putty            | Size theme       | `uniform` (constant radius) or `uncertainty` (B-factor) |
