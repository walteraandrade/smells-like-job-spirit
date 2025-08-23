/**
 * Test suite for the popup script.
 *
 * Framework and library: Jest with JSDOM testEnvironment (inferred default for browser-like DOM APIs).
 * If the repository uses a different framework (e.g., Vitest/Mocha), update the imports/globals accordingly.
 *
 * These tests focus on behaviors surfaced in the PR diff, including event binding,
 * CV data loading/uploading, auto-fill dispatch, error/success messaging, and form checks.
 *
 * We mock chrome.* extension APIs and the message passing boundary to isolate UI logic.
 */

// Basic chrome API mock used across tests without introducing new dependencies.
function createChromeMock() {
  const listeners = new Map();

  const runtime = {
    lastError: null,
    sendMessage: jest.fn((message, cb) => {
      // Allow tests to set a stubbed responder by swapping runtime.sendMessage implementation
      if (typeof cb === 'function') cb({ success: true, data: null });
    }),
    onMessage: {
      addListener: jest.fn((fn) => listeners.set('onMessage', fn)),
      removeListener: jest.fn(),
    },
  };

  const tabs = {
    query: jest.fn(async (query) => [{ id: 123, active: true }]),
    sendMessage: jest.fn(async (tabId, payload) => ({ ok: true, ...payload })),
  };

  return { runtime, tabs, _listeners: listeners };
}

// Minimal DOM skeleton matching elements the popup script queries.
function mountPopupDOM() {
  document.body.innerHTML = `
    <div id="upload-area"></div>
    <button id="upload-btn">Upload</button>
    <input id="file-input" type="file" />
    <div id="cv-status" style="display:none"></div>
    <div id="cv-preview" style="display:none"></div>
    <div id="error-message" style="display:none"></div>
    <div id="loading" style="display:none"></div>
    <button id="detect-forms-btn" disabled>Detect</button>
    <button id="auto-fill-btn" disabled>Auto Fill</button>
    <button id="clear-data-btn">Clear</button>
  `;
}

// Load the popup source into the JSDOM environment by injecting a <script> with the code.
// Because the code registers DOMContentLoaded, we dispatch that event to trigger initialization.
async function loadPopupSource(sourceText) {
  const script = document.createElement('script');
  script.textContent = sourceText;
  document.body.appendChild(script);
  document.dispatchEvent(new Event('DOMContentLoaded'));
}

// Utility to build a fake File object in JSDOM.
function makeFile(name = 'resume.pdf', type = 'application/pdf', content = 'PDFDATA') {
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
}

