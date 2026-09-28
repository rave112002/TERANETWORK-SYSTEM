// Apply the saved/system theme before paint to avoid a flash of the wrong mode.
// A file, not an inline <script>: the API's Content-Security-Policy
// (script-src 'self') blocks inline scripts when Express serves this build.
(function () {
  try {
    var stored = localStorage.getItem("ui-theme");
    var mode = stored ? JSON.parse(stored).state.mode : null;
    if (!mode) {
      mode = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    if (mode === "dark") document.documentElement.classList.add("dark");
  } catch (e) {}
})();
