+++
title = "Custom Domains (Self-Hosted Instances)"
author = ["Martin Bari Garnier"]
draft = false
weight = 400
+++

## Authorizing Private Instances {#authorizing-private-instances}

Many research institutions and universities use self-hosted versions of GitLab, GitHub Enterprise, or Electronic Lab Notebooks (like ElabFTW) behind secure firewalls.

By default, Mol\* Linker only runs on public websites like `github.com` or `rcsb.org`. To use the extension on your private, internal network, you must authorize your custom domain.


## The CORS Advantage {#the-cors-advantage}

In the past, viewing 3D structures from private servers was incredibly difficult due to strict browser security rules known as CORS (Cross-Origin Resource Sharing).

**Mol** Linker v2.0 completely bypasses this limitation.\* When you authorize a custom domain, you grant the extension elevated network privileges for that specific site. The extension can natively securely fetch the structural files from your private server and render them in the local workspace without requiring your IT department to alter server-side CORS headers!


## How to Add a Custom Domain {#how-to-add-a-custom-domain}

1.  Navigate to your self-hosted instance (e.g., `https://gitlab.my-university.edu`).
2.  Click the **Mol** Linker\* puzzle-piece icon in your browser's extension toolbar.
3.  In the popup menu, the extension will automatically detect your current domain.
4.  Click the **Authorize in Studio** button.
5.  Your browser will prompt you to grant permissions for this specific site. Click **Allow**.

Once authorized, the page will refresh, and Mol\* (Workspace) badges will instantly appear next to all supported structural files!


## Managing Authorized Domains {#managing-authorized-domains}

You can view, manage, and revoke access to your custom domains at any time.

1.  Open the extension popup and click **Open Studio (Settings)**.
2.  Navigate to the **Custom Domains** tab on the left sidebar.
3.  Here, you will see a list of all currently authorized domains.
4.  Click **Remove** next to any domain to instantly revoke the extension's access to that site.
