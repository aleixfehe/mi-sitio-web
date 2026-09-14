const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function withAlpha(color, alpha) {
  const hex = color.replace('#', '');
  if (hex.length !== 6) return color;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// --------------------------------------------------------------------------
// Ilustraciones de fondo. Se dibujan una sola vez (y al cambiar tamaño o
// tema) en un <canvas class="bg-art" data-art="...">. Son estáticas a
// propósito: acompañan al texto, no compiten con él.
// --------------------------------------------------------------------------
const ART = {
  // Capas de impresión apiladas que forman una silueta orgánica: la pieza
  // fabricada capa a capa y, a la vez, algo anatómico.
  layers(ctx, W, H, c) {
    const narrow = W < 760;
    const cx = narrow ? W * 0.82 : W * 0.74;
    const baseY = narrow ? H * 0.52 : H * 0.86;
    const R = narrow ? Math.min(W * 0.42, 210) : Math.min(W * 0.2, H * 0.36, 270);
    const L = narrow ? 30 : 46;
    const gap = (narrow ? H * 0.34 : H * 0.62) / L;
    const squash = 0.34;

    // Plataforma de impresión
    ctx.lineWidth = 1;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.ellipse(cx, baseY + 10, R * (1.15 + k * 0.14), R * (1.15 + k * 0.14) * squash, 0, 0, Math.PI * 2);
      ctx.strokeStyle = withAlpha(c.b, 0.07 - k * 0.015);
      ctx.stroke();
    }

    for (let i = 0; i < L; i++) {
      const t = i / (L - 1);
      const y0 = baseY - i * gap;
      const profile = 0.5 + 0.42 * Math.sin(Math.PI * (t * 0.92 + 0.06)) + 0.1 * Math.sin(t * 9.5);
      const r = R * profile;
      ctx.beginPath();
      for (let s = 0; s <= 120; s++) {
        const a = (s / 120) * Math.PI * 2;
        const wob = 1 + 0.07 * Math.sin(3 * a + t * 5.2) + 0.045 * Math.sin(5 * a - t * 8.1) + 0.03 * Math.cos(2 * a + t * 13);
        const x = cx + Math.cos(a) * r * wob;
        const y = y0 + Math.sin(a) * r * wob * squash;
        if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = withAlpha(c.bg, 0.72);
      ctx.fill();
      const accent = i % 7 === 3;
      ctx.lineWidth = accent ? 1.3 : 1;
      ctx.strokeStyle = accent ? withAlpha(c.b, 0.3) : withAlpha(c.a, 0.2 + 0.28 * t);
      ctx.stroke();
    }

    // Boquilla depositando la última capa
    const topY = baseY - (L - 1) * gap;
    ctx.strokeStyle = withAlpha(c.b, 0.35);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx + R * 0.35, topY - 70);
    ctx.lineTo(cx + R * 0.35, topY - 26);
    ctx.lineTo(cx + R * 0.31, topY - 14);
    ctx.lineTo(cx + R * 0.39, topY - 14);
    ctx.lineTo(cx + R * 0.35, topY - 26);
    ctx.stroke();
    ctx.fillStyle = withAlpha(c.a, 0.9);
    ctx.beginPath();
    ctx.arc(cx + R * 0.35, topY - 6, 2.6, 0, Math.PI * 2);
    ctx.fill();

    fadeLeft(ctx, W, H, narrow ? 0.05 : 0.3, narrow ? 0.62 : 0.6);
    if (narrow) fadeBottom(ctx, W, H, 0.35, 0.7);
  },

  // Trazas de señal: pulsatilidad, deriva de impedancia y una ráfaga de
  // interferencia. Texturas, no datos.
  signal(ctx, W, H, c) {
    const traces = 5;
    const top = H * 0.2;
    const span = H * 0.66;
    for (let k = 0; k < traces; k++) {
      const yb = top + (span / (traces - 1)) * k;
      const isAccent = k === 2;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 2) {
        const u = x / W;
        const period = 150 + k * 22;
        const ph = ((x + k * 57) % period) / period;
        let v = 0;
        if (k % 2 === 0) {
          v += Math.exp(-Math.pow((ph - 0.3) * 26, 2)) * 26;
          v -= Math.exp(-Math.pow((ph - 0.36) * 40, 2)) * 9;
          v += Math.exp(-Math.pow((ph - 0.6) * 12, 2)) * 6;
        } else {
          v += Math.sin(u * 10 + k) * 7 + Math.sin(u * 23 + k * 2) * 3;
        }
        if (k === 3 && u > 0.56 && u < 0.7) v += Math.sin(x * 0.9) * 10 * Math.sin((u - 0.56) / 0.14 * Math.PI);
        const y = yb - v;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineWidth = isAccent ? 1.4 : 1;
      ctx.strokeStyle = isAccent ? withAlpha(c.a, 0.4) : withAlpha(c.b, 0.1);
      ctx.stroke();
    }
    fadeLeft(ctx, W, H, 0, 0.5);
  },

  // Anillos concéntricos: el campo alrededor de un sensor, o las ondas de
  // una capa recién depositada. Para fondos oscuros.
  rings(ctx, W, H, c) {
    const cx = W * 0.92;
    const cy = H * 0.5;
    const max = Math.max(W * 0.55, H * 1.2);
    for (let i = 1; i <= 26; i++) {
      const r = (i / 26) * max;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.62, -0.18, 0, Math.PI * 2);
      const accent = i % 6 === 0;
      ctx.lineWidth = 1;
      ctx.strokeStyle = accent ? withAlpha(c.a, 0.35) : withAlpha(c.on, 0.06);
      ctx.stroke();
    }
    fadeLeft(ctx, W, H, 0.25, 0.75);
  },
};

