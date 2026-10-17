// 描画の前に <html data-theme> を決め、ちらつきを防ぐ。src/platform/settings.ts と同じ鍵と規則
(() => {
  let preference = "system";
  try {
    const saved = JSON.parse(localStorage.getItem("kg-games:settings:v1") ?? "null");
    if (saved && (saved.theme === "light" || saved.theme === "dark")) preference = saved.theme;
  } catch {
    // 読めなければ端末に合わせる
  }
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches === true;
  document.documentElement.dataset.theme =
    preference === "system" ? (prefersDark ? "dark" : "light") : preference;
})();
