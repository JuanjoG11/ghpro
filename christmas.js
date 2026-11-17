// christmas.js — Temática navideña sutil para GH Pro
// Guardado en UTF-8. Incluir con: <script src="christmas.js?v=1" defer></script>
(function () {
  'use strict';

  /* ═══════════════════════════════════════════
     CONFIGURACIÓN
  ═══════════════════════════════════════════ */
  var ENABLED  = true;   // Poner en false para desactivar todo
  var SEASONAL = false;  // Poner en true para activar solo del 1-dic al 6-ene

  /* ═══════════════════════════════════════════
     GUARD: evitar duplicados si el script se carga dos veces
  ═══════════════════════════════════════════ */
  if (document.querySelector('.xmas-greet-login, .xmas-greet-banner')) return;

  /* ═══════════════════════════════════════════
     COMPROBACIONES DE HABILITACIÓN
  ═══════════════════════════════════════════ */
  if (!ENABLED) return;

  if (SEASONAL) {
    var now   = new Date();
    var month = now.getMonth() + 1; // 1-12
    var day   = now.getDate();
    var active = (month === 12) || (month === 1 && day <= 6);
    if (!active) return;
  }

  /* ═══════════════════════════════════════════
     DETECCIÓN DE MOVIMIENTO REDUCIDO
  ═══════════════════════════════════════════ */
  var prefersReducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ═══════════════════════════════════════════
     DETECCIÓN DE TEMA CLARO/OSCURO
  ═══════════════════════════════════════════ */
  function isDark() {
    // Prioridad: clase en html/body, luego prefers-color-scheme
    var html = document.documentElement;
    var body = document.body;
    if (html.classList.contains('dark')  || body.classList.contains('dark'))  return true;
    if (html.classList.contains('light') || body.classList.contains('light')) return false;
    if (html.dataset.theme === 'dark'  || body.dataset.theme === 'dark')  return true;
    if (html.dataset.theme === 'light' || body.dataset.theme === 'light') return false;
    // La app usa fondo oscuro (#080d14) por defecto — se considera dark
    return !window.matchMedia || window.matchMedia('(prefers-color-scheme: light)').matches === false;
  }

  /* ═══════════════════════════════════════════
     1. NIEVE
  ═══════════════════════════════════════════ */
  var snowCanvas = document.createElement('canvas');
  snowCanvas.id = 'xmas-snow-canvas';
  snowCanvas.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'width:100%',
    'height:100%',
    'pointer-events:none',
    'z-index:99998',
    'display:block',
  ].join(';');
  document.body.appendChild(snowCanvas);

  var snowCtx   = snowCanvas.getContext('2d');
  var snowFlakes = [];
  var snowAnimId = null;
  var snowPaused = false;

  var FLAKE_COUNT = 60;

  function resizeSnow() {
    snowCanvas.width  = window.innerWidth;
    snowCanvas.height = window.innerHeight;
  }

  function randomBetween(a, b) {
    return a + Math.random() * (b - a);
  }

  function createFlake() {
    return {
      x:     randomBetween(0, snowCanvas.width),
      y:     randomBetween(-snowCanvas.height, 0),
      r:     randomBetween(1.5, 3.5),          // radio
      speed: randomBetween(0.4, 1.0),           // velocidad vertical
      drift: randomBetween(-0.3, 0.3),          // balanceo horizontal
      angle: randomBetween(0, Math.PI * 2),     // fase del balanceo
      freq:  randomBetween(0.005, 0.015),       // frecuencia del balanceo
    };
  }

  function initFlakes() {
    snowFlakes = [];
    for (var i = 0; i < FLAKE_COUNT; i++) {
      var f = createFlake();
      f.y = randomBetween(0, snowCanvas.height); // distribuir al inicio
      snowFlakes.push(f);
    }
  }

  function drawSnow() {
    if (snowPaused || prefersReducedMotion) return;

    snowCtx.clearRect(0, 0, snowCanvas.width, snowCanvas.height);

    var flakeColor = isDark() ? 'rgba(255,255,255,0.3)' : 'rgba(80,80,100,0.25)';
    snowCtx.fillStyle = flakeColor;

    for (var i = 0; i < snowFlakes.length; i++) {
      var f = snowFlakes[i];
      f.angle += f.freq;
      f.x += Math.sin(f.angle) * 0.6 + f.drift;
      f.y += f.speed;

      // Reciclar cuando sale por abajo o los lados
      if (f.y > snowCanvas.height + 10) {
        f.y = -10;
        f.x = randomBetween(0, snowCanvas.width);
      }
      if (f.x < -10) f.x = snowCanvas.width + 5;
      if (f.x > snowCanvas.width + 10) f.x = -5;

      snowCtx.beginPath();
      snowCtx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      snowCtx.fill();
    }

    snowAnimId = requestAnimationFrame(drawSnow);
  }

  function startSnow() {
    if (prefersReducedMotion) return;
    if (snowAnimId) cancelAnimationFrame(snowAnimId);
    snowAnimId = requestAnimationFrame(drawSnow);
  }

  function stopSnow() {
    if (snowAnimId) {
      cancelAnimationFrame(snowAnimId);
      snowAnimId = null;
    }
    snowCtx.clearRect(0, 0, snowCanvas.width, snowCanvas.height);
  }

  resizeSnow();
  initFlakes();
  startSnow();

  window.addEventListener('resize', function () {
    resizeSnow();
    initFlakes();
  });

  // Pausa cuando la pestaña no es visible
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      snowPaused = true;
      if (snowAnimId) {
        cancelAnimationFrame(snowAnimId);
        snowAnimId = null;
      }
    } else {
      snowPaused = false;
      startSnow();
    }
  });

  /* ═══════════════════════════════════════════
     2. GORRITO DE NAVIDAD (canvas 2D puro)
  ═══════════════════════════════════════════ */

  // Target: .logo-icon (el cuadrado azul con 🏢 en el sidebar / topbar).
  // El gorrito se posa en la esquina SUPERIOR-DERECHA del ícono,
  // con la punta apuntando hacia arriba-derecha (rotación +45°).
  //
  // Posicionamiento:
  //   canvas.left = r.right  - HAT_SIZE * 0.5   (centro en el borde derecho)
  //   canvas.top  = r.top    - HAT_SIZE * 0.5   (centro en el borde superior)
  // → el centro del canvas cae sobre la esquina sup-der del logo-icon.
  // El gorro se dibuja centrado en el canvas con la punta en la esquina sup-der
  // del propio canvas, así la punta queda exactamente sobre la esquina del ícono.

  var HAT_SIZE = 54; // canvas cuadrado 54×54 — discreto, proporcional al logo-icon de 44px

  var hatCanvas = document.createElement('canvas');
  hatCanvas.id = 'xmas-hat-canvas';
  hatCanvas.width  = HAT_SIZE;
  hatCanvas.height = HAT_SIZE;
  hatCanvas.style.cssText = [
    'position:fixed',
    'z-index:99999',
    'pointer-events:none',
    'display:block',
  ].join(';');
  document.body.appendChild(hatCanvas);

  function drawHat() {
    var ctx = hatCanvas.getContext('2d');
    var S = HAT_SIZE; // 54
    ctx.clearRect(0, 0, S, S);

    // Dibujamos el gorro en posición "natural": punta arriba, base abajo,
    // centrado en el canvas. Luego rotamos +45° para que la punta apunte
    // hacia arriba-derecha (esquina sup-der del canvas = esquina sup-der del logo-icon).
    //
    // Dimensiones del gorro en posición natural:
    var hatW  = 32;  // ancho de la base
    var hatH  = 38;  // alto del cono
    var pompR = 5;   // radio del pompón
    var bandRx = 17; // semieje X de la banda blanca
    var bandRy = 7;  // semieje Y de la banda blanca

    var cx = S / 2;       // 27 — centro del canvas
    var cy = S / 2;       // 27
    var bx = cx;          // base centrada en x
    var by = cy + 6;      // base ligeramente bajo el centro
    var tx = cx;          // punta centrada en x
    var ty = by - hatH;   // punta arriba

    ctx.save();
    // Rotar +45° alrededor del centro del canvas:
    // la punta (que estaba arriba-centro) queda arriba-derecha
    ctx.translate(cx, cy);
    ctx.rotate((45 * Math.PI) / 180);
    ctx.translate(-cx, -cy);

    // ── Cono rojo ──
    ctx.shadowColor   = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur    = 5;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    var grad = ctx.createLinearGradient(bx, by, tx, ty);
    grad.addColorStop(0,   '#7a0000');
    grad.addColorStop(0.4, '#c41a1a');
    grad.addColorStop(1,   '#ff4444');
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(bx - hatW / 2, by);
    ctx.quadraticCurveTo(bx - hatW * 0.10, (by + ty) / 2, tx, ty);
    ctx.quadraticCurveTo(bx + hatW * 0.10, (by + ty) / 2, bx + hatW / 2, by);
    ctx.closePath();
    ctx.fill();

    // ── Banda blanca ──
    ctx.shadowColor   = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur    = 3;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(bx, by, bandRx, bandRy, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Pompón blanco ──
    ctx.shadowColor   = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur    = 3;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(tx, ty, pompR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function pickHatTarget() {
    // Target principal: .logo-icon (el cuadradito azul con el emoji de edificio)
    var logoIcon = document.querySelector('.logo-icon');
    if (logoIcon) return logoIcon;

    // Fallback móvil: .topbar-logo si está visible
    var topbar = document.querySelector('.topbar');
    if (topbar && window.getComputedStyle(topbar).display !== 'none') {
      var tbLogo = topbar.querySelector('.topbar-logo') || topbar;
      return tbLogo;
    }

    // Fallback login: el .card del formulario
    var card = document.querySelector('.card');
    if (card) return card;

    return null;
  }

  function positionHat() {
    var target = pickHatTarget();
    if (!target) { hatCanvas.style.display = 'none'; return; }

    hatCanvas.style.display = 'block';
    var r = target.getBoundingClientRect();

    // Centro del canvas sobre la esquina SUPERIOR-DERECHA del target
    var left = r.right  - HAT_SIZE * 0.5;
    var top  = r.top    - HAT_SIZE * 0.5;

    // Clamp: no salir por los bordes de la pantalla
    left = Math.max(0, Math.min(left, window.innerWidth  - HAT_SIZE));
    top  = Math.max(0, Math.min(top,  window.innerHeight - HAT_SIZE));

    hatCanvas.style.left = left + 'px';
    hatCanvas.style.top  = top  + 'px';
  }

  drawHat();
  positionHat();

  window.addEventListener('resize', positionHat);
  window.addEventListener('scroll', positionHat, { passive: true });
  window.addEventListener('load', function () {
    positionHat();
    setTimeout(positionHat, 600);
  });

  /* ═══════════════════════════════════════════
     3. TEXTO FESTIVO
  ═══════════════════════════════════════════ */

  /* Estilos comunes inyectados una sola vez */
  var style = document.createElement('style');
  style.textContent = [
    // Degradado de texto: emojis en span separado para no romperse
    '.xmas-gradient-text {',
    '  background: linear-gradient(90deg, #fbbf24, #ef4444, #22c55e);',
    '  -webkit-background-clip: text;',
    '  background-clip: text;',
    '  -webkit-text-fill-color: transparent;',
    '  color: transparent;',
    '}',
    '.xmas-emoji {',
    '  background: none !important;',
    '  -webkit-background-clip: initial !important;',
    '  background-clip: initial !important;',
    '  -webkit-text-fill-color: initial !important;',
    '  color: initial !important;',
    '  display: inline-block;',
    '}',
    // Saludo bajo el título de login
    '.xmas-greet-login {',
    '  display: block;',
    '  text-align: center;',
    '  font-size: 15px;',
    '  font-weight: 600;',
    '  letter-spacing: 0.3px;',
    '  margin-top: 6px;',
    '  line-height: 1.4;',
    '}',
    // Banner en dashboard
    '.xmas-greet-banner {',
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '  gap: 6px;',
    '  padding: 8px 16px;',
    '  margin-bottom: 20px;',
    '  background: rgba(251,191,36,0.07);',
    '  border: 1px solid rgba(251,191,36,0.20);',
    '  border-radius: 10px;',
    '  font-size: 14px;',
    '  font-weight: 600;',
    '  letter-spacing: 0.2px;',
    '}',
  ].join('\n');
  document.head.appendChild(style);

  /* Esperar al DOM completo */
  function insertGreeting() {
    // ── Pantalla de LOGIN: agregar bajo el .header-title ──
    var headerTitle = document.querySelector('.header-title');
    if (headerTitle && !document.querySelector('.xmas-greet-login')) {
      var loginGreet = document.createElement('div');
      loginGreet.className = 'xmas-greet-login';
      loginGreet.innerHTML =
        '<span class="xmas-emoji">&#127876;</span>' +
        '<span class="xmas-gradient-text"> &iexcl;Feliz Navidad! </span>' +
        '<span class="xmas-emoji">&#127877;</span>';
      headerTitle.insertAdjacentElement('afterend', loginGreet);
    }

    // ── Dashboard: agregar banner al inicio del contenido principal ──
    // Buscamos el primer .page.active o .main-content, o el primer .page-header
    var dashTarget =
      document.querySelector('.page-header') ||
      document.querySelector('.main-content') ||
      document.querySelector('.page.active');

    if (dashTarget && !document.querySelector('.xmas-greet-banner')) {
      var banner = document.createElement('div');
      banner.className = 'xmas-greet-banner';
      banner.innerHTML =
        '<span class="xmas-emoji">&#127876;</span>' +
        '<span class="xmas-gradient-text"> &iexcl;Feliz Navidad y Pr&oacute;spero A&ntilde;o Nuevo! </span>' +
        '<span class="xmas-emoji">&#127877;</span>';
      dashTarget.insertAdjacentElement('beforebegin', banner);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', insertGreeting);
  } else {
    insertGreeting();
    // Segundo intento por si el dashboard renderiza el .page-header después
    setTimeout(insertGreeting, 400);
  }

})();