function fadeLeft(ctx, W, H, from, to) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  const g = ctx.createLinearGradient(W * from, 0, W * to, 0);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W * to, H);
  ctx.restore();
}

function fadeBottom(ctx, W, H, from, to) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  const g = ctx.createLinearGradient(0, H * from, 0, H * to);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, H * from, W, H);
  ctx.restore();
}

function initBackgroundArt() {
  const canvases = document.querySelectorAll('canvas.bg-art[data-art]');
  if (!canvases.length) return;

  const drawAll = () => {
    const colors = {
      a: cssVar('--art-a') || '#bf5f3c',
      b: cssVar('--art-b') || '#141413',
      bg: cssVar('--bg') || '#f0eee6',
      on: cssVar('--on-dark') || '#f3f1e9',
    };
    canvases.forEach((canvas) => {
      const draw = ART[canvas.dataset.art];
      if (!draw) return;
      const rect = canvas.getBoundingClientRect();
      const W = Math.max(1, Math.round(rect.width));
      const H = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const surfaceBg = canvas.closest('.section-surface') ? cssVar('--surface') : colors.bg;
      draw(ctx, W, H, { ...colors, bg: surfaceBg });
    });
  };

  let timer = null;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(drawAll, 120);
  };

  drawAll();
  window.addEventListener('resize', schedule);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawAll);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawAll);
}

// --------------------------------------------------------------------------
// Navegación
// --------------------------------------------------------------------------
function initNavToggle() {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('primaryNav');
  if (!toggle || !nav) return;

  const close = () => {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  };

  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', close));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  window.addEventListener('resize', () => { if (window.innerWidth > 920) close(); });
}

function initActiveNav() {
  let current = window.location.pathname.split('/').pop();
  if (current === '') current = 'index.html';
  if (!current.includes('.')) current += '.html';
  document.querySelectorAll('.nav-links a').forEach((link) => {
    if (link.getAttribute('href') === current) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
  });
}

// --------------------------------------------------------------------------
// Aparición suave: solo se ocultan los bloques que empiezan fuera de la
// pantalla, así la primera vista siempre está completa.
// --------------------------------------------------------------------------
function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length || reduceMotion || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.remove('is-pending');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  els.forEach((el) => {
    if (el.getBoundingClientRect().top > window.innerHeight) {
      el.classList.add('is-pending');
      observer.observe(el);
    }
  });
}

// --------------------------------------------------------------------------
// Preguntas frecuentes
// --------------------------------------------------------------------------
function initAccordion() {
  const items = document.querySelectorAll('.accordion-item');
  items.forEach((item, idx) => {
    const trigger = item.querySelector('.accordion-trigger');
    const panel = item.querySelector('.accordion-panel');
    if (!trigger || !panel) return;
    const pid = panel.id || `faq-panel-${idx}`;
    panel.id = pid;
    trigger.setAttribute('aria-controls', pid);
    trigger.setAttribute('aria-expanded', 'false');

    trigger.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      items.forEach((other) => {
        other.classList.remove('open');
        const t = other.querySelector('.accordion-trigger');
        const p = other.querySelector('.accordion-panel');
        if (t) t.setAttribute('aria-expanded', 'false');
        if (p) p.style.maxHeight = null;
      });
      if (!isOpen) {
        item.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        panel.style.maxHeight = panel.scrollHeight + 'px';
      }
    });
  });
}

// --------------------------------------------------------------------------
// Formulario de contacto (envío real a /api/contacto)
// --------------------------------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function setFieldError(form, name, msg) {
  const el = form.querySelector(`[data-error-for="${name}"]`);
  if (el) el.textContent = msg || '';
}

function showStatus(el, kind, html) {
  if (!el) return;
  el.className = `form-status ${kind === 'ok' ? 'is-ok' : 'is-error'}`;
  el.innerHTML = html;
  el.setAttribute('role', kind === 'ok' ? 'status' : 'alert');
}

function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;
  const status = document.getElementById('contactStatus');
  const started = Date.now();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.elements.empresa_web && form.elements.empresa_web.value) return;

    const checks = {
      nombre: (v) => v.trim().length >= 2 || 'Escribe tu nombre.',
      email: (v) => EMAIL_RE.test(v.trim()) || 'Revisa el correo: falta la @ o el dominio.',
      asunto: (v) => v.trim().length > 0 || 'Elige de qué quieres hablar.',
      mensaje: (v) => v.trim().length >= 10 || 'Cuéntanos un poco más (mínimo 10 caracteres).',
    };
    let valid = true;
    Object.entries(checks).forEach(([name, fn]) => {
      const res = fn(form.elements[name].value);
      setFieldError(form, name, res === true ? '' : res);
      if (res !== true) valid = false;
    });
    if (!form.elements.consentimiento.checked) {
      setFieldError(form, 'consentimiento', 'Necesitamos tu consentimiento para responderte.');
      valid = false;
    } else {
      setFieldError(form, 'consentimiento', '');
    }
    if (!valid) return;

    const btn = form.querySelector('button[type="submit"]');
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Enviando…';

    const data = new FormData(form);
    data.append('elapsed', String(Date.now() - started));

    try {
      const res = await fetch('/api/contacto', { method: 'POST', body: data });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'El servidor no ha aceptado el mensaje.');
      showStatus(status, 'ok', 'Mensaje enviado. Te respondemos en menos de 48 horas laborables.');
      form.reset();
    } catch (err) {
      showStatus(status, 'error', `No se ha podido enviar: ${err.message} Escríbenos directamente a <a href="mailto:hola@technelatros.es">hola@technelatros.es</a>.`);
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initBackgroundArt();
  initNavToggle();
  initActiveNav();
  initReveal();
  initAccordion();
  initContactForm();
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
});
