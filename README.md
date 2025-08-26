# 🤖 Smells Like Job Spirit - CV Autofill Tool 

⚠️⚠️ **WIP** ⚠️⚠️

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green.svg)](https://fastapi.tiangolo.com/)
[![Browser Extension](https://img.shields.io/badge/Browser-Chrome%20%7C%20Firefox-orange.svg)](https://developer.chrome.com/docs/extensions/)

An intelligent browser extension that automatically fills job application forms using data extracted from your CV by a local Large Language Model (LLM). **Complete privacy** - everything runs locally on your machine.

*"Smells Like Job Spirit"* - because applying for jobs shouldn't feel like teen spirit, it should be smart and automated! 🎸

## ✨ Features

- 📄 **Multi-format CV parsing** - PDF, DOCX, TXT support
- 🧠 **Local LLM processing** - Uses Ollama + Llama 3.1 8B for complete privacy
- 🎯 **Smart form detection** - Automatically identifies and classifies form fields
- ⚡ **One-click autofill** - Fill entire job applications instantly
- 🔒 **Privacy-first** - No data leaves your computer
- 🌐 **Universal compatibility** - Works on any website
- 🎨 **User-friendly interface** - Clean, intuitive browser extension

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   CV Document   │───▶│   CV Parser      │───▶│  Structured     │
│  (PDF/DOCX/TXT) │    │  (LLM Service)   │    │  JSON Data      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        │
┌─────────────────┐    ┌──────────────────┐             │
│ Browser         │◄───│     FastAPI      │◄────────────┘
│ Extension       │    │   Backend API    │
└─────────────────┘    └──────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│ Job Application │    │   SQLite DB      │
│ Form Detection  │    │ (User Config &   │
│ & Auto-fill     │    │  Field Mappings) │
└─────────────────┘    └──────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Operating System**: Linux, macOS, or Windows
- **Python**: 3.8 or higher
- **RAM**: 16GB+ (32GB recommended for optimal performance)
- **Storage**: 50GB+ free space
- **GPU**: 6GB+ VRAM recommended (RTX 3060 or better)

### 1. Clone the Repository

```bash
git clone https://github.com/walteraandrade/smells-like-job-spirit.git
cd smells-like-job-spirit
```

### 2. Backend Setup

```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt

# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Download Llama 3.1 8B model
ollama pull llama3.1:8b
```

### 3. Start the Backend

```bash
cd backend
python start_server.py
```

### 4. Install Browser Extension

#### Chrome/Edge:
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `browser-extension` directory

#### Firefox:
1. Go to `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select `manifest.json` from the `browser-extension` directory

### 5. Upload Your CV

1. Click the extension icon in your browser
2. Upload your CV (PDF, DOCX, or TXT)
3. Wait for processing (first run may take 1-2 minutes)
4. Your CV data is now ready for autofill!

## 📖 Usage

### Basic Workflow

1. **Upload CV**: Use the browser extension popup to upload your CV
2. **Navigate to job site**: Go to any job application form
3. **Detect forms**: Click "Detect Forms" to highlight fillable fields
4. **Auto-fill**: Click "Auto-Fill Forms" to populate all detected fields
5. **Review & submit**: Review the filled information and submit

### Supported Form Fields

The tool can automatically fill these common fields:

- **Personal Information**: Name, email, phone, address, city, country
- **Professional**: Current company, job title, LinkedIn, GitHub
- **Experience**: Work history, achievements, descriptions
- **Education**: Degrees, institutions, graduation dates
- **Skills**: Technical skills, programming languages
- **Additional**: Cover letters, salary expectations

## 🛠️ Development

### Project Structure

```
smells-like-job-spirit/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/            # API endpoints
│   │   ├── core/           # Configuration and database
│   │   ├── models/         # Data models
│   │   └── services/       # Business logic
│   ├── tests/              # Backend tests
│   └── requirements.txt
├── browser-extension/       # Browser extension
│   ├── background/         # Service worker
│   ├── content/           # Content scripts
│   ├── popup/             # Extension popup
│   └── manifest.json
├── docs/                   # Documentation
├── models/                 # LLM models (gitignored)
├── cv-autofill-development-plan.md  # Detailed development guide
└── README.md
```

### Running Tests

```bash
# Backend tests
cd backend
pytest tests/ -v

# Extension tests (open test page in browser)
cd browser-extension/test
python -m http.server 8080
# Navigate to http://localhost:8080/test-extension.html
```

### API Endpoints

- `POST /api/parse-cv` - Upload and parse CV
- `POST /api/generate-mappings` - Generate form field mappings
- `GET /api/health` - Health check

## 🎯 Development Phases

### Phase 1: Core Functionality ✅
- [x] Local LLM setup with Ollama
- [x] CV parsing service
- [x] Basic browser extension
- [x] Form detection and autofill

### Phase 2: Enhanced Features (In Progress)
- [x] Advanced form field classification
- [x] Custom field mapping editor
- [ ] Support for more CV formats
- [ ] Batch processing multiple applications

### Phase 3: Advanced Features (Planned)
- [ ] Multiple CV profiles
- [ ] Application tracking
- [ ] Integration with job boards
- [ ] Mobile app companion
- [ ] Advanced analytics

### Phase 4: Production Ready (Future)
- [ ] Automated testing suite
- [ ] Performance optimizations
- [ ] User documentation
- [ ] Packaging and distribution

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test thoroughly
4. Commit: `git commit -m 'Add amazing feature'`
5. Push: `git push origin feature/amazing-feature`
6. Open a Pull Request

### Areas for Contribution

- 🐛 Bug fixes and improvements
- 📝 Documentation enhancements
- 🎨 UI/UX improvements
- 🌍 Internationalization
- 🧪 Test coverage expansion
- ⚡ Performance optimizations

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```bash
# Backend Configuration
API_HOST=localhost
API_PORT=8000
DEBUG=true

# LLM Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

# Database
DATABASE_URL=sqlite:///./cv_autofill.db

# Logging
LOG_LEVEL=INFO
```

## 📚 Documentation

- [Development Plan](cv-autofill-development-plan.md) - Comprehensive development guide
- [API Reference](docs/api.md) - Backend API documentation
- [Extension Guide](docs/extension.md) - Browser extension development
- [Troubleshooting](docs/troubleshooting.md) - Common issues and solutions

## 🔒 Privacy & Security

### Data Privacy
- **Local Processing**: All CV parsing happens on your machine
- **No Cloud Dependencies**: No data sent to external services
- **Secure Storage**: CV data stored locally in browser
- **No Tracking**: No analytics or user tracking

### Security Features
- Input validation and sanitization
- Secure file handling
- CORS protection
- Local-only API endpoints

## 🐛 Troubleshooting

### Common Issues

**Extension not loading:**
- Ensure you're in Developer mode
- Check browser console for errors
- Verify manifest.json is valid

**Backend not starting:**
- Check if Ollama is running: `ollama list`
- Verify Python dependencies: `pip list`
- Check port 8000 is available

**CV parsing fails:**
- Ensure CV is in supported format (PDF, DOCX, TXT)
- Check file size (< 10MB recommended)
- Verify Llama 3.1 model is downloaded

**Form detection issues:**
- Try refreshing the page
- Check browser console for errors
- Some sites may block content scripts

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Ollama](https://ollama.ai/) - For making local LLM deployment easy
- [Meta AI](https://ai.meta.com/) - For the Llama 3.1 model
- [FastAPI](https://fastapi.tiangolo.com/) - For the excellent Python web framework
- [The open-source community](https://github.com/) - For countless tools and libraries
- [CodeRabbit](https://www.coderabbit.ai) - For great improvements and fixes via PR review.

## 📞 Support

- 🐛 **Issues**: [GitHub Issues](https://github.com/walteraandrade/smells-like-job-spirit/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/walteraandrade/smells-like-job-spirit/discussions)
- 📧 **Email**: Feel free to reach out for questions!
