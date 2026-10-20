document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll("#content img").forEach(function (img) {
    if (img.closest("a")) return;
    var a = document.createElement("a");
    a.href = img.currentSrc || img.src;
    a.setAttribute("data-lightbox", "");
    if (img.alt) a.setAttribute("data-alt", img.alt);
    img.parentNode.insertBefore(a, img);
    a.appendChild(img);
  });
  if (window.Lightbox) Lightbox.init();
});
