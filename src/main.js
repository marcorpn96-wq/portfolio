import './style.css';

// Funzione per avviare il loader di caricamento
function initLoader() {
  let container = document.getElementById("loader");
  let progressBar = document.getElementById("progress-bar");
  let progressText = document.getElementById("loading-text");
  const messages = [
    "inizializzazione...",
    "caricamento assets...",
    "avvio interfaccia...",
    "pronto ✓"
  ];
  let progress = 0;
  let messageIndex = 0;

  let interval = setInterval(function () {
    progress = Math.min(progress + 18 * Math.random() + 6, 100);
    progressBar.style.width = progress + "%";

    let currentMessage = Math.floor(progress / 100 * (messages.length - 1));
    if (currentMessage !== messageIndex) {
      messageIndex = currentMessage;
      progressText.textContent = messages[messageIndex];
    }

    if (progress >= 100) {
      clearInterval(interval);
      progressText.textContent = messages[messages.length - 1];
      setTimeout(function () {
        container.classList.add("hidden");
      }, 520);
    }
  }, 80);
}

// Funzione per avviare il cursore personalizzato
function initCursor() {
  let cursorDot = document.getElementById("cursor-dot");
  let cursorRing = document.getElementById("cursor-ring");
  let mouseX = 0;
  let mouseY = 0;
  let dotX = 0;
  let dotY = 0;
  let lastTime = 0;
  let currentSectionClass = null;

  function updateSectionClass(target) {
    let section = target ? target.closest("section") : null;
    let newClass = section && section.id ? `cursor-section-${section.id}` : null;
    if (newClass === currentSectionClass) return;
    if (currentSectionClass) document.body.classList.remove(currentSectionClass);
    currentSectionClass = newClass;
    if (currentSectionClass) document.body.classList.add(currentSectionClass);
  }

  // Aggiornamento posizione cursore
  document.addEventListener("mousemove", function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursorDot.style.transform =
      "translate(calc(" + mouseX + "px - 50%), calc(" + mouseY + "px - 50%))";
    updateSectionClass(e.target);
  });

  // Animazione smooth del ring
  requestAnimationFrame(function animate(time) {
    if (time - lastTime < 16) {
      requestAnimationFrame(animate);
      return;
    }
    lastTime = time;
    dotX += 0.12 * (mouseX - dotX);
    dotY += 0.12 * (mouseY - dotY);
    cursorRing.style.transform =
      "translate(calc(" + dotX + "px - 50%), calc(" + dotY + "px - 50%))";
    requestAnimationFrame(animate);
  });

  // Selector per elementi interattivi
  let interactiveSelector =
    "a, button, .project-card, .tech-card, input, textarea, .contact-link";

  // Effetto hover
  document.addEventListener("mouseover", function (e) {
    if (e.target.closest(interactiveSelector)) {
      document.body.classList.add("cursor-hover");
    }
  });

  document.addEventListener("mouseout", function (e) {
    if (e.target.closest(interactiveSelector)) {
      document.body.classList.remove("cursor-hover");
    }
  });

  // Effetto click
  document.addEventListener("mousedown", function () {
    document.body.classList.add("cursor-click");
  });

  document.addEventListener("mouseup", function () {
    document.body.classList.remove("cursor-click");
  });

  // Nasconde cursore fuori dalla finestra
  document.addEventListener("mouseleave", function () {
    cursorDot.style.opacity = "0";
    cursorRing.style.opacity = "0";
  });

  document.addEventListener("mouseenter", function () {
    cursorDot.style.opacity = "1";
    cursorRing.style.opacity = "1";
  });
}

