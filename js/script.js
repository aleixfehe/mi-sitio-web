const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Contadores animados (estadísticas de la página principal).
function initCounters() {
  const counters = document.querySelectorAll('.stat-number');
  if (!counters.length) return;

  const animate = (el) => {
    const target = parseInt(el.dataset.target, 10);
    const suffix = el.dataset.suffix || '';
    const duration = 1200;
    const start = performance.now();

    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animate(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });

  counters.forEach((c) => observer.observe(c));
}

// Aparición suave de elementos al hacer scroll.
function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  els.forEach((el) => observer.observe(el));
}

// Menú móvil.
function initNavToggle() {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('primaryNav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 700) {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

// Resalta el enlace de navegación de la página actual.
function initActiveNav() {
  const links = document.querySelectorAll('.nav-links a');
  if (!links.length) return;

  let current = window.location.pathname.split('/').pop();
  if (current === '') current = 'index.html';

  links.forEach((link) => {
    if (link.getAttribute('href') === current) link.classList.add('active');
  });
}

// Acordeón de preguntas frecuentes.
function initAccordion() {
  const items = document.querySelectorAll('.accordion-item');
  if (!items.length) return;

  items.forEach((item) => {
    const trigger = item.querySelector('.accordion-trigger');
    const panel = item.querySelector('.accordion-panel');
    if (!trigger || !panel) return;

    trigger.setAttribute('aria-expanded', 'false');

    trigger.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');

      items.forEach((other) => {
        other.classList.remove('open');
        const otherTrigger = other.querySelector('.accordion-trigger');
        const otherPanel = other.querySelector('.accordion-panel');
        if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
        if (otherPanel) otherPanel.style.maxHeight = null;
      });

      if (!isOpen) {
        item.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        panel.style.maxHeight = panel.scrollHeight + 'px';
      }
    });
  });
}

