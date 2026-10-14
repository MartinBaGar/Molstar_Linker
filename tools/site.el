;;; site.el --- menu and preamble for the docs site -*- lexical-binding: t; -*-

;; Loaded by build.el, which defines `site-path' first.
;; Nothing here is run on its own.

;;; Reading #+title: and #+weight: from Org files

(defun site-meta (file key)
  "Return the value of the first #+KEY: line in FILE, or nil."
  (with-temp-buffer
    (insert-file-contents file nil 0 4000)
    (let ((case-fold-search t))
      (goto-char (point-min))
      (when (re-search-forward (format "^#\\+%s:[ \t]*\\(.*\\)$" key) nil t)
        (string-trim (match-string 1))))))

(defun site-title (file)
  (or (site-meta file "title") (file-name-base file)))

(defun site-weight (file)
  "Menu order. Reads #+weight: or #+hugo_weight:, default 9999."
  (string-to-number
   (or (site-meta file "weight") (site-meta file "hugo_weight") "9999")))

;;; Menu generation

(defun site-items (dir)
  "List of (PATH TITLE WEIGHT IS-DIR) for the entries of DIR, sorted."
  (let (items)
    (dolist (f (directory-files dir t "^[^.]"))
      (let ((name (file-name-nondirectory f)))
        (cond
         ((and (file-directory-p f) (not (equal name "assets")))
          (let* ((idx (expand-file-name "index.org" f))
                 (has (file-exists-p idx)))
            (push (list f
                        (if has (site-title idx) name)
                        (if has (site-weight idx) 9999)
                        t)
                  items)))
         ((and (string-suffix-p ".org" f) (not (equal name "index.org")))
          (push (list f (site-title f) (site-weight f) nil) items)))))
    (sort items
          (lambda (a b)
            (or (< (nth 2 a) (nth 2 b))
                (and (= (nth 2 a) (nth 2 b))
                     (string< (nth 1 a) (nth 1 b))))))))

(defun site-href (file up)
  "Relative URL of Org FILE's HTML page, from a page whose root prefix is UP."
  (concat up
          (file-name-sans-extension (file-relative-name file (site-path "org/")))
          ".html"))

(defun site-menu (dir current up)
  "Nested <ul> for DIR; CURRENT is the page being exported."
  (concat
   "<ul>"
   (mapconcat
    (lambda (it)
      (let ((f (nth 0 it)) (title (nth 1 it)))
        (if (not (nth 3 it))
            (format "<li><a%s href=\"%s\">%s</a></li>"
                    (if (file-equal-p f current) " class=\"active\"" "")
                    (site-href f up) title)
          (let* ((idx (expand-file-name "index.org" f))
                 (open (string-prefix-p (file-name-as-directory f) current))
                 (label (if (file-exists-p idx)
                            (format "<a%s href=\"%s\">%s</a>"
                                    (if (file-equal-p idx current) " class=\"active\"" "")
                                    (site-href idx up) title)
                          title)))
            (format "<li><details%s><summary>%s</summary>%s</details></li>"
                    (if open " open" "") label
                    (site-menu f current up))))))
    (site-items dir) "")
   "</ul>"))

;;; Preamble: the one function ox-html calls for every page

(defun site-nav (info)
  "Preamble: stylesheet, brand, left menu, theme button and script."
  (let* ((current (expand-file-name (plist-get info :input-file)))
         (rel (file-relative-name current (site-path "org/")))
         (up (apply #'concat (make-list (1- (length (split-string rel "/"))) "../"))))
    (concat
     (format "<link rel=\"stylesheet\" href=\"%sassets/site/site.css\" />" up)
     (format "<a class=\"brand\" href=\"%sindex.html\"><img class=\"logo\" src=\"%sassets/icon.svg\" alt=\"\" /> Mol* Linker</a>"
             up up)
     "<nav id=\"menu\">" (site-menu (site-path "org/") current up) "</nav>"
     "<button id=\"theme-toggle\" type=\"button\" title=\"Toggle light/dark\">&#9680;</button>"
     (format "<script src=\"%sassets/site/theme.js\"></script>" up))))

;;; site.el ends here
