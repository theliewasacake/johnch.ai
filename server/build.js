const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');
const { markedHighlight } = require('marked-highlight');
const hljs = require('highlight.js');

// Configure marked with syntax highlighting
marked.use(markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  }
}));

const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content');
const PUBLIC_DIR = path.join(ROOT, 'public');
const TEMPLATES_DIR = path.join(ROOT, 'templates');

// Load site config
function loadConfig() {
  const configPath = path.join(ROOT, 'config.json');
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
  // Fallback defaults
  return {
    site: { name: 'My Site', baseUrl: 'https://example.com' },
    author: { name: 'Author Name', githubProfileUrl: '' },
    homepage: { heroLabel: 'Welcome', heroTitle: 'Author Name', heroSubtitle: 'Welcome to my site' },
    sections: {
      blog: { title: 'Blog', description: 'Articles and thoughts' },
      projects: { title: 'Projects', description: 'Things I\'ve built' },
      about: { title: 'About', description: '' }
    },
    rss: { title: 'My Site', description: 'Articles' }
  };
}

const CONFIG = loadConfig();

// --- Template Loading ---

function loadTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATES_DIR, name), 'utf-8');
}

function loadPartial(name) {
  return fs.readFileSync(path.join(TEMPLATES_DIR, 'partials', name), 'utf-8');
}

function fillTemplate(template, vars) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
  }
  return result;
}

function buildPage(template, vars, partials) {
  const siteVars = {
    'site-name': CONFIG.site.name,
    'author-github': CONFIG.author.githubProfileUrl,
    'author-name': CONFIG.author.name,
  };
  const head = fillTemplate(partials.head, { ...siteVars, ...vars });
  const nav = fillTemplate(partials.nav, { ...siteVars, ...vars });
  const footer = fillTemplate(partials.footer, { year: new Date().getFullYear().toString(), ...siteVars });
  return fillTemplate(template, { ...vars, ...siteVars, head, nav, footer });
}

// --- Content Loading ---

function loadMarkdownFiles(dir) {
  const fullDir = path.join(CONTENT_DIR, dir);
  if (!fs.existsSync(fullDir)) return [];

  return fs.readdirSync(fullDir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const raw = fs.readFileSync(path.join(fullDir, f), 'utf-8');
      const { data, content } = matter(raw);
      const slug = path.basename(f, '.md');
      return { ...data, slug, rawContent: content, html: marked(content) };
    })
    .filter(p => !p.draft)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function estimateReadingTime(content) {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 250));
}

function renderTags(tags) {
  if (!tags || !tags.length) return '';
  return tags.map(t => `<span class="tag">${t}</span>`).join('');
}

function extractLinkedPosts(htmlContent) {
  // Extract post slugs from links like /blog/slug/
  const linkRegex = /href="\/blog\/([a-z0-9][a-z0-9-]*)\/"/g;
  const linkedSlugs = new Set();
  let match;
  while ((match = linkRegex.exec(htmlContent)) !== null) {
    linkedSlugs.add(match[1]);
  }
  return Array.from(linkedSlugs);
}

function buildRelatedPostsSection(relatedSlugs, posts, currentPostSlug) {
  if (!relatedSlugs || relatedSlugs.length === 0) {
    return '';
  }

  // Find post objects for each slug, excluding the current post
  const relatedPosts = relatedSlugs
    .filter(slug => slug !== currentPostSlug && posts.some(p => p.slug === slug))
    .map(slug => posts.find(p => p.slug === slug))
    .filter(Boolean);

  if (relatedPosts.length === 0) {
    return '';
  }

  const postCards = relatedPosts.map(p => {
    return `
      <a href="/blog/${p.slug}/" class="post-card--mini">
        <div class="post-card--mini__title">${p.title}</div>
        <div class="post-card--mini__meta">${formatDate(p.date)}</div>
      </a>`;
  }).join('\n');

  return `
  <section class="related-posts--compact">
    <div class="related-posts--compact__label">Related // ${relatedPosts.length} ${relatedPosts.length === 1 ? 'post' : 'posts'}</div>
    <div class="related-posts--compact__scroll">
      ${postCards}
    </div>
  </section>`;
}

// --- Build Blog ---

