/**
 * @jest-environment jsdom
 *
 * Testing library/framework: Jest with jsdom environment.
 * Scope: Static HTML verification for browser-ext/popup.html
 * Note: Derived from the provided HTML content; aiming for comprehensive coverage of structure and initial UI state.
 */

const fs = require('fs');
const path = require('path');

function loadHtmlRaw() {
  const file = path.resolve(__dirname, '..', 'popup.html');
  if (!fs.existsSync(file)) {
    throw new Error('Expected HTML at ' + file + ' but it was not found.');
  }
  return fs.readFileSync(file, 'utf8');
}

function mountFromHtml(html) {
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  document.head.innerHTML = headMatch ? headMatch[1] : '';
  document.body.innerHTML = bodyMatch ? bodyMatch[1] : '';
}

describe('popup.html structure', () => {
  let htmlRaw;
  beforeAll(() => {
    htmlRaw = loadHtmlRaw();
    mountFromHtml(htmlRaw);
  });

  describe('head/styles', () => {
    it('contains a style block with key rules and keyframes', () => {
      const styles = Array.from(document.head.querySelectorAll('style'))
        .map(s => s.textContent)
        .join('\n')
        .replace(/\s+/g, ' ');
      expect(styles).toMatch(/\.header\s*\{/);
      expect(styles).toContain('linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
      expect(styles).toMatch(/\.upload-area\.dragover\s*\{/);
      expect(styles).toMatch(/@keyframes\s+spin/);
      expect(styles).toMatch(/\.btn-primary\s*\{/);
    });
  });

  describe('header', () => {
    it('renders the correct title text', () => {
      const title = document.querySelector('.header h1');
      expect(title).not.toBeNull();
      expect(title.textContent.trim()).toBe('CV Autofill Assistant');
    });
  });

  describe('upload section', () => {
    it('has upload area, choose file button, and hidden file input with correct accept types', () => {
      const area = document.getElementById('upload-area');
      expect(area).toBeTruthy();

      const btn = document.getElementById('upload-btn');
      expect(btn).toBeTruthy();
      expect(btn.tagName).toBe('BUTTON');
      expect(btn.textContent).toMatch(/Choose File/i);

      const input = document.getElementById('file-input');
      expect(input).toBeTruthy();
      expect(input.getAttribute('type')).toBe('file');
      expect(input.getAttribute('accept')).toBe('.pdf,.docx,.doc,.txt');
      const styleAttr = (input.getAttribute('style') || '').replace(/\s+/g, ' ');
      expect(styleAttr).toMatch(/display:\s*none/);
    });

    it('mentions supported formats and drag-and-drop hint', () => {
      const areaText = document.getElementById('upload-area').textContent;
      expect(areaText).toMatch(/Upload your CV \(PDF, DOCX, or TXT\)/);
      expect(areaText).toMatch(/drag and drop/i);
    });
  });

  describe('initial hidden sections', () => {
    it('cv-status, cv-preview, loading, and error-message are hidden initially', () => {
      const status = document.getElementById('cv-status');
      const preview = document.getElementById('cv-preview');
      const loading = document.getElementById('loading');
      const error = document.getElementById('error-message');

      expect((status.getAttribute('style') || '')).toMatch(/display:\s*none/);
      expect((preview.getAttribute('style') || '')).toMatch(/display:\s*none/);
      expect((loading.getAttribute('style') || '')).toMatch(/display:\s*none/);
      expect((error.getAttribute('style') || '')).toMatch(/display:\s*none/);

      const loadingText = loading.textContent.replace(/\s+/g, ' ').trim();
      expect(loadingText).toContain('Processing your CV...');
    });
  });

  describe('control buttons', () => {
    it('detect and auto-fill buttons are disabled; clear-data is enabled', () => {
      const detect = document.getElementById('detect-forms-btn');
      const autofill = document.getElementById('auto-fill-btn');
      const clear = document.getElementById('clear-data-btn');

      expect(detect).toBeTruthy();
      expect(autofill).toBeTruthy();
      expect(clear).toBeTruthy();

      expect(detect.disabled).toBe(true);
      expect(autofill.disabled).toBe(true);
      expect(clear.disabled).toBe(false);

      expect(detect.className).toContain('btn-primary');
      expect(autofill.className).toContain('btn-primary');
      expect(clear.className).toContain('btn-secondary');

      expect(detect.textContent).toMatch(/Detect Forms on Page/);
      expect(autofill.textContent).toMatch(/Auto-Fill Forms/);
      expect(clear.textContent).toMatch(/Clear CV Data/);
    });
  });

  describe('script tag', () => {
    it('includes popup.js at end of body', () => {
      const scripts = Array.from(document.querySelectorAll('script'));
      const found = scripts.find(s => (s.getAttribute('src') || '').endsWith('popup.js'));
      expect(found).toBeTruthy();

      const last = document.body.lastElementChild;
      expect(last && last.tagName.toLowerCase()).toBe('script');
      expect(last.getAttribute('src')).toBe('popup.js');
    });
  });

  describe('id uniqueness', () => {
    it('critical IDs are unique', () => {
      const ids = [
        'upload-section','upload-area','upload-btn','file-input',
        'cv-status','cv-preview','detect-forms-btn','auto-fill-btn',
        'clear-data-btn','loading','error-message'
      ];
      ids.forEach(id => {
        expect(document.querySelectorAll('#' + id).length).toBe(1);
      });
    });
  });

  describe('basic accessibility sanity', () => {
    it('buttons have discernible text and are focusable', () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      expect(buttons.length).toBeGreaterThanOrEqual(3);
      for (const b of buttons) {
        const label = (b.textContent || '').trim();
        expect(label.length).toBeGreaterThan(0);
        expect(typeof b.tabIndex).toBe('number');
      }
    });
  });
});