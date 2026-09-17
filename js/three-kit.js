// Utilidades compartidas por las escenas 3D (requiere three.js r128 global).
// Cada escena monta su propio renderer en un contenedor, se pausa cuando
// sale de pantalla y respeta "reducir movimiento" mostrando un fotograma
// fijo con un botón para reproducir.

(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function hasWebGL() {
    try {
      const c = document.createElement('canvas');
      return Boolean(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (_) {
      return false;
    }
  }

  function stage(container, opts = {}) {
    if (!window.THREE || !hasWebGL()) {
      container.classList.add('no-webgl');
      return null;
    }
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x000000, 0);
    container.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(opts.fov || 40, 1, opts.near || 0.1, opts.far || 300);
    const size = { w: 1, h: 1 };
    const listeners = [];

    let running = false;
    const resize = () => {
      const r = container.getBoundingClientRect();
      size.w = Math.max(1, Math.round(r.width));
      size.h = Math.max(1, Math.round(r.height));
      renderer.setSize(size.w, size.h, false);
      camera.aspect = size.w / size.h;
      camera.updateProjectionMatrix();
      listeners.forEach((fn) => fn(size));
      if (!running) renderer.render(scene, camera);
    };
    new ResizeObserver(resize).observe(container);

    let visible = true;
    new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }, { rootMargin: '120px' }).observe(container);

    // Puntero normalizado (-1..1) sobre el contenedor, para parallax.
    const pointer = { x: 0, y: 0 };
    container.addEventListener('pointermove', (e) => {
      const r = container.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    });
    container.addEventListener('pointerleave', () => { pointer.x = 0; pointer.y = 0; });

    function loop(tick) {
      const clock = new THREE.Clock(false);
      const frame = () => {
        requestAnimationFrame(frame);
        const dt = Math.min(clock.getDelta(), 0.05);
        if (!visible || document.hidden) return;
        tick(dt, clock.elapsedTime);
        renderer.render(scene, camera);
      };
      const start = () => {
        if (running) return;
        running = true;
        const b = container.querySelector('.vp-play');
        if (b) b.remove();
        clock.start();
        requestAnimationFrame(frame);
      };
      resize();
      if (reduce) {
        tick(0.016, 0);
        renderer.render(scene, camera);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'vp-play';
        b.textContent = '▶ Reproducir simulación';
        b.addEventListener('click', start);
        container.appendChild(b);
      } else {
        start();
      }
      return { start };
    }

    return { renderer, scene, camera, size, pointer, loop, onResize: (fn) => listeners.push(fn), reduce };
  }

  // Entorno de estudio para reflejos metálicos: una sala oscura con tres
  // paneles de luz, prefiltrada con PMREM.
  function studioEnv(renderer, scene) {
    const pm = new THREE.PMREMGenerator(renderer);
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(
      new THREE.BoxGeometry(40, 40, 40),
      new THREE.MeshBasicMaterial({ color: 0x0a1120, side: THREE.BackSide })
    ));
    const panel = (w, h, color, x, y, z) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    panel(16, 5, 0xffffff, 0, 15, 2);
    panel(6, 14, 0x4d8dff, -17, 4, 6);
    panel(6, 14, 0xd6e4ff, 17, 5, -4);
    scene.environment = pm.fromScene(env, 0.04).texture;
    pm.dispose();
  }

  let glowTex = null;
  function glowTexture() {
    if (glowTex) return glowTex;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.22, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c);
    return glowTex;
  }

  function glowSprite(color, size) {
    const mat = new THREE.SpriteMaterial({
      map: glowTexture(),
      color,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const s = new THREE.Sprite(mat);
    s.scale.set(size, size, 1);
    return s;
  }

  // Ruido de valor determinista y fBm, suficiente para relieves.
  function hash(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, oct = 5) {
    let s = 0, a = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); f *= 2.02; a *= 0.5; }
    return s;
  }
  function ridged(x, y, oct = 5) {
    let s = 0, a = 0.5, f = 1;
    for (let i = 0; i < oct; i++) {
      const n = 1 - Math.abs(vnoise(x * f, y * f) * 2 - 1);
      s += a * n * n;
      f *= 2.03;
      a *= 0.5;
    }
    return s;
  }

  // Generador pseudoaleatorio con semilla, para escenas reproducibles.
  function rng(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  window.AKRA3D = { stage, studioEnv, glowTexture, glowSprite, fbm, ridged, rng, cssVar, reduce };
})();
