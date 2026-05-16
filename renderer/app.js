const appRoot = document.querySelector("#app");

const state = {
  view: "loading",
  session: null,
  sessionPath: "",
  selectedPath: "",
  destinationFolder: "",
  copyProgress: null,
  copyResult: null,
  imageError: "",
  isTransitioning: false,
  enterDirection: "",
  drag: {
    active: false,
    startX: 0,
    offsetX: 0,
    frame: 0
  }
};

const fileKinds = "JPG, PNG, GIF, WebP, BMP, TIFF, HEIC";

function reviewedCount() {
  if (!state.session) return 0;
  return state.session.selected.length + state.session.rejected.length + state.session.skipped.length;
}

function currentPhoto() {
  if (!state.session) return null;
  return state.session.photos[state.session.currentIndex] || null;
}

function normalizeSession(session) {
  return {
    sourceFolder: "",
    photos: [],
    selected: [],
    rejected: [],
    skipped: [],
    rotations: {},
    history: [],
    currentIndex: 0,
    ...session,
    selected: session.selected || [],
    rejected: session.rejected || [],
    skipped: session.skipped || [],
    rotations: session.rotations || {},
    history: session.history || []
  };
}

function normalizeRotation(degrees) {
  return ((degrees % 360) + 360) % 360;
}

function currentRotation(photo = currentPhoto()) {
  if (!state.session || !photo) return 0;
  return normalizeRotation(state.session.rotations?.[photo.path] || 0);
}

