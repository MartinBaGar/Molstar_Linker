((org-mode
  . ((eval . (setq-local org-img-dir
                         (expand-file-name
                          "org/assets/img"
                          (locate-dominating-file default-directory ".dir-locals.el")))))))
