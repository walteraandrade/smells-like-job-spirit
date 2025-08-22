import fitz # PyMyPDF
import docx
import pytesseract
from PIL import Image
import io
import logging
from typing import Optional
from pathlib import Path

class DocumentParser:
    """Service for extracting text from various document formats."""

    def __init__(self):
        self.supported_formats = { '.pdf', '.docx', '.doc', '.txt', '.png', 'jpg', '.jpeg'}

    def extract_text(self, file_path: str) -> Optional[str]:
        """Extract text from document based on file extension"""
        path = Path(file_path)

        if path.suffix.lower() not in self.supported_formats:
            logging.error(f"Unsupported file format: {path.suffix}")
            return None

        try:
            if path.suffix.lower() == '.pdf':
                return self._extract_from_pdf(file_path)
            elif path.suffix.lower() in {'.doc', '.docx'}:
                return self._extract_from_docx(file_path)
            elif path.suffix.lower() == '.txt':
                return self._extract_from_txt(file_path)
            elif path.suffix.lower() in {'.png', '.jpg', 'jpeg'}:
                return self._extract_from_image(file_path)
        except Exception as e:
            logging.error(f"Error extracting text from {file_path}: {e}")
            return None

    def _extract_from_pdf(self, file_path: str) -> str:
        """Extract text from PDF file."""
        doc = fitz.open(file_path)
        text = ""

        for page_num in range(doc.page_count):
            page = doc[page_num]
            print(f"page {page}")
            text += page.get_text()

            # If no text found, try OCR on images
            if not text.strip():
                pix = page.get_pixmap()
                img_data = pix.tobytes("png")
                img = Image.open(io.BytesIO(img_data))
                text += pytesseract.image_to_string(img)

        doc.close()
        return text.strip()

    def _extract_from_docx(self, file_path: str) -> str:
        """Extract text from docx."""
        doc = docx.Document(file_path)
        text = []

        for paragraph in doc.paragraphs:
            text.append(paragraph.text)

        return '\n'.join(text).strip()

    def _extract_from_txt(self, file_path: str) -> str:
        """Extract text from .txt."""
        with open(file_path, 'r', encoding='utf-8') as file:
            return file.read().strip()

    def _extract_from_image(self, file_path: str) -> str:
        """Extract text from images using OCR"""
        image = Image.open(file_path)
        return pytesseract.image_to_string(image).strip()


# Test the document parser
if __name__ == "__main__":
    parser = DocumentParser()
    text = parser.extract_text("./scary_john_cv.txt")
    print(f"Extracted {len(text)} characters")
    print(text[:500] + "..." if len(text) > 500 else text)
