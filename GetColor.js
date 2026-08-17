function GetColor(input) {
  var myFormula = SpreadsheetApp.getActiveRange().getFormula();
  var myAddress = myFormula.replace(/.*GetColor\(/gi, '').replace(/\).*/gi, '');
  var myRange = SpreadsheetApp.getActiveSheet().getRange(myAddress);
  return myRange.getBackgrounds();
 }