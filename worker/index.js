// Worker de technelatros: sirve el sitio estático y atiende dos formularios.
//
//   POST /api/presupuesto  -> correo al equipo con la documentación adjunta
//                             + acuse de recibo al cliente
//   POST /api/contacto     -> correo al equipo
//
// El correo se envía con la API de Resend (https://resend.com).
// Configuración (ver README.md):
//   secreto  RESEND_API_KEY    clave de API de Resend
//   variable QUOTE_TO          buzón que recibe las solicitudes
//   variable MAIL_FROM         remitente verificado en Resend
//   variable SEND_CONFIRMATION "false" para no enviar acuse al cliente

const ALLOWED = ['pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'xls', 'xlsx', 'ods', 'csv', 'ppt', 'pptx',
  'png', 'jpg', 'jpeg', 'webp', 'heic', 'dwg', 'dxf', 'step', 'stp', 'iges', 'igs', 'stl', 'zip'];
const MAX_FILES = 5;
const MAX_TOTAL = 15 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/presupuesto' || url.pathname === '/api/contacto') {
      if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
      if (!env.RESEND_API_KEY || !env.QUOTE_TO || !env.MAIL_FROM) {
        return json({ error: 'El envío por correo aún no está configurado.' }, 503);
      }
      try {
        return url.pathname === '/api/presupuesto'
          ? await handleQuote(request, env)
          : await handleContact(request, env);
      } catch (err) {
        console.error(err);
        return json({ error: 'No hemos podido procesar la solicitud.' }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleQuote(request, env) {
  const form = await request.formData();
  if (isBot(form)) return json({ ok: true, ref: makeRef() });

  const nombre = field(form, 'nombre', 120);
  const email = field(form, 'email', 200);
  const descripcion = field(form, 'descripcion', 6000);
  if (nombre.length < 2) return json({ error: 'Falta el nombre.' }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: 'El correo no es válido.' }, 400);
  if (descripcion.length < 20) return json({ error: 'La descripción del proyecto es demasiado corta.' }, 400);

  const files = form.getAll('archivos').filter((f) => typeof f === 'object' && f.size > 0);
  if (files.length > MAX_FILES) return json({ error: `Máximo ${MAX_FILES} archivos.` }, 400);

  let total = 0;
  const attachments = [];
  for (const f of files) {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED.includes(ext)) return json({ error: `Formato no admitido: ${f.name}.` }, 400);
    total += f.size;
    if (total > MAX_TOTAL) return json({ error: 'Los archivos superan 15 MB en total.' }, 413);
    attachments.push({ filename: safeName(f.name), content: toBase64(await f.arrayBuffer()) });
  }

  const ref = makeRef();
  const tipo = field(form, 'tipo', 60) || 'Sin especificar';
  const data = {
    Referencia: ref,
    Tipo: tipo,
    Proyecto: field(form, 'titulo', 160),
    Descripción: descripcion,
    Fase: field(form, 'fase', 80),
    Plazo: field(form, 'plazo', 60),
    Ubicación: field(form, 'ubicacion', 160),
    'Presupuesto orientativo': field(form, 'rango', 40),
    Nombre: nombre,
    Correo: email,
    Empresa: field(form, 'empresa', 160),
    Teléfono: field(form, 'telefono', 40),
    'Contacto preferido': field(form, 'contacto_pref', 40),
    'Pide NDA': form.get('nda') === 'si' ? 'Sí, antes de dar más detalles' : '',
    'Enlace de descarga': field(form, 'enlace', 500),
  };

  await sendEmail(env, {
    to: [env.QUOTE_TO],
    reply_to: email,
    subject: `Presupuesto ${ref} · ${tipo} · ${nombre}${data.Empresa ? ` (${data.Empresa})` : ''}`,
    html: table('Nueva solicitud de presupuesto', data)
      + (files.length ? `<p style="font:14px/1.5 -apple-system,Segoe UI,sans-serif"><b>Adjuntos:</b> ${files.map((f) => escapeHtml(f.name)).join(', ')}</p>` : ''),
    attachments,
  });

  if (env.SEND_CONFIRMATION !== 'false') {
    await sendEmail(env, {
      to: [email],
      reply_to: env.QUOTE_TO,
      subject: `Hemos recibido tu solicitud ${ref}`,
      html: `<div style="font:15px/1.6 -apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f1b2d;max-width:560px">
        <p>Hola, ${escapeHtml(nombre)}:</p>
        <p>Hemos recibido tu solicitud de presupuesto con referencia <b style="font-family:monospace;color:#1d3d6b">${ref}</b>${files.length ? ` junto con ${files.length === 1 ? 'el documento' : `los ${files.length} documentos`} que nos has enviado` : ''}.</p>
        <p>La estudiaremos y te responderemos en un máximo de 48 horas laborables. Si necesitamos aclarar el alcance, te contactaremos antes de enviarte la propuesta.</p>
        <p>Puedes responder a este mensaje para añadir información.</p>
        <p style="color:#56627a">— El equipo de technelatros</p>
      </div>`,
    }).catch((err) => console.error('Acuse no enviado', err));
  }

  return json({ ok: true, ref });
}

async function handleContact(request, env) {
  const form = await request.formData();
  if (isBot(form)) return json({ ok: true });

  const nombre = field(form, 'nombre', 120);
  const email = field(form, 'email', 200);
  const mensaje = field(form, 'mensaje', 5000);
  if (nombre.length < 2 || !EMAIL_RE.test(email) || mensaje.length < 10) {
    return json({ error: 'Revisa nombre, correo y mensaje.' }, 400);
  }
  const data = {
    Nombre: nombre,
    Correo: email,
    Organización: field(form, 'organizacion', 160),
    Asunto: field(form, 'asunto', 80),
    Mensaje: mensaje,
  };
  await sendEmail(env, {
    to: [env.QUOTE_TO],
    reply_to: email,
    subject: `Contacto web · ${data.Asunto || 'General'} · ${nombre}`,
    html: table('Nuevo mensaje desde la web', data),
  });
  return json({ ok: true });
}

// ------------------------------------------------------------------ helpers

async function sendEmail(env, payload) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env.MAIL_FROM, ...payload }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

function isBot(form) {
  const trap = form.get('empresa_web');
  const elapsed = parseInt(form.get('elapsed') || '0', 10);
  return Boolean(trap) || (elapsed > 0 && elapsed < 2500);
}

function field(form, name, max) {
  const v = form.get(name);
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function makeRef() {
  const d = new Date();
  const ymd = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  const rnd = crypto.getRandomValues(new Uint8Array(2));
  return `TQ-${ymd}-${[...rnd].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function safeName(name) {
  return name.replace(/[^\w.\- ]+/g, '_').slice(0, 120);
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function table(title, data) {
  const rows = Object.entries(data)
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:6px 14px 6px 0;color:#56627a;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:6px 0;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`)
    .join('');
  return `<div style="font:14px/1.5 -apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f1b2d"><h2 style="font-size:17px;font-weight:600;color:#1d3d6b">${escapeHtml(title)}</h2><table style="border-collapse:collapse">${rows}</table></div>`;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
