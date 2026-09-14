(function () {
  // "Frame buster" básico contra clickjacking: si el sitio se está
  // mostrando dentro de un <iframe> de otro dominio, lo saca de ahí.
  // No sustituye a la cabecera X-Frame-Options / CSP frame-ancestors
  // (GitHub Pages no permite mandar esas), pero sí es una capa extra
  // de defensa razonable para un sitio estático sin backend.
  try {
    if (window.top !== window.self) {
      window.top.location = window.self.location;
    }
  } catch (e) {
    // Si el navegador bloquea el acceso a window.top por política de
    // mismo origen, lo más probable es que ya estemos en un iframe de
    // otro dominio: igual intentamos escapar.
    window.top.location = window.self.location;
  }
})();

(function () {
  var btn = document.getElementById("backToTop");
  if (!btn) return;

  var onScroll = function () {
    if (window.scrollY > 480) {
      btn.classList.add("visible");
    } else {
      btn.classList.remove("visible");
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();

(function () {
  var sideToc = document.querySelector(".side-toc");
  var indice = document.getElementById("indice");
  if (!sideToc || !indice || !("IntersectionObserver" in window)) return;

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        // Se activa cuando el usuario ya bajó más allá del índice
        // (el índice salió de la vista por arriba).
        var scrolledPast = entry.boundingClientRect.top < 0 && !entry.isIntersecting;
        sideToc.classList.toggle("visible", scrolledPast);
      });
    },
    { threshold: 0 }
  );
  observer.observe(indice);
})();

(function () {
  var links = document.querySelectorAll(".side-toc nav a[href^='#']");
  if (!links.length || !("IntersectionObserver" in window)) return;

  var linkByHash = {};
  links.forEach(function (a) {
    linkByHash[a.getAttribute("href")] = a;
  });

  var setActive = function (hash) {
    links.forEach(function (a) { a.classList.remove("is-active"); });
    var link = linkByHash[hash];
    if (link) {
      link.classList.add("is-active");
      // El índice flotante tiene su propio scroll interno (max-height +
      // overflow-y: auto); sin esto, el ítem activo se sale de la vista
      // y hay que desplazarlo a mano dentro de esa cajita.
      link.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  };

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setActive("#" + entry.target.id);
      });
    },
    { rootMargin: "-15% 0px -75% 0px" }
  );

  Object.keys(linkByHash).forEach(function (hash) {
    var el = document.querySelector(hash);
    if (el) observer.observe(el);
  });
})();

(function () {
  var track = document.getElementById("postCarouselTrack");
  if (!track) return;

  // El contenido está duplicado dos veces en el HTML (ver index.html) para
  // que el scroll continuo se vea infinito sin salto visible. Medimos la
  // altura de una sola copia y usamos eso como la distancia del loop, para
  // que la velocidad sea constante sin importar cuántos posts tengas.
  var singleSetHeight = track.scrollHeight / 2;
  if (!singleSetHeight) return;

  var PIXELS_PER_SECOND = 28;
  var duration = singleSetHeight / PIXELS_PER_SECOND;

  track.style.setProperty("--marquee-distance", "-" + singleSetHeight + "px");
  track.style.setProperty("--marquee-duration", duration + "s");
  track.classList.add("is-marquee");
})();

