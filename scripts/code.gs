/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

function onHomepage(e) {
  return createRenameCard(e);
}

/**
 * Triggered by the manifest when a user selects files in Drive.
 * We must store the IDs here before launching the UI.
 */
function onItemsSelected(e) {
  if (e && e.drive && e.drive.selectedItems) {
    const selectedIds = e.drive.selectedItems.map(item => item.id);
    
    // Store IDs in user-specific cache so the React app can find them later
    PropertiesService.getUserProperties().setProperty('LATEST_SELECTION', JSON.stringify(selectedIds));
  }
  
  // Proceed to build your Card/Overlay as normal
  return createRenameCard(e);
}

/**
 * Retrieves the Gemini API Key from Script Properties.
 * @returns {string}
 */
function getGeminiApiKey() {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) {
    console.error("GEMINI_API_KEY not found in Script Properties.");
  }
  return key;
}

const GEMINI_API_KEY = getGeminiApiKey();

if (!GEMINI_API_KEY && typeof google === 'undefined') {
  // Only throw if not in a context where it might be provided otherwise, 
  // though in Apps Script this is the main way.
  console.warn("GEMINI_API_KEY not found in Script Properties. Please add it in Settings.");
}


/**
 * CORE ADD-ON TRIGGERS
 */

/**
 * Adds a custom menu to the Google Drive UI (if applicable) or Spreadsheet/Doc.
 * For a Drive Add-on, this is usually handled via the manifest.
 * @param {Object} [e] The event object.
 */
function onOpen(e) {
  // Trigger scope request
  try {
    DriveApp.getFiles();
  } catch (e) {
    console.error('Scope initialization failed:', e);
  }
}


/**
 * Creates the main card for the Drive Add-on.
 * Uses the Web App URL to open the React app in an overlay.
 * @param {Object} [e] The event object.
 * @returns {GoogleAppsScript.Card_Service.Card}
 */
function createRenameCard(e) {
  const card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader().setTitle('DriveRenamer'));

    card.setHeader(CardService.newCardHeader()
    .setTitle('DRIVERENAME AI')
    .setSubtitle('Logical File Organization Specialist')
    );

  const section = CardService.newCardSection();
  
  section.addWidget(CardService.newTextParagraph()
    .setText('<b>SYSTEM STATUS: READY</b><br><br>Select files in your Drive, then launch the overlay to begin AI analysis.'));

  // Use ScriptApp to get the URL dynamically so you don't have to hardcode it
  //const webAppUrl = ScriptApp.getService().getUrl(); 
  const webAppUrl = "https://script.google.com/macros/s/AKfycbwjUEFK_MA1su9_qIIy3yvIbPyNlHnjN3bp-2VniVo/dev";

  const button = CardService.newTextButton()
    .setText('OPEN AI ASSISTANT')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setBackgroundColor('#1a1a1a') // Dark gray/almost black
    .setOpenLink(CardService.newOpenLink()
      .setUrl(webAppUrl)
      .setOpenAs(CardService.OpenAs.OVERLAY)
      .setOnClose(CardService.OnClose.RELOAD_ADD_ON));

  section.addWidget(button);
  card.addSection(section);
  return card.build();
}


/**
 * Shows the sidebar or overlay with the Vite-hosted React app.
 * This function is called when the user clicks the add-on icon.
 * @returns {void|GoogleAppsScript.Card_Service.ActionResponse}
 */
function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('dist/index')
    .setTitle('DriveRename AI')
    .setWidth(300)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  if (typeof SpreadsheetApp !== 'undefined') {
    SpreadsheetApp.getUi().showSidebar(html);
  } else if (typeof DocumentApp !== 'undefined') {
    DocumentApp.getUi().showSidebar(html);
  } else {
    // For Drive Add-ons, the UI is usually CardService based, 
    // but sidebar can be launched from a Card action.
    CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(createRenameCard()))
      .build();
  }
}





async function getSelectedFiles() {
  const storedSelection = PropertiesService.getUserProperties().getProperty('LATEST_SELECTION');

  if (!storedSelection) {
    return {
      success: false,
      error: "No files selected."
    };
  }

  const fileIds = JSON.parse(storedSelection);
  const fileData = [];

  for (const id of fileIds) {
    const file = DriveApp.getFileById(id);
    const mimeType = file.getMimeType();
    let content = "";

    if (mimeType === "application/pdf") {
      const extractedText = await extractPdfTextSmart(id);

      if (typeof extractedText === "string" && extractedText.length > 0) {
        content = extractedText.substring(0, 2000);
        if (extractedText.length > 2000) {
          content += "... [truncated]";
        }
      } else {
        content = "[No text extracted]";
      }
    }

    fileData.push({
      fileId: id,
      currentName: file.getName(),
      mimeType,
      content
    });
  }

  return {
    success: true,
    files: fileData
  };
}



/**
 * Retrieves metadata and content for the files. Called from React via google.script.run.
 * No parameters needed — it reads from UserProperties.
 */
