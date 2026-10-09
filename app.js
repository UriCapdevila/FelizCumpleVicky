(() => {
  "use strict";

  const content = window.VICKY_CONTENT;
  const searchParams = new URLSearchParams(window.location.search);
  const previewTarget = searchParams.get("preview");
  const previewMode = searchParams.has("preview");
  const directTextPreview = previewTarget === "texts";
  const directGiftPreview = previewTarget === "gifts";
  const directBonusPreview = previewTarget === "bonus";
  const skipBonusIntro = previewMode && searchParams.has("skipBonusIntro");
  const previewBonusChoice = previewMode ? searchParams.get("bonusChoice") : null;
  const requestedBonusDesign = searchParams.get("bonusDesign");
  const requestedScene = Number.parseInt(searchParams.get("scene") || "1", 10);
  const previewScene = Number.isFinite(requestedScene)
    ? Math.min(Math.max(requestedScene - 1, 0), content.scenes.length - 1)
    : 0;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const gate = document.querySelector("#gate");
  const journey = document.querySelector("#journey");
  const gifts = document.querySelector("#gifts");
  const bonus = document.querySelector("#bonus");
  const stage = document.querySelector("#scene-stage");
  const progress = document.querySelector("#progress");
  const enterButton = document.querySelector("#enter-button");
  const nextButton = document.querySelector("#next-button");
  const previousButton = document.querySelector("#previous-button");
  const restartButton = document.querySelector("#restart-button");
  const previewBadge = document.querySelector("#preview-badge");
  const envelope = document.querySelector("#envelope-countdown");
  const backgroundMusic = document.querySelector("#background-music");
  const bonusMusic = document.querySelector("#bonus-music");
  const musicToggle = document.querySelector("#music-toggle");
  const bonusChestTrigger = document.querySelector("#bonus-chest-trigger");
  const bonusClose = document.querySelector("#bonus-close");
  const bonusIntro = document.querySelector("#bonus-intro");
  const bonusSelection = document.querySelector("#bonus-selection");
  const bonusDeck = document.querySelector("#bonus-deck");
  const bonusResult = document.querySelector("#bonus-result");
  const bonusConfirm = document.querySelector("#bonus-confirm");
  const bonusConfirmCard = document.querySelector("#bonus-confirm-card");
  const bonusCancel = document.querySelector("#bonus-cancel");
  const bonusConfirmChoice = document.querySelector("#bonus-confirm-choice");
  const bonusDesignPicker = document.querySelector("#bonus-design-picker");
  const bonusDesignButtons = [...document.querySelectorAll("[data-bonus-design]")];

  let activeScene = 0;
  let countdownTimer;
  let bonusArrivalTimer;
  let pendingBonusGift = null;
  let musicFadeFrame;
  let bonusAssetsPreloaded = false;
  const musicPreferenceKey = "vicky-background-music";
  const bonusChoiceKey = "vicky-bonus-choice-v1";
  const musicVolume = 0.3;
  let activeMusic = backgroundMusic;
  let musicMuted = false;

  try {
    musicMuted = window.localStorage.getItem(musicPreferenceKey) === "off";
  } catch (_) {
    musicMuted = false;
  }

  function rememberMusicPreference(enabled) {
    try {
      window.localStorage.setItem(musicPreferenceKey, enabled ? "on" : "off");
    } catch (_) {
      // La experiencia sigue funcionando aunque el navegador bloquee el almacenamiento.
    }
  }

  function syncMusicControl(waitingForGesture = false) {
    const isPlaying = !activeMusic.paused && !activeMusic.ended;
    musicToggle.classList.toggle("is-playing", isPlaying && !musicMuted);
    musicToggle.classList.toggle("is-muted", musicMuted);
    musicToggle.classList.toggle("is-awaiting", waitingForGesture);
    musicToggle.setAttribute("aria-pressed", String(musicMuted));

    const action = musicMuted ? "Activar sonido" : "Silenciar música";
    musicToggle.setAttribute("aria-label", action);
    musicToggle.title = action;
  }

  async function playBackgroundMusic() {
    try {
      activeMusic.volume = musicVolume;
      activeMusic.muted = musicMuted;
      await activeMusic.play();
      syncMusicControl(false);
      return true;
    } catch (_) {
      syncMusicControl(true);
      return false;
    }
  }

  function setMusicMuted(muted, remember = false) {
    musicMuted = muted;
    backgroundMusic.muted = muted;
    bonusMusic.muted = muted;
    if (remember) rememberMusicPreference(!muted);
    syncMusicControl(false);
  }

  function stopMusicFade() {
    if (!musicFadeFrame) return;
    window.cancelAnimationFrame(musicFadeFrame);
    musicFadeFrame = undefined;
  }

  async function switchMusic(nextTrack, { restart = false, startAt } = {}) {
    const previousTrack = activeMusic;
    stopMusicFade();

    const seekNextTrack = () => {
      try {
        nextTrack.currentTime = Number.isFinite(startAt) ? startAt : 0;
      } catch {
        // Safari can reject seeks before the audio metadata is available.
      }
    };

    if (restart || Number.isFinite(startAt)) {
      if (nextTrack.readyState >= 1) {
        seekNextTrack();
      } else {
        nextTrack.addEventListener("loadedmetadata", seekNextTrack, { once: true });
      }
    }
    activeMusic = nextTrack;
    nextTrack.muted = musicMuted;

    nextTrack.volume = previousTrack === nextTrack ? musicVolume : 0;

    try {
      await nextTrack.play();
    } catch (_) {
      syncMusicControl(true);
      return false;
    }

    if (previousTrack === nextTrack || previousTrack.paused) {
      nextTrack.volume = musicVolume;
      syncMusicControl(false);
      return true;
    }

    const startedAt = window.performance.now();
    const duration = reduceMotion ? 250 : 1400;

    const fade = (now) => {
      const progress = Math.min(1, Math.max(0, (now - startedAt) / duration));
      previousTrack.volume = musicVolume * (1 - progress);
      nextTrack.volume = musicVolume * progress;

      if (progress < 1) {
        musicFadeFrame = window.requestAnimationFrame(fade);
        return;
      }

      previousTrack.pause();
      previousTrack.volume = musicVolume;
      nextTrack.volume = musicVolume;
      musicFadeFrame = undefined;
      syncMusicControl(false);
    };

    musicFadeFrame = window.requestAnimationFrame(fade);
    return true;
  }

  function initBackgroundMusic() {
    backgroundMusic.volume = musicVolume;
    bonusMusic.volume = musicVolume;
    setMusicMuted(musicMuted);
    syncMusicControl(false);

    musicToggle.addEventListener("click", () => {
      setMusicMuted(!musicMuted, true);
      if (activeMusic.paused) playBackgroundMusic();
    });

    [backgroundMusic, bonusMusic].forEach((track) => {
      track.addEventListener("play", () => {
        if (track === activeMusic) syncMusicControl(false);
      });
      track.addEventListener("pause", () => {
        if (track === activeMusic) syncMusicControl(true);
      });
    });

    const unlockOnInteraction = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!activeMusic.paused || target?.closest("#music-toggle")) return;
      playBackgroundMusic().then((started) => {
        if (!started) return;
        document.removeEventListener("pointerdown", unlockOnInteraction);
        document.removeEventListener("keydown", unlockOnInteraction);
      });
    };

    document.addEventListener("pointerdown", unlockOnInteraction);
    document.addEventListener("keydown", unlockOnInteraction);

    playBackgroundMusic();
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

  function readBonusChoice() {
    try {
      return window.localStorage.getItem(bonusChoiceKey);
    } catch (_) {
      return null;
    }
  }

  function saveBonusChoice(giftId) {
    try {
      window.localStorage.setItem(bonusChoiceKey, giftId);
    } catch (_) {
      // La carta igualmente se revela aunque el navegador bloquee el almacenamiento.
    }
  }

  function clearBonusChoice() {
    try {
      window.localStorage.removeItem(bonusChoiceKey);
    } catch (_) {
      // El botón de reinicio existe solamente para facilitar las pruebas.
    }
  }

  function shuffledBonusGifts() {
    const giftsCopy = [...content.bonusGifts];
    for (let index = giftsCopy.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [giftsCopy[index], giftsCopy[randomIndex]] = [giftsCopy[randomIndex], giftsCopy[index]];
    }
    return giftsCopy;
  }

  function applyBonusDesign(design) {
    const nextDesign = ["a", "b", "c"].includes(design) ? design : "a";
    bonus.classList.remove("bonus-design-a", "bonus-design-b", "bonus-design-c");
    bonus.classList.add(`bonus-design-${nextDesign}`);
    bonusDesignButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.bonusDesign === nextDesign));
    });
  }

  function buildBonusCards() {
    bonusDeck.replaceChildren();

    shuffledBonusGifts().forEach((gift, index) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "bonus-card";
      card.style.setProperty("--card-index", index);
      card.setAttribute("aria-label", `Elegir la carta sorpresa ${index + 1}`);
      card.innerHTML = `
        <span class="bonus-card__paper">
          <span class="bonus-card__corner bonus-card__corner--one" aria-hidden="true">✦</span>
          <span class="bonus-card__corner bonus-card__corner--two" aria-hidden="true">✧</span>
          <span class="bonus-card__compass" aria-hidden="true"><span class="bonus-card__question">?</span></span>
          <span class="bonus-card__seal" aria-hidden="true">✦</span>
        </span>
      `;
      card.addEventListener("click", () => {
        pendingBonusGift = { gift, card };
        bonusConfirmCard.textContent = "Tu carta elegida";
        bonusConfirm.classList.remove("hidden");
        bonusConfirmChoice.focus({ preventScroll: true });
      });
      bonusDeck.append(card);
    });
  }

  function renderBonusResult(choiceId) {
    const chosenGift = content.bonusGifts.find((gift) => gift.id === choiceId);
    if (!chosenGift) return false;

    const otherGifts = content.bonusGifts.filter((gift) => gift.id !== choiceId);
    bonusIntro.classList.add("hidden");
    bonusSelection.classList.add("hidden");
    bonusResult.classList.remove("hidden");
    bonus.classList.add("has-choice", "cards-arrived");

    bonusResult.innerHTML = `
      <header class="bonus__header bonus-result__header">
        <p class="bonus__eyebrow">El destino marcó tu camino</p>
        <h2>Este es tu tesoro.</h2>
      </header>
      <article class="bonus-prize">
        <span class="bonus-prize__label">Tu carta elegida</span>
        <span class="bonus-prize__symbol" aria-hidden="true">${chosenGift.symbol}</span>
        <h3>${chosenGift.title}</h3>
      </article>
      <p class="bonus-result__note">La elección quedó guardada. Si este regalo ya llegó a tus manos, avisame y buscamos juntos una nueva ruta.</p>
      <button class="bonus-button bonus-paths-button" id="bonus-paths-button" type="button" aria-expanded="false">
        Ver los otros caminos
      </button>
      <section class="bonus-paths hidden" id="bonus-paths" aria-label="Regalos que guardaban las otras cartas">
        <header>
          <p class="bonus__eyebrow">Los tesoros que quedaron en el mapa</p>
          <h3>Los otros caminos.</h3>
        </header>
        <div class="bonus-paths__grid">
          ${otherGifts.map((gift) => `
            <article class="bonus-path-card">
              <span aria-hidden="true">${gift.symbol}</span>
              <h4>${gift.title}</h4>
            </article>
          `).join("")}
        </div>
      </section>
      ${previewMode ? '<button class="bonus-reset" id="bonus-reset" type="button">Reiniciar elección</button>' : ""}
    `;

    const pathsButton = bonusResult.querySelector("#bonus-paths-button");
    const paths = bonusResult.querySelector("#bonus-paths");
    pathsButton.addEventListener("click", () => {
      const opening = paths.classList.contains("hidden");
      paths.classList.toggle("hidden", !opening);
      pathsButton.setAttribute("aria-expanded", String(opening));
      pathsButton.textContent = opening ? "Ocultar los otros caminos" : "Ver los otros caminos";
      if (opening) window.setTimeout(() => paths.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }), 80);
    });

    if (previewMode && searchParams.has("showBonusPaths")) pathsButton.click();

    const resetButton = bonusResult.querySelector("#bonus-reset");
    resetButton?.addEventListener("click", () => {
      clearBonusChoice();
      bonus.classList.remove("has-choice");
      bonusResult.classList.add("hidden");
      bonusSelection.classList.remove("hidden");
      buildBonusCards();
      bonus.scrollTop = 0;
    });

    bonus.scrollTop = 0;
    return true;
  }

  function openBonus() {
    window.clearTimeout(bonusArrivalTimer);
    pendingBonusGift = null;
    bonusConfirm.classList.add("hidden");
    bonus.classList.remove("hidden", "is-leaving", "cards-arrived", "has-choice", "skip-intro");
    document.body.classList.add("bonus-open");
    gifts.setAttribute("aria-hidden", "true");
    bonus.scrollTop = 0;

    const savedChoice = previewBonusChoice || readBonusChoice();
    if (savedChoice && content.bonusGifts.some((gift) => gift.id === savedChoice)) {
      switchMusic(bonusMusic, { startAt: 10 });
      renderBonusResult(savedChoice);
      return;
    }

    bonusIntro.classList.remove("hidden");
    bonusSelection.classList.remove("hidden");
    bonusResult.classList.add("hidden");
    buildBonusCards();
    switchMusic(bonusMusic, { restart: true });

    if (skipBonusIntro) {
      bonus.classList.add("skip-intro", "cards-arrived");
      return;
    }

    window.requestAnimationFrame(() => bonus.classList.add("is-visible"));
    bonusArrivalTimer = window.setTimeout(() => {
      bonus.classList.add("cards-arrived");
      bonus.scrollTop = 0;
    }, reduceMotion ? 900 : 9850);
  }

  function closeBonus() {
    window.clearTimeout(bonusArrivalTimer);
    bonusConfirm.classList.add("hidden");
    bonus.classList.add("is-leaving");
    switchMusic(backgroundMusic);
    gifts.removeAttribute("aria-hidden");
    document.body.classList.remove("bonus-open");

    window.setTimeout(() => {
      bonus.classList.add("hidden");
      bonus.classList.remove("is-visible", "is-leaving", "cards-arrived", "skip-intro");
      bonusChestTrigger.focus({ preventScroll: true });
    }, reduceMotion ? 0 : 450);
  }

  function confirmBonusChoice() {
    if (!pendingBonusGift) return;
    const { gift } = pendingBonusGift;
    saveBonusChoice(gift.id);
    bonusConfirm.classList.add("hidden");
    pendingBonusGift = null;
    renderBonusResult(gift.id);
  }

  function showGifts() {
    preloadBonusAssets();
    journey.classList.add("is-leaving");
    window.setTimeout(() => {
      journey.classList.add("hidden");
      journey.classList.remove("is-leaving");
      gifts.classList.remove("hidden");
      gifts.scrollTop = 0;
    }, reduceMotion ? 0 : 500);
  }

  function showGiftsImmediately() {
    preloadBonusAssets();
    gate.classList.add("hidden");
    journey.classList.add("hidden");
    gifts.classList.remove("hidden");
    gifts.scrollTop = 0;
    document.body.classList.add("in-experience");
  }

  function preloadBonusAssets() {
    if (bonusAssetsPreloaded) return;
    bonusAssetsPreloaded = true;

    [
      "./assets/bonus-chest-closed.png",
      "./assets/bonus-chest-open.png",
      "./assets/bonus-sunset-zoro-bg-desktop-v2.png",
      "./assets/bonus-sunset-zoro-bg-mobile-v2.png",
    ].forEach((source) => {
      const image = new Image();
      image.src = source;
    });

    bonusMusic.preload = "auto";
    bonusMusic.load();
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
  bonusChestTrigger.addEventListener("click", openBonus);
  bonusClose.addEventListener("click", closeBonus);
  bonusCancel.addEventListener("click", () => {
    bonusConfirm.classList.add("hidden");
    pendingBonusGift?.card.focus({ preventScroll: true });
    pendingBonusGift = null;
  });
  bonusConfirmChoice.addEventListener("click", confirmBonusChoice);
  bonusDesignButtons.forEach((button) => {
    button.addEventListener("click", () => applyBonusDesign(button.dataset.bonusDesign));
  });
  bonusConfirm.addEventListener("click", (event) => {
    if (event.target !== bonusConfirm) return;
    bonusCancel.click();
  });

  document.addEventListener("keydown", (event) => {
    if (!bonus.classList.contains("hidden")) {
      if (event.key === "Escape") {
        if (!bonusConfirm.classList.contains("hidden")) bonusCancel.click();
        else closeBonus();
      }
      return;
    }
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
  applyBonusDesign(requestedBonusDesign);
  if (previewMode && directBonusPreview) bonusDesignPicker.classList.remove("hidden");
  updateCountdown();
  if (directBonusPreview) {
    showGiftsImmediately();
    window.setTimeout(openBonus, 80);
  } else if (directGiftPreview) showGiftsImmediately();
  else if (directTextPreview) showJourney(previewScene, true);
  countdownTimer = window.setInterval(updateCountdown, 1000);
})();
