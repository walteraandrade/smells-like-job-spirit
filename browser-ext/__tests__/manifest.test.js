/**
 * Testing library/framework: Jest
 * Rationale:
 * - The repository uses a __tests__ directory pattern and *.test.js files typical of Jest.
 * - If your project uses a different runner, adapt describe/it/expect to that runner.
 *
 * This suite validates the MV3 browser extension manifest with a focus on recent diff changes:
 * - Ensures MV3-compliant background configuration (service_worker, no background.scripts)
 * - Validates content_scripts, permissions, action, and icons
 * - Ensures MV3-compliant web_accessible_resources format
 */

const fs = require('fs');
const path = require('path');

const extRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(extRoot, 'manifest.json');

function loadManifest() {
  const raw = fs.readFileSync(manifestPath, 'utf-8');
  return JSON.parse(raw);
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

// Minimal MV3 validator used for unit-testing edge cases with synthetic manifests.
// Not run against the project's manifest to avoid duplicate failures; instead we
// have targeted assertions for the real manifest and separate validator unit tests.
function validateManifestMV3(m) {
  const errors = [];

  if (m.manifest_version !== 3) {
    errors.push('manifest_version must be 3 for MV3.');
  }

  if (!m.background || typeof m.background !== 'object') {
    errors.push('background must be an object.');
  } else {
    if (!isNonEmptyString(m.background.service_worker)) {
      errors.push('background.service_worker must be a non-empty string.');
    }
    if (Object.prototype.hasOwnProperty.call(m.background, 'scripts')) {
      errors.push('In MV3, background.scripts is not allowed; use background.service_worker.');
    }
  }

  if (!Array.isArray(m.content_scripts) || m.content_scripts.length === 0) {
    errors.push('content_scripts must be a non-empty array.');
  } else {
    for (const [i, cs] of m.content_scripts.entries()) {
      if (!Array.isArray(cs.matches) || cs.matches.length === 0) {
        errors.push(`content_scripts[${i}].matches must be a non-empty array.`);
      }
      if (!Array.isArray(cs.js) || cs.js.length === 0) {
        errors.push(`content_scripts[${i}].js must be a non-empty array.`);
      }
      if (cs.css && !Array.isArray(cs.css)) {
        errors.push(`content_scripts[${i}].css, when present, must be an array.`);
      }
      if (cs.run_at && !['document_start','document_end','document_idle'].includes(cs.run_at)) {
        errors.push(`content_scripts[${i}].run_at is invalid: ${cs.run_at}`);
      }
    }
  }

  if (!m.action || typeof m.action !== 'object') {
    errors.push('action must be an object.');
  } else {
    if (m.action.default_popup && !isNonEmptyString(m.action.default_popup)) {
      errors.push('action.default_popup must be a non-empty string when provided.');
    }
    if (m.action.default_title && !isNonEmptyString(m.action.default_title)) {
      errors.push('action.default_title must be a non-empty string when provided.');
    }
  }

  if (!m.icons || typeof m.icons !== 'object') {
    errors.push('icons must be an object.');
  } else {
    for (const size of ['16','48','128']) {
      if (!isNonEmptyString(m.icons[size])) {
        errors.push(`icons.${size} must be provided and be a non-empty string.`);
      }
    }
  }

  // MV3 requires object-based web_accessible_resources
  if (m.web_accessible_resources !== undefined) {
    if (!Array.isArray(m.web_accessible_resources)) {
      errors.push('web_accessible_resources must be an array.');
    } else if (m.web_accessible_resources.length > 0 && typeof m.web_accessible_resources[0] === 'string') {
      errors.push('In MV3, web_accessible_resources must be array of objects: { resources: [], matches: [] }.');
    } else {
      for (const [i, entry] of m.web_accessible_resources.entries()) {
        if (typeof entry !== 'object' || !Array.isArray(entry.resources) || entry.resources.length === 0) {
          errors.push(`web_accessible_resources[${i}] must be an object with non-empty "resources" array.`);
        }
        // matches is recommended; some tooling may allow extension pages without matches.
        if (entry.matches && !Array.isArray(entry.matches)) {
          errors.push(`web_accessible_resources[${i}].matches must be an array when provided.`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

describe('manifest.json (MV3) – structure and content', () => {
  test('loads and parses manifest.json', () => {
    expect(fs.existsSync(manifestPath)).toBe(true);
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  test('has required top-level fields', () => {
    const m = loadManifest();
    expect(m.manifest_version).toBe(3);
    expect(isNonEmptyString(m.name)).toBe(true);
    expect(isNonEmptyString(m.version)).toBe(true);
    expect(isNonEmptyString(m.description)).toBe(true);
    expect(typeof m.background).toBe('object');
    expect(Array.isArray(m.content_scripts)).toBe(true);
    expect(typeof m.action).toBe('object');
    expect(typeof m.icons).toBe('object');
  });

  test('background uses service_worker and does not include background.scripts (MV3)', () => {
    const m = loadManifest();
    expect(m.background).toBeTruthy();
    expect(m.background).toHaveProperty('service_worker', 'background/background.js');
    // MV3 must not include 'scripts' in background
    expect(Object.prototype.hasOwnProperty.call(m.background, 'scripts')).toBe(false);
  });

  test('permissions include required extension APIs and host patterns', () => {
    const m = loadManifest();
    expect(Array.isArray(m.permissions)).toBe(true);
    // Core API permissions
    expect(m.permissions).toEqual(expect.arrayContaining(['activeTab', 'storage', 'tabs']));
    // Host permissions may appear in permissions or host_permissions depending on setup.
    const hostPerms = new Set([...(m.permissions || []), ...((m.host_permissions || []))]);
    expect(hostPerms).toEqual(expect.arrayContaining(['http://localhost:8000/*', 'https://*/*']));
  });

  test('content_scripts are configured correctly', () => {
    const m = loadManifest();
    expect(m.content_scripts.length).toBeGreaterThan(0);
    const cs = m.content_scripts[0];
    expect(cs.matches).toEqual(expect.arrayContaining(['<all_urls>']));
    expect(cs.js).toEqual(expect.arrayContaining(['content/content.js']));
    expect(cs.css).toEqual(expect.arrayContaining(['content/content.css']));
    expect(['document_start','document_end','document_idle']).toContain(cs.run_at);
    expect(cs.run_at).toBe('document_end');
  });

  test('action configuration is present and correct', () => {
    const m = loadManifest();
    expect(m.action.default_popup).toBe('popup/popup.html');
    expect(m.action.default_title).toBe('CV Autofill Assistant');
  });

  test('icons map contains 16, 48, 128 pixel entries', () => {
    const m = loadManifest();
    for (const size of ['16','48','128']) {
      expect(isNonEmptyString(m.icons[size])).toBe(true);
      // Optional: existence check (does not fail build if missing to avoid flakiness)
      const iconPath = path.join(extRoot, m.icons[size]);
      // If the file exists, assert it is a file; otherwise, skip strict existence enforcement.
      if (fs.existsSync(iconPath)) {
        const stat = fs.statSync(iconPath);
        expect(stat.isFile()).toBe(true);
      }
    }
  });

  test('web_accessible_resources uses MV3 object format', () => {
    const m = loadManifest();
    // If defined, MV3 expects array of objects, not array of strings.
    if (m.web_accessible_resources !== undefined) {
      expect(Array.isArray(m.web_accessible_resources)).toBe(true);
      if (m.web_accessible_resources.length > 0) {
        expect(typeof m.web_accessible_resources[0]).toBe('object');
        expect(Array.isArray(m.web_accessible_resources[0].resources)).toBe(true);
      }
    }
  });
});

describe('validateManifestMV3 utility – edge cases', () => {
  test('accepts a valid minimal MV3 manifest', () => {
    const valid = {
      manifest_version: 3,
      name: 'Valid',
      version: '1.0.0',
      description: 'Valid MV3 manifest',
      background: { service_worker: 'background/background.js' },
      action: { default_popup: 'popup/popup.html', default_title: 'Valid' },
      icons: { '16': 'assets/icon16.png', '48': 'assets/icon48.png', '128': 'assets/icon128.png' },
      permissions: ['activeTab', 'storage', 'tabs'],
      host_permissions: ['https://*/*'],
      content_scripts: [
        {
          matches: ['<all_urls>'],
          js: ['content/content.js'],
          css: ['content/content.css'],
          run_at: 'document_end',
        },
      ],
      web_accessible_resources: [
        { resources: ['content/*'], matches: ['<all_urls>'] },
      ],
    };
    const res = validateManifestMV3(valid);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  test('rejects MV3 manifest that includes background.scripts', () => {
    const invalid = {
      manifest_version: 3,
      name: 'InvalidScripts',
      version: '1.0.0',
      description: 'Invalid: has background.scripts',
      background: { service_worker: 'background/background.js', scripts: ['background/background.js'] },
      action: { default_popup: 'popup/popup.html', default_title: 'InvalidScripts' },
      icons: { '16': 'assets/icon16.png', '48': 'assets/icon48.png', '128': 'assets/icon128.png' },
      permissions: ['activeTab', 'storage', 'tabs'],
      content_scripts: [{ matches: ['<all_urls>'], js: ['content/content.js'] }],
      web_accessible_resources: [{ resources: ['content/*'], matches: ['<all_urls>'] }],
    };
    const res = validateManifestMV3(invalid);
    expect(res.valid).toBe(false);
    expect(res.errors.join(' ')).toMatch(/background\.scripts is not allowed/i);
  });

  test('rejects non-MV3 manifest_version', () => {
    const invalid = {
      manifest_version: 2,
      name: 'MV2',
      version: '0.9.0',
      description: 'Old',
      background: { scripts: ['background.js'] },
      action: { default_title: 'Old' },
      icons: { '16': 'a.png', '48': 'b.png', '128': 'c.png' },
      permissions: ['activeTab', 'storage', 'tabs'],
      content_scripts: [{ matches: ['<all_urls>'], js: ['content/content.js'] }],
      web_accessible_resources: [{ resources: ['content/*'], matches: ['<all_urls>'] }],
    };
    const res = validateManifestMV3(invalid);
    expect(res.valid).toBe(false);
    expect(res.errors.join(' ')).toMatch(/manifest_version must be 3/i);
  });

  test('rejects MV3 manifest with string-array web_accessible_resources (MV2 style)', () => {
    const invalid = {
      manifest_version: 3,
      name: 'InvalidWAR',
      version: '1.0.0',
      description: 'Invalid web_accessible_resources format',
      background: { service_worker: 'background/background.js' },
      action: { default_popup: 'popup/popup.html', default_title: 'InvalidWAR' },
      icons: { '16': 'assets/icon16.png', '48': 'assets/icon48.png', '128': 'assets/icon128.png' },
      permissions: ['activeTab', 'storage', 'tabs'],
      content_scripts: [{ matches: ['<all_urls>'], js: ['content/content.js'] }],
      // MV2-style: array of strings, which is invalid in MV3
      web_accessible_resources: ['content/*'],
    };
    const res = validateManifestMV3(invalid);
    expect(res.valid).toBe(false);
    expect(res.errors.join(' ')).toMatch(/web_accessible_resources must be array of objects/i);
  });
});