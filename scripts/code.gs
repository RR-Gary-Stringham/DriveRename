/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Adds a custom menu to the Google Drive UI (if applicable) or Spreadsheet/Doc.
 * For a Drive Add-on, this is usually handled via the manifest.
 */
function onOpen() {
  // Trigger scope request
  try {
    DriveApp.getFiles();
  } catch (e) {
    console.error('Scope initialization failed:', e);
  }
}

/**
 * Shows the sidebar with the Vite-hosted React app.
 * This function is called when the user clicks the add-on icon.
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
 * Server-side function to rename a file.
 * Called from the React frontend via google.script.run.
 * @param {string} fileId
 * @param {string} newName
 */
function renameFile(fileId, newName) {
  try {
    const file = DriveApp.getFileById(fileId);
    file.setName(newName);
    return { success: true, fileId: fileId, newName: newName };
  } catch (e) {
    console.error('Rename failed for ID: ' + fileId, e);
    return { success: false, error: e.toString() };
  }
}

/**
 * Example CardService UI for Drive context.
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
