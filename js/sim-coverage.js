// Simulación de cobertura: mapa topográfico generado, un repetidor que se
// arrastra y línea de vista calculada celda a celda contra el relieve.

(() => {
  const canvas = document.getElementById('covCanvas');
  const K = window.AKRA3D;
  if (!canvas || !K) return;

  const ui = {
    mast: document.getElementById('covMast'),
    mastOut: document.getElementById('covMastOut'),
    linked: document.getElementById('covLinked'),
    area: document.getElementById('covArea'),
    backhaul: document.getElementById('covBackhaul'),
  };

  // Terreno: 180 × 110 celdas de 50 m (9 × 5,5 km)
  const GW = 180, GH = 110, CELL = 50;
  const RANGE = 7000; // m
  const elev = new Float32Array(GW * GH);
  let hMin = Infinity, hMax = -Infinity;
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const nx = x / GW, ny = y / GH;
      const ridge = K.ridged(nx * 3.2 + 1.7, ny * 2.1 + 4.2, 5);
      const hills = K.fbm(nx * 6 + 9, ny * 4 + 3, 4);
      const massif = Math.exp(-(((nx - 0.55) / 0.35) ** 2) - (((ny - 0.4) / 0.45) ** 2));
      const h = 620 + 950 * ridge * (0.35 + 0.9 * massif) + 160 * hills;
      elev[y * GW + x] = h;
      if (h < hMin) hMin = h;
      if (h > hMax) hMax = h;
    }
  }
  const H = (x, y) => {
    const xi = Math.max(0, Math.min(GW - 1, Math.round(x)));
    const yi = Math.max(0, Math.min(GH - 1, Math.round(y)));
    return elev[yi * GW + xi];
  };

  // Relieve sombreado + curvas de nivel, precalculado una vez.
  const relief = document.createElement('canvas');
  relief.width = GW * 2;
  relief.height = GH * 2;
  (() => {
    const g = relief.getContext('2d');
    const img = g.createImageData(GW * 2, GH * 2);
    const d = img.data;
    for (let py = 0; py < GH * 2; py++) {
      for (let px = 0; px < GW * 2; px++) {
        const x = px / 2, y = py / 2;
        const h = H(x, y);
        const dx = H(x + 1, y) - H(x - 1, y);
        const dy = H(x, y + 1) - H(x, y - 1);
        const shade = Math.max(0, Math.min(1, 0.55 + (-dx * 0.7 - dy * 0.7) / 180));
        const t = (h - hMin) / (hMax - hMin);
        let r = 8 + 20 * shade + 10 * t;
        let gg = 13 + 30 * shade + 14 * t;
        let b = 22 + 48 * shade + 22 * t;
        const step = 50;
        const band = Math.floor(h / step);
        const edge = Math.floor(H(x + 0.5, y) / step) !== band || Math.floor(H(x, y + 0.5) / step) !== band;
        if (edge) {
          const major = band % 5 === 0;
          r += major ? 22 : 10;
          gg += major ? 50 : 24;
          b += major ? 95 : 48;
        }
        const i = (py * GW * 2 + px) * 4;
        d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  })();

  // Puntos fijos: estación base y sensores en valles y laderas
  const rand = K.rng(21);
  const gateway = { x: 14, y: 96 };
  const sensors = [];
  let guard = 0;
  while (sensors.length < 10 && guard++ < 2000) {
    const x = 8 + rand() * (GW - 16);
    const y = 8 + rand() * (GH - 16);
    if (Math.hypot(x - gateway.x, y - gateway.y) < 18) continue;
    if (sensors.some((s) => Math.hypot(s.x - x, s.y - y) < 22)) continue;
    if (H(x, y) > hMin + (hMax - hMin) * 0.55) continue;
    sensors.push({ x, y, id: `S-${String(sensors.length + 1).padStart(2, '0')}`, ok: false });
  }

  // Repetidor inicial: el punto que más sensores enlaza y llega a la
  // estación base, como haría un estudio de emplazamiento.
  const repeater = { x: 90, y: 50 };
  (() => {
    const mast = Number(ui.mast.value) || 15;
    let best = -Infinity;
    for (let y = 6; y < GH - 6; y += 6) {
      for (let x = 24; x < GW - 6; x += 6) {
        let score = 0;
        sensors.forEach((s) => { if (strength(los(x, y, mast, s.x, s.y, 2)) > 0.12) score += 10; });
        const bh = los(x, y, mast, gateway.x, gateway.y, 12);
        if (bh.excess <= 0 && bh.dist <= 9000) score += 25;
        score += H(x, y) / 1000;
        if (score > best) { best = score; repeater.x = x; repeater.y = y; }
      }
    }
  })();

  function los(ax, ay, ahAbove, bx, by, bhAbove) {
    const ha = H(ax, ay) + ahAbove;
    const hb = H(bx, by) + bhAbove;
    const dist = Math.hypot(bx - ax, by - ay);
    const n = Math.max(2, Math.min(90, Math.ceil(dist)));
    let excess = -Infinity;
    for (let s = 1; s < n; s++) {
      const p = s / n;
      const e = H(ax + (bx - ax) * p, ay + (by - ay) * p) - (ha + (hb - ha) * p);
      if (e > excess) excess = e;
    }
    return { dist: dist * CELL, excess };
  }

  function strength(link) {
    if (link.dist > RANGE) return 0;
    const fall = 1 - link.dist / RANGE;
    if (link.excess <= 0) return 0.35 + 0.65 * fall;
    if (link.excess < 12) return (0.35 + 0.65 * fall) * 0.4;
    return 0;
  }

  // Cobertura a media resolución
  const CW = 90, CH = 55;
  const cov = document.createElement('canvas');
  cov.width = CW;
  cov.height = CH;
  const covCtx = cov.getContext('2d');
  const covImg = covCtx.createImageData(CW, CH);
  let backhaulOk = false;

  function compute() {
    const mast = Number(ui.mast.value);
    const d = covImg.data;
    let covered = 0;
    for (let cy = 0; cy < CH; cy++) {
      for (let cx = 0; cx < CW; cx++) {
        const s = strength(los(repeater.x, repeater.y, mast, cx * 2 + 1, cy * 2 + 1, 2));
        const i = (cy * CW + cx) * 4;
        if (s > 0) {
          covered += 1;
          d[i] = 61; d[i + 1] = 139; d[i + 2] = 255;
          d[i + 3] = Math.round(40 + s * 120);
        } else {
          d[i] = 4; d[i + 1] = 7; d[i + 2] = 12;
          d[i + 3] = 110;
        }
      }
    }
    covCtx.putImageData(covImg, 0, 0);
    sensors.forEach((s) => { s.ok = strength(los(repeater.x, repeater.y, mast, s.x, s.y, 2)) > 0.12; });
    const bh = los(repeater.x, repeater.y, mast, gateway.x, gateway.y, 12);
    backhaulOk = bh.excess <= 0 && bh.dist <= 9000;

    const linked = sensors.filter((s) => s.ok).length;
    ui.linked.textContent = `${linked} / ${sensors.length}`;
    ui.linked.className = `readout-val ${linked === sensors.length ? 'is-ok' : linked >= sensors.length / 2 ? 'is-accent' : 'is-warn'}`;
    const km2 = (covered / (CW * CH)) * (GW * CELL / 1000) * (GH * CELL / 1000);
    ui.area.textContent = `${km2.toFixed(1).replace('.', ',')} km²`;
    ui.backhaul.textContent = backhaulOk ? `Directo · ${(bh.dist / 1000).toFixed(1).replace('.', ',')} km` : 'Obstruido por el relieve';
    ui.backhaul.className = `readout-val ${backhaulOk ? 'is-ok' : 'is-warn'}`;
    ui.mastOut.textContent = `${mast} m`;
  }

  // Dibujo
  const col = {
    accent: K.cssVar('--accent', '#3d8bff'),
    bright: K.cssVar('--accent-bright', '#7db4ff'),
    ink: K.cssVar('--ink', '#e8eef6'),
    warn: K.cssVar('--warn', '#f0a63a'),
    ok: K.cssVar('--ok', '#3ecf8e'),
    muted: K.cssVar('--muted', '#97a4b8'),
  };
  let pulse = 0;

  function draw() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    const W = Math.max(1, Math.round(r.width));
    const Hc = Math.max(1, Math.round(r.height));
    if (canvas.width !== W * dpr || canvas.height !== Hc * dpr) {
      canvas.width = W * dpr;
      canvas.height = Hc * dpr;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(relief, 0, 0, W, Hc);
    ctx.drawImage(cov, 0, 0, W, Hc);

    const sx = W / GW, sy = Hc / GH;
    const rx = repeater.x * sx, ry = repeater.y * sy;

    // Enlaces
    ctx.lineWidth = 1;
    sensors.forEach((s) => {
      if (!s.ok) return;
      ctx.strokeStyle = 'rgba(125,180,255,0.55)';
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(s.x * sx, s.y * sy);
      ctx.lineTo(rx, ry);
      ctx.stroke();
    });
    ctx.setLineDash(backhaulOk ? [] : [5, 5]);
    ctx.strokeStyle = backhaulOk ? col.bright : col.warn;
    ctx.lineWidth = backhaulOk ? 1.8 : 1.2;
    ctx.beginPath();
    ctx.moveTo(gateway.x * sx, gateway.y * sy);
    ctx.lineTo(rx, ry);
    ctx.stroke();
    ctx.setLineDash([]);

    // Sensores
    ctx.font = '10px "IBM Plex Mono", Consolas, monospace';
    sensors.forEach((s) => {
      const x = s.x * sx, y = s.y * sy;
      ctx.fillStyle = s.ok ? col.ink : col.warn;
      ctx.fillRect(x - 3.5, y - 3.5, 7, 7);
      if (!s.ok) {
        ctx.strokeStyle = col.warn;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = s.ok ? col.muted : col.warn;
      ctx.fillText(s.id, x + 8, y - 6);
    });

    // Estación base
    const gx = gateway.x * sx, gy = gateway.y * sy;
    ctx.fillStyle = col.bright;
    ctx.fillRect(gx - 6, gy - 6, 12, 12);
    ctx.fillStyle = col.ink;
    ctx.fillText('ESTACIÓN BASE', gx + 10, gy + 4);

    // Repetidor
    const p = (pulse % 1);
    ctx.strokeStyle = `rgba(125,180,255,${0.6 * (1 - p)})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(rx, ry, 10 + p * 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = col.accent;
    ctx.beginPath();
    ctx.arc(rx, ry, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(rx - 3.5, ry + 4);
    ctx.lineTo(rx, ry - 5);
    ctx.lineTo(rx + 3.5, ry + 4);
    ctx.stroke();
    ctx.fillStyle = col.ink;
    ctx.fillText(`REPETIDOR · ${ui.mast.value} m`, rx + 14, ry + 4);
  }

  // Interacción: arrastrar o tocar para mover el repetidor
  let dragging = false;
  let dirty = true;
  const moveTo = (e) => {
    const r = canvas.getBoundingClientRect();
    repeater.x = Math.max(2, Math.min(GW - 3, ((e.clientX - r.left) / r.width) * GW));
    repeater.y = Math.max(2, Math.min(GH - 3, ((e.clientY - r.top) / r.height) * GH));
    dirty = true;
  };
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    moveTo(e);
  });
  canvas.addEventListener('pointermove', (e) => { if (dragging) moveTo(e); });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  ui.mast.addEventListener('input', () => { dirty = true; });
  window.addEventListener('resize', () => { dirty = true; });

  // Teclado: flechas para mover el repetidor
  canvas.tabIndex = 0;
  canvas.addEventListener('keydown', (e) => {
    const stepSize = e.shiftKey ? 8 : 2;
    const moves = { ArrowLeft: [-stepSize, 0], ArrowRight: [stepSize, 0], ArrowUp: [0, -stepSize], ArrowDown: [0, stepSize] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    repeater.x = Math.max(2, Math.min(GW - 3, repeater.x + m[0]));
    repeater.y = Math.max(2, Math.min(GH - 3, repeater.y + m[1]));
    dirty = true;
  });

  let last = performance.now();
  const frame = (now) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!K.reduce) pulse += dt * 0.6;
    if (dirty) { compute(); dirty = false; }
    draw();
  };
  compute();
  draw();
  requestAnimationFrame(frame);
})();
