(() => {
  const KIOSK_CONFIG = window.KIOSK_CONFIG || {};
  const photoCard = document.getElementById("photoCard") || document.querySelector(".photo-card");
  if (!photoCard) return;

  const rawPhotos = KIOSK_CONFIG.photos || KIOSK_CONFIG.sitePhotos || KIOSK_CONFIG.weatherPhotos || [];
  const photos = normalizePhotos(rawPhotos);
  if (!photos.length) return;

  const intervalMs = normalizeInterval(KIOSK_CONFIG.photoIntervalMs || KIOSK_CONFIG.sitePhotoIntervalMs);
  let activeIndex = 0;
  let timer = null;

  photoCard.classList.add("has-photos");

  const stage = document.createElement("div");
  stage.className = "photo-stage";
  stage.setAttribute("aria-hidden", "true");

  const slides = photos.map((photo, index) => {
    const slide = document.createElement("div");
    slide.className = "photo-slide";
    if (index === 0) slide.classList.add("is-active");

    const image = document.createElement("img");
    image.src = photo.src;
    image.alt = "";
    image.loading = index === 0 ? "eager" : "lazy";
    image.decoding = "async";

    if (photo.position) slide.style.setProperty("--photo-position", photo.position);

    slide.appendChild(image);
    stage.appendChild(slide);
    return slide;
  });

  photoCard.prepend(stage);

  const caption = document.createElement("div");
  caption.className = "photo-caption";
  caption.id = "photoCaption";
  caption.textContent = photos[0].caption || photos[0].alt || "";
  caption.hidden = !caption.textContent;
  photoCard.appendChild(caption);

  function showPhoto(nextIndex) {
    slides[activeIndex].classList.remove("is-active");
    activeIndex = nextIndex % slides.length;
    slides[activeIndex].classList.add("is-active");

    const text = photos[activeIndex].caption || photos[activeIndex].alt || "";
    caption.textContent = text;
    caption.hidden = !text;
  }

  function startRotation() {
    if (slides.length <= 1) return;
    window.clearInterval(timer);
    timer = window.setInterval(() => showPhoto(activeIndex + 1), intervalMs);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      window.clearInterval(timer);
      return;
    }
    startRotation();
  });

  startRotation();

  function normalizePhotos(value) {
    if (!Array.isArray(value)) return [];
    return value.map((photo) => {
      if (typeof photo === "string") return { src: photo.trim(), alt: "", caption: "", position: "" };
      if (!photo || typeof photo !== "object") return null;
      const src = String(photo.src || photo.url || photo.path || "").trim();
      if (!src) return null;
      return {
        src,
        alt: String(photo.alt || "").trim(),
        caption: String(photo.caption || photo.title || "").trim(),
        position: String(photo.position || photo.objectPosition || "").trim()
      };
    }).filter(Boolean);
  }

  function normalizeInterval(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 2500) return 8000;
    return Math.round(number);
  }
})();
