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
    let journeyPath;
    let audioContext = null;
    let autoPlayInterval = null;
    let droneOsc1 = null;
    let droneOsc2 = null;

    // --- Core Functions ---

    // --- Ethereal Audio Synthesizer ---
    function startAmbientAudio() {
        if (!audioContext) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            audioContext = new AudioContext();
        }

        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        // Base drone
        if (!droneOsc1) {
            droneOsc1 = audioContext.createOscillator();
            droneOsc1.type = 'sine';
            droneOsc1.frequency.setValueAtTime(108, audioContext.currentTime); // Deep hum

            droneOsc2 = audioContext.createOscillator();
            droneOsc2.type = 'triangle';
            droneOsc2.frequency.setValueAtTime(110, audioContext.currentTime); // Slight detune for beating effect

            const gainNode = audioContext.createGain();
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.05, audioContext.currentTime + 5); // Slow fade in

            droneOsc1.connect(gainNode);
            droneOsc2.connect(gainNode);
            gainNode.connect(audioContext.destination);

            droneOsc1.start();
            droneOsc2.start();
        }
    }

    function playCelestialChime(id) {
        if (!audioContext) {
            // Initialize on first user interaction to comply with browser autoplay policies
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return; // Not supported
            audioContext = new AudioContext();
        }

        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        const osc = audioContext.createOscillator();
        const osc2 = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        // Pentatonic Scale: C4, D4, E4, G4, A4
        const pentatonic = [261.63, 293.66, 329.63, 392.00, 440.00];
        const baseFreq = (id !== undefined && id !== null) ? pentatonic[id % 5] : 432;
        const freq = baseFreq + (Math.random() * 4 - 2);

        // Subtle, ethereal tone
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);

        // A fifth up or an octave for richness
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(freq * 1.5, audioContext.currentTime);

        // Envelope: soft attack, long release
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.08, audioContext.currentTime + 0.1); // Attack
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 3.0); // Release

        // 3D Spatial Audio Panning
        let panner = null;
        if (id !== undefined && id !== null && audioContext.createStereoPanner) {
            panner = audioContext.createStereoPanner();
            // Map ID 0-8 to roughly -1 (left) to 1 (right)
            const panValue = (id / 4) - 1;
            panner.pan.value = panValue;
        }

        osc.connect(gainNode);
        osc2.connect(gainNode);

        if (panner) {
            gainNode.connect(panner);
            panner.connect(audioContext.destination);
        } else {
            gainNode.connect(audioContext.destination);
        }

        osc.start(audioContext.currentTime);
        osc2.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 3.0);
        osc2.stop(audioContext.currentTime + 3.0);
    }

    // Centralized State Mutator: The only way to change the active temple
    function setActiveTemple(id) {
        if (id === activeTempleId) return; // Do nothing if already active

        if (id !== null) {
            lastFocusedElement = document.activeElement;
            playCelestialChime(id); // Play subtle sound when selecting a temple
        }

        activeTempleId = id;

        // Subdued Text-to-Speech Narration
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel(); // Stop any ongoing speech

            if (activeTempleId !== null) {
                const temple = templeData[activeTempleId];
                if (temple && temple.description) {
                    const utterance = new SpeechSynthesisUtterance(temple.description);
                    utterance.pitch = 0.8; // Lower, more relaxing pitch
                    utterance.rate = 0.9;  // Slightly slower rate
                    utterance.volume = 0.4; // Low volume so it doesn't overpower the ambiance
                    window.speechSynthesis.speak(utterance);
                }
            }
        }

        // Modulate background drone based on active temple
        if (audioContext && droneOsc1 && droneOsc2) {
            if (activeTempleId !== null) {
                droneOsc1.frequency.setTargetAtTime(108 + (activeTempleId * 2), audioContext.currentTime, 1);
                droneOsc2.frequency.setTargetAtTime(110 + (activeTempleId * 2), audioContext.currentTime, 1);
            } else {
                // Reset
                droneOsc1.frequency.setTargetAtTime(108, audioContext.currentTime, 1);
                droneOsc2.frequency.setTargetAtTime(110, audioContext.currentTime, 1);
            }
        }
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
            <div class="tour-progress-container">
                <span class="tour-progress">Stop ${activeTempleId + 1} of ${templeData.length}</span>
                <button class="tour-btn" id="tour-autoplay-btn" aria-label="${autoPlayInterval ? 'Stop Auto-Play' : 'Start Auto-Play'}">
                    ${autoPlayInterval ? '⏸️ Auto' : '▶️ Auto'}
                </button>
            </div>
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
        const autoPlayBtn = document.getElementById('tour-autoplay-btn');

        prevBtn.addEventListener('click', () => {
            if (autoPlayInterval) toggleAutoPlay();
            navigateTour(-1);
        });
        nextBtn.addEventListener('click', () => {
            if (autoPlayInterval) toggleAutoPlay();
            if (isLast) endTour();
            else navigateTour(1);
        });
        exitBtn.addEventListener('click', endTour);

        autoPlayBtn.addEventListener('click', toggleAutoPlay);

        // Restore focus
        if (focusedId) {
            const el = document.getElementById(focusedId);
            if (el && !el.disabled) {
                el.focus();
            }
        }
    }

    function toggleAutoPlay() {
        if (autoPlayInterval) {
            clearInterval(autoPlayInterval);
            autoPlayInterval = null;
            showToast("Auto-Play paused.");
        } else {
            if (activeTempleId === templeData.length - 1) {
                // If at the end, jump back to the start before beginning autoplay
                setActiveTemple(0);
            }

            autoPlayInterval = setInterval(() => {
                if (!isTourActive || activeTempleId === null) {
                    toggleAutoPlay();
                    return;
                }

                if (activeTempleId === templeData.length - 1) {
                    toggleAutoPlay(); // Stop at the end
                } else {
                    navigateTour(1);
                }
            }, 8000);
            showToast("Auto-Play started.");
        }
        updateTourControls(); // Re-render to update the button icon
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

            // Set dynamic planet color
            document.documentElement.style.setProperty('--active-planet-color', temple.color);
            // Shift map hue slightly based on the temple for varied atmosphere
            document.documentElement.style.setProperty('--map-hue', `${200 + activeTempleId * 15}deg`);

            // Update and show info card
            const imgEl = document.getElementById('info-card-image');
            imgEl.style.display = 'block';
            imgEl.style.opacity = '0';
            imgEl.style.transform = 'scale(1)';
            imgEl.style.transition = 'opacity 0.6s ease';

            imgEl.onload = function() {
                this.style.opacity = '1';
                this.style.transition = 'opacity 0.6s ease, transform 20s ease-out';
                this.style.transform = 'scale(1.05)';
            };

            imgEl.src = temple.image;
            imgEl.alt = `Architectural view of ${temple.name}`;
            imgEl.onerror = function() { this.style.display = 'none'; };

            document.getElementById('info-card-title').textContent = temple.name;
            document.getElementById('info-card-subtitle-ta').textContent = temple.tamilName;
            document.getElementById('planet-icon').textContent = temple.planetIcon;
            document.getElementById('planet-text').textContent = temple.planet;

            const descEl = document.getElementById('info-card-description');
            descEl.innerHTML = '';
            const words = temple.description.split(' ');
            words.forEach((word, i) => {
                const span = document.createElement('span');
                span.className = 'reveal-word';
                span.style.setProperty('--word-index', i);
                span.textContent = word;
                descEl.appendChild(span);

                // Add a text node for space if not the last word
                if (i < words.length - 1) {
                    descEl.appendChild(document.createTextNode(' '));
                }
            });

            // Re-apply stagger animations
            const elementsToAnimate = [
                document.getElementById('info-card-title').parentElement,
                document.querySelector('.info-card-planet-info'),
                document.getElementById('info-card-description'),
                document.getElementById('tour-controls')
            ];

            elementsToAnimate.forEach((el, i) => {
                if (el) {
                    el.classList.remove(`stagger-${i + 1}`);
                    // Force reflow
                    void el.offsetWidth;
                    el.classList.add(`stagger-${i + 1}`);
                }
            });

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
            // Revert dynamic planet color
            document.documentElement.style.setProperty('--active-planet-color', 'var(--color-primary)');
            document.documentElement.style.setProperty('--map-hue', '200deg');

            // Hide info card if no temple is selected
            infoCard.classList.remove('visible');
            infoCard.removeEventListener('transitionend', focusCloseBtn);

            // Zoom map back out to constellation view
            if (journeyPath && map) {
                map.flyToBounds(journeyPath.getBounds(), { padding: [50, 50], animate: true, duration: 1.5 });
            }
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

        map.on('movestart', function() {
            document.body.classList.add('is-traveling');
        });
        map.on('moveend', function() {
            document.body.classList.remove('is-traveling');
        });

        tileLayer.addTo(map);
        L.control.zoom({ position: 'bottomright' }).addTo(map);
    }

    // Optimized population function
    function populateNavAndMarkers() {
        const fragment = document.createDocumentFragment();

        templeData.forEach((temple, index) => {
            // Custom DivIcon for CSS-only styling (Slick & Performant), staggered entry
            const delay = index * 0.15; // match staggered list
            const customIcon = L.divIcon({
                className: 'orb-marker',
                html: `<div class="orb-core" style="animation: marker-pop 0.6s var(--ease-elastic) ${delay}s forwards; opacity: 0; transform: scale(0);"></div><div class="orb-ring" style="animation-delay: ${delay + 0.6}s;"></div><div class="orb-ring ring-2" style="animation-delay: ${delay + 1.2}s; width: 44px; height: 44px; border-style: dashed;"></div>`,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });

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

            button.addEventListener('mousemove', (e) => {
                const rect = button.getBoundingClientRect();
                const x = e.clientX - rect.left; // x position within the element
                const y = e.clientY - rect.top;  // y position within the element

                // Calculate tilt based on cursor position relative to center
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                const tiltX = ((x - centerX) / centerX) * 5; // max 5 deg tilt
                const tiltY = -((y - centerY) / centerY) * 5; // max 5 deg tilt

                button.style.setProperty('--tilt-x', tiltX);
                button.style.setProperty('--tilt-y', tiltY);
            });

            button.addEventListener('mouseleave', () => {
                button.style.setProperty('--tilt-x', 0);
                button.style.setProperty('--tilt-y', 0);
            });

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

        // Create Celestial River Path
        const coords = templeData.map(t => t.coords);
        journeyPath = L.polyline(coords, {
            color: 'var(--color-primary)',
            weight: 3,
            opacity: 0.8,
            className: 'celestial-river',
            dashArray: '3000, 3000'
        }).addTo(map);

        L.polyline(coords, {
            color: '#fff',
            weight: 1,
            opacity: 0.6,
            className: 'energy-pulse',
            dashArray: '5, 20'
        }).addTo(map);
    }

    // --- Event Listeners & Initialization ---
    if (sessionStorage.getItem('introSeen')) {
        introScreen.classList.add('hidden');
        introScreen.style.opacity = '0';
        appContainer.classList.add('visible');

        // Start ambient audio for returning user after a short delay (must interact first generally, but we can try)
        // Usually requires interaction, so might not play until they click somewhere, but we set it up.
        document.addEventListener('click', () => {
             if(audioContext && audioContext.state === 'running') return;
             startAmbientAudio();
        }, { once: true });

        // If returning user, fitbounds immediately without animation on load
        setTimeout(() => {
            if (journeyPath && map) {
                map.fitBounds(journeyPath.getBounds(), { padding: [50, 50] });
            }
        }, 100);
    }

    introButton.addEventListener('click', () => {
        sessionStorage.setItem('introSeen', 'true');
        introScreen.style.opacity = '0';
        appContainer.classList.add('visible');
        map.invalidateSize();
        startAmbientAudio(); // Start ambient drone on initial interaction

        introScreen.addEventListener('transitionend', () => {
            introScreen.classList.add('hidden');
            // When journey begins, flyToBounds to show constellation
            if (journeyPath && map) {
                map.flyToBounds(journeyPath.getBounds(), { padding: [50, 50], animate: true, duration: 2.0 });
            }
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


    // --- Dynamic Shooting Stars ---
    function spawnShootingStar() {
        const star = document.createElement('div');
        star.classList.add('shooting-star');

        // Random start position
        const startX = Math.random() * window.innerWidth;
        const startY = Math.random() * (window.innerHeight / 2); // Start mostly in top half

        star.style.left = `${startX}px`;
        star.style.top = `${startY}px`;

        const background = document.querySelector('.background-pattern');
        if (background) {
            background.appendChild(star);

            // Remove after animation completes (2s + buffer)
            setTimeout(() => {
                if (background.contains(star)) {
                    background.removeChild(star);
                }
            }, 2500);
        }
    }

    // Spawn a star roughly every 3 seconds (add some randomness to avoid predictable intervals)
    setInterval(() => {
        if (Math.random() > 0.3) { // 70% chance to spawn
            spawnShootingStar();
        }
    }, 3000);

    // --- Mouse Parallax Effect ---
    let lastStardustTime = 0;

    document.addEventListener('mousemove', (e) => {
        // Only apply on desktop
        if (window.innerWidth <= 768) return;

        const x = (e.clientX / window.innerWidth - 0.5) * 2; // Range -1 to 1
        const y = (e.clientY / window.innerHeight - 0.5) * 2; // Range -1 to 1

        document.documentElement.style.setProperty('--mouse-x', x);
        document.documentElement.style.setProperty('--mouse-y', y);

        // Stardust cursor trail
        const now = Date.now();
        if (now - lastStardustTime > 50) { // Throttle trail generation
            lastStardustTime = now;
            const stardust = document.createElement('div');
            stardust.className = 'stardust';
            stardust.style.left = `${e.clientX}px`;
            stardust.style.top = `${e.clientY}px`;

            // Randomize size slightly for a more organic feel
            const size = Math.random() * 2 + 2;
            stardust.style.width = `${size}px`;
            stardust.style.height = `${size}px`;

            document.body.appendChild(stardust);

            setTimeout(() => {
                if (document.body.contains(stardust)) {
                    document.body.removeChild(stardust);
                }
            }, 1000); // Remove after animation
        }
    });

    // --- Initializer ---
    initMap();
    populateNavAndMarkers();
});
