((org-mode
  . ((eval . (setq-local org-img-dir
                         (expand-file-name
                          "org/assets"
                          (locate-dominating-file default-directory ".dir-locals.el")))))))
