+++
title = "Contributing"
author = ["Martin Bari Garnier"]
draft = false
weight = 503
+++

## Add a New Supported File Format {#add-a-new-supported-file-format}

1.  Add the extension string (with leading dot) to the `SUPPORTED_EXT` Set in `content.js`
2.  If Mol\* uses a different parser name, add a mapping in `getMolstarUrl()` alongside the existing `cif` → `mmcif` case


## Add a New Platform {#add-a-new-platform}

1.  Add an entry to `GITLAB_PATTERNS` in `content.js` with:
    -   A regex capturing `(domain, namespace, ref, filepath)` groups
    -   A `buildApiUrl` function that constructs the raw file URL
2.  Update the badge color logic in `makeBadge()` if needed


## Add a New Built-in Preset {#add-a-new-built-in-preset}

Add an entry to `AppConfig.presets` in `config.js`:

```javascript
"my_preset": {
  name: "My Preset Name",
  settings: {
    "protein_rep": "surface",
    "canvas_color": "#1a1a2e"
  }
}
```

Any key omitted from `settings` falls back to the value from `getDefaults()`.


## Add a New Representation Type {#add-a-new-representation-type}

1.  Add the key to `AppConfig.RepSchema` with its `label` and `params` descriptor
2.  The options UI generates the representation select and parameter drawer automatically from `RepSchema` — no UI code changes needed


## Firefox Compatibility {#firefox-compatibility}

-   Use `typeof globalThis.browser !=` 'undefined' ? globalThis.browser : chrome= for all extension API calls
-   Never `await` anything before calling `permissions.request()` — Firefox's user-gesture context does not survive async gaps
-   Test against the minimum version declared in `browser_specific_settings.gecko.strict_min_version` (currently 128.0)
