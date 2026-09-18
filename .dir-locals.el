((org-mode
  . ((eval
      . (let* ((root (locate-dominating-file default-directory ".dir-locals.el"))
               (org-root (expand-file-name "org" root))
               (assets-dir (expand-file-name "assets" root))
               (docs-dir (expand-file-name "docs" root))
               (rel-section (file-relative-name default-directory org-root)))

          (setq-local org-img-dir
                      (concat (file-relative-name assets-dir default-directory) "/docs/" (file-name-base buffer-file-name)))

          (setq-local org-hugo-base-dir
                      (file-relative-name docs-dir default-directory))

          (setq-local org-hugo-section
                      (if (file-equal-p default-directory org-root)
                          "docs"
                        (file-name-as-directory
                         (concat "docs/" (directory-file-name rel-section)))))))
     (eval . (org-hugo-auto-export-mode)))))
