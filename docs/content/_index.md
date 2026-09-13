+++
title = "Mol* Linker"
author = ["Martin Bari Garnier"]
draft = false
+++

<iframe
  src="https://molstar.org/viewer/?snapshot-url=https://martinbagar.github.io/Molstar_Linker/models/welcome.molj&snapshot-url-type=molj&hide-controls=1"
  width="100%"
  height="200px"
  style="border: none; border-radius: 8px; margin-top: 2rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
</iframe>

Mol\* Linker is a browser extension for Chrome and Firefox that automatically detects molecular structure file links on GitHub, GitLab, and other supported domains. It injects a one-click badge to open these files in the [Mol\* web viewer](https://molstar.org/viewer/) — rendered natively with your preferred visual styles.

No downloads. No local software. Click a badge, see your structure in 3D.


## Features {#features}

-   Automatic badge injection on GitHub, GitLab, and authorized custom domains
-   Native Mol\* rendering engine for high-performance visualization
-   Full scene customization: per-molecule representations, colors, and transparency
-   Custom rules for highlighting chains, residues, atoms, or arbitrary selections
-   Named presets — save, share, and import JSON configurations
-   Works on private / self-hosted GitLab instances
-   Handles SPA navigation (no page reload required)
-   Secure file fetching with built-in anti-SSRF protection


## Supported Formats {#supported-formats}

`.pdb`, `.cif`, `.mmcif`, `.bcif`, `.gro`, `.mol`, `.mol2`, `.sdf`, `.xyz`, `.ent`


## Install {#install}

| Browser | Link                    |
|---------|-------------------------|
| Chrome  | Chrome Web Store (link) |
| Firefox | Firefox Add-ons (link)  |

Or clone [the repository](https://github.com/MartinBaGar/molstar_linker) and load it as an unpacked extension.
