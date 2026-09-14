// Solicitud de presupuesto de impresión 3D.
// Los modelos STL y OBJ se analizan en el navegador (medidas, volumen,
// superficie, vista 3D) antes de enviarse; nada sale del equipo del cliente
// hasta que pulsa "Enviar solicitud".

(() => {
  const form = document.getElementById('quoteForm');
  if (!form) return;

  const MAX_FILES = 5;
  const MAX_TOTAL = 15 * 1024 * 1024;
  const ALLOWED = ['stl', 'obj', '3mf', 'step', 'stp', 'iges', 'igs', 'dxf', 'zip', 'pdf', 'png', 'jpg', 'jpeg'];
  const ANALYZABLE = ['stl', 'obj'];

  // Tecnologías: densidad efectiva del material, volumen de impresión (mm)
  // y un modelo muy simple de tiempo de máquina. Todo orientativo.
  const TECH = {
    fdm: { label: 'FDM', build: [300, 300, 400], shell: 1.2, infill: 0.25, rate: 14, perLayer: 0 },
    sla: { label: 'SLA', build: [218, 123, 260], shell: 0, infill: 1, rate: 0, perLayer: 7.5, layer: 0.05 },
    sls: { label: 'SLS', build: [165, 165, 300], shell: 0, infill: 1, rate: 0, perLayer: 11, layer: 0.1 },
  };
  const MATERIALS = {
    fdm: [['PLA', 1.24], ['PETG', 1.27], ['ASA', 1.07], ['TPU 95A', 1.21], ['PA-CF', 1.18]],
    sla: [['Resina estándar', 1.18], ['Resina técnica (tough)', 1.16], ['Resina biocompatible', 1.2], ['Resina transparente', 1.18]],
    sls: [['PA12', 1.01], ['PA11', 1.03], ['PA12 con fibra de vidrio', 1.3]],
    auto: [['Lo decidís vosotros', 1.2]],
  };
  const UNITS = { mm: 1, cm: 10, in: 25.4 };

  const $ = (id) => document.getElementById(id);
  const input = $('qFiles');
  const zone = $('dropzone');
  const list = $('fileList');
  const techInputs = form.querySelectorAll('input[name="tecnologia"]');
  const materialSel = $('qMaterial');
  const unitSel = $('qUnidades');
  const qtyInput = $('qCantidad');
  const status = $('quoteStatus');
  const summaryField = $('qAnalisis');

  const out = {
    state: $('anState'),
    name: $('anName'),
    dims: $('anDims'),
    vol: $('anVol'),
    area: $('anArea'),
    tris: $('anTris'),
    mass: $('anMass'),
    time: $('anTime'),
    fit: $('anFit'),
    note: $('anNote'),
    empty: $('viewerEmpty'),
  };

  let files = [];            // { file, ext, mesh?, stats?, error? }
  let selected = -1;

  // ------------------------------------------------------------------ utils
  const ext = (name) => (name.split('.').pop() || '').toLowerCase();
  const fmtSize = (b) => (b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
  const fmt = (n, d = 1) => n.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
  const escapeHtml = (s) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  const currentTech = () => {
    const el = form.querySelector('input[name="tecnologia"]:checked');
    return el ? el.value : 'auto';
  };

  // ---------------------------------------------------------------- parsing
  function parseSTL(buffer) {
    const dv = new DataView(buffer);
    const isBinary = buffer.byteLength >= 84 && 84 + dv.getUint32(80, true) * 50 === buffer.byteLength;
    if (isBinary) {
      const n = dv.getUint32(80, true);
      const pos = new Float32Array(n * 9);
      let o = 84;
      for (let i = 0; i < n; i++) {
        o += 12; // normal
        for (let k = 0; k < 9; k++) { pos[i * 9 + k] = dv.getFloat32(o, true); o += 4; }
        o += 2;
      }
      return pos;
    }
    const text = new TextDecoder().decode(buffer);
    const re = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g;
    const v = [];
    let m;
    while ((m = re.exec(text))) v.push(+m[1], +m[2], +m[3]);
    if (!v.length) throw new Error('El STL no contiene triángulos legibles.');
    return new Float32Array(v.length - (v.length % 9)).map((_, i) => v[i]);
  }

  function parseOBJ(buffer) {
    const text = new TextDecoder().decode(buffer);
    const verts = [];
    const tris = [];
    text.split(/\r?\n/).forEach((line) => {
      if (line.startsWith('v ')) {
        const p = line.trim().split(/\s+/);
        verts.push([+p[1], +p[2], +p[3]]);
      } else if (line.startsWith('f ')) {
        const idx = line.trim().split(/\s+/).slice(1).map((tok) => {
          const i = parseInt(tok.split('/')[0], 10);
          return i < 0 ? verts.length + i : i - 1;
        });
        for (let k = 1; k < idx.length - 1; k++) tris.push(idx[0], idx[k], idx[k + 1]);
      }
    });
    if (!tris.length) throw new Error('El OBJ no contiene caras.');
    const pos = new Float32Array(tris.length * 3);
    tris.forEach((vi, i) => {
      const p = verts[vi] || [0, 0, 0];
      pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2];
    });
    // OBJ suele venir con Y hacia arriba: lo pasamos a Z arriba como un STL.
    for (let i = 0; i < pos.length; i += 3) {
      const y = pos[i + 1];
      pos[i + 1] = -pos[i + 2];
      pos[i + 2] = y;
    }
    return pos;
  }

  function measure(pos) {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let vol = 0, area = 0;
    for (let i = 0; i < pos.length; i += 9) {
      const ax = pos[i], ay = pos[i + 1], az = pos[i + 2];
      const bx = pos[i + 3], by = pos[i + 4], bz = pos[i + 5];
      const cx = pos[i + 6], cy = pos[i + 7], cz = pos[i + 8];
      minX = Math.min(minX, ax, bx, cx); maxX = Math.max(maxX, ax, bx, cx);
      minY = Math.min(minY, ay, by, cy); maxY = Math.max(maxY, ay, by, cy);
      minZ = Math.min(minZ, az, bz, cz); maxZ = Math.max(maxZ, az, bz, cz);
      vol += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = cx - ax, vy = cy - ay, vz = cz - az;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      area += Math.sqrt(nx * nx + ny * ny + nz * nz) / 2;
    }
    return {
      size: [maxX - minX, maxY - minY, maxZ - minZ],
      center: [(maxX + minX) / 2, (maxY + minY) / 2, (maxZ + minZ) / 2],
      volume: Math.abs(vol),
      area,
      triangles: pos.length / 9,
    };
  }

  // -------------------------------------------------------------- estimates
  function estimate(stats) {
    const u = UNITS[unitSel.value] || 1;
    const size = stats.size.map((d) => d * u);
    const volMm3 = stats.volume * u * u * u;
    const areaMm2 = stats.area * u * u;
    const techKey = currentTech();
    const tech = TECH[techKey] || TECH.fdm;
    const matList = MATERIALS[techKey] || MATERIALS.auto;
    const mat = matList.find((m) => m[0] === materialSel.value) || matList[0];

    // Fracción de material realmente depositado.
    let fraction = 1;
    if (tech.shell && volMm3 > 0) {
      const shellVol = Math.min(volMm3, areaMm2 * tech.shell);
      fraction = (shellVol + (volMm3 - shellVol) * tech.infill) / volMm3;
    }
    const massG = (volMm3 / 1000) * mat[1] * fraction;

    let hours;
    if (tech.rate) hours = (volMm3 * fraction / 1000) / tech.rate + 0.25;
    else hours = (size[2] / tech.layer) * tech.perLayer / 3600 + 0.3;

    const sorted = [...size].sort((a, b) => b - a);
    const box = [...tech.build].sort((a, b) => b - a);
    const fits = sorted.every((d, i) => d <= box[i]);

    return { size, volMm3, areaMm2, massG, hours, fits, tech, techKey, mat: mat[0], box: tech.build };
  }

  function renderStats() {
    const f = files[selected];
    const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
    const dash = '—';
    if (!f || !f.stats) {
      out.name.textContent = f ? f.file.name : 'Ningún modelo';
      out.state.textContent = f ? (f.error ? 'sin análisis' : 'formato CAD') : 'en espera';
      [out.dims, out.vol, out.area, out.tris, out.mass, out.time, out.fit].forEach((el) => { el.textContent = dash; });
      out.note.innerHTML = f
        ? (f.error
          ? `<span class="warn">${escapeHtml(f.error)}</span> Lo revisaremos a mano al recibirlo.`
          : `Los archivos ${f.ext.toUpperCase()} no se pueden analizar en el navegador. Los revisamos nosotros y te enviamos medidas y presupuesto por correo.`)
        : 'Sube un STL u OBJ para ver sus medidas, volumen y una vista previa. STEP, 3MF, IGES y planos también se aceptan: los analizamos nosotros.';
      out.empty.hidden = false;
      return;
    }
    const e = estimate(f.stats);
    out.name.textContent = f.file.name;
    out.state.textContent = 'analizado';
    out.dims.textContent = `${fmt(e.size[0])} × ${fmt(e.size[1])} × ${fmt(e.size[2])} mm`;
    out.vol.textContent = `${fmt(e.volMm3 / 1000, 2)} cm³`;
    out.area.textContent = `${fmt(e.areaMm2 / 100, 1)} cm²`;
    out.tris.textContent = f.stats.triangles.toLocaleString('es-ES');
    if (e.techKey === 'auto') {
      out.mass.textContent = dash;
      out.time.textContent = dash;
      out.fit.textContent = 'Elige tecnología';
    } else {
      out.mass.textContent = `≈ ${fmt(e.massG * qty, e.massG * qty < 10 ? 1 : 0)} g`;
      out.time.textContent = `≈ ${fmt(e.hours * qty, 1)} h`;
      out.fit.textContent = e.fits ? `Cabe (${e.box.join(' × ')} mm)` : 'Se imprimirá por partes';
    }
    const notes = [];
    const maxDim = Math.max(...e.size);
    if (maxDim < 3) notes.push('<span class="warn">La pieza mide menos de 3 mm.</span> ¿Está exportada en metros o centímetros? Cambia las unidades arriba.');
    if (maxDim > 1500) notes.push('<span class="warn">La pieza supera 1,5 m.</span> Revisa las unidades de exportación.');
    if (!e.fits && e.techKey !== 'auto') notes.push(`<span class="warn">No cabe entera en ${e.tech.label}.</span> Te propondremos dividirla o cambiar de tecnología.`);
    notes.push(qty > 1 ? `Masa y tiempo calculados para ${qty} unidades. ` : '');
    notes.push('Valores orientativos: el presupuesto firme, con orientación, soportes y acabado, te llega por correo.');
    out.note.innerHTML = notes.join(' ');
    out.empty.hidden = true;
  }

  function buildSummary() {
    const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
    const rows = files.map((f) => {
      if (!f.stats) return { archivo: f.file.name, analizado: false };
      const e = estimate(f.stats);
      return {
        archivo: f.file.name,
        medidas_mm: e.size.map((d) => +d.toFixed(2)),
        volumen_cm3: +(e.volMm3 / 1000).toFixed(3),
        superficie_cm2: +(e.areaMm2 / 100).toFixed(2),
        triangulos: f.stats.triangles,
        masa_g_por_unidad: e.techKey === 'auto' ? null : +e.massG.toFixed(1),
        horas_por_unidad: e.techKey === 'auto' ? null : +e.hours.toFixed(2),
        cabe_en_maquina: e.techKey === 'auto' ? null : e.fits,
      };
    });
    return JSON.stringify({ unidades_archivo: unitSel.value, cantidad: qty, modelos: rows });
  }

  // ------------------------------------------------------------ file list
  function renderList() {
    list.innerHTML = '';
    files.forEach((f, i) => {
      const row = document.createElement('div');
      row.className = 'file-chip';
      const name = document.createElement('button');
      name.type = 'button';
      name.className = 'fname';
      name.textContent = (i === selected ? '● ' : '') + f.file.name;
      name.title = 'Ver análisis de este archivo';
      name.addEventListener('click', () => select(i));
      const size = document.createElement('span');
      size.className = 'fsize';
      size.textContent = fmtSize(f.file.size);
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.setAttribute('aria-label', `Quitar ${f.file.name}`);
      rm.textContent = '×';
      rm.addEventListener('click', () => removeFile(i));
      row.append(name, size, rm);
      list.appendChild(row);
    });
    setError('archivos', '');
  }

  function removeFile(i) {
    files.splice(i, 1);
    if (selected >= files.length) selected = files.length - 1;
    renderList();
    select(selected);
  }

  function select(i) {
    selected = i;
    renderList();
    const f = files[i];
    viewer.setMesh(f && f.mesh ? f.mesh : null, f && f.stats ? f.stats : null);
    renderStats();
  }

  async function addFiles(fileList) {
    const incoming = Array.from(fileList);
    for (const file of incoming) {
      const e = ext(file.name);
      if (!ALLOWED.includes(e)) {
        setError('archivos', `«${file.name}» no es un formato admitido. Usa STL, OBJ, 3MF, STEP, IGES, DXF, PDF, imagen o ZIP.`);
        continue;
      }
      if (files.length >= MAX_FILES) {
        setError('archivos', `Máximo ${MAX_FILES} archivos por solicitud. Agrúpalos en un ZIP o pega un enlace de descarga.`);
        break;
      }
      const total = files.reduce((s, f) => s + f.file.size, 0) + file.size;
      if (total > MAX_TOTAL) {
        setError('archivos', `Entre todos superan ${fmtSize(MAX_TOTAL)}. Para archivos grandes pega un enlace (WeTransfer, Drive, Dropbox) en el campo de abajo.`);
        continue;
      }
      const entry = { file, ext: e };
      files.push(entry);
      if (ANALYZABLE.includes(e)) {
        try {
          const buf = await file.arrayBuffer();
          entry.mesh = e === 'stl' ? parseSTL(buf) : parseOBJ(buf);
          entry.stats = measure(entry.mesh);
        } catch (err) {
          entry.error = err.message || 'No hemos podido leer el modelo.';
        }
      }
    }
    select(files.length - 1);
  }

  function setError(name, msg) {
    const el = form.querySelector(`[data-error-for="${name}"]`);
    if (el) el.textContent = msg || '';
  }

  // ----------------------------------------------------------- materials
  function fillMaterials() {
    const list = MATERIALS[currentTech()] || MATERIALS.auto;
    const prev = materialSel.value;
    materialSel.innerHTML = '';
    list.forEach(([name]) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      materialSel.appendChild(opt);
    });
    if (list.some(([n]) => n === prev)) materialSel.value = prev;
    materialSel.disabled = currentTech() === 'auto';
  }

  // --------------------------------------------------------------- viewer
  // Rasterizador por software con z-buffer a baja resolución: no depende de
  // ninguna librería y aguanta mallas de cientos de miles de triángulos.
  const viewer = (() => {
    const canvas = document.getElementById('viewerCanvas');
    const ctx = canvas.getContext('2d');
    const buf = document.createElement('canvas');
    const bctx = buf.getContext('2d');
    let mesh = null, stats = null;
    let yaw = -0.7, pitch = 0.5;
    let spin = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = null;
    let dragging = false, lastX = 0, lastY = 0;
    let base = [233, 228, 216];

    function readColors() {
      const hex = (getComputedStyle(document.documentElement).getPropertyValue('--on-dark').trim() || '#f3f1e9').replace('#', '');
      base = [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    }

    function render() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const CW = Math.max(1, Math.round(rect.width * dpr));
      const CH = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== CW || canvas.height !== CH) { canvas.width = CW; canvas.height = CH; }
      ctx.clearRect(0, 0, CW, CH);
      if (!mesh) return;

      const scaleDown = Math.min(1, 460 / CW);
      const W = Math.max(1, Math.round(CW * scaleDown));
      const H = Math.max(1, Math.round(CH * scaleDown));
      if (buf.width !== W || buf.height !== H) { buf.width = W; buf.height = H; }
      const img = bctx.createImageData(W, H);
      const px = new Uint32Array(img.data.buffer);
      const depth = new Float32Array(W * H).fill(Infinity);

      const [cx, cy, cz] = stats.center;
      const radius = Math.hypot(...stats.size) / 2 || 1;
      const s = (Math.min(W, H) * 0.42) / radius;
      const cyw = Math.cos(yaw), syw = Math.sin(yaw);
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      let lx = -0.45, ly = -0.75, lz = 0.5;
      const ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll;

      const n = mesh.length / 9;
      const P = new Float32Array(9);
      for (let t = 0; t < n; t++) {
        const o = t * 9;
        for (let k = 0; k < 3; k++) {
          const x = mesh[o + k * 3] - cx, y = mesh[o + k * 3 + 1] - cy, z = mesh[o + k * 3 + 2] - cz;
          const x1 = x * cyw - y * syw;
          const y1 = x * syw + y * cyw;
          const y2 = y1 * cp - z * sp;
          const z2 = y1 * sp + z * cp;
          P[k * 3] = W / 2 + x1 * s;
          P[k * 3 + 1] = H / 2 - z2 * s;
          P[k * 3 + 2] = y2;
        }
        // Normal en espacio de vista (x, depth, -screenY)
        const ax = P[3] - P[0], ay = P[5] - P[2], az = -(P[4] - P[1]);
        const bx = P[6] - P[0], by = P[8] - P[2], bz = -(P[7] - P[1]);
        let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;
        const lum = 0.2 + 0.8 * Math.abs(nx * lx + ny * ly + nz * lz);
        const r = Math.min(255, base[0] * lum + 22 * (1 - lum)) | 0;
        const g = Math.min(255, base[1] * lum + 12 * (1 - lum)) | 0;
        const b = Math.min(255, base[2] * lum + 8 * (1 - lum)) | 0;
        const color = (255 << 24) | (b << 16) | (g << 8) | r;

        const x0 = P[0], y0 = P[1], z0 = P[2];
        const x1 = P[3], y1 = P[4], z1 = P[5];
        const x2 = P[6], y2 = P[7], z2 = P[8];
        const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
        if (area === 0) continue;
        const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
        const maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
        const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
        const maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
        if (minX > maxX || minY > maxY) continue;
        if (maxX === minX && maxY === minY) {
          const i = minY * W + minX;
          const zz = (z0 + z1 + z2) / 3;
          if (zz < depth[i]) { depth[i] = zz; px[i] = color; }
          continue;
        }
        const inv = 1 / area;
        for (let yy = minY; yy <= maxY; yy++) {
          const py = yy + 0.5;
          for (let xx = minX; xx <= maxX; xx++) {
            const pxx = xx + 0.5;
            const w0 = ((x1 - pxx) * (y2 - py) - (x2 - pxx) * (y1 - py)) * inv;
            const w1 = ((x2 - pxx) * (y0 - py) - (x0 - pxx) * (y2 - py)) * inv;
            const w2 = 1 - w0 - w1;
            if (w0 < 0 || w1 < 0 || w2 < 0) continue;
            const zz = w0 * z0 + w1 * z1 + w2 * z2;
            const i = yy * W + xx;
            if (zz < depth[i]) { depth[i] = zz; px[i] = color; }
          }
        }
      }
      bctx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(buf, 0, 0, CW, CH);
    }

    function loop() {
      const t0 = performance.now();
      yaw += 0.008;
      render();
      if (performance.now() - t0 > 60) spin = false; // malla muy pesada: sin giro automático
      raf = spin && mesh ? requestAnimationFrame(loop) : null;
    }

    function start() {
      cancelAnimationFrame(raf);
      if (spin && mesh) raf = requestAnimationFrame(loop);
      else render();
    }

    canvas.addEventListener('pointerdown', (e) => {
      if (!mesh) return;
      dragging = true; spin = false;
      lastX = e.clientX; lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      yaw += (e.clientX - lastX) * 0.01;
      pitch = Math.max(-1.5, Math.min(1.5, pitch + (e.clientY - lastY) * 0.01));
      lastX = e.clientX; lastY = e.clientY;
      render();
    });
    canvas.addEventListener('pointerup', () => { dragging = false; });
    window.addEventListener('resize', () => { if (!raf) render(); });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readColors(); render(); });

    readColors();
    return {
      setMesh(m, st) {
        mesh = m; stats = st;
        yaw = -0.7; pitch = 0.5;
        start();
      },
    };
  })();

  // --------------------------------------------------------------- events
  input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('is-over'); }));
  zone.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });

  techInputs.forEach((el) => el.addEventListener('change', () => { fillMaterials(); renderStats(); }));
  materialSel.addEventListener('change', renderStats);
  unitSel.addEventListener('change', renderStats);
  qtyInput.addEventListener('input', renderStats);

  fillMaterials();
  renderStats();

  // --------------------------------------------------------------- submit
  const started = Date.now();
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (form.elements.empresa_web.value) return;

    let valid = true;
    const need = (name, ok, msg) => { setError(name, ok ? '' : msg); if (!ok) valid = false; };
    const link = form.elements.enlace.value.trim();
    need('archivos', files.length > 0 || /^https?:\/\//i.test(link), 'Sube al menos un archivo o pega un enlace de descarga.');
    need('nombre', form.elements.nombre.value.trim().length >= 2, 'Escribe tu nombre.');
    need('email', EMAIL_RE.test(form.elements.email.value.trim()), 'Revisa el correo: ahí te enviaremos el presupuesto.');
    need('cantidad', (parseInt(qtyInput.value, 10) || 0) >= 1, 'Indica cuántas unidades necesitas.');
    need('consentimiento', form.elements.consentimiento.checked, 'Necesitamos tu consentimiento para enviarte el presupuesto.');
    if (!valid) {
      const firstErr = form.querySelector('.field-error:not(:empty)');
      if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    summaryField.value = buildSummary();
    const data = new FormData(form);
    data.delete('archivos_input');
    files.forEach((f) => data.append('archivos', f.file, f.file.name));
    data.append('elapsed', String(Date.now() - started));

    const btn = form.querySelector('button[type="submit"]');
    const label = btn.textContent;
    btn.disabled = true;

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/presupuesto');
    xhr.upload.addEventListener('progress', (ev) => {
      if (ev.lengthComputable) btn.textContent = `Subiendo ${Math.round((ev.loaded / ev.total) * 100)} %`;
    });
    xhr.addEventListener('load', () => {
      let body = {};
      try { body = JSON.parse(xhr.responseText); } catch (_) { /* respuesta no JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) {
        status.className = 'form-status is-ok';
        status.setAttribute('role', 'status');
        status.innerHTML = `Solicitud recibida${body.ref ? ` con referencia <strong class="mono">${escapeHtml(body.ref)}</strong>` : ''}. Te enviaremos el presupuesto a <strong>${escapeHtml(form.elements.email.value.trim())}</strong> en un máximo de 24 horas laborables.`;
        form.reset();
        files = [];
        selected = -1;
        renderList();
        select(-1);
        fillMaterials();
      } else {
        fail(body.error || `El servidor ha respondido ${xhr.status}.`);
      }
      done();
    });
    xhr.addEventListener('error', () => { fail('No hay conexión con el servidor.'); done(); });
    xhr.send(data);

    function done() { btn.disabled = false; btn.textContent = label; }
    function fail(msg) {
      status.className = 'form-status is-error';
      status.setAttribute('role', 'alert');
      status.innerHTML = `No se ha podido enviar la solicitud: ${escapeHtml(msg)} Mientras lo resolvemos, puedes mandar tus archivos a <a href="mailto:presupuestos@technelatros.es">presupuestos@technelatros.es</a>.`;
    }
  });
})();
