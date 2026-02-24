# Build & Deploy Guide

## Quick Start - Prebuild Model

This project now uses a **prebuild Docker model**: all code is baked into the image at build time. You just pull the latest image and run it.

### Local Development

```bash
# Set environment variables
export ADMIN_PASSWORD_HASH="$(node -e "console.log(require('bcrypt').hashSync('yourpassword', 10))")"
export SESSION_SECRET="your-random-secret-string"

# Optional: if using separate content repo
export CONTENT_REPO_URL="git@github.com:your-org/your-content-repo.git"

# Start with docker-compose
docker-compose up
```

### Production - Build & Push

Whenever you update your app code (server, templates, etc):

```bash
# 1. Commit your code changes
git add .
git commit -m "Your changes"

# 2. Build the Docker image
docker build -t ghcr.io/theliewasacake/johnch.ai:latest .

# 3. Push to GitHub Container Registry
docker push ghcr.io/theliewasacake/johnch.ai:latest
```

### TrueNAS SCALE Deployment

**One-time setup:**

1. In TrueNAS SCALE, create a custom app with:
   - **Image**: `ghcr.io/theliewasacake/johnch.ai:latest`
   - **Pull Policy**: "Always pull image"
   - **Port**: `3000`
   - **Volumes**:
     - `/app/content` → ixVolume (for markdown files)
     - `/app/public/images` → ixVolume (for uploads)
   - **Environment Variables**:
     - `ADMIN_PASSWORD_HASH` → your bcrypt hash
     - `SESSION_SECRET` → random string
     - `CONTENT_REPO_URL` → (optional) your content repo

2. (Optional) If using private content repo, create deploy key:
   - Generate: `ssh-keygen -t ed25519 -f content_deploy_key`
   - Mount at `/mnt/tank/johnch-ai-secrets/content_deploy_key`
   - Add public key to GitHub repo as deploy key with write access

**To update after code changes:**

1. Push code + new Docker image to registry
2. In TrueNAS: Stop the app → Start it (pulls latest image automatically)

## What's in the Image

- Node 20 + dependencies (npm ci)
- Server code (`server/`)
- Templates (`templates/`)
- Public assets (`public/`)

## What's Mounted

- `/app/content` → Your markdown files (blog, projects, about)
- `/app/public/images` → Uploaded images
- (Optional) `/secrets/content_deploy_key` → SSH key for private content repo

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ADMIN_PASSWORD_HASH` | ✅ | Bcrypt hash of admin password |
| `SESSION_SECRET` | ✅ | Random string for session encryption |
| `NODE_ENV` | ✓ | Set to `production` |
| `PORT` | ✓ | Set to `3000` |
| `CONTENT_REPO_URL` | ❌ | GitHub URL of content repo (if using separate repo) |
| `CONTENT_DEPLOY_KEY` | ❌ | Base64-encoded SSH key (alternative to file mount) |

## Content Repository

If you have a **separate private repo** for content (blog posts, projects, about.md):

- Set `CONTENT_REPO_URL` to point to it
- Configure SSH authentication via deploy key (file mount or env var)
- Container will clone/pull it on startup
- Admin panel commits changes back automatically

If you prefer to store content **in the same repo as code**, just skip `CONTENT_REPO_URL` and the entrypoint will use the mounted `/app/content` volume.
