(function () {
  try {
    if (window.top !== window.self) {
      window.top.location = window.self.location;
    }
  } catch (e) {
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

  var singleSetHeight = track.scrollHeight / 2;
  if (!singleSetHeight) return;

  var PIXELS_PER_SECOND = 28;
  var duration = singleSetHeight / PIXELS_PER_SECOND;

  track.style.setProperty("--marquee-distance", "-" + singleSetHeight + "px");
  track.style.setProperty("--marquee-duration", duration + "s");
  track.classList.add("is-marquee");
})();

(function () {
  var containers = document.querySelectorAll(".ascii-avatar");
  var MONO_FONT = "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace";
  var measureCanvas = null;

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

      var refSize = 100;
      var ratio = measureCharWidth(MONO_FONT, refSize) / refSize;
      var fontSize = CHAR_WIDTH / ratio;

      var cols = Math.max(24, Math.floor(containerWidth / CHAR_WIDTH));
      var rows = Math.max(1, Math.round(cols * (h / w) * 0.55));

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
    if (contentWidth <= containerWidth) return;

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
      empty.textContent = "No se encontró ningún resultado para tu búsqueda.";
      resultsEl.appendChild(empty);
      return;
    }

    matches.forEach(function (item) {
      var a = document.createElement("a");
      a.className = "search-result";
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

  function update() {
    slides.forEach(function (s, i) {
      s.classList.toggle("is-active", i === index);
    });
  }

  function next() {
    index = (index + 1) % slides.length;
    update();
  }

  var prefersReducedMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;

  var timer = setInterval(next, 4000);
  carousel.addEventListener("mouseenter", function () { clearInterval(timer); });
  carousel.addEventListener("mouseleave", function () { timer = setInterval(next, 4000); });

  update();
})();

(function () {
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
  // Fondo decorativo tipo "lluvia de Matrix"
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

    // Rastro semitransparente en vez de limpiar todo el frame
    ctx.fillStyle = "rgba(21, 10, 36, 0.15)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = FONT_SIZE + "px monospace";
    for (var i = 0; i < columns.length; i++) {
      var char = CHARS[Math.floor(Math.random() * CHARS.length)];
      var x = i * FONT_SIZE;
      var y = columns[i] * FONT_SIZE;

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

