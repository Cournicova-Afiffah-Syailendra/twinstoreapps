// Toast auto-hide
document.querySelectorAll('.toast').forEach(t => {
  setTimeout(() => t.classList.add('hide'), 3200);
  setTimeout(() => t.remove(), 3700);
});
// Reveal the card grids once as they scroll into view
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .1 });
  document.querySelectorAll('.tiles,.grid,.mag,.spot').forEach(el => { el.classList.add('reveal'); io.observe(el); });
}
// Close mobile menu after navigation
document.querySelectorAll('.nav-links a').forEach(a => a.addEventListener('click', () => document.body.classList.remove('menu-open')));
