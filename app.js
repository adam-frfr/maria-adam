/**
 * Minimal Wedding Certificate — Adam & Maria
 * Hand-drawn signatures, direct inline editing, and high-res export
 */

(function () {
  'use strict';

  // --- DOM Elements ---
  const nameP1 = document.getElementById('name-p1');
  const handleP1 = document.getElementById('handle-p1');
  const nameP2 = document.getElementById('name-p2');
  const handleP2 = document.getElementById('handle-p2');
  const labelP1 = document.getElementById('label-name-p1');
  const labelP2 = document.getElementById('label-name-p2');
  const certDate = document.getElementById('cert-date');
  const certVows = document.getElementById('cert-vows');
  const monogramSymbol = document.querySelector('.monogram-symbol');
  const monogramDate = document.getElementById('monogram-date');

  const btnShare = document.getElementById('btn-share');
  const btnPrint = document.getElementById('btn-print');
  const btnDownload = document.getElementById('btn-download');
  const toast = document.getElementById('toast');

  // --- State ---
  const sigCanvases = {
    1: { el: document.getElementById('canvas-sig-1'), clearBtn: document.getElementById('btn-clear-sig1') },
    2: { el: document.getElementById('canvas-sig-2'), clearBtn: document.getElementById('btn-clear-sig2') }
  };

  // --- Initialize ---
  function init() {
    loadFromHash();
    setupSignatureCanvas(1);
    setupSignatureCanvas(2);
    setupInlineSync();
    setupActions();
  }

  // --- Synchronize Names to Signatures & Monogram ---
  function setupInlineSync() {
    nameP1.addEventListener('input', () => {
      const val = nameP1.textContent.trim() || 'Spouse 1';
      labelP1.textContent = val;
      updateMonogram();
    });

    nameP2.addEventListener('input', () => {
      const val = nameP2.textContent.trim() || 'Spouse 2';
      labelP2.textContent = val;
      updateMonogram();
    });

    certDate.addEventListener('input', () => {
      const yearMatch = certDate.textContent.match(/\b(20\d\d)\b/);
      if (yearMatch) {
        monogramDate.textContent = yearMatch[1];
      }
    });
  }

  function updateMonogram() {
    const p1 = (nameP1.textContent.trim()[0] || 'A').toUpperCase();
    const p2 = (nameP2.textContent.trim()[0] || 'M').toUpperCase();
    monogramSymbol.textContent = `${p1} & ${p2}`;
  }

  // --- Hand-Drawn Signature Pad (Touch & Mouse with Smooth Curves) ---
  function setupSignatureCanvas(id) {
    const item = sigCanvases[id];
    const canvas = item.el;
    const ctx = canvas.getContext('2d');

    // High DPI Retina Support
    function resizeCanvas() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const currentWidth = rect.width || 280;
      const currentHeight = rect.height || 80;

      // Preserve existing drawing if any
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(canvas, 0, 0);

      canvas.width = currentWidth * dpr;
      canvas.height = currentHeight * dpr;

      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = '#181716';

      if (tempCanvas.width > 0 && tempCanvas.height > 0) {
        ctx.drawImage(tempCanvas, 0, 0, currentWidth, currentHeight);
      }
    }

    resizeCanvas();
    window.addEventListener('resize', debounce(resizeCanvas, 200));

    let points = [];
    let isDrawing = false;

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
      ctx.fillStyle = '#181716';
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
        ctx.arc(b.x, b.y, ctx.lineWidth / 2, 0, Math.PI * 2, !0);
        ctx.fill();
        ctx.closePath();
        return;
      }

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length - 2; i++) {
        const c = (points[i].x + points[i + 1].x) / 2;
        const d = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, c, d);
      }

      const lastIdx = points.length - 2;
      ctx.quadraticCurveTo(
        points[lastIdx].x,
        points[lastIdx].y,
        points[lastIdx + 1].x,
        points[lastIdx + 1].y
      );
      ctx.stroke();
    }

    function end() {
      if (!isDrawing) return;
      isDrawing = false;
      points = [];
    }

    // Touch events for phone/tablet/iPad/touchscreen
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);

    // Mouse events
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);

    // Clear Button
    item.clearBtn.addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
  }

  // --- Action Buttons ---
  function setupActions() {
    // Print / PDF
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
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false
        });

        const p1 = (nameP1.textContent.trim() || 'Adam').replace(/[^a-zA-Z0-9]/g, '');
        const p2 = (nameP2.textContent.trim() || 'Maria').replace(/[^a-zA-Z0-9]/g, '');
        const filename = `Wedding-Certificate-${p1}-and-${p2}.png`;

        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('Certificate saved');
      } catch (err) {
        console.error(err);
        showToast('Could not save image. Try Print instead.');
      } finally {
        document.querySelectorAll('.btn-clear-sig').forEach(b => b.style.display = '');
        btnDownload.textContent = 'Download';
      }
    });

    // Share link
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
        showToast('Link copied to clipboard');
      }).catch(() => {
        window.location.hash = params.toString();
        showToast('URL updated in address bar');
      });
    });
  }

  // --- URL Hash Loading ---
  function loadFromHash() {
    if (!window.location.hash || window.location.hash.length <= 1) return;
    try {
      const params = new URLSearchParams(window.location.hash.substring(1));
      if (params.get('p1')) {
        nameP1.textContent = params.get('p1');
        labelP1.textContent = params.get('p1');
      }
      if (params.get('h1')) handleP1.textContent = params.get('h1');
      if (params.get('p2')) {
        nameP2.textContent = params.get('p2');
        labelP2.textContent = params.get('p2');
      }
      if (params.get('h2')) handleP2.textContent = params.get('h2');
      if (params.get('date')) certDate.textContent = params.get('date');
      if (params.get('vows')) certVows.textContent = params.get('vows');

      updateMonogram();
    } catch (e) {
      console.warn('Hash parse error:', e);
    }
  }

  // --- Toast Notification ---
  let toastTimer;
  function showToast(msg) {
    clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.classList.add('show');
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
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
