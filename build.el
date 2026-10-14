;;; build.el --- -*- lexical-binding: t; -*-

(require 'ox-publish)

;; Project root = the folder containing this file.
(defconst site-root
  (file-name-directory (or load-file-name buffer-file-name)))

(defun site-path (rel)
  (expand-file-name rel site-root))

;; Our code (site.el needs site-path, so it loads after it)
(load (site-path "tools/org-img.el"))
(load (site-path "tools/site.el"))

(setq org-img-dir (site-path "org/assets/"))

(setq org-publish-project-alist
      `(("pages"
         :base-directory ,(site-path "org/")
         :base-extension "org"
         :publishing-directory ,(site-path "docs/")
         :recursive t
         :publishing-function org-html-publish-to-html
         :html-doctype "html5"
         :html-html5-fancy t
         :with-toc 3
         :section-numbers nil
         :with-author nil
         :html-postamble nil
         :html-preamble site-nav
         :html-head-include-default-style nil
         :html-head-include-scripts nil)

        ("static"
         :base-directory ,(site-path "org/")
         :base-extension "png\\|jpg\\|jpeg\\|gif\\|svg\\|webp\\|css\\|js"
         :publishing-directory ,(site-path "docs/")
         :recursive t
         :publishing-function org-publish-attachment)

        ("site" :components ("pages" "static"))))

;; Publish only in batch, so loading this file in an open Emacs
;; just defines the project.
(when noninteractive
  (org-publish "site" t))
