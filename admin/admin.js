// Apply theme before render to prevent flash
(function() {
  var theme = localStorage.getItem('admin-theme');
  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();

function toggleTheme() {
  var html = document.documentElement;
  var isDark = html.getAttribute('data-theme') === 'dark';
  if (isDark) {
    html.removeAttribute('data-theme');
    localStorage.setItem('admin-theme', 'light');
  } else {
    html.setAttribute('data-theme', 'dark');
    localStorage.setItem('admin-theme', 'dark');
  }
}
