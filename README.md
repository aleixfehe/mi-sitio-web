# technelatros · sitio web

Web estática de technelatros (sensórica quirúrgica + impresión 3D por proyectos),
servida por un Worker de Cloudflare que además envía por correo las solicitudes
de presupuesto y los mensajes de contacto.

## Estructura

| Ruta | Qué es |
| --- | --- |
| `index.html` | Inicio |
| `servicios.html` | Línea de sensórica quirúrgica |
| `impresion-3d.html` | Tecnologías, materiales y guía de diseño |
| `presupuesto.html` | Subida de modelos 3D y solicitud de presupuesto |
| `sobre.html`, `contacto.html` | Empresa y contacto |
| `css/style.css` | Sistema visual completo (tokens de color, tipografía, componentes) |
| `js/script.js` | Ilustraciones de fondo en canvas, menú, FAQ, formulario de contacto |
| `js/presupuesto.js` | Análisis de STL/OBJ en el navegador, vista 3D y envío |
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
   - `QUOTE_TO`: buzón que recibe las solicitudes (con los archivos adjuntos).
   - `MAIL_FROM`: remitente; debe pertenecer al dominio verificado.
   - `SEND_CONFIRMATION`: `"false"` si no quieres enviar acuse de recibo al cliente.
4. Despliega:
   ```sh
   npx wrangler deploy
   ```

Hasta que el secreto esté configurado, los formularios muestran un error claro
con la dirección de correo alternativa, así que la web se puede publicar antes.

### Límites

- Presupuesto: hasta 5 archivos y 15 MB en total por solicitud (se adjuntan al
  correo). Para archivos mayores el formulario pide un enlace de descarga.
- Formatos: STL, OBJ, 3MF, STEP/STP, IGES/IGS, DXF, ZIP, PDF, PNG, JPG.
- Antispam: campo trampa oculto y tiempo mínimo de relleno.

## Probar en local

```sh
npx wrangler dev
```

Abre http://localhost:8787. Para probar el correo en local crea un archivo
`.dev.vars` (no lo subas a git) con `RESEND_API_KEY=re_...`.

## Ajustar datos técnicos

Volúmenes de impresión, densidades de material y el modelo de tiempo de
máquina están al principio de `js/presupuesto.js` (`TECH` y `MATERIALS`).
Si cambias de máquinas, actualiza también las cifras de `impresion-3d.html`.