function isReviewComplete() {
  return state.session && state.session.currentIndex >= state.session.photos.length;
}

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setView(view) {
  state.view = view;
  render();
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function persistSession() {
  if (!state.session) return;
  state.session.rotations = state.session.rotations || {};
  const result = await window.photoApp.saveSession(state.session);
  state.session = normalizeSession(result.session);
  state.sessionPath = result.sessionPath;
  state.selectedPath = result.selectedPath;
}

async function chooseSourceFolder() {
  setView("loading");
  try {
    const result = await window.photoApp.chooseSourceFolder();
    if (!result) {
      setView(state.session ? "review" : "welcome");
      return;
    }

    state.session = normalizeSession(result.session);
    state.sessionPath = result.sessionPath;
    state.selectedPath = result.selectedPath;
    state.destinationFolder = "";
    state.copyProgress = null;
    state.copyResult = null;
    state.imageError = "";
    setView(state.session.photos.length ? "review" : "empty");
  } catch (error) {
    showError(error.message);
  }
}

function goHome() {
  if (state.view === "copying") return;

  state.session = null;
  state.sessionPath = "";
  state.selectedPath = "";
  state.destinationFolder = "";
  state.copyProgress = null;
  state.copyResult = null;
  state.imageError = "";
  state.isTransitioning = false;
  state.enterDirection = "";
  setView("welcome");
}

async function rotateCurrentPhoto(delta) {
  const photo = currentPhoto();
  if (!photo || isReviewComplete()) return;

  state.session.rotations = state.session.rotations || {};
  const previousRotation = currentRotation(photo);
  const nextRotation = normalizeRotation(previousRotation + delta);

  if (nextRotation === 0) {
    delete state.session.rotations[photo.path];
  } else {
    state.session.rotations[photo.path] = nextRotation;
  }

  state.session.history.push({
    photo: photo.path,
    action: "rotated",
    index: state.session.currentIndex,
    previousRotation,
    nextRotation,
    at: new Date().toISOString()
  });

  await persistSession();
  render();
}

function moveCardTemporarily(direction) {
  const card = document.querySelector(".photo-card");
  if (!card) return;
  card.classList.remove("is-dragging");
  card.style.setProperty("--swipe-opacity", "0.22");
  card.style.setProperty("--swipe-glow", "34px");
  card.dataset.intent = direction === "selected" ? "select" : "reject";
  card.classList.add(direction === "selected" ? "throw-right" : "throw-left");
}

async function decide(action) {
  const photo = currentPhoto();
  if (!photo || isReviewComplete() || state.isTransitioning) return;

  state.isTransitioning = true;
  moveCardTemporarily(action);
  await delay(290);

  state.session[action].push(photo.path);
  state.session.history.push({
    photo: photo.path,
    action,
    index: state.session.currentIndex,
    at: new Date().toISOString()
  });
  state.session.currentIndex += 1;
  state.imageError = "";
  state.enterDirection = action === "selected" ? "right" : "left";

  state.view = isReviewComplete() ? "complete" : "review";
  render();
  try {
    await persistSession();
  } finally {
    state.isTransitioning = false;
  }
}

async function undo() {
  if (!state.session || state.session.history.length === 0 || state.view === "copying") return;

  const last = state.session.history.pop();
  if (last.action === "rotated") {
    state.session.rotations = state.session.rotations || {};
    if (normalizeRotation(last.previousRotation) === 0) {
      delete state.session.rotations[last.photo];
    } else {
      state.session.rotations[last.photo] = normalizeRotation(last.previousRotation);
    }
  } else {
    state.session[last.action] = state.session[last.action].filter((pathValue) => pathValue !== last.photo);
    state.session.currentIndex = last.index;
  }
  state.imageError = "";

  await persistSession();
  setView("review");
}

async function skipCorruptPhoto() {
  const photo = currentPhoto();
  if (!photo) return;

  state.session.skipped.push(photo.path);
  state.session.history.push({
    photo: photo.path,
    action: "skipped",
    index: state.session.currentIndex,
    at: new Date().toISOString()
  });
  state.session.currentIndex += 1;
  await persistSession();
  setView(isReviewComplete() ? "complete" : "review");
}

async function chooseDestination() {
  const destination = await window.photoApp.chooseDestinationFolder();
  if (!destination) return;
  state.destinationFolder = destination;
  render();
}

async function copySelected() {
  if (!state.destinationFolder || !state.session) return;

  state.view = "copying";
  state.copyProgress = { copied: 0, failed: 0, total: state.session.selected.length };
  state.copyResult = null;
  render();

  try {
    state.copyResult = await window.photoApp.copySelected(state.session.selected, state.destinationFolder);
    state.view = "copied";
    render();
  } catch (error) {
    showError(error.message);
  }
}

function showError(message) {
  state.view = "error";
  state.error = message;
  render();
}

function handleKeydown(event) {
  if (event.target.matches("button, input")) return;

  if (event.key === "ArrowRight") {
    event.preventDefault();
    decide("selected");
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    decide("rejected");
  } else if (event.key === "Backspace" || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z")) {
    event.preventDefault();
    undo();
  } else if (event.key === "[") {
    event.preventDefault();
    rotateCurrentPhoto(-90);
  } else if (event.key === "]" || event.key.toLowerCase() === "r") {
    event.preventDefault();
    rotateCurrentPhoto(90);
  }
}

function pointerDown(event) {
  const photo = currentPhoto();
  if (!photo || state.isTransitioning) return;
  state.drag.active = true;
  state.drag.startX = event.clientX;
  state.drag.offsetX = 0;
  state.drag.frame = 0;
  event.currentTarget.classList.add("is-dragging");
  event.currentTarget.setPointerCapture(event.pointerId);
}

function paintDraggedCard() {
  state.drag.frame = 0;
  const card = document.querySelector(".photo-card");
  if (!card) return;
  const rotation = state.drag.offsetX / 24;
  const swipeStrength = Math.min(Math.abs(state.drag.offsetX) / 140, 1);
  const swipeOpacity = (0.08 + swipeStrength * 0.28).toFixed(2);
  const swipeGlow = `${Math.round(10 + swipeStrength * 30)}px`;
  card.style.transform = `translate3d(${state.drag.offsetX}px, 0, 0) rotate(${rotation}deg)`;
  card.style.setProperty("--swipe-opacity", swipeOpacity);
  card.style.setProperty("--swipe-glow", swipeGlow);
  card.dataset.intent = state.drag.offsetX > 12 ? "select" : state.drag.offsetX < -12 ? "reject" : "";
}

function pointerMove(event) {
  if (!state.drag.active) return;
  event.preventDefault();
  state.drag.offsetX = event.clientX - state.drag.startX;
  if (!state.drag.frame) {
    state.drag.frame = requestAnimationFrame(paintDraggedCard);
  }
}

function pointerUp(event) {
  if (!state.drag.active) return;
  const offset = state.drag.offsetX;
  state.drag.active = false;
  state.drag.offsetX = 0;
  if (state.drag.frame) {
    cancelAnimationFrame(state.drag.frame);
    state.drag.frame = 0;
  }
  const card = document.querySelector(".photo-card");
  if (card) {
    card.classList.remove("is-dragging");
    card.style.transform = "";
    card.style.setProperty("--swipe-opacity", "0");
    card.style.setProperty("--swipe-glow", "0px");
    card.dataset.intent = "";
    try {
      card.releasePointerCapture(event.pointerId);
    } catch (_error) {
      // Pointer capture may already be released by the platform.
    }
  }

  if (offset > 110) {
    decide("selected");
  } else if (offset < -110) {
    decide("rejected");
  }
}

function renderShell(content) {
  const canGoHome = Boolean(state.session) && state.view !== "welcome" && state.view !== "loading";

  appRoot.innerHTML = `
    <section class="app-shell view-${state.view}">
      <header class="topbar">
        <div>
          <h1>Albumish</h1>
          <p>${escapeHtml(state.session?.sourceFolder || "Choose a folder and start reviewing.")}</p>
        </div>
        <div class="topbar-actions">
          ${canGoHome ? `<button class="ghost" data-action="home">Home</button>` : ""}
          <button class="ghost" data-action="choose-source">Choose Folder</button>
        </div>
      </header>
      ${content}
    </section>
  `;
}

function renderWelcome() {
  renderShell(`
    <section class="welcome">
      <div class="welcome-copy">
        <h2>Worried about shortlisting hundreds of wedding photos?</h2>
        <p>No worries. Albumish helps you move through your album one photo at a time, keep the best shots, reject the rest, and copy your final picks into a new folder. Your original photos are never changed.</p>
      </div>
      <div class="start-panel">
        <h3>First time here?</h3>
        <ol class="quick-steps">
          <li><strong>Choose Photo Folder</strong><span>Pick the folder that has your wedding album or any photo collection.</span></li>
          <li><strong>Review each photo</strong><span>Use Select for keepers, Reject for photos you do not want, and Undo if you change your mind.</span></li>
          <li><strong>Copy selected photos</strong><span>At the end, choose where Albumish should copy only your selected photos.</span></li>
        </ol>
        <div class="button-guide">
          <span><strong>Select</strong> keeps a photo</span>
          <span><strong>Reject</strong> skips a photo</span>
          <span><strong>Rotate</strong> fixes sideways previews</span>
          <span><strong>Undo</strong> reverses the last action</span>
        </div>
        <p class="supported-formats">Supported formats: ${fileKinds}</p>
        <button class="primary large" data-action="choose-source">Choose Photo Folder</button>
      </div>
    </section>
  `);
}

function renderLoading() {
  renderShell(`
    <section class="center-state">
      <div class="loader"></div>
      <p>Loading photos...</p>
    </section>
  `);
}

function renderEmpty() {
  renderShell(`
    <section class="center-state">
      <h2>No supported photos found</h2>
      <p>This folder does not contain ${escapeHtml(fileKinds)} files.</p>
      <button class="primary" data-action="choose-source">Choose Another Folder</button>
    </section>
  `);
}

function renderReview() {
  const photo = currentPhoto();
  if (!photo) {
    renderComplete();
    return;
  }

  const total = state.session.photos.length;
  const reviewed = reviewedCount();
  const progressPercent = total ? Math.round((reviewed / total) * 100) : 0;
  const rotation = currentRotation(photo);

  renderShell(`
    <section class="review-layout">
      <section class="review-status-bar">
        <div class="review-progress">
          <div class="progress-copy">
            <span>${reviewed} of ${total}</span>
            <strong>${progressPercent}%</strong>
          </div>
          <div class="progress-track"><span style="width:${progressPercent}%"></span></div>
        </div>
        <dl class="review-stat-pills">
          <div class="chosen-pill" title="Chosen"><dt aria-label="Chosen">♥</dt><dd>${state.session.selected.length}</dd></div>
          <div class="passed-pill" title="Passed"><dt aria-label="Passed">×</dt><dd>${state.session.rejected.length}</dd></div>
        </dl>
      </section>

      <section class="viewer">
        <div class="${classNames("photo-card", state.enterDirection && "entering", state.enterDirection === "right" && "enter-from-right", state.enterDirection === "left" && "enter-from-left")}" data-photo-card data-rotation="${rotation}">
          <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.name)}" draggable="false" style="transform: rotate(${rotation}deg);" />
          ${state.imageError ? `<div class="image-warning"><strong>Preview failed</strong><span>${escapeHtml(state.imageError)}</span><button data-action="skip-corrupt">Skip photo</button></div>` : ""}
        </div>
        <div class="filename">${escapeHtml(photo.name)}${rotation ? ` - rotated ${rotation} deg` : ""}</div>
      </section>

      <section class="review-action-bar">
        <button class="reject action-button" data-action="reject">Reject</button>
        <button class="ghost icon-button" data-action="rotate-left" title="Rotate left ([)" aria-label="Rotate left">↺</button>
        <button class="ghost action-button" data-action="undo" ${state.session.history.length ? "" : "disabled"}>Undo</button>
        <button class="ghost icon-button" data-action="rotate-right" title="Rotate right (] or R)" aria-label="Rotate right">↻</button>
        <button class="select action-button" data-action="select">Select</button>
      </section>
    </section>
  `);
}

function renderComplete() {
  const total = state.session.photos.length;
  renderShell(`
    <section class="complete-layout">
      <div class="summary">
        <h2>Review complete</h2>
        <dl class="summary-grid">
          <div><dt>Total reviewed</dt><dd>${reviewedCount()} / ${total}</dd></div>
          <div><dt>Chosen</dt><dd>${state.session.selected.length}</dd></div>
          <div><dt>Passed</dt><dd>${state.session.rejected.length}</dd></div>
        </dl>
      </div>
      <div class="copy-panel">
        <button class="ghost full" data-action="choose-destination">Choose Destination</button>
        <p>${escapeHtml(state.destinationFolder || "No destination chosen yet.")}</p>
        <button class="primary full" data-action="copy-selected" ${state.destinationFolder ? "" : "disabled"}>
          Copy Selected Photos
        </button>
      </div>
    </section>
  `);
}

function renderCopying() {
  const progress = state.copyProgress || { copied: 0, failed: 0, total: state.session.selected.length };
  const percent = progress.total ? Math.round(((progress.copied + progress.failed) / progress.total) * 100) : 100;
  renderShell(`
    <section class="center-state">
      <h2>Copying selected photos</h2>
      <div class="progress-track wide"><span style="width:${percent}%"></span></div>
      <p>${progress.copied} copied, ${progress.failed} failed, ${progress.total} total</p>
    </section>
  `);
}

function renderCopied() {
  const copied = state.copyResult?.copied.length || 0;
  const failed = state.copyResult?.failed.length || 0;
  renderShell(`
    <section class="complete-layout">
      <div class="summary">
        <h2>Copy complete</h2>
        <dl class="summary-grid">
          <div><dt>Copied</dt><dd>${copied}</dd></div>
          <div><dt>Failed</dt><dd>${failed}</dd></div>
          <div><dt>Destination</dt><dd>${escapeHtml(state.destinationFolder)}</dd></div>
        </dl>
      </div>
      <div class="copy-panel">
        ${failed ? `<p class="warning">${failed} files could not be copied. Missing or locked files are listed in the session details.</p>` : `<p>All selected photos were copied safely. Originals were left untouched.</p>`}
        <button class="ghost full" data-action="choose-source">Start New Folder</button>
      </div>
    </section>
  `);
}

function renderError() {
  renderShell(`
    <section class="center-state">
      <h2>Something needs attention</h2>
      <p>${escapeHtml(state.error)}</p>
      <button class="primary" data-action="choose-source">Choose Folder</button>
    </section>
  `);
}

function render() {
  if (state.view === "loading") renderLoading();
  if (state.view === "welcome") renderWelcome();
  if (state.view === "empty") renderEmpty();
  if (state.view === "review") renderReview();
  if (state.view === "complete") renderComplete();
  if (state.view === "copying") renderCopying();
  if (state.view === "copied") renderCopied();
  if (state.view === "error") renderError();

  const card = document.querySelector("[data-photo-card]");
  if (card) {
    card.addEventListener("pointerdown", pointerDown);
    card.addEventListener("pointermove", pointerMove);
    card.addEventListener("pointerup", pointerUp);
    card.addEventListener("pointercancel", pointerUp);
  }

  const img = document.querySelector(".photo-card img");
  if (img) {
    img.addEventListener("error", () => {
      state.imageError = "The file may be unsupported by the preview engine or corrupted.";
      render();
    });
  }

  if (state.enterDirection) {
    setTimeout(() => {
      state.enterDirection = "";
    }, 360);
  }
}

appRoot.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;

  if (action === "choose-source") chooseSourceFolder();
  if (action === "home") goHome();
  if (action === "select") decide("selected");
  if (action === "reject") decide("rejected");
  if (action === "undo") undo();
  if (action === "rotate-left") rotateCurrentPhoto(-90);
  if (action === "rotate-right") rotateCurrentPhoto(90);
  if (action === "choose-destination") chooseDestination();
  if (action === "copy-selected") copySelected();
  if (action === "skip-corrupt") skipCorruptPhoto();
});

window.addEventListener("keydown", handleKeydown);

window.photoApp.onCopyProgress((progress) => {
  state.copyProgress = progress;
  if (state.view === "copying") render();
});

async function boot() {
  try {
    const result = await window.photoApp.loadSession();
    if (result?.session && Array.isArray(result.session.photos) && result.session.photos.length > 0) {
      state.session = normalizeSession(result.session);
      state.sessionPath = result.sessionPath;
      state.selectedPath = result.selectedPath;
      state.view = isReviewComplete() ? "complete" : "review";
    } else {
      state.view = "welcome";
    }
    render();
  } catch (error) {
    showError(error.message);
  }
}

boot();
