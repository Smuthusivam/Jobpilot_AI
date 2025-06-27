// Simple and robust PDF processor for resumes
// Supports both text-based and image-based (scanned) PDFs using OCR fallback

const fs = require('fs');
const pdfParse = require('pdf-parse');
const { fromPath } = require('pdf2pic'); // For converting PDF pages to images
const Tesseract = require('tesseract.js'); // For OCR

/**
 * Extracts text from a PDF file. If the PDF is image-based, uses OCR as fallback.
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<{success: boolean, text: string, method: string, pages: number, originalLength: number, cleanedLength: number, validation: object}>}
 */
async function processResumePDF(filePath) {
  // 1. Try to extract text using pdf-parse (works for most text-based PDFs)
  try {
    const data = await pdfParse(fs.readFileSync(filePath));
    const text = (data.text || '').replace(/\s+/g, ' ').trim();
    // Validate the extracted text for resume-like content
    const validation = validateExtractedText(text) || { isValid: false, reason: 'Validation failed', wordCount: 0, commonWords: [] };
    if (text.length > 50) {
      return {
        success: true,
        text,
        method: 'pdf-parse', // Indicates text-based extraction
        pages: data.numpages || 1,
        originalLength: data.text.length,
        cleanedLength: text.length,
        validation
      };
    }
  } catch (err) {
    // Continue to OCR fallback if text extraction fails
  }

  // 2. If text extraction failed, try OCR on the first 2 pages (for performance)
  try {
    const options = {
      density: 200,
      saveFilename: 'ocr_page',
      savePath: './tmp',
      format: 'png',
      width: 1200,
      height: 1600
    };
    const pdf2pic = fromPath(filePath, options);
    let ocrText = '';
    // Only process first 2 pages for speed and resource efficiency
    for (let page = 1; page <= 2; page++) {
      const image = await pdf2pic(page); // Convert PDF page to image
      const ocrResult = await Tesseract.recognize(image.path, 'eng', { logger: m => {} }); // OCR the image
      ocrText += ocrResult.data.text + '\n';
      // Clean up temp image
      fs.unlinkSync(image.path);
    }
    ocrText = ocrText.replace(/\s+/g, ' ').trim();
    // Validate the OCR-extracted text
    const validation = validateExtractedText(ocrText) || { isValid: false, reason: 'Validation failed', wordCount: 0, commonWords: [] };
    if (ocrText.length > 30) {
      return {
        success: true,
        text: ocrText,
        method: 'ocr', // Indicates OCR-based extraction
        pages: 2,
        originalLength: ocrText.length,
        cleanedLength: ocrText.length,
        validation
      };
    }
  } catch (err) {
    // OCR failed, will return failure below
  }

  // 3. If all methods fail, return failure with a valid validation object
  return {
    success: false,
    text: '',
    method: 'none',
    pages: 0,
    originalLength: 0,
    cleanedLength: 0,
    validation: { isValid: false, reason: 'Could not extract text from PDF (not text-based or image-based OCR failed)', wordCount: 0, commonWords: [] }
  };
}

/**
 * Validates the extracted text for basic resume content.
 * Checks for minimum length and presence of common resume keywords.
 * @param {string} text 
 * @returns {object}
 */
function validateExtractedText(text) {
  if (!text || text.length < 30) {
    return { isValid: false, reason: 'Text too short', confidence: 0, wordCount: 0, commonWords: [] };
  }
  const words = text.split(/\s+/);
  const commonResumeWords = [
    'experience', 'education', 'skills', 'work', 'project', 'university', 'degree', 'certification', 'professional', 'email', 'phone', 'summary', 'objective'
  ];
  // Find which common resume words are present
  const found = commonResumeWords.filter(w => text.toLowerCase().includes(w));
  return {
    isValid: words.length > 10,
    reason: words.length > 10 ? 'Looks like a resume' : 'Not enough words',
    confidence: found.length / commonResumeWords.length,
    wordCount: words.length,
    commonWords: found
  };
}

module.exports = { processResumePDF, validateExtractedText };
