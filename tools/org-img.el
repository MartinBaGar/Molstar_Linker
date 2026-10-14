;;; org-img.el --- A generalized image management link for Org-mode -*- lexical-binding: t; -*-
;;
;; Version: 0.6.0
;; Package-Requires: ((emacs "28.1") (org "9.3"))
;; Keywords: multimedia images org
;;
;;; Commentary:
;;
;; Quick start:
;;   (setq org-img-dir "images")
;;   (add-hook 'org-mode-hook #'org-img-mode)
;;
;; Links:  [[img:mydiagram.svg]]  [[img:arch.drawio]]  [[img:sketch.excalidraw]]  [[img:doodle.kra]]
;; Create: M-x org-img-create  (bound to C-c i n in org-img-mode)
;; Insert existing: C-c C-l (org-insert-link), type "img:"
;;
;; Images are displayed inline, scaled proportionally to fit the window.
;; They are never cropped. Use C-c i t to toggle, C-c i r to refresh.
;;
;; org-img is format-agnostic: every file extension is registered in
;; `org-img-backends' with (up to) three pluggable pieces:
;;
;;   :editor   external program used to open the file for editing
;;   :preview  function (ABS-PATH CACHE-PATH) that renders a PNG
;;             preview into CACHE-PATH, for source formats Emacs
;;             cannot display directly
;;   :template function (FULL-PATH) that creates a new, empty file
;;             of that format, used by `org-img-create'
;;
;; Formats that Emacs can already display natively (png/jpg/gif/webp)
;; only need an :editor entry, or none at all. Out of the box:
;;
;;   svg         rasterised via Inkscape
;;   drawio      rasterised via the draw.io desktop app's CLI export
;;   excalidraw  rasterised via `org-img-excalidraw-render-command'
;;               (defaults to kroki-cli; see that variable's docstring
;;               for a fully-local alternative)
;;   kra / ora   previewed by extracting the embedded mergedimage.png
;;               from the zip archive with `unzip' -- no rasteriser
;;               needed. New .kra/.ora files cannot be synthesised
;;               from a text template (see `org-img-kra-template-file')
;;
;; Add or override entries in `org-img-backends' to support other
;; formats or tools; nothing else in the package needs to change.
;;
;; External edits to images are automatically detected and refreshed
;; using a minimal file-watcher (identical in spirit to org-inkscape).
;;
;; Keybindings (org-img-mode):
;;   C-c i t  toggle inline previews
;;   C-c i r  force-refresh previews (re-exports caches)
;;   C-c i n  create a new image file and insert a link
;;
;;; Code:

(require 'org)
(require 'ox)
(require 'cl-lib)
(require 'filenotify)

;;; ============================================================
;;; Customization
;;; ============================================================

(defgroup org-img nil
  "Settings for the org-img package."
  :group 'org
  :prefix "org-img-")

(defcustom org-img-dir "images"
  "Directory where images are stored.
img: link paths are resolved relative to this directory. If this is
a relative path (the default), it is resolved relative to the
directory of the current Org file, so each Org file gets its own
sibling images/ folder. If this is an absolute path, every Org file
that has this value shares that one directory instead. Set to nil to
resolve links directly relative to the Org file, with no
subdirectory at all.

This can be set per-file (e.g. via a file-local variable or
`.dir-locals.el') to give individual files or directories of files
their own image location; it is declared safe for that use below."
  :type '(choice (string :tag "Directory name or absolute path")
                 (const  :tag "Same as Org file" nil))
  :safe (lambda (val) (or (null val) (stringp val)))
  :group 'org-img)

(defcustom org-img-preview-suffix "-preview"
  "Suffix used when generating a cached PNG preview of a source file.
E.g. diagram.svg -> diagram-preview.png."
  :type 'string
  :group 'org-img)

(defcustom org-img-png-dpi 192
  "DPI passed to Inkscape when rasterising an SVG for preview.
96 = 1x, 192 = 2x (crisp on HiDPI displays). Also used for the
intermediate SVG produced while previewing excalidraw files."
  :type 'integer
  :group 'org-img)

(defcustom org-img-max-width-fraction 0.9
  "Maximum image display width as a fraction of the window body width.
0.9 means images wider than 90% of the window are scaled down
proportionally. Images are never upscaled and never cropped."
  :type 'float
  :group 'org-img)

(defcustom org-img-drawio-transparent t
  "If non-nil, export drawio previews with a transparent background."
  :type 'boolean
  :group 'org-img)

(defcustom org-img-excalidraw-render-command
  "kroki convert %i -o %o"
  "Shell command used to render an .excalidraw file to SVG.
%i is replaced with the absolute path to the source .excalidraw
file, %o with the absolute path the SVG output should be written to.

The default assumes `kroki-cli' is installed
\(https://docs.kroki.io/kroki/setup/kroki-cli/\). Note that unless
you have configured it to point at a local Kroki server (or the
`kroki-excalidraw' companion container), it will hit Kroki's public
demo server, which means your diagram content leaves your machine.

A fully local alternative is `Timmmm/excalidraw_export'
\(`npm install -g excalidraw_export`\), which writes its output next
to the input file as INPUT.svg rather than to an arbitrary path, e.g.:

  \"excalidraw_export %i && mv %i.svg %o\"

This corner of the ecosystem is young and CLI interfaces vary between
tools and versions -- run your chosen command by hand once to confirm
its flags before relying on it here."
  :type 'string
  :group 'org-img)

(defcustom org-img-kra-template-file nil
  "Path to a blank .kra file to copy when creating new .kra images.
Krita's format is a zip archive, not text, so unlike SVG/drawio/
excalidraw there is no portable way to synthesise an empty one from a
string template here. Point this at a template file exported from
Krita (File > Save As on a blank canvas) to enable `org-img-create'
for .kra files. When nil, `org-img-create' instead launches Krita
so you can create and save the file yourself."
  :type '(choice (file :tag "Template file") (const :tag "None" nil))
  :group 'org-img)

(defcustom org-img-default-svg-template
  "<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<svg width=\"200\" height=\"200\" version=\"1.1\"
     xmlns=\"http://www.w3.org/2000/svg\">
  <rect width=\"100%\" height=\"100%\" fill=\"#eaeaea\"/>
  <circle cx=\"100\" cy=\"100\" r=\"50\" fill=\"#4488ff\"/>
  <text x=\"100\" y=\"180\" font-family=\"sans-serif\"
        font-size=\"14\" text-anchor=\"middle\">New Image</text>
</svg>"
  "Skeleton SVG written to a newly-created .svg file."
  :type 'string
  :group 'org-img)

(defcustom org-img-default-drawio-template
  "<mxfile host=\"org-img\">
  <diagram name=\"Page-1\" id=\"page-1\">
    <mxGraphModel dx=\"800\" dy=\"600\" grid=\"1\" gridSize=\"10\" guides=\"1\"
        tooltips=\"1\" connect=\"1\" arrows=\"1\" fold=\"1\" page=\"1\"
        pageScale=\"1\" pageWidth=\"850\" pageHeight=\"1100\" math=\"0\" shadow=\"0\">
      <root>
        <mxCell id=\"0\" />
        <mxCell id=\"1\" parent=\"0\" />
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>"
  "Skeleton diagram written to a newly-created .drawio file."
  :type 'string
  :group 'org-img)

(defcustom org-img-default-excalidraw-template
  "{
  \"type\": \"excalidraw\",
  \"version\": 2,
  \"source\": \"org-img\",
  \"elements\": [],
  \"appState\": { \"gridSize\": null, \"viewBackgroundColor\": \"#ffffff\" },
  \"files\": {}
}"
  "Skeleton scene written to a newly-created .excalidraw file."
  :type 'string
  :group 'org-img)

;;; ============================================================
;;; Backends: the pluggable per-extension dispatch table
;;; ============================================================
;;
;; Each entry is (EXTENSION . PLIST). EXTENSION is a lower-case
;; string with no leading dot. Recognised plist keys:
;;
;;   :editor    string naming an executable, or nil
;;   :preview   function (ABS-PATH CACHE-PATH), or nil if the format
;;              is already directly displayable
;;   :template  function (FULL-PATH) called by `org-img-create'; it
;;              should create FULL-PATH and return non-nil on success,
;;              or nil if it could not (e.g. no template configured)
;;   :requires  list of external executable names this entry's
;;              :preview function shells out to, used only to print a
;;              one-time warning when missing

(defcustom org-img-backends
  '(("svg"        :editor "inkscape" :preview org-img--preview-svg
     :template org-img--template-svg :requires ("inkscape"))
    ("drawio"     :editor "drawio"   :preview org-img--preview-drawio
     :template org-img--template-drawio :requires ("drawio"))
    ("excalidraw" :editor nil        :preview org-img--preview-excalidraw
     :template org-img--template-excalidraw :requires ("kroki"))
    ("kra"        :editor "krita"    :preview org-img--preview-kra
     :template org-img--template-kra :requires ("unzip"))
    ("ora"        :editor "krita"    :preview org-img--preview-kra
     :template nil :requires ("unzip"))
    ("png"        :editor "gimp")
    ("jpg"        :editor "gimp")
    ("jpeg"       :editor "gimp")
    ("gif"        :editor nil)
    ("webp"       :editor nil))
  "Alist mapping file extensions to their org-img backend.
See the Commentary above for the shape of each entry. Add an entry
here (or override one, e.g. to point :editor at an absolute path) to
teach org-img about another tool or format."
  :type '(alist :key-type (string :tag "Extension (no dot)")
                :value-type plist)
  :group 'org-img)

(defvar org-img--warned-tools nil
  "Executable names org-img has already warned about missing, this session.")

(defun org-img--backend-for (ext)
  "Return the backend plist for EXT (a file extension string), or nil."
  (cdr (assoc (downcase (or ext "")) org-img-backends)))

(defun org-img--backend-get (ext prop)
  "Return PROP (a keyword) from EXT's backend plist, or nil."
  (plist-get (org-img--backend-for ext) prop))

(defun org-img--ensure-external-tools (ext)
  "Warn once per session about any missing executables EXT's backend needs."
  (dolist (tool (org-img--backend-get ext :requires))
    (unless (or (executable-find tool) (member tool org-img--warned-tools))
      (push tool org-img--warned-tools)
      (message "[org-img] Warning: `%s' not found; .%s previews may fail." tool ext))))

;;; ============================================================
;;; Path helpers
;;; ============================================================

(defun org-img--base-dir ()
  "Return the absolute base directory for resolving img: paths."
  (let ((file-dir (file-name-directory
                   (or buffer-file-name default-directory))))
    (if org-img-dir
        (expand-file-name org-img-dir file-dir)
      file-dir)))

(defun org-img--resolve-path (path)
  "Return the absolute filesystem path for img: link PATH."
  (expand-file-name path (org-img--base-dir)))

;;; ============================================================
;;; Image sizing
;;; ============================================================

(defun org-img--max-width ()
  "Return the pixel width budget for inline images, or nil on terminal.
Computed as `org-img-max-width-fraction' * window body width in pixels.
Passing this as :max-width to `create-image' scales images DOWN to fit
proportionally. Images narrower than the budget are shown at native
size. Nothing is ever cropped."
  (when (display-graphic-p)
    (let ((win-px (window-body-width nil t)))
      (when (and win-px (> win-px 0))
        (floor (* org-img-max-width-fraction win-px))))))

;;; ============================================================
;;; Backend preview functions
;;; ============================================================

(defun org-img--preview-svg (abs-path cache-path)
  "Rasterise the SVG at ABS-PATH into CACHE-PATH via Inkscape."
  (call-process-shell-command
   (format "inkscape --export-type=png --export-area-drawing \
--export-dpi=%d --export-filename=%s %s"
           org-img-png-dpi
           (shell-quote-argument cache-path)
           (shell-quote-argument abs-path))
   nil nil nil))

(defun org-img--preview-drawio (abs-path cache-path)
  "Rasterise the drawio diagram at ABS-PATH into CACHE-PATH.
Uses the same executable configured as the \"drawio\" backend's
:editor, via the draw.io desktop app's headless --export CLI mode."
  (let ((exe (or (org-img--backend-get "drawio" :editor) "drawio")))
    (call-process-shell-command
     (format "%s --export %s --format png --output %s%s"
             (shell-quote-argument exe)
             (shell-quote-argument abs-path)
             (shell-quote-argument cache-path)
             (if org-img-drawio-transparent " --transparent" ""))
     nil nil nil)))

(defun org-img--preview-excalidraw (abs-path cache-path)
  "Render the excalidraw scene at ABS-PATH into CACHE-PATH.
Goes through an intermediate SVG produced by
`org-img-excalidraw-render-command', then rasterises that SVG with
Inkscape -- so only Inkscape is required as an image rasteriser no
matter which excalidraw-to-SVG tool is configured."
  (let* ((tmp-svg (make-temp-file "org-img-excalidraw-" nil ".svg"))
         (cmd (replace-regexp-in-string
               "%o" (shell-quote-argument tmp-svg)
               (replace-regexp-in-string
                "%i" (shell-quote-argument abs-path)
                org-img-excalidraw-render-command nil t)
               nil t)))
    (unwind-protect
        (progn
          (call-process-shell-command cmd nil nil nil)
          (when (file-exists-p tmp-svg)
            (org-img--preview-svg tmp-svg cache-path)))
      (when (file-exists-p tmp-svg)
        (delete-file tmp-svg)))))

(defun org-img--preview-kra (abs-path cache-path)
  "Extract the embedded raster thumbnail from the .kra/.ora at ABS-PATH.
Both formats are zip archives that already contain a rendered
`mergedimage.png' at their root, so no rasteriser is needed -- only
`unzip', to pull that entry straight into CACHE-PATH."
  (call-process "unzip" nil (list :file cache-path) nil
                "-p" abs-path "mergedimage.png"))

;;; ============================================================
;;; Backend template (new-file) functions
;;; ============================================================

(defun org-img--template-svg (full-path)
  "Write `org-img-default-svg-template' to FULL-PATH."
  (with-temp-file full-path (insert org-img-default-svg-template))
  t)

(defun org-img--template-drawio (full-path)
  "Write `org-img-default-drawio-template' to FULL-PATH."
  (with-temp-file full-path (insert org-img-default-drawio-template))
  t)

(defun org-img--template-excalidraw (full-path)
  "Write `org-img-default-excalidraw-template' to FULL-PATH."
  (with-temp-file full-path (insert org-img-default-excalidraw-template))
  t)

(defun org-img--template-kra (full-path)
  "Copy `org-img-kra-template-file' to FULL-PATH, if configured.
Returns nil (declining to create the file) when no template is
configured, since a plain-text skeleton will not open in Krita."
  (when (and org-img-kra-template-file (file-exists-p org-img-kra-template-file))
    (copy-file org-img-kra-template-file full-path)
    t))

;;; ============================================================
;;; Preview cache
;;; ============================================================

(defun org-img--preview-path (abs-path)
  "Return the cached PNG preview path for the source file at ABS-PATH."
  (concat (file-name-sans-extension abs-path)
          org-img-preview-suffix
          ".png"))

(defun org-img--get-preview (abs-path)
  "Return a displayable image path for ABS-PATH.
Formats with a registered :preview function are rendered to a cached
PNG (regenerated whenever the source is newer than the cache). All
other file types are returned unchanged, on the assumption Emacs can
already display them directly."
  (let* ((ext (downcase (or (file-name-extension abs-path) "")))
         (preview-fn (org-img--backend-get ext :preview)))
    (if (not preview-fn)
        abs-path
      (org-img--ensure-external-tools ext)
      (let ((cache-path (org-img--preview-path abs-path)))
        (when (or (not (file-exists-p cache-path))
                  (file-newer-than-file-p abs-path cache-path))
          (message "[org-img] Generating preview for %s..."
                   (file-name-nondirectory abs-path))
          (condition-case err
              (funcall preview-fn abs-path cache-path)
            (error (message "[org-img] Preview generation error for %s: %s"
                            (file-name-nondirectory abs-path)
                            (error-message-string err)))))
        (if (file-exists-p cache-path)
            cache-path
          (message "[org-img] Preview generation failed for %s." abs-path)
          nil)))))

;;; ============================================================
;;; Link collection & completion
;;; ============================================================

(defun org-img--get-links ()
  "Return a list of all img: link elements in the current buffer."
  (org-element-map (org-element-parse-buffer) 'link
    (lambda (link)
      (when (string-equal (org-element-property :type link) "img")
        link))))

(defun org-img--known-extensions-regexp ()
  "Regexp matching any file extension registered in `org-img-backends'."
  (concat "\\.\\(?:" (regexp-opt (mapcar #'car org-img-backends)) "\\)$"))

(defun org-img--complete-link ()
  "Complete an img: link path using image files in `org-img-dir'.
Used by `org-insert-link' (C-c C-l)."
  (let* ((base-dir (org-img--base-dir)))
    (unless (file-directory-p base-dir)
      (make-directory base-dir t))
    (let* ((files (directory-files base-dir nil "^[^.]"))
           (image-files (cl-remove-if-not
                         (lambda (f)
                           (string-match-p (org-img--known-extensions-regexp)
                                           (downcase f)))
                         files))
           (file (completing-read "Image file: " image-files nil nil nil nil)))
      (concat "img:" file))))

;;; ============================================================
;;; File Watcher (The minimal org-inkscape way)
;;; ============================================================

(defvar-local org-img--watchers nil
  "Alist of (abs-path . file-notify-descriptor) for this buffer.")

(defun org-img--add-watcher (abs-path)
  "Watch ABS-PATH and auto-refresh overlays on change."
  ;; Only add if we aren't already watching it
  (unless (alist-get abs-path org-img--watchers nil nil #'string-equal)
    (when (file-exists-p abs-path)
      (push (cons abs-path
                  (file-notify-add-watch
                   abs-path '(change)
                   ;; The moment anything happens, just update the overlays!
                   (lambda (_)
                     (message "[org-img] Refreshing %s" (file-name-nondirectory abs-path))
                     (org-img--update-overlays))))
            org-img--watchers))))

(defun org-img--remove-watchers ()
  "Cancel all file-notify watchers for this buffer."
  (dolist (entry org-img--watchers)
    (file-notify-rm-watch (cdr entry)))
  (setq org-img--watchers nil))

;;; ============================================================
;;; Overlay management
;;; ============================================================

(defun org-img--our-overlays ()
  "Return all org-img overlays in the current buffer."
  (cl-remove-if-not
   (lambda (ov) (overlay-get ov 'org-img-overlay))
   (overlays-in (point-min) (point-max))))

(defun org-img--overlay-link (link)
  "Place a proportionally-scaled inline image overlay for LINK."
  (let* ((path      (org-element-property :path link))
         (full-path (org-img--resolve-path path)))
    (if (not (file-exists-p full-path))
        (message "[org-img] File not found: %s" full-path)
      (let ((preview-path (org-img--get-preview full-path)))
        (when preview-path
          (let* ((img-type  (intern (downcase (file-name-extension preview-path))))
                 (max-width (org-img--max-width))
                 (image     (apply #'create-image
                                   preview-path img-type nil
                                   (when max-width (list :max-width max-width))))
                 (begin (org-element-property :begin link))
                 (end   (save-excursion
                          (goto-char (org-element-property :end link))
                          (skip-chars-backward " \t")
                          (point)))
                 (ov (make-overlay begin end)))
            (overlay-put ov 'display image)
            (overlay-put ov 'face 'default)
            (overlay-put ov 'org-img-overlay t)
            (overlay-put ov 'org-image-overlay t)
            (overlay-put ov 'modification-hooks
                         (list #'org-display-inline-remove-overlay))
            (when (boundp 'org-inline-image-overlays)
              (push ov org-inline-image-overlays))
            ;; Hook in the minimal watcher!
            (org-img--add-watcher full-path)))))))

(defun org-img--remove-overlays ()
  "Remove all org-img overlays from the current buffer."
  (dolist (ov (org-img--our-overlays))
    (delete-overlay ov)))

(defun org-img--update-overlays ()
  "Remove stale overlays, clear image cache, redisplay all img: links."
  (when (display-graphic-p)
    (org-img--remove-overlays)
    (clear-image-cache)
    (dolist (link (org-img--get-links))
      (org-img--overlay-link link))))

;;; ============================================================
;;; Follow (open in external editor)
;;; ============================================================

(defun org-img-follow (path _prefix)
  "Open the image at PATH in the appropriate external editor."
  (let* ((full-path (org-img--resolve-path path))
         (ext       (downcase (or (file-name-extension full-path) "")))
         (editor    (org-img--backend-get ext :editor)))
    (unless (file-exists-p full-path)
      (user-error "[org-img] File does not exist: %s" full-path))
    (if (and editor (executable-find editor))
        (progn
          (message "[org-img] Opening %s in %s..."
                   (file-name-nondirectory full-path) editor)
          (start-process (format "org-img-%s" editor) nil editor full-path))
      (message "[org-img] No editor mapped for .%s; using system default." ext)
      (org-open-file full-path))))

;;; ============================================================
;;; Export filter
;;; ============================================================
(defun org-img-export-filter (tree _backend info)
  "Rewrite img: links to file: links before export.
Links to formats with a registered :preview (svg, drawio, excalidraw,
kra, ora) are pointed at their rendered PNG preview, generating it
first if necessary -- export can happen without org-img-mode's
overlays ever having been displayed (batch export, a terminal frame,
a buffer where the mode was never toggled on), so the cache cannot be
assumed to already exist. Links to formats Emacs can already display
natively (png/jpg/gif/webp) are left pointing at the original file."
  (org-element-map tree 'link
    (lambda (link)
      (when (string= (org-element-property :type link) "img")
        (let* ((full-path (org-img--resolve-path
                           (org-element-property :path link)))
               (ext (downcase (or (file-name-extension full-path) "")))
               (export-path
                (if (org-img--backend-get ext :preview)
                    (or (org-img--get-preview full-path)
                        (progn
                          (message "[org-img] Could not render a preview for %s; \
exporting the source file as-is, which will likely not embed as an image."
                                   full-path)
                          full-path))
                  full-path)))
          (org-element-put-property link :type "file")
          (org-element-put-property
           link :path (file-relative-name
                       export-path
                       (file-name-directory (plist-get info :input-file))))))))
  tree)


(add-to-list 'org-export-filter-parse-tree-functions
             #'org-img-export-filter)

;;; ============================================================
;;; Interactive commands
;;; ============================================================

;;;###autoload
(defun org-img-create (filename)
  "Create image FILENAME in `org-img-dir', insert a link, open in editor.
Uses FILENAME's extension to look up a :template function in
`org-img-backends'. If that backend cannot synthesise a blank file
(e.g. .kra with no `org-img-kra-template-file' configured), the link
is still inserted and the editor is launched with no file argument so
you can create and save it yourself at the resolved path."
  (interactive "sImage filename (e.g. diagram.svg, diagram.drawio, sketch.excalidraw): ")
  (let* ((full-path (org-img--resolve-path filename))
         (dir       (file-name-directory full-path))
         (ext       (downcase (or (file-name-extension filename) "")))
         (template  (org-img--backend-get ext :template))
         (editor    (org-img--backend-get ext :editor)))
    (unless (file-exists-p dir)
      (make-directory dir t))
    (cond
     ((file-exists-p full-path)
      (message "[org-img] %s already exists; linking to existing file." filename))
     ((and template (funcall template full-path)))
     (t (message "[org-img] No way to auto-create .%s files; save one to %s manually."
                 ext full-path)))
    (insert (format "[[img:%s]]" filename))
    (if (file-exists-p full-path)
        (org-img-follow filename nil)
      (when (and editor (executable-find editor))
        (message "[org-img] Launching %s -- save your file as %s when done." editor full-path)
        (start-process (format "org-img-%s" editor) nil editor)))))

;;;###autoload
(defun org-img-refresh ()
  "Force-delete cached previews and redisplay all img: links."
  (interactive)
  (dolist (link (org-img--get-links))
    (let* ((full-path (org-img--resolve-path
                       (org-element-property :path link)))
           (ext (downcase (or (file-name-extension full-path) ""))))
      (when (org-img--backend-get ext :preview)
        (let ((cache (org-img--preview-path full-path)))
          (when (file-exists-p cache) (delete-file cache))))))
  (org-img--update-overlays)
  (message "[org-img] Previews refreshed."))

;;;###autoload
(defun org-img-toggle-display ()
  "Toggle inline preview of img: links in this buffer."
  (interactive)
  (if (org-img--our-overlays)
      (progn
        (org-img--remove-overlays)
        (message "[org-img] Previews hidden."))
    (org-img--update-overlays)
    (message "[org-img] Previews shown.")))

;;; ============================================================
;;; Link Registration & Minor mode
;;; ============================================================

(org-link-set-parameters "img"
                         :follow  #'org-img-follow
                         :complete #'org-img--complete-link
                         :face    'org-link)

(defvar org-img-mode-map
  (let ((map (make-sparse-keymap)))
    (define-key map (kbd "C-c i t") #'org-img-toggle-display)
    (define-key map (kbd "C-c i r") #'org-img-refresh)
    (define-key map (kbd "C-c i n") #'org-img-create)
    map)
  "Keymap for `org-img-mode'.")

;;;###autoload
(define-minor-mode org-img-mode
  "Minor mode for generalized image link management in Org Mode."
  :lighter " img"
  :keymap org-img-mode-map
  (if org-img-mode
      (org-img--update-overlays)
    (org-img--remove-overlays)
    (org-img--remove-watchers)))

(provide 'org-img)
;;; org-img.el ends here
