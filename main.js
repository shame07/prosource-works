// Toggle mobile nav
document.getElementById("menu-toggle").addEventListener("click", function () {
  document.getElementById("navbar").classList.toggle("active");
});

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener("click", function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute("href"));
    if (target) target.scrollIntoView({ behavior: "smooth" });
    document.getElementById("navbar").classList.remove("active");
  });
});

// Particles for HERO section
particlesJS("particles-hero", {
  "particles": {
    "number": { "value": 45 },
    "color": { "value": "#ffffff" },
    "shape": { "type": "circle" },
    "opacity": { "value": 0.4 },
    "size": { "value": 3 },
    "line_linked": {
      "enable": true,
      "distance": 120,
      "color": "#ffffff",
      "opacity": 0.2,
      "width": 1
    },
    "move": {
      "enable": true,
      "speed": 1,
      "direction": "none",
      "out_mode": "bounce"
    }
  },
  "interactivity": {
    "events": {
      "onhover": { "enable": true, "mode": "grab" },
      "onclick": { "enable": false }
    },
    "modes": {
      "grab": {
        "distance": 200,
        "line_linked": { "opacity": 0.5 }
      }
    }
  },
  "retina_detect": true
});

// Particles for SERVICES section
particlesJS("particles-services", {
  "particles": {
    "number": { "value": 40 },
    "color": { "value": "#ffffff" },
    "shape": { "type": "circle" },
    "opacity": { "value": 0.3 },
    "size": { "value": 2 },
    "line_linked": {
      "enable": true,
      "distance": 120,
      "color": "#ffffff",
      "opacity": 0.15,
      "width": 1
    },
    "move": { "enable": true, "speed": 1 }
  },
  "interactivity": {
    "events": {
      "onhover": { "enable": true, "mode": "grab" },
      "onclick": { "enable": false }
    },
    "modes": {
      "grab": {
        "distance": 150,
        "line_linked": { "opacity": 0.3 }
      }
    }
  },
  "retina_detect": true
});
