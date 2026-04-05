(() => {
  const STORAGE_KEY = 'literary-world-map-books-v1';
  const FALLBACK_COLORS = ['#ff6b6b', '#4ecdc4', '#6c63ff', '#ff9f43', '#00b894', '#e056fd'];
  const BOOK_ICONS = [
    '/img/theme/1book/1book1.jpeg',
    '/img/theme/1book/1book2.jpeg',
    '/img/theme/1book/1book3.jpeg',
    '/img/theme/1book/1book4.jpeg',
    '/img/theme/1book/1book6.jpeg',
    '/img/theme/1book/1book_icon2.jpeg',
    '/img/theme/1book/book_icon1.jpeg',
  ];

  const state = {
    books: [],
    selectedBookId: null,
    bookQuery: '',
    map: null,
    markersLayer: null,
  };

  const refs = {};

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    bindRefs();
    initMap();
    bindModeTabs();
    bindActions();
    await loadBooks();
    renderAll();
  }

  function bindRefs() {
    refs.bookList = document.getElementById('book-list');
    refs.bookSearch = document.getElementById('book-search');
    refs.bookSelect = document.querySelector('#add-location-form select[name="bookId"]');
    refs.clearHighlight = document.getElementById('clear-highlight');
    refs.exportCsv = document.getElementById('export-csv');
    refs.addBookForm = document.getElementById('add-book-form');
    refs.addLocationForm = document.getElementById('add-location-form');
    refs.toggleLocationForm = document.getElementById('toggle-location-form');
  refs.findCoordsAdd = document.getElementById('find-coords-add');
  refs.findCoordsEdit = document.getElementById('find-coords-edit');
  refs.geocodeStatusAdd = document.getElementById('geocode-status-add');
  refs.geocodeStatusEdit = document.getElementById('geocode-status-edit');
    refs.locationModal = document.getElementById('location-modal');
    refs.editLocationForm = document.getElementById('edit-location-form');
    refs.closeLocationModal = document.getElementById('close-location-modal');
    refs.cancelLocationEdit = document.getElementById('cancel-location-edit');
    refs.locationImagePreview = document.getElementById('location-image-preview');
    refs.bookCounter = document.getElementById('book-counter');
  }

  function initMap() {
    state.map = L.map('world-map', {
      worldCopyJump: true,
      minZoom: 2,
      maxZoom: 18,
      zoom: 2,
      scrollWheelZoom: true,
      dragging: true,
      touchZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
    }).setView([20, 10], 2);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(state.map);

    state.markersLayer = L.layerGroup().addTo(state.map);
  }

  async function loadBooks() {
    console.log(`Starting to load books...`);
    const jsonlBooks = await loadBooksFromJsonl();
    console.log(`Loaded from JSONL: ${jsonlBooks.length} books`);
    
    const savedBooks = loadSavedBooks();
    console.log(`Loaded from localStorage: ${savedBooks.length} books`);

    if (jsonlBooks.length) {
      state.books = mergeBooks(jsonlBooks, savedBooks);
      console.log(`✓ Using JSONL books (merged with saved): ${state.books.length} total`);
    } else if (savedBooks.length) {
      state.books = savedBooks;
      console.log(`✓ Using saved books from localStorage: ${state.books.length}`);
    } else {
      state.books = await loadSeedBooks();
      console.log(`✓ Using seed books: ${state.books.length}`);
    }

    console.log(`📚 Final state.books: ${state.books.length} books loaded`);
    persist();
    
    // No need for background geocoding - coordinates already in JSONL!
  }

  async function loadBooksFromJsonl() {
    const paths = [
      '/literary_world_map/books_enriched.jsonl',  // Absolute path from root
      'books_enriched.jsonl',                        // Relative to current page
      '../data/books_enriched.jsonl',               // Fallback: data folder
      '/data/books_enriched.jsonl'                  // Absolute path: data folder
    ];
    let jsonlText = null;

    for (const path of paths) {
      try {
        const res = await fetch(path);
        console.log(`  Tried ${path}: ${res.status} ${res.statusText}`);
        if (res.ok) {
          jsonlText = await res.text();
          console.log(`✅ Successfully loaded JSONL from: ${path} (${jsonlText.length} bytes)`);
          break;
        }
      } catch (error) {
        console.warn(`  ⚠️ Fetch error for ${path}:`, error.message);
      }
    }

    if (!jsonlText) {
      console.error('❌ Failed to load JSONL from ANY of these paths:', paths);
      return [];
    }

    const books = [];
    const lines = jsonlText.trim().split('\n');
    console.log(`📄 Parsing ${lines.length} lines from JSONL...`);
    
    lines.forEach((line, idx) => {
      if (!line.trim()) return;
      
      try {
        const book = JSON.parse(line);
        
        const title = book.title_vi || book.title_eng || book.org_title || '';
        const titleVi = book.title_vi || '';
        const orgTitle = book.org_title || '';
        const author = book.author || '';
        const bookId = book.book_id || '';
        const imageUrl = book.img_url || '';
        const locationSource = book.location_source || '';
        
        if (!title || !author) return;
        
        // Extract location info from locations array (already has lat/lng!)
        let locations = [];
        const seenLocations = new Set(); // Track duplicates
        
        if (Array.isArray(book.locations) && book.locations.length > 0) {
          book.locations.forEach((loc) => {
            const placeName = loc.name || '';
            if (placeName && !seenLocations.has(placeName)) {
              seenLocations.add(placeName);
              // Use lat/lng from location object if available, otherwise null
              locations.push({
                place: placeName,
                lat: loc.lat || null,
                lng: loc.lng || null,
                imageUrl: imageUrl,
                source: locationSource
              });
            }
          });
        }
        
        // Skip books with no locations
        if (locations.length === 0) return;
        
        books.push({
          id: `goodreads-${bookId}`,
          title,
          titleVi,
          orgTitle,
          author,
          year: book.year || '',
          color: FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
          locations: locations,
        });
      } catch (error) {
        console.warn(`Could not parse JSONL line ${idx + 1}:`, error);
      }
    });

    console.log(`✓ Loaded ${books.length} books with locations`);
    return dedupeBooksById(books);
  }

  async function geocodeLocations(books) {
    const geocodeCache = new Map();
    
    for (const book of books) {
      for (const location of book.locations || []) {
        if (location.lat !== null && location.lng !== null) continue;
        
        const place = location.place.trim();
        if (!place) continue;
        
        if (geocodeCache.has(place)) {
          const coords = geocodeCache.get(place);
          location.lat = coords.lat;
          location.lng = coords.lng;
          continue;
        }
        
        try {
          const result = await geocodeAddress(place);
          if (result) {
            geocodeCache.set(place, { lat: Number(result.lat), lng: Number(result.lon) });
            location.lat = Number(result.lat);
            location.lng = Number(result.lon);
          }
        } catch (error) {
          console.warn(`Could not geocode "${place}":`, error);
        }
        
        // Rate limiting: add small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  async function geocodeLocationsInBackground(books) {
    const geocodeCache = new Map();
    let geocodedCount = 0;
    let skippedCount = 0;
    const totalLocations = books.reduce((sum, b) => sum + (b.locations?.length || 0), 0);
    
    console.log(`%c⏳ Starting geocoding of ${totalLocations} locations...`, 'color: #ff9f43; font-weight: bold; font-size: 14px;');
    
    for (const book of books) {
      for (const location of book.locations || []) {
        // Skip if already has coordinates
        if (location.lat !== null && location.lng !== null && isFinite(location.lat) && isFinite(location.lng)) {
          skippedCount++;
          continue;
        }
        
        const place = location.place.trim();
        if (!place) continue;
        
        // Check cache first
        if (geocodeCache.has(place)) {
          const coords = geocodeCache.get(place);
          location.lat = coords.lat;
          location.lng = coords.lng;
          geocodedCount++;
          persist();
          renderMarkers();
          continue;
        }
        
        // Query API
        const result = await geocodeAddress(place);
        if (result) {
          const coords = { lat: result.lat, lng: result.lon };
          geocodeCache.set(place, coords);
          location.lat = result.lat;
          location.lng = result.lon;
          geocodedCount++;
          console.log(`%c✓ Geocoded ${geocodedCount}/${totalLocations - skippedCount}: ${place}`, 'color: #00b894;');
          persist();
          renderMarkers();
        } else {
          console.warn(`✗ Failed: ${place}`);
        }
        
        // Rate limiting: Nominatim asks for 1 request per second
        await new Promise(resolve => setTimeout(resolve, 1100));
      }
    }
    
    console.log(`%c✅ Geocoding complete: ${geocodedCount}/${totalLocations - skippedCount} locations geocoded (${skippedCount} already had coordinates)`, 'color: #00b894; font-weight: bold; font-size: 14px;');
  }

  function dedupeBooksById(books) {
    const map = new Map();
    books.forEach((book) => {
      if (!map.has(book.id)) map.set(book.id, book);
    });
    return Array.from(map.values());
  }

  function loadSavedBooks() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('Invalid local storage data, ignoring saved books.', error);
      return [];
    }
  }

  async function loadSeedBooks() {
    try {
      const res = await fetch('/data/literary-books.json');
      if (!res.ok) throw new Error('Failed to fetch seed books');
      const seed = await res.json();
      return Array.isArray(seed) ? seed : [];
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  function mergeBooks(csvBooks, savedBooks) {
    if (!savedBooks.length) return csvBooks;

    const savedById = new Map(savedBooks.map((book) => [book.id, book]));

    const merged = csvBooks.map((csvBook) => {
      const savedBook = savedById.get(csvBook.id);
      if (!savedBook) return csvBook;

      return {
        ...csvBook,
        color: savedBook.color || csvBook.color,
        locations: Array.isArray(savedBook.locations) ? savedBook.locations : [],
      };
    });

    // Include manually created books that are not in Goodreads CSV.
    savedBooks.forEach((book) => {
      if (!merged.some((item) => item.id === book.id)) {
        merged.push(book);
      }
    });

    return merged;
  }

  function bindModeTabs() {
    const tabs = document.querySelectorAll('.mode-tab');
    const views = document.querySelectorAll('.mode-view');

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const mode = tab.dataset.mode;

        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');

        views.forEach((view) => {
          view.classList.toggle('active', view.dataset.modeView === mode);
        });
      });
    });
  }

  function bindActions() {
    refs.clearHighlight.addEventListener('click', () => {
      state.selectedBookId = null;
      renderAll();
    });

    refs.exportCsv.addEventListener('click', exportBooksToCsv);

    refs.bookSearch.addEventListener('input', (event) => {
      state.bookQuery = event.currentTarget.value.trim().toLowerCase();
      renderBookList();
    });

    refs.toggleLocationForm.addEventListener('click', () => {
      refs.addLocationForm.classList.toggle('hidden');
    });

    refs.findCoordsAdd.addEventListener('click', () => {
      lookupAddressAndFill(refs.addLocationForm, refs.geocodeStatusAdd, refs.findCoordsAdd);
    });

    refs.findCoordsEdit.addEventListener('click', () => {
      lookupAddressAndFill(refs.editLocationForm, refs.geocodeStatusEdit, refs.findCoordsEdit);
    });

    refs.addBookForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);

      const title = (formData.get('title') || '').toString().trim();
      const author = (formData.get('author') || '').toString().trim();
      const year = (formData.get('year') || '').toString().trim();
      const color = (formData.get('color') || '').toString() || nextFallbackColor();

      if (!title || !author) return;

      const book = {
        id: `book-${Date.now()}`,
        title,
        author,
        year,
        color,
        locations: [],
      };

      state.books.push(book);
      persist();
      event.currentTarget.reset();
      renderAll();
    });

    refs.addLocationForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);

      const bookId = formData.get('bookId')?.toString();
      const place = (formData.get('place') || '').toString().trim();
      const lat = Number(formData.get('lat'));
      const lng = Number(formData.get('lng'));
      const note = (formData.get('note') || '').toString().trim();
  const imageUrl = (formData.get('imageUrl') || '').toString().trim();

      if (!bookId || !place || Number.isNaN(lat) || Number.isNaN(lng)) return;

      const book = state.books.find((item) => item.id === bookId);
      if (!book) return;

      book.locations = book.locations || [];
  book.locations.push({ place, lat, lng, note, imageUrl });

      state.selectedBookId = bookId;
      persist();
      event.currentTarget.reset();
      refs.addLocationForm.classList.add('hidden');
      renderAll();
    });

    refs.closeLocationModal.addEventListener('click', closeLocationModal);
    refs.cancelLocationEdit.addEventListener('click', closeLocationModal);
    refs.locationModal.addEventListener('click', (event) => {
      if (event.target === refs.locationModal) closeLocationModal();
    });

    refs.editLocationForm.addEventListener('submit', saveLocationEdits);
    refs.editLocationForm.elements.imageUrl.addEventListener('input', updateImagePreviewFromEditForm);
  }

  function renderAll() {
    renderBookList();
    renderBookSelect();
    renderMarkers();
    updateBookCounter();
  }

  function renderBookList() {
    refs.bookList.innerHTML = '';
    const books = getFilteredBooks();

    if (!books.length) {
      refs.bookList.innerHTML = '<li class="empty-note">No matching books. Try another search.</li>';
      return;
    }

    books.forEach((book) => {
      const li = document.createElement('li');
      li.className = 'book-item';
      li.style.setProperty('--book-color', book.color || '#7aa2ff');
      li.classList.toggle('active', book.id === state.selectedBookId);

      li.innerHTML = `
        <div class="book-title">${escapeHtml(book.title)}</div>
        <div class="book-meta">${escapeHtml(book.author)}${book.year ? ` · ${escapeHtml(book.year)}` : ''}</div>
        <div class="book-locations">${(book.locations || []).length} location(s)</div>
      `;

      li.addEventListener('click', () => {
        state.selectedBookId = state.selectedBookId === book.id ? null : book.id;
        renderAll();
      });

      if (book.id === state.selectedBookId) {
        const locationList = document.createElement('div');
        locationList.className = 'location-editor-list';

        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'location-editor-btn';
        addButton.textContent = '＋ Add / edit location';
        addButton.addEventListener('click', (event) => {
          event.stopPropagation();
          openLocationModal(book.id, -1);
        });
        locationList.appendChild(addButton);

        (book.locations || []).forEach((location, index) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'location-editor-btn';
          button.textContent = `✎ ${location.place}`;
          button.addEventListener('click', (event) => {
            event.stopPropagation();
            openLocationModal(book.id, index);
          });
          locationList.appendChild(button);
        });

        li.appendChild(locationList);
      }

      refs.bookList.appendChild(li);
    });
  }

  function renderBookSelect() {
    refs.bookSelect.innerHTML = '';

    state.books.forEach((book) => {
      const option = document.createElement('option');
      option.value = book.id;
      option.textContent = `${book.title} — ${book.author}`;
      refs.bookSelect.appendChild(option);
    });

    if (state.selectedBookId && state.books.some((book) => book.id === state.selectedBookId)) {
      refs.bookSelect.value = state.selectedBookId;
    }
  }

  function renderMarkers() {
    state.markersLayer.clearLayers();

    const bounds = [];
    state.books.forEach((book, bookIndex) => {
      // Randomly select a book icon for each book
      const iconUrl = getRandomBookIcon();
      
      // Create circular icon with border (70% of original size: 28x28)
      const bookIcon = L.icon({
        iconUrl: iconUrl,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
        className: 'book-marker-circular',
      });

      (book.locations || []).forEach((location) => {
        // Skip only if coordinates are explicitly not valid
        if (location.lat === null || location.lng === null) return;
        if (!isFinite(location.lat) || !isFinite(location.lng)) return;

        const isSelected = !state.selectedBookId || state.selectedBookId === book.id;
        
        // Use custom marker with circular book icon
        let marker;
        try {
          marker = L.marker([location.lat, location.lng], {
            icon: bookIcon,
            opacity: isSelected ? 1 : 0.7,
            zIndexOffset: isSelected ? 1000 : 0,
          });
        } catch (e) {
          // Fallback to circle marker if icon fails
          marker = L.circleMarker([location.lat, location.lng], {
            radius: isSelected ? 8 : 5,
            color: book.color || '#7aa2ff',
            fillColor: book.color || '#7aa2ff',
            fillOpacity: isSelected ? 0.8 : 0.2,
            opacity: isSelected ? 1 : 0.35,
            weight: isSelected ? 2 : 1,
          });
        }

        marker.bindTooltip(`${location.place} · ${book.title}`, { direction: 'top' });
        
        // Build popup content with image
        let popupHtml = `<strong>${escapeHtml(book.title)}</strong>`;
        
        // Add original title if different from Vietnamese title
        if (book.orgTitle && book.orgTitle !== book.titleVi) {
          popupHtml += `<br><em>${escapeHtml(book.orgTitle)}</em>`;
        }
        
        // Add location with source label
        let locationLabel = escapeHtml(location.place);
        const sourceLabel = getSourceLabel(location.source);
        if (sourceLabel) {
          locationLabel += ` <small style="color: #999;">(${sourceLabel})</small>`;
        }
        popupHtml += `<br><span>${locationLabel}</span>`;
        
        // Use image URL from location or fall back to book's image_url
        const imageUrl = location.imageUrl || book.image_url;
        if (imageUrl && imageUrl.length > 0 && imageUrl.startsWith('http')) {
          popupHtml += `<br><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(book.title)}" style="max-width:160px;margin-top:8px;border-radius:4px;" onerror="this.style.display='none'">`;
        }
        
        marker.bindPopup(popupHtml, { maxWidth: 250 });

        marker.addTo(state.markersLayer);
        bounds.push([location.lat, location.lng]);
      });
    });

    if (bounds.length) {
      const padded = L.latLngBounds(bounds).pad(0.1);
      state.map.fitBounds(padded, { maxZoom: 8, animate: true });
    }
  }

  function nextFallbackColor() {
    return FALLBACK_COLORS[state.books.length % FALLBACK_COLORS.length];
  }

  function getRandomBookIcon() {
    return BOOK_ICONS[Math.floor(Math.random() * BOOK_ICONS.length)];
  }

  function getSourceLabel(source) {
    const labels = {
      'goodreads_setting': 'setting',
      'author_born': 'author',
      'none': ''
    };
    return labels[source] || source;
  }

  function updateBookCounter() {
    if (!refs.bookCounter) return;
    
    const totalBooks = state.books.length;
    const totalLocations = state.books.reduce((sum, b) => sum + (b.locations?.length || 0), 0);
    const filteredBooks = getFilteredBooks().length;
    
    let counterText = `📚 ${totalBooks} book${totalBooks !== 1 ? 's' : ''} • ${totalLocations} location${totalLocations !== 1 ? 's' : ''}`;
    if (filteredBooks !== totalBooks) {
      counterText += ` (${filteredBooks} visible)`;
    }
    
    refs.bookCounter.textContent = counterText;
  }

  function getFilteredBooks() {
    if (!state.bookQuery) return state.books;
    return state.books.filter((book) => {
      const title = (book.title || '').toLowerCase();
      const author = (book.author || '').toLowerCase();
      return title.includes(state.bookQuery) || author.includes(state.bookQuery);
    });
  }

  function openLocationModal(bookId, locationIndex) {
    const book = state.books.find((item) => item.id === bookId);
    if (!book) return;

    const isCreate = locationIndex < 0;
    const location = isCreate ? {} : (book.locations || [])[locationIndex];
    if (!location && !isCreate) return;

    const titleEl = document.getElementById('location-modal-title');
    if (titleEl) {
      titleEl.textContent = isCreate ? `Add location — ${book.title}` : `Edit location — ${book.title}`;
    }

    refs.editLocationForm.elements.bookId.value = bookId;
    refs.editLocationForm.elements.locationIndex.value = String(locationIndex);
    refs.editLocationForm.elements.place.value = location.place || '';
    refs.editLocationForm.elements.lat.value = location.lat ?? '';
    refs.editLocationForm.elements.lng.value = location.lng ?? '';
    refs.editLocationForm.elements.note.value = location.note || '';
    refs.editLocationForm.elements.imageUrl.value = location.imageUrl || '';

    updateImagePreviewFromEditForm();
    refs.locationModal.classList.remove('hidden');
  }

  function closeLocationModal() {
    refs.locationModal.classList.add('hidden');
    setGeocodeStatus(refs.geocodeStatusEdit, '');
  }

  function saveLocationEdits(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const bookId = (formData.get('bookId') || '').toString();
    const locationIndex = Number(formData.get('locationIndex'));
    const place = (formData.get('place') || '').toString().trim();
    const lat = Number(formData.get('lat'));
    const lng = Number(formData.get('lng'));
    const note = (formData.get('note') || '').toString().trim();
    const imageUrl = (formData.get('imageUrl') || '').toString().trim();

    if (!bookId || !place || Number.isNaN(locationIndex) || Number.isNaN(lat) || Number.isNaN(lng)) return;

    const book = state.books.find((item) => item.id === bookId);
    if (!book) return;

    book.locations = Array.isArray(book.locations) ? book.locations : [];

    if (locationIndex < 0 || !book.locations[locationIndex]) {
      book.locations.push({ place, lat, lng, note, imageUrl });
    } else {
      book.locations[locationIndex] = {
        ...book.locations[locationIndex],
        place,
        lat,
        lng,
        note,
        imageUrl,
      };
    }

    persist();
    closeLocationModal();
    renderAll();
  }

  function updateImagePreviewFromEditForm() {
    const imageUrl = refs.editLocationForm.elements.imageUrl.value.trim();
    if (!imageUrl) {
      refs.locationImagePreview.classList.add('hidden');
      refs.locationImagePreview.innerHTML = '';
      return;
    }

    refs.locationImagePreview.classList.remove('hidden');
    refs.locationImagePreview.innerHTML = `<img src="${escapeHtml(imageUrl)}" alt="Location preview">`;
  }

  async function lookupAddressAndFill(form, statusEl, triggerButton) {
    const placeInput = form.elements.place;
    const latInput = form.elements.lat;
    const lngInput = form.elements.lng;
    const place = (placeInput?.value || '').trim();

    if (!place) {
      setGeocodeStatus(statusEl, 'Please enter a place/address first.', 'error');
      return;
    }

    triggerButton.classList.add('loading');
    setGeocodeStatus(statusEl, 'Searching...');

    const result = await geocodeAddress(place);
    
    triggerButton.classList.remove('loading');
    
    if (!result) {
      setGeocodeStatus(statusEl, `No results for "${place}". Try: "Paris, France" or "Tokyo, Japan"`, 'error');
      return;
    }

    latInput.value = result.lat.toFixed(6);
    lngInput.value = result.lon.toFixed(6);
    setGeocodeStatus(statusEl, `✓ Found: ${result.display_name.substring(0, 60)}`, 'success');
  }

  async function geocodeAddress(address) {
    if (!address || typeof address !== 'string') return null;
    
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', address);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    url.searchParams.set('timeout', '10');

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Literary-World-Map)',
        },
      });

      if (!response.ok) {
        console.warn(`Nominatim HTTP ${response.status} for "${address}"`);
        return null;
      }

      const results = await response.json();
      if (Array.isArray(results) && results.length > 0) {
        const result = results[0];
        // Ensure lat/lon are numbers
        return {
          lat: parseFloat(result.lat),
          lon: parseFloat(result.lon),
          display_name: result.display_name || address,
        };
      }
      return null;
    } catch (error) {
      console.warn(`Nominatim fetch error for "${address}":`, error.message);
      return null;
    }
  }

  function setGeocodeStatus(el, message, variant) {
    if (!el) return;
    el.textContent = message;
    el.classList.remove('success', 'error');
    if (variant) el.classList.add(variant);
  }

  function exportBooksToCsv() {
    const rows = [
      ['book_id', 'title', 'author', 'year', 'pin_color', 'place', 'lat', 'lng', 'note', 'image_url'],
    ];

    state.books.forEach((book) => {
      const locations = Array.isArray(book.locations) ? book.locations : [];
      if (!locations.length) {
        rows.push([book.id, book.title, book.author, book.year || '', book.color || '', '', '', '', '', '']);
        return;
      }

      locations.forEach((location) => {
        rows.push([
          book.id,
          book.title,
          book.author,
          book.year || '',
          book.color || '',
          location.place || '',
          location.lat ?? '',
          location.lng ?? '',
          location.note || '',
          location.imageUrl || '',
        ]);
      });
    });

    const csvContent = rows.map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'literary_world_map_export.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function csvCell(value) {
    const normalized = String(value ?? '').replaceAll('"', '""');
    return `"${normalized}"`;
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.books));
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
})();