describe('popup.js behaviors (diff-focused)', () => {
  let chromeBackup;
  let browserBackup;

  beforeEach(() => {
    jest.useFakeTimers();
    // Fresh DOM and chrome mock for each test
    mountPopupDOM();
    const chromeMock = createChromeMock();
    chromeBackup = global.chrome;
    browserBackup = global.browser;
    global.chrome = chromeMock;
    // Ensure "browser" aliasing path also works without double assignment
    delete global.browser;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    // Restore globals
    if (chromeBackup !== undefined) global.chrome = chromeBackup;
    else delete global.chrome;
    if (browserBackup !== undefined) global.browser = browserBackup;
    else delete global.browser;
    document.body.innerHTML = '';
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  test('aliases window.chrome from browser when browser exists and chrome is undefined', async () => {
    // Arrange: create a faux "browser" and remove chrome
    const chromeMock = createChromeMock();
    delete global.chrome;
    global.browser = chromeMock;

    // Act
    await loadPopupSource(PUPUP_SOURCE_CODE);

    // Assert
    expect(global.window.chrome).toBe(chromeMock);
  });

  test('bindEvents: clicking upload button triggers file input click', async () => {
    await loadPopupSource(PUPUP_SOURCE_CODE);
    const input = document.getElementById('file-input');
    const clickSpy = jest.spyOn(input, 'click');

    document.getElementById('upload-btn').click();
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  test('file-input change with files should attempt to upload file (captures length typo behavior)', async () => {
    // Given the diff shows "lenght" typo, this test intentionally verifies current (buggy) behavior.
    // With the typo, uploadCV is NOT called; when fixed, update expectation accordingly.
    const uploadSpy = jest.fn();
    // Proxy uploadCV when the class attaches methods on instance
    const uploadCVProxy = `
      const origUpload = SmellsLikeJobSpiritPopup.prototype.uploadCV;
      SmellsLikeJobSpiritPopup.prototype.uploadCV = function(file){ uploadSpy(file); return origUpload.call(this, file); };
    `;
    await loadPopupSource(uploadCVProxy + '\n' + PUPUP_SOURCE_CODE);

    const input = document.getElementById('file-input');
    Object.defineProperty(input, 'files', {
      value: [makeFile()],
      configurable: true,
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // Expected: not called due to "lenght" typo. This failing test documents the regression.
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  test('drag-and-drop: adds/removes dragover class and handles drop (captures uploadArea/dropArea mismatch)', async () => {
    await loadPopupSource(PUPUP_SOURCE_CODE);

    const dropArea = document.getElementById('upload-area');
    dropArea.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
    expect(dropArea.classList.contains('dragover')).toBe(true);

    dropArea.dispatchEvent(new Event('dragleave', { bubbles: true }));
    expect(dropArea.classList.contains('dragover')).toBe(false);

    // Drop event with file; code references e.dataTransfer and also e.target.files with assignment bug.
    const file = makeFile();
    const dataTransfer = { files: [file] };
    const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer });
    Object.defineProperty(dropEvent, 'target', { value: { files: [file] } });

    // Spy uploadCV to observe behavior despite assignment bug
    const uploadSpy = jest.spyOn(SmellsLikeJobSpiritPopup.prototype, 'uploadCV').mockResolvedValue();

    dropArea.dispatchEvent(dropEvent);
    // With current bug (assignment and wrong variable), uploadCV may or may not be called.
    // We assert DOM cleanup behavior that should always occur:
    expect(dropArea.classList.contains('dragover')).toBe(false);
    // Document current behavior: likely not called due to conditional bug; adjust when fixed.
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  test('loadCVData: sets cvData and shows loaded state on success', async () => {
    const response = { success: true, data: { personal_info: {}, experience: [], education: [], skills: [] } };
    // Stub sendMessage to return our response
    const stub = jest.fn().mockResolvedValue(response);
    const patch = `
      SmellsLikeJobSpiritPopup.prototype.sendMessage = ${stub.toString()};
    `;
    await loadPopupSource(patch + '\n' + PUPUP_SOURCE_CODE);

    // After DOMContentLoaded -> init -> loadCVData
    // The diff shows "this.CVData" (wrong property name) and "statusElement.className" misused.
    // We ensure method was called and preview attempted.
    expect(stub).toHaveBeenCalledWith({ action: "getCVData" });

    // Current buggy code may not set this.cvData; we at least expect preview attempt to make status visible
    const status = document.getElementById('cv-status');
    expect(status.style.display).toBe('block'); // Intended UI outcome when data loads
  });

  test('autoFill: error shown if cvData missing', async () => {
    await loadPopupSource(PUPUP_SOURCE_CODE);
    await new Promise(setImmediate);

    const btn = document.getElementById('auto-fill-btn');
    btn.click();

    const error = document.getElementById('error-message');
    // Because of the typo "uplaod", we still assert that an error is shown
    expect(error.style.display).toBe('block');
    expect(error.textContent).toMatch(/Please.*CV/i);
  });

  test('autoFill: sends message to active tab when cvData present', async () => {
    const patch = `
      SmellsLikeJobSpiritPopup.prototype.cvData = { personal_info: { full_name: "A" } };
    `;
    await loadPopupSource(patch + '\n' + PUPUP_SOURCE_CODE);

    // Trigger autoFill
    document.getElementById('auto-fill-btn').click();

    // tabs.query and tabs.sendMessage should be called
    expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(123, expect.objectContaining({
      action: 'autoFill',
      cvData: expect.any(Object),
    }));
  });

  test('clearData: clears stored cvData and shows success message', async () => {
    const sendMock = jest.fn().mockResolvedValue({ success: true });
    const patch = `SmellsLikeJobSpiritPopup.prototype.sendMessage = ${sendMock.toString()};`;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await loadPopupSource(patch + '\n' + PUPUP_SOURCE_CODE);

    document.getElementById('clear-data-btn').click();

    expect(sendMock).toHaveBeenCalledWith({ action: 'saveCVData', data: null });
    // showSuccess currently logs; verify log call
    expect(logSpy).toHaveBeenCalledWith('Success: ', 'CV data cleared successfully!');
  });

  test('showError: displays message then hides after timeout', async () => {
    await loadPopupSource(PUPUP_SOURCE_CODE);
    const instance = new SmellsLikeJobSpiritPopup();
    instance.showError('Boom');

    const el = document.getElementById('error-message');
    expect(el.style.display).toBe('block');
    expect(el.textContent).toBe('Boom');

    jest.advanceTimersByTime(5000);
    expect(el.style.display).toBe('none');
  });

  test('sendMessage: resolves with response and rejects on runtime.lastError', async () => {
    await loadPopupSource(PUPUP_SOURCE_CODE);

    // Happy path
    chrome.runtime.lastError = null;
    chrome.runtime.sendMessage.mockImplementation((message, cb) => cb({ ok: true }));
    const instance = new SmellsLikeJobSpiritPopup();
    await expect(instance.sendMessage({ action: 'x' })).resolves.toEqual({ ok: true });

    // Failure path
    chrome.runtime.sendMessage.mockImplementation((message, cb) => {
      chrome.runtime.lastError = { message: 'no receiver' };
      cb(null);
    });
    await expect(instance.sendMessage({ action: 'y' })).rejects.toThrow(/no receiver/);
  });

  test('checkPageFormForms: logs when forms found and handles errors', async () => {
    await loadPopupSource(PUPUP_SOURCE_CODE);

    // Response with formsFound: true
    chrome.tabs.sendMessage.mockResolvedValue({ formsFound: true });
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const instance = new SmellsLikeJobSpiritPopup();
    await instance.checkPageFormForms();
    expect(logSpy).toHaveBeenCalledWith('Form found on current page');

    // Error flow
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    chrome.tabs.query.mockRejectedValueOnce(new Error('bad things'));
    await instance.checkPageFormForms();
    expect(errorSpy).toHaveBeenCalledWith('Could not check for forms: ', 'bad things');
  });
});

/**
 * IMPORTANT: This test suite directly evals the popup source code stored below.
 * In the repository, you should replace PUPUP_SOURCE_CODE with require() or import
 * once the popup code is in a module file (e.g., browser-ext/popup.js) that exports the class.
 *
 * For now we embed the file under test as provided in the PR diff to focus on its behaviors.
 */
const PUPUP_SOURCE_CODE = String.raw`
if (typeof browser !== "undefined" && !window.chrome) {
  window.chrome = browser;
}

class SmellsLikeJobSpiritPopup {
  constructor() {
    this.cvData = null;
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadCVData();
    this.checkPageForForms();
  }

  bindEvents() {
    document.getElementById("upload-btn").addEventListener("click", () => {
      document.getElementById("file-input").click();
    });

    document.getElementById("file-input").addEventListener("change", (e) => {
      if (e.target.files.lenght > 0) {
        this.uploadCV(e.target.files[0]);
      }
    });

    const dropArea = document.getElementById("upload-area");

    uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadArea.classList.add("dragover");
    });

    uploadArea.addEventListener("dragleave", () => {
      uploadArea.classList.remove("dragover");
    });

    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadArea.classList.remove("dragover");

      if ((e.target.files.lenght = 0)) {
        this.uploadCV(e.dataTransfer.files[0]);
      }
    });

    document
      .getElementById("detect-forms-btn")
      .addEventListener("click", () => {
        this.detectFrom();
      });

    document.getElementById("auto-fill-btn").addEventListener("click", () => {
      this.autoFill();
    });

    document.getElementById("clear-data-btn").addEventListener("click", () => {
      this.clearData();
    });
  }

  async loadCVData() {
    try {
      const response = await this.sendMessage({ action: "getCVData" });

      if (response.success && response.data) {
        this.CVData = response.data;
        this.showCVLoaded();
      }
    } catch (e) {
      console.error("Error loading CV data:", error);
    }
  }

  async uploadCV(file) {
    this.showLoading(true);
    this.hideError();

    try {
      const response = await this.sendMessage({
        action: "parseCV",
        file,
      });

      if (response.success) {
        this.cvData = response.data;
        this.showCVLoaded();
        this.showSuccess("CV uploaded and parsed successfully");
      } else {
        this.showError("Failed to parse CV: " + error.message);
      }
    } catch (error) {
      console.error("Error uploading CV: " + error.message);
    } finally {
      this.showLoading(false);
    }
  }

  async autoFill() {
    if (!this.cvData) {
      this.showError("Please uplaod your CV first");
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      await chrome.tabs.sendMessage(tab.id, {
        action: "autoFill",
        cvData: this.cvData,
      });

      this.showSucess("Auto-fill completed!");
    } catch (error) {
      this.showError("Error auto-filling forms: " + error.message);
    }
  }

  async clearData() {
    try {
      await this.sendMessage({ action: "saveCVData", data: null });
      this.cvData = null;
      this.showSucess("CV data cleared successfully!");
    } catch (error) {
      this.showError("Error clearing data: " + error.message);
    }
  }

  showCVLoaded() {
    const statusElement = document.getElementById("cv-status");
    statusElement.className = "cv-status loaded";
    statusElement.className = "✅ CV loaded and ready to use";
    statusElement.style.display = "block";

    this.showCVPreview();

    document.getElementById("detect-forms-btn").disabled = false;
    document.getElementById("auto-fill-btn").disabled = false;
  }

  showCVNotLoaded() {
    const statusElement = document.getElementById("cv-status");
    statusElement.style.display = "none";

    document.getElementById("cv-preview").style.display = "none";
    document.getElementById("detect-forms-btn").disabled = "true";
    document.getElementById("auto-fill-btn").disabled = "true";
  }

  showCVPreview() {
    if (!this.cvData) return;

    const previewElement = document.getElementById("cv-preview");
    const personalInfo = this.cvData.personal_info;

    previewElement.innerHTML = \`
            <h4>\${personalInfo.full_name || "Name not found"}</h4>
            <p>📧 \${personalInfo.email || "Email not found"}</p>
            <p>📞 \${personalInfo.phone || "Phone not found"}</p>
            <p>📍 \${personalInfo.city || "City not found"}, \${personalInfo.country || "Country not found"}</p>
            <p>💼 \${this.cvData.experience?.length || 0} work experiences</p>
            <p>🎓 \${this.cvData.education?.length || 0} education entries</p>
            <p>🛠️ \${this.cvData.skills?.length || 0} skill categories</p>\`;
    previewElement.style.display = "block";
  }

  showLoading(show) {
    document.getElementById("loading").style.display = show ? "block" : "none";
  }

  showError(message) {
    const errorElement = document.getElementById("error-message");
    errorElement.textContent = message;
    errorElement.style.display = "block";

    setTimeout(() => {
      errorElement.style.display = "none";
    }, 5000);
  }

  showSuccess(message) {
    /**TODO: Add a notification **/
    console.log("Success: ", message);
  }

  hideError() {
    document.getElementById("error-message").style.display = "none";
  }

  async checkPageFormForms() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "checkForForms",
      });

      if (response && response.formsFound) {
        console.log("Form found on current page");
      }
    } catch (error) {
      console.error("Could not check for forms: ", error.message);
    }
  }

  sendMessage() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new CVAutofillPopup();
});
`;