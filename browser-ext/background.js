if (
	typeof browser !== "undefined" &&
	(!window.chrome || !window.chrome.runtime)
) {
	window.chrome = browser;
}

/** TODO: Test browser compatibility
* Might need to use this function instead due to Chrome and Firefox Promise hanlding. One uses normal promises, the other callbacks.
* async getCVData() {
        if (typeof browser !== 'undefined') {
            const result = await browser.storage.local.get(['cvData']);
            return result.cvData || null;
        } else {
            return new Promise((resolve) => {
                chrome.storage.local.get(['cvData'], (result) => {
                    resolve(result.cvData || null);
                });
            });
        }
    }
* **/

class SmellsLikeJobSpiritBackground {
	constructor() {
		this.API_BASE_URL = "http://localhost:8000/api";
		this.init();
	}

	init() {
		chrome.runtime.onMessage.addListener(
			(request, sender, sendResponse) => {
				this.handleMessage(request, sender, sendResponse);
				return true;
			},
		);

		chrome.runtime.onInstalled.addListener(() => {
			console.log("Smells Like Job Spirit installed!");
			this.initializeStorage();
		});
	}

	async handleMessage(request, sender, sendResponse) {
		try {
			switch (request.action) {
				case "parseCV": {
					const result = await this.parseCV(request.file);
					sendResponse({ success: true, data: result });
					break;
				}

				case "getCVData": {
					const cvData = await this.getCVData();
					sendResponse({ success: true, data: cvData });
					break;
				}

				case "saveCVData":
					await this.saveCVData(request.data);
					sendResponse({ success: true });
					break;

				case "fillForm":
					await this.fillForm(sender.tab.id, request.formData);
					sendResponse({ success: true });
					break;

				default:
					sendResponse({ success: false, error: "Unknown action" });
			}
		} catch (error) {
			console.error("Background script error:", error);
			sendResponse({ success: false, error: error.message });
		}
	}

	async parseCV(file) {
		let fileToUpload;
		if (file?.dataUrl) {
			const blob = await (await fetch(file.dataUrl)).blob();
			fileToUpload = new File([blob], file.name, {
				type: file.type,
			});
		} else {
			fileToUpload = file;
		}

		const formData = new FormData();
		formData.append("file", fileToUpload);

		const response = await fetch(`${this.API_BASE_URL}/parse-cv`, {
			method: "POST",
			body: formData,
		});

		if (!response.ok) {
			throw new Error(`API error: ${response.status}`);
		}

		const parsedData = response.json();

		await this.saveCVData(parsedData);

		return parsedData;
	}

	async getCVData() {
		return new Promise((resolve) => {
			chrome.storage.local.get(["cvData"], (result) => {
				resolve(result.cvData || null);
			});
		});
	}

	async saveCVData(data) {
		return new Promise((resolve) => {
			chrome.storage.local.set({ cvData: data }, resolve);
		});
	}

	async fillForm(tabId, formData) {
		return new Promise((resolve, reject) => {
			try {
				chrome.tabs.sendMessage(
					tabId,
					{ action: "performFill", formData },
					(response) => {
						if (chrome.runtime.lastError) {
							reject(new Error(chrome.runtime.lastError.message));
							return;
						}
						resolve(response);
					}
				);
			} catch (err) {
				reject(err);
			}
		});
	}

	initializeStorage() {
		chrome.storage.local.get(["cvData"], (result) => {
			if (!result.cvData) {
				chrome.storage.local.set({
					cvData: null,
					settings: {
						autoDetect: true,
						confirmBeforeFill: true,
						debugMode: false,
					},
				});
			}
		});
	}
}

new SmellsLikeJobSpiritBackground();
