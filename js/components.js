/**
 * 396 FOLIO - Minimal Components
 */

class SiteHeader extends HTMLElement {
  connectedCallback() {
    const base = this.getAttribute('data-base') || '';
    this.innerHTML = `
      <a href="#main-content" class="skip-link">メインコンテンツへスキップ</a>
      <header id="main-header">
        <div class="container header-container">
          <a href="${base}index.html" class="logo">396 FOLIO</a>

          <div class="header-actions">
            <button class="theme-toggle" aria-label="Toggle dark mode">
              <i class="fa-solid fa-moon"></i>
              <i class="fa-solid fa-sun"></i>
            </button>

            <button class="mobile-menu-toggle" aria-label="Toggle menu">
              <span></span>
              <span></span>
            </button>
          </div>

          <nav class="main-nav">
            <ul class="nav-list">
              <li><a href="${base}index.html">TOP</a></li>
              <li><a href="${base}index.html#WORKS">WORKS</a></li>
              <li><a href="${base}news.html">NEWS</a></li>
              <li><a href="${base}about.html">ABOUT</a></li>
              <li><a href="${base}design-system.html">DESIGN SYSTEM</a></li>
              <li><a href="https://muuu-noir.github.io/formaldehyde/" target="_blank" rel="noopener">GALLERY</a></li>
              <li><a href="${base}contact.html">CONTACT</a></li>
            </ul>
          </nav>
        </div>
      </header>
    `;
    this.initScrollEffect();
    this.initMobileMenu();
    this.initThemeToggle();
  }

  initScrollEffect() {
    window.addEventListener('scroll', () => {
      const header = document.getElementById('main-header');
      if (header) {
        header.classList.toggle('scrolled', window.scrollY > 20);
      }
    }, { passive: true });
  }

  initMobileMenu() {
    const toggle = this.querySelector('.mobile-menu-toggle');
    const nav = this.querySelector('.main-nav');
    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
        nav.classList.toggle('active');
        document.body.classList.toggle('menu-open');
      });

      nav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          toggle.classList.remove('active');
          nav.classList.remove('active');
          document.body.classList.remove('menu-open');
        });
      });
    }
  }

  initThemeToggle() {
    const toggleBtn = this.querySelector('.theme-toggle');
    const html = document.documentElement;

    // Load saved theme or default to system
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      html.setAttribute('data-theme', savedTheme);
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const currentTheme = html.getAttribute('data-theme');
        let newTheme = 'light';

        if (!currentTheme) {
          // If no manual theme is set, check system preference
          const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          newTheme = isSystemDark ? 'light' : 'dark';
        } else {
          newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        }

        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
      });
    }
  }
}

