/**
 * PDF Text Extractor for Salesforce Quotes
 * Uses PDF.js to extract text with proper coordinate sorting
 *
 * Requires: PDF.js v3.11.174
 * CDN: https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js
 */

/**
 * Extract text from PDF file using PDF.js
 * Sorts text by Y-X coordinates to maintain reading order
 *
 * @param {File} file - PDF file object from file input
 * @returns {Promise<string>} Extracted text
 */
async function extractTextFromPdfFile(file) {
  if (!window.pdfjsLib) {
    throw new Error('PDF.js library not loaded. Please include PDF.js in your page.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    if (content.items.length === 0) continue;

    // Sort by Y (vertical) then X (horizontal) to enforce visual reading order
    // This fixes the issue where columns or headers get merged into body text
    const items = content.items.map(item => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
      h: item.height || item.transform[3]
    })).sort((a, b) => {
      // If Y difference is > 5, consider it a new line (PDF coordinates start at bottom-left)
      if (Math.abs(a.y - b.y) > 5) return b.y - a.y;
      return a.x - b.x;
    });

    let pageText = '';
    let lastY = items[0].y;

    for (let j = 0; j < items.length; j++) {
      const item = items[j];
      // Insert New Line if Y changes significantly
      if (Math.abs(item.y - lastY) > 5) {
        pageText += '\n';
      } else if (j > 0) {
        pageText += ' '; // Add space between words on same line
      }
      pageText += item.str;
      lastY = item.y;
    }
    text += pageText + '\n\n';
  }
  return text;
}

/**
 * Initialize PDF.js library
 * Call this before using extractTextFromPdfFile
 */
function initPdfJs() {
  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    console.log('[PDF Extractor] PDF.js initialized');
  } else {
    console.error('[PDF Extractor] PDF.js library not found. Please include it in your HTML.');
  }
}

// Auto-initialize if PDF.js is already loaded
if (typeof window !== 'undefined' && window.pdfjsLib) {
  initPdfJs();
}

// Exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractTextFromPdfFile,
    initPdfJs
  };
}

if (typeof window !== 'undefined') {
  window.PDFExtractor = {
    extractTextFromPdfFile,
    initPdfJs
  };
}
