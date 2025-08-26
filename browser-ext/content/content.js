if (
  typeof browser !== "undefined" &&
  (!window.chrome || !window.chrome.runtime)
) {
  window.chrome = browser;
}

const FORM_SELECTOR = "form";
const FORM_CONTROLS_SELECTOR = "input, textarea, select";

class AutofillContent {
  static COLORS = {
    HIGHLIGHT_COLOR: "#667eea",
    SUCCESS_BG: "#e8f5e8",
    NOTIFICATION_SUCCESS: "#4caf50",
    NOTIFICATION_INFO: "#2196f3",
  };

  constructor() {
    this.detectedForms = [];
    this.fieldMappings = this.initializeFieldMappings();
    this.init();
  }

  init() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);

      return true;
    });

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        this.detectForms();
      });
    } else {
      this.observeFormMutations(); 
    }
  }

  handleMessage(request, sender, sendResponse) {
    const sendErrorResponse = (message) => {
      sendResponse({ success: false, message });
    };

    switch (request.action) {
      case "clearHighlightsAndFill": {
        this.removeHighlights();
        const result = this.autoFillForms(request.cvData);
        sendResponse({
          success: true,
          message: result.message,
          fieldsFilled: result.fieldsFilled,
        });
        break;
      }
      case "checkForForms": {
        sendResponse({ formsFound: this.detectedForms.length > 0 });
        break;
      }
      case "detectForms": {
        this.detectForms();
        this.highlightForms(request.persistHighlights);
        const forms = this.detectedForms.map((f) => ({
          index: f.index,
          isFormless: !!f.isFormless,
          fields: f.fields.map(
            ({
              classification,
              name,
              id,
              placeholder,
              label,
              required,
              type,
            }) => ({
              classification,
              name,
              id,
              placeholder,
              label,
              required,
              type,
            })
          ),
        }));
        sendResponse({
          success: true,
          forms,
          formsCount: this.detectedForms.length,
        });
        break;
      }
      case "autoFill":
        this.autoFillForms(request.cvData);
        sendResponse({ success: true });
        break;
      case "performFill": {
        const data = request.cvData ?? request.formData;
        if (!data) {
          sendErrorResponse("No CV/form data provided");
          break;
        }
        if (this.detectedForms.length > 0) {
          this.detectedForms.forEach((f) =>
            this.fillFormFields(f.fields, data)
          );
          sendResponse({ success: true });
        } else {
          sendErrorResponse("No forms detected");
        }
        break;
      }
      default:
        sendResponse({ success: false, message: "Unknown action" });
    }
  }

  detectForms() {
    this.detectedForms = [];

    const forms = document.querySelectorAll(FORM_SELECTOR);
    forms.forEach((form, idx) => {
      const fields = form.querySelectorAll(FORM_CONTROLS_SELECTOR);
      const mappedFields = Array.from(fields)
        .map((el) => this.analyzeFormFields(el))
        .filter(Boolean);

      if (mappedFields.length > 0) {
        this.detectedForms.push({
          element: form,
          index: idx,
          fields: mappedFields,
        });
      }
    });

    this.detectedFormlessInputs();

    console.log(`Detected ${this.detectedForms.length} relevant forms`);
    return this.detectedForms;
  }

  analyzeFormFields(element) {
    const isHidden =
      element.offsetParent === null ||
      getComputedStyle(element).visibility === "hidden";
    const isContentEditable = element.isContentEditable;
    const isAriaReadonly = element.getAttribute("aria-readonly") === "true";

    if (
      element.type === "hidden" ||
      element.disabled ||
      element.readOnly ||
      isAriaReadonly ||
      isHidden ||
      isContentEditable ||
      element.type === "submit" ||
      element.type === "button"
    ) {
      return null;
    }

    const fieldInfo = {
      element,
      type: element.type || "text",
      name: element.name || "",
      id: element.id || "",
      placeholder: element.placeholder || "",
      label: this.findFieldLabel(element),
      className: element.className || "",
      required: element.required || false,
    };

    fieldInfo.classification = this.classifyField(fieldInfo);

    return fieldInfo.classification ? fieldInfo : null;
  }

  findFieldLabel(element) {
    let label = "";

    if (element.id) {
      const elementLabel = document.querySelector(`label[for="${element.id}"]`);
      if (elementLabel) {
        label = elementLabel.textContent.trim();
      }
    }

    if (!label) {
      const parent = element.closest("label");
      /** TODO: evaluate and test if its possible for this code to get undesired elements around the input **/
      if (parent) {
        const textNodes = this.getTextNodes(parent);
        if (textNodes.length > 0) {
          label = textNodes.join(" ").trim();
        }
      }
    }

    return label;
  }

  getTextNodes(element) {
    const textNodes = [];

    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent.trim();
        if (text) textNodes.push(text);
      }
    }
    return textNodes;
  }

  classifyField(fieldInfo) {
    let text =
      `{${fieldInfo.name} ${fieldInfo.id} ${fieldInfo.placeholder} ${fieldInfo.label} ${fieldInfo.className} }`.toLowerCase();

    const ariaLabel = fieldInfo.element
      .getAttribute("aria-label")
      ?.trim()
      ?.toLowerCase();
    const ariaLabelledById = fieldInfo.element.getAttribute("aria-labelledby");
    const ariaLabelledBy = ariaLabelledById
      ? document
          .getElementById(ariaLabelledById)
          ?.textContent?.trim()
          ?.toLowerCase()
      : "";

    if (ariaLabel) text += ` ${ariaLabel}`;
    if (ariaLabelledBy) text += ` ${ariaLabelledBy}`;

    const patterns = {
      first_name: /first.?name|fname|given.?name/,
      last_name: /last.?name|lname|surname|family.?name/,
      full_name: /\bfull.?name\b|\bname\b(?!.*\b(?:email|user(?:name)?)\b)/,
      email: /email|e.?mail/,
      phone: /phone|tel|mobile|cell/,
      address: /address|addr(?!ess)/,
      city: /city|town/,
      state: /state(?!ment)|province|region/,
      zip: /\b(?:zip(?:\s*code)?|postal(?:\s*code)?)\b/,
      country: /country|nation/,
      company: /company|organization|employer/,
      position: /position|title|job.?title|role/,
      website: /\b(?:website|url|homepage)\b/,
      linkedin: /linkedin|linked\.in/,
      github: /github|git\.hub/,
      experience: /\b(?:experience|exp|years?\s+of\s+experience|yoe)\b/,
      education: /education|degree|school|university|college/,
      skills: /\b(?:skills?|competenc\w*)\b/,
      cover_letter: /cover.?letter|motivation|why/,
      salary: /salary|compensation|pay|wage/,
      date: /\b(?:date|dob|start(?:\s*date)?|end(?:\s*date)?|available\s*from)\b/,
    };

    Object.freeze(patterns);

    for (const [classification, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) {
        return classification;
      }
    }
    return null;
  }

  detectedFormlessInputs() {
    const allControls = document.querySelectorAll(FORM_CONTROLS_SELECTOR);
    const formlessInputs = Array.from(allControls).filter(
      (el) => !el.closest(FORM_SELECTOR)
    );
    if (formlessInputs.length > 0) {
      const fields = [];

      formlessInputs.forEach((input) => {
        const fieldInfo = this.analyzeFormFields(input);
        if (fieldInfo) {
          fields.push(fieldInfo);
        }
      });

      if (fields.length > 0) {
        this.detectedForms.push({
          element: document.body,
          index: this.detectedForms.length,
          fields,
          isFormless: true,
        });
      }
    }
  }

  highlightForms(persist = false) {
    this.removeHighlights();

    this.detectedForms.forEach((formData, idx) => {
      formData.fields.forEach((field) => {
        field.element.style.outline = `2px solid ${this.constructor.COLORS.HIGHLIGHT_COLOR}`;
        field.element.style.outlineOffset = "2px";
        field.element.setAttribute("data-cv-autofill", "detected");

        if (field.classification) {
          field.element.title = `Smells Like Job Spirit: ${field.classification}`;
        }
      });
    });

    if (!persist) {
      setTimeout(() => {
        this.removeHighlights();
      }, 5000);
    }
  }

  removeHighlights() {
    const highlightedElements = document.querySelectorAll(
      '[data-cv-autofill="detected"]'
    );

    highlightedElements.forEach((element) => {
      element.style.outline = "";
      element.style.outlineOffset = "";
      element.removeAttribute("data-cv-autofill");
      element.removeAttribute("title");
    });
  }

  autoFillForms(cvData) {
    if (!cvData || this.detectedForms.length === 0) {
      console.log("No CV data or forms detected");
      return { fieldsFilled: 0, message: "No CV data or forms detected" };
    }

    let fieldsFilled = 0;

    this.detectedForms.forEach((formData) => {
      fieldsFilled += this.fillFormFields(formData.fields, cvData);
    });

    const message =
      fieldsFilled > 0
        ? `Form filled successfully. ${fieldsFilled} field(s) updated.`
        : "No fields were updated.";

    if (fieldsFilled > 0) {
      this.showNotification(message, "success");
    } else {
      this.showNotification(message, "info");
    }

    return { fieldsFilled, message };
  }

  fillFormFields(fields, cvData) {
    let filledCount = 0;
    fields.forEach((field) => {
      const value = this.getValueForField(field.classification, cvData);

      if (value !== undefined && value !== null) {
        this.fillField(field.element, String(value));
        filledCount++;
      }
    });
    return filledCount;
  }

  getValueForField(classification, cvData, fieldInfo = {}) {
    const mappings = {
      first_name: () => {
        const fullName =
          (
            cvData?.personal_info?.full_name || cvData?.personal_info?.fullName
          )?.trim() || "";
        const parts = fullName.split(/\s+/);
        return parts.length > 0 ? parts[0] : "";
      },
      last_name: () => {
        const fullName =
          (
            cvData?.personal_info?.full_name || cvData?.personal_info?.fullName
          )?.trim() || "";
        const parts = fullName.split(/\s+/);
        return parts.length > 1 ? parts.slice(1).join(" ") : "";
      },
      full_name: () =>
        (
          cvData?.personal_info?.full_name || cvData?.personal_info?.fullName
        )?.trim() || "",
      email: () => {
        const emails = cvData?.contact_info?.emails || [];
        const primaryEmail = cvData?.personal_info?.email || "";
        if (primaryEmail) return primaryEmail;
        return Array.isArray(emails)
          ? emails[emails.length - 1]?.value || ""
          : "";
      },
      phone: () => {
        const phones = cvData?.contact_info?.phones || [];
        const primaryPhone = cvData?.personal_info?.phone || "";
        if (primaryPhone) return primaryPhone;
        return Array.isArray(phones)
          ? phones[phones.length - 1]?.value || ""
          : "";
      },
      address: () =>
        (cvData?.personal_info?.address || cvData?.contact_info?.address)?.trim() ||
        "",
      city: () =>
        (cvData?.personal_info?.city || cvData?.contact_info?.city)?.trim() || "",
      country: () =>
        (cvData?.personal_info?.country || cvData?.contact_info?.country)?.trim() ||
        "",
      state: () =>
        (cvData?.personal_info?.state || cvData?.contact_info?.state)?.trim() ||
        (
          cvData?.personal_info?.region || cvData?.contact_info?.region
        )?.trim() ||
        "",
      zip: () =>
        (
          cvData?.personal_info?.postalCode ??
          cvData?.contact_info?.postalCode ??
          cvData?.personal_info?.zip ??
          cvData?.contact_info?.zip
        )?.toString() || "",
      company: () => {
        const experiences = cvData?.experience || cvData?.work_experience || [];
        return Array.isArray(experiences)
          ? experiences[0]?.company?.trim() || ""
          : "";
      },
      position: () => {
        const experiences = cvData?.experience || cvData?.work_experience || [];
        return Array.isArray(experiences)
          ? (experiences[0]?.job_title || experiences[0]?.position)?.trim() ||
              ""
          : "";
      },
      website: () =>
        (
          cvData?.personal_info?.website || cvData?.social_links?.website
        )?.trim() || "",
      education: () => {
        const education = cvData?.education || [];
        return Array.isArray(education)
          ? education
              .map((e) => e?.institution?.trim() || "")
              .filter(Boolean)
              .join(", ")
          : "";
      },
      linkedin: () =>
        (
          cvData?.personal_info?.linkedin || cvData?.social_links?.linkedin
        )?.trim() || "",
      github: () =>
        (cvData?.personal_info?.github || cvData?.social_links?.github)?.trim() ||
        "",
      experience: () => {
        const experiences = cvData?.experience || cvData?.work_experience || [];
        return Array.isArray(experiences)
          ? experiences
              .map((e) =>
                [(e?.job_title || e?.position), e?.company]
                  .filter(Boolean)
                  .join(" @ ")
              )
              .filter(Boolean)
              .join("; ")
          : "";
      },
      skills: () => {
        const raw = cvData?.skills || [];
        if (Array.isArray(raw)) {
          return raw.flatMap((s) => s.items || s).join(", ");
        }
        return "";
      },
      cover_letter: () =>
        (cvData?.cover_letter || cvData?.application?.coverLetter)?.trim() ||
        "",
      salary: () => {
        const desired =
          cvData?.preferences?.desired_compensation ??
          cvData?.desired_compensation;
        if (!desired) return "";
        const amount = desired?.amount ?? desired?.min ?? desired?.max;
        const currency = desired?.currency ?? "USD";
        return amount ? `${amount} ${currency}` : "";
      },
      date: () => {
        const labelText = `${fieldInfo.label || ""} ${
          fieldInfo.name || ""
        }`.toLowerCase();
        const experiences = cvData?.experience || cvData?.work_experience || [];
        if (labelText.includes("dob") || labelText.includes("birth")) {
          return cvData?.personal_info?.dob || "";
        } else if (labelText.includes("start")) {
          return experiences?.[0]?.start_date || "";
        } else if (labelText.includes("end")) {
          return experiences?.[0]?.end_date || "";
        } else if (labelText.includes("available")) {
          return cvData?.availability?.from || "";
        }
        // Default to today's date for generic date fields
        try {
          return new Date().toISOString().slice(0, 10);
        } catch {
          return "";
        }
      },
    };

    const mapper = mappings[classification];
    return mapper ? mapper() : "";
  }

  fillField(element, value) {
    const tag = element.tagName?.toLowerCase?.() || "";
    if (tag === "textarea") {
      element.value = value;
    } else {
      switch (element.type) {
        case "email":
        case "text":
        case "tel":
        case "url":
        case "number":
        case "date":
          element.value = value;
          break;
        case "checkbox": {
          element.checked =
            Boolean(value) && value !== "false" && value !== "0";
          break;
        }
        case "radio": {
          const name = element.name ?? "";
          const group = document.querySelectorAll(
            `input[type="radio"][name="${CSS.escape(name)}"]`
          );
          const target = Array.from(group).find(
            (r) => r.value?.toLowerCase?.() === String(value).toLowerCase()
          );
          if (target) target.checked = true;
          break;
        }
        case "select-one": {
          const option = Array.from(element.options).find(
            (opt) =>
              opt.text.toLowerCase().includes(value.toLowerCase()) ||
              opt.value.toLowerCase().includes(value.toLowerCase())
          );
          if (option) {
            element.value = option.value;
          }
          break;
        }
      }
    }

    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.style.backgroundColor = `${this.constructor.COLORS.SUCCESS_BG}`;
    setTimeout(() => {
      element.style.backgroundColor = "";
    }, 1000);
  }

  showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `cv-autofill-notification cv-autofill-${type}`;
    notification.textContent = message;

    Object.assign(notification.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      padding: "12px 16px",
      backgroundColor:
        type === "success"
          ? `${this.constructor.COLORS.NOTIFICATION_SUCCESS}`
          : `${this.constructor.COLORS.NOTIFICATION_INFO}` /**TODO: fix colors **/,
      color: "white",
      borderRadius: "6px",
      zIndex: "10000",
      fontSize: "14px",
      fontFamily: "system-ui, sans-serif",
      boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
    });

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  initializeFieldMappings() {
    const mappings = {
      first_name: "First Name",
      last_name: "Last Name",
      email: "Email Address",
      phone: "Phone Number",
      address: "Address",
      city: "City",
      state: "State/Province",
      zip: "ZIP/Postal Code",
      country: "Country",
      company: "Company",
      position: "Position",
      education: "Education",
      linkedin: "LinkedIn Profile",
      github: "GitHub Profile",
      experience: "Experience",
      cover_letter: "Cover Letter",
      salary: "Desired Salary",
      date: "Date",
      full_name: "Full Name",
      skills: "Skills",
    };
    return mappings;
  }

  observeFormMutations() {
    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          this.detectForms();
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }
}

new AutofillContent();
