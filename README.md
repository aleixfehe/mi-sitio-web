# AKRA · sitio web

Web estática de AKRA (ingeniería por proyectos en sensórica quirúrgica
y en sensórica y telecomunicaciones para entornos de difícil acceso), servida
por un Worker de Cloudflare que además envía por correo las solicitudes de
presupuesto y los mensajes de contacto.

## Estructura

| Ruta | Qué es |
| --- | --- |
| `index.html` | Inicio |
| `servicios.html` | Línea de sensórica quirúrgica |
| `entornos-remotos.html` | Línea de sensórica y comunicaciones de difícil acceso |
| `presupuesto.html` | Solicitud de presupuesto para cualquier proyecto, con documentación adjunta |
| `sobre.html`, `contacto.html` | Empresa y contacto general |
| `css/style.css` | Sistema visual (tokens de color y tipografía al principio del archivo) |
| `js/script.js` | Ilustraciones de fondo en canvas, menú, FAQ, formulario de contacto |
| `js/presupuesto.js` | Formulario de presupuesto: adjuntos, resumen en vivo y envío |
| `js/three-kit.js` | Utilidades 3D compartidas (three.js r128 desde cdnjs): visor, luces, ruido, pausa fuera de pantalla |
| `js/scene-hero.js` | Portada: red de sensores sobre un terreno, simulada en vivo |
| `js/scene-instrument.js` | Laboratorio quirúrgico: instrumento, tejido, electrobisturí y fusión de señales |
| `js/scene-node.js` | Nodo de campo en 3D con vista despiezada |
| `js/sim-coverage.js` | Simulación de cobertura con línea de vista sobre un relieve generado |
| `img/logo-mark.svg`, `img/favicon.svg` | Marca AKRA |

Las escenas 3D se pausan cuando no están en pantalla y, si el sistema pide
reducir el movimiento, muestran un fotograma fijo con un botón para reproducir.
| `worker/index.js` | Worker: sirve los estáticos y atiende `/api/presupuesto` y `/api/contacto` |
| `.assetsignore` | Evita publicar el Worker, la configuración y este README como estáticos |

## Activar el envío por correo

Los formularios envían a `/api/presupuesto` y `/api/contacto`. El Worker usa
[Resend](https://resend.com) (plan gratuito: 3.000 correos/mes).

1. Crea una cuenta en Resend y **verifica el dominio** `technelatros.es`
   (añade los registros DNS que te indique).
2. Crea una API key y guárdala como secreto del Worker:
   ```sh
   npx wrangler secret put RESEND_API_KEY
   ```
3. Revisa en `wrangler.jsonc`:
   - `QUOTE_TO`: buzón que recibe las solicitudes (con los documentos adjuntos).
   - `MAIL_FROM`: remitente; debe pertenecer al dominio verificado.
   - `SEND_CONFIRMATION`: `"false"` si no quieres enviar acuse de recibo al cliente.
4. Despliega:
   ```sh
   npx wrangler deploy
   ```

Hasta que el secreto esté configurado, los formularios muestran un error claro
con la dirección de correo alternativa, así que la web se puede publicar antes.

### Límites del formulario de presupuesto

- Obligatorio: descripción del proyecto, nombre, correo y consentimiento.
- Adjuntos opcionales: hasta 5 archivos y 15 MB en total (PDF, documentos,
  hojas de cálculo, imágenes, planos DWG/DXF, CAD, ZIP). Para archivos mayores
  el formulario admite un enlace de descarga.
- Antispam: campo trampa oculto y tiempo mínimo de relleno.

## Probar en local

```sh
npx wrangler dev
```

Abre http://localhost:8787. Para probar el correo en local crea un archivo
`.dev.vars` (no lo subas a git) con `RESEND_API_KEY=re_...`.
