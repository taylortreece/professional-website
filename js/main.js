document.getElementById('year').textContent = new Date().getFullYear();

// contact form — submit via fetch so the page never redirects or reloads
const contactForm = document.getElementById('contact-form');

if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = contactForm.querySelector('.submit-btn');
    const originalLabel = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    const showMessage = (text, isError) => {
      let msg = document.getElementById('form-message');
      if (!msg) {
        msg = document.createElement('p');
        msg.id = 'form-message';
        msg.style.marginTop = '16px';
        msg.style.fontFamily = "'IBM Plex Mono', monospace";
        msg.style.fontSize = '14px';
        contactForm.insertAdjacentElement('afterend', msg);
      }
      msg.textContent = text;
      msg.style.color = isError ? '#FF6B6B' : 'var(--signal)';
    };

    try {
      const response = await fetch(contactForm.action, {
        method: 'POST',
        body: new FormData(contactForm),
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        contactForm.reset();
        showMessage("Message sent — thanks, I'll get back to you soon.", false);
      } else {
        showMessage('Something went wrong sending that. Try again, or email me directly.', true);
      }
    } catch (err) {
      showMessage('Something went wrong sending that. Try again, or email me directly.', true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalLabel;
    }
  });
}

// mobile nav toggle
const navToggle = document.getElementById('nav-toggle');
const primaryNav = document.getElementById('primary-nav');

if (navToggle && primaryNav) {
  navToggle.addEventListener('click', () => {
    const isOpen = primaryNav.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  // close the menu after picking a link
  primaryNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      primaryNav.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}



// highlight the current sheet in nav as you scroll
const sections = document.querySelectorAll('main .sheet');
const navLinks = document.querySelectorAll('.sheet-nav a');

if ('IntersectionObserver' in window && sections.length) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');

        // light up the active section's via on the trace rail
        sections.forEach((section) => section.classList.remove('is-active'));
        entry.target.classList.add('is-active');

        // highlight the matching nav link, if this section has one
        navLinks.forEach((link) => {
          link.style.color = link.getAttribute('href') === `#${id}` ? 'var(--signal)' : '';
        });
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach((section) => observer.observe(section));
}