(function () {
  // Generador de ASCII art reutilizable: busca cualquier ".ascii-avatar"
  // en la página (puede haber más de uno, ej. inicio y Acerca de mí) y
  // convierte su imagen a texto.
  //
  // El número de columnas YA NO es un número fijo (eso causaba que en
  // celular el bloque de texto fuera más ancho que la pantalla y
  // metiera scroll horizontal a toda la página). Ahora se calcula según
  // el espacio real disponible del contenedor, así que se ajusta solo
  // sin importar el tamaño de pantalla — y se recalcula si la pantalla
  // cambia de tamaño (por ejemplo, al girar el celular).
  var containers = document.querySelectorAll(".ascii-avatar");
  var MONO_FONT = "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace";
  var measureCanvas = null;

  // El font-size en px de una fuente NO es el ancho real que ocupa un
  // carácter en pantalla (en monoespaciadas suele ser bastante menor).
  // Antes se asumía que eran iguales, así que el arte ASCII terminaba
  // renderizando más chico que el contenedor real que le tocaba (y con
  // el ajuste responsive el contenedor cambió de tamaño, haciendo el
  // problema más notorio: por eso se veía "movida"/chica la imagen).
  // Aquí medimos el ancho real con Canvas, con la fuente que esté
  // activa en ese momento, para que el cálculo de columnas siempre
  // llene el espacio disponible de verdad.
  function measureCharWidth(fontFamily, fontSizePx) {
    if (!measureCanvas) measureCanvas = document.createElement("canvas");
    var ctx = measureCanvas.getContext("2d");
    ctx.font = fontSizePx + "px " + fontFamily;
    return ctx.measureText("0").width || fontSizePx * 0.6;
  }

  containers.forEach(function (container) {
    var img = container.querySelector(".ascii-source");
    var pre = container.querySelector(".ascii-output");
    if (!img || !pre) return;

    var CHARS = " .:-=+*#%@";
    // Ancho VISUAL deseado por caracter (controla el nivel de detalle).
    var CHAR_WIDTH = parseFloat(container.getAttribute("data-char-width")) || 4.4;

    function render() {
      var w = img.naturalWidth;
      var h = img.naturalHeight;
      if (!w || !h) return;

      var containerWidth = container.clientWidth;
      if (!containerWidth) return; // contenedor oculto o aún sin layout

      // Con la fuente ya activa, calculamos el font-size real necesario
      // para que un carácter mida CHAR_WIDTH px en pantalla (en vez de
      // asumirlo, que es lo que causaba el tamaño incorrecto).
      var refSize = 100;
      var ratio = measureCharWidth(MONO_FONT, refSize) / refSize;
      var fontSize = CHAR_WIDTH / ratio;

      var cols = Math.max(24, Math.floor(containerWidth / CHAR_WIDTH));
      // 0.55 corrige que un caracter de monoespaciado es más alto que ancho,
      // si no la imagen resultante se ve "estirada" verticalmente.
      var rows = Math.max(1, Math.round(cols * (h / w) * 0.55));

      // Redondeamos a pixeles enteros. Si font-size o line-height quedan
      // con decimales (ej. 4.98297px), el navegador redondea cada línea
      // por separado al pintar, y ese redondeo se va acumulando: cada
      // pocas líneas "roba" o "suelta" un pixel de más, formando bandas
      // oscuras horizontales cada 5 renglones aprox. Con números enteros
      // ese acumulado desaparece.
      fontSize = Math.max(1, Math.round(fontSize));
      var lineHeight = fontSize + 1;

      pre.style.fontSize = fontSize + "px";
      pre.style.lineHeight = lineHeight + "px";

      var canvas = document.createElement("canvas");
      canvas.width = cols;
      canvas.height = rows;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, cols, rows);

      var data;
      try {
        data = ctx.getImageData(0, 0, cols, rows).data;
      } catch (e) {
        return; // no se pudo leer el canvas: se queda la imagen normal como respaldo
      }

      var lines = [];
      for (var y = 0; y < rows; y++) {
        var line = "";
        for (var x = 0; x < cols; x++) {
          var i = (y * cols + x) * 4;
          var r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          var brightness = a === 0 ? 0 : (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          var charIndex = Math.min(CHARS.length - 1, Math.floor(brightness * CHARS.length));
          line += CHARS.charAt(charIndex);
        }
        lines.push(line);
      }

      pre.textContent = lines.join("\n");
      pre.classList.add("is-ready");
      img.classList.add("is-hidden");
    }

    if (img.complete && img.naturalWidth) {
      render();
    } else {
      img.addEventListener("load", render);
    }

    // Si la fuente real todavía no había cargado en el primer render, el
    // navegador la sustituye después y el ancho de carácter cambia.
    // Recalculamos una vez que ya está lista para que el tamaño final
    // quede exacto.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(render);
    }

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(render, 200);
    });
  });
})();

(function () {
  var containers = document.querySelectorAll(".tag-marquee");
  containers.forEach(function (container) {
    var track = container.querySelector(".tag-marquee-track");
    if (!track) return;

    var containerWidth = container.clientWidth;
    var contentWidth = track.scrollWidth;
    if (contentWidth <= containerWidth) return; // ya caben todas, no hace falta animar

    // Duplicamos el contenido una sola vez para que el loop se vea
    // continuo. Envolvemos cada mitad en un span marcador (display:contents,
    // no afecta el layout normal) para poder distinguir "la copia real" de
    // "la copia del loop" y ocultar esta última en el hover-expandido.
    var original = track.innerHTML;
    track.innerHTML =
      '<span class="tag-marquee-original">' + original + '</span>' +
      '<span class="tag-marquee-duplicate" aria-hidden="true">' + original + '</span>';

    var speed = 35; // px por segundo
    var duration = contentWidth / speed;
    track.style.setProperty("--tag-marquee-distance", "-" + contentWidth + "px");
    track.style.setProperty("--tag-marquee-duration", duration + "s");
    track.classList.add("is-marquee");
  });
})();

