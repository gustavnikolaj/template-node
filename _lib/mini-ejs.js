const vm = require('vm');

function createTextToken(value) {
  return {
    type: 'text',
    value
  }
}
function createPrintToken(value, trim) {
  return {
    type: 'print',
    value,
    trim
  }
}
function createCodeToken(value, trim) {
  return {
    type: 'code',
    value,
    trim
  }
}

function tokenize(str) {
  const segments = str.split(/(<%-?=?|-?%>)/g);
  const tokens = [];

  for (let i = 0; i < segments.length ; i++) {
    if (segments[i] === '<%' || segments[i] === "<%-") {
      let trimBackwards = segments[i] === "<%-";
      let trimForward = false;
      if (segments[i+2] === '-%>') {
        trimForward = true;
      } else if (segments[i+2] !== '%>') {
        throw new Error('Unclosed <%= expression, missing %>');
      }

      tokens.push(createCodeToken(segments[i + 1], { backwards: trimBackwards, forward: trimForward }));
      i = i + 2;
    } else if (segments[i] === '<%=' || segments[i] === "<%-=") {
      let trimBackwards = segments[i] === "<%-=";
      let trimForward = false;
      if (segments[i+2] === '-%>') {
        trimForward = true;
      } else if (segments[i+2] !== '%>') {
        throw new Error('Unclosed <%= expression, missing %>');
      }

      tokens.push(createPrintToken(segments[i + 1], { backwards: trimBackwards, forward: trimForward }));
      i = i + 2;
    } else {
      tokens.push(createTextToken(segments[i]))
    }
  }

  return tokens;
}

function compileTemplate(str) {
  const tokens = tokenize(str);

  // Process trim instructions
  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i];

    if (token.type === 'text') {
      continue;
    }

    if (token.trim && token.trim.forward && i < tokens.length - 1 && tokens[i+1].type === 'text') {
      tokens[i+1].value = tokens[i+1].value.replace(/^\s*/, '');
    }

    if (token.trim && token.trim.backwards && i > 0 && tokens[i-1].type === 'text') {
      tokens[i-1].value = tokens[i-1].value.replace(/\s*$/, '');
    }
  };

  const evalSegments = tokens.map(token => {
    if (token.type === 'print') {
      return `o += ${token.value}`;
    } else if (token.type === 'code') {
      return `${token.value}`;
    } else {
      return `o += "${token.value.replace(/"/g, '\\"').replace(/\r?\n/g, '\\n')}"`;
    }
  });

  return evalSegments.join(';');
}

module.exports = function miniEjs(str, data) {
  const code = compileTemplate(str);
  const context = { o: "", ...data };

  vm.createContext(context);
  vm.runInContext(code, context);

  return context.o;
}
