+++
title = "Scene Settings"
author = ["Martin Bari Garnier"]
draft = false
weight = 201
+++

The **Global Scene Settings** panel controls the overall look of the Mol\* viewer, independent of any particular molecule.


## Canvas Background Color {#canvas-background-color}

Sets the viewer background. Click the color swatch to open a color picker, or type a hex value directly (e.g. `#111111` for dark mode).

The default is white (`#ffffff`). If you want a dark background without changing anything else, use the built-in **Dark Mode Canvas** preset from the popup.


## Camera JSON {#camera-json}

Paste a JSON object to lock the camera to a specific position, orientation, and zoom when the viewer opens. This is useful for publication figures or shared links where you want a reproducible viewpoint.

The object is passed directly as a [MolViewSpec](https://molstar.org/viewer-docs/extensions/mvs/) `camera` node. Example:

```json
{
  "target": [0, 0, 0],
  "position": [0, 0, 100],
  "up": [0, 1, 0]
}
```

Leave this field empty to let Mol\* auto-fit the camera to the structure.


## Applying Changes {#applying-changes}

Click **Apply to Mol\*** in the sidebar after making any changes. Settings are saved to your browser's synced storage and used for all subsequent badge clicks.
