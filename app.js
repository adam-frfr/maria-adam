/**
 * Minimal Wedding Certificate — Adam & Maria
 * Powered by Supabase Realtime for instant live sync across devices
 */

(function () {
  'use strict';

  // --- SUPABASE CONFIGURATION ---
  const SUPABASE_URL = 'https://yebgxfcezwhdnosxzcot.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllYmd4ZmNlendoZG5vc3h6Y290Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzMDA1NzUsImV4cCI6MjEwODg3NjU3NX0.zO8aKK79qr52oCx_rIiZaUeSO-3G28g-MMkv9on5uys';

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
      hasSignature: false
    },
    2: {
      el: document.getElementById('canvas-sig-2'),
      clearBtn: document.getElementById('btn-clear-sig2'),
      ctx: null,
      hasSignature: false
    }
  };

  // --- INITIALIZATION ---
  function init() {
    loadLocalAndHashState();
    setupSignaturePads();
    setupInlineSync();
    setupActions();
    initSupabaseRealtime();
  }

  // --- SUPABASE REALTIME SYNC ---
  function initSupabaseRealtime() {
    if (typeof window.supabase === 'undefined') {
      console.warn('Supabase SDK not loaded yet, retrying...');
      setTimeout(initSupabaseRealtime, 400);
      return;
    }

    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

      // Dedicated real-time broadcast and presence channel
      realtimeChannel = supabaseClient.channel('adam_maria_wedding_cert', {
        config: {
          broadcast: { self: false },
          presence: { key: clientSessionId }
        }
      });

      // 1. Listen for Live Signature updates
      realtimeChannel.on('broadcast', { event: 'sig_update' }, (payload) => {
        if (!payload || !payload.payload) return;
        const data = payload.payload;
        applyRemoteSignature(data.partner, data.dataUrl, data.clear);
      });

      // 2. Listen for Live Text edits
      realtimeChannel.on('broadcast', { event: 'text_sync' }, (payload) => {
        if (!payload || !payload.payload) return;
        const data = payload.payload;
        applyRemoteText(data.field, data.text);
      });

      // 3. Listen for State Request from newly opened tabs
      realtimeChannel.on('broadcast', { event: 'request_state' }, () => {
        // Send current snapshot back to partner
        const snapshot = getCurrentState();
        realtimeChannel.send({
          type: 'broadcast',
          event: 'state_snapshot',
          payload: snapshot
        });
      });

      // 4. Receive State Snapshot
      realtimeChannel.on('broadcast', { event: 'state_snapshot' }, (payload) => {
        if (!payload || !payload.payload) return;
        applyStateSnapshot(payload.payload);
      });

      // 5. Presence Tracking (shows when both are connected)
      realtimeChannel.on('presence', { event: 'sync' }, () => {
        const presenceState = realtimeChannel.presenceState();
        const userCount = Object.keys(presenceState).length;

        statusDot.classList.add('online');
        if (userCount >= 2) {
          statusText.textContent = 'Live sync active • Both partners online';
        } else {
          statusText.textContent = 'Live sync connected • Share link with Maria';
        }
      });

      // Subscribe & Track Presence
      realtimeChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          statusDot.classList.add('online');
          statusText.textContent = 'Live sync connected';
          await realtimeChannel.track({
            online_at: new Date().toISOString(),
            user: clientSessionId
          });

          // Request latest state from any already open tab
          realtimeChannel.send({
            type: 'broadcast',
            event: 'request_state',
            payload: { from: clientSessionId }
          });
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          statusDot.classList.remove('online');
          statusText.textContent = 'Sync offline (local mode active)';
        }
      });

    } catch (err) {
      console.error('Supabase Realtime setup failed:', err);
      statusText.textContent = 'Local session active';
    }
  }

  // Broadcast text changes
  function broadcastTextChange(fieldId, text) {
    if (!realtimeChannel) return;
    realtimeChannel.send({
      type: 'broadcast',
      event: 'text_sync',
      payload: { field: fieldId, text: text }
    });
    saveLocalState();
  }

  // Broadcast signature changes
  function broadcastSignature(partnerId, dataUrl, clear) {
    if (!realtimeChannel) return;
    realtimeChannel.send({
      type: 'broadcast',
      event: 'sig_update',
      payload: { partner: partnerId, dataUrl: dataUrl, clear: clear }
    });
    saveLocalState();
  }

  // Apply signature received from partner in real time
  function applyRemoteSignature(partnerId, dataUrl, clear) {
    const pad = sigPads[partnerId];
    if (!pad) return;

    if (clear) {
      pad.ctx.clearRect(0, 0, pad.el.width, pad.el.height);
      pad.hasSignature = false;
      showToast(`Partner cleared signature ${partnerId}`);
      return;
    }

    if (dataUrl) {
      const img = new Image();
      img.onload = () => {
        pad.ctx.clearRect(0, 0, pad.el.width, pad.el.height);
        // Draw image scaled to canvas
        const dpr = window.devicePixelRatio || 1;
        const rect = pad.el.getBoundingClientRect();
        pad.ctx.drawImage(img, 0, 0, rect.width, rect.height);
        pad.hasSignature = true;
        showToast(`Partner signed!`);
      };
      img.src = dataUrl;
    }
  }

  // Apply text received from partner in real time
  function applyRemoteText(fieldId, text) {
    const el = document.querySelector(`[data-field="${fieldId}"]`);
    if (el && el !== document.activeElement) {
      el.textContent = text;
      syncDependentFields();
    }
  }

  // State Snapshot Handshake
  function getCurrentState() {
    return {
      p1Name: nameP1.textContent.trim(),
      p1Handle: handleP1.textContent.trim(),
      p2Name: nameP2.textContent.trim(),
      p2Handle: handleP2.textContent.trim(),
      date: certDate.textContent.trim(),
      vows: certVows.textContent.trim(),
      sig1: sigPads[1].hasSignature ? sigPads[1].el.toDataURL() : null,
      sig2: sigPads[2].hasSignature ? sigPads[2].el.toDataURL() : null
    };
  }

  function applyStateSnapshot(snapshot) {
    if (!snapshot) return;
    if (snapshot.p1Name && document.activeElement !== nameP1) nameP1.textContent = snapshot.p1Name;
    if (snapshot.p1Handle && document.activeElement !== handleP1) handleP1.textContent = snapshot.p1Handle;
    if (snapshot.p2Name && document.activeElement !== nameP2) nameP2.textContent = snapshot.p2Name;
    if (snapshot.p2Handle && document.activeElement !== handleP2) handleP2.textContent = snapshot.p2Handle;
    if (snapshot.date && document.activeElement !== certDate) certDate.textContent = snapshot.date;
    if (snapshot.vows && document.activeElement !== certVows) certVows.textContent = snapshot.vows;

    if (snapshot.sig1 && !sigPads[1].hasSignature) applyRemoteSignature(1, snapshot.sig1, false);
    if (snapshot.sig2 && !sigPads[2].hasSignature) applyRemoteSignature(2, snapshot.sig2, false);

    syncDependentFields();
  }

  // --- SIGNATURE CANVAS ENGINE (SMOOTH HANDWRITING) ---
  function setupSignaturePads() {
    [1, 2].forEach(id => {
      const pad = sigPads[id];
      const canvas = pad.el;
      const ctx = canvas.getContext('2d');
      pad.ctx = ctx;

      function configureCanvasDPR() {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const width = rect.width || 280;
        const height = rect.height || 85;

        // Preserve strokes if resizing
        const temp = document.createElement('canvas');
        temp.width = canvas.width;
        temp.height = canvas.height;
        if (canvas.width > 0 && canvas.height > 0) {
          temp.getContext('2d').drawImage(canvas, 0, 0);
        }

        canvas.width = width * dpr;
        canvas.height = height * dpr;

        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 1.9;
        ctx.strokeStyle = '#171615';

        if (temp.width > 0 && temp.height > 0) {
          ctx.drawImage(temp, 0, 0, width, height);
        }
      }

      configureCanvasDPR();
      window.addEventListener('resize', debounce(configureCanvasDPR, 200));

      let isDrawing = false;
      let points = [];

      function getCoords(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX !== undefined ? e.clientX : (e.touches ? e.touches[0].clientX : 0);
        const clientY = e.clientY !== undefined ? e.clientY : (e.touches ? e.touches[0].clientY : 0);
        return {
          x: clientX - rect.left,
          y: clientY - rect.top
        };
      }

      function start(e) {
        if (e.cancelable) e.preventDefault();
        isDrawing = true;
        const coord = getCoords(e);
        points = [coord];

        ctx.beginPath();
        ctx.arc(coord.x, coord.y, 0.9, 0, Math.PI * 2);
        ctx.fillStyle = '#171615';
        ctx.fill();
      }

      function move(e) {
        if (!isDrawing) return;
        if (e.cancelable) e.preventDefault();

        const coord = getCoords(e);
        points.push(coord);

        if (points.length < 3) {
          const b = points[0];
          ctx.beginPath();
          ctx.arc(b.x, b.y, ctx.lineWidth / 2, 0, Math.PI * 2, true);
          ctx.fill();
          return;
        }

        // Quadratic Bezier smoothing for natural fountain-pen curve
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length - 2; i++) {
          const c = (points[i].x + points[i + 1].x) / 2;
          const d = (points[i].y + points[i + 1].y) / 2;
          ctx.quadraticCurveTo(points[i].x, points[i].y, c, d);
        }

        const last = points.length - 2;
        ctx.quadraticCurveTo(
          points[last].x,
          points[last].y,
          points[last + 1].x,
          points[last + 1].y
        );
        ctx.stroke();
      }

      function end() {
        if (!isDrawing) return;
        isDrawing = false;
        points = [];
        pad.hasSignature = true;

        // Broadcast to partner in real time!
        const dataUrl = canvas.toDataURL();
        broadcastSignature(id, dataUrl, false);
      }

      // Pointer & Touch Events
      canvas.addEventListener('touchstart', start, { passive: false });
      canvas.addEventListener('touchmove', move, { passive: false });
      window.addEventListener('touchend', end);

      canvas.addEventListener('mousedown', start);
      canvas.addEventListener('mousemove', move);
      window.addEventListener('mouseup', end);

      // Clear Button
      pad.clearBtn.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pad.hasSignature = false;
        broadcastSignature(id, null, true);
      });
    });
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
    // Signature labels
    const p1 = nameP1.textContent.trim() || 'Adam';
    const p2 = nameP2.textContent.trim() || 'Maria';
    labelP1.textContent = p1;
    labelP2.textContent = p2;

    // Seal Monogram
    const init1 = (p1[0] || 'A').toUpperCase();
    const init2 = (p2[0] || 'M').toUpperCase();
    sealMonogramText.textContent = `${init1} & ${init2}`;

    // Year from date
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
        vows: certVows.textContent.trim()
      };
      localStorage.setItem('wedding_cert_state', JSON.stringify(state));
    } catch (e) {}
  }

  function loadLocalAndHashState() {
    // 1. Try URL hash first
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

    // 2. Fallback to localStorage if no hash
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
        }
      } catch (e) {}
    }

    syncDependentFields();
  }

  // --- ACTION BUTTONS (SHARE, PRINT, DOWNLOAD) ---
  function setupActions() {
    // Share Link
    btnShare.addEventListener('click', () => {
      const params = new URLSearchParams();
      params.set('p1', nameP1.textContent.trim());
      params.set('h1', handleP1.textContent.trim());
      params.set('p2', nameP2.textContent.trim());
      params.set('h2', handleP2.textContent.trim());
      params.set('date', certDate.textContent.trim());
      params.set('vows', certVows.textContent.trim());

      const url = `${window.location.origin}${window.location.pathname}#${params.toString()}`;

      navigator.clipboard.writeText(url).then(() => {
        showToast('Shareable link copied to clipboard');
      }).catch(() => {
        window.location.hash = params.toString();
        showToast('Link updated in address bar');
      });
    });

    // Print
    btnPrint.addEventListener('click', () => {
      window.print();
    });

    // High-Res Image Download
    btnDownload.addEventListener('click', async () => {
      const cert = document.getElementById('certificate');
      btnDownload.textContent = 'Saving...';

      // Temporarily hide clear buttons during capture
      document.querySelectorAll('.btn-clear-sig').forEach(b => b.style.display = 'none');

      try {
        const canvas = await html2canvas(cert, {
          scale: 3,
          backgroundColor: '#fefdfb',
          useCORS: true,
          logging: false
        });

        const p1 = (nameP1.textContent.trim() || 'Adam').replace(/[^a-zA-Z0-9]/g, '');
        const p2 = (nameP2.textContent.trim() || 'Maria').replace(/[^a-zA-Z0-9]/g, '');
        const link = document.createElement('a');
        link.download = `Wedding-Certificate-${p1}-and-${p2}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('Certificate saved to downloads');
      } catch (err) {
        console.error(err);
        showToast('Could not save image. Try Print instead.');
      } finally {
        document.querySelectorAll('.btn-clear-sig').forEach(b => b.style.display = '');
        btnDownload.textContent = 'Save Image';
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
    }, 2800);
  }

  function debounce(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
