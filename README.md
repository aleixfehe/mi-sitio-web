<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Proyectos Electromecánicos - Aleix Fehe</title>
  <style>
    /* ===== Estilos generales ===== */
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Segoe UI", Roboto, sans-serif;
      background-color: #0f1116;
      color: #e0e0e0;
      line-height: 1.6;
    }

    header {
      background: linear-gradient(90deg, #0077ff, #00b894);
      padding: 1.5rem 2rem;
      text-align: center;
      color: white;
    }

    header h1 {
      font-size: 2rem;
      letter-spacing: 1px;
    }

    nav {
      background-color: #12141a;
      display: flex;
      justify-content: center;
      gap: 1.5rem;
      padding: 1rem;
    }

    nav a {
      color: #00b894;
      text-decoration: none;
      font-weight: bold;
      transition: 0.3s;
    }

    nav a:hover {
      color: #0077ff;
    }

    .container {
      max-width: 1000px;
      margin: 2rem auto;
      padding: 0 1rem;
    }

    section {
      margin-bottom: 3rem;
    }

    h2 {
      color: #00b894;
      border-left: 4px solid #0077ff;
      padding-left: 10px;
      margin-bottom: 1rem;
    }

    .project {
      background-color: #1b1e26;
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 1rem;
      transition: 0.3s;
    }

    .project:hover {
      transform: translateY(-4px);
      background-color: #222631;
    }

    footer {
      background-color: #12141a;
      color: #aaa;
      text-align: center;
      padding: 1rem 0;
      margin-top: 2rem;
      font-size: 0.9rem;
    }

    .contacto a {
      color: #00b894;
      text-decoration: none;
    }
    .contacto a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <header>
    <h1>Proyectos Electromecánicos y Desarrollos Tecnológicos</h1>
    <p>Innovación, ingeniería y tecnología aplicada</p>
  </header>

  <nav>
    <a href="#sobre-mi">Sobre mí</a>
    <a href="#proyectos">Proyectos</a>
    <a href="#contacto">Contacto</a>
  </nav>

  <div class="container">
    <section id="sobre-mi">
      <h2>Sobre mí</h2>
      <p>
        Soy un desarrollador y técnico electromecánico apasionado por la automatización, la robótica y el desarrollo tecnológico.
        Combino la ingeniería mecánica, eléctrica y de software para crear soluciones innovadoras.
      </p>
    </section>

    <section id="proyectos">
      <h2>Proyectos destacados</h2>

      <div class="project">
        <h3>🚗 Sistema de control electromecánico</h3>
        <p>
          Desarrollo de un sistema de control de motores con sensores de posición y control por microcontrolador.
        </p>
      </div>

      <div class="project">
        <h3>🤖 Brazo robótico automatizado</h3>
        <p>
          Diseño y construcción de un brazo robótico controlado por servomotores, programado con Arduino.
        </p>
      </div>

      <div class="project">
        <h3>🌐 Plataforma IoT para monitoreo industrial</h3>
        <p>
          Proyecto de red de sensores conectados que recopilan datos en tiempo real mediante conexión Wi-Fi y dashboard web.
        </p>
      </div>
    </section>

    <section id="contacto" class="contacto">
      <h2>Contacto</h2>
      <p>📧 <a href="mailto:tuemail@ejemplo.com">tuemail@ejemplo.com</a></p>
      <p>🌍 <a href="https://github.com/aleixfehe" target="_blank">github.com/aleixfehe</a></p>
    </section>
  </div>

  <footer>
    <p>© 2025 Aleix Fehe — Todos los derechos reservados.</p>
  </footer>
</body>
</html>
