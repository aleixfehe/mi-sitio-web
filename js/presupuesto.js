// Solicitud de presupuesto para cualquier proyecto.
// El panel lateral resume la solicitud en vivo y muestra qué falta para que
// la propuesta sea más precisa. Los archivos no salen del navegador hasta
// que se pulsa "Enviar solicitud".

(() => {
  const form = document.getElementById('quoteForm');
  if (!form) return;

  const MAX_FILES = 5;
  const MAX_TOTAL = 15 * 1024 * 1024;
  const ALLOWED = ['pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'xls', 'xlsx', 'ods', 'csv', 'ppt', 'pptx',
    'png', 'jpg', 'jpeg', 'webp', 'heic', 'dwg', 'dxf', 'step', 'stp', 'iges', 'igs', 'stl', 'zip'];
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const $ = (id) => document.getElementById(id);
  const input = $('qFiles');
  const zone = $('dropzone');
  const list = $('fileList');
  const status = $('quoteStatus');
  const sum = {
    state: $('sumState'),
    score: $('sumScore'),
    bar: $('sumBar'),
    tipo: $('sumTipo'),
    fase: $('sumFase'),
    plazo: $('sumPlazo'),
    docs: $('sumDocs'),
    contacto: $('sumContacto'),
    checklist: $('sumChecklist'),
  };
  const f = form.elements;

  let files = [];

  const ext = (name) => (name.split('.').pop() || '').toLowerCase();
  const fmtSize = (b) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const hasLink = () => /^https?:\/\/\S+/i.test(f.enlace.value.trim());

  function setError(name, msg) {
    const el = form.querySelector(`[data-error-for="${name}"]`);
    if (el) el.textContent = msg || '';
  }

  function shortLabel(select) {
    const opt = select.options[select.selectedIndex];
    if (!select.value || !opt) return '—';
    return opt.dataset.short || opt.textContent;
  }

  // ----------------------------------------------------------- resumen vivo
  function update() {
    const tipo = form.querySelector('input[name="tipo"]:checked');
    sum.tipo.textContent = tipo ? tipo.value : '—';
    sum.fase.textContent = shortLabel(f.fase);
    sum.plazo.textContent = shortLabel(f.plazo);
    sum.contacto.textContent = shortLabel(f.contacto_pref);

    const total = files.reduce((s, file) => s + file.size, 0);
    sum.docs.textContent = files.length
      ? `${files.length} · ${fmtSize(total)}`
      : (hasLink() ? 'Enlace' : 'Ninguno');

    const checks = {
      descripcion: f.descripcion.value.trim().length >= 40,
      fase: Boolean(f.fase.value),
      plazo: Boolean(f.plazo.value),
      ubicacion: f.ubicacion.value.trim().length >= 3,
      docs: files.length > 0 || hasLink(),
    };
    let done = 0;
    sum.checklist.querySelectorAll('li').forEach((li) => {
      const ok = Boolean(checks[li.dataset.check]);
      li.classList.toggle('done', ok);
      if (ok) done += 1;
    });
    sum.bar.querySelectorAll('span').forEach((seg, i) => seg.classList.toggle('on', i < done));
    sum.score.textContent = `${done} de 5`;

    const ready = f.descripcion.value.trim().length >= 20
      && f.nombre.value.trim().length >= 2
      && EMAIL_RE.test(f.email.value.trim())
      && f.consentimiento.checked;
    sum.state.textContent = ready ? 'lista para enviar' : 'borrador';
  }

  // ---------------------------------------------------------------- archivos
  function renderList() {
    list.innerHTML = '';
    files.forEach((file, i) => {
      const row = document.createElement('div');
      row.className = 'file-chip';
      const name = document.createElement('span');
      name.className = 'fname';
      name.textContent = file.name;
      const size = document.createElement('span');
      size.className = 'fsize';
      size.textContent = fmtSize(file.size);
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.setAttribute('aria-label', `Quitar ${file.name}`);
      rm.textContent = '×';
      rm.addEventListener('click', () => {
        files.splice(i, 1);
        renderList();
        update();
      });
      row.append(name, size, rm);
      list.appendChild(row);
    });
  }

  function addFiles(fileList) {
    setError('archivos', '');
    for (const file of Array.from(fileList)) {
      if (!ALLOWED.includes(ext(file.name))) {
        setError('archivos', `«${file.name}» no es un formato admitido. Usa PDF, documentos, hojas de cálculo, imágenes, planos, CAD o ZIP.`);
        continue;
      }
      if (files.length >= MAX_FILES) {
        setError('archivos', `Máximo ${MAX_FILES} archivos. Agrúpalos en un ZIP o pega un enlace de descarga.`);
        break;
      }
      const total = files.reduce((s, x) => s + x.size, 0) + file.size;
      if (total > MAX_TOTAL) {
        setError('archivos', `Entre todos superan ${fmtSize(MAX_TOTAL)}. Para archivos grandes pega un enlace (WeTransfer, Drive, Dropbox).`);
        continue;
      }
      files.push(file);
    }
    renderList();
    update();
  }

  input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('is-over'); }));
  zone.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  update();

  // ------------------------------------------------------------------ envío
  const started = Date.now();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (f.empresa_web.value) return;

    let valid = true;
    const need = (name, ok, msg) => { setError(name, ok ? '' : msg); if (!ok) valid = false; };
    need('descripcion', f.descripcion.value.trim().length >= 20, 'Cuéntanos un poco más del proyecto (al menos un par de frases).');
    need('nombre', f.nombre.value.trim().length >= 2, 'Escribe tu nombre.');
    need('email', EMAIL_RE.test(f.email.value.trim()), 'Revisa el correo: ahí te enviaremos la propuesta.');
    need('consentimiento', f.consentimiento.checked, 'Necesitamos tu consentimiento para estudiar el proyecto.');
    if (!valid) {
      const firstErr = form.querySelector('.field-error:not(:empty)');
      if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const data = new FormData(form);
    files.forEach((file) => data.append('archivos', file, file.name));
    data.append('elapsed', String(Date.now() - started));

    const btn = form.querySelector('button[type="submit"]');
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Enviando…';

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/presupuesto');
    xhr.upload.addEventListener('progress', (ev) => {
      if (ev.lengthComputable && files.length) btn.textContent = `Subiendo ${Math.round((ev.loaded / ev.total) * 100)} %`;
    });
    xhr.addEventListener('load', () => {
      let body = {};
      try { body = JSON.parse(xhr.responseText); } catch (_) { /* respuesta no JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) {
        const email = f.email.value.trim();
        status.className = 'form-status is-ok';
        status.setAttribute('role', 'status');
        status.innerHTML = `Solicitud recibida${body.ref ? ` con referencia <strong class="mono">${escapeHtml(body.ref)}</strong>` : ''}. Te responderemos a <strong>${escapeHtml(email)}</strong> en un máximo de 48 horas laborables.`;
        form.reset();
        files = [];
        renderList();
        update();
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
      status.innerHTML = `No se ha podido enviar la solicitud: ${escapeHtml(msg)} Mientras lo resolvemos, puedes escribirnos a <a href="mailto:presupuestos@technelatros.es">presupuestos@technelatros.es</a>.`;
    }
  });
})();
