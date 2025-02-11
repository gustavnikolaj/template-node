const vm = require('vm');

function compileTemplate(str) {
  const segments = str.split(/(<%=?|-?%>)/g);
  let STATES = { IN_TEXT: 0, IN_JS: 1, IN_PRINT: 2 }
  let STATE = STATES.IN_TEXT;
  let TRIM_NEXT_NEWLINE = false;

  const evalSegments = [];
  for (const segment of segments) {
    if (STATE === STATES.IN_TEXT) {
      if (segment === "<%") {
        STATE = STATES.IN_JS;
      } else if (segment === "<%=") {
        STATE = STATES.IN_PRINT;
      } else {
        let processedSegment = segment
        if (TRIM_NEXT_NEWLINE) {
          processedSegment = segment.replace(/^\s+/, '');
          TRIM_NEXT_NEWLINE = false
        }
        processedSegment = processedSegment.replace(/"/g, '\\"').replace(/\r?\n/g, '\\n')
        evalSegments.push(`o += "${processedSegment}";`);
      }
    } else if (STATE === STATES.IN_JS) {
      if (segment === "<%") {
        throw new Error('Parse error: <% inside <% found.');
      } else if (segment === "<%=") {
        throw new Error('Parse error: <%= inside <% found.');
      } else if (segment === "-%>") {
        STATE = STATES.IN_TEXT;
        TRIM_NEXT_NEWLINE = true;
      } else if (segment === "%>") {
        STATE = STATES.IN_TEXT;
      } else {
        evalSegments.push(segment, ';');
      }
    } else if (STATE === STATES.IN_PRINT) {
      if (segment === "<%") {
        throw new Error('Parse error: <% inside <%= found.');
      } else if (segment === "<%=") {
        throw new Error('Parse error: <%= inside <%= found.');
      } else if (segment === "-%>") {
        STATE = STATES.IN_TEXT;
        TRIM_NEXT_NEWLINE = true;
      } else if (segment === "%>") {
        STATE = STATES.IN_TEXT;
      } else {
        evalSegments.push(`o += ${segment}`, ';');
      }
    } else {
      throw new Error('Unknown state');
    }
  }

  if (STATE !== STATES.IN_TEXT) {
    throw new Error('Invalid template. Unterminated template expression.')
  }

  return evalSegments.join(';');
}

module.exports = function miniEjs(str, data) {
  const code = compileTemplate(str);
  const context = { o: "", ...data };

  vm.createContext(context);
  vm.runInContext(code, context);

  return context.o;
}