// Funzione per avviare il modal dei progetti
function initModal() {
  let modal = document.getElementById("project-modal");
  let backdrop = document.getElementById("modal-backdrop");

  function closeModal() {
    modal.classList.remove("open");
    document.body.style.overflow = "";
    if (window.resumeMatrix) window.resumeMatrix();
    if (window.resumeOrbit) window.resumeOrbit();
  }

  document.getElementById("modal-close").addEventListener("click", closeModal);
  backdrop.addEventListener("click", closeModal);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });

  // Event listener per le schede dei progetti
  for (let card of document.querySelectorAll(".project-card")) {
    card.addEventListener("click", function (event) {
      if (
        !event.target.closest(".project-link") &&
        !event.target.closest(".project-link")
      ) {
        let data = card.dataset;
        let mediaContainer = document.getElementById("modal-media");

        // Gestione media (immagine o emoji)
        if (data.img) {
          let img = document.createElement("img");
          img.className = "modal-image";
          img.src = data.img;
          img.alt = data.title || "";
          mediaContainer.innerHTML = "";
          mediaContainer.append(img);
        } else if (data.emoji) {
          let placeholder = document.createElement("div");
          placeholder.className = "modal-placeholder";
          placeholder.style.background =
            "linear-gradient(135deg,rgba(124,92,252,.15),rgba(34,211,238,.08))";
          placeholder.textContent = data.emoji;
          mediaContainer.innerHTML = "";
          mediaContainer.append(placeholder);
        } else {
          mediaContainer.innerHTML = "";
        }

        // Gestione tag
        let tagsContainer = document.getElementById("modal-tags");
        tagsContainer.innerHTML = "";
        if (data.tags) {
          for (let tagText of data.tags.split(",").filter(Boolean)) {
            let tag = document.createElement("span");
            tag.className = "tag";
            tag.textContent = tagText.trim();
            tagsContainer.append(tag);
          }
        }

        // Titolo e descrizione
        document.getElementById("modal-title").textContent = data.title || "";
        document.getElementById("modal-description").textContent = data.desc || "";

        // Evidenziature
        let highlightsContainer = document.getElementById("modal-highlights");
        highlightsContainer.innerHTML = "";
        if (data.highlights) {
          for (let highlightText of data.highlights.split("|").filter(Boolean)) {
            let highlight = document.createElement("div");
            highlight.className = "modal-highlight";
            let bullet = document.createElement("span");
            bullet.textContent = "▸";
            highlight.append(bullet);
            highlight.append(document.createTextNode(highlightText.trim()));
            highlightsContainer.append(highlight);
          }
        }

        // Pulsanti azioni
        let actionsContainer = document.getElementById("modal-actions");
        actionsContainer.innerHTML = "";

        let visitLink = document.createElement("a");
        visitLink.href = data.live || "#";
        visitLink.className = "btn-primary modal-btn";
        visitLink.target = "_blank";
        visitLink.textContent = "↗ Visita il sito";
        actionsContainer.append(visitLink);

        let sourceLink = document.createElement("a");
        sourceLink.href = data.source || "#";
        sourceLink.className = "btn-ghost modal-btn";
        sourceLink.target = "_blank";
        sourceLink.textContent = "⌥ Source";
        actionsContainer.append(sourceLink);

        // Mostra modal
        document.getElementById("modal-container").scrollTop = 0;
        modal.classList.add("open");
        document.body.style.overflow = "hidden";
        if (window.pauseMatrix) window.pauseMatrix();
        if (window.pauseOrbit) window.pauseOrbit();
      }
    });
  }
}

// Funzione per avviare l'effetto Matrix
function initMatrix() {
  let canvas = document.getElementById("matrix-canvas");
  let ctx = canvas.getContext("2d");
  let characters = "01{}[]()<>/\\=+-*&ABCDEFabcdef".split("");
  let fontSize = 14;
  let columns = [];

  function initCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    columns = [];
    let columnCount = Math.floor(canvas.width / fontSize);
    for (let i = 0; i < columnCount; i++) {
      columns.push(-100 * Math.random());
    }
  }

  let isRunning = true;
  let intervalId = null;

  function drawMatrix() {
    if (isRunning) {
      ctx.fillStyle = "rgba(10,10,15,0.045)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = fontSize + "px 'DM Mono', monospace";

      for (let i = 0; i < columns.length; i++) {
        let y = columns[i] * fontSize;
        ctx.fillStyle = "#00ff88";
        ctx.fillText(
          characters[Math.floor(Math.random() * characters.length)],
          i * fontSize,
          y
        );
        ctx.fillStyle = "#00c853";
        ctx.fillText(
          characters[Math.floor(Math.random() * characters.length)],
          i * fontSize,
          y - 2 * fontSize
        );

        if (y > canvas.height && Math.random() > 0.975) {
          columns[i] = 0;
        }
        columns[i] += 0.5;
      }
    }
  }

  function startAnimation() {
    intervalId = intervalId || setInterval(drawMatrix, 40);
  }

  initCanvas();
  window.addEventListener("resize", initCanvas);
  startAnimation();

  window.pauseMatrix = function () {
    isRunning = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  window.resumeMatrix = function () {
    isRunning = true;
    startAnimation();
  };
}

