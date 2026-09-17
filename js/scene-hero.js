// Hero: red de sensores sobre un terreno de montaña, simulada en tiempo real.
// Los nodos miden y envían paquetes a un repetidor en la cima, que los
// reenvía a una estación base. Las cifras del panel son de la simulación.

(() => {
  const K = window.AKRA3D;
  const el = document.getElementById('heroScene');
  if (!el || !K) return;
  const st = K.stage(el, { fov: 34, far: 200 });
  if (!st) return;
  const { scene, camera, pointer } = st;

  const BG = 0xedf2f9;
  const NAVY = 0x0f1b2d;
  const BLUE = 0x1f5fd1;
  const AMBER = 0xd98a0b;
  scene.fog = new THREE.Fog(BG, 34, 88);

  const world = new THREE.Group();
  scene.add(world);

  // ---------------------------------------------------------------- relieve
  const SX = 70, SZ = 44, NX = 170, NZ = 106;
  const height = (x, z) => {
    const r = K.ridged(x * 0.042 + 3.1, z * 0.042 + 7.4, 5);
    const f = K.fbm(x * 0.09 + 11, z * 0.09 + 2, 3);
    const massif = Math.exp(-((x - 4) ** 2) / 380 - ((z + 6) ** 2) / 240);
    return (r * 8 + f * 1.3) * (0.3 + 0.95 * massif) - 2;
  };

  const geo = new THREE.PlaneGeometry(SX, SZ, NX, NZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();

  world.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0xf1f5fb, roughness: 1, metalness: 0, flatShading: true,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  })));

  // Curvas por filas, más intensas cuanto más alto.
  const lp = [];
  const lc = [];
  const cLow = new THREE.Color(0xc9d6ea);
  const cHigh = new THREE.Color(BLUE);
  const tmp = new THREE.Color();
  for (let j = 0; j <= NZ; j += 2) {
    for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i;
      for (const k of [a, a + 1]) {
        const y = pos.getY(k);
        lp.push(pos.getX(k), y + 0.02, pos.getZ(k));
        tmp.copy(cLow).lerp(cHigh, THREE.MathUtils.clamp((y + 1) / 8, 0, 1));
        lc.push(tmp.r, tmp.g, tmp.b);
      }
    }
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  lg.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3));
  world.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true })));

  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const key = new THREE.DirectionalLight(0xffffff, 0.45);
  key.position.set(-20, 30, 12);
  scene.add(key);

  // --------------------------------------------------------------- repetidor
  const peak = new THREE.Vector3(0, -99, 0);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i);
    if (x > -4 && x < 18 && z > -18 && z < 4 && y > peak.y) peak.set(x, y, z);
  }
  const MAST_H = 3.4;
  const mast = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.CylinderGeometry(0.08, 0.38, MAST_H, 4, 5)),
    new THREE.LineBasicMaterial({ color: NAVY })
  );
  mast.position.set(peak.x, peak.y + MAST_H / 2, peak.z);
  world.add(mast);
  const relayTop = new THREE.Vector3(peak.x, peak.y + MAST_H + 0.1, peak.z);
  const relayGlow = K.glowSprite(BLUE, 1.6, true);
  relayGlow.material.opacity = 0.55;
  relayGlow.position.copy(relayTop);
  world.add(relayGlow);

  const waves = [0, 1, 2].map((k) => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1, 64),
      new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.copy(relayTop);
    m.userData.phase = k / 3;
    world.add(m);
    return m;
  });

  // --------------------------------------------------------- estación base
  const gw = new THREE.Vector3(24, 0, 13);
  gw.y = height(gw.x, gw.z);
  const stationGeo = new THREE.BoxGeometry(1.6, 1, 1.2);
  const station = new THREE.Mesh(stationGeo, new THREE.MeshStandardMaterial({ color: 0x2a3d5c, roughness: 0.7 }));
  station.position.set(gw.x, gw.y + 0.5, gw.z);
  world.add(station);
  const stationEdges = new THREE.LineSegments(new THREE.EdgesGeometry(stationGeo), new THREE.LineBasicMaterial({ color: BLUE }));
  stationEdges.position.copy(station.position);
  world.add(stationEdges);
  const gwTop = new THREE.Vector3(gw.x, gw.y + 2.4, gw.z);
  world.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(gw.x, gw.y + 1, gw.z), gwTop]),
    new THREE.LineBasicMaterial({ color: NAVY })
  ));
  const gwGlow = K.glowSprite(BLUE, 1.2, true);
  gwGlow.material.opacity = 0.5;
  gwGlow.position.copy(gwTop);
  world.add(gwGlow);

  // ------------------------------------------------------------------ nodos
  const rand = K.rng(7);
  const nodes = [];
  const linkMat = new THREE.LineDashedMaterial({ color: BLUE, dashSize: 0.4, gapSize: 0.4, transparent: true, opacity: 0.45 });
  const navy = new THREE.Color(NAVY);
  const amber = new THREE.Color(AMBER);

  const curveBetween = (a, b, lift) => {
    const mid = a.clone().lerp(b, 0.5);
    mid.y += a.distanceTo(b) * lift;
    return new THREE.QuadraticBezierCurve3(a, mid, b);
  };

  let tries = 0;
  while (nodes.length < 12 && tries++ < 600) {
    // Solo en la mitad derecha y hacia el fondo, para no pisar el texto.
    const x = -3 + rand() * 30;
    const z = -17 + rand() * 24;
    if (Math.hypot(x - peak.x, z - peak.z) < 6) continue;
    if (nodes.some((n) => Math.hypot(n.base.x - x, n.base.z - z) < 5)) continue;
    const y = height(x, z);
    const base = new THREE.Vector3(x, y, z);
    const top = new THREE.Vector3(x, y + 0.9, z);

    const box = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), new THREE.MeshBasicMaterial({ color: NAVY }));
    box.position.set(x, y + 0.18, z);
    world.add(box);
    world.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y + 0.36, z), top]),
      new THREE.LineBasicMaterial({ color: NAVY })
    ));
    const glow = K.glowSprite(BLUE, 0.8, true);
    glow.material.opacity = 0.5;
    glow.position.copy(top);
    world.add(glow);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.27, 40),
      new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y + 0.05, z);
    world.add(ring);

    const curve = curveBetween(top, relayTop, 0.22);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)), linkMat);
    line.computeLineDistances();
    world.add(line);

    nodes.push({
      id: `N-${String(nodes.length + 1).padStart(2, '0')}`,
      base, box, glow, ring, curve,
      next: 0.5 + rand() * 4,
      phase: rand(),
      alert: 0,
    });
  }

  const backhaul = curveBetween(relayTop, gwTop, 0.12);
  world.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(backhaul.getPoints(64)),
    new THREE.LineBasicMaterial({ color: BLUE, transparent: true, opacity: 0.8 })
  ));

  // ---------------------------------------------------------------- paquetes
  const packets = [];
  const pool = Array.from({ length: 48 }, () => {
    const s = K.glowSprite(BLUE, 0.6, true);
    s.visible = false;
    world.add(s);
    return s;
  });
  const launch = (curve, speed, onArrive, color) => {
    const sprite = pool.find((p) => !p.visible);
    if (!sprite) return;
    sprite.visible = true;
    sprite.material.color.set(color);
    packets.push({ sprite, curve, t: 0, speed, onArrive });
  };

  // ------------------------------------------------------------------- panel
  const hud = {
    nodes: document.getElementById('hudNodes'),
    packets: document.getElementById('hudPackets'),
    latency: document.getElementById('hudLatency'),
    battery: document.getElementById('hudBattery'),
    log: document.getElementById('hudLog'),
  };
  let delivered = 0;
  let latencyAvg = 1.4;
  let relayFlash = 0;
  let gwFlash = 0;

  const dec = (n, d) => n.toFixed(d).replace('.', ',');
  const MEASURES = [
    (r) => `nivel ${dec(1.8 + r * 1.4, 2)} m`,
    (r) => `inclinación ${dec(r * 0.05, 3)}°`,
    (r) => `temperatura ${dec(-6 + r * 14, 1)} °C`,
    (r) => `humedad ${Math.round(55 + r * 40)} %`,
    (r) => `vibración ${dec(r * 0.9, 2)} mm/s`,
  ];
  const clock = () => new Date().toLocaleTimeString('es-ES', { hour12: false });
  const logEvent = (node, alert) => {
    if (!hud.log) return;
    const li = document.createElement('li');
    const time = document.createElement('time');
    time.textContent = clock();
    const id = document.createElement('b');
    id.textContent = node.id;
    const text = document.createElement('span');
    text.textContent = alert ? 'umbral superado, alerta enviada' : MEASURES[Math.floor(Math.random() * MEASURES.length)](Math.random());
    li.append(time, id, text);
    if (alert) li.className = 'alert';
    hud.log.prepend(li);
    while (hud.log.children.length > 4) hud.log.lastElementChild.remove();
  };

  // ------------------------------------------------------------------ cámara
  const target = new THREE.Vector3();
  const camBase = new THREE.Vector3();
  const place = () => {
    if (st.size.w / st.size.h > 1.1) {
      world.position.set(9, 0, 0);
      camBase.set(0, 19, 38);
      target.set(6, 0, -3);
    } else {
      world.position.set(0, 0, 0);
      camBase.set(0, 30, 50);
      target.set(0, 0, -2);
    }
    camera.position.copy(camBase);
    camera.lookAt(target);
  };
  st.onResize(place);
  place();

  let eventTimer = 1.2;

  st.loop((dt, t) => {
    const ang = Math.sin(t * 0.05) * 0.22 + pointer.x * 0.08;
    const r = Math.hypot(camBase.x, camBase.z);
    camera.position.set(Math.sin(ang) * r, camBase.y - pointer.y * 1.5, Math.cos(ang) * r);
    camera.lookAt(target.x + world.position.x * 0.3, target.y, target.z);

    nodes.forEach((n) => {
      n.next -= dt;
      if (n.next <= 0) {
        n.next = 2.2 + Math.random() * 4.5;
        const alert = Math.random() < 0.08;
        if (alert) n.alert = 2.5;
        const color = alert ? AMBER : BLUE;
        launch(n.curve, 0.45 + Math.random() * 0.2, () => {
          relayFlash = 1;
          latencyAvg += (0.9 + Math.random() * 1.4 - latencyAvg) * 0.2;
          setTimeout(() => launch(backhaul, 0.55, () => {
            delivered += 1;
            gwFlash = 1;
            if (hud.packets) hud.packets.textContent = (1284 + delivered).toLocaleString('es-ES');
            if (hud.latency) hud.latency.textContent = `${dec(latencyAvg, 1)} s`;
          }, color), 180);
        }, color);
      }
      const p = (t * 0.45 + n.phase) % 1;
      n.ring.scale.setScalar(1 + p * 7);
      n.ring.material.opacity = 0.45 * (1 - p);
      n.alert = Math.max(0, n.alert - dt);
      const hot = n.alert > 0 ? 0.5 + 0.5 * Math.sin(t * 14) : 0;
      n.box.material.color.copy(navy).lerp(amber, hot);
      n.glow.material.color.set(BLUE).lerp(amber, hot);
      n.glow.scale.setScalar(0.8 + hot * 0.8);
    });

    for (let i = packets.length - 1; i >= 0; i--) {
      const pk = packets[i];
      pk.t += dt * pk.speed;
      if (pk.t >= 1) {
        pk.sprite.visible = false;
        packets.splice(i, 1);
        pk.onArrive();
        continue;
      }
      pk.curve.getPoint(pk.t, pk.sprite.position);
    }

    relayFlash = Math.max(0, relayFlash - dt * 2.5);
    gwFlash = Math.max(0, gwFlash - dt * 2.5);
    relayGlow.scale.setScalar(1.6 + relayFlash * 1.8 + Math.sin(t * 3) * 0.15);
    gwGlow.scale.setScalar(1.2 + gwFlash * 1.5);

    waves.forEach((w) => {
      const p = (t * 0.25 + w.userData.phase) % 1;
      w.scale.setScalar(1 + p * 14);
      w.material.opacity = 0.3 * (1 - p);
    });

    eventTimer -= dt;
    if (eventTimer <= 0 && nodes.length) {
      eventTimer = 1.6 + Math.random() * 2.2;
      const n = nodes[Math.floor(Math.random() * nodes.length)];
      logEvent(n, n.alert > 0);
    }
    if (hud.battery && Math.random() < 0.01) {
      hud.battery.textContent = `${Math.round(88 + Math.random() * 2)} %`;
    }
  });

  if (hud.nodes) hud.nodes.textContent = `${nodes.length} / ${nodes.length}`;
})();
