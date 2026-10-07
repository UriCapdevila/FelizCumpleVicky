(() => {
  "use strict";

  const content = window.VICKY_CONTENT;
  const searchParams = new URLSearchParams(window.location.search);
  const previewTarget = searchParams.get("preview");
  const previewMode = searchParams.has("preview");
  const directTextPreview = previewTarget === "texts";
  const directGiftPreview = previewTarget === "gifts";
  const requestedScene = Number.parseInt(searchParams.get("scene") || "1", 10);
  const previewScene = Number.isFinite(requestedScene)
    ? Math.min(Math.max(requestedScene - 1, 0), content.scenes.length - 1)
    : 0;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const gate = document.querySelector("#gate");
  const journey = document.querySelector("#journey");
  const gifts = document.querySelector("#gifts");
  const stage = document.querySelector("#scene-stage");
  const progress = document.querySelector("#progress");
  const enterButton = document.querySelector("#enter-button");
  const nextButton = document.querySelector("#next-button");
  const previousButton = document.querySelector("#previous-button");
  const restartButton = document.querySelector("#restart-button");
  const previewBadge = document.querySelector("#preview-badge");
  const envelope = document.querySelector("#envelope-countdown");
  const backgroundMusic = document.querySelector("#background-music");
  const musicToggle = document.querySelector("#music-toggle");

  let activeScene = 0;
  let countdownTimer;
  const musicPreferenceKey = "vicky-background-music";
  let musicRequested = true;

  try {
    musicRequested = window.localStorage.getItem(musicPreferenceKey) !== "off";
  } catch (_) {
    musicRequested = true;
  }

  function rememberMusicPreference(enabled) {
    try {
      window.localStorage.setItem(musicPreferenceKey, enabled ? "on" : "off");
    } catch (_) {
      // La experiencia sigue funcionando aunque el navegador bloquee el almacenamiento.
    }
  }

  function syncMusicControl(waitingForGesture = false) {
    const isPlaying = !backgroundMusic.paused && !backgroundMusic.ended;
    musicToggle.classList.toggle("is-playing", isPlaying);
    musicToggle.classList.toggle("is-awaiting", waitingForGesture && musicRequested);
    musicToggle.setAttribute("aria-pressed", String(isPlaying));

    const action = isPlaying ? "Pausar música" : "Reproducir música";
    musicToggle.setAttribute("aria-label", action);
    musicToggle.title = action;
  }

  async function playBackgroundMusic(remember = false) {
    musicRequested = true;
    if (remember) rememberMusicPreference(true);

    try {
      await backgroundMusic.play();
      syncMusicControl(false);
      return true;
    } catch (_) {
      syncMusicControl(true);
      return false;
    }
  }

  function pauseBackgroundMusic() {
    musicRequested = false;
    rememberMusicPreference(false);
    backgroundMusic.pause();
    syncMusicControl(false);
  }

  function initBackgroundMusic() {
    backgroundMusic.volume = 0.3;
    syncMusicControl(false);

    musicToggle.addEventListener("click", () => {
      if (backgroundMusic.paused) playBackgroundMusic(true);
      else pauseBackgroundMusic();
    });

    backgroundMusic.addEventListener("play", () => syncMusicControl(false));
    backgroundMusic.addEventListener("pause", () => syncMusicControl(musicRequested));

    const unlockOnInteraction = (event) => {
      if (!musicRequested || !backgroundMusic.paused || event.target.closest("#music-toggle")) return;
      playBackgroundMusic().then((started) => {
        if (!started) return;
        document.removeEventListener("pointerdown", unlockOnInteraction);
        document.removeEventListener("keydown", unlockOnInteraction);
      });
    };

    document.addEventListener("pointerdown", unlockOnInteraction);
    document.addEventListener("keydown", unlockOnInteraction);

    if (musicRequested) playBackgroundMusic();
  }

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
      <section class="letter-sheet" aria-label="${scene.title}">
        <img class="letter-sheet__stickers letter-sheet__stickers--full" src="${scene.stickers}" alt="" />
        <img class="letter-sheet__stickers letter-sheet__stickers--mobile letter-sheet__stickers--mobile-top" src="${scene.stickers}" alt="" />
        <img class="letter-sheet__stickers letter-sheet__stickers--mobile letter-sheet__stickers--mobile-bottom" src="${scene.stickers}" alt="" />
        <span class="letter-sheet__tape letter-sheet__tape--left" aria-hidden="true"></span>
        <span class="letter-sheet__tape letter-sheet__tape--right" aria-hidden="true"></span>
        <div class="letter-sheet__content">
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
    const isFirstScene = activeScene === 0;
    const isLastScene = activeScene === content.scenes.length - 1;
    previousButton.disabled = false;
    previousButton.innerHTML = `
      <span class="nav-arrow nav-arrow--back" aria-hidden="true">←</span>
      <span class="nav-label">${isFirstScene ? "Portada" : "Volver"}</span>
    `;
    previousButton.setAttribute("aria-label", isFirstScene ? "Volver a la portada" : "Volver a la hoja anterior");
    nextButton.innerHTML = `
      <span class="nav-label">${isLastScene ? "Ver mis regalos" : "Seguir"}</span>
      <span class="nav-arrow" aria-hidden="true">→</span>
    `;
    nextButton.setAttribute(
      "aria-label",
      isLastScene ? "Ver mis regalos" : "Siguiente hoja",
    );

    [...progress.children].forEach((dot, index) => {
      dot.classList.toggle("is-active", index === activeScene);
      dot.setAttribute("aria-current", index === activeScene ? "step" : "false");
    });
  }

  function showJourney(sceneIndex = 0, immediate = false) {
    gate.classList.add("is-leaving");
    const revealJourney = () => {
      gate.classList.add("hidden");
      gifts.classList.add("hidden");
      journey.classList.remove("hidden");
      showScene(sceneIndex);
      document.body.classList.add("in-experience");
    };

    if (immediate || reduceMotion) revealJourney();
    else window.setTimeout(revealJourney, 650);
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

    content.gifts.forEach((gift) => {
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
            ${gift.detail ? `<span class="gift-card__detail">${gift.detail}</span>` : ""}
            <span class="gift-card__open">Volver a cerrar</span>
          </span>
        </span>
      `;
      card.addEventListener("click", () => {
        const opening = !card.classList.contains("is-open");
        card.classList.toggle("is-open", opening);
        card.setAttribute("aria-expanded", String(opening));
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

  function showGiftsImmediately() {
    gate.classList.add("hidden");
    journey.classList.add("hidden");
    gifts.classList.remove("hidden");
    gifts.scrollTop = 0;
    document.body.classList.add("in-experience");
  }

  function restartExperience() {
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

  enterButton.addEventListener("click", () => showJourney());
  previousButton.addEventListener("click", () => {
    if (activeScene === 0) showGate();
    else showScene(activeScene - 1);
  });
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
  initBackgroundMusic();
  updateCountdown();
  if (directGiftPreview) showGiftsImmediately();
  else if (directTextPreview) showJourney(previewScene, true);
  countdownTimer = window.setInterval(updateCountdown, 1000);
})();
