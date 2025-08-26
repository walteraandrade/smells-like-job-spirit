import subprocess
import sys
import time
import requests


def check_ollama():
    """Check if Ollama is runnning and start if needed"""

    try:
        requests.get("http://localhost:11434/api/tags", timeout=5)
        print("✅ Ollama is running!")
        return True
    except request.exceptions.ConnectionError:
        print("❌ Ollama is not running or is running in another port")
        print("Trying to start Ollama...")

        subprocess.Popen(
            ["ollama", "serve"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
            close_fds=True,
        )

        for i in range(30):
            try:
                requests.get("http://localhost:11434/api/tags", timout=2)
                print("✅ Ollama started successfully")
                return True
            except requests.exceptions.ConnectionError:
                time.sleep(1)

        print("❌ Failed to start Ollama, are you sure it is installed correctly?")
        return False


def check_model():
    """Check if required model is available"""

    try:
        response = requests.get("http://localhost:11434/api/tags")
        models = response.json().get("models", [])

        for model in models:
            if "llama3.1:8b" in model.get("name", ""):
                print("✅ Llama 3.1:8B model is available")
                return True

        print("❌ Llama 3.1 8B model not found")
        print("Installing model... (this may take a few minutes)")
        subprocess.run(["ollama", "pull", "llama3.1:8b"])
        return True

    except Exception as e:
        print(f"❌ Error checking model: {e}")
        return False


def start_api_server():
    """Start the API Server"""
    print("Starting Smells Like Job Spirit API server...")
    subprocess.run(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--reload",
            "--host",
            "0.0.0.0",
            "--port",
            "8000",
        ],
        check=True,
    )


if __name__ == "__main__":
    print("🚀 Starting Smells Like Job Spirit Backend...")

    # Check prerequisites
    if not check_ollama():
        sys.exit(1)

    if not check_model():
        sys.exit(1)

    # Start the API server
    start_api_server()
