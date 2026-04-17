+++
title = "Quickstart"
author = ["Martin Bari Garnier"]
draft = false
+++

Once the extension is installed, no configuration is needed to get started.


## See Your First Structure {#see-your-first-structure}

1.  Navigate to any GitHub or GitLab repository that contains a `.pdb`, `.cif`, or other [supported file](../../#supported-formats)
2.  Look for a green **Mol** (MVS)\* badge next to file names in the file browser, or next to links in README files
3.  Click the badge — the structure opens in the Mol\* viewer in a new tab, rendered with your current settings


## Change the Active Preset {#change-the-active-preset}

Click the extension icon in your browser toolbar to open the popup:

1.  Select a preset from the **Active Configuration** dropdown (e.g. "Protein Surface + Spacefill Ligands")
2.  Click **Apply &amp; Reload Tab**
3.  The current page reloads and new badges will use the selected preset


## Open the Full Settings Studio {#open-the-full-settings-studio}

Click **Open Advanced Studio** in the popup, or right-click the extension icon and choose **Options**. The studio lets you configure representations, colors, custom highlight rules, and templates in detail — see [Configuration](../configuration).


## Working with Unknown Databases {#working-with-unknown-databases}

Mol\* Linker is equipped with a Universal "Smart Scanner" that can automatically detect structural files on almost any database (like Figshare, Zenodo, or university servers). If the extension detects a valid structure nearby, the Mol\* Workspace badge will appear automatically.


### The Right-Click Fallback {#the-right-click-fallback}

If you are on a highly customized or obscure database where the green badge does not automatically appear next to a download link, you can still use the extension!

1.  ****Right-Click**** the download button or link.
2.  Select **\*"Open in Mol** Workspace"\*\* from the browser's context menu.
3.  If the extension cannot automatically guess the file type from the website's code, it will present a clean dropdown asking you if it is a PDB, mmCIF, GRO, etc. Select the format, and your workspace will launch instantly!
