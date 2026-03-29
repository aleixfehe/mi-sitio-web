const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');
const year = document.getElementById('year');

if (year) {
  year.textContent = new Date().getFullYear();
}

if (menuToggle && navLinks) {
  menuToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });

  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => navLinks.classList.remove('open'));
  });
}

function showMessage() {
  const message = document.getElementById('formMessage');
  if (message) {
    message.textContent = 'Mensaje de demostración enviado. Sustituye este formulario por tu sistema real de contacto.';
  }
}

window.showMessage = showMessage;
