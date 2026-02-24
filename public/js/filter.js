(function () {
  const grid = document.getElementById('card-grid');
  const input = document.getElementById('search-input');
  const tagContainer = document.getElementById('tag-filters');
  const emptyMsg = document.getElementById('filter-empty');
  if (!grid || !input) return;

  const cards = Array.from(grid.querySelectorAll('[data-title]'));
  const tagButtons = tagContainer ? Array.from(tagContainer.querySelectorAll('.tag--filter')) : [];
  const activeTags = new Set();

  function applyFilters() {
    const query = input.value.toLowerCase().trim();
    let visible = 0;

    cards.forEach(function (card) {
      const title = (card.getAttribute('data-title') || '').toLowerCase();
      const desc = (card.getAttribute('data-description') || '').toLowerCase();
      const cardTags = (card.getAttribute('data-tags') || '').split(',').filter(Boolean);

      const matchesSearch = !query || title.includes(query) || desc.includes(query);
      const matchesTags = activeTags.size === 0 || Array.from(activeTags).every(function (t) {
        return cardTags.includes(t);
      });

      if (matchesSearch && matchesTags) {
        card.style.display = '';
        visible++;
      } else {
        card.style.display = 'none';
      }
    });

    if (emptyMsg) {
      emptyMsg.style.display = visible === 0 ? 'block' : 'none';
    }

    updateHash();
  }

  function updateHash() {
    var parts = [];
    if (activeTags.size > 0) parts.push('tags=' + Array.from(activeTags).join(','));
    var q = input.value.trim();
    if (q) parts.push('q=' + encodeURIComponent(q));
    history.replaceState(null, '', parts.length ? '#' + parts.join('&') : location.pathname);
  }

  function readHash() {
    var hash = location.hash.replace(/^#/, '');
    if (!hash) return;
    hash.split('&').forEach(function (pair) {
      var parts = pair.split('=');
      if (parts[0] === 'tags' && parts[1]) {
        parts[1].split(',').forEach(function (t) {
          activeTags.add(t);
        });
      }
      if (parts[0] === 'q' && parts[1]) {
        input.value = decodeURIComponent(parts[1]);
      }
    });
    tagButtons.forEach(function (btn) {
      if (activeTags.has(btn.getAttribute('data-tag'))) {
        btn.classList.add('active');
      }
    });
  }

  input.addEventListener('input', applyFilters);

  tagButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var tag = btn.getAttribute('data-tag');
      if (activeTags.has(tag)) {
        activeTags.delete(tag);
        btn.classList.remove('active');
      } else {
        activeTags.add(tag);
        btn.classList.add('active');
      }
      applyFilters();
    });
  });

  readHash();
  if (activeTags.size > 0 || input.value) applyFilters();
})();