// Demostración de fusión de señal quirúrgica: fuerza de contacto (biopotencial
// mecánico transmitido por la pulsatilidad de un vaso), bioimpedancia tisular
// e interferencia electromagnética / vibración del electrobisturí, combinadas
// en un trazado "fusionado" de contacto seguro. Los valores son simulados con
// fines ilustrativos, no proceden de sensores ni intervenciones reales.
function initWaveform() {
  const canvas = document.getElementById('waveform');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const roForce = document.getElementById('roForce');
  const roImp = document.getElementById('roImp');
  const roVib = document.getElementById('roVib');

  const COLOR_FORCE = '#4ade80';
  const COLOR_IMP = 'rgba(45, 212, 191, 0.55)';
  const COLOR_FUSED = '#ffffff';
  const COLOR_EMI = '#e07a5f';

  const N = 240;
  const forceBuf = new Array(N).fill(0);
  const impBuf = new Array(N).fill(0.45);
  const emiBuf = new Array(N).fill(0);
  const fusedBuf = new Array(N).fill(0.45);

  let W = 0, H = 0, laneH = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
  let t = 0, burstUntil = -10, nextBurst = 3 + Math.random() * 3, pulseRate = 72;
  let dispForce = 1.6, dispImp = 380, dispVib = 4;

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    W = Math.max(Math.round(rect.width), 1);
    H = canvas.clientHeight || 190;
    laneH = H / 3;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function push(buf, v) {
    buf.shift();
    buf.push(v);
  }

  function sample() {
    t += 0.05;
    if (t > nextBurst && t > burstUntil) {
      burstUntil = t + 0.7 + Math.random() * 0.7;
      nextBurst = t + 4 + Math.random() * 4;
    }
    const inBurst = t < burstUntil;
    // Activación del electrobisturí: ráfagas de interferencia electromagnética
    // y vibración acoplada al instrumento.
    const emiVal = inBurst
      ? Math.sin(t * 26) * 0.8 + (Math.random() - 0.5) * 0.5
      : Math.sin(t * 1.3) * 0.06 + (Math.random() - 0.5) * 0.05;

    // Pulsatilidad vascular transmitida al sensor de fuerza del instrumento.
    const cycle = 60 / pulseRate;
    const phase = (t % cycle) / cycle;
    let forceVal = Math.exp(-Math.pow((phase - 0.18) * 22, 2)) * 0.16;
    forceVal += Math.exp(-Math.pow((phase - 0.32) * 90, 2)) * -0.28;
    forceVal += Math.exp(-Math.pow((phase - 0.34) * 140, 2)) * 1;
    forceVal += Math.exp(-Math.pow((phase - 0.36) * 90, 2)) * -0.32;
    forceVal += Math.exp(-Math.pow((phase - 0.55) * 14, 2)) * 0.2;
    forceVal += (Math.random() - 0.5) * 0.015;

    // Bioimpedancia tisular: deriva lenta, corrompida por EMI cuando el
    // electrobisturí está activo.
    const impClean = Math.sin(phase * 2 * Math.PI) * 0.32 + Math.sin(phase * 4 * Math.PI + 1) * 0.1 + 0.45;
    const artifact = inBurst ? (Math.random() - 0.5) * 1.1 * Math.abs(emiVal) : 0;
    const impVal = clamp(impClean + artifact, -0.1, 1.1);

    // Fusión: cuanto más EMI hay, menos se confía en la impedancia cruda y
    // más peso gana la envolvente de fuerza (canal robusto frente a interferencia).
    const trust = clamp(1 - Math.abs(emiVal) * 1.1, 0.12, 1);
    const forceEnvelope = clamp(forceVal, -0.35, 1) * 0.35 + 0.45;
    const fusedVal = trust * impClean + (1 - trust) * forceEnvelope;

    push(forceBuf, forceVal);
    push(impBuf, impVal);
    push(emiBuf, emiVal);
    push(fusedBuf, fusedVal);

    pulseRate += (72 + Math.sin(t * 0.15) * 6 - pulseRate) * 0.01;
    const forceN = 1.6 + clamp(forceVal, -0.35, 1) * 1.3;
    const impOhm = 380 + (fusedVal - 0.45) * 140;
    dispForce += (forceN - dispForce) * 0.18;
    dispImp += (impOhm - dispImp) * 0.08;
    dispVib += (Math.abs(emiVal) * 100 - dispVib) * 0.12;
  }

  function drawLane(buf, lo, hi, top, color, width) {
    ctx.beginPath();
    for (let i = 0; i < buf.length; i++) {
      const x = (i / (buf.length - 1)) * W;
      const norm = clamp((buf[i] - lo) / (hi - lo), 0, 1);
      const y = top + laneH - norm * laneH * 0.82 - laneH * 0.08;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(0, laneH * i + 0.5);
      ctx.lineTo(W, laneH * i + 0.5);
      ctx.stroke();
    }
    ctx.font = '10px SFMono-Regular, Consolas, monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('Fuerza (contacto)', 8, laneH * 0 + 14);
    ctx.fillText('Bioimpedancia + fusión', 8, laneH * 1 + 14);
    ctx.fillText('Vibración / EMI', 8, laneH * 2 + 14);

    drawLane(forceBuf, -0.35, 1.1, 0, COLOR_FORCE, 1.5);
    drawLane(impBuf, 0, 1, laneH, COLOR_IMP, 1.2);
    drawLane(fusedBuf, 0, 1, laneH, COLOR_FUSED, 1.8);
    drawLane(emiBuf, -1, 1, laneH * 2, COLOR_EMI, 1.2);

    if (roForce) roForce.textContent = dispForce.toFixed(1);
    if (roImp) roImp.textContent = Math.round(clamp(dispImp, 0, 999)) + ' Ω';
    if (roVib) roVib.textContent = Math.round(clamp(dispVib, 0, 100));
  }

  let rafId = null;
  function loop() {
    sample();
    draw();
    rafId = requestAnimationFrame(loop);
  }

  window.addEventListener('resize', () => {
    resize();
    if (reduceMotion) draw();
  });

  resize();
  for (let i = 0; i < N; i++) sample();

  if (reduceMotion) {
    draw();
  } else {
    loop();
  }
}

// Validación y envío simulado del formulario de contacto.
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;
  const card = form.closest('.form-card');
  const success = document.getElementById('formSuccess');

  const validators = {
    nombre: (v) => v.trim().length >= 2,
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
    asunto: (v) => v.trim().length > 0,
    mensaje: (v) => v.trim().length >= 10,
  };

  function showError(field, message) {
    const errorEl = form.querySelector(`[data-error-for="${field}"]`);
    if (errorEl) errorEl.textContent = message;
  }

  function clearErrors() {
    form.querySelectorAll('.field-error').forEach((el) => { el.textContent = ''; });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const trap = form.querySelector('input[name="empresa_web"]');
    if (trap && trap.value) return;

    clearErrors();
    let valid = true;

    Object.keys(validators).forEach((name) => {
      const input = form.elements[name];
      if (!input) return;
      if (!validators[name](input.value)) {
        valid = false;
        showError(name, 'Revisa este campo.');
      }
    });

    const consent = form.elements['consentimiento'];
    if (consent && !consent.checked) {
      valid = false;
      showError('consentimiento', 'Necesitamos tu consentimiento para poder responderte.');
    }

    if (!valid) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalLabel = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando…';
    }

    window.setTimeout(() => {
      if (card) card.classList.add('submitted');
      if (success) success.classList.add('visible');
      form.reset();
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      }
    }, 600);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initCounters();
  initReveal();
  initNavToggle();
  initActiveNav();
  initAccordion();
  initWaveform();
  initContactForm();
});
