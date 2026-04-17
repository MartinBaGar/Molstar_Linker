+++
title = "Installation"
author = ["Martin Bari Garnier"]
draft = false
+++

## Official Web Stores {#official-web-stores}

The easiest and safest way to install Mol\* Linker is through the official browser extension stores. These versions update automatically and have passed rigorous security reviews.

-   [Install for Google Chrome / Edge / Brave](https://chrome.google.com/webstore) (Coming Soon)
-   [Install for Mozilla Firefox](https://addons.mozilla.org/) (Coming Soon)


## Manual Installation (Developers &amp; Advanced Users) {#manual-installation--developers-and-advanced-users}

If you want to test the absolute latest features before they hit the web store, or if you want to modify the source code, you can install the extension manually.

Because Mol\* Linker uses a modern build system to support both Chrome and Firefox from a single codebase, you cannot simply load the raw source folder.


### Step 1: Download or Build the Extension {#step-1-download-or-build-the-extension}

**Option A: Download a Release Zip (Easiest)**

1.  Go to the [GitHub Releases page](https://github.com/YourRepo/Molstar_Linker/releases).
2.  Download the latest `molstar_linker_chrome.zip` or `molstar_linker_firefox.zip`.
3.  Extract the zip file into a folder on your computer.

**Option B: Build from Source (For Developers)**

1.  Clone the repository and install [Just](https://github.com/casey/just).
2.  Open your terminal in the project root and run: `just build`
3.  This will generate clean, ready-to-load extension files inside the `dist/chrome` and `dist/firefox` folders.


### Step 2: Load into your Browser {#step-2-load-into-your-browser}

**For Chrome / Edge / Brave:**

1.  Navigate to `chrome://extensions/`.
2.  Toggle **Developer mode** ON in the top right corner.
3.  Click **Load unpacked**.
4.  Select the extracted folder from Option A, or the `dist/chrome` folder from Option B.

**For Firefox:**

1.  Navigate to `about:debugging#/runtime/this-firefox`.
2.  Click **Load Temporary Add-on**.
3.  Select the `manifest.json` file located inside your extracted folder or the `dist/firefox` folder.
