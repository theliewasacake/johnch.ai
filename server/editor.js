const express = require('express');
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { build } = require('./build');
const { syncToGit } = require('./git-sync');

const router = express.Router();
const CONTENT_DIR = path.join(__dirname, '..', 'content');

// List all posts
router.get('/api/posts', (req, res) => {
  const posts = listContent('blog');
  res.json(posts);
});

// List all projects
router.get('/api/projects', (req, res) => {
  const projects = listContent('projects');
  res.json(projects);
});

// Get a single post/project
router.get('/api/content/:type/:slug', (req, res) => {
  const { type, slug } = req.params;
  if (!['blog', 'projects'].includes(type)) {
    return res.status(400).json({ error: 'Invalid content type' });
  }

  const filePath = path.join(CONTENT_DIR, type, `${slug}.md`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Not found' });
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  res.json({ ...data, slug, content });
});

// Save a post/project
router.post('/api/content/:type/:slug', express.json(), (req, res) => {
  const { type, slug } = req.params;
  if (!['blog', 'projects'].includes(type)) {
    return res.status(400).json({ error: 'Invalid content type' });
  }

  // Validate slug (prevent path traversal)
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return res.status(400).json({ error: 'Invalid slug. Use lowercase letters, numbers, and hyphens.' });
  }

  const { frontmatter, content } = req.body;
  if (!frontmatter || content === undefined) {
    return res.status(400).json({ error: 'Missing frontmatter or content' });
  }

  const dir = path.join(CONTENT_DIR, type);
  fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, `${slug}.md`);
  const fileContent = matter.stringify(content, frontmatter);
  fs.writeFileSync(filePath, fileContent);

  // Trigger rebuild
  try {
    build();
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Saved but rebuild failed: ' + err.message });
  }

  // Sync to git
  const gitResult = syncToGit(filePath, 'save');
  res.json({ ok: true, message: 'Saved and rebuilt', git: gitResult });
});

// Delete a post/project
router.delete('/api/content/:type/:slug', (req, res) => {
  const { type, slug } = req.params;
  if (!['blog', 'projects'].includes(type)) {
    return res.status(400).json({ error: 'Invalid content type' });
  }

  const filePath = path.join(CONTENT_DIR, type, `${slug}.md`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Not found' });
  }

  fs.unlinkSync(filePath);

  // Also remove the built HTML
  const htmlDir = path.join(__dirname, '..', 'public', type, slug);
  if (fs.existsSync(htmlDir)) {
    fs.rmSync(htmlDir, { recursive: true });
  }

  try {
    build();
  } catch (err) {
    // Continue to git sync even if rebuild has issues
    console.error('Rebuild had issues:', err.message);
  }

  // Sync deletion to git
  const gitResult = syncToGit(filePath, 'delete');
  res.json({ ok: true, message: 'Deleted and rebuilt', git: gitResult });
});

function listContent(type) {
  const dir = path.join(CONTENT_DIR, type);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
      const { data } = matter(raw);
      return { ...data, slug: path.basename(f, '.md') };
    })
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

// Get about page content
router.get('/api/content/about', (req, res) => {
  const filePath = path.join(CONTENT_DIR, 'about.md');
  if (!fs.existsSync(filePath)) {
    return res.json({ title: 'About', description: '', content: '' });
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  res.json({ ...data, content });
});

// Save about page content
router.post('/api/content/about', express.json(), (req, res) => {
  const { frontmatter, content } = req.body;
  if (!frontmatter || content === undefined) {
    return res.status(400).json({ error: 'Missing frontmatter or content' });
  }

  fs.mkdirSync(CONTENT_DIR, { recursive: true });
  const filePath = path.join(CONTENT_DIR, 'about.md');
  const fileContent = matter.stringify(content, frontmatter);
  fs.writeFileSync(filePath, fileContent);

  try {
    build();
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Saved but rebuild failed: ' + err.message });
  }

  // Sync to git
  const gitResult = syncToGit(filePath, 'save');
  res.json({ ok: true, message: 'Saved and rebuilt', git: gitResult });
});

module.exports = router;
