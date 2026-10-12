((org-mode
  . ((eval . (let* ((root (locate-dominating-file default-directory ".dir-locals.el"))
                    (org-root (expand-file-name "org" root))
                    (docs-dir (expand-file-name "docs" root))
                    (rel-section (file-relative-name default-directory org-root)))

               ;; 1. Tell ox-hugo where the Hugo root is (Absolute path required)
               (setq-local org-hugo-base-dir docs-dir)

               ;; 2. Tell org-img where all your images live (Absolute path)
               (setq-local org-img-dir (expand-file-name "docs/static/assets" root))

               (setq-local org-hugo-section
                           (if (file-equal-p default-directory org-root)
                               "docs"
                             (file-name-as-directory
                              (concat "docs/" (directory-file-name rel-section)))))))
     (eval . (org-hugo-auto-export-mode)))))
