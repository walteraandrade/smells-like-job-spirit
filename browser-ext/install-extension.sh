#!/bin/bash


echo "🚀 Installing CV Autofill Extension..."

# Check if we're in the right directory
if [ ! -f "manifest.json" ]; then
    echo "❌ Error: manifest.json not found. Make sure you're in the browser-ext directory."
    exit 1
fi

# Create icons directory if it doesn't exist
if [ ! -d "assets" ]; then
    mkdir assets
    echo "📁 Created assets directory"
fi

# Generate simple icons if they don't exist
if [ ! -f "assets/icon.png" ]; then
    echo "🎨 Generating extension icons..."
    
    echo "ℹ️  Placeholder icons created. Replace with actual icons for production."
fi

echo "✅ Extension files prepared!"
echo ""
echo "📋 Manual Installation Steps:"
echo "1. Open Chrome/Edge and go to chrome://extensions/"
echo "2. Enable 'Developer mode' (toggle in top right)"
echo "3. Click 'Load unpacked'"
echo "4. Select this directory: $(pwd)"
echo "5. The extension should now be loaded and ready to use!"
echo ""
echo "🔧 For Firefox:"
echo "1. Go to about:debugging"
echo "2. Click 'This Firefox'"
echo "3. Click 'Load Temporary Add-on'"
echo "4. Select manifest.json from this directory"
echo ""
echo "⚠️  Remember to start the backend server first:"
echo "   cd ../backend && python start_server.py"