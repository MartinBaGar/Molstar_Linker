+++
title = "FAQ & Troubleshooting"
author = ["Martin Bari Garnier"]
draft = false
weight = 600
+++

## No badges are appearing {#no-badges-are-appearing}

-   Make sure you are on a [supported domain](../getting-started/installation#permissions) (GitHub, GitLab, RCSB, AlphaFold)
-   Check that the file has a [supported extension](../#supported-formats) (`.pdb`, `.cif`, etc.)
-   Try reloading the page — SPA navigation occasionally loads content after the initial scan
-   On private domains, confirm the domain is authorized in the [Custom Domains](../custom-domains) panel


## The badge appears but the viewer shows an error {#the-badge-appears-but-the-viewer-shows-an-error}

The most common cause is a CORS restriction on the raw file URL. GitHub and public GitLab work out of the box. For private GitLab instances, make sure the server allows cross-origin requests from `molstar.org`, or check with your sysadmin.


## My private GitLab domain is not being detected {#my-private-gitlab-domain-is-not-being-detected}

The extension matches self-hosted GitLab URLs using a pattern that expects the standard GitLab URL structure:

```text
https://<domain>/<namespace>/-/blob/<ref>/<filepath>
```

If your instance uses a custom URL layout, the pattern will not match. Please open an issue on [GitHub](https://github.com/MartinBaGar/molstar_linker/issues).


## I authorized a domain but nothing happens {#i-authorized-a-domain-but-nothing-happens}

After authorizing a new domain, reload the page. Dynamic content script registration takes effect on the next page load.


## Settings are not persisting {#settings-are-not-persisting}

Mol\* Linker uses `chrome.storage.sync`. If you are signed out of your browser account, storage may not sync across devices — but it should still persist locally. Try clicking **Apply to Mol\*** again and reloading the page.


## How do I reset to defaults? {#how-do-i-reset-to-defaults}

Open the Studio, load the **Standard Mol** (Smart Guess)\* built-in preset, and click **Apply to Mol\***. This resets all target representations to defaults without deleting your saved templates.


## What is MolViewSpec? {#what-is-molviewspec}

[MolViewSpec (MVS)](https://molstar.org/viewer-docs/extensions/mvs/) is a declarative JSON schema for describing 3D molecular scenes. Instead of relying on Mol\*'s auto-guess, Mol\* Linker builds an MVS document from your settings and encodes it in the viewer URL — giving you full control over what the viewer shows on first load.


## Can I use this for structures not hosted on GitHub or GitLab ? {#can-i-use-this-for-structures-not-hosted-on-github-or-gitlab}

Not directly — the extension only injects badges for links it finds on supported pages. If you want to open an arbitrary URL in Mol\* with MVS settings, you would need to construct the viewer URL manually using the MolViewSpec schema.