function buildBlogPosts(posts, projects, partials) {
  const template = loadTemplate('blog-post.html');

  for (const post of posts) {
    const outDir = path.join(PUBLIC_DIR, 'blog', post.slug);
    fs.mkdirSync(outDir, { recursive: true });

    let projectBanner = '';
    if (post.project) {
      const project = projects.find(p => p.slug === post.project);
      if (project) {
        projectBanner = `<a href="/projects/${project.slug}/" class="post-project-banner">Part of: ${project.title}</a>`;
      }
    }

    // Extract linked posts from the content and combine with explicit relatedPosts
    const linkedPostSlugs = extractLinkedPosts(post.html);
    const explicitRelatedSlugs = post.relatedPosts || [];
    const allRelatedSlugs = [...new Set([...explicitRelatedSlugs, ...linkedPostSlugs])];

    // Build related posts sections
    const relatedPostsHtml = buildRelatedPostsSection(allRelatedSlugs, posts, post.slug);

    const html = buildPage(template, {
      title: post.title,
      description: post.description || '',
      date: formatDate(post.date),
      tags: renderTags(post.tags),
      content: post.html,
      projectBanner,
      relatedPostsTop: relatedPostsHtml,
      relatedPostsBottom: relatedPostsHtml,
      'nav-home': '',
      'nav-blog': 'nav__link--active',
      'nav-projects': '',
      'nav-about': '',
    }, partials);

    fs.writeFileSync(path.join(outDir, 'index.html'), html);
    console.log(`  Built: /blog/${post.slug}/`);
  }
}

