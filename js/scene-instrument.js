// Laboratorio quirúrgico: un instrumento sensorizado sobre tejido con un vaso
// debajo. Se guía con el ratón, el dedo o el teclado; al mantener pulsado
// presiona el tejido. Con el electrobisturí activo deja marca al cortar, la
// bioimpedancia se llena de ruido y la fusión se apoya en el sensor de fuerza.
// Simulación ilustrativa: no son datos clínicos.

(() => {
  const K = window.AKRA3D;
  const view = document.getElementById('labScene');
  const traceCanvas = document.getElementById('labTrace');
  if (!view || !traceCanvas || !K) return;

  const $ = (id) => document.getElementById(id);
  const ui = {
    cautery: $('labCautery'),
    fusion: $('labFusion'),
    pressure: $('labPressure'),
    pressureOut: $('labPressureOut'),
    reset: $('labReset'),
    force: $('labForce'),
    imp: $('labImp'),
    trust: $('labTrust'),
    emi: $('labEmi'),
    state: $('labState'),
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const BOUNDS = { x: 6.2, z: 3.9 };

  // ------------------------------------------------------------ simulación
  const S = {
    t: 0, cautery: false, fusion: true, pressure: 0.6,
    press: 0, contact: 0, emi: 0, burst: 0, pulse: 0, prox: 0,
    force: 0, zRaw: 440, zOut: 440, zShown: 440, trust: 1,
    tip: { x: 0, y: 0.2, z: 0 },
  };
  // Control del usuario: al moverse sobre el visor toma el mando; tras unos
  // segundos sin tocar nada, el instrumento vuelve a su recorrido automático.
  const ctrl = { manual: false, pressing: false, x: 0, z: 0, lastInput: -99 };

  const vesselZ = (x) => 0.6 * Math.sin(x * 0.4) - 0.5;
  const rnd = () => Math.random() - 0.5;

  function step(dt) {
    S.t += dt;
    const t = S.t;

    if (ctrl.manual && !ctrl.pressing && t - ctrl.lastInput > 4) ctrl.manual = false;

    let pressTarget;
    if (ctrl.manual) {
      pressTarget = ctrl.pressing ? S.pressure : 0;
      S.tip.x += (ctrl.x - S.tip.x) * Math.min(1, dt * 12);
      S.tip.z += (ctrl.z - S.tip.z) * Math.min(1, dt * 12);
    } else {
      pressTarget = S.pressure * (0.5 - 0.5 * Math.cos(t * 1.05));
      const ax = 2.4 * Math.sin(t * 0.21);
      const az = 1.3 * Math.sin(t * 0.29 + 1.2);
      S.tip.x += (ax - S.tip.x) * Math.min(1, dt * 2);
      S.tip.z += (az - S.tip.z) * Math.min(1, dt * 2);
    }
    S.press += (pressTarget - S.press) * Math.min(1, dt * (ctrl.manual ? 9 : 6));
    S.contact = Math.max(0, S.press - 0.08) / 0.92;
    const depth = S.contact * 0.6;
    S.tip.y = S.contact > 0 ? -depth : (0.08 - S.press) * 3;

    const dv = S.tip.z - vesselZ(S.tip.x);
    S.prox = Math.exp(-(dv * dv) / 0.35);
    const ph = (t * 72 / 60) % 1;
    S.pulse = Math.exp(-(((ph - 0.15) * 14) ** 2)) - 0.35 * Math.exp(-(((ph - 0.32) * 10) ** 2));

    S.force = Math.max(0, S.contact * 3.4 + S.contact * S.prox * 0.5 * S.pulse + rnd() * 0.03);

    if (S.cautery) S.burst += dt;
    // En manual el electrobisturí descarga mientras se presiona; en automático, a ráfagas.
    const on = S.cautery && (ctrl.manual ? S.contact > 0.1 : (S.burst % 1.4) < 0.85);
    S.emi += ((on ? 1 : 0) - S.emi) * Math.min(1, dt * 10);

    const zClean = 440 - 170 * S.contact + 25 * S.prox * S.pulse * S.contact;
    S.zRaw = zClean + rnd() * 6 + S.emi * (rnd() * 300 + Math.sin(t * 90) * 90);

    const trustTarget = S.fusion ? Math.max(0.04, 1 - S.emi * 1.05) : 1;
    S.trust += (trustTarget - S.trust) * Math.min(1, dt * 14);
    const zModel = 440 - 170 * Math.min(1, S.force / 3.4);
    S.zOut = S.fusion ? S.trust * S.zRaw + (1 - S.trust) * zModel : S.zRaw;
    S.zShown = S.fusion ? S.zShown + (S.zOut - S.zShown) * Math.min(1, dt * 20) : S.zOut;
  }

  // ------------------------------------------------------------- registros
  const N = 320;
  const buf = { f: new Float32Array(N), zr: new Float32Array(N).fill(440), zo: new Float32Array(N).fill(440), e: new Float32Array(N) };
  let head = 0;
  function record() {
    buf.f[head] = S.force;
    buf.zr[head] = S.zRaw;
    buf.zo[head] = S.zShown;
    buf.e[head] = S.emi;
    head = (head + 1) % N;
  }

  // La gráfica es una pantalla oscura: colores fijos, no los de la página.
  const TRACE = {
    grid: 'rgba(154,167,186,0.14)',
    label: '#9aa7ba',
    force: '#7db4ff',
    raw: 'rgba(154,167,186,0.8)',
    out: '#e8eef6',
    warn: 'rgba(255,196,107,0.14)',
  };

  function drawTrace() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = traceCanvas.getBoundingClientRect();
    const W = Math.max(1, Math.round(r.width));
    const H = Math.max(1, Math.round(r.height));
    if (traceCanvas.width !== W * dpr || traceCanvas.height !== H * dpr) {
      traceCanvas.width = W * dpr;
      traceCanvas.height = H * dpr;
    }
    const ctx = traceCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const laneH = H / 3;

    ctx.fillStyle = TRACE.warn;
    for (let i = 0; i < N; i++) {
      if (buf.e[(head + i) % N] > 0.3) ctx.fillRect((i / (N - 1)) * W, laneH, W / N + 1, laneH * 2);
    }

    ctx.strokeStyle = TRACE.grid;
    ctx.lineWidth = 1;
    for (let k = 1; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(0, laneH * k + 0.5);
      ctx.lineTo(W, laneH * k + 0.5);
      ctx.stroke();
    }

    const lane = (arr, lo, hi, idx, color, width) => {
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const v = arr[(head + i) % N];
        const n = clamp((v - lo) / (hi - lo), 0, 1);
        const x = (i / (N - 1)) * W;
        const y = laneH * idx + laneH - 6 - n * (laneH - 22);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      ctx.stroke();
    };
    lane(buf.f, 0, 4.2, 0, TRACE.force, 1.6);
    lane(buf.zr, 120, 760, 1, TRACE.raw, 1);
    lane(buf.zo, 120, 760, 2, TRACE.out, 1.8);

    ctx.font = '500 12px Barlow, "Segoe UI", sans-serif';
    ctx.fillStyle = TRACE.label;
    ctx.fillText('Fuerza (N)', 8, 15);
    ctx.fillText('Bioimpedancia sin procesar (Ω)', 8, laneH + 15);
    ctx.fillText(S.fusion ? 'Salida con fusión (Ω)' : 'Salida sin fusión (Ω)', 8, laneH * 2 + 15);
  }

  let uiTimer = 0;
  function updateUI(dt) {
    uiTimer -= dt;
    if (uiTimer > 0) return;
    uiTimer = 0.12;
    ui.force.textContent = `${S.force.toFixed(2).replace('.', ',')} N`;
    ui.imp.textContent = `${Math.round(S.zShown)} Ω`;
    ui.trust.textContent = `${Math.round(S.trust * 100)} %`;
    ui.emi.textContent = `${Math.round(S.emi * 100)} %`;
    ui.emi.classList.toggle('is-warn', S.emi > 0.3);
    ui.trust.classList.toggle('is-warn', S.trust < 0.5);

    let msg;
    let warn = false;
    if (S.emi > 0.4) {
      warn = true;
      msg = S.fusion ? 'Electrobisturí activo. La fuerza sostiene la lectura' : 'Electrobisturí activo. Impedancia inservible';
    } else if (S.contact > 0.1 && S.prox > 0.55) {
      msg = 'Pulsatilidad detectada: hay un vaso bajo la punta';
    } else if (S.contact > 0.1) {
      msg = 'Contacto estable con el tejido';
    } else if (ctrl.manual) {
      msg = 'Mantén pulsado para presionar';
    } else {
      msg = 'Instrumento sin contacto';
    }
    ui.state.textContent = msg;
    ui.state.classList.toggle('is-warn', warn);
  }

  for (let i = 0; i < N; i++) { step(1 / 60); record(); }

  // ----------------------------------------------------------------- 3D
  const st = K.stage(view, { fov: 30 });
  let startLoop = () => {};
  let clearBurns = () => {};

  if (st) {
    const { renderer, scene, camera, pointer } = st;
    K.studioEnv(renderer, scene);

    scene.add(new THREE.HemisphereLight(0xbcd3ff, 0x05080e, 0.55));
    const keyL = new THREE.DirectionalLight(0xffffff, 1.1);
    keyL.position.set(5, 10, 6);
    scene.add(keyL);
    const rim = new THREE.DirectionalLight(0x3d8bff, 1.4);
    rim.position.set(-7, 4, -6);
    scene.add(rim);
    const spark = new THREE.PointLight(0xffb065, 0, 5);
    scene.add(spark);

    // Tejido
    const TW = 14, TD = 9, GX = 140, GZ = 90;
    const tg = new THREE.PlaneGeometry(TW, TD, GX, GZ);
    tg.rotateX(-Math.PI / 2);
    const tp = tg.attributes.position;
    const base = Float32Array.from(tp.array);
    const burn = new Float32Array(tp.count);
    const vcol = new Float32Array(tp.count * 3);
    tg.setAttribute('color', new THREE.BufferAttribute(vcol, 3));
    scene.add(new THREE.Mesh(tg, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.42, metalness: 0.05, transparent: true, opacity: 0.88,
    })));
    scene.add(new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0x3d8bff, wireframe: true, transparent: true, opacity: 0.06 })));
    clearBurns = () => burn.fill(0);

    // Vaso bajo el tejido
    const vpts = [];
    for (let x = -7.2; x <= 7.2; x += 0.6) vpts.push(new THREE.Vector3(x, -0.3, vesselZ(x)));
    scene.add(new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(vpts), 120, 0.22, 16),
      new THREE.MeshStandardMaterial({ color: 0x7a2436, emissive: 0x3a0a14, roughness: 0.5 })
    ));

    // Zona de detección y retícula de puntería
    const sense = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1, 64),
      new THREE.MeshBasicMaterial({ color: 0x7db4ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    sense.rotation.x = -Math.PI / 2;
    scene.add(sense);
    const aimRing = new THREE.Mesh(
      new THREE.RingGeometry(0.16, 0.2, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    aimRing.rotation.x = -Math.PI / 2;
    scene.add(aimRing);

    // Instrumento: punta en el origen local, vástago hacia +Y.
    const metal = new THREE.MeshStandardMaterial({ color: 0xd0d8e4, metalness: 1, roughness: 0.2 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x151c28, metalness: 0.7, roughness: 0.35 });
    const glowMat = new THREE.MeshStandardMaterial({ color: 0x0d2a55, emissive: 0x3d8bff, emissiveIntensity: 1.2, metalness: 0.3, roughness: 0.4 });
    const inst = new THREE.Group();
    const body = new THREE.Group();
    body.rotation.set(-0.35, 0, 0.62);
    inst.add(body);
    scene.add(inst);

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 9, 48), metal);
    shaft.position.y = 5.4;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.34, 48), glowMat);
    collar.position.y = 0.98;
    const headPart = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.46, 48), dark);
    headPart.position.y = 0.57;
    const ringGeo = new THREE.TorusGeometry(0.172, 0.014, 8, 48);
    const r1 = new THREE.Mesh(ringGeo, dark);
    const r2 = new THREE.Mesh(ringGeo, dark);
    r1.rotation.x = r2.rotation.x = Math.PI / 2;
    r1.position.y = 0.8;
    r2.position.y = 1.16;
    const jawGeo = new THREE.BoxGeometry(0.07, 0.52, 0.13);
    jawGeo.translate(0, -0.26, 0);
    const jawA = new THREE.Mesh(jawGeo, metal);
    const jawB = new THREE.Mesh(jawGeo, metal);
    jawA.position.set(0.035, 0.36, 0);
    jawB.position.set(-0.035, 0.36, 0);
    body.add(shaft, collar, headPart, r1, r2, jawA, jawB);

    const tipGlow = K.glowSprite(0x7db4ff, 0.9);
    scene.add(tipGlow);

    const SPARKS = 70;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPos = new Float32Array(SPARKS * 3);
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    const sparkMat = new THREE.PointsMaterial({ color: 0xffc27a, size: 0.07, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    scene.add(new THREE.Points(sparkGeo, sparkMat));
    const hotGlow = K.glowSprite(0xffa850, 2.2);
    hotGlow.material.opacity = 0;
    scene.add(hotGlow);

    const cBase = new THREE.Color(0x172233);
    const cMid = new THREE.Color(0x2f6fdb);
    const cHot = new THREE.Color(0xf0a63a);
    const cVessel = new THREE.Color(0x5a1c2b);
    const cBurn = new THREE.Color(0x140905);
    const cEdge = new THREE.Color(0xff9a3c);
    const col = new THREE.Color();

    function updateTissue(dt, t) {
      const depth = S.tip.y < 0 ? -S.tip.y : 0;
      const sig2 = 2 * 0.85 * 0.85;
      const pulse = Math.max(0, S.pulse);
      const cutting = S.emi > 0.4 && S.contact > 0.12;
      for (let i = 0; i < tp.count; i++) {
        const x = base[i * 3];
        const z = base[i * 3 + 2];
        const dx = x - S.tip.x;
        const dz = z - S.tip.z;
        const d2 = dx * dx + dz * dz;
        if (cutting && d2 < 0.06) burn[i] = Math.min(1, burn[i] + dt * 5 * (1 - d2 / 0.06));
        const g = Math.exp(-d2 / sig2);
        const dv = z - vesselZ(x);
        const vb = Math.exp(-(dv * dv) / 0.09);
        const b = burn[i];
        tp.setY(i, 0.05 * Math.sin(x * 0.7 + t * 0.3) * Math.cos(z * 0.9) - depth * g + vb * (0.05 + 0.035 * pulse) - b * 0.05);
        const s = Math.min(1, depth * g * 2.2);
        if (s < 0.5) col.copy(cBase).lerp(cMid, s * 2);
        else col.copy(cMid).lerp(cHot, (s - 0.5) * 2);
        col.lerp(cVessel, vb * 0.45 * (1 - s));
        if (b > 0) {
          col.lerp(cBurn, Math.min(1, b * 1.2));
          if (cutting && d2 < 0.1) col.lerp(cEdge, 0.5 * (1 - d2 / 0.1));
        }
        vcol[i * 3] = col.r;
        vcol[i * 3 + 1] = col.g;
        vcol[i * 3 + 2] = col.b;
      }
      tp.needsUpdate = true;
      tg.attributes.color.needsUpdate = true;
      tg.computeVertexNormals();
    }

    const camBase = new THREE.Vector3();
    const target = new THREE.Vector3(0, 0.4, 0);
    const place = () => {
      if (st.size.w / st.size.h >= 1.2) camBase.set(6.6, 5.6, 8.4);
      else camBase.set(8.5, 8, 11.5);
    };
    st.onResize(place);
    place();
    let camX = 0;
    let camY = 0;

    const loop = st.loop((dt, t) => {
      if (dt > 0) { step(dt); record(); }
      updateTissue(dt, S.t);

      inst.position.set(S.tip.x, S.tip.y, S.tip.z);
      const open = 0.1 + 0.28 * (1 - S.contact);
      jawA.rotation.z = open;
      jawB.rotation.z = -open;
      glowMat.emissiveIntensity = 0.7 + 1.3 * Math.min(1, S.force / 3.4);
      tipGlow.position.set(S.tip.x, S.tip.y + 0.05, S.tip.z);
      tipGlow.material.opacity = 0.35 + 0.65 * S.contact;

      sense.position.set(S.tip.x, 0.03, S.tip.z);
      sense.scale.setScalar(0.6 + S.contact * 0.9);
      sense.material.opacity = 0.55 * S.contact;

      aimRing.position.set(ctrl.x, 0.04, ctrl.z);
      aimRing.material.opacity += ((ctrl.manual ? 0.7 : 0) - aimRing.material.opacity) * Math.min(1, dt * 8);

      const e = S.emi;
      spark.position.set(S.tip.x, S.tip.y + 0.15, S.tip.z);
      spark.intensity = e * (1.6 + Math.random() * 1.8);
      hotGlow.position.set(S.tip.x, S.tip.y + 0.1, S.tip.z);
      hotGlow.material.opacity = e * (0.5 + Math.random() * 0.5);
      sparkMat.opacity = e;
      if (e > 0.05) {
        for (let i = 0; i < SPARKS; i++) {
          const a = Math.random() * Math.PI * 2;
          const rr = Math.random() * 0.55 * e;
          sparkPos[i * 3] = S.tip.x + Math.cos(a) * rr;
          sparkPos[i * 3 + 1] = S.tip.y + Math.random() * 0.5 * e;
          sparkPos[i * 3 + 2] = S.tip.z + Math.sin(a) * rr;
        }
        sparkGeo.attributes.position.needsUpdate = true;
      }

      // Cámara: sin parallax mientras el usuario guía el instrumento.
      camX += ((ctrl.manual ? 0 : pointer.x) - camX) * Math.min(1, dt * 3);
      camY += ((ctrl.manual ? 0 : pointer.y) - camY) * Math.min(1, dt * 3);
      const ang = (ctrl.manual ? 0 : Math.sin(t * 0.12) * 0.12) + camX * 0.12;
      const radius = Math.hypot(camBase.x, camBase.z);
      const baseAng = Math.atan2(camBase.x, camBase.z);
      camera.position.set(Math.sin(baseAng + ang) * radius, camBase.y - camY * 0.8, Math.cos(baseAng + ang) * radius);
      camera.lookAt(target);

      drawTrace();
      updateUI(dt || 1);
    });
    startLoop = loop.start;

    // --------------------------------------------------------- puntería
    const canvas = renderer.domElement;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    const takeControl = () => {
      if (!ctrl.manual) { ctrl.x = S.tip.x; ctrl.z = S.tip.z; }
      ctrl.manual = true;
      ctrl.lastInput = S.t;
      startLoop();
    };
    const aim = (e) => {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(plane, hit)) return;
      takeControl();
      ctrl.x = clamp(hit.x, -BOUNDS.x, BOUNDS.x);
      ctrl.z = clamp(hit.z, -BOUNDS.z, BOUNDS.z);
    };
    const release = () => { ctrl.pressing = false; ctrl.lastInput = S.t; };
    canvas.addEventListener('pointermove', aim);
    canvas.addEventListener('pointerdown', (e) => {
      aim(e);
      ctrl.pressing = true;
      canvas.setPointerCapture(e.pointerId);
      view.focus({ preventScroll: true });
    });
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    // Teclado: flechas relativas a la vista y espacio para presionar.
    const KEYS = {
      ArrowRight: [0.786, -0.618],
      ArrowLeft: [-0.786, 0.618],
      ArrowUp: [-0.618, -0.786],
      ArrowDown: [0.618, 0.786],
    };
    view.addEventListener('keydown', (e) => {
      const dir = KEYS[e.key];
      if (dir) {
        e.preventDefault();
        takeControl();
        const stepSize = e.shiftKey ? 0.8 : 0.3;
        ctrl.x = clamp(ctrl.x + dir[0] * stepSize, -BOUNDS.x, BOUNDS.x);
        ctrl.z = clamp(ctrl.z + dir[1] * stepSize, -BOUNDS.z, BOUNDS.z);
      } else if (e.key === ' ') {
        e.preventDefault();
        takeControl();
        ctrl.pressing = true;
      }
    });
    view.addEventListener('keyup', (e) => { if (e.key === ' ') release(); });
    view.addEventListener('blur', release);
  } else {
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      step(dt);
      record();
      drawTrace();
      updateUI(dt);
      requestAnimationFrame(frame);
    };
    drawTrace();
    updateUI(1);
    let started = false;
    startLoop = () => { if (!started) { started = true; requestAnimationFrame(frame); } };
    if (!K.reduce) startLoop();
  }

  // ------------------------------------------------------------- controles
  const setPressed = (btn, on) => btn.setAttribute('aria-pressed', String(on));

  ui.cautery.addEventListener('click', () => {
    S.cautery = !S.cautery;
    S.burst = 0;
    setPressed(ui.cautery, S.cautery);
    ui.cautery.querySelector('[data-label]').textContent = S.cautery ? 'Electrobisturí activado' : 'Activar electrobisturí';
    startLoop();
  });
  ui.fusion.addEventListener('click', () => {
    S.fusion = !S.fusion;
    setPressed(ui.fusion, S.fusion);
    startLoop();
  });
  ui.pressure.addEventListener('input', () => {
    S.pressure = ui.pressure.value / 100;
    ui.pressureOut.textContent = `${ui.pressure.value} %`;
    startLoop();
  });
  if (ui.reset) ui.reset.addEventListener('click', () => { clearBurns(); startLoop(); });

  drawTrace();
  window.addEventListener('resize', drawTrace);
})();
