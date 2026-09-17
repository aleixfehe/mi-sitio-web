// Nodo de campo en vista despiezada: envolvente, electrónica, batería,
// tapa, panel solar, antena y sonda. Se puede girar arrastrando.

(() => {
  const K = window.AKRA3D;
  const view = document.getElementById('nodeScene');
  if (!view || !K) return;
  const st = K.stage(view, { fov: 30 });
  if (!st) return;
  const { renderer, scene, camera } = st;
  K.studioEnv(renderer, scene);

  scene.add(new THREE.HemisphereLight(0xbcd3ff, 0x05080e, 0.6));
  const keyL = new THREE.DirectionalLight(0xffffff, 1.0);
  keyL.position.set(6, 10, 8);
  scene.add(keyL);
  const rim = new THREE.DirectionalLight(0x3d8bff, 1.3);
  rim.position.set(-8, 3, -6);
  scene.add(rim);

  const root = new THREE.Group();
  scene.add(root);
  const parts = [];
  const addPart = (key, obj, assembled, exploded, anchorX) => {
    root.add(obj);
    parts.push({ key, obj, a: assembled, e: exploded, anchorX });
  };

  // Materiales
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa8bc, metalness: 0.9, roughness: 0.3 });
  const lidMat = new THREE.MeshStandardMaterial({ color: 0x223149, metalness: 0.6, roughness: 0.35 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0e141e, metalness: 0.4, roughness: 0.5 });
  const pcbMat = new THREE.MeshStandardMaterial({ color: 0x0c3a31, roughness: 0.55, metalness: 0.1 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd4af5a, metalness: 1, roughness: 0.28 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x0d2a55, emissive: 0x3d8bff, emissiveIntensity: 1.1 });

  // Envolvente translúcida con aristas marcadas
  const shell = new THREE.Group();
  const shellGeo = new THREE.BoxGeometry(2.6, 1.3, 1.7);
  shell.add(new THREE.Mesh(shellGeo, new THREE.MeshStandardMaterial({
    color: 0x1a2a40, transparent: true, opacity: 0.22, roughness: 0.2, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide,
  })));
  shell.add(new THREE.LineSegments(new THREE.EdgesGeometry(shellGeo), new THREE.LineBasicMaterial({ color: 0x7db4ff, transparent: true, opacity: 0.85 })));
  addPart('shell', shell, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1.6, 0), 1.45);

  // Batería
  const battery = new THREE.Group();
  const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.6, 40), darkMat);
  cell.rotation.z = Math.PI / 2;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.3, 40), accentMat);
  band.rotation.z = Math.PI / 2;
  const capA = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 24), metal);
  capA.rotation.z = Math.PI / 2;
  capA.position.x = 0.84;
  battery.add(cell, band, capA);
  addPart('battery', battery, new THREE.Vector3(0, -0.3, 0.3), new THREE.Vector3(0, -0.25, 0.3), 1.2);

  // Electrónica
  const pcb = new THREE.Group();
  pcb.add(new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.06, 1.3), pcbMat));
  const chip = (w, d, x, z, mat, h = 0.08) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, 0.03 + h / 2, z);
    pcb.add(m);
  };
  chip(0.42, 0.42, -0.45, 0.1, darkMat);
  chip(0.62, 0.46, 0.45, -0.2, metal, 0.12);
  chip(0.22, 0.22, -0.05, -0.35, darkMat);
  chip(0.18, 0.5, -0.85, -0.3, darkMat);
  for (let i = 0; i < 10; i++) chip(0.06, 0.1, -0.9 + i * 0.12, 0.55, gold, 0.02);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.08), accentMat);
  led.position.set(0.85, 0.06, 0.45);
  pcb.add(led);
  addPart('pcb', pcb, new THREE.Vector3(0, 0.25, 0), new THREE.Vector3(0, 0.95, 0), 1.3);

  // Tapa
  const lid = new THREE.Mesh(new THREE.BoxGeometry(2.66, 0.14, 1.76), lidMat);
  addPart('lid', lid, new THREE.Vector3(0, 0.72, 0), new THREE.Vector3(0, 2.05, 0), 1.5);

  // Panel solar con celdas dibujadas
  const tex = (() => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 168;
    const g = c.getContext('2d');
    g.fillStyle = '#081733';
    g.fillRect(0, 0, 256, 168);
    g.strokeStyle = '#2a5aa8';
    g.lineWidth = 2;
    for (let x = 0; x <= 256; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 168); g.stroke(); }
    for (let y = 0; y <= 168; y += 28) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
    g.strokeStyle = 'rgba(200,215,235,0.35)';
    g.lineWidth = 1;
    for (let x = 16; x < 256; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 168); g.stroke(); }
    return new THREE.CanvasTexture(c);
  })();
  const solar = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.05, 1.5),
    [darkMat, darkMat, new THREE.MeshStandardMaterial({ map: tex, metalness: 0.4, roughness: 0.18 }), darkMat, darkMat, darkMat]
  );
  addPart('solar', solar, new THREE.Vector3(0, 0.82, 0), new THREE.Vector3(0, 2.75, 0), 1.3);

  // Antena
  const antenna = new THREE.Group();
  const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.6, 20), darkMat);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.16, 24), metal);
  base.position.y = -0.8;
  const tipGlow = K.glowSprite(0x7db4ff, 0.7);
  tipGlow.position.y = 0.85;
  antenna.add(whip, base, tipGlow);
  addPart('antenna', antenna, new THREE.Vector3(0.95, 1.6, -0.5), new THREE.Vector3(0.95, 4.0, -0.5), 0.6);

  // Sonda con cable
  const probe = new THREE.Group();
  const gland = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.25, 24), metal);
  const cablePts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.5, 0.1), new THREE.Vector3(0.2, -1, 0.3), new THREE.Vector3(0.1, -1.4, 0.2)];
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePts), 40, 0.045, 10), darkMat);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 24), metal);
  tip.position.set(0.1, -1.65, 0.2);
  const tipBand = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.1, 24), accentMat);
  tipBand.position.set(0.1, -1.55, 0.2);
  probe.add(gland, cable, tip, tipBand);
  addPart('probe', probe, new THREE.Vector3(-0.8, -0.78, 0), new THREE.Vector3(-0.8, -2.75, 0), 0.9);

  // Etiquetas proyectadas
  const labels = {};
  view.querySelectorAll('.vp-labels li').forEach((li) => { labels[li.dataset.part] = li; });

  // Interacción
  const btn = document.getElementById('nodeExplode');
  let explodeTarget = 1;
  let explode = K.reduce ? 1 : 0;
  let yaw = -0.55;
  let pitch = 0.18;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let idle = 0;

  view.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    view.setPointerCapture(e.pointerId);
  });
  view.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    yaw += (e.clientX - lastX) * 0.008;
    pitch = Math.max(-0.4, Math.min(0.7, pitch + (e.clientY - lastY) * 0.006));
    lastX = e.clientX;
    lastY = e.clientY;
    idle = 0;
  });
  view.addEventListener('pointerup', () => { dragging = false; });

  const place = () => {
    const a = st.size.w / st.size.h;
    const d = a < 0.9 ? 21 : 18;
    camera.position.set(0, 2.2, d);
    camera.lookAt(0, 0.55, 0);
  };
  st.onResize(place);
  place();

  const v = new THREE.Vector3();
  const loop = st.loop((dt, t) => {
    explode += (explodeTarget - explode) * Math.min(1, dt * 3);
    const e = explode * explode * (3 - 2 * explode);
    parts.forEach((p) => p.obj.position.lerpVectors(p.a, p.e, e));

    idle += dt;
    if (!dragging && idle > 2) yaw += dt * 0.18;
    root.rotation.set(pitch, yaw, 0);
    root.updateMatrixWorld();

    tipGlow.material.opacity = 0.6 + 0.4 * Math.sin(t * 3);

    const w = st.size.w;
    const h = st.size.h;
    parts.forEach((p) => {
      const li = labels[p.key];
      if (!li) return;
      v.set(p.obj.position.x + p.anchorX, p.obj.position.y, p.obj.position.z);
      root.localToWorld(v);
      v.project(camera);
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;
      li.style.transform = `translate(${x.toFixed(1)}px, ${(y - 8).toFixed(1)}px)`;
      li.style.opacity = String(Math.max(0, (e - 0.55) / 0.45));
    });
  });

  if (btn) {
    btn.addEventListener('click', () => {
      explodeTarget = explodeTarget ? 0 : 1;
      btn.setAttribute('aria-pressed', String(Boolean(explodeTarget)));
      loop.start();
    });
  }
})();
