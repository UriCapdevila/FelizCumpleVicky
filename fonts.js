(() => {
  const cards = [...document.querySelectorAll(".font-card")];
  const label = document.querySelector("#preview-label");
  const title = document.querySelector("#preview-title");

  cards.forEach((card) => {
    card.addEventListener("click", () => {
      cards.forEach((item) => item.classList.toggle("is-selected", item === card));
      document.documentElement.style.setProperty("--preview-font", card.dataset.font);
      label.textContent = card.dataset.name;
      title.animate(
        [{ opacity: 0, transform: "translateY(.4rem)" }, { opacity: 1, transform: "translateY(0)" }],
        { duration: 320, easing: "ease-out" },
      );
      document.querySelector(".live-preview").scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
})();
