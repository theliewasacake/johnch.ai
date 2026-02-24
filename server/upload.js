const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const router = express.Router();
const CONTENT_DIR = path.join(__dirname, '..', 'content');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Git sync helper for images
function syncImageToGit(filePath) {
  try {
    const relativePath = path.relative(CONTENT_DIR, filePath);
    const message = `upload: ${relativePath}`;

    execSync('git add -A', { cwd: CONTENT_DIR, stdio: 'pipe' });
    execSync(`git commit -m "${message}"`, { cwd: CONTENT_DIR, stdio: 'pipe' });
    execSync('git push', { cwd: CONTENT_DIR, stdio: 'pipe' });

    console.log(`[git] Synced: ${message}`);
    return { synced: true };
  } catch (err) {
    if (err.message?.includes('nothing to commit')) {
      return { synced: true, message: 'No changes to commit' };
    }
    console.error('[git] Sync failed:', err.message);
    return { synced: false, error: err.message };
  }
}

// Configure storage - images go to content/images/ for git backup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const slug = req.params.slug;
    const dir = path.join(CONTENT_DIR, 'images', slug);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename: lowercase, strip special chars, add timestamp prefix
    const safe = file.originalname
      .toLowerCase()
      .replace(/[^a-z0-9.\-_]/g, '-')
      .replace(/-+/g, '-');
    cb(null, Date.now() + '-' + safe);
  }
});

// File filter: only allow images
const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  cb(null, allowed.includes(file.mimetype));
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter
});

// Upload an image
router.post('/api/upload/:slug', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No valid image uploaded' });
  }

  const slug = req.params.slug;
  const url = `/images/${slug}/${req.file.filename}`;

  // Also copy to public/images for immediate serving (without build step)
  try {
    const publicDestDir = path.join(PUBLIC_DIR, 'images', slug);
    fs.mkdirSync(publicDestDir, { recursive: true });
    fs.copyFileSync(req.file.path, path.join(publicDestDir, req.file.filename));
  } catch (err) {
    console.error('[upload] Failed to copy to public:', err.message);
  }

  // Sync to git
  const gitResult = syncImageToGit(req.file.path);

  res.json({ ok: true, url, filename: req.file.filename, git: gitResult });
});

// List images for a slug
router.get('/api/images/:slug', (req, res) => {
  const slug = req.params.slug;
  const dir = path.join(CONTENT_DIR, 'images', slug);

  if (!fs.existsSync(dir)) {
    return res.json([]);
  }

  const files = fs.readdirSync(dir)
    .filter(f => /\.(jpe?g|png|gif|webp)$/i.test(f))
    .map(f => ({
      name: f,
      url: `/images/${slug}/${f}`
    }));

  res.json(files);
});

// --- Resume PDF Upload ---

const resumeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(CONTENT_DIR, 'resume');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, 'resume.pdf');
  }
});

const resumeUpload = multer({
  storage: resumeStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype === 'application/pdf');
  }
});

router.post('/api/upload-resume', resumeUpload.single('resume'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No valid PDF uploaded' });
  }

  // Also copy to public/resume for serving
  try {
    const publicDestDir = path.join(PUBLIC_DIR, 'resume');
    fs.mkdirSync(publicDestDir, { recursive: true });
    fs.copyFileSync(req.file.path, path.join(publicDestDir, req.file.filename));
  } catch (err) {
    console.error('[upload] Failed to copy resume to public:', err.message);
  }

  // Sync to git
  const gitResult = syncImageToGit(req.file.path);

  res.json({ ok: true, url: '/resume/resume.pdf', git: gitResult });
});

router.get('/api/resume-status', (req, res) => {
  const resumePath = path.join(CONTENT_DIR, 'resume', 'resume.pdf');
  const exists = fs.existsSync(resumePath);
  res.json({ exists, url: exists ? '/resume/resume.pdf' : null });
});

// --- Profile Photo Upload ---

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(CONTENT_DIR, 'about');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, 'photo.jpg');
  }
});

const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  }
});

router.post('/api/upload-photo', photoUpload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No valid image uploaded' });
  }

  // Also copy to public/about for serving
  try {
    const publicDestDir = path.join(PUBLIC_DIR, 'about');
    fs.mkdirSync(publicDestDir, { recursive: true });
    fs.copyFileSync(req.file.path, path.join(publicDestDir, req.file.filename));
  } catch (err) {
    console.error('[upload] Failed to copy photo to public:', err.message);
  }

  // Sync to git
  const gitResult = syncImageToGit(req.file.path);

  res.json({ ok: true, url: '/about/photo.jpg', git: gitResult });
});

// --- Favicon Uploads ---

const faviconStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(CONTENT_DIR, 'favicons');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const type = req.body.type || 'light'; // 'light' or 'dark'
    cb(null, `favicon${type === 'dark' ? '-dark' : ''}.svg`);
  }
});

const faviconUpload = multer({
  storage: faviconStorage,
  limits: { fileSize: 1 * 1024 * 1024 }, // 1 MB for SVGs
  fileFilter: (req, file, cb) => {
    const allowed = ['image/svg+xml'];
    cb(null, allowed.includes(file.mimetype));
  }
});

router.post('/api/upload-favicon', faviconUpload.single('favicon'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No valid SVG uploaded' });
  }

  const type = req.body.type || 'light';
  const filename = `favicon${type === 'dark' ? '-dark' : ''}.svg`;

  // Also copy to public/favicons/ for serving
  try {
    const publicDestDir = path.join(PUBLIC_DIR, 'favicons');
    fs.mkdirSync(publicDestDir, { recursive: true });
    fs.copyFileSync(req.file.path, path.join(publicDestDir, filename));
  } catch (err) {
    console.error('[upload] Failed to copy favicon to public:', err.message);
  }

  // Sync to git
  const gitResult = syncImageToGit(req.file.path);

  res.json({ ok: true, url: '/favicons/' + filename, git: gitResult });
});

router.get('/api/favicons-status', (req, res) => {
  const lightPath = path.join(CONTENT_DIR, 'favicons', 'favicon.svg');
  const darkPath = path.join(CONTENT_DIR, 'favicons', 'favicon-dark.svg');

  res.json({
    light: { exists: fs.existsSync(lightPath), url: fs.existsSync(lightPath) ? '/favicons/favicon.svg' : null },
    dark: { exists: fs.existsSync(darkPath), url: fs.existsSync(darkPath) ? '/favicons/favicon-dark.svg' : null }
  });
});

module.exports = router;