function buildBlogIndex(posts, partials) {
  const template = loadTemplate('blog-index.html');

  // Collect all unique tags for filter buttons
  const allTags = new Set();
  posts.forEach(p => (p.tags || []).forEach(t => allTags.add(t)));
  const tagList = Array.from(allTags).sort().map(t =>
    `<span class="tag tag--filter" data-tag="${t}">${t}</span>`
  ).join('');

  const postCards = posts.map((p, i) => {
    const readTime = estimateReadingTime(p.rawContent);
    const tags = (p.tags || []).join(',');
    const title = (p.title || '').replace(/"/g, '&quot;');
    const desc = (p.description || '').replace(/"/g, '&quot;');
    return `
    <a href="/blog/${p.slug}/" class="post-card" data-tags="${tags}" data-title="${title}" data-description="${desc}">
      <div class="post-card__meta">${formatDate(p.date)} — ${readTime} min read</div>
      <h3 class="post-card__title">${p.title}</h3>
      <p class="post-card__description">${p.description || ''}</p>
      <div class="post-card__tags">${renderTags(p.tags)}</div>
    </a>`;
  }).join('\n');

  const html = buildPage(template, {
    title: CONFIG.sections.blog.title,
    description: CONFIG.sections.blog.description,
    posts: postCards,
    tagList,
    'nav-home': '',
    'nav-blog': 'nav__link--active',
    'nav-projects': '',
    'nav-about': '',
  }, partials);

  fs.mkdirSync(path.join(PUBLIC_DIR, 'blog'), { recursive: true });
  fs.writeFileSync(path.join(PUBLIC_DIR, 'blog', 'index.html'), html);
  console.log('  Built: /blog/');
}

// --- Build Projects ---

function buildProjectsIndex(projects, posts, partials) {
  const template = loadTemplate('project-page.html');

  // Collect all unique tech tags for filter buttons
  const allTags = new Set();
  projects.forEach(p => (p.tech || []).forEach(t => allTags.add(t)));
  const tagList = Array.from(allTags).sort().map(t =>
    `<span class="tag tag--filter" data-tag="${t}">${t}</span>`
  ).join('');

  const projectCards = projects.map(p => {
    const postCount = posts.filter(bp => bp.project === p.slug).length;
    const postLabel = postCount > 0 ? `<div class="project-card__meta">${postCount} post${postCount !== 1 ? 's' : ''}</div>` : '';
    const tags = (p.tech || []).join(',');
    const title = (p.title || '').replace(/"/g, '&quot;');
    const desc = (p.description || '').replace(/"/g, '&quot;');

    return `
    <a href="/projects/${p.slug}/" class="project-card panel panel--greeble" data-tags="${tags}" data-title="${title}" data-description="${desc}">
      <div class="project-card__status">${p.status || 'completed'}</div>
      <h3 class="project-card__title">${p.title}</h3>
      <p class="project-card__description">${p.description || ''}</p>
      <div class="project-card__tech">${renderTags(p.tech)}</div>
      ${postLabel}
    </a>`;
  }).join('\n');

  const html = buildPage(template, {
    title: CONFIG.sections.projects.title,
    description: CONFIG.sections.projects.description,
    projects: projectCards,
    tagList,
    'nav-home': '',
    'nav-blog': '',
    'nav-projects': 'nav__link--active',
    'nav-about': '',
  }, partials);

  fs.mkdirSync(path.join(PUBLIC_DIR, 'projects'), { recursive: true });
  fs.writeFileSync(path.join(PUBLIC_DIR, 'projects', 'index.html'), html);
  console.log('  Built: /projects/');
}

function buildProjectPages(projects, posts, partials) {
  const template = loadTemplate('project-detail.html');

  for (const project of projects) {
    const outDir = path.join(PUBLIC_DIR, 'projects', project.slug);
    fs.mkdirSync(outDir, { recursive: true });

    // Find associated posts, sorted chronologically (oldest first for build log)
    const associatedPosts = posts
      .filter(p => p.project === project.slug)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const postListHtml = associatedPosts.map((p, i) => {
      const readTime = estimateReadingTime(p.rawContent);
      return `
      <a href="/blog/${p.slug}/" class="post-card">
        <div class="post-card__meta">${formatDate(p.date)} — ${readTime} min read</div>
        <h3 class="post-card__title">${p.title}</h3>
        <p class="post-card__description">${p.description || ''}</p>
        <div class="post-card__tags">${renderTags(p.tags)}</div>
      </a>`;
    }).join('\n');

    const heroHtml = project.hero
      ? `<div class="project-detail__hero"><img src="${project.hero}" alt="${project.title}"></div>`
      : '';

    const links = [];
    if (project.url) links.push(`<a href="${project.url}" class="admin-btn" target="_blank" rel="noopener">Live Site →</a>`);
    if (project.repo) links.push(`<a href="${project.repo}" class="admin-btn" target="_blank" rel="noopener">Source →</a>`);
    const projectLinks = links.length
      ? `<div style="margin-top: var(--space-md); display: flex; gap: var(--space-sm);">${links.join('')}</div>`
      : '';

    let postsSection = '';
    if (associatedPosts.length > 0) {
      postsSection = `
      <hr class="divider">
      <section>
        <div class="section-header">
          <div class="section-header__label">Build Log // ${associatedPosts.length} ${associatedPosts.length === 1 ? 'entry' : 'entries'}</div>
          <h2 class="section-header__title">Project Posts</h2>
          <div class="section-header__line"></div>
        </div>
        <div class="grid grid--2col">
          ${postListHtml}
        </div>
      </section>`;
    }

    const html = buildPage(template, {
      title: project.title,
      description: project.description || '',
      status: project.status || 'completed',
      tech: renderTags(project.tech),
      content: project.html,
      hero: heroHtml,
      projectLinks,
      postsSection,
      'nav-home': '',
      'nav-blog': '',
      'nav-projects': 'nav__link--active',
      'nav-about': '',
    }, partials);

    fs.writeFileSync(path.join(outDir, 'index.html'), html);
    console.log(`  Built: /projects/${project.slug}/`);
  }
}

// --- Build Static Pages ---

function buildHomepage(posts, projects, partials) {
  const base = loadTemplate('base.html');

  const heroLabel = CONFIG.homepage.heroLabel;
  const heroTitle = CONFIG.homepage.heroTitle;
  const heroSubtitle = CONFIG.homepage.heroSubtitle;

  const recentPosts = posts.slice(0, 3).map((p, i) => {
    const readTime = estimateReadingTime(p.rawContent);
    return `
    <a href="/blog/${p.slug}/" class="post-card">
      <div class="post-card__meta">${formatDate(p.date)} — ${readTime} min read</div>
      <h3 class="post-card__title">${p.title}</h3>
      <p class="post-card__description">${p.description || ''}</p>
    </a>`;
  }).join('\n');

  const recentProjects = projects.slice(0, 3).map(p => `
    <a href="/projects/${p.slug}/" class="project-card panel">
      <div class="project-card__status">${p.status || 'completed'}</div>
      <h3 class="project-card__title">${p.title}</h3>
      <p class="project-card__description">${p.description || ''}</p>
    </a>`).join('\n');

  const content = `
  <section class="hero">
    <div class="container">
      <div class="section-header__label">${heroLabel}</div>
      <h1 class="hero__title">${heroTitle}</h1>
      <p class="hero__subtitle">${heroSubtitle}</p>
    </div>
  </section>

  <section class="container" style="padding-bottom: var(--space-2xl);">
    <div class="section-header">
      <div class="section-header__label">Sector: Recent Articles</div>
      <h2 class="section-header__title">Latest Posts</h2>
      <div class="section-header__line"></div>
    </div>
    <div class="grid grid--2col">
      ${recentPosts}
    </div>
    <div style="margin-top: var(--space-lg);">
      <a href="/blog/" class="nav__link" style="font-family: var(--font-mono); font-size: 0.8rem;">View all articles →</a>
    </div>
  </section>

  <hr class="divider container">

  <section class="container" style="padding-bottom: var(--space-2xl);">
    <div class="section-header">
      <div class="section-header__label">Sector: Projects</div>
      <h2 class="section-header__title">Recent Projects</h2>
      <div class="section-header__line"></div>
    </div>
    <div class="grid grid--3col">
      ${recentProjects}
    </div>
    <div style="margin-top: var(--space-lg);">
      <a href="/projects/" class="nav__link" style="font-family: var(--font-mono); font-size: 0.8rem;">View all projects →</a>
    </div>
  </section>`;

  const html = buildPage(base, {
    title: 'Home',
    description: `Personal website of ${CONFIG.author.name} — blog, projects, and more.`,
    content,
    'nav-home': 'nav__link--active',
    'nav-blog': '',
    'nav-projects': '',
    'nav-about': '',
  }, partials);

  fs.writeFileSync(path.join(PUBLIC_DIR, 'index.html'), html);
  console.log('  Built: /');
}

function buildAboutPage(partials) {
  const base = loadTemplate('base.html');
  const aboutFile = path.join(CONTENT_DIR, 'about.md');

  let aboutData = { title: CONFIG.sections.about.title, description: CONFIG.sections.about.description };
  let aboutHtml = `<p>Hi, I'm ${CONFIG.author.name}. This about page can be edited from the admin panel.</p>`;

  if (fs.existsSync(aboutFile)) {
    const raw = fs.readFileSync(aboutFile, 'utf-8');
    const parsed = matter(raw);
    aboutData = { ...aboutData, ...parsed.data };
    aboutHtml = marked(parsed.content);
  }

  // Photo display
  // Contact panel items
  const contactItems = [];
  if (aboutData.email) {
    contactItems.push(`<a href="mailto:${aboutData.email}" class="contact-panel__item" title="Email">Email</a>`);
  }
  if (aboutData.linkedin) {
    contactItems.push(`<a href="${aboutData.linkedin}" class="contact-panel__item" target="_blank" rel="noopener" title="LinkedIn">LinkedIn</a>`);
  }
  if (aboutData.github) {
    contactItems.push(`<a href="${aboutData.github}" class="contact-panel__item" target="_blank" rel="noopener" title="GitHub">GitHub</a>`);
  }
  if (aboutData.twitter) {
    contactItems.push(`<a href="${aboutData.twitter}" class="contact-panel__item" target="_blank" rel="noopener" title="Twitter/X">Twitter</a>`);
  }

  const resumeExists = fs.existsSync(path.join(CONTENT_DIR, 'resume', 'resume.pdf'));
  if (resumeExists) {
    contactItems.push(`<a href="/resume/resume.pdf" class="contact-panel__item contact-panel__item--resume" target="_blank" rel="noopener" title="Download Resume">Resume</a>`);
  }

  // Build intro section with photo and contact
  // Find photo file with any image extension (photos are in public/images/ via Docker volume)
  const photoExts = ['.jpg', '.png', '.gif', '.webp'];
  let detectedPhotoFile = null;
  for (const ext of photoExts) {
    if (fs.existsSync(path.join(PUBLIC_DIR, 'images', 'about', 'photo' + ext))) {
      detectedPhotoFile = 'photo' + ext;
      break;
    }
  }
  const photoPath = aboutData.photo || (detectedPhotoFile ? '/images/about/' + detectedPhotoFile : '/images/about/photo.jpg');
  const photoExists = !!detectedPhotoFile;
  
  let introSection = '';
  if (photoExists && contactItems.length > 0) {
    introSection = `
    <div class="about-intro">
      <div class="about-intro__photo-wrapper">
        <img src="${photoPath}" alt="Profile photo" class="about-intro__photo">
      </div>
      <div class="about-intro__right">
        <header class="about-intro__header">
          <h1>${aboutData.title || 'About'}</h1>
          ${aboutData.description ? `<p class="about-intro__description">${aboutData.description}</p>` : ''}
        </header>
        <div class="contact-panel panel panel--greeble">
          <div class="contact-panel__label">Get in Touch</div>
          <div class="contact-panel__items">
            ${contactItems.join('')}
          </div>
        </div>
      </div>
    </div>`;
  }

  const content = `
  <div class="container">
    ${introSection}

    <div class="prose">
      ${aboutHtml}
    </div>
  </div>`;

  const html = buildPage(base, {
    title: aboutData.title || 'About',
    description: aboutData.description || '',
    content,
    'nav-home': '',
    'nav-blog': '',
    'nav-projects': '',
    'nav-about': 'nav__link--active',
  }, partials);

  fs.writeFileSync(path.join(PUBLIC_DIR, 'about.html'), html);
  console.log('  Built: /about.html');
}

// --- Build Graph Data ---

function buildGraphData(posts, projects) {
  const nodes = [
    ...posts.map(p => ({
      id: p.slug,
      title: p.title,
      tags: p.tags || [],
      url: `/blog/${p.slug}/`,
      type: 'post',
    })),
    ...projects.map(p => ({
      id: 'project-' + p.slug,
      title: p.title,
      tags: p.tech || [],
      url: `/projects/${p.slug}/`,
      type: 'project',
    })),
  ];

  const edgeSet = new Set();
  const edges = [];

  // Explicit related posts
  for (const post of posts) {
    if (post.relatedPosts) {
      for (const related of post.relatedPosts) {
        const key = [post.slug, related].sort().join('::');
        if (!edgeSet.has(key) && posts.some(p => p.slug === related)) {
          edgeSet.add(key);
          edges.push({ source: post.slug, target: related, type: 'related' });
        }
      }
    }
  }

  // Project associations
  for (const post of posts) {
    if (post.project && projects.some(p => p.slug === post.project)) {
      edges.push({ source: post.slug, target: 'project-' + post.project, type: 'project' });
    }
  }

  // Shared tags
  for (let i = 0; i < posts.length; i++) {
    for (let j = i + 1; j < posts.length; j++) {
      const shared = (posts[i].tags || []).filter(t => (posts[j].tags || []).includes(t));
      if (shared.length > 0) {
        const key = [posts[i].slug, posts[j].slug].sort().join('::');
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({ source: posts[i].slug, target: posts[j].slug, type: 'tag', tags: shared });
        }
      }
    }
  }

  const data = { nodes, edges };
  fs.writeFileSync(path.join(PUBLIC_DIR, 'graph-data.json'), JSON.stringify(data, null, 2));
  console.log('  Built: /graph-data.json');
}

// --- Build 404 Page ---

function build404Page(partials) {
  const base = loadTemplate('base.html');

  const content = `
  <section class="container" style="padding: var(--space-2xl) 0; text-align: center;">
    <div class="section-header__label">Error 404</div>
    <h1 style="font-family: var(--font-heading); font-size: 4rem; margin: var(--space-md) 0;">Page Not Found</h1>
    <p style="color: var(--text-secondary); margin-bottom: var(--space-lg);">The requested path does not exist.</p>
    <a href="/" class="nav__link" style="font-family: var(--font-mono); font-size: 0.85rem;">← Return to homepage</a>
  </section>`;

  const html = buildPage(base, {
    title: '404 — Not Found',
    description: 'Page not found',
    content,
    'nav-home': '',
    'nav-blog': '',
    'nav-projects': '',
    'nav-about': '',
  }, partials);

  fs.writeFileSync(path.join(PUBLIC_DIR, '404.html'), html);
  console.log('  Built: /404.html');
}

// --- Build RSS ---

function buildRSS(posts) {
  const items = posts.slice(0, 20).map(p => `
    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${CONFIG.site.baseUrl}/blog/${p.slug}/</link>
      <description>${escapeXml(p.description || '')}</description>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
      <guid>${CONFIG.site.baseUrl}/blog/${p.slug}/</guid>
    </item>`).join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${CONFIG.rss.title}</title>
    <link>${CONFIG.site.baseUrl}</link>
    <description>${CONFIG.rss.description}</description>
    <language>en-us</language>
    <atom:link href="${CONFIG.site.baseUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;

  fs.writeFileSync(path.join(PUBLIC_DIR, 'rss.xml'), rss);
  console.log('  Built: /rss.xml');
}

// --- Generate Theme CSS ---

function buildThemeCSS() {
  const theme = CONFIG.theme || { light: {}, dark: {} };

  let css = ':root {\n';

  // Light theme (default)
  const lightColors = theme.light || {};
  css += '  /* Light theme (default) */\n';
  css += `  --bg-primary: ${lightColors.bgPrimary || '#F8F8F6'};\n`;
  css += `  --bg-secondary: ${lightColors.bgSecondary || '#EEEEE8'};\n`;
  css += `  --bg-tertiary: ${lightColors.bgTertiary || '#E4E4DC'};\n`;
  css += `  --line-primary: ${lightColors.linePrimary || '#C8C8C0'};\n`;
  css += `  --line-accent: ${lightColors.lineAccent || '#2A2A2A'};\n`;
  css += `  --accent-red: ${lightColors.accentRed || '#CC2020'};\n`;
  css += `  --accent-red-hover: ${lightColors.accentRedHover || '#A01818'};\n`;
  css += `  --accent-blue: ${lightColors.accentBlue || '#1A56DB'};\n`;
  css += `  --text-primary: ${lightColors.textPrimary || '#1A1A1A'};\n`;
  css += `  --text-secondary: ${lightColors.textSecondary || '#5A5A5A'};\n`;
  css += `  --text-muted: ${lightColors.textMuted || '#8A8A82'};\n`;
  css += `  --bg-code: ${lightColors.bgCode || '#F0F0EA'};\n`;
  css += `  --shadow: ${lightColors.shadow || '0 1px 3px rgba(0,0,0,0.06)'};\n`;
  css += '}\n\n';

  // Dark theme
  const darkColors = theme.dark || {};
  css += '[data-theme="dark"] {\n';
  css += '  /* Dark theme */\n';
  css += `  --bg-primary: ${darkColors.bgPrimary || '#141414'};\n`;
  css += `  --bg-secondary: ${darkColors.bgSecondary || '#1E1E1E'};\n`;
  css += `  --bg-tertiary: ${darkColors.bgTertiary || '#282828'};\n`;
  css += `  --line-primary: ${darkColors.linePrimary || '#3A3A3A'};\n`;
  css += `  --line-accent: ${darkColors.lineAccent || '#D0D0D0'};\n`;
  css += `  --accent-red: ${darkColors.accentRed || '#E04040'};\n`;
  css += `  --accent-red-hover: ${darkColors.accentRedHover || '#FF5555'};\n`;
  css += `  --accent-blue: ${darkColors.accentBlue || '#4B8BFF'};\n`;
  css += `  --text-primary: ${darkColors.textPrimary || '#E8E8E8'};\n`;
  css += `  --text-secondary: ${darkColors.textSecondary || '#A0A0A0'};\n`;
  css += `  --text-muted: ${darkColors.textMuted || '#6A6A6A'};\n`;
  css += `  --bg-code: ${darkColors.bgCode || '#1A1A1A'};\n`;
  css += `  --shadow: ${darkColors.shadow || '0 1px 3px rgba(0,0,0,0.3)'};\n`;
  css += '}\n';

  fs.mkdirSync(path.join(PUBLIC_DIR, 'css'), { recursive: true });
  fs.writeFileSync(path.join(PUBLIC_DIR, 'css', 'theme.css'), css);
  console.log('  Built: /css/theme.css');

  // Generate site-config.js for client-side effects config
  const effectsConfig = JSON.stringify(CONFIG.effects || {});
  const configJs = `window.__SITE_CONFIG__ = { effects: ${effectsConfig} };`;
  fs.mkdirSync(path.join(PUBLIC_DIR, 'js'), { recursive: true });
  fs.writeFileSync(path.join(PUBLIC_DIR, 'js', 'site-config.js'), configJs);
  console.log('  Built: /js/site-config.js');
}

// --- Helper Functions ---

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// --- Main Build ---

function build() {
  console.log('Building site...');

  // Load partials fresh each build (avoid caching issues during development)
  const partials = {
    head: loadPartial('head.html'),
    nav: loadPartial('nav.html'),
    footer: loadPartial('footer.html'),
  };

  // Generate theme CSS from config
  buildThemeCSS();

  // Load content
  const posts = loadMarkdownFiles('blog');
  const projects = loadMarkdownFiles('projects');

  // Build pages
  buildHomepage(posts, projects, partials);
  buildAboutPage(partials);
  buildBlogPosts(posts, projects, partials);
  buildBlogIndex(posts, partials);
  buildProjectsIndex(projects, posts, partials);
  buildProjectPages(projects, posts, partials);
  buildGraphData(posts, projects);
  buildRSS(posts);
  build404Page(partials);

  console.log('✓ Build complete');
}

// Export for use in other modules
module.exports = { build };

// If run directly as a script
if (require.main === module) {
  build();
}
