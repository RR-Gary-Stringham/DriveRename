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


/**
 * Retrieves metadata and content for the files. Called from React via google.script.run.
 * No parameters needed — it reads from UserProperties.
 */
async function getSelectedFiles() {
  try {
    const storedSelection = PropertiesService.getUserProperties().getProperty('LATEST_SELECTION');
    
    if (!storedSelection) {
      return { 
        success: false, 
        error: "No files selected. Please select one or more files in Google Drive, then open the assistant." 
      };
    }

    const fileIds = JSON.parse(storedSelection);
    
    // Convert the IDs back into file metadata using DriveApp
    const fileDataPromises = fileIds.map(async function(id) {
      const file = DriveApp.getFileById(id);
      const mimeType = file.getMimeType();
      let content = "";

      if (mimeType === "application/pdf") {
        try {
          // Extract text from PDF
          const extractedText = await extractPdfTextSmart(id);
          if (extractedText) {
            // Limit to 2000 characters to keep prompt size reasonable
            content = extractedText.substring(0, 2000);
            if (extractedText.length > 2000) {
              content += "... [truncated]";
            }
          }
        } catch (e) {
          console.error("Failed to extract text for " + id + ": " + e.toString());
          content = "[Error extracting text]";
        }
      }

      return {
        fileId: id,
        currentName: file.getName(),
        mimeType: mimeType,
        content: content
      };
    });

    const fileData = await Promise.all(fileDataPromises);

    return { 
      success: true, 
      files: fileData 
    };

  } catch (err) {
    console.error("Error in getSelectedFiles: " + err.toString());
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
