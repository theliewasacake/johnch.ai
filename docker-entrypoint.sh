#!/bin/sh
set -e

CONTENT_REPO_URL="${CONTENT_REPO_URL}"
CONTENT_DIR="/app/content"
DEPLOY_KEY_FILE="/secrets/content_deploy_key"

echo "=== Blog container starting (prebuild mode) ==="

# Setup SSH for content repo if deploy key is available
setup_ssh_for_content() {
    echo "Setting up SSH for content repository..."

    # Create .ssh directory with proper permissions
    mkdir -p ~/.ssh
    chmod 700 ~/.ssh

    # Add GitHub to known_hosts
    echo "Adding github.com to known_hosts..."
    ssh-keyscan -t ed25519,rsa github.com >> ~/.ssh/known_hosts 2>/dev/null
    chmod 644 ~/.ssh/known_hosts

    # Determine deploy key source
    if [ -f "$DEPLOY_KEY_FILE" ]; then
        echo "Using deploy key from file mount..."
        cp "$DEPLOY_KEY_FILE" ~/.ssh/content_deploy_key
    elif [ -n "$CONTENT_DEPLOY_KEY" ]; then
        echo "Using deploy key from environment variable..."
        echo "$CONTENT_DEPLOY_KEY" | base64 -d > ~/.ssh/content_deploy_key
    else
        return 1
    fi

    # Set proper permissions on the key
    chmod 600 ~/.ssh/content_deploy_key

    # Configure SSH to use this key for github.com
    cat > ~/.ssh/config << EOF
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/content_deploy_key
    IdentitiesOnly yes
EOF
    chmod 600 ~/.ssh/config

    return 0
}

# Clone or pull the content repository (only needed if separate content repo exists)
if [ -n "$CONTENT_REPO_URL" ] && setup_ssh_for_content; then
    echo "SSH configured successfully, cloning/pulling content repository..."

    if [ -d "$CONTENT_DIR/.git" ]; then
        echo "Pulling latest content changes..."
        cd "$CONTENT_DIR"
        git fetch origin
        git reset --hard origin/main
    else
        echo "Cloning content repository..."
        git clone "$CONTENT_REPO_URL" "$CONTENT_DIR"
    fi

    echo "Content repository ready."
else
    echo "No CONTENT_REPO_URL or deploy key found, skipping content repository clone."
    echo "Ensuring content directory exists..."
    mkdir -p "$CONTENT_DIR"
fi

# Ensure images directory exists
mkdir -p /app/public/images

# Build static files from content (if content exists)
if [ -d "$CONTENT_DIR" ] && [ "$(ls -A $CONTENT_DIR)" ]; then
    echo "Building static site from content..."
    npm run build
fi

# Start the server
echo "Starting server..."
exec npm start
