/* Scop: Inițializează harta Leaflet (OSM), pinurile cu hover și popup cu galerie la click. */

(() => {
  const ROMANIA_BOUNDS = L.latLngBounds(
    L.latLng(43.6, 20.2),
    L.latLng(48.3, 29.7),
  );

  async function loadLocations() {
    const res = await fetch('./assets/locations.json', { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Nu pot încărca assets/locations.json (HTTP ${res.status})`);
    }

    const json = await res.json();
    const locations = Array.isArray(json?.locations) ? json.locations : [];
    return locations;
  }

  const map = L.map('map', {
    zoomControl: true,
  });

  const DEFAULT_BOUNDS_VISCOSITY = 1.0;
  map.setMaxBounds(ROMANIA_BOUNDS);
  map.options.maxBoundsViscosity = DEFAULT_BOUNDS_VISCOSITY;

  map.fitBounds(ROMANIA_BOUNDS, { padding: [18, 18] });
  map.setMinZoom(6);
  map.setMaxZoom(22);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxNativeZoom: 19,
    maxZoom: 22,
  }).addTo(map);

  const headerEl = document.querySelector('.app-header');
  const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 0;
  const autoPanPaddingTopLeft = [18, Math.round(headerHeight + 18)];
  const autoPanPaddingBottomRight = [18, 18];

  function stabilizeAutoPan(popup) {
    setTimeout(() => {
      popup.options.autoPan = false;
    }, 0);
  }

  map.on('popupopen', () => {
    map.setMaxBounds(null);
    map.options.maxBoundsViscosity = 0;
  });

  map.on('popupclose', (e) => {
    if (!e.popup?.options) return;
    e.popup.options.autoPan = true;

    map.setMaxBounds(ROMANIA_BOUNDS);
    map.options.maxBoundsViscosity = DEFAULT_BOUNDS_VISCOSITY;
  });

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  const fsOverlayEl = document.getElementById('fullscreenOverlay');
  const fsImageEl = document.getElementById('fullscreenImage');

  /** @type {{ location: any, index: number } | null} */
  let fsState = null;

  function renderFullscreen() {
    if (!fsOverlayEl || !fsImageEl || !fsState) return;

    const images = Array.isArray(fsState.location?.images)
      ? fsState.location.images
      : [];

    if (images.length === 0) return;

    const safeIndex = ((fsState.index % images.length) + images.length) % images.length;
    fsState.index = safeIndex;

    const img = images[safeIndex];
    fsImageEl.src = img.src;
    fsImageEl.alt = img.alt || 'Imagine';
  }

  function openFullscreen(location, index) {
    if (!fsOverlayEl || !fsImageEl) return;

    fsState = { location, index };
    renderFullscreen();

    fsOverlayEl.classList.add('is-open');
    fsOverlayEl.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeFullscreen() {
    if (!fsOverlayEl || !fsImageEl) return;

    fsState = null;

    fsOverlayEl.classList.remove('is-open');
    fsOverlayEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    fsImageEl.removeAttribute('src');
    fsImageEl.removeAttribute('alt');
  }

  if (fsOverlayEl) {
    fsOverlayEl.addEventListener('click', (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      const actionEl = target.closest('[data-action="close"]');
      if (!actionEl) return;
      closeFullscreen();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (!fsOverlayEl?.classList.contains('is-open')) return;

    if (e.key === 'Escape') {
      closeFullscreen();
      return;
    }

    if (!fsState) return;

    if (e.key === 'ArrowRight') {
      fsState.index += 1;
      renderFullscreen();
      return;
    }

    if (e.key === 'ArrowLeft') {
      fsState.index -= 1;
      renderFullscreen();
    }
  });

  function buildPopupHtml(location) {
    const title = escapeHtml(location.title);
    const subtitle = escapeHtml(location.subtitle);
    const description = escapeHtml(location.description ?? '');

    const heroId = `qsc-hero-${location.id}`;
    const thumbsId = `qsc-thumbs-${location.id}`;

    const first = location.images[0];
    const firstSrc = first ? escapeHtml(first.src) : '';
    const firstAlt = first ? escapeHtml(first.alt) : '';

    const thumbs = location.images
      .map((img, idx) => {
        const thumbSrc = escapeHtml(img.thumb);
        const alt = escapeHtml(img.alt);
        return `
          <button type="button" class="gallery__thumb" data-thumb-index="${idx}" aria-selected="${idx === 0}">
            <img src="${thumbSrc}" alt="${alt}" loading="lazy" draggable="false" />
          </button>
        `;
      })
      .join('');

    const descriptionBlock = description
      ? `<div class="qsc-popup__subtitle" style="margin-top: 8px;">${description}</div>`
      : '';

    return `
      <div class="qsc-popup__body" data-location-id="${escapeHtml(location.id)}">
        <h3 class="qsc-popup__title">${title}</h3>
        <div class="qsc-popup__subtitle">${subtitle}</div>
        ${descriptionBlock}

        <div class="gallery" style="margin-top: 10px;">
          <div class="gallery__hero">
            <img id="${heroId}" data-active-index="0" src="${firstSrc}" alt="${firstAlt}" draggable="false" />
          </div>
          <div id="${thumbsId}" class="gallery__thumbs" aria-label="Miniaturi">
            ${thumbs}
          </div>
        </div>
      </div>
    `;
  }

  function wirePopupGallery(location, popup) {
    const popupEl = popup.getElement();
    if (!popupEl) return;

    L.DomEvent.disableClickPropagation(popupEl);
    L.DomEvent.disableScrollPropagation(popupEl);

    const heroEl = popupEl.querySelector(`#qsc-hero-${CSS.escape(location.id)}`);
    const thumbsEl = popupEl.querySelector(`#qsc-thumbs-${CSS.escape(location.id)}`);
    if (!heroEl || !thumbsEl) return;

    heroEl.addEventListener('click', (e) => {
      L.DomEvent.preventDefault(e);
      L.DomEvent.stopPropagation(e);
      const index = Number(heroEl.getAttribute('data-active-index') ?? '0');
      openFullscreen(location, Number.isNaN(index) ? 0 : index);
    });

    const thumbButtons = /** @type {NodeListOf<HTMLButtonElement>} */ (
      thumbsEl.querySelectorAll('[data-thumb-index]')
    );

    const onThumbClick = (e) => {
      L.DomEvent.preventDefault(e);
      L.DomEvent.stopPropagation(e);

      const target = /** @type {HTMLElement} */ (e.target);
      const btn = target.closest('[data-thumb-index]');
      if (!btn) return;

      const index = Number(btn.getAttribute('data-thumb-index'));
      const img = location.images[index];
      if (!img) return;

      heroEl.setAttribute('src', img.src);
      heroEl.setAttribute('alt', img.alt);
      heroEl.setAttribute('data-active-index', String(index));

      thumbButtons.forEach((el) => {
        const elIndex = Number(el.getAttribute('data-thumb-index'));
        el.setAttribute('aria-selected', String(elIndex === index));
      });
    };

    L.DomEvent.on(thumbsEl, 'click', onThumbClick);
  }

  function addPins(locations) {
    locations.forEach((loc) => {
      const marker = L.marker([loc.lat, loc.lng]).addTo(map);

      marker.bindPopup(buildPopupHtml(loc), {
        closeButton: true,
        minWidth: 320,
        maxWidth: 420,
        autoPan: true,
        keepInView: false,
        autoPanPaddingTopLeft,
        autoPanPaddingBottomRight,
        className: 'qsc-popup',
      });

      marker.bindTooltip(loc.title, {
        direction: 'top',
        offset: [0, -10],
        opacity: 0.95,
      });

      marker.on('mouseover', () => marker.openTooltip());
      marker.on('mouseout', () => marker.closeTooltip());
      marker.on('popupopen', (e) => {
        wirePopupGallery(loc, e.popup);
        stabilizeAutoPan(e.popup);
      });
    });
  }

  loadLocations()
    .then((locations) => addPins(locations))
    .catch((err) => {
      console.error(err);
    });
})();