// Funzione per avviare l'orbita delle tecnologie
function initOrbit() {
  let orbitContainer = document.getElementById("orbit-wrap");
  let technologies = [
    { icon: "🌐", name: "HTML5", r: 110, v: 0.45, a: 0 },
    { icon: "🎨", name: "CSS3", r: 110, v: 0.45, a: 180 },
    { icon: "⚡", name: "JavaScript", r: 170, v: -0.3, a: 60 },
    { icon: "🟢", name: "Node.js", r: 170, v: -0.3, a: 200 },
    { icon: "🐙", name: "GitHub", r: 170, v: -0.3, a: 320 },
    { icon: "🌀", name: "TypeScript", r: 220, v: 0.2, a: 30 },
    { icon: "⚛️", name: "React", r: 220, v: 0.2, a: 130 },
    { icon: "🔥", name: "Firebase", r: 220, v: 0.2, a: 230 },
    { icon: "🛠️", name: "VS Code", r: 220, v: 0.2, a: 320 }
  ];

  // Crea le card
  for (let tech of technologies) {
    let card = document.createElement("div");
    card.className = "orbit-card";
    let iconSpan = document.createElement("span");
    iconSpan.className = "orbit-icon";
    iconSpan.textContent = tech.icon;
    card.append(iconSpan);
    let nameSpan = document.createElement("span");
    nameSpan.textContent = tech.name;
    card.append(nameSpan);
    tech.el = card;
    orbitContainer.appendChild(card);
  }

  // Ottiene le dimensioni delle card
  requestAnimationFrame(function () {
    for (let tech of technologies) {
      tech.w = tech.el.offsetWidth || 80;
      tech.h = tech.el.offsetHeight || 30;
    }
  });

  let startTime = performance.now();
  let isRunning = true;
  let animationId = null;

  function animate() {
    if (isRunning) {
      let centerX = (orbitContainer.offsetWidth || 480) / 2;
      let elapsedSeconds = (performance.now() - startTime) / 1000;

      for (let tech of technologies) {
        let angle = (tech.a * Math.PI) / 180 + elapsedSeconds * tech.v;
        let visibility = (Math.sin(angle) + 1) / 2;

        tech.el.style.left =
          centerX +
          tech.r * Math.cos(angle) -
          (tech.w || 80) / 2 +
          "px";
        tech.el.style.top =
          centerX +
          tech.r * Math.sin(angle) -
          (tech.h || 30) / 2 +
          "px";
        tech.el.style.opacity = 0.45 + 0.55 * visibility;
        tech.el.style.transform = "scale(" + (0.82 + 0.18 * visibility) + ")";
        tech.el.style.zIndex = Math.round(9 * visibility);
        tech.el.style.borderColor =
          visibility > 0.85 ? "rgba(124,92,252,.7)" : "rgba(42,42,56,.9)";
      }

      animationId = requestAnimationFrame(animate);
    }
  }

  function startAnimation() {
    if (!animationId) {
      startTime = performance.now();
      isRunning = true;
      animate();
    }
  }

  startAnimation();

  window.pauseOrbit = function () {
    isRunning = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  };

  window.resumeOrbit = startAnimation;
}

// Funzione per il menu mobile
function initMobileMenu() {
  let hamburger = document.getElementById("hamburger");
  let mobileMenu = document.getElementById("mobile-menu");
  let closeBtn = document.getElementById("mobile-close");

  function closeMenu() {
    hamburger.classList.remove("open");
    mobileMenu.classList.remove("open");
    document.body.style.overflow = "";
  }

  hamburger.addEventListener("click", function () {
    hamburger.classList.toggle("open");
    mobileMenu.classList.toggle("open");
    document.body.style.overflow = mobileMenu.classList.contains("open")
      ? "hidden"
      : "";
  });

  closeBtn.addEventListener("click", closeMenu);

  for (let link of document.querySelectorAll(".mobile-link")) {
    link.addEventListener("click", closeMenu);
  }
}

// Funzione per scroll to top
function initScrollToTop() {
  let scrollButton = document.getElementById("scroll-to-top");

  window.addEventListener("scroll", function () {
    if (window.scrollY > 400) {
      scrollButton.classList.add("show");
    } else {
      scrollButton.classList.remove("show");
    }
  });

  scrollButton.addEventListener("click", function () {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });
}

// Funzione per reveal al scroll
function initScrollReveal() {
  let observer = new IntersectionObserver(
    function (entries) {
      for (let entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12 }
  );

  for (let element of document.querySelectorAll(".reveal")) {
    observer.observe(element);
    if (
      element.getBoundingClientRect().top < window.innerHeight &&
      element.getBoundingClientRect().bottom > 0
    ) {
      element.classList.add("visible");
    }
  }
}

// Funzione per timeline
function initTimeline() {
  let timelineLine = document.getElementById("timeline-line");
  let timelineItems = document.querySelectorAll(".timeline-item");

  if (timelineLine && timelineItems.length !== 0) {
    let observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            if (entry.target === timelineLine.parentElement) {
              timelineLine.classList.add("animated");
              timelineItems.forEach(function (item, index) {
                setTimeout(function () {
                  item.classList.add("revealed");
                }, 150 * index);
              });
            }
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    let timelineWrapper = document.querySelector(".timeline-wrap");
    if (timelineWrapper) {
      observer.observe(timelineWrapper);
    }
  }
}

// Inizializzazione al caricamento della pagina
window.addEventListener("DOMContentLoaded", initLoader);
window.addEventListener("DOMContentLoaded", initCursor);
window.addEventListener("DOMContentLoaded", initModal);
window.addEventListener("DOMContentLoaded", initMatrix);
window.addEventListener("DOMContentLoaded", initOrbit);
window.addEventListener("DOMContentLoaded", initMobileMenu);
window.addEventListener("DOMContentLoaded", initScrollReveal);
window.addEventListener("DOMContentLoaded", initScrollToTop);
window.addEventListener("DOMContentLoaded", initTimeline);