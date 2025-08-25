import { Patterns } from "./form-field.patterns.js";

if (
	typeof browser !== "undefined" &&
	(!window.chrome || !window.chrome.runtime)
) {
	window.chrome = browser;
}

const FORM_SELECTOR = 'form';
const FORM_CONTROLS_SELECTOR = 'input, textarea, select';

class AutofillContent {
    static COLORS = {
    HIGHLIGHT_COLOR: '#667eea',
    SUCCESS_BG: '#e8f5e8',
    NOTIFICATION_SUCCESS: '#4caf50',
    NOTIFICATION_INFO: '#2196f3'
};

    constructor() {
        this.detectedForms = [];
        this.fieldMappings = this.initializeFieldMappings();
        this.init();
    }

    init() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
        });

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.detectForms();
            });
        } else {
            this.detectForms();
        }
    }


    handleMessage(request, sender, sendResponse) {
        sendErrorResponse = (message) => {
            sendResponse({ success: false, message });
        };

        switch (request.action) {
            case 'checkForForms': {
                sendResponse({ formsFound: this.detectedForms.length > 0 });
                break;
            }
            case 'detectForms': {
                this.detectForms();
                this.highlightForms();
                sendResponse({ success: true, forms: this.detectedForms });
                break;
            }
            case 'autoFill':
                this.autoFillForms(request.cvData);
                sendResponse({ success: true  });
                break;
            case 'performFill': {
                const data = request.cvData ?? request.formData;
                if (!data) {
                    sendErrorResponse('No CV/form data provided')
                    break;
                }
                if (this.detectedForms.length > 0) {
                    this.detectedForms.forEach(f => this.fillFormFields(f.fields, data));
                    sendResponse({ success: true });
                } else {
                    sendErrorResponse('No forms detected');
                }
                break;
            }
            default:
                sendResponse({ success: false, message: 'Unknown action' });
        }
    }

    detectForms() {
        this.detectedForms = [];

        const forms = document.querySelectorAll(FORM_SELECTOR);
        forms.forEach((form, idx) => {
            const fields = form.querySelectorAll(FORM_CONTROLS_SELECTOR);
            const mappedFields = Array.from(fields)
                .map(el => this.analyzeFormFields(el))
                .filter(Boolean);

            if (mappedFields.length > 0) {
                this.detectedForms.push({ element: form, index: idx, fields: mappedFields });
            }
        });

        // Also catch standalone inputs outside forms
        this.detectedFormlessInputs();

        console.log(`Detected ${this.detectedForms.length} relevant forms`);
        return this.detectedForms;
    }

    analyzeFormFields(element) {
        if (element.type === 'hidden' || element.disabled || element.readOnly || element.type === 'submit' || element.type === 'button') return null

        const fieldInfo = {
            element,
            type: element.type || 'text',
            name: element.name || '',
            id: element.id || '',
            placeholder: element.placeholder || '',
            label: this.findFieldLabel(element),
            className: element.className || '',
            required: element.required || false
        }

        fieldInfo.classification = this.classifyField(fieldInfo);

        return fieldInfo.classification ? fieldInfo : null;
    }

    findFieldLabel(element) {
        let label = '';

        if (element.id) {
            const elementLabel = document.querySelector(`label[for="${element.id}"]`);
            if (elementLabel) {
                label = elementLabel.textContent.trim();
            }
        }

        if (!label) {
            const parent = element.closest('label');
            /** TODO: evaluate and test if its possible for this code to get undesired elements around the input **/
            if (parent) {
                const textNodes = this.getTextNodes(parent)
                if (textNodes.length > 0 ) {
                    label = textNodes.join(' ').trim();
                }
            }
        }

        return label;
    }

    getTextNodes(element) {
        const textNodes = []

        for (const child of element.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent.trim();
                if (text) textNodes.push(text);
            }
        }
        return textNodes;
    }

    classifyField(fieldInfo) {
        const text = `{${fieldInfo.name} ${fieldInfo.id} ${fieldInfo.placeholder} ${fieldInfo.label} ${fieldInfo.className} }`.toLowerCase();

        for (const [classification, pattern] of Object.entries(Patterns)) {
            if (pattern.test(text)) {
                return classification;
            }
        }
        return null
    }

    detectedFormlessInputs() {

        const allControls = document.querySelectorAll(FORM_CONTROLS_SELECTOR);
        const formlessInputs = Array.from(allControls).filter(el => !el.closest(FORM_SELECTOR));
        if (formlessInputs.length > 0) {
            const fields = [];

            formlessInputs.forEach(input => {
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
                    isFormless: true
                });
            }
        }
    }

    highlightForms() {
        this.removeHighlights();

        this.detectedForms.forEach((formData, idx) => {
            formData.fields.forEach(field => {
                field.element.style.outline = `2px solid ${COLORS.HIGHLIGHT_COLOR}`
                 field.element.style.outlineOffset = '2px';
                field.element.setAttribute('data-cv-autofill', 'detected');

                if (field.classification) {
                    field.element.title = `Smells Like Job Spirit: ${field.classification}`
                }
            });
        });
        setTimeout(() => {
            this.removeHighlights();
        }, 5000)
    }

    removeHighlights() {
        const highlightedElements = document.querySelectorAll('[data-cv-autofill="detected"]');

        highlightedElements.forEach((element) => {
            element.style.outline = '';
            element.style.outlineOffset = '';
            element.removeAttribute('data-cv-autofill');
            element.removeAttribute('title');
        });
    }
   
    autoFillForms(cvData) {
        if (!cvData || this.detectedForms.length === 0) {
            console.log('No CV data or forms detected');
            return;
        }

        this.detectedForms.forEach(formData => {
            this.fillFormFields(formData.fields, cvData);
        });

        this.showNotification('Form filled successfully', 'success');
    }

    fillFormFields(fields, cvData) {
        fields.forEach(field => {
            const value = this.getValueForField(field.classification, cvData);

            if (value) {
                this.fillField(field.element, value)
            }
        });
    }

    getValueForField(classification, cvData) {
        const mappings = {
            'first_name': () => {
                const fullName = cvData?.personal_info?.fullName?.trim?.() || '';
                const parts = fullName.split(/\s+/);
                return parts.length > 0 ? parts[0] : '';
            },
            'last_name': () => {
                const fullName = cvData?.personal_info?.fullName?.trim?.() || '';
                const parts = fullName.split(/\s+/);
                return parts.length > 1 ? parts[parts.length - 1] : '';
            },
            'full_name': () => cvData?.personal_info?.fullName?.trim?.() || '',
            'email': () => {
                const emails = cvData?.contact_info?.emails || [];
                return Array.isArray(emails) ? emails[emails.length - 1]?.value || '' : '';
            },
            'phone': () => {
                const phones = cvData?.contact_info?.phones || [];
                return Array.isArray(phones) ? phones[phones.length - 1]?.value || '' : '';
            },
            'address': () => cvData?.contact_info?.address?.trim?.() || '',
            'city': () => cvData?.contact_info?.city?.trim?.() || '',
            'country': () => cvData?.contact_info?.country?.trim?.() || '',
            'state': () =>
                cvData?.contact_info?.state?.trim?.() ||
                cvData?.contact_info?.region?.trim?.() || '',
            'zip': () =>
                (cvData?.contact_info?.postalCode ??
                 cvData?.contact_info?.zip)?.toString?.() || '',
            'company': () => {
                const experiences = cvData?.work_experience || [];
                return Array.isArray(experiences)
                    ? experiences[experiences.length - 1]?.company?.trim?.() || ''
                    : '';
            },
            'position': () => {
                const experiences = cvData?.work_experience || [];
                return Array.isArray(experiences)
                    ? experiences[experiences.length - 1]?.position?.trim?.() || ''
                    : '';
            },
            'website': () =>
                cvData?.social_links?.website?.trim?.() ||
                cvData?.personal_info?.website?.trim?.() || '',
            'education': () => {
                const education = cvData?.education || [];
                return Array.isArray(education)
                    ? education
                          .map(e => e?.institution?.trim?.())
                          .filter(Boolean)
                          .join(', ')
                    : '';
            },
            'linkedin': () => cvData?.social_links?.linkedin?.trim?.() || '',
            'github': () => cvData?.social_links?.github?.trim?.() || '',
            'experience': () => {
                const experiences = Array.isArray(cvData?.work_experience)
                    ? cvData.work_experience
                    : [];
                return experiences
                    .map(e => [e?.position, e?.company].filter(Boolean).join(' @ '))
                    .filter(Boolean)
                    .join('; ');
            },
            'skills': () => {
                const raw = cvData?.skills || [];
                const allSkills = Array.isArray(raw)
                    ? raw.flatMap(s => (typeof s === 'string' ? s : s?.item)).filter(Boolean)
                    : [];
                return allSkills.join(', ');
            },
            'cover_letter': () =>
                cvData?.cover_letter?.trim?.() ||
                cvData?.application?.coverLetter?.trim?.() || '',
            'salary': () => {
                const desired =
                    cvData?.preferences?.desired_compensation ??
                    cvData?.desired_compensation;
                if (!desired) return '';
                const amount = desired?.amount ?? desired?.min ?? desired?.max;
                const currency = desired?.currency ?? 'USD';
                return amount ? `${amount} ${currency}` : '';
            },
            'date': () => {
                // Use ISO date, best chance to fit <input type="date">
                try {
                    return new Date().toISOString().slice(0, 10);
                } catch {
                    return '';
                }
            },
        };

        const mapper = mappings[classification];
        return mapper ? mapper() : '';
    }

    fillField(element, value) {
        const tag = element.tagName?.toLowerCase?.() || '';
        if (tag === 'textarea') {
            element.value = value;
        } else {
            switch (element.type) {
                case 'email':
                case 'text':
                case 'tel':
                case 'url':
                case 'number':
                case 'date':
                    element.value = value;
                    break;
                case 'select-one': {
                    const option = Array.from(element.options).find((opt) =>
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
            
        element.dispatchEvent(new Event('change',{ bubbles: true }));
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.style.backgroundColor = `${COLORS.SUCCESS_BG}`
        setTimeout(() => {
            element.style.backgroundColor = '';
        }, 1000);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `cv-autofill-notification cv-autofill-${type}`;
        notification.textContent = message;
        
         Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 16px',
            backgroundColor: type === 'success' ? `${COLORS.NOTIFICATION_SUCCESS}` : `${COLORS.NOTIFICATION_INFO}`, /**TODO: fix colors **/
            color: 'white',
            borderRadius: '6px',
            zIndex: '10000',
            fontSize: '14px',
            fontFamily: 'system-ui, sans-serif',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        });
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    initializeFieldMappings() {
        const mappings = {
            'first_name': 'First Name',
            'last_name': 'Last Name',
            'email': 'Email Address',
            'phone': 'Phone Number',
            'address': 'Address',
            'city': 'City',
            'country': 'Country',
            'company': 'Company',
            'position': 'Position',
            'education': 'Education',
            'linkedin': 'LinkedIn Profile',
            'github': 'GitHub Profile',
            'skills': 'Skills'
        };
        console.log('Field mappings initialized');
        return mappings;
    }
}

new AutofillContent();