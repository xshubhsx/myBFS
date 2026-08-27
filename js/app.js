/**
 * app.js — tiny shared helpers used on every page.
 */
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  document.querySelectorAll(".top-nav a").forEach((a) => {
    if (a.dataset.page === page) a.classList.add("active");
  });
  // If Firebase is configured, require authentication for protected pages.
  // Skip the guard on the login page itself so users can sign in.
  try {
    const isLoginPage = window.location.pathname.endsWith('login.html');
    if (!isLoginPage && window.BFSAuth && typeof BFSAuth.requireAuth === 'function') {
      BFSAuth.requireAuth('login.html');
    }
  } catch (e) {
    // ignore — allow pages to load even if auth check fails
    console.warn('Auth guard check failed', e);
  }
});
