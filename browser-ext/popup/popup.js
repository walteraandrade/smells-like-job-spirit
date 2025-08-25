if (
	typeof browser !== "undefined" &&
	(!window.chrome || !window.chrome.runtime)
) {
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

		const uploadArea = document.getElementById("upload-area");

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

			if (e.target.files.lenght > 0) {
				this.uploadCV(e.dataTransfer.files[0]);
			}
		});

		document
			.getElementById("detect-forms-btn")
			.addEventListener("click", () => {
				this.detectForms();
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
				this.cvData = data;
				this.showCVLoaded();
			}
		} catch (error) {
			console.error("Error loading CV data:", error);
			this.showCVNotLoaded();
		}
	}

	async uploadCV(file) {
		this.showLoading(true);
		this.hideError();

		const dataUrl = await new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result);
			reader.onerror = () =>
				reject(reader.error || new Error("Failed to read file"));
			reader.readAsDataURL(file);
		});

		try {
			const response = await this.sendMessage({
				action: "parseCV",
				file: {
					name: file.name,
					type: file.type,
					size: file.size,
					dataUrl,
				},
			});

			if (response.success) {
				this.cvData = response.data;
				this.showCVLoaded();
				this.showSuccess("CV uploaded and parsed successfully");
			} else {
				this.showError(
					"Failed to parse CV: " +
						(response?.error?.message || response?.error || "Unknown error"),
				);
			}
		} catch (error) {
			console.error("Error uploading CV: " + error.message);
			this.showError("Error uploading CV: " + error.message);
		} finally {
			this.showLoading(false);
			document.getElementById("file-input").value = "";
		}
	}

	async detectForms() {
		try {
			const [tab] = await chrome.tabs.query({
				active: true,
				currentWindow: true,
			});

			if (!tab.id) {
				this.showError("No active tab detected forms on");
				return;
			}

			await this.sendTabMessage(tab.id, {
				action: "detectForms",
			});

			this.showSuccess("Form detection completed");
		} catch (error) {
			this.showError("Error detecting forms: " + error.message);
		}
	}

	async autoFill() {
		if (!this.cvData) {
			this.showError("Please upload your CV first");
			return;
		}

		try {
			const [tab] = await chrome.tabs.query({
				active: true,
				currentWindow: true,
			});

			if (!tab.id) {
				this.showError("No active tab detected forms on");
				return;
			}

			await this.sendTabMessage(tab.id, {
				action: "autoFill",
				cvData: this.cvData,
			});

			this.showSuccess("Auto-fill completed!");
		} catch (error) {
			this.showError("Error auto-filling forms: " + error.message);
		}
	}

	async clearData() {
		try {
			await this.sendMessage({ action: "saveCVData", data: null });
			this.cvData = null;
			this.showCVNotLoaded();
			this.showSuccess("CV data cleared successfully!");
		} catch (error) {
			this.showError("Error clearing data: " + error.message);
		}
	}

	showCVLoaded() {
		const statusElement = document.getElementById("cv-status");
		statusElement.className = "cv-status loaded";
		statusElement.textContent = "✅ CV loaded and ready to use";
		statusElement.style.display = "block";

		this.showCVPreview();

		document.getElementById("detect-forms-btn").disabled = false;
		document.getElementById("auto-fill-btn").disabled = false;
	}

	showCVNotLoaded() {
		const statusElement = document.getElementById("cv-status");
		statusElement.style.display = "none";

		document.getElementById("cv-preview").style.display = "none";
		document.getElementById("detect-forms-btn").disabled = true;
		document.getElementById("auto-fill-btn").disabled = true;
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

	async checkPageForForms() {
		try {
			const [tab] = await chrome.tabs.query({
				active: true,
				currentWindow: true,
			});

			if (!tab.id) {
				this.showError("No active tab detected forms on");
				return;
			}

			const response = await this.sendTabMessage(tab.id, {
				action: "checkForForms",
			});

			if (response && response.formsFound) {
				console.log("Form found on current page");
			}
		} catch (error) {
			console.error("Could not check for forms: ", error.message);
		}
	}

	sendTabMessage(tabId, message) {
		return new Promise((resolve, reject) => {
			try {
				chrome.tabs.sendMessage(tabId, message, (response) => {
					if (chrome.runtime.lastError) {
						reject(new Error(chrome.runtime.lastError.message));
					} else {
						resolve(response);
					}
				});
			} catch (e) {
				reject(e);
			}
		});
	}

	sendMessage(message) {
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
	new SmellsLikeJobSpiritPopup();
});
