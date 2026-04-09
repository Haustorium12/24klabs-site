/* ==========================================================================
   24K Labs -- Main JS
   Live demo, stats fetch, scroll animations, nav toggle
   ========================================================================== */

const API_BASE = 'https://api.24klabs.ai';

// ---------- Scroll Reveal ----------
function initReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
}

// ---------- Mobile Nav Toggle ----------
function initNav() {
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {
    links.classList.toggle('active');
    toggle.classList.toggle('active');
  });

  // Close on link click
  links.querySelectorAll('.nav__link').forEach((link) => {
    link.addEventListener('click', () => {
      links.classList.remove('active');
      toggle.classList.remove('active');
    });
  });
}

// ---------- Fetch Stats ----------
async function fetchStats() {
  try {
    const res = await fetch(API_BASE + '/stats');
    if (!res.ok) return;
    const data = await res.json();
    // Sum all service request counts
    let total = 0;
    if (data && typeof data === 'object') {
      Object.values(data).forEach((v) => {
        if (typeof v === 'number') total += v;
        else if (v && typeof v.total === 'number') total += v.total;
      });
    }
    const el = document.getElementById('stat-requests');
    if (el && total > 0) {
      animateNumber(el, total);
    } else if (el) {
      el.textContent = '0';
    }
  } catch (e) {
    // Silently fail -- stats are non-critical
    const el = document.getElementById('stat-requests');
    if (el) el.textContent = '--';
  }
}

function animateNumber(el, target) {
  const duration = 1200;
  const start = performance.now();
  const from = 0;

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(from + (target - from) * eased);
    el.textContent = current.toLocaleString();
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ---------- Live Demo ----------
function initDemo() {
  const input = document.getElementById('demo-input');
  const output = document.getElementById('demo-output');
  const submit = document.getElementById('demo-submit');
  const langSelect = document.getElementById('demo-lang');
  const remaining = document.getElementById('demo-remaining');
  if (!input || !output || !submit) return;

  let requestsUsed = 0;

  submit.addEventListener('click', async () => {
    const code = input.value.trim();
    if (!code) {
      output.innerHTML = '<p class="demo__error">Paste some code first.</p>';
      return;
    }
    if (code.length > 500) {
      output.innerHTML = '<p class="demo__error">Demo limited to 500 characters. You have ' + code.length + '.</p>';
      return;
    }

    // Show loading
    output.innerHTML = '<div class="demo__loading"><div class="demo__spinner"></div>Analyzing...</div>';
    output.classList.remove('has-result');
    submit.disabled = true;
    submit.textContent = 'Analyzing...';

    try {
      const res = await fetch(API_BASE + '/api/demo/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code,
          language: langSelect.value || '',
          context: '',
          tier: 'standard'
        })
      });

      if (res.status === 429) {
        output.innerHTML = '<p class="demo__error">Daily demo limit reached (5 requests). Come back tomorrow or use the paid API.</p>';
        if (remaining) remaining.textContent = '0';
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        output.innerHTML = '<p class="demo__error">Error: ' + (err.error || err.message || 'Service unavailable') + '</p>';
        return;
      }

      const data = await res.json();
      output.textContent = data.result || 'No result returned.';
      output.classList.add('has-result');

      requestsUsed++;
      if (remaining) remaining.textContent = Math.max(0, 5 - requestsUsed);

    } catch (e) {
      output.innerHTML = '<p class="demo__error">Could not reach the API. The server may be temporarily offline.</p>';
    } finally {
      submit.disabled = false;
      submit.textContent = 'Explain This Code';
    }
  });
}

// ---------- Smooth scroll for anchor links ----------
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

// ---------- Nav background on scroll ----------
function initNavScroll() {
  const nav = document.getElementById('nav');
  if (!nav) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      nav.style.borderBottomColor = 'var(--border)';
    } else {
      nav.style.borderBottomColor = 'transparent';
    }
  }, { passive: true });
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
  initReveal();
  initNav();
  initSmoothScroll();
  initNavScroll();
  initDemo();
  fetchStats();
});
