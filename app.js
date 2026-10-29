/**
 * OUR LITTLE FOREVER — WEDDING CERTIFICATE GENERATOR
 * Standalone, private, client-side certificate engine
 */

(function () {
  'use strict';

  // --- STATE MANAGEMENT ---
  const state = {
    partner1: {
      name: 'Adam',
      tag: '@adam',
      mode: 'type', // 'draw' or 'type'
      typedFont: 'font-great-vibes',
      drawnDataUrl: null
    },
    partner2: {
      name: 'Angel',
      tag: '@angel',
      mode: 'type', // 'draw' or 'type'
      typedFont: 'font-alex-brush',
      drawnDataUrl: null
    },
    date: 'October 30, 2026',
    server: 'The Sanctuary 💒 • #vows-channel',
    officiant: 'Clyde the Bot & Cherished Server Friends',
    title: 'Certificate of Discord Holy Matrimony',
    vows: "We solemnly promise to stay on late-night calls until one of us falls asleep, never steal each other's Discord Nitro gifts, share our best playlists, and stand together through every server raid and quiet evening. You will always be my favourite notification.",
    theme: 'champagne',
    zoom: 1
  };

  // --- VOW PRESETS ---
  const vowPresets = {
    romantic: "I promise to love you across every digital distance and real-world sunrise. To be your safe harbor, your partner in every quiet moment, and your steady hand through all of life's seasons. You are my true forever.",
    discord: "We solemnly promise to stay on late-night calls until one of us falls asleep, never steal each other's Discord Nitro gifts, share our best playlists, and stand together through every server raid and quiet evening. You will always be my favourite notification.",
    forever: "From our first shared message to this sacred keepsake, every moment with you has felt like home. In every channel, in every voice call, in every reality, I choose you—today, tomorrow, and for our little forever.",
    humorous: "I vow to laugh at your memes even when they make no sense, to mute myself when eating snacks, never leave you waiting in a voice channel alone, and to always prioritize your direct messages over the rest of the world."
  };

  // --- DOM ELEMENTS ---
  const els = {
    // Inputs
    p1NameInput: document.getElementById('input-partner1-name'),
    p1TagInput: document.getElementById('input-partner1-tag'),
    p2NameInput: document.getElementById('input-partner2-name'),
    p2TagInput: document.getElementById('input-partner2-tag'),
    dateInput: document.getElementById('input-ceremony-date'),
    serverInput: document.getElementById('input-server-name'),
    officiantInput: document.getElementById('input-officiant'),
    titleInput: document.getElementById('input-cert-title'),
    vowsInput: document.getElementById('input-vows'),
    vowChars: document.getElementById('vow-chars'),

    // Certificate Preview Nodes
    cert: document.getElementById('certificate'),
    certDisplayTitle: document.getElementById('cert-display-title'),
    certP1Name: document.getElementById('cert-p1-name'),
    certP1Tag: document.getElementById('cert-p1-tag'),
    certP2Name: document.getElementById('cert-p2-name'),
    certP2Tag: document.getElementById('cert-p2-tag'),
    certVows: document.getElementById('cert-display-vows'),
    certDate: document.getElementById('cert-display-date'),
    certServer: document.getElementById('cert-display-server'),
    certOfficiant: document.getElementById('cert-display-officiant'),
    certSealHash: document.getElementById('cert-seal-hash'),

    // Signature 1 Display
    certSig1Typed: document.getElementById('cert-sig1-typed'),
    certSig1Img: document.getElementById('cert-sig1-img'),
    certSig1SignerName: document.getElementById('cert-sig1-signer-name'),
    sig1TitleLabel: document.getElementById('sig1-title-label'),
    sig1Canvas: document.getElementById('sig1-canvas'),
    sig1ClearBtn: document.getElementById('btn-clear-sig1'),
    sig1DrawContainer: document.getElementById('sig1-draw-container'),
    sig1TypeContainer: document.getElementById('sig1-type-container'),
    sig1TextInput: document.getElementById('sig1-text-input'),
    sig1FontSelect: document.getElementById('sig1-font-select'),

    // Signature 2 Display
    certSig2Typed: document.getElementById('cert-sig2-typed'),
    certSig2Img: document.getElementById('cert-sig2-img'),
    certSig2SignerName: document.getElementById('cert-sig2-signer-name'),
    sig2TitleLabel: document.getElementById('sig2-title-label'),
    sig2Canvas: document.getElementById('sig2-canvas'),
    sig2ClearBtn: document.getElementById('btn-clear-sig2'),
    sig2DrawContainer: document.getElementById('sig2-draw-container'),
    sig2TypeContainer: document.getElementById('sig2-type-container'),
    sig2TextInput: document.getElementById('sig2-text-input'),
    sig2FontSelect: document.getElementById('sig2-font-select'),

    // Zoom & Toolbar
    viewport: document.getElementById('certificate-viewport'),
    zoomLevelText: document.getElementById('zoom-level-text'),
    btnZoomIn: document.getElementById('btn-zoom-in'),
    btnZoomOut: document.getElementById('btn-zoom-out'),
    btnZoomReset: document.getElementById('btn-zoom-reset'),

    // Vows Dropdown
    btnVowsMenu: document.getElementById('btn-vows-menu'),
    vowsDropdown: document.getElementById('vows-dropdown'),

    // Buttons
    btnTopDownload: document.getElementById('btn-top-download'),
    btnMainDownload: document.getElementById('btn-main-download'),
    btnFloatingDownload: document.getElementById('btn-floating-download'),
    btnMainPrint: document.getElementById('btn-main-print'),
    btnFloatingPrint: document.getElementById('btn-floating-print'),
    btnCopyShare: document.getElementById('btn-copy-share'),
    btnCopyDiscord: document.getElementById('btn-copy-discord'),
    btnLoadPreset: document.getElementById('btn-load-preset'),
    btnCelebrate: document.getElementById('btn-celebrate'),

    // Toast
    toast: document.getElementById('toast-notify'),
    toastMsg: document.getElementById('toast-message'),

    // Mobile Tabs
    editorPanel: document.getElementById('editor-panel'),
    previewPanel: document.getElementById('preview-panel')
  };

  // --- INITIALIZATION ---
  function init() {
    loadFromUrlHash();
    setupCanvasSignatures();
    setupEventListeners();
    updateCertificate();
    autoScaleCertificate();
    window.addEventListener('resize', debounce(autoScaleCertificate, 150));
  }

  // --- UPDATE CERTIFICATE DISPLAY ---
  function updateCertificate() {
    // Basic Details
    els.certP1Name.textContent = state.partner1.name || 'Spouse 1';
    els.certP1Tag.innerHTML = `<i class="fa-brands fa-discord"></i> ${state.partner1.tag || '@partner1'}`;
    els.certP2Name.textContent = state.partner2.name || 'Spouse 2';
    els.certP2Tag.innerHTML = `<i class="fa-brands fa-discord"></i> ${state.partner2.tag || '@partner2'}`;

    els.certDisplayTitle.textContent = state.title || 'Certificate of Matrimony';
    els.certDate.textContent = state.date || 'Today';
    els.certServer.textContent = state.server || 'Discord';
    els.certOfficiant.textContent = state.officiant || 'Officiant';
    els.certVows.textContent = state.vows || '...';
    els.vowChars.textContent = (state.vows || '').length;

    // Signer Names
    els.certSig1SignerName.textContent = state.partner1.name || 'Partner 1';
    els.certSig2SignerName.textContent = state.partner2.name || 'Partner 2';
    els.sig1TitleLabel.textContent = `Partner 1 (${state.partner1.name || 'Spouse'})`;
    els.sig2TitleLabel.textContent = `Partner 2 (${state.partner2.name || 'Spouse'})`;

    // Unique Keepsake Seal Hash
    const cleanP1 = (state.partner1.name || 'P1').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    const cleanP2 = (state.partner2.name || 'P2').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    els.certSealHash.textContent = `SEAL #${cleanP1}${cleanP2}-2026-ENGAGED`;

    // Signatures
    renderSignature(1);
    renderSignature(2);

    // Theme Class
    els.cert.classList.remove('theme-champagne', 'theme-blush', 'theme-midnight');
    els.cert.classList.add(`theme-${state.theme}`);
  }

  // --- SIGNATURE RENDERING ---
  function renderSignature(partnerNum) {
    const isP1 = partnerNum === 1;
    const pState = isP1 ? state.partner1 : state.partner2;
    const typedEl = isP1 ? els.certSig1Typed : els.certSig2Typed;
    const imgEl = isP1 ? els.certSig1Img : els.certSig2Img;

    if (pState.mode === 'draw' && pState.drawnDataUrl) {
      typedEl.classList.add('hidden');
      imgEl.src = pState.drawnDataUrl;
      imgEl.classList.remove('hidden');
    } else {
      imgEl.classList.add('hidden');
      typedEl.classList.remove('hidden');
      typedEl.textContent = (isP1 ? els.sig1TextInput.value : els.sig2TextInput.value) || pState.name || 'Signed';
      
      typedEl.className = 'typed-signature-preview ' + pState.typedFont;
    }
  }

  // --- CANVAS SIGNATURE PADS ---
  function setupCanvasSignatures() {
    [1, 2].forEach(pNum => {
      const canvas = pNum === 1 ? els.sig1Canvas : els.sig2Canvas;
      const ctx = canvas.getContext('2d');
      const clearBtn = pNum === 1 ? els.sig1ClearBtn : els.sig2ClearBtn;

      // Adjust for high resolution retina displays
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = (rect.width || 400) * dpr;
      canvas.height = (rect.height || 100) * dpr;
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = state.theme === 'midnight' ? '#c5a059' : '#1e1b18';

      let drawing = false;
      let lastX = 0;
      let lastY = 0;
      let hasDrawn = false;

      function getPos(e) {
        const cRect = canvas.getBoundingClientRect();
        const clientX = e.clientX !== undefined ? e.clientX : (e.touches ? e.touches[0].clientX : 0);
        const clientY = e.clientY !== undefined ? e.clientY : (e.touches ? e.touches[0].clientY : 0);
        return {
          x: clientX - cRect.left,
          y: clientY - cRect.top
        };
      }

      function startDraw(e) {
        e.preventDefault();
        drawing = true;
        const pos = getPos(e);
        lastX = pos.x;
        lastY = pos.y;
      }

      function draw(e) {
        if (!drawing) return;
        e.preventDefault();
        const pos = getPos(e);

        ctx.strokeStyle = '#1a1815';
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();

        lastX = pos.x;
        lastY = pos.y;
        hasDrawn = true;
      }

      function stopDraw(e) {
        if (!drawing) return;
        drawing = false;
        if (hasDrawn) {
          const dataUrl = canvas.toDataURL('image/png');
          if (pNum === 1) {
            state.partner1.drawnDataUrl = dataUrl;
          } else {
            state.partner2.drawnDataUrl = dataUrl;
          }
          renderSignature(pNum);
        }
      }

      // Pointer & Touch Events
      canvas.addEventListener('mousedown', startDraw);
      canvas.addEventListener('mousemove', draw);
      window.addEventListener('mouseup', stopDraw);

      canvas.addEventListener('touchstart', startDraw, { passive: false });
      canvas.addEventListener('touchmove', draw, { passive: false });
      window.addEventListener('touchend', stopDraw);

      // Clear button
      clearBtn.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasDrawn = false;
        if (pNum === 1) {
          state.partner1.drawnDataUrl = null;
        } else {
          state.partner2.drawnDataUrl = null;
        }
        renderSignature(pNum);
      });
    });
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    // Form Inputs Real-time Binding
    els.p1NameInput.addEventListener('input', (e) => {
      state.partner1.name = e.target.value;
      if (els.sig1TextInput.value === '' || els.sig1TextInput.value === 'Adam') {
        els.sig1TextInput.value = e.target.value;
      }
      updateCertificate();
    });

    els.p1TagInput.addEventListener('input', (e) => {
      let val = e.target.value;
      if (val && !val.startsWith('@')) val = '@' + val;
      state.partner1.tag = val;
      updateCertificate();
    });

    els.p2NameInput.addEventListener('input', (e) => {
      state.partner2.name = e.target.value;
      if (els.sig2TextInput.value === '' || els.sig2TextInput.value === 'Angel') {
        els.sig2TextInput.value = e.target.value;
      }
      updateCertificate();
    });

    els.p2TagInput.addEventListener('input', (e) => {
      let val = e.target.value;
      if (val && !val.startsWith('@')) val = '@' + val;
      state.partner2.tag = val;
      updateCertificate();
    });

    els.dateInput.addEventListener('input', (e) => {
      state.date = e.target.value;
      updateCertificate();
    });

    els.serverInput.addEventListener('input', (e) => {
      state.server = e.target.value;
      updateCertificate();
    });

    els.officiantInput.addEventListener('input', (e) => {
      state.officiant = e.target.value;
      updateCertificate();
    });

    els.titleInput.addEventListener('input', (e) => {
      state.title = e.target.value;
      updateCertificate();
    });

    els.vowsInput.addEventListener('input', (e) => {
      state.vows = e.target.value;
      updateCertificate();
    });

    // Vow Presets Menu
    els.btnVowsMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      els.vowsDropdown.classList.toggle('show');
    });

    document.addEventListener('click', () => {
      els.vowsDropdown.classList.remove('show');
    });

    document.querySelectorAll('.vow-preset-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-preset');
        if (vowPresets[key]) {
          state.vows = vowPresets[key];
          els.vowsInput.value = state.vows;
          updateCertificate();
        }
      });
    });

    // Theme Selector
    document.querySelectorAll('.theme-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const theme = card.getAttribute('data-theme');
        state.theme = theme;
        updateCertificate();
      });
    });

    // Signature Mode Toggles (Partner 1 & 2)
    document.querySelectorAll('.sig-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const partner = btn.getAttribute('data-partner');
        const mode = btn.getAttribute('data-mode');
        const parentToggle = btn.closest('.sig-mode-toggle');
        parentToggle.querySelectorAll('.sig-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (partner === '1') {
          state.partner1.mode = mode;
          if (mode === 'draw') {
            els.sig1DrawContainer.classList.remove('hidden');
            els.sig1TypeContainer.classList.add('hidden');
          } else {
            els.sig1DrawContainer.classList.add('hidden');
            els.sig1TypeContainer.classList.remove('hidden');
          }
          renderSignature(1);
        } else {
          state.partner2.mode = mode;
          if (mode === 'draw') {
            els.sig2DrawContainer.classList.remove('hidden');
            els.sig2TypeContainer.classList.add('hidden');
          } else {
            els.sig2DrawContainer.classList.add('hidden');
            els.sig2TypeContainer.classList.remove('hidden');
          }
          renderSignature(2);
        }
      });
    });

    // Typed Signature Inputs
    els.sig1TextInput.addEventListener('input', () => renderSignature(1));
    els.sig1FontSelect.addEventListener('change', (e) => {
      state.partner1.typedFont = e.target.value;
      renderSignature(1);
    });

    els.sig2TextInput.addEventListener('input', () => renderSignature(2));
    els.sig2FontSelect.addEventListener('change', (e) => {
      state.partner2.typedFont = e.target.value;
      renderSignature(2);
    });

    // Mobile View Tabs
    document.querySelectorAll('.mobile-tab-btn').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.mobile-tab-btn').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.getAttribute('data-tab');
        if (target === 'editor') {
          els.editorPanel.classList.remove('tab-hidden');
          els.previewPanel.classList.add('tab-hidden');
        } else {
          els.editorPanel.classList.add('tab-hidden');
          els.previewPanel.classList.remove('tab-hidden');
          autoScaleCertificate();
        }
      });
    });

    // Zoom Controls
    els.btnZoomIn.addEventListener('click', () => setZoom(state.zoom + 0.1));
    els.btnZoomOut.addEventListener('click', () => setZoom(state.zoom - 0.1));
    els.btnZoomReset.addEventListener('click', autoScaleCertificate);

    // Export & Action Buttons
    const downloadHandlers = [els.btnTopDownload, els.btnMainDownload, els.btnFloatingDownload];
    downloadHandlers.forEach(b => {
      if (b) b.addEventListener('click', exportCertificatePng);
    });

    const printHandlers = [els.btnMainPrint, els.btnFloatingPrint];
    printHandlers.forEach(b => {
      if (b) b.addEventListener('click', printCertificate);
    });

    els.btnCopyShare.addEventListener('click', copyShareableLink);
    els.btnCopyDiscord.addEventListener('click', copyDiscordAnnouncement);
    els.btnLoadPreset.addEventListener('click', loadSampleVows);
    els.btnCelebrate.addEventListener('click', triggerCelebration);
  }

  // --- ZOOM HANDLING ---
  function setZoom(val) {
    const clamped = Math.max(0.35, Math.min(1.8, val));
    state.zoom = clamped;
    els.cert.style.transform = `scale(${clamped})`;
    els.zoomLevelText.textContent = `${Math.round(clamped * 100)}%`;
  }

  function autoScaleCertificate() {
    const viewportWidth = els.viewport.clientWidth;
    const viewportHeight = els.viewport.clientHeight;
    
    // Certificate baseline dimensions: 960 x 680
    const pad = 48;
    const availW = Math.max(280, viewportWidth - pad);
    const availH = Math.max(280, viewportHeight - pad);

    const scaleW = availW / 960;
    const scaleH = availH / 680;
    const bestScale = Math.min(scaleW, scaleH, 1.05);

    setZoom(bestScale);
  }

  // --- EXPORT TO HIGH-RES PNG (html2canvas) ---
  async function exportCertificatePng() {
    triggerCelebration();
    showToast('✨ Preparing high-resolution certificate...');

    try {
      // Temporarily reset transform for crystal-clear render
      const originalTransform = els.cert.style.transform;
      els.cert.style.transform = 'none';

      // Capture at 3x resolution for crisp 300 DPI print quality
      const canvas = await html2canvas(els.cert, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
        onclone: (clonedDoc) => {
          const certClone = clonedDoc.getElementById('certificate');
          if (certClone) {
            certClone.style.transform = 'none';
            certClone.style.boxShadow = 'none';
          }
        }
      });

      // Restore zoom
      els.cert.style.transform = originalTransform;

      // Create download trigger
      const link = document.createElement('a');
      const filename = `Our-Little-Forever-${sanitizeFilename(state.partner1.name)}-and-${sanitizeFilename(state.partner2.name)}.png`;
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('🎉 Certificate downloaded successfully!');
    } catch (err) {
      console.error('Download PNG failed:', err);
      showToast('⚠️ Export failed. Try Print / PDF instead.');
    }
  }

  // --- NATIVE PRINT / PDF ---
  function printCertificate() {
    triggerCelebration();
    // Native browser print dialog triggers @media print rules
    window.print();
  }

  // --- SHAREABLE LINK (CLIENT-SIDE HASH) ---
  function copyShareableLink() {
    const params = new URLSearchParams();
    params.set('p1', state.partner1.name);
    params.set('t1', state.partner1.tag);
    params.set('p2', state.partner2.name);
    params.set('t2', state.partner2.tag);
    params.set('date', state.date);
    params.set('srv', state.server);
    params.set('off', state.officiant);
    params.set('vows', state.vows);
    params.set('thm', state.theme);

    const shareUrl = `${window.location.origin}${window.location.pathname}#${params.toString()}`;

    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast('🔗 Shareable link copied to clipboard!');
    }).catch(() => {
      showToast('⚠️ Could not copy automatically. URL in address bar updated.');
      window.location.hash = params.toString();
    });
  }

  function loadFromUrlHash() {
    if (!window.location.hash || window.location.hash.length <= 1) return;
    try {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);

      if (params.get('p1')) {
        state.partner1.name = params.get('p1');
        els.p1NameInput.value = state.partner1.name;
        els.sig1TextInput.value = state.partner1.name;
      }
      if (params.get('t1')) {
        state.partner1.tag = params.get('t1');
        els.p1TagInput.value = state.partner1.tag;
      }
      if (params.get('p2')) {
        state.partner2.name = params.get('p2');
        els.p2NameInput.value = state.partner2.name;
        els.sig2TextInput.value = state.partner2.name;
      }
      if (params.get('t2')) {
        state.partner2.tag = params.get('t2');
        els.p2TagInput.value = state.partner2.tag;
      }
      if (params.get('date')) {
        state.date = params.get('date');
        els.dateInput.value = state.date;
      }
      if (params.get('srv')) {
        state.server = params.get('srv');
        els.serverInput.value = state.server;
      }
      if (params.get('off')) {
        state.officiant = params.get('off');
        els.officiantInput.value = state.officiant;
      }
      if (params.get('vows')) {
        state.vows = params.get('vows');
        els.vowsInput.value = state.vows;
      }
      if (params.get('thm')) {
        state.theme = params.get('thm');
        document.querySelectorAll('.theme-card').forEach(c => {
          c.classList.toggle('active', c.getAttribute('data-theme') === state.theme);
        });
      }
    } catch (e) {
      console.warn('Could not parse hash parameters:', e);
    }
  }

  // --- DISCORD ANNOUNCEMENT COPY ---
  function copyDiscordAnnouncement() {
    const text = `💍 **OUR LITTLE FOREVER — DISCORD WEDDING CERTIFICATE** 💍
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ **${state.partner1.name}** (${state.partner1.tag}) & **${state.partner2.name}** (${state.partner2.tag}) ✨
*Have been playfully united in everlasting digital bond!*

📅 **Ceremony Date:** ${state.date}
💒 **Location:** ${state.server}
🕊️ **Officiated By:** ${state.officiant}

> *"${state.vows}"*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*A keepsake celebrated with love.* 💖`;

    navigator.clipboard.writeText(text).then(() => {
      showToast('💬 Discord announcement format copied!');
    }).catch(() => {
      showToast('⚠️ Could not copy announcement text.');
    });
  }

  // --- SAMPLE VOWS CYCLER ---
  function loadSampleVows() {
    const keys = Object.keys(vowPresets);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    state.vows = vowPresets[randomKey];
    els.vowsInput.value = state.vows;
    updateCertificate();
    showToast(`Loaded "${randomKey.toUpperCase()}" preset!`);
    triggerCelebration();
  }

  // --- CELEBRATION CONFETTI ---
  function triggerCelebration() {
    if (typeof confetti !== 'function') return;

    // Golden wedding burst
    confetti({
      particleCount: 65,
      spread: 75,
      origin: { y: 0.65 },
      colors: ['#dfba73', '#c5a059', '#f4a6b5', '#ffffff', '#ffd700']
    });

    // Secondary soft petals
    setTimeout(() => {
      confetti({
        particleCount: 40,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#e07a90', '#eed599']
      });
      confetti({
        particleCount: 40,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#c5a059', '#f4a6b5']
      });
    }, 250);
  }

  // --- TOAST NOTIFICATIONS ---
  let toastTimer = null;
  function showToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    els.toastMsg.textContent = message;
    els.toast.classList.add('show');
    toastTimer = setTimeout(() => {
      els.toast.classList.remove('show');
    }, 3200);
  }

  // --- UTILS ---
  function sanitizeFilename(str) {
    return (str || 'Keepsake').replace(/[^a-zA-Z0-9_-]/g, '');
  }

  function debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
