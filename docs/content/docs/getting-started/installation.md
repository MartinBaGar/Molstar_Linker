+++
title = "Installation"
author = ["Martin Bari Garnier"]
draft = false
+++

## Official Web Stores {#official-web-stores}

The easiest and safest way to install Mol* Linker is through the official browser extension stores. These versions update automatically and have passed rigorous security reviews.

- [Install for Google Chrome / Edge / Brave](https://chrome.google.com/webstore) (Coming Soon)
- [Install for Mozilla Firefox](https://addons.mozilla.org/) (Coming Soon)


## Manual Installation (Developers & Advanced Users) {#manual-installation--developers-and-advanced-users}

If you want to test the latest features before they hit the web store, or if you want to modify the source code, you can install the extension manually.

Mol* Linker uses a **TypeScript** build pipeline and requires a modern **Node.js** environment. The recommended way to build the extension is using **[pixi](https://pixi.sh)**, which manages all dependencies in an isolated environment.


---

### Prerequisites {#prerequisites}

Before building the extension, ensure you have the following installed:

1. **Git**: To clone the repository.
   - Install from [git-scm.com](https://git-scm.com/).
2. **Pixi**: A cross-platform package manager and task runner.
   - Install from [pixi.sh](https://pixi.sh/latest/#installation).
3. **A Modern Browser**: For testing the extension.
   - [Google Chrome](https://www.google.com/chrome/) or [Mozilla Firefox](https://www.mozilla.org/firefox/).


---

### Step 1: Download or Build the Extension {#step-1-download-or-build-the-extension}

#### Option A: Download a Release Zip (Easiest)
1. Go to the [GitHub Releases page](https://github.com/MartinBaGar/molstar_linker/releases).
2. Download the latest `molstar_linker_chrome-vX.Y.Z.zip` or `molstar_linker_firefox-vX.Y.Z.zip`.
3. Extract the zip file into a folder on your computer.


#### Option B: Build from Source
The recommended approach uses **pixi**, which installs all dependencies (Node.js, TypeScript, Vite) in an isolated environment.

1. Clone the repository:
   ```bash
   git clone https://github.com/MartinBaGar/molstar_linker.git
   cd molstar_linker
   ```

2. Install dependencies using **pixi**:
   ```bash
   pixi install
   ```

3. Build for your target browser:
   ```bash
   # Build for Chrome (MV3)
   pixi run build-chrome

   # Build for Firefox (MV2)
   pixi run build-firefox

   # Build for both browsers
   pixi run build
   ```

   The build output will be generated in the `dist/` directory:
   - `dist/chrome/` for Chrome, Edge, and Brave.
   - `dist/firefox/` for Firefox.


---

### Step 2: Load into Your Browser {#step-2-load-into-your-browser}

#### For Chrome / Edge / Brave:
1. Navigate to `chrome://extensions/`.
2. Toggle **Developer mode** ON in the top right corner.
3. Click **Load unpacked**.
4. Select the `dist/chrome` folder.


#### For Firefox:
1. Navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Navigate into the `dist/firefox` folder and select the `manifest.json` file.


---

### Build Output Structure {#build-output-structure}

After a successful build, the `dist/` directory will look like this:
```nil
dist/
├── chrome/          ← Load this in chrome://extensions
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── viewer.js
│   ├── popup.js
│   ├── options.js
│   ├── sandbox.js
│   ├── viewer.html
│   ├── sandbox.html
│   ├── icons/
│   └── lib/
└── firefox/         ← Select manifest.json in about:debugging
    └── ...
```

Each browser folder is fully self-contained and ready to load.


---

### Troubleshooting {#troubleshooting}

#### Build Errors
- **Error: `pixi: command not found`**:
  Ensure **pixi** is installed and added to your `PATH`. See [pixi.sh](https://pixi.sh/latest/#installation) for installation instructions.

- **Error: `Cannot find module 'vite'`**:
  Run `pixi install` to ensure all dependencies are installed.

- **Error: `TypeScript compilation failed`**:
  Run `pixi run typecheck` to diagnose TypeScript errors.


#### Loading Errors
- **Error: `Manifest version 2 is not supported` (Firefox)**:
  Ensure you are loading the `dist/firefox/` folder, not the `dist/chrome/` folder.

- **Error: `Extension context invalidated` (Chrome)**:
  This occurs when the extension is reloaded. Simply reload the extension in `chrome://extensions/`.
