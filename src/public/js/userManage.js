function showCopiedSnackbar() {
  const snackbar = document.getElementById("copied-snackbar");
  if (!snackbar) return;
  snackbar.classList.remove("opacity-0");
  snackbar.classList.add("opacity-100");
  clearTimeout(snackbar._hideTimer);
  snackbar._hideTimer = setTimeout(() => {
    snackbar.classList.remove("opacity-100");
    snackbar.classList.add("opacity-0");
  }, 1500);
}

function copyToClipboard() {
  const userId = document.getElementById("user-id").innerText;
  navigator.clipboard.writeText(userId);
  showCopiedSnackbar();
}