(function () {
  var input = document.getElementById("searchInput");
  var resultsEl = document.getElementById("searchResults");
  if (!input || !resultsEl) return;

  var data = null;
  var loadFailed = false;

  // El índice lo genera Hugo en cada build (search-index.json), no viene
  // de ningún servidor externo ni de una base de datos con la que el
  // usuario pueda interactuar: es un archivo estático más del sitio.
  // La URL viene de un data-attribute puesto por Hugo (en vez de una
  // ruta fija "/search-index.json" aquí) porque este archivo JS no
  // sabe nada de baseURL -- si el sitio algún día vive en una
  // subcarpeta (como al probarlo en un repo que no es usuario.github.io),
  // una ruta fija con "/" al inicio se iría a la raíz del dominio y
  // rompería el buscador ahí.
  var searchIndexUrl = input.getAttribute("data-search-index-url") || "/search-index.json";
  fetch(searchIndexUrl)
    .then(function (res) {
      if (!res.ok) throw new Error("no ok");
      return res.json();
    })
    .then(function (json) { data = Array.isArray(json) ? json : []; })
    .catch(function () { loadFailed = true; });

  function typeLabel(type) {
    if (type === "post") return "Writeup";
    if (type === "category") return "Categoría";
    if (type === "tag") return "Etiqueta";
    return "";
  }

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function render(rawQuery) {
    clear(resultsEl);

    if (loadFailed) {
      var err = document.createElement("p");
      err.className = "search-empty";
      err.textContent = "No se pudo cargar el índice de búsqueda. Intenta recargar la página.";
      resultsEl.appendChild(err);
      return;
    }
    if (!data) return; // el índice aún está cargando

    var query = rawQuery.trim();
    if (!query) return;

    // Búsqueda: solo comparación de texto plano en minúsculas (indexOf),
    // nunca se construye una expresión regular a partir de lo que escribe
    // el usuario ni se evalúa como código.
    var q = query.toLowerCase();
    var matches = data
      .filter(function (item) {
        if (item.title && item.title.toLowerCase().indexOf(q) !== -1) return true;
        if (item.excerpt && item.excerpt.toLowerCase().indexOf(q) !== -1) return true;
        if (Array.isArray(item.tags) && item.tags.some(function (t) { return String(t).toLowerCase().indexOf(q) !== -1; })) return true;
        if (Array.isArray(item.categories) && item.categories.some(function (c) { return String(c).toLowerCase().indexOf(q) !== -1; })) return true;
        return false;
      })
      .slice(0, 40);

    if (!matches.length) {
      var empty = document.createElement("p");
      empty.className = "search-empty";
      // Mensaje genérico y fijo, sin incluir nada de lo que escribió el
      // usuario: así se elimina por completo ese vector, no solo se mitiga.
      empty.textContent = "No se encontró ningún resultado para tu búsqueda.";
      resultsEl.appendChild(empty);
      return;
    }

    matches.forEach(function (item) {
      var a = document.createElement("a");
      a.className = "search-result";
      // El href sale de item.url, que Hugo generó en build time a partir
      // de contenido real del sitio — el usuario nunca controla a dónde
      // apunta un resultado, solo qué tan visible es.
      a.href = item.url;

      var kind = document.createElement("span");
      kind.className = "search-result-kind";
      kind.textContent = typeLabel(item.type);
      a.appendChild(kind);

      var title = document.createElement("span");
      title.className = "search-result-title";
      title.textContent = item.title || "";
      a.appendChild(title);

      if (item.excerpt) {
        var excerpt = document.createElement("span");
        excerpt.className = "search-result-excerpt";
        excerpt.textContent = item.excerpt;
        a.appendChild(excerpt);
      }
      if (typeof item.count === "number") {
        var count = document.createElement("span");
        count.className = "search-result-count";
        count.textContent = item.count + " publicaci" + (item.count === 1 ? "ón" : "ones");
        a.appendChild(count);
      }

      resultsEl.appendChild(a);
    });
  }

  var debounceTimer;
  input.addEventListener("input", function () {
    clearTimeout(debounceTimer);
    var value = input.value;
    debounceTimer = setTimeout(function () { render(value); }, 120);
  });
})();

