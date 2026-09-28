(() => {
  "use strict";

  const content = window.VICKY_CONTENT;
  const previewMode = new URLSearchParams(window.location.search).get("preview") === "1";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const gate = document.querySelector("#gate");
  const journey = document.querySelector("#journey");
  const gifts = document.querySelector("#gifts");
  const stage = document.querySelector("#scene-stage");
  const progress = document.querySelector("#progress");
  const enterButton = document.querySelector("#enter-button");
  const nextButton = document.querySelector("#next-button");
  const previousButton = document.querySelector("#previous-button");
  const exitButton = document.querySelector("#exit-button");
  const restartButton = document.querySelector("#restart-button");
  const sceneKicker = document.querySelector("#scene-kicker");
  const previewBadge = document.querySelector("#preview-badge");
  const closing = document.querySelector("#closing");

  let activeScene = 0;
  let countdownTimer;
  const openedGifts = new Set();

  const twoDigits = (number) => String(Math.max(0, number)).padStart(2, "0");

  function setCountdown(distance) {
    const day = 86_400_000;
    const hour = 3_600_000;
    const minute = 60_000;
    document.querySelector("#days").textContent = twoDigits(Math.floor(distance / day));
    document.querySelector("#hours").textContent = twoDigits(Math.floor((distance % day) / hour));
    document.querySelector("#minutes").textContent = twoDigits(Math.floor((distance % hour) / minute));
    document.querySelector("#seconds").textContent = twoDigits(Math.floor((distance % minute) / 1000));
  }

  function updateCountdown() {
    const distance = new Date(content.birthday).getTime() - Date.now();
    const isOpen = distance <= 0 || previewMode;

    if (isOpen) {
      setCountdown(0);
      enterButton.classList.remove("hidden");
      document.querySelector(".date-lock").innerHTML = "<span class=\"lock-icon\">✦</span> Este momento ya es tuyo";
      if (previewMode && distance > 0) previewBadge.classList.remove("hidden");
      window.clearInterval(countdownTimer);
      return;
    }

    setCountdown(distance);
  }

  function buildProgress() {
    progress.replaceChildren();
    content.scenes.forEach((_, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "progress__dot";
      dot.setAttribute("aria-label", `Ir a la escena ${index + 1}`);
      dot.addEventListener("click", () => showScene(index));
      progress.append(dot);
    });
  }

  function renderScene(scene, index) {
    const article = document.createElement("article");
    article.className = `scene scene--${scene.theme}`;
    article.style.setProperty("--scene-image", scene.image ? `url('${scene.image}')` : "none");
    article.innerHTML = `
      <div class="scene__image" aria-hidden="true"></div>
      <div class="scene__shade" aria-hidden="true"></div>
      <div class="scene__ornament" aria-hidden="true"><span>✦</span></div>
      <div class="scene__copy">
        <p class="scene__number">${twoDigits(index + 1)} / ${twoDigits(content.scenes.length)}</p>
        <p class="scene__kicker">${scene.kicker}</p>
        <h2>${scene.title}</h2>
        <p class="scene__text">${scene.text}</p>
      </div>
      <p class="swipe-hint">Deslizá para continuar <span>→</span></p>
    `;
    return article;
  }

  function showScene(index) {
    activeScene = Math.min(Math.max(index, 0), content.scenes.length - 1);
    stage.replaceChildren(renderScene(content.scenes[activeScene], activeScene));
    sceneKicker.textContent = content.scenes[activeScene].kicker;
    previousButton.disabled = activeScene === 0;
    nextButton.innerHTML = activeScene === content.scenes.length - 1 ? "Ver mis regalos <span>→</span>" : "Seguir <span>→</span>";

    [...progress.children].forEach((dot, index) => {
      dot.classList.toggle("is-active", index === activeScene);
      dot.setAttribute("aria-current", index === activeScene ? "step" : "false");
    });
  }

  function showJourney() {
    gate.classList.add("is-leaving");
    window.setTimeout(() => {
      gate.classList.add("hidden");
      gifts.classList.add("hidden");
      journey.classList.remove("hidden");
      showScene(0);
      document.body.classList.add("in-experience");
    }, reduceMotion ? 0 : 650);
  }

  function showGate() {
    journey.classList.add("hidden");
    gifts.classList.add("hidden");
    gate.classList.remove("hidden", "is-leaving");
    document.body.classList.remove("in-experience");
  }

  function buildGifts() {
    const grid = document.querySelector("#gift-grid");
    grid.replaceChildren();

    content.gifts.forEach((gift, index) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "gift-card";
      card.setAttribute("aria-label", `Abrir ${gift.title}`);
      card.setAttribute("aria-expanded", "false");
      card.innerHTML = `
        <span class="gift-card__inner">
          <span class="gift-card__face gift-card__front">
            <span class="gift-card__number">${gift.number}</span>
            <span class="gift-card__symbol">${gift.symbol}</span>
            <span class="gift-card__title">${gift.title}</span>
            <span class="gift-card__short">${gift.short}</span>
            <span class="gift-card__open">Abrir carta</span>
          </span>
          <span class="gift-card__face gift-card__back">
            <span class="gift-card__number">${gift.number}</span>
            <span class="gift-card__symbol gift-card__symbol--small">${gift.symbol}</span>
            <span class="gift-card__why">${gift.why}</span>
            <span class="gift-card__detail">${gift.detail}</span>
            <span class="gift-card__open">Volver a cerrar</span>
          </span>
        </span>
      `;
      card.addEventListener("click", () => {
        const opening = !card.classList.contains("is-open");
        card.classList.toggle("is-open", opening);
        card.setAttribute("aria-expanded", String(opening));
        if (opening) openedGifts.add(index);
        if (openedGifts.size === content.gifts.length) closing.classList.remove("hidden");
      });
      grid.append(card);
    });
  }

  function showGifts() {
    journey.classList.add("is-leaving");
    window.setTimeout(() => {
      journey.classList.add("hidden");
      journey.classList.remove("is-leaving");
      gifts.classList.remove("hidden");
      gifts.scrollTop = 0;
    }, reduceMotion ? 0 : 500);
  }

  function restartExperience() {
    openedGifts.clear();
    closing.classList.add("hidden");
    document.querySelectorAll(".gift-card").forEach((card) => {
      card.classList.remove("is-open");
      card.setAttribute("aria-expanded", "false");
    });
    gifts.classList.add("hidden");
    journey.classList.remove("hidden");
    showScene(0);
  }

  function addSwipeNavigation() {
    let touchStartX = 0;
    stage.addEventListener("touchstart", (event) => {
      touchStartX = event.changedTouches[0].screenX;
    }, { passive: true });
    stage.addEventListener("touchend", (event) => {
      const delta = event.changedTouches[0].screenX - touchStartX;
      if (Math.abs(delta) < 70) return;
      if (delta < 0 && activeScene < content.scenes.length - 1) showScene(activeScene + 1);
      if (delta > 0 && activeScene > 0) showScene(activeScene - 1);
    }, { passive: true });
  }

  enterButton.addEventListener("click", showJourney);
  exitButton.addEventListener("click", showGate);
  previousButton.addEventListener("click", () => showScene(activeScene - 1));
  nextButton.addEventListener("click", () => {
    if (activeScene === content.scenes.length - 1) showGifts();
    else showScene(activeScene + 1);
  });
  restartButton.addEventListener("click", restartExperience);

  document.addEventListener("keydown", (event) => {
    if (journey.classList.contains("hidden")) return;
    if (event.key === "ArrowRight") nextButton.click();
    if (event.key === "ArrowLeft") previousButton.click();
    if (event.key === "Escape") showGate();
  });

  document.querySelector("#closing-message").textContent = content.closing;
  buildProgress();
  buildGifts();
  addSwipeNavigation();
  updateCountdown();
  countdownTimer = window.setInterval(updateCountdown, 1000);
})();
