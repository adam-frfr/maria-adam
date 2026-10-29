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
      setTimeout(initSupabaseRealtime, 350);
      return;
    }

    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

      realtimeChannel = supabaseClient.channel('adam_maria_wedding_cert', {
        config: {
          broadcast: { self: false },
          presence: { key: clientSessionId }
        }
      });

      // 1. Live Signature sync
      realtimeChannel.on('broadcast', { event: 'sig_update' }, (payload) => {
        if (!payload || !payload.payload) return;
        const data = payload.payload;
        applyRemoteSignature(data.partner, data.dataUrl, data.clear);
      });

      // 2. Live Text sync
      realtimeChannel.on('broadcast', { event: 'text_sync' }, (payload) => {
        if (!payload || !payload.payload) return;
        const data = payload.payload;
        applyRemoteText(data.field, data.text);
      });

      // 3. State handshake
      realtimeChannel.on('broadcast', { event: 'request_state' }, () => {
        const snapshot = getCurrentState();
        realtimeChannel.send({
          type: 'broadcast',
          event: 'state_snapshot',
          payload: snapshot
        });
      });

      realtimeChannel.on('broadcast', { event: 'state_snapshot' }, (payload) => {
        if (!payload || !payload.payload) return;
        applyStateSnapshot(payload.payload);
      });

      // 4. Presence status
      realtimeChannel.on('presence', { event: 'sync' }, () => {
        const presenceState = realtimeChannel.presenceState();
        const userCount = Object.keys(presenceState).length;

        statusDot.classList.add('online');
        if (userCount >= 2) {
          statusText.textContent = 'Both online • Live';
        } else {
          statusText.textContent = 'Live sync ready';
        }
      });

      // Subscribe & Track
      realtimeChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          statusDot.classList.add('online');
          statusText.textContent = 'Live sync connected';
          await realtimeChannel.track({
            online_at: new Date().toISOString(),
            user: clientSessionId
          });

          realtimeChannel.send({
            type: 'broadcast',
            event: 'request_state',
            payload: { from: clientSessionId }
          });
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          statusDot.classList.remove('online');
          statusText.textContent = 'Offline (local mode)';
        }
      });

    } catch (err) {
      console.warn('Realtime sync fallback:', err);
      statusText.textContent = 'Local mode';
    }
  }

  function broadcastTextChange(fieldId, text) {
    if (!realtimeChannel) return;
    realtimeChannel.send({
      type: 'broadcast',
      event: 'text_sync',
      payload: { field: fieldId, text: text }
    });
    saveLocalState();
  }

  function broadcastSignature(partnerId, dataUrl, clear) {
    if (!realtimeChannel) return;
    realtimeChannel.send({
      type: 'broadcast',
      event: 'sig_update',
      payload: { partner: partnerId, dataUrl: dataUrl, clear: clear }
    });
    saveLocalState();
  }

  function applyRemoteSignature(partnerId, dataUrl, clear) {
    const pad = sigPads[partnerId];
    if (!pad) return;

    if (clear) {
      pad.ctx.clearRect(0, 0, pad.el.width, pad.el.height);
      pad.hasSignature = false;
      showToast(`Signature cleared`);
      return;
    }

    if (dataUrl) {
      const img = new Image();
      img.onload = () => {
        pad.ctx.clearRect(0, 0, pad.el.width, pad.el.height);
        const rect = pad.el.getBoundingClientRect();
        const width = rect.width || pad.el.parentElement.clientWidth || 140;
        const height = rect.height || pad.el.parentElement.clientHeight || 75;
        pad.ctx.drawImage(img, 0, 0, width, height);
        pad.hasSignature = true;
        showToast(`Partner signed!`);
      };
      img.src = dataUrl;
    }
  }

  function applyRemoteText(fieldId, text) {
    const el = document.querySelector(`[data-field="${fieldId}"]`);
    if (el && el !== document.activeElement) {
      el.textContent = text;
      syncDependentFields();
    }
  }

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

  // --- SIGNATURE CANVAS ENGINE (MOBILE TOUCH + MOUSE) ---
  function setupSignaturePads() {
    [1, 2].forEach(id => {
      const pad = sigPads[id];
      const canvas = pad.el;
      const ctx = canvas.getContext('2d');
      pad.ctx = ctx;

      function configureCanvasDPR() {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const width = rect.width || canvas.parentElement.clientWidth || 140;
        const height = rect.height || canvas.parentElement.clientHeight || 75;

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

      // Initial DPR sizing
      configureCanvasDPR();
      setTimeout(configureCanvasDPR, 100);
      window.addEventListener('resize', debounce(configureCanvasDPR, 200));

      let isDrawing = false;
      let points = [];

      function getCoords(e) {
        const rect = canvas.getBoundingClientRect();
        let clientX = e.clientX;
        let clientY = e.clientY;
        if (e.touches && e.touches.length > 0) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
          clientX = e.changedTouches[0].clientX;
          clientY = e.changedTouches[0].clientY;
        }
        return {
          x: (clientX !== undefined ? clientX : 0) - rect.left,
          y: (clientY !== undefined ? clientY : 0) - rect.top
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

        const dataUrl = canvas.toDataURL();
        broadcastSignature(id, dataUrl, false);
      }

      // Touch events (passive: false is essential to prevent scrolling while signing on mobile)
      canvas.addEventListener('touchstart', start, { passive: false });
      canvas.addEventListener('touchmove', move, { passive: false });
      window.addEventListener('touchend', end);
      window.addEventListener('touchcancel', end);

      // Mouse events
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
        vows: certVows.textContent.trim()
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

        showToast('Certificate saved');
      } catch (err) {
        console.error(err);
        showToast('Could not save image. Try PDF instead.');
      } finally {
        document.querySelectorAll('.btn-clear-sig').forEach(b => b.style.display = '');
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
