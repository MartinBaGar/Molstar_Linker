+++
title = "Contributing & Build System"
author = ["Martin Bari Garnier"]
draft = false
+++

## Development Workflow {#development-workflow}

The Mol\* Linker extension utilizes a **Single Source of Truth** architecture managed by a `Justfile`.

Because Chrome and Firefox require fundamentally different `manifest.json` configurations, **you must never place a manifest directly in the `src/` directory.**


### Directory Structure {#directory-structure}

-   `src/` : Contains all universal JavaScript, HTML, and CSS.
-   `manifests/` : Contains `chrome.json` and `firefox.json`.
-   `dist/` : (Git-ignored) The generated build folders for local testing.
-   `releases/` : (Git-ignored) The generated `.zip` packages for Web Store deployment.


## Build Commands (via Just) {#build-commands--via-just}

Ensure you have [Just](https://github.com/casey/just) installed on your system.


### 1. Local Testing {#1-dot-local-testing}

To compile the source code and manifests into loadable directories:

```bash
just build
```

-   Load `dist/chrome` as an "Unpacked Extension" in Chrome.
-   Load `dist/firefox` as a "Temporary Add-on" in Firefox.


### 2. Version Bumping {#2-dot-version-bumping}

To safely update the version number across all manifest files simultaneously:

```bash
just bump 2.1.0
```


### 3. Packaging Releases {#3-dot-packaging-releases}

To generate clean, production-ready `.zip` files for both browsers:

```bash
just zip 2.1.0
```

The outputs will be placed in the `releases/` directory.


### 4. Automated CI/CD Publishing {#4-dot-automated-ci-cd-publishing}

If you have the GitHub CLI (`gh`) installed, you can bump, commit, tag, build, and publish a release directly to the GitHub repository in a single command:

```bash
just publish 2.1.0
```
