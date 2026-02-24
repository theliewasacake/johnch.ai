/**
 * Glitch Effect System (Image-based strip distortion)
 * Creates horizontal strip-based glitch animations with particles
 * Inspired by CSS image glitch technique
 */

class GlitchEffects {
  constructor() {
    this.config = null;
    this.glitchContainers = new Map();
    this.activeAnimations = new Set();
    this.isEnabled = false;
    
    this.init();
  }

  init() {
    // Read from build-generated config instead of fetching config.json
    const siteConfig = window.__SITE_CONFIG__ || {};
    this.config = siteConfig.effects?.glitch || {
      enabled: true,
      intervalMin: 3000,
      intervalMax: 8000,
      triggerOnHover: true
    };

    if (!this.config.enabled) {
      return;
    }

    this.isEnabled = true;
    this.setupGlitchElements();
  }

  setupGlitchElements() {
    // Find all elements that should have glitch effects
    const elements = this.findGlitchElements();
    
    elements.forEach(element => {
      this.setupGlitchContainer(element);
      
      if (this.config.triggerOnHover) {
        element.addEventListener('mouseenter', () => {
          this.triggerGlitch(element);
        });
      }
    });
  }

  findGlitchElements() {
    // Select elements that should have glitch effects
    const selectors = [
      '.nav__logo',
      '.nav__link',
      '.theme-toggle',
      '.panel',
      '.panel--greeble',
      '.post-card',
      '.project-card',
      '.tag--filter',
      '.footer__link',
      '.post-project-banner',
      '.resume-download__btn',
      '.contact-panel',
      '.contact-panel--greeble',
      '.contact-panel__item',
      '.project-card__link'
    ];

    const elements = [];
    const seen = new Set();

    selectors.forEach(selector => {
      try {
        const matched = document.querySelectorAll(selector);
        matched.forEach(el => {
          if (!seen.has(el)) {
            elements.push(el);
            seen.add(el);
          }
        });
      } catch (e) {
        // Invalid selector, skip
      }
    });

    return elements;
  }

  setupGlitchContainer(element) {
    // Create glitch container that will be used as an overlay
    const container = document.createElement('div');
    container.className = 'glitch-container';
    
    // Create 6 horizontal strips
    const stripCount = 6;
    for (let i = 0; i < stripCount; i++) {
      const strip = document.createElement('div');
      strip.className = 'glitch-strip';
      strip.style.setProperty('--strip-index', i);
      
      container.appendChild(strip);
    }

    // Ensure element has relative positioning for absolute child
    if (window.getComputedStyle(element).position === 'static') {
      element.style.position = 'relative';
    }
    
    // Insert container at the beginning so it's behind content
    element.insertBefore(container, element.firstChild);
    
    // Store reference
    this.glitchContainers.set(element, container);
  }

  triggerGlitch(element) {
    // Only trigger if not currently animating
    if (this.activeAnimations.has(element)) {
      return;
    }
    
    // Mark as active
    this.activeAnimations.add(element);
    
    // Get the glitch container
    const container = this.glitchContainers.get(element);
    if (!container) return;
    
    // Randomize hue shifts for each strip
    const hues = [
      Math.random() * 360,
      Math.random() * 360,
      Math.random() * 360,
      Math.random() * 360,
      Math.random() * 360,
      Math.random() * 360
    ];
    
    // Randomize animation durations slightly
    const durations = [
      0.25 + Math.random() * 0.15,
      0.28 + Math.random() * 0.15,
      0.26 + Math.random() * 0.15,
      0.30 + Math.random() * 0.15,
      0.27 + Math.random() * 0.15,
      0.29 + Math.random() * 0.15
    ];
    
    // Apply CSS variables
    container.style.setProperty('--glitch-hue-1', `${hues[0]}deg`);
    container.style.setProperty('--glitch-hue-2', `${hues[1]}deg`);
    container.style.setProperty('--glitch-hue-3', `${hues[2]}deg`);
    container.style.setProperty('--glitch-hue-4', `${hues[3]}deg`);
    container.style.setProperty('--glitch-hue-5', `${hues[4]}deg`);
    container.style.setProperty('--glitch-hue-6', `${hues[5]}deg`);
    
    container.style.setProperty('--glitch-duration-1', `${durations[0]}s`);
    container.style.setProperty('--glitch-duration-2', `${durations[1]}s`);
    container.style.setProperty('--glitch-duration-3', `${durations[2]}s`);
    container.style.setProperty('--glitch-duration-4', `${durations[3]}s`);
    container.style.setProperty('--glitch-duration-5', `${durations[4]}s`);
    container.style.setProperty('--glitch-duration-6', `${durations[5]}s`);
    
    // Trigger animation
    container.classList.add('glitch-active');
    
    // Spawn particles
    this.spawnParticles(element);

    // Remove glitch effect after animation completes
    const maxDuration = Math.max(...durations) * 1000;
    setTimeout(() => {
      container.classList.remove('glitch-active');
      this.activeAnimations.delete(element);
    }, maxDuration);
  }

  spawnParticles(element) {
    const container = this.glitchContainers.get(element);
    if (!container) return;
    
    const particleCount = 12 + Math.floor(Math.random() * 8); // 12-20 particles
    const rect = container.getBoundingClientRect();
    
    // Detect current theme
    const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark' || 
      (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'glitch-particle';
      
      // Random position within container
      const x = Math.random() * rect.width;
      const y = Math.random() * rect.height;
      
      // Velocity for particle motion
      const vx = (Math.random() - 0.5) * 200;
      const vy = (Math.random() - 0.5) * 150;
      
      // Random size (1-4px)
      const size = 1 + Math.random() * 3;
      
      // Set color based on theme: white on dark, red on light
      const color = isDarkTheme ? '#ffffff' : '#ff0000';
      
      particle.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: ${y}px;
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        pointer-events: none;
        --vx: ${vx}px;
        --vy: ${vy}px;
      `;
      
      container.appendChild(particle);
      
      // Remove particle after animation completes
      setTimeout(() => {
        particle.remove();
      }, 400);
    }
  }
}

// Initialize glitch effects when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new GlitchEffects();
  });
} else {
  new GlitchEffects();
}
