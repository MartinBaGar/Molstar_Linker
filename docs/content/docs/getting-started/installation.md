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

If you want to test the latest features before they hit the web store, or if you want to modify the source code, you can install the extension manually.

Mol\* Linker uses a TypeScript build pipeline — you cannot simply load the raw source folder. You need to build it first.


### Step 1: Download or Build the Extension {#step-1-download-or-build-the-extension}

**Option A: Download a Release Zip (Easiest)**

1.  Go to the [GitHub Releases page](https://github.com/MartinBaGar/molstar_linker/releases).
2.  Download the latest `molstar_linker_chrome-vX.Y.Z.zip` or `molstar_linker_firefox-vX.Y.Z.zip`.
3.  Extract the zip file into a folder on your computer.

**Option B: Build from Source**

The recommended approach uses [pixi](https://pixi.sh), which installs all dependencies (Node.js, TypeScript, esbuild) in an isolated environment — no system-level installs required.

1.  Clone the repository:

<!--listend-->

```bash
git clone https://github.com/MartinBaGar/molstar_linker.git
cd molstar_linker
```

1.  Install the pixi environment (once):

<!--listend-->

```bash
pixi install
```

1.  Build for your target browser:

<!--listend-->

```bash
pixi run npm run build:chrome    # → dist/chrome/
pixi run npm run build:firefox   # → dist/firefox/
pixi run npm run build           # → both at once
```

If you already have a compatible Node.js environment, you can also use npm directly:

```bash
npm install
npm run build
```


### Step 2: Load into your Browser {#step-2-load-into-your-browser}

**For Chrome / Edge / Brave:**

1.  Navigate to `chrome://extensions/`.
2.  Toggle **Developer mode** ON in the top right corner.
3.  Click **Load unpacked**.
4.  Select the `dist/chrome` folder.

**For Firefox:**

1.  Navigate to `about:debugging#/runtime/this-firefox`.
2.  Click **Load Temporary Add-on**.
3.  Navigate into the `dist/firefox` folder and select the `manifest.json` file.


### Build Output Structure {#build-output-structure}

After a successful build, the `dist/` directory looks like this:

```nil
dist/
├── chrome/          ← load this in chrome://extensions
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── viewer.js
│   ├── popup.js
│   ├── options.js
│   ├── sandbox.js
│   ├── viewer.html / sandbox.html / ...
│   ├── icons/
│   └── lib/
└── firefox/         ← select manifest.json in about:debugging
    └── ...
```

Each browser folder is fully self-contained and ready to load.
