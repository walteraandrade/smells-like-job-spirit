class ExtensionTester {
    constructor() {
        this.testResults = [];
    }

    async runTests() {
        console.log('🧪 Starting CV Autofill Extension Tests...');

        await this.testFormDetection();
        await this.testFieldClassification();
        await this.testAutofill();

        this.reportResults();
    }

    async testFormDetection() {
        console.log('🔍 Testing Form Detection...');
        try {
            const testForm = this.createTestForm();
            document.body.appendChild(testForm);

            const contentScript = new SmellsLikeJobSpiritContent();
            const detectedForms = await contentScript.detectForms();

            this.assert(detectedFields.length > 0, 'Should detect at least one form field');

            this.assert(detectedForms[0].fields.length > 0, 'Should detect fields in the form');
            
            document.body.removeChild(testForm);
            this.testResults.push({
                test: 'Form Detection',
                status: 'PASSED',
                message: `✅ Detected ${detectedForms.length} forms with ${detectedForms[0].fields.length} fields`
            })
        } catch (error) {
            this.testResults.push({
                test: 'Form Detection',
                status: 'FAILED',
                message: `❌ Error during form detection: ${error.message}`
            });
        }
    }

    async testFieldClassification() {
        console.log('🧠 Testing Field Classification...');
        try {
           const contentScript = new SmellsLikeJobSpiritContent();

           const testFields = [
               { name: 'first_name', label: 'First Name' },
               { name: 'email', label: 'Email Address' },
               { name: 'phone', label: 'Phone Number' },
               { name: 'company', label: 'Current Company' },
           ];

           let correctClassifications = 0;

           testFields.forEach(field => {
            const fieldInfo = {
                name: field.name,
                label: field.label,
                placeholder: '',
                className: '',
                type: 'text',
                id: field.name
            }

            const classification = contentScript.classifyField(fieldInfo);

            if (classification && classification.includes(field.name)) {
                correctClassifications++;
            }
           })

           const accuracy = correctClassifications / testFields.length;

           this.assert(accuracy >= 0.75, `Field classification accuracy should be at least 75%, got ${Math.round(accuracy * 100)}%`);

           this.testResults.push({
            test: 'Field Classification',
            status: 'PASSED',
            message: `✅ Field classification accuracy: ${Math.round(accuracy * 100)}%`
           });

        } catch (error) {
            this.testResults.push({
                test: 'Field Classification',
                status: 'FAILED',
                message: `❌ Error during field classification: ${error.message}`
            });
        }
    }

    async testAutofill() {
        console.log('🖊️ Testing Autofill functionality');
        try {
           const sampleCVData = {
            personal_info: {
                full_name: "João Macabro",
                email: "jones@macabro.com",
                phone: "+55 11 99999-9999",
           },
           experience: [
            {
                job_title: "Software Engineer",
                company: "Smart Tech Corp",
            }
           ]
        };

        const testForm = this.createTestForm();
        document.body.appendChild(testForm);

        const contentScript = new SmellsLikeJobSpiritContent();
        contentScript.autoFillForms(sampleCVData);

        const nameField = document.getElementById('test_name');
        const emailField = document.getElementById('test_email');

        this.assert(nameField.value === sampleCVData.personal_info.full_name, `Name field should be autofilled correctly -- expected: ${sampleCVData.personal_info.full_name}, got: ${nameField.value}`);
        this.assert(emailField.value === sampleCVData.personal_info.email, `Email field should be autofilled correctly -- expected: ${sampleCVData.personal_info.email}, got: ${emailField.value}`);

        document.body.removeChild(testForm);

        this.testResults.push({
            test: 'Autofill Functionality',
            status: 'PASSED',
            message: '✅ Successfully populated form fields with CV data'
        });
        } catch (error) {
            this.testResults.push({
                test: 'Autofill Functionality',
                status: 'FAILED',
                message: `❌ Error during autofill: ${error.message}`
            });
        }
    }

    createTestForm() {
        const form = document.createElement('form');
        form.id = 'test-form';

        form.innerHTML = `
            <input type="text" id="test_name" name="first_name" placeholder="First Name" />
            <input type="email" id="test_email" name="email" placeholder="Email Address" />
            <input type="tel" id="test_phone" name="phone" placeholder="Phone Number" />
            <input type="text" id="test_company" name="company" placeholder="Current Company" />
        `;

        return form;
    }

    assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }

    reportResults() {
        console.log('========* v *=========')
        console.log('\n📊 Test Results:');
        console.log('========* ^ *=========')
        
        let passed = 0;
        let failed = 0;

        this.testResults.forEach(result => {
            if (result.status === 'PASSED') {
                console.log(`✅ ${result.test}: ${result.message}`);
                passed++;
            } else {
                console.error(`❌ ${result.test}: ${result.message}`);
                failed++;
            }
        });

        console.log('\n📈 Summary:');
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);
        console.log(`Total: ${passed + failed}`);

        if (failed === 0) {
            console.log('🎉 All tests passed!');
        } else {
            console.log('⚠️ Some tests failed. Please check the results above.');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const tester = new ExtensionTester();
    tester.runTests();
});