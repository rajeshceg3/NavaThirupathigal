document.addEventListener('DOMContentLoaded', function() {
    // --- Data ---
    // templeData is now loaded from assets/data.js

    // --- DOM Elements ---
    const introScreen = document.getElementById('intro-screen');
    const introButton = document.getElementById('intro-button');
    const appContainer = document.getElementById('app-container');
    const templeList = document.getElementById('temple-list');
    const infoCard = document.getElementById('info-card');
    infoCard.setAttribute('role', 'dialog');
    infoCard.setAttribute('aria-modal', 'true');
    infoCard.setAttribute('aria-label', 'Temple Details');

    const infoCardCloseBtn = document.getElementById('info-card-close-btn');
    const startTourBtn = document.getElementById('start-tour-btn');
    const tourControls = document.getElementById('tour-controls');
    // ... (rest of info card elements are queried inside render function for tidiness)

    // --- App State & Core Variables ---
    let map;
    let markers = [];
    let templeNavItems = [];
    let activeTempleId = null; // SINGLE SOURCE OF TRUTH
    let lastFocusedElement = null;
    let tileLayer;
    let isTourActive = false;

    // --- Core Functions ---

    // Centralized State Mutator: The only way to change the active temple
    function setActiveTemple(id) {
        if (id === activeTempleId) return; // Do nothing if already active

        if (id !== null) {
            lastFocusedElement = document.activeElement;
        }

        activeTempleId = id;
        render();

        if (activeTempleId === null && lastFocusedElement) {
            lastFocusedElement.focus();
        }
    }

    function focusCloseBtn(e) {
        // Only act on the infoCard's transition
        if (e.target !== infoCard) return;

        // In tour mode, focus the Next button instead of close button
        if (isTourActive) {
            const nextBtn = document.getElementById('tour-next-btn');
            if (nextBtn) nextBtn.focus();
        } else {
            document.getElementById('info-card-close-btn').focus();
        }
    }

    // --- Tour Logic ---
    function startTour() {
        if (isTourActive) return;
        isTourActive = true;
        document.body.classList.add('tour-active');
        showToast("Guided Tour Started. Use arrow keys to navigate.");
        setActiveTemple(0);
    }

    function endTour() {
        isTourActive = false;
        document.body.classList.remove('tour-active');
        setActiveTemple(null);
        showToast("Tour Ended.");
    }

    function navigateTour(direction) {
        if (!isTourActive || activeTempleId === null) return;

        const nextId = activeTempleId + direction;
        if (nextId >= 0 && nextId < templeData.length) {
            setActiveTemple(nextId);
        }
    }

    function updateTourControls() {
        if (!isTourActive || activeTempleId === null) {
            tourControls.innerHTML = '';
            return;
        }

        // Save current focus if it's inside tourControls
        let focusedId = null;
        if (document.activeElement && tourControls.contains(document.activeElement)) {
            focusedId = document.activeElement.id;
        }

        const isFirst = activeTempleId === 0;
        const isLast = activeTempleId === templeData.length - 1;

        tourControls.innerHTML = `
            <button class="tour-btn" id="tour-prev-btn" aria-label="Previous Stop" ${isFirst ? 'disabled' : ''}>
                ← Prev
            </button>
            <span class="tour-progress">Stop ${activeTempleId + 1} of ${templeData.length}</span>
            <button class="tour-btn primary" id="tour-next-btn" aria-label="${isLast ? 'Finish Tour' : 'Next Stop'}">
                ${isLast ? 'Finish' : 'Next →'}
            </button>
            <button class="tour-btn" id="tour-exit-btn" aria-label="Exit Tour">
                Exit
            </button>
        `;

        const prevBtn = document.getElementById('tour-prev-btn');
        const nextBtn = document.getElementById('tour-next-btn');
        const exitBtn = document.getElementById('tour-exit-btn');

        prevBtn.addEventListener('click', () => navigateTour(-1));
        nextBtn.addEventListener('click', () => {
            if (isLast) endTour();
            else navigateTour(1);
        });
        exitBtn.addEventListener('click', endTour);

        // Restore focus
        if (focusedId) {
            const el = document.getElementById(focusedId);
            if (el && !el.disabled) {
                el.focus();
            }
        }
    }

    // Declarative Render Function: Updates the entire UI based on the current state
    function render() {
        // Handle Tour Controls
        updateTourControls();

        // Update Nav List
        templeNavItems.forEach((item, index) => {
            const isActive = index === activeTempleId;
            item.classList.toggle('active', isActive);
            if (isActive) {
                item.setAttribute('aria-current', 'true');
            } else {
                item.removeAttribute('aria-current');
            }
        });

        // Update Markers
        markers.forEach((marker, index) => {
            marker.getElement()?.classList.toggle('active', index === activeTempleId);
        });

        if (activeTempleId !== null) {
            const temple = templeData[activeTempleId];

            // Update and show info card
            const imgEl = document.getElementById('info-card-image');
            imgEl.style.display = 'block';
            imgEl.style.opacity = '0';
            imgEl.style.transition = 'opacity 0.6s ease';

            imgEl.onload = function() {
                this.style.opacity = '1';
            };

            imgEl.src = temple.image;
            imgEl.alt = `Architectural view of ${temple.name}`;
            imgEl.onerror = function() { this.style.display = 'none'; };

            document.getElementById('info-card-title').textContent = temple.name;
            document.getElementById('info-card-subtitle-ta').textContent = temple.tamilName;
            document.getElementById('planet-icon').textContent = temple.planetIcon;
            document.getElementById('planet-text').textContent = temple.planet;
            document.getElementById('info-card-description').textContent = temple.description;

            // Focus management
            const isAlreadyVisible = infoCard.classList.contains('visible');
            infoCard.classList.add('visible');

            if (isAlreadyVisible) {
                // If already visible, focus immediately as no transition will occur
                document.getElementById('info-card-close-btn').focus();
            } else {
                infoCard.removeEventListener('transitionend', focusCloseBtn);
                infoCard.addEventListener('transitionend', focusCloseBtn, { once: true });
            }

            // Fly map to location
            map.flyTo(temple.coords, 15, { animate: true, duration: 1.5 });

        } else {
            // Hide info card if no temple is selected
            infoCard.classList.remove('visible');
            infoCard.removeEventListener('transitionend', focusCloseBtn);
        }
    }

    function showToast(message) {
        let toast = document.getElementById('toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast-notification';
            toast.className = 'toast-notification';
            toast.setAttribute('role', 'alert');
            toast.setAttribute('aria-live', 'assertive');

            const msgSpan = document.createElement('span');
            msgSpan.id = 'toast-message';
            msgSpan.textContent = message;

            const closeBtn = document.createElement('button');
            closeBtn.className = 'toast-close';
            closeBtn.setAttribute('aria-label', 'Close notification');
            closeBtn.textContent = '×';

            toast.appendChild(msgSpan);
            toast.appendChild(closeBtn);
            document.body.appendChild(toast);

            closeBtn.addEventListener('click', () => {
                toast.classList.remove('visible');
            });
        } else {
             document.getElementById('toast-message').textContent = message;
        }

        requestAnimationFrame(() => toast.classList.add('visible'));
    }

    function initMap() {
        map = L.map('map', { center: [8.64, 77.94], zoom: 12, zoomControl: false });
        tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            subdomains: 'abcd',
            minZoom: 1,
            maxZoom: 16,
            ext: 'jpg'
        });

        let toastShown = false;
        tileLayer.on('tileerror', function(event) {
            if (!toastShown) {
                showToast("Offline Mode: Map tiles unavailable");
                toastShown = true;
            }
        });

        tileLayer.addTo(map);
        L.control.zoom({ position: 'bottomright' }).addTo(map);
    }

    // Optimized population function
    function populateNavAndMarkers() {
        const fragment = document.createDocumentFragment();

        // Custom DivIcon for CSS-only styling (Slick & Performant)
        const customIcon = L.divIcon({
            className: 'orb-marker',
            html: '<div class="orb-core"></div><div class="orb-ring"></div>',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        templeData.forEach((temple, index) => {
            // Create Nav Item (Enhanced Structure for Cards/List)
            const button = document.createElement('button');
            button.className = 'temple-item';
            button.setAttribute('aria-label', `Select ${temple.name}`);
            button.setAttribute('aria-controls', 'info-card');

            // Staggered Entry Animation
            button.style.opacity = '0';
            button.style.animation = `list-enter 0.6s var(--ease-out-quint) ${index * 0.08 + 0.2}s forwards`;

            // --- Secure DOM Creation (prevents XSS) ---
            const cardBg = document.createElement('div');
            cardBg.className = 'temple-card-bg';

            const img = document.createElement('img');
            img.src = temple.image;
            img.alt = `Image of ${temple.name}`;
            img.loading = 'lazy';
            img.onerror = function() { this.style.display = 'none'; };
            cardBg.appendChild(img);

            const overlay = document.createElement('div');
            overlay.className = 'temple-card-overlay';
            cardBg.appendChild(overlay);

            const content = document.createElement('div');
            content.className = 'temple-content';

            const indexSpan = document.createElement('span');
            indexSpan.className = 'temple-index';
            indexSpan.textContent = String(index + 1).padStart(2, '0');
            content.appendChild(indexSpan);

            const info = document.createElement('div');
            info.className = 'temple-info';

            const nameEn = document.createElement('span');
            nameEn.className = 'temple-name-en';
            nameEn.textContent = temple.name;
            info.appendChild(nameEn);

            const nameTa = document.createElement('span');
            nameTa.className = 'temple-name-ta';
            nameTa.setAttribute('lang', 'ta');
            nameTa.textContent = temple.tamilName;
            info.appendChild(nameTa);

            content.appendChild(info);

            const indicator = document.createElement('div');
            indicator.className = 'active-indicator';

            button.append(cardBg, content, indicator);
            // --- End Secure DOM Creation ---

            button.addEventListener('click', () => setActiveTemple(temple.id));
            fragment.appendChild(button);

            // Create Map Marker
            const marker = L.marker(temple.coords, { icon: customIcon }).addTo(map);
            marker.bindTooltip(temple.name, {
                permanent: false,
                direction: 'top',
                className: 'marker-tooltip',
                offset: [0, -20]
            });
            marker.on('click', () => setActiveTemple(temple.id));
            markers.push(marker);
        });

        templeList.appendChild(fragment);
        templeNavItems = Array.from(templeList.children);
    }

    // --- Event Listeners & Initialization ---
    if (sessionStorage.getItem('introSeen')) {
        introScreen.classList.add('hidden');
        introScreen.style.opacity = '0';
        appContainer.classList.add('visible');
    }

    introButton.addEventListener('click', () => {
        sessionStorage.setItem('introSeen', 'true');
        introScreen.style.opacity = '0';
        appContainer.classList.add('visible');
        map.invalidateSize();

        introScreen.addEventListener('transitionend', () => {
            introScreen.classList.add('hidden');
        }, { once: true });
    });

    infoCardCloseBtn.addEventListener('click', () => {
        if (isTourActive) {
            endTour();
        } else {
            setActiveTemple(null);
        }
    });

    startTourBtn.addEventListener('click', startTour);

    // Keyboard Navigation
    document.addEventListener('keydown', (e) => {
        if (isTourActive) {
            if (e.key === 'ArrowLeft') navigateTour(-1);
            if (e.key === 'ArrowRight') {
                if (activeTempleId === templeData.length - 1) endTour();
                else navigateTour(1);
            }
            if (e.key === 'Escape') endTour();
        }
    });

    infoCard.addEventListener('keydown', handleFocusTrap);

    function handleFocusTrap(e) {
        if (e.key !== 'Tab') return;

        const focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const focusableContent = infoCard.querySelectorAll(focusableElements);
        const firstFocusable = focusableContent[0];
        const lastFocusable = focusableContent[focusableContent.length - 1];

        if (e.shiftKey) { // if shift key pressed for shift + tab combination
            if (document.activeElement === firstFocusable) {
                lastFocusable.focus(); // move focus to the last focusable element
                e.preventDefault();
            }
        } else { // if tab key is pressed
            if (document.activeElement === lastFocusable) { // if focused has reached to last focusable element
                firstFocusable.focus(); // move focus to the first focusable element
                e.preventDefault();
            }
        }
    }


    // --- Initializer ---
    initMap();
    populateNavAndMarkers();
});