/**
 * Retrieves metadata and content for the selected files.
 * Called from React via google.script.run.
 * Reads file IDs from UserProperties under LATEST_SELECTION.
 *
 * @returns {Promise<{success: boolean, files?: Array<Object>, error?: string}>}
 */
async function getSelectedFiles() {
  try {
    const storedSelection =
      PropertiesService.getUserProperties().getProperty("LATEST_SELECTION");

    if (!storedSelection) {
      return {
        success: false,
        error:
          "No files selected. Please select one or more files in Google Drive, then open the assistant."
      };
    }

    const fileIds = JSON.parse(storedSelection);
    const fileData = [];

    for (const id of fileIds) {
      const file = DriveApp.getFileById(id);
      const mimeType = file.getMimeType();
      let content = "";

      if (mimeType === "application/pdf") {
        try {
          const extractedText = await extractPdfTextSmart(id);

          if (typeof extractedText === "string" && extractedText.length > 0) {
            content = extractedText.substring(0, 2000);
            if (extractedText.length > 2000) {
              content += "... [truncated]";
            }
          } else {
            content = "[No text extracted]";
          }
        } catch (e) {
          Logger.log("Failed to extract text for " + id + ": " + e);
          content = "[Error extracting text]";
        }
      }

      fileData.push({
        fileId: id,
        currentName: file.getName(),
        mimeType: mimeType,
        content: content
      });
    }

    return {
      success: true,
      files: fileData
    };
  } catch (err) {
    Logger.log("Error in getSelectedFiles: " + err);
    return {
      success: false,
      error: "An internal error occurred: " + err.message
    };
  }
}


/**
 * Server-side function to rename a file.
 * Called from the React frontend via google.script.run.
 * @param {string} fileId
 * @param {string} oldName
 * @param {string} newName
 * 
 */

// This is what the frontend calls to actually change the name
function renameFile(fileId, newName) {
  try {
    const file = DriveApp.getFileById(fileId);
    var oldName = file.getName();
    file.setName(newName);
    console.log('Renamed ' + oldName + ' to ' + newName);
    return { success: true, fileId: fileId, newName: newName };
  } catch (e) {
    console.error('Rename failed for ID: ' + fileId, e);
    return { success: false, error: e.toString() };
  }
}

function testRename() {
  var newName = "20231025_Invoice-1637E153-0001.pdf;"
  var fileId = "1RAfUpq_bvTZBJA2jMTCkDsOxt9ODaqeu";
  renameFile(fileId, newName);
}


/**
 * THE "BRIDGE" (UI SERVING)
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('dist/index')
    .setTitle('DriveRenamer')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Helper to include CSS/JS files if they are separate
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


/**
 * Extracts text from a PDF in Google Drive.
 * Tries PdfApp first for native PDF text extraction, then falls back to OCR.
 *
 * @param {string} fileId - Google Drive file ID.
 * @param {number} [minTextLength=50] - Minimum length of text to consider extraction successful.
 * @returns {Promise<string>} Extracted text, or an empty string if both methods fail.
 *
 * @throws {Error} Throws if both PDF.gs and OCR extraction fail unexpectedly.
 */
 */
async function extractPdfTextSmart(fileId, minTextLength = 50) {
  const file = DriveApp.getFileById(fileId);
  const blob = file.getBlob();
  const threshold = Math.max(0, Number(minTextLength) || 50);

  try {
    if (typeof PdfApp !== "undefined" && typeof PdfApp.extractText === "function") {
      const binary = Uint8Array.from(blob.getBytes());
      const result = await PdfApp.extractText(binary);

      if (typeof result === "string") {
        const cleaned = result.trim();
        if (cleaned.length > threshold) {
          Logger.log("Used PdfApp extraction for file: " + fileId);
          return cleaned;
        }
      }

      Logger.log("PdfApp returned insufficient or non-string text for file: " + fileId);
    } else {
      Logger.log("PdfApp library is not loaded or missing extractText function.");
    }
  } catch (err) {
    Logger.log("PdfApp extraction failed for " + fileId + ": " + err);
  }

  Logger.log("Falling back to OCR extraction for file: " + fileId);
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
  let tempFileId = null;

  try {
    const resource = {
      name: "temp_ocr_" + Date.now(),
      mimeType: "application/vnd.google-apps.document"
    };

    const file = Drive.Files.create(resource, blob, {
      ocrLanguage: "en"
    });

    tempFileId = file.id;

    const doc = DocumentApp.openById(tempFileId);
    return doc.getBody().getText() || "";
  } catch (e) {
    Logger.log("OCR failed: " + e);
    return "";
  } finally {
    if (tempFileId) {
      try {
        DriveApp.getFileById(tempFileId).setTrashed(true);
      } catch (cleanupErr) {
        Logger.log("Cleanup failed: " + cleanupErr);
      }
    }
  }
}