(function () {
  var carousel = document.getElementById("certCarousel");
  if (!carousel) return;
  var track = carousel.querySelector(".cert-track");
  var slides = track ? Array.prototype.slice.call(track.children) : [];
  if (!track || slides.length < 2) return;

  var index = 0;
  slides.forEach(function (s, i) {
    if (s.classList.contains("is-active")) index = i;
  });

  // Con pocas certificaciones (típicamente 3), es más simple y confiable
  // dejarlas fijas en fila y solo alternar cuál se ve "activa" (grande y
  // brillante) en vez de mover el carrusel en píxeles — eso dependía de
  // medir anchos con JS y fallaba según el tamaño de pantalla.
  function update() {
    slides.forEach(function (s, i) {
      s.classList.toggle("is-active", i === index);
    });
  }

  function next() {
    index = (index + 1) % slides.length;
    update();
  }

  // Respeta "reducir movimiento" del sistema operativo: si está activado,
  // ni siquiera arrancamos el auto-avance (esto es JS, no CSS, así que la
  // regla global de animaciones reducidas no lo cubre por sí sola).
  var prefersReducedMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;

  var timer = setInterval(next, 4000);
  carousel.addEventListener("mouseenter", function () { clearInterval(timer); });
  carousel.addEventListener("mouseleave", function () { timer = setInterval(next, 4000); });

  update();
})();

(function () {
  // Ver certificación en grande (para poder escanear el QR de verificación).
  var lightbox = document.getElementById("certLightbox");
  var lightboxImg = document.getElementById("certLightboxImg");
  if (!lightbox || !lightboxImg) return;

  document.querySelectorAll(".cert-slide img").forEach(function (img) {
    img.addEventListener("click", function () {
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt;
      lightbox.classList.add("is-open");
    });
  });

  lightbox.addEventListener("click", function () {
    lightbox.classList.remove("is-open");
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") lightbox.classList.remove("is-open");
  });
})();

(function () {
  // Fondo decorativo tipo "lluvia de Matrix" SOLO detrás del hero de la
  // página principal (ver el comentario en main.css sobre por qué no va
  // en el resto del sitio). Cuidados de rendimiento a propósito:
  //   - Limitado a ~24 fps (no tiene sentido correr a 60 para este
  //     efecto, y ahorra CPU/batería en equipos modestos).
  //   - Se pausa por completo si la pestaña no está visible.
  //   - Se desactiva si el usuario pidió prefers-reduced-motion.
  //   - pointer-events:none en el canvas (CSS) para que nunca estorbe
  //     clicks sobre el contenido real de encima.
  var canvas = document.getElementById("heroMatrixBg");
  if (!canvas) return;

  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return; // se queda el fondo del hero liso, sin animación
  }

  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var CHARS = "01アイウエオカキクケコサシスセソタチツテトABCDEF";
  var FONT_SIZE = 15;
  var FPS = 24;
  var frameInterval = 1000 / FPS;
  var lastFrameTime = 0;
  var columns = [];
  var rafId = null;
  var running = false;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    var colCount = Math.floor(canvas.width / FONT_SIZE);
    columns = new Array(colCount).fill(0).map(function () {
      // Arrancan en alturas al azar para que no caigan todas en fila.
      return Math.random() * -canvas.height / FONT_SIZE;
    });
  }

  function draw(timestamp) {
    if (!running) return;
    rafId = requestAnimationFrame(draw);

    if (timestamp - lastFrameTime < frameInterval) return;
    lastFrameTime = timestamp;

    // Rastro semitransparente en vez de limpiar todo el frame: es lo
    // que da el efecto de "estela" cayendo, sin necesidad de dibujar
    // capas extra.
    ctx.fillStyle = "rgba(21, 10, 36, 0.15)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = FONT_SIZE + "px monospace";
    for (var i = 0; i < columns.length; i++) {
      var char = CHARS[Math.floor(Math.random() * CHARS.length)];
      var x = i * FONT_SIZE;
      var y = columns[i] * FONT_SIZE;

      // De vez en cuando un carácter en magenta para que combine con
      // los acentos del sitio, en vez del típico verde de Matrix.
      ctx.fillStyle = Math.random() > 0.94 ? "#FF2E9A" : "#00E5FF";
      ctx.fillText(char, x, y);

      if (y > canvas.height && Math.random() > 0.975) {
        columns[i] = 0;
      } else {
        columns[i]++;
      }
    }
  }

  function start() {
    if (running) return;
    running = true;
    lastFrameTime = 0;
    rafId = requestAnimationFrame(draw);
  }
  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
  }

  resize();
  start();

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop(); else start();
  });

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 200);
  });
})();

