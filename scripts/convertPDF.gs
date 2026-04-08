/**
 * Extracts text from a PDF stored in Google Drive.
 *
 * Attempts fast extraction using PDF.gs (PdfApp). If no meaningful text is returned,
 * falls back to Google Drive OCR by converting the PDF into a Google Doc.
 *
 * @async
 * @function extractPdfTextSmart
 * @param {string} fileId - The Google Drive file ID of the PDF to process.
 * @returns {Promise<string>} The extracted text content from the PDF.
 *
 * @throws {Error} Throws if both PDF.gs and OCR extraction fail unexpectedly.
 */
async function extractPdfTextSmart(fileId) {
  const file = DriveApp.getFileById(fileId);
  const blob = file.getBlob();
  let text = "";

  try {
    // Attempt fast extraction using PDF.gs
    text = await PdfApp.extractText(blob);
    if (typeof text === "string" && text.trim().length > 20) {
      Logger.log("Used PDF.gs (text-based PDF)");
      return text;
    }

    Logger.log("PDF.gs returned little/no text");
  } catch (err) {
    Logger.log("PDF.gs failed: " + err);
  }

  // --- FALLBACK: OCR ---
  Logger.log("Falling back to OCR");
  return extractWithOCR(blob);
}

/**
 * Extracts text from a PDF blob using Google Drive OCR.
 *
 * Uploads the PDF as a temporary Google Doc with OCR enabled,
 * reads the text content, then deletes the temporary file.
 *
 * @function extractWithOCR
 * @param {GoogleAppsScript.Base.Blob} blob - The PDF file blob to process.
 * @returns {string} The extracted text content from OCR.
 *
 * @throws {Error} Throws if OCR conversion or document access fails.
 */
function extractWithOCR(blob) {
  const resource = {
    name: "temp_ocr_" + Date.now(),
    mimeType: "application/vnd.google-apps.document"
  };

  const file = Drive.Files.create(resource, blob, {
    ocrLanguage: "en"
  });

  const doc = DocumentApp.openById(file.id);
  const text = doc.getBody().getText();

  // Cleanup temporary file
  DriveApp.getFileById(file.id).setTrashed(true);

  return text;
}