const path = require('path');
const { execSync } = require('child_process');

const CONTENT_DIR = path.join(__dirname, '..', 'content');

/**
 * Commits and pushes content changes to the git repo in the content directory.
 * @param {string} filePath - Absolute path to the changed file
 * @param {string} action - Action label for the commit message (e.g. 'save', 'upload', 'delete')
 * @returns {{ synced: boolean, message?: string, error?: string }}
 */
function syncToGit(filePath, action = 'update') {
  // Check if content dir is a git repo
  try {
    execSync('git rev-parse --git-dir', { cwd: CONTENT_DIR, stdio: 'pipe' });
  } catch {
    return { synced: false, message: 'Content directory is not a git repo' };
  }

  const relativePath = path.relative(CONTENT_DIR, filePath);
  const message = `${action}: ${relativePath}`;

  try {
    execSync('git add -A', { cwd: CONTENT_DIR, stdio: 'pipe' });
    execSync(`git commit -m "${message}"`, { cwd: CONTENT_DIR, stdio: 'pipe' });
  } catch (err) {
    if (err.message?.includes('nothing to commit')) {
      return { synced: true, message: 'No changes to commit' };
    }
    console.error('[git] Commit failed:', err.message);
    return { synced: false, error: err.message };
  }

  // Push is best-effort — don't fail the save if push fails (e.g. no remote, no auth)
  try {
    execSync('git push', { cwd: CONTENT_DIR, stdio: 'pipe' });
    console.log(`[git] Synced: ${message}`);
    return { synced: true };
  } catch (err) {
    console.warn(`[git] Committed locally but push failed: ${err.message}`);
    return { synced: true, pushed: false, message: 'Committed locally, push failed' };
  }
}

module.exports = { syncToGit };
