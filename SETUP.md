# Setup Guide - johnch.ai Template

This is a template for a personal blog website with projects showcase. Follow this guide to customize it for your own site.

## Initial Setup

### 1. Clone and Configure

```bash
# Clone the repository
git clone <your-forked-repo-url>
cd johnch.ai

# Copy the config template
cp config.json.example config.json

# Copy the environment template
cp .env.example .env
```

### 2. Edit `config.json`

This is where you customize the entire site with your personal information:

```json
{
  "site": {
    "name": "Your Site Name",           // Appears in nav, footer, page titles
    "title": "Personal Website",         // SEO title
    "description": "...",                // SEO description
    "baseUrl": "https://yoursite.com"   // For RSS and sitemaps
  },
  "author": {
    "name": "Your Name",                 // Used throughout site
    "email": "you@example.com",          // (Optional)
    "githubUsername": "yourusername",    // Used in footer link
    "githubProfileUrl": "https://github.com/yourusername"
  },
  "homepage": {
    "heroLabel": "System Online",        // Top label (customize to fit your brand)
    "heroTitle": "Your Name",            // Main headline
    "heroSubtitle": "Your tagline..."    // Subheading
  },
  "sections": {
    "blog": {
      "title": "Blog",
      "description": "Articles and thoughts"
    },
    "projects": {
      "title": "Projects",
      "description": "Things I've built"
    },
    "about": {
      "title": "About",
      "description": ""
    }
  },
  "rss": {
    "title": "Your Site Name",
    "description": "Articles by Your Name"
  }
}
```

### 3. Edit `.env`

```bash
# Generate a bcrypt password hash for the admin panel:
node -e "const bcrypt=require('bcrypt');bcrypt.hash('your-secure-password',12).then(h=>console.log(h))"

# Then paste the hash here:
ADMIN_PASSWORD_HASH=<paste-the-hash>

# Use a random string (any length, recommend 32+ chars):
SESSION_SECRET=your-random-secret-string-here
```

### 4. Create Content

#### Add your About page:
```bash
# Edit the about page content
# This file is created when you first use the admin panel, or create it manually:
nano content/about.md
```

Example content:
```markdown
---
title: About
description: About me
---

Hi! I'm [Your Name]. I write about...
```

#### Optional: Homepage content
```bash
nano content/home.md
```

This allows you to override the homepage hero section. If it doesn't exist, config values are used.

#### Blog posts and projects:
Create these through the admin panel at `/admin/` (password from `.env`)

Or manually create them:
```
content/blog/my-first-post.md
content/projects/my-awesome-project.md
```

## Running Locally

```bash
# Install dependencies
npm install

# Build static site from markdown
npm run build

# Start the server (dev mode)
npm run dev

# Visit http://localhost:3000
# Admin panel: http://localhost:3000/admin/login.html
```

## File Structure

```
johnch.ai/
├── config.json              ← CUSTOMIZE THIS
├── .env                     ← CUSTOMIZE THIS (don't commit to git)
├── content/                 ← Your blog posts & projects
│   ├── blog/
│   ├── projects/
│   ├── about.md
│   └── home.md (optional)
├── server/
│   ├── index.js            ← Express server
│   ├── build.js            ← Converts markdown → HTML
│   ├── editor.js           ← Admin REST API
│   └── auth.js             ← Password verification
├── templates/              ← HTML templates (uses {{variable}} syntax)
├── admin/                  ← Admin panel UI
├── public/                 ← Built static site output
└── Dockerfile + docker-compose.yml ← For Docker deployments
```

## Key Features

- **All configurable**: Site name, author info, section titles, etc.
- **Static output**: `npm run build` generates static HTML files
- **Admin panel**: Edit content via `/admin/` interface
- **No database**: All content is markdown files
- **Git-friendly**: Content can be version controlled separately
- **Theme support**: Light/dark mode with CSS variables
- **Responsive**: Mobile-first design

## Design System

Edit `public/css/global.css` to customize:
- Colors (CSS custom properties: `--text-primary`, `--accent-red`, etc.)
- Fonts (Aldrich, Inter, JetBrains Mono)
- Spacing (scale-based tokens)

## Deployment

### Docker (Recommended)

```bash
# Create .env for Docker
cp .env.example .env

# Edit .env with your values
nano .env

# Add these to .env:
REPO_URL=https://github.com/yourusername/your-fork.git
CONTENT_REPO_URL=git@github.com:yourusername/your-private-content-repo.git

# Build and run
docker-compose up -d
```

### Traditional Server

```bash
# Set environment variables
export ADMIN_PASSWORD_HASH="..."
export SESSION_SECRET="..."
export NODE_ENV=production

# Start server
npm install
npm run build
npm start
```

## Content Format

### Blog posts (markdown with frontmatter):

```markdown
---
title: My Post Title
description: A brief description for previews
date: 2024-01-15
tags: [javascript, web]
draft: false
project: my-project-slug
relatedPosts: [other-post-slug]
---

# Post content in markdown...
```

### Projects:

```markdown
---
title: My Project
description: What it does
url: https://project-url.com
repo: https://github.com/user/repo
tech: [node, react, postgresql]
status: completed
order: 1
hero: /images/my-project/hero.jpg
---

# Project description...
```

## Customization Tips

1. **Logo**: Replace `/public/favicon.svg` and `/public/favicon-dark.svg`
2. **Colors**: Edit CSS variables in `public/css/global.css`
3. **Fonts**: Change in `public/css/global.css` or `templates/partials/head.html`
4. **Sections**: Add/remove nav links in `templates/partials/nav.html` and `build.js`
5. **Homepage**: Customize in `config.json` or create `content/home.md`

## Admin Panel

Access at `/admin/login.html` after starting the server.

Features:
- Create/edit/delete blog posts
- Create/edit/delete projects
- Edit homepage and about page
- Upload images (stored by content slug)
- Live markdown preview
- Auto-save
- Rebuild site with one click

## Next Steps

1. ✅ Copy config files
2. ✅ Edit `config.json` with your info
3. ✅ Edit `.env` with secure password
4. ✅ Create `content/about.md`
5. ✅ Run `npm install && npm run build`
6. ✅ Start with `npm run dev`
7. ✅ Log into admin panel and create your first post

Enjoy! 🚀
