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
    maxBounds: ROMANIA_BOUNDS,
    maxBoundsViscosity: 1.0,
  });

  map.fitBounds(ROMANIA_BOUNDS, { padding: [18, 18] });
  map.setMinZoom(6);
  map.setMaxZoom(22);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxNativeZoom: 19,
    maxZoom: 22,
  }).addTo(map);

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

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
            <img id="${heroId}" src="${firstSrc}" alt="${firstAlt}" draggable="false" />
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
        autoPanPadding: [18, 18],
        className: 'qsc-popup',
      });

      marker.bindTooltip(loc.title, {
        direction: 'top',
        offset: [0, -10],
        opacity: 0.95,
      });

      marker.on('mouseover', () => marker.openTooltip());
      marker.on('mouseout', () => marker.closeTooltip());
      marker.on('popupopen', (e) => wirePopupGallery(loc, e.popup));
    });
  }

  loadLocations()
    .then((locations) => addPins(locations))
    .catch((err) => {
      console.error(err);
    });
})();
