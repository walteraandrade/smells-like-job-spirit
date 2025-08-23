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
      if (e.target.files.length > 0) {
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

    previewElement.innerHTML = `
            <h4>${personalInfo.full_name || "Name not found"}</h4>
            <p>📧 ${personalInfo.email || "Email not found"}</p>
            <p>📞 ${personalInfo.phone || "Phone not found"}</p>
            <p>📍 ${personalInfo.city || "City not found"}, ${
      personalInfo.country || "Country not found"
    }</p>
            <p>💼 ${this.cvData.experience?.length || 0} work experiences</p>
            <p>🎓 ${this.cvData.education?.length || 0} education entries</p>
            <p>🛠️ ${this.cvData.skills?.length || 0} skill categories</p>`;

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
