/**
 * Минимальная совместимость generated canonical runtime с Google Apps Script V8.
 *
 * Node-only `Buffer.byteLength(..., 'utf8')` используется внутри canonical
 * DASH-084 configuration size guard. В Apps Script глобального Buffer нет, поэтому
 * без этого адаптера DASH-090 catalog/clone/save падают до выполнения продуктового
 * сценария. Адаптер не хранит данные, не выполняет финансовые расчёты и не меняет
 * FIN-TRUTH; он предоставляет только deterministic UTF-8 byte length.
 */
var PRH_APPS_SCRIPT_NODE_COMPAT = Object.freeze({
  SCHEMA: 'PRH_APPS_SCRIPT_NODE_COMPAT_V1',
  VERSION: '1.0.0',
  FINANCIAL_WRITE: false,
  QUERY_EXECUTION: false,
  FREE_ONLY: true
});

function prhUtf8ByteLength_(value) {
  var text = String(value == null ? '' : value);
  var bytes = 0;
  for (var index = 0; index < text.length; index += 1) {
    var code = text.charCodeAt(index);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xD800 && code <= 0xDBFF && index + 1 < text.length) {
      var low = text.charCodeAt(index + 1);
      if (low >= 0xDC00 && low <= 0xDFFF) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

if (typeof Buffer === 'undefined') {
  Buffer = Object.freeze({
    byteLength: function(value, encoding) {
      var normalized = String(encoding || 'utf8').toLowerCase().replace(/-/g, '');
      if (normalized !== 'utf8') throw new Error('PRH_BUFFER_COMPAT_ENCODING_UNSUPPORTED');
      return prhUtf8ByteLength_(value);
    }
  });
}
