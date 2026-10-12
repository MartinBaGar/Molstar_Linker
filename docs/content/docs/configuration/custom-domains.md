+++
title = "Custom Domains"
draft = false
weight = 310
+++

Mol\* Linker supports private instances of GitLab, Nextcloud, and other platforms. To enable the extension on custom domains:

1.  Open the **Mol** Linker popup\* by clicking the extension icon in your browser toolbar.
2.  Navigate to the **Options** tab.
3.  In the **Custom Domains** section, enter the domain (e.g., `institutional.gitlab.com`).
4.  Click **Authorize**. Your browser will prompt you to grant permissions for the domain.
5.  Confirm the permission request.

The extension will now inject badges on the authorized domain. No page refresh is required.

**Friction Points**:

-   You must grant permissions for each custom domain individually.
-   The domain must use `https://` and be publicly accessible (no private IP addresses).
-   If the badge doesn’t appear, check the [FAQ]({{< relref "faq" >}}) for troubleshooting steps.
