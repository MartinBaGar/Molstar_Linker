+++
title = "Installation"
author = ["Martin Bari Garnier"]
draft = false
+++

## Chrome {#chrome}

1.  Go to the Chrome Web Store page (link TBD)
2.  Click **Add to Chrome**
3.  Confirm the permissions dialog


## Firefox {#firefox}

1.  Go to the Firefox Add-ons page (link TBD)
2.  Click **Add to Firefox**
3.  Confirm the permissions dialog


## Load Unpacked (Development) {#load-unpacked--development}

Clone the repository and load it manually for local development or testing:

```bash
git clone https://github.com/MartinBaGar/molstar_linker
```

Then:

-   **Chrome**: open `chrome://extensions`, enable Developer Mode, click **Load unpacked**, select the repo folder
-   **Firefox**: open `about:debugging`, click **This Firefox**, click **Load Temporary Add-on**, select `manifest.json`


## Permissions {#permissions}

The extension requests the following permissions on install:

| Permission  | Why                                                          |
|-------------|--------------------------------------------------------------|
| `activeTab` | Detect the current tab's hostname in the popup               |
| `storage`   | Persist your settings and templates across sessions          |
| `scripting` | Dynamically enable the extension on custom / private domains |

Host access is granted by default for `github.com`, `gitlab.com`, `rcsb.org`, and `alphafold.ebi.ac.uk`. Private domains can be added later — see [Custom Domains](../custom-domains).
