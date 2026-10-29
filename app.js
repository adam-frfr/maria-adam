/**
 * Minimal Wedding Certificate — Adam & Maria
 * Powered by Supabase Database & Realtime for permanent storage and live sync across devices
 */

(function () {
  'use strict';

  // --- SUPABASE CONFIGURATION ---
  const SUPABASE_URL = 'https://yebgxfcezwhdnosxzcot.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllYmd4ZmNlendoZG5vc3h6Y290Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzMDA1NzUsImV4cCI6MjEwODg3NjU3NX0.zO8aKK79qr52oCx_rIiZaUeSO-3G28g-MMkv9on5uys';
  const CERT_ID = 'adam_maria';

  // Unique session identifier for presence
  const clientSessionId = 'user_' + Math.random().toString(36).substring(2, 9);

  let supabaseClient = null;
  let realtimeChannel = null;

  // --- DOM ELEMENTS ---
  const nameP1 = document.getElementById('name-p1');
  const handleP1 = document.getElementById('handle-p1');
  const nameP2 = document.getElementById('name-p2');
  const handleP2 = document.getElementById('handle-p2');
  const labelP1 = document.getElementById('label-name-p1');
  const labelP2 = document.getElementById('label-name-p2');
  const certDate = document.getElementById('cert-date');
  const certVows = document.getElementById('cert-vows');
  const sealMonogramText = document.getElementById('seal-monogram-text');
  const sealYearText = document.getElementById('seal-year-text');

  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const onlineCountEl = document.getElementById('online-count');

  const btnShare = document.getElementById('btn-share');
  const btnPrint = document.getElementById('btn-print');
  const btnDownload = document.getElementById('btn-download');
  const toast = document.getElementById('toast');

  // Canvases for Partner 1 & Partner 2
  const sigPads = {
    1: {
      el: document.getElementById('canvas-sig-1'),
      clearBtn: document.getElementById('btn-clear-sig1'),
      ctx: null,
      hasSignature: false,
      dataUrl: null
    },
    2: {
      el: document.getElementById('canvas-sig-2'),
      clearBtn: document.getElementById('btn-clear-sig2'),
      ctx: null,
      hasSignature: false,
      dataUrl: null
    }
  };

  // --- INITIALIZATION ---
  function init() {
    loadLocalAndHashState();
    setupSignaturePads();
    setupInlineSync();
    setupActions();
    initSupabase();
  }

  // --- SUPABASE CLIENT & REALTIME ---
  async function initSupabase() {
    if (typeof window.supabase === 'undefined') {
      setTimeout(initSupabase, 350);
      return;
    }

    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

      // 1. Fetch saved certificate data from Supabase DB on startup
      await fetchFromDatabase();

      // 2. Set up Realtime Channel (both postgres_changes & instant broadcast)
      realtimeChannel = supabaseClient.channel('adam_maria_wedding_sync', {
        config: {
          broadcast: { self: false },
          presence: { key: clientSessionId }
        }
      });

      // Peer-to-peer instant broadcast for zero-latency drawing
      realtimeChannel.on('broadcast', { event: 'sig_update' }, (payload) => {
        if (!payload || !payload.payload) return;
        const data = payload.payload;
        applyRemoteSignature(data.partner, data.dataUrl, data.clear);
      });

      realtimeChannel.on('broadcast', { event: 'text_sync' }, (payload) => {
        if (!payload || !payload.payload) return;
        const data = payload.payload;
        applyRemoteText(data.field, data.text);
      });

      // Database real-time change listener (fires when PostgreSQL table updates)
      realtimeChannel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'certificates', filter: `id=eq.${CERT_ID}` },
        (payload) => {
          if (payload && payload.new) {
            applyDbRecord(payload.new);
          }
        }
      );

      // 3. Live Presence Tracking (counts active people on the site in real time)
      function updatePresenceDisplay() {
        if (!realtimeChannel) return;
        const presenceState = realtimeChannel.presenceState();
        let totalUsers = 0;
        for (const key in presenceState) {
          totalUsers += presenceState[key].length;
        }
        const activeCount = Math.max(1, totalUsers);

        if (onlineCountEl) onlineCountEl.textContent = activeCount;
        statusDot.classList.add('online');

        if (activeCount === 1) {
          statusText.textContent = 'online (you)';
        } else if (activeCount === 2) {
          statusText.textContent = 'online • Both connected';
        } else {
          statusText.textContent = 'people online';
        }
      }

      realtimeChannel.on('presence', { event: 'sync' }, () => {
        updatePresenceDisplay();
      });

      realtimeChannel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
        updatePresenceDisplay();
        showToast('Partner connected! Live sync active');
      });

      realtimeChannel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        updatePresenceDisplay();
      });

      // Subscribe & Track
      realtimeChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          statusDot.classList.add('online');
          await realtimeChannel.track({
            online_at: new Date().toISOString(),
            user: clientSessionId
          });
          updatePresenceDisplay();
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          statusDot.classList.remove('online');
          if (onlineCountEl) onlineCountEl.textContent = '1';
          statusText.textContent = 'local mode';
        }
      });

    } catch (err) {
      console.warn('Supabase setup note:', err);
      statusText.textContent = 'local mode';
    }
  }

  // --- DATABASE OPERATIONS ---
  async function fetchFromDatabase() {
    if (!supabaseClient) return;
    try {
      const { data, error } = await supabaseClient
        .from('certificates')
        .select('*')
        .eq('id', CERT_ID)
        .maybeSingle();

      if (error) {
        // Table not created yet or query error
        console.info('Supabase database table check:', error.message);
        return;
      }

      if (data) {
        applyDbRecord(data);
        statusDot.classList.add('online');
        statusText.textContent = 'Database synced';
      }
    } catch (e) {
      console.warn('Could not query database table:', e);
    }
  }

  function applyDbRecord(row) {
    if (!row) return;
    if (row.p1_name && document.activeElement !== nameP1) nameP1.textContent = row.p1_name;
    if (row.p1_handle && document.activeElement !== handleP1) handleP1.textContent = row.p1_handle;
    if (row.p2_name && document.activeElement !== nameP2) nameP2.textContent = row.p2_name;
    if (row.p2_handle && document.activeElement !== handleP2) handleP2.textContent = row.p2_handle;
    if (row.ceremony_date && document.activeElement !== certDate) certDate.textContent = row.ceremony_date;
    if (row.vows && document.activeElement !== certVows) certVows.textContent = row.vows;

    if (row.sig1) applyRemoteSignature(1, row.sig1, false);
    if (row.sig2) applyRemoteSignature(2, row.sig2, false);

    syncDependentFields();
  }

  // Debounced database saving
  const saveToDatabaseDebounced = debounce(async function () {
    if (!supabaseClient) return;
    try {
      const payload = {
        id: CERT_ID,
        p1_name: nameP1.textContent.trim(),
        p1_handle: handleP1.textContent.trim(),
        p2_name: nameP2.textContent.trim(),
        p2_handle: handleP2.textContent.trim(),
        ceremony_date: certDate.textContent.trim(),
        vows: certVows.textContent.trim(),
        sig1: sigPads[1].hasSignature ? sigPads[1].dataUrl : null,
        sig2: sigPads[2].hasSignature ? sigPads[2].dataUrl : null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabaseClient
        .from('certificates')
        .upsert(payload, { onConflict: 'id' });

      if (!error) {
        statusDot.classList.add('online');
      }
    } catch (e) {
      console.warn('Supabase DB save note:', e);
    }
  }, 600);

  function broadcastTextChange(fieldId, text) {
    if (realtimeChannel) {
      realtimeChannel.send({
        type: 'broadcast',
        event: 'text_sync',
        payload: { field: fieldId, text: text }
      });
    }
    saveLocalState();
    saveToDatabaseDebounced();
  }

  function broadcastSignature(partnerId, dataUrl, clear) {
    if (realtimeChannel) {
      realtimeChannel.send({
        type: 'broadcast',
        event: 'sig_update',
        payload: { partner: partnerId, dataUrl: dataUrl, clear: clear }
      });
    }
    saveLocalState();
    saveToDatabaseDebounced();
  }

  // DOM Elements for Signature Modal
  const sigModal = document.getElementById('sig-modal');
  const modalCanvas = document.getElementById('modal-canvas');
  const modalTitle = document.getElementById('modal-title');
  const btnModalClose = document.getElementById('btn-modal-close');
  const btnModalCancel = document.getElementById('btn-modal-cancel');
  const btnModalClear = document.getElementById('btn-modal-clear');
  const btnModalUndo = document.getElementById('btn-modal-undo');
  const btnModalDone = document.getElementById('btn-modal-done');

  let activePartnerForModal = 1;
  let modalCtx = null;
  let modalHasDrawn = false;
  let modalStrokeHistory = [];

  function applyRemoteSignature(partnerId, dataUrl, clear) {
    const pad = sigPads[partnerId];
    const hint = document.getElementById(`sig-hint-${partnerId}`);
    if (!pad) return;

    if (clear) {
      if (pad.ctx) pad.ctx.clearRect(0, 0, pad.el.width, pad.el.height);
      pad.hasSignature = false;
      pad.dataUrl = null;
      if (hint) hint.classList.remove('hidden');
      return;
    }

    if (dataUrl) {
      placeSignatureOnPad(partnerId, dataUrl, true);
    }
  }

  function applyRemoteText(fieldId, text) {
    const el = document.querySelector(`[data-field="${fieldId}"]`);
    if (el && el !== document.activeElement) {
      el.textContent = text;
      syncDependentFields();
    }
  }

  // --- SIGNATURE PLACEMENT & ASPECT-RATIO ENGINE ---
  function placeSignatureOnPad(partnerId, dataUrl, notify = false) {
    const pad = sigPads[partnerId];
    const hint = document.getElementById(`sig-hint-${partnerId}`);
    if (!pad || !dataUrl) return;

    pad.dataUrl = dataUrl;

    const img = new Image();
    img.onload = () => {
      const canvas = pad.el;
      const ctx = pad.ctx || canvas.getContext('2d');
      pad.ctx = ctx;

      const dpr = Math.max(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const cssW = rect.width || canvas.parentElement.clientWidth || 160;
      const cssH = rect.height || canvas.parentElement.clientHeight || 75;

      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Fit maintaining natural handwriting proportions with comfortable breathing room
      const maxW = cssW * 0.94;
      const maxH = cssH * 0.90;
      const ratio = img.width / img.height;
      let drawW, drawH;

      if (ratio > (maxW / maxH)) {
        drawW = maxW;
        drawH = maxW / ratio;
      } else {
        drawH = maxH;
        drawW = maxH * ratio;
      }

      const drawX = (cssW - drawW) / 2;
      const drawY = (cssH - drawH) / 2;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();

      pad.hasSignature = true;
      if (hint) hint.classList.add('hidden');

      if (notify) {
        const signerName = partnerId === 1 ? (nameP1.textContent.trim() || 'Adam') : (nameP2.textContent.trim() || 'Maria');
        showToast(`${signerName}'s signature placed! ✨`);
      }
    };
    img.src = dataUrl;
  }

  // Extracts tight bounding box around actual ink strokes to avoid distortion
  function getCanvasBoundingBox(canvas) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    if (width === 0 || height === 0) return null;

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = new Uint32Array(imgData.data.buffer);

    let minX = width, minY = height, maxX = 0, maxY = 0;
    let found = false;

    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      for (let x = 0; x < width; x++) {
        const pixel = data[rowOffset + x];
        const alpha = (pixel >> 24) & 0xff;
        if (alpha > 15) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }

    if (!found) return null;

    const strokeWidth = maxX - minX;
    const strokeHeight = maxY - minY;
    const padX = Math.round(strokeWidth * 0.05);
    const padY = Math.round(strokeHeight * 0.08);

    const cropX = Math.max(0, minX - padX);
    const cropY = Math.max(0, minY - padY);
    const cropW = Math.min(width - cropX, strokeWidth + padX * 2);
    const cropH = Math.min(height - cropY, strokeHeight + padY * 2);

    return { x: cropX, y: cropY, width: cropW, height: cropH };
  }

  // --- SMOOTH O(1) DRAWING ENGINE (ZERO LAG) ---
  function getEventCoords(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const cssX = clientX - rect.left;
    const cssY = clientY - rect.top;

    // Scale precisely to modal canvas context coordinates
    const dpr = Math.max(window.devicePixelRatio || 1, 2.5);
    const scaleX = (canvas.width / dpr) / (rect.width || 1);
    const scaleY = (canvas.height / dpr) / (rect.height || 1);

    return {
      x: cssX * scaleX,
      y: cssY * scaleY
    };
  }

  function bindSmoothDrawing(canvas, ctx, onStrokeComplete, beforeStrokeStart) {
    let isDrawing = false;
    let lastPoint = null;
    let lastMidPoint = null;

    function start(e) {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      if (beforeStrokeStart) beforeStrokeStart();
      isDrawing = true;
      const p = getEventCoords(e, canvas);
      lastPoint = p;
      lastMidPoint = p;

      ctx.beginPath();
      ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    }

    function move(e) {
      if (!isDrawing) return;
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();

      const cur = getEventCoords(e, canvas);
      const mid = {
        x: (lastPoint.x + cur.x) / 2,
        y: (lastPoint.y + cur.y) / 2
      };

      // O(1) incremental curve: instantly renders single segment without replaying history!
      ctx.beginPath();
      ctx.moveTo(lastMidPoint.x, lastMidPoint.y);
      ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, mid.x, mid.y);
      ctx.stroke();

      lastPoint = cur;
      lastMidPoint = mid;
    }

    function end(e) {
      if (!isDrawing) return;
      isDrawing = false;
      lastPoint = null;
      lastMidPoint = null;
      if (onStrokeComplete) onStrokeComplete();
    }

    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);

    canvas.addEventListener('mousedown', start);
    window.addEventListener('mousemove', (e) => {
      if (isDrawing) move(e);
    });
    window.addEventListener('mouseup', end);
  }

  // --- SIGNATURE CANVAS SETUP & MODAL TRIGGER ---
  function setupSignaturePads() {
    [1, 2].forEach(id => {
      const pad = sigPads[id];
      const canvas = pad.el;
      pad.ctx = canvas.getContext('2d');

      function configureCanvasDPR() {
        const dpr = Math.max(window.devicePixelRatio || 1, 2);
        const rect = canvas.getBoundingClientRect();
        const width = rect.width || canvas.parentElement.clientWidth || 160;
        const height = rect.height || canvas.parentElement.clientHeight || 75;

        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);

        if (pad.dataUrl) {
          placeSignatureOnPad(id, pad.dataUrl, false);
        }
      }

      configureCanvasDPR();
      setTimeout(configureCanvasDPR, 150);
      window.addEventListener('resize', debounce(configureCanvasDPR, 200));

      // Clicking / tapping the container opens the spacious studio modal
      const container = document.getElementById(`sig-container-${id}`);
      if (container) {
        container.addEventListener('click', (e) => {
          if (e.target.closest('.btn-clear-sig')) return;
          openSignatureModal(id);
        });
      }

      // Inline clear button
      pad.clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        pad.ctx.clearRect(0, 0, pad.el.width, pad.el.height);
        pad.hasSignature = false;
        pad.dataUrl = null;
        const hint = document.getElementById(`sig-hint-${id}`);
        if (hint) hint.classList.remove('hidden');
        broadcastSignature(id, null, true);
        showToast('Signature cleared');
      });
    });

    setupModalEngine();
  }

  // --- SPACIOUS SIGNATURE MODAL ENGINE ---
  function setupModalEngine() {
    modalCtx = modalCanvas.getContext('2d');

    bindSmoothDrawing(
      modalCanvas,
      modalCtx,
      () => {
        modalHasDrawn = true;
      },
      () => {
        try {
          if (modalStrokeHistory.length > 25) modalStrokeHistory.shift();
          modalStrokeHistory.push(modalCtx.getImageData(0, 0, modalCanvas.width, modalCanvas.height));
        } catch (e) {}
      }
    );

    if (btnModalUndo) {
      btnModalUndo.addEventListener('click', () => {
        if (modalStrokeHistory.length > 0) {
          const prev = modalStrokeHistory.pop();
          modalCtx.putImageData(prev, 0, 0);
          const bbox = getCanvasBoundingBox(modalCanvas);
          modalHasDrawn = bbox !== null;
        } else {
          modalCtx.clearRect(0, 0, modalCanvas.width, modalCanvas.height);
          modalHasDrawn = false;
        }
      });
    }

    btnModalClear.addEventListener('click', () => {
      modalStrokeHistory = [];
      modalCtx.clearRect(0, 0, modalCanvas.width, modalCanvas.height);
      modalHasDrawn = false;
    });

    btnModalClose.addEventListener('click', closeSignatureModal);
    btnModalCancel.addEventListener('click', closeSignatureModal);
    document.getElementById('sig-modal-backdrop').addEventListener('click', closeSignatureModal);

    btnModalDone.addEventListener('click', () => {
      if (modalHasDrawn) {
        const id = activePartnerForModal;
        const bbox = getCanvasBoundingBox(modalCanvas);

        let finalDataUrl;
        if (bbox && bbox.width > 4 && bbox.height > 4) {
          const cropCanvas = document.createElement('canvas');
          cropCanvas.width = bbox.width;
          cropCanvas.height = bbox.height;
          const cropCtx = cropCanvas.getContext('2d');
          cropCtx.drawImage(
            modalCanvas,
            bbox.x, bbox.y, bbox.width, bbox.height,
            0, 0, bbox.width, bbox.height
          );
          finalDataUrl = cropCanvas.toDataURL('image/png');
        } else {
          finalDataUrl = modalCanvas.toDataURL('image/png');
        }

        placeSignatureOnPad(id, finalDataUrl, true);
        broadcastSignature(id, finalDataUrl, false);
      }
      closeSignatureModal();
    });
  }

  function openSignatureModal(partnerId) {
    activePartnerForModal = partnerId;
    const partnerName = partnerId === 1 ? (nameP1.textContent.trim() || 'Adam') : (nameP2.textContent.trim() || 'Maria');
    modalTitle.textContent = `Sign for ${partnerName}`;

    document.body.style.overflow = 'hidden';
    sigModal.classList.add('open');
    sigModal.setAttribute('aria-hidden', 'false');
    modalStrokeHistory = [];

    // Sizing on open (use requestAnimationFrame to get true rendered dimensions)
    requestAnimationFrame(() => {
      const dpr = Math.max(window.devicePixelRatio || 1, 2.5);
      const rect = modalCanvas.getBoundingClientRect();
      const width = modalCanvas.clientWidth || rect.width || 360;
      const height = modalCanvas.clientHeight || rect.height || 260;

      modalCanvas.width = Math.round(width * dpr);
      modalCanvas.height = Math.round(height * dpr);

      modalCtx.scale(dpr, dpr);
      modalCtx.lineCap = 'round';
      modalCtx.lineJoin = 'round';
      modalCtx.lineWidth = 2.8;
      modalCtx.strokeStyle = '#171615';
      modalCtx.clearRect(0, 0, width, height);

      // If signature already exists, pre-load so they can review or re-draw
      const pad = sigPads[partnerId];
      if (pad && pad.hasSignature && pad.dataUrl) {
        const img = new Image();
        img.onload = () => {
          const maxW = width * 0.90;
          const maxH = height * 0.70;
          const ratio = img.width / img.height;
          let dW, dH;
          if (ratio > (maxW / maxH)) {
            dW = maxW;
            dH = maxW / ratio;
          } else {
            dH = maxH;
            dW = maxH * ratio;
          }
          const dX = (width - dW) / 2;
          const dY = (height - dH) / 2;
          modalCtx.drawImage(img, dX, dY, dW, dH);
          modalHasDrawn = true;
        };
        img.src = pad.dataUrl;
      } else {
        modalHasDrawn = false;
      }
    });
  }

  function closeSignatureModal() {
    sigModal.classList.remove('open');
    sigModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // --- INLINE EDITING SYNC ---
  function setupInlineSync() {
    const editables = document.querySelectorAll('[contenteditable="true"]');
    editables.forEach(el => {
      const field = el.getAttribute('data-field') || el.id;

      el.addEventListener('input', () => {
        syncDependentFields();
        broadcastTextChange(field, el.textContent.trim());
      });
    });
  }

  function syncDependentFields() {
    const p1 = nameP1.textContent.trim() || 'Adam';
    const p2 = nameP2.textContent.trim() || 'Maria';
    labelP1.textContent = p1;
    labelP2.textContent = p2;

    const init1 = (p1[0] || 'A').toUpperCase();
    const init2 = (p2[0] || 'M').toUpperCase();
    if (sealMonogramText) {
      sealMonogramText.textContent = `${init1} & ${init2}`;
    }

    const yearMatch = certDate.textContent.match(/\b(20\d\d)\b/);
    if (yearMatch && sealYearText) {
      sealYearText.textContent = yearMatch[1];
    }
  }

  // --- LOCAL PERSISTENCE & URL HASH ---
  function saveLocalState() {
    try {
      const state = {
        p1Name: nameP1.textContent.trim(),
        p1Handle: handleP1.textContent.trim(),
        p2Name: nameP2.textContent.trim(),
        p2Handle: handleP2.textContent.trim(),
        date: certDate.textContent.trim(),
        vows: certVows.textContent.trim(),
        sig1: sigPads[1].hasSignature ? sigPads[1].dataUrl : null,
        sig2: sigPads[2].hasSignature ? sigPads[2].dataUrl : null
      };
      localStorage.setItem('wedding_cert_state', JSON.stringify(state));
    } catch (e) {}
  }

  function loadLocalAndHashState() {
    let loadedFromHash = false;
    if (window.location.hash && window.location.hash.length > 1) {
      try {
        const params = new URLSearchParams(window.location.hash.substring(1));
        if (params.get('p1')) { nameP1.textContent = params.get('p1'); loadedFromHash = true; }
        if (params.get('h1')) handleP1.textContent = params.get('h1');
        if (params.get('p2')) { nameP2.textContent = params.get('p2'); loadedFromHash = true; }
        if (params.get('h2')) handleP2.textContent = params.get('h2');
        if (params.get('date')) certDate.textContent = params.get('date');
        if (params.get('vows')) certVows.textContent = params.get('vows');
      } catch (e) {}
    }

    if (!loadedFromHash) {
      try {
        const saved = localStorage.getItem('wedding_cert_state');
        if (saved) {
          const s = JSON.parse(saved);
          if (s.p1Name) nameP1.textContent = s.p1Name;
          if (s.p1Handle) handleP1.textContent = s.p1Handle;
          if (s.p2Name) nameP2.textContent = s.p2Name;
          if (s.p2Handle) handleP2.textContent = s.p2Handle;
          if (s.date) certDate.textContent = s.date;
          if (s.vows) certVows.textContent = s.vows;
          if (s.sig1) placeSignatureOnPad(1, s.sig1, false);
          if (s.sig2) placeSignatureOnPad(2, s.sig2, false);
        }
      } catch (e) {}
    }

    syncDependentFields();
  }

  // --- ACTION BUTTONS (SHARE, PRINT, DOWNLOAD) ---
  function setupActions() {
    btnShare.addEventListener('click', () => {
      const params = new URLSearchParams();
      params.set('p1', nameP1.textContent.trim());
      params.set('h1', handleP1.textContent.trim());
      params.set('p2', nameP2.textContent.trim());
      params.set('h2', handleP2.textContent.trim());
      params.set('date', certDate.textContent.trim());
      params.set('vows', certVows.textContent.trim());

      const url = `${window.location.origin}${window.location.pathname}#${params.toString()}`;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
          showToast('Share link copied!');
        }).catch(() => {
          window.location.hash = params.toString();
          showToast('Link updated in address bar');
        });
      } else {
        window.location.hash = params.toString();
        showToast('Link updated in address bar');
      }
    });

    btnPrint.addEventListener('click', () => {
      window.print();
    });

    btnDownload.addEventListener('click', async () => {
      const cert = document.getElementById('certificate');
      btnDownload.textContent = 'Saving...';

      // Create an offscreen wrapper with fixed horizontal landscape dimensions
      const offscreen = document.createElement('div');
      offscreen.style.position = 'fixed';
      offscreen.style.left = '-9999px';
      offscreen.style.top = '0';
      offscreen.style.width = '1080px';
      offscreen.style.zIndex = '-9999';
      offscreen.style.background = '#fefdfb';

      try {
        // Clone certificate and apply full landscape export styling
        const certClone = cert.cloneNode(true);
        certClone.classList.add('force-landscape-export');
        certClone.querySelectorAll('.btn-clear-sig').forEach(b => b.remove());
        certClone.querySelectorAll('.sig-tap-hint').forEach(h => h.remove());

        offscreen.appendChild(certClone);
        document.body.appendChild(offscreen);

        // Copy signature drawings to the clone with high-res crispness and exact aspect ratio
        const dpr = Math.max(window.devicePixelRatio || 1, 2.5);
        [1, 2].forEach(id => {
          const liveCanvas = document.getElementById(`canvas-sig-${id}`);
          const cloneCanvas = certClone.querySelector(`#canvas-sig-${id}`);
          if (cloneCanvas && sigPads[id].hasSignature) {
            cloneCanvas.width = 300 * dpr;
            cloneCanvas.height = 100 * dpr;
            const cloneCtx = cloneCanvas.getContext('2d');
            cloneCtx.clearRect(0, 0, cloneCanvas.width, cloneCanvas.height);

            const source = sigPads[id].img || liveCanvas;
            const sW = source.width || 300;
            const sH = source.height || 100;
            const maxW = cloneCanvas.width * 0.94;
            const maxH = cloneCanvas.height * 0.90;
            const ratio = sW / sH;
            let dW, dH;
            if (ratio > (maxW / maxH)) {
              dW = maxW;
              dH = maxW / ratio;
            } else {
              dH = maxH;
              dW = maxH * ratio;
            }
            const dX = (cloneCanvas.width - dW) / 2;
            const dY = (cloneCanvas.height - dH) / 2;
            cloneCtx.drawImage(source, dX, dY, dW, dH);
          }
        });

        // Capture in true horizontal landscape orientation
        const canvas = await html2canvas(certClone, {
          scale: 2.8,
          backgroundColor: '#fefdfb',
          useCORS: true,
          logging: false,
          width: 1080,
          windowWidth: 1200
        });

        const p1 = (nameP1.textContent.trim() || 'Adam').replace(/[^a-zA-Z0-9]/g, '');
        const p2 = (nameP2.textContent.trim() || 'Maria').replace(/[^a-zA-Z0-9]/g, '');
        const link = document.createElement('a');
        link.download = `Wedding-Certificate-${p1}-and-${p2}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('Horizontal certificate saved!');
      } catch (err) {
        console.error('Horizontal export error:', err);
        showToast('Could not save image. Try PDF instead.');
      } finally {
        if (offscreen.parentNode) {
          offscreen.parentNode.removeChild(offscreen);
        }
        btnDownload.textContent = 'Save';
      }
    });
  }

  // --- TOAST NOTIFICATION ---
  let toastTimer;
  function showToast(msg) {
    clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.classList.add('show');
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2600);
  }

  function debounce(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
