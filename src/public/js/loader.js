const loader = document.getElementById("page-loader");

window.addEventListener("load", () => {
  loader.classList.add("loader-hidden");
});

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    loader.classList.add("loader-hidden");
  }
});

document.addEventListener("click", (e) => {
  const link = e.target.closest("a");

  if (
    link &&
    link.href &&
    link.target !== "_blank" &&
    !link.href.startsWith("#") &&
    link.origin === window.location.origin
  ) {
    loader.classList.remove("loader-hidden");
  }
});
