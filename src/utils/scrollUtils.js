/**
 * Utilities for handling single-page scroll behavior, section highlighting,
 * and navigation between sections.
 */

// Global observer to persist across page navigation
let sectionObserver = null;

/**
 * Initialize or reinitialize scroll functionality for single-page layout
 */
export function initScrollFunctionality() {
  // Only run on single page layout or homepage
  const path = window.location.pathname;
  
  // Check if we're on homepage or if we have a flag set when returning to homepage
  const isReturningToHome = sessionStorage.getItem('returnToHome') === 'true';
  if (isReturningToHome && path === '/') {
    // Clear the flag since we've handled it
    sessionStorage.removeItem('returnToHome');
    // Force reinitialization
    if (sectionObserver) {
      sectionObserver.disconnect();
      sectionObserver = null;
    }
  }
  
  // Only proceed if we're on the homepage or single page layout
  if (path !== '/' && !document.body.dataset.singlePage) return;

  // Clean up existing observer if it exists
  if (sectionObserver) {
    sectionObserver.disconnect();
    sectionObserver = null;
  }
  
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.sidebar a');
  
  // Set first section as active by default
  if (sections.length > 0 && navLinks.length > 0) {
    const firstSectionId = sections[0].getAttribute('id');
    const firstLink = document.querySelector(`.sidebar a[href="#${firstSectionId}"]`);
    if (firstLink) {
      navLinks.forEach(link => link.classList.remove('active'));
      firstLink.classList.add('active');
    }
  }
  
  const observerOptions = {
    root: null,
    rootMargin: '-20% 0px -79% 0px', // Trigger when section is ~20% in view
    threshold: 0
  };
  
  sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Get the id of the section that's in view
        const id = entry.target.getAttribute('id');
        
        // Update all nav links (remove active class)
        navLinks.forEach(link => {
          link.classList.remove('active');
        });
        
        // Add active class to the corresponding nav link
        const activeLink = document.querySelector(`.sidebar a[href="#${id}"]`);
        if (activeLink) activeLink.classList.add('active');
      }
    });
  }, observerOptions);
  
  // Observe all sections
  sections.forEach(section => {
    sectionObserver.observe(section);
  });
  
  // Handle smooth scrolling for nav links
  document.querySelectorAll('.sidebar a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: 'smooth'
        });
      }
    });
  });
}

/**
 * Check if there's a section to scroll to from session storage
 * and scroll to it if present
 */
export function checkScrollToSection() {
  const scrollToSection = sessionStorage.getItem('scrollToSection');
  if (scrollToSection && window.location.pathname === '/') {
    setTimeout(() => {
      const sectionElement = document.getElementById(scrollToSection);
      if (sectionElement) {
        sectionElement.scrollIntoView({ behavior: 'smooth' });
        
        // Update the URL hash without triggering a scroll
        const newUrl = window.location.origin + window.location.pathname + '#' + scrollToSection;
        history.pushState(null, '', newUrl);
        
        // Manually trigger active state for the section
        const navLink = document.querySelector(`.sidebar a[href="#${scrollToSection}"]`);
        if (navLink) {
          document.querySelectorAll('.sidebar a').forEach(link => {
            link.classList.remove('active');
          });
          navLink.classList.add('active');
        }
      }
      // Clear the flag since we've handled it
      sessionStorage.removeItem('scrollToSection');
    }, 300);
  }
}

/**
 * Set up all scroll-related event listeners
 */
export function setupScrollEventListeners() {
  // Initialize on DOM content loaded
  document.addEventListener('DOMContentLoaded', () => {
    initScrollFunctionality();
    checkScrollToSection();
  });
  
  // Reinitialize on navigation (back/forward button)
  window.addEventListener('popstate', () => {
    initScrollFunctionality();
    checkScrollToSection();
  });
  
  // Handle page show events (which cover more navigation cases)
  window.addEventListener('pageshow', (event) => {
    // Add a small delay to ensure DOM is fully loaded when coming from bfcache
    setTimeout(() => {
      initScrollFunctionality();
      checkScrollToSection();
      
      // Check if we have a hash in the URL and scroll to it
      if (window.location.hash) {
        const targetElement = document.querySelector(window.location.hash);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }, 100);
  });
  
  // Check visible sections on hash change (internal navigation)
  window.addEventListener('hashchange', () => {
    // Small delay to let browser navigate to the hash first
    setTimeout(initScrollFunctionality, 100);
  });
}