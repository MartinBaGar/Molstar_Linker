+++
title = "Custom Domains"
author = ["Martin Bari Garnier"]
draft = false
weight = 400
+++

By default, Mol\* Linker runs on `github.com`, `gitlab.com`, `rcsb.org`, and `alphafold.ebi.ac.uk`. You can authorize it to run on private or self-hosted GitLab instances too.


## Authorize a New Domain {#authorize-a-new-domain}


### From the Popup {#from-the-popup}

When you visit a page on an unauthorized domain, the popup shows an **Authorize in Studio** button. Clicking it opens the Studio with the domain pre-filled.


### From the Studio {#from-the-studio}

In the **Managed Custom Domains** panel at the bottom of the Studio:

1.  Type the hostname in the input field (e.g. `gitlab.my-lab.org`)
2.  Click **+ Add Domain**
3.  Your browser will show a permission dialog — accept it

The extension then:

-   Registers a dynamic content script for that domain
-   Saves the hostname to your synced storage
-   Starts injecting badges immediately on matching pages


## Revoke a Domain {#revoke-a-domain}

In the **Managed Custom Domains** panel, click **Revoke** next to any domain. This:

-   Unregisters the content script
-   Removes the host permission
-   Removes the domain from your saved list


## Firefox Note {#firefox-note}

Firefox requires that permission requests happen directly in response to a user click — with no asynchronous operations in between. Mol\* Linker handles this correctly: the permission dialog is triggered immediately when you click **Add Domain**, before any other work is done.


## GitLab URL Pattern {#gitlab-url-pattern}

For self-hosted GitLab instances, the extension uses the GitLab API v4 to fetch raw file content. The URL transformation follows this pattern:

```text
https://<domain>/<namespace>/-/blob/<ref>/<filepath>
  →
https://<domain>/api/v4/projects/<encoded-namespace>/repository/files/<encoded-filepath>/raw?ref=<ref>
```

This works for any GitLab instance version that supports API v4 (GitLab 9.0+).
