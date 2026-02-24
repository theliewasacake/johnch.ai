(function () {
  var container = document.getElementById('article-graph');
  if (!container) return;

  var width = container.clientWidth;
  var height = Math.max(400, container.clientHeight);

  // Get theme colors from CSS
  function getColor(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  }

  var svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height]);

  // Fetch graph data
  fetch('/graph-data.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data.nodes.length) {
        container.innerHTML += '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:var(--font-mono);font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;">No articles yet</div>';
        return;
      }
      renderGraph(data);
    })
    .catch(function () {
      // Silently fail if no graph data
    });

  function renderGraph(data) {
    var lineColor = getColor('--line-primary') || '#C8C8C0';
    var textColor = getColor('--text-primary') || '#1A1A1A';
    var mutedColor = getColor('--text-muted') || '#8A8A82';
    var accentColor = getColor('--accent-red') || '#CC2020';
    var bgColor = getColor('--bg-secondary') || '#EEEEE8';

    var simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.edges).id(function (d) { return d.id; }).distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(30));

    // Edges
    var link = svg.append('g')
      .selectAll('line')
      .data(data.edges)
      .join('line')
      .attr('stroke', lineColor)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', function (d) { return d.type === 'tag' ? '4,4' : 'none'; })
      .attr('opacity', 0.6);

    // Nodes
    var node = svg.append('g')
      .selectAll('g')
      .data(data.nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(d3.drag()
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded));

    // Node shape: small hexagon
    var hexSize = 8;
    var hexPoints = d3.range(6).map(function (i) {
      var angle = (Math.PI / 3) * i - Math.PI / 6;
      return [hexSize * Math.cos(angle), hexSize * Math.sin(angle)];
    }).map(function (p) { return p.join(','); }).join(' ');

    node.append('polygon')
      .attr('points', hexPoints)
      .attr('fill', bgColor)
      .attr('stroke', lineColor)
      .attr('stroke-width', 1);

    // Labels
    node.append('text')
      .text(function (d) { return d.title; })
      .attr('x', 14)
      .attr('y', 4)
      .attr('font-family', 'var(--font-mono)')
      .attr('font-size', '0.65rem')
      .attr('fill', mutedColor)
      .attr('pointer-events', 'none');

    // Tooltip on hover
    var tooltip = d3.select(container)
      .append('div')
      .style('position', 'absolute')
      .style('padding', '4px 8px')
      .style('background', 'var(--bg-primary)')
      .style('border', '1px solid var(--line-primary)')
      .style('font-family', 'var(--font-mono)')
      .style('font-size', '0.7rem')
      .style('color', 'var(--text-primary)')
      .style('pointer-events', 'none')
      .style('display', 'none')
      .style('z-index', '20');

    // Interactions
    node.on('mouseover', function (event, d) {
      // Highlight connected nodes and edges
      var connected = new Set();
      data.edges.forEach(function (e) {
        var src = typeof e.source === 'object' ? e.source.id : e.source;
        var tgt = typeof e.target === 'object' ? e.target.id : e.target;
        if (src === d.id) connected.add(tgt);
        if (tgt === d.id) connected.add(src);
      });

      node.select('polygon')
        .attr('stroke', function (n) { return n.id === d.id || connected.has(n.id) ? accentColor : lineColor; })
        .attr('stroke-width', function (n) { return n.id === d.id || connected.has(n.id) ? 2 : 1; });

      link
        .attr('stroke', function (e) {
          var src = typeof e.source === 'object' ? e.source.id : e.source;
          var tgt = typeof e.target === 'object' ? e.target.id : e.target;
          return (src === d.id || tgt === d.id) ? accentColor : lineColor;
        })
        .attr('opacity', function (e) {
          var src = typeof e.source === 'object' ? e.source.id : e.source;
          var tgt = typeof e.target === 'object' ? e.target.id : e.target;
          return (src === d.id || tgt === d.id) ? 1 : 0.2;
        });

      node.select('text')
        .attr('fill', function (n) { return n.id === d.id || connected.has(n.id) ? textColor : mutedColor; });

      tooltip
        .html(d.title + (d.tags.length ? '<br><span style="color:var(--text-muted)">' + d.tags.join(', ') + '</span>' : ''))
        .style('display', 'block');
    })
    .on('mousemove', function (event) {
      var rect = container.getBoundingClientRect();
      tooltip
        .style('left', (event.clientX - rect.left + 15) + 'px')
        .style('top', (event.clientY - rect.top - 10) + 'px');
    })
    .on('mouseout', function () {
      node.select('polygon').attr('stroke', lineColor).attr('stroke-width', 1);
      link.attr('stroke', lineColor).attr('opacity', 0.6);
      node.select('text').attr('fill', mutedColor);
      tooltip.style('display', 'none');
    })
    .on('click', function (event, d) {
      window.location.href = d.url;
    });

    // Simulation tick
    simulation.on('tick', function () {
      link
        .attr('x1', function (d) { return d.source.x; })
        .attr('y1', function (d) { return d.source.y; })
        .attr('x2', function (d) { return d.target.x; })
        .attr('y2', function (d) { return d.target.y; });

      node.attr('transform', function (d) {
        d.x = Math.max(hexSize, Math.min(width - hexSize, d.x));
        d.y = Math.max(hexSize, Math.min(height - hexSize, d.y));
        return 'translate(' + d.x + ',' + d.y + ')';
      });
    });

    // Drag functions
    function dragStarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragEnded(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
  }

  // Resize handler
  window.addEventListener('resize', function () {
    width = container.clientWidth;
    height = Math.max(400, container.clientHeight);
    svg.attr('width', width).attr('height', height).attr('viewBox', [0, 0, width, height]);
  });
})();