class SiteFooter extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <footer>
        <div class="container footer-minimal">
          <div class="footer-content">
            <nav class="footer-sns">
              <a href="https://github.com/muuu-noir/mysite" target="_blank"><i class="fa-brands fa-github"></i></a>
              <a href="https://note.com/muuu_noir/" target="_blank"><i class="fa-regular fa-note-sticky"></i></a>
            </nav>
            <div class="footer-copy">MOMOKO TEZUKA | 396 FOLIO</div>
            <!-- Access Counter Tag Area (Invisible) -->
            <div id="access-counter" class="hidden-counter"></div>
          </div>
        </div>
      </footer>
    `;

    // config tags are now handled by main.js for better timing and cross-component reliability
  }

  safeInject(container, html) {
    const range = document.createRange();
    range.selectNode(container);
    const fragment = range.createContextualFragment(html);
    container.innerHTML = '';
    container.appendChild(fragment);
  }
}

/**
 * Section Title Component
 * <section-title title="WORKS" center reveal></section-title>
 */
class SectionTitle extends HTMLElement {
  connectedCallback() {
    const title = this.getAttribute('title') || '';
    const isCenter = this.hasAttribute('center');
    const isReveal = this.hasAttribute('reveal');
    const className = `section-title ${isCenter ? 'flex-center' : ''} ${isReveal ? 'reveal' : ''}`;

    this.innerHTML = `<h2 class="${className}">- ${title} -</h2>`;

    if (isReveal && window.revealObserver) {
      window.revealObserver.observe(this.querySelector('h2'));
    }
  }
}

/**
 * Glass Card Wrapper
 * <glass-card reveal grid center>...</glass-card>
 */
class GlassCard extends HTMLElement {
  connectedCallback() {
    const reveal = this.hasAttribute('reveal') ? 'reveal' : '';
    const grid = this.hasAttribute('grid') ? 'flex-grid' : '';
    const center = this.hasAttribute('center') ? 'flex-center' : '';
    const content = this.innerHTML;

    this.innerHTML = `<div class="glass-card ${reveal} ${grid} ${center}">${content}</div>`;

    if (reveal && window.revealObserver) {
      window.revealObserver.observe(this.querySelector('.glass-card'));
    }
  }
}

/**
 * Site Button Component
 * <site-button href="url" type="more|cta">Label</site-button>
 */
class SiteButton extends HTMLElement {
  connectedCallback() {
    const href = this.getAttribute('href') || '#';
    const type = this.getAttribute('type') || 'more'; // 'more' or 'cta'
    const target = this.getAttribute('target') || '_self';
    const label = this.textContent;

    if (type === 'more') {
      this.innerHTML = `
        <a href="${href}" class="btn-more" target="${target}">
          ${label} <i class="fa fa-chevron-right btn-icon"></i>
        </a>
      `;
    } else {
      this.innerHTML = `
        <a href="${href}" class="btn-cta" target="${target}">${label}</a>
      `;
    }
  }
}

/**
 * Work Card Component
 * <work-card img="src" title="Title" subtitle="Sub" href="url" role="担当範囲" result="成果">Description</work-card>
 */
class WorkCard extends HTMLElement {
  connectedCallback() {
    const img = this.getAttribute('img') || '';
    const title = this.getAttribute('title') || '';
    const subtitle = this.getAttribute('subtitle') || '';
    const href = this.getAttribute('href') || '';
    const role = this.getAttribute('role') || '';
    const result = this.getAttribute('result') || '';
    const note = this.getAttribute('note') || '';
    const contactLabel = this.getAttribute('contact-label') || '';
    const contactHref = this.getAttribute('contact-href') || 'contact.html';
    const description = this.innerHTML;

    const metaHtml = (role || result) ? `
      <dl class="work-meta">
        ${role ? `<div class="work-meta__item"><dt>担当</dt><dd>${role}</dd></div>` : ''}
        ${result ? `<div class="work-meta__item"><dt>成果</dt><dd>${result}</dd></div>` : ''}
      </dl>` : '';

    const noteHtml = note ? `
      <div class="work-note">
        <i class="fa-solid fa-lightbulb"></i>
        <span>${note}</span>
      </div>` : '';

    const contactHtml = contactLabel ? `
      <a href="${contactHref}" class="work-contact-cta">
        <i class="fa-regular fa-envelope"></i> ${contactLabel}
      </a>` : '';

    this.innerHTML = `
      <div class="glass-card reveal flex-grid">
        <div class="gallery-thumb-wrap">
          <a href="${href}" target="_blank" class="thumb-link">
            <img src="${img}" alt="${title}" loading="lazy">
          </a>
        </div>
        <div class="content-block">
          <h3>${title}</h3>
          <p class="sub-title">${subtitle}</p>
          <p>${description}</p>
          ${metaHtml}
          ${noteHtml}
          ${contactHtml ? `<div class="work-actions">${contactHtml}</div>` : ''}
        </div>
      </div>
    `;

    if (window.revealObserver) {
      window.revealObserver.observe(this.querySelector('.glass-card'));
    }
  }
}

/**
 * Info Table Component
 * <info-table data='[{"date":"2024.1.1", "text":"Content", "link": "url"}]'></info-table>
 */
class InfoTable extends HTMLElement {
  connectedCallback() {
    const dataStr = this.getAttribute('data');
    if (!dataStr) return;

    try {
      const data = JSON.parse(dataStr);
      let rowsHtml = '';

      data.forEach(item => {
        const content = item.link
          ? `<a href="${item.link}" target="_blank">${item.text}</a>`
          : item.text;

        const badge = item.isNew ? '<span class="badge-new">NEW</span>' : '';

        rowsHtml += `
          <tr>
            <th>${item.date}</th>
            <td>${badge}${content}</td>
          </tr>
        `;
      });

      this.innerHTML = `
        <table class="data-table">
          ${rowsHtml}
        </table>
      `;
    } catch (e) {
      console.error('Failed to parse info-table data', e);
    }
  }
}

/**
 * Floating CTA Button
 * <floating-cta href="contact.html">お問い合わせ</floating-cta>
 * Hides automatically on the contact page.
 */
class FloatingCTA extends HTMLElement {
  connectedCallback() {
    const href = this.getAttribute('href') || 'contact.html';
    const label = this.textContent.trim() || 'お問い合わせ';

    // Don't render on the contact page itself
    if (window.location.pathname.endsWith('contact.html')) return;

    this.innerHTML = `
      <a href="${href}" class="floating-cta" aria-label="${label}">
        <i class="fa-regular fa-envelope floating-cta__icon"></i>
        <span class="floating-cta__label">${label}</span>
      </a>
    `;

    // Reveal after a short delay for a polished entrance
    requestAnimationFrame(() => {
      setTimeout(() => {
        const btn = this.querySelector('.floating-cta');
        if (btn) btn.classList.add('floating-cta--visible');
      }, 800);
    });
  }
}

/**
 * Contact Examples Component
 * <contact-examples></contact-examples>
 */
class ContactExamples extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div class="contact-examples reveal">
        <p class="contact-examples__heading">こんな連絡が嬉しいです</p>
        <ul class="contact-examples__list">
          <li>
            <i class="fa-regular fa-comments"></i>
            <span>制作・技術についての相談やフィードバック</span>
          </li>
          <li>
            <i class="fa-solid fa-handshake"></i>
            <span>コラボレーション・協業・共同制作の提案</span>
          </li>
          <li>
            <i class="fa-solid fa-pen-nib"></i>
            <span>取材・インタビュー・登壇・執筆依頼</span>
          </li>
        </ul>
        <p class="contact-reply-note">
          <i class="fa-regular fa-clock"></i> 通常 2〜3 営業日以内にご返信します。
        </p>
      </div>
    `;

    if (window.revealObserver) {
      window.revealObserver.observe(this.querySelector('.contact-examples'));
    }
  }
}

customElements.define('site-header', SiteHeader);
customElements.define('site-footer', SiteFooter);
customElements.define('section-title', SectionTitle);
customElements.define('glass-card', GlassCard);
customElements.define('site-button', SiteButton);
customElements.define('work-card', WorkCard);
customElements.define('info-table', InfoTable);
customElements.define('floating-cta', FloatingCTA);
