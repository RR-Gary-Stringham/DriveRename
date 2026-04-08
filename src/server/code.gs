function onHomepage(e) {
  return createRenameCard(); 
}

// This function actually renames the file in Drive
function renameFile(fileId, newName) {
  try {
    var file = DriveApp.getFileById(fileId);
    file.setName(newName);
    return "Success";
  } catch (e) {
    return "Error: " + e.toString();
  }
}

// This serves your Vite app inside the sidebar
function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('index')
      .setTitle('Gemini Renamer')
      .setWidth(300);
  SpreadsheetApp.getUi().showSidebar(html);
}