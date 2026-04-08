/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

function onHomepage(e) {
  return createRenameCard();
}

function onItemsSelected(e) {
  return createRenameCard(e.drive.activeCursorItem);
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
 * CardService UI for Drive context.
 * @returns {GoogleAppsScript.Card_Service.Card}
 */
function buildMainCard() {
  const card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader().setTitle('DriveRename AI'));

  const section = CardService.newCardSection();
  section.addWidget(CardService.newTextParagraph().setText('Launch the AI Assistant to organize your files.'));

  const action = CardService.newAction().setFunctionName('showSidebar');
  section.addWidget(CardService.newTextButton().setText('Open Sidebar').setOnClickAction(action));

  card.addSection(section);
  return card.build();
}



/**
 * Shows the sidebar with the Vite-hosted React app.
 * This function is called when the user clicks the add-on icon.
 * @returns {void|GoogleAppsScript.Card_Service.ActionResponse}
 */
function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('index')
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
      .setNavigation(CardService.newNavigation().pushCard(buildMainCard()))
      .build();
  }
}


/**
 * Retrieves metadata for the files currently selected by the user in the Google Drive UI.
 * * @param {Object} [e] The event object provided by the Google Workspace Add-on trigger.
 * @param {Object} [e.drive] The Drive-specific event data.
 * @param {Array<Object>} [e.drive.selectedItems] An array of items selected by the user.
 * * @returns {Object} An object containing a success flag and either the file data or an error message.
 * @returns {boolean} return.success True if files were successfully retrieved.
 * @returns {Array<{fileId: string, currentName: string, mimeType: string}>} [return.files] The metadata of selected files.
 * @returns {string} [return.error] The error message if the operation failed.
 */
function getSelectedFiles(e) {
  try {
    var items = [];
    
    // Check if the event object contains the expected Drive selection data
    if (e && e.drive && e.drive.selectedItems && e.drive.selectedItems.length > 0) {
      items = e.drive.selectedItems;
    } else {
      return { 
        success: false, 
        error: "No files selected. Please select one or more files in Google Drive to begin." 
      };
    }

    /** @type {Array<{fileId: string, currentName: string, mimeType: string}>} */
    var fileData = items.map(function(item) {
      return {
        fileId: item.id,
        currentName: item.title, // 'title' is the property used in Workspace Add-on event objects
        mimeType: item.mimeType
      };
    });

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


/**
 * THE "BRIDGE" (UI SERVING)
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index.html')
    .setTitle('Gemini Drive Renamer')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Helper to include CSS/JS files if they are separate
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


