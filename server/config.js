const express = require('express');
const fs = require('fs');
const path = require('path');
const { build } = require('./build');
const { syncToGit } = require('./git-sync');

const router = express.Router();
const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content');
const CONFIG_PATH = path.join(ROOT, 'config.json');

// Get current config (with fallback defaults)
router.get('/api/config', (req, res) => {
  try {
    const defaultConfig = {
      site: { name: 'My Site', title: 'My Website', description: 'Welcome', baseUrl: 'https://example.com' },
      author: { name: 'Author Name', email: '', githubUsername: '', githubProfileUrl: '' },
      homepage: { heroLabel: 'Welcome', heroTitle: 'Author Name', heroSubtitle: 'Welcome to my site' },
      sections: {
        blog: { title: 'Blog', description: 'Articles and thoughts', sectorLabel: 'Sector: Recent Articles' },
        projects: { title: 'Projects', description: 'Things I\'ve built', sectorLabel: 'Sector: Projects' },
        about: { title: 'About', description: '' }
      },
      rss: { title: 'My Site', description: 'Articles' },
      effects: { glitch: { enabled: true, intervalMin: 3000, intervalMax: 8000, triggerOnHover: true } },
      theme: {
        light: {
          bgPrimary: '#F8F8F6', bgSecondary: '#EEEEE8', bgTertiary: '#E4E4DC',
          linePrimary: '#C8C8C0', lineAccent: '#2A2A2A', accentRed: '#CC2020',
          accentRedHover: '#A01818', accentBlue: '#1A56DB', textPrimary: '#1A1A1A',
          textSecondary: '#5A5A5A', textMuted: '#8A8A82', bgCode: '#F0F0EA',
          shadow: '0 1px 3px rgba(0,0,0,0.06)'
        },
        dark: {
          bgPrimary: '#141414', bgSecondary: '#1E1E1E', bgTertiary: '#282828',
          linePrimary: '#3A3A3A', lineAccent: '#D0D0D0', accentRed: '#E04040',
          accentRedHover: '#FF5555', accentBlue: '#4B8BFF', textPrimary: '#E8E8E8',
          textSecondary: '#A0A0A0', textMuted: '#6A6A6A', bgCode: '#1A1A1A',
          shadow: '0 1px 3px rgba(0,0,0,0.3)'
        }
      }
    };

    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      // Merge with defaults to ensure all fields exist
      const merged = {
        ...defaultConfig,
        ...config,
        site: { ...defaultConfig.site, ...(config.site || {}) },
        author: { ...defaultConfig.author, ...(config.author || {}) },
        homepage: { ...defaultConfig.homepage, ...(config.homepage || {}) },
        sections: { ...defaultConfig.sections, ...(config.sections || {}) },
        rss: { ...defaultConfig.rss, ...(config.rss || {}) },
        theme: {
          light: { ...defaultConfig.theme.light, ...(config.theme?.light || {}) },
          dark: { ...defaultConfig.theme.dark, ...(config.theme?.dark || {}) }
        },
        effects: { glitch: { ...defaultConfig.effects.glitch, ...(config.effects?.glitch || {}) } }
      };
      res.json(merged);
    } else {
      res.json(defaultConfig);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save config
router.post('/api/config', express.json(), (req, res) => {
  try {
    const config = req.body;

    // Validate config has required fields
    if (!config.site || !config.author || !config.homepage || !config.sections) {
      return res.status(400).json({ error: 'Missing required config fields' });
    }

    // Write config to app root (used by build)
    const configStr = JSON.stringify(config, null, 2);
    fs.writeFileSync(CONFIG_PATH, configStr);

    // Also save to content dir for git persistence across deploys
    const contentConfigPath = path.join(CONTENT_DIR, 'config.json');
    fs.mkdirSync(CONTENT_DIR, { recursive: true });
    fs.writeFileSync(contentConfigPath, configStr);

    // Trigger rebuild to apply theme changes
    try {
      build();
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Saved but rebuild failed: ' + err.message });
    }

    // Sync config to git
    const gitResult = syncToGit(contentConfigPath, 'save');

    res.json({ ok: true, message: 'Config saved and rebuilt', git: gitResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
