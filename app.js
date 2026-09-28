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
  const envelope = document.querySelector("#envelope-countdown");

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
      envelope.classList.add("is-open");
      gate.classList.add("is-unlocked");
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
    article.className = `scene scene--letter scene--${scene.theme}`;
    const paragraphs = (scene.paragraphs || [scene.text])
      .map((paragraph) => `<p>${paragraph}</p>`)
      .join("");
    article.innerHTML = `
      <div class="letter-desk" aria-hidden="true"><i>✦</i><i>♡</i><i>✦</i></div>
      <section class="letter-sheet">
        <img class="letter-sheet__stickers" src="${scene.stickers}" alt="" />
        <span class="letter-sheet__tape letter-sheet__tape--left" aria-hidden="true"></span>
        <span class="letter-sheet__tape letter-sheet__tape--right" aria-hidden="true"></span>
        <div class="letter-sheet__content">
          <div class="letter-sheet__heading">
            <p class="scene__number">Hoja ${twoDigits(index + 1)} de ${twoDigits(content.scenes.length)}</p>
            <p class="scene__kicker">${scene.kicker}</p>
          </div>
          <h2>${scene.title}</h2>
          <div class="letter-sheet__body">${paragraphs}</div>
          ${scene.signoff ? `<p class="letter-sheet__signoff">${scene.signoff}</p>` : ""}
        </div>
        <span class="letter-sheet__corner" aria-hidden="true"></span>
      </section>
    `;
    return article;
  }

  function showScene(index) {
    activeScene = Math.min(Math.max(index, 0), content.scenes.length - 1);
    stage.replaceChildren(renderScene(content.scenes[activeScene], activeScene));
    stage.scrollTop = 0;
    sceneKicker.textContent = content.scenes[activeScene].kicker;
    previousButton.disabled = activeScene === 0;
    nextButton.innerHTML = activeScene === content.scenes.length - 1 ? "Ver mis regalos <span>→</span>" : "Seguir <span>→</span>";
    nextButton.setAttribute(
      "aria-label",
      activeScene === content.scenes.length - 1 ? "Ver mis regalos" : "Siguiente escena",
    );

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

  function addSceneParallax() {
    stage.addEventListener("pointermove", (event) => {
      if (reduceMotion) return;
      const bounds = stage.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 12;
      const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 10;
      stage.style.setProperty("--parallax-x", `${x}px`);
      stage.style.setProperty("--parallax-y", `${y}px`);
    });
    stage.addEventListener("pointerleave", () => {
      stage.style.setProperty("--parallax-x", "0px");
      stage.style.setProperty("--parallax-y", "0px");
    });
  }

  function initStarVoyage() {
    const canvas = document.querySelector("#star-voyage");
    const context = canvas.getContext("2d");
    const palette = ["255,249,238", "244,217,154", "229,183,186"];
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let stars = [];

    const resetStar = (star, atEdge = false) => {
      star.x = (Math.random() - 0.5) * width;
      star.y = (Math.random() - 0.5) * height;
      star.z = atEdge ? width : Math.random() * width;
      star.previousZ = star.z;
      star.color = palette[Math.floor(Math.random() * palette.length)];
      star.alpha = 0.35 + Math.random() * 0.65;
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      stars = Array.from({ length: Math.min(180, Math.floor(width / 7)) }, () => {
        const star = {};
        resetStar(star);
        return star;
      });
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      const centerX = width / 2;
      const centerY = height / 2;
      const speed = reduceMotion ? 0.35 : 4.2;

      stars.forEach((star) => {
        star.z -= speed;
        if (star.z < 1) resetStar(star, true);

        const x = star.x / star.z * width + centerX;
        const y = star.y / star.z * width + centerY;
        const previousX = star.x / star.previousZ * width + centerX;
        const previousY = star.y / star.previousZ * width + centerY;
        star.previousZ = star.z;

        if (x < -40 || x > width + 40 || y < -40 || y > height + 40) {
          resetStar(star, true);
          return;
        }

        const depth = 1 - star.z / width;
        context.beginPath();
        context.moveTo(previousX, previousY);
        context.lineTo(x, y);
        context.strokeStyle = `rgba(${star.color},${star.alpha * Math.max(0.18, depth)})`;
        context.lineWidth = Math.max(0.55, depth * 2.2);
        context.stroke();
      });

      window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });
    draw();
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
  addSceneParallax();
  initStarVoyage();
  updateCountdown();
  countdownTimer = window.setInterval(updateCountdown, 1000);
})();
