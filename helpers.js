function toResponseString(data) {
  if (typeof data === 'string' || data instanceof String)
    return data;
  else if (data instanceof Error)
    return data.toString();
  else
    return JSON.stringify(data);
}

function log(context, data) {
  const line = context + ": " + toResponseString(data);
  console.log(line);

  const logEl = document.getElementById('log');
  if (logEl) {
    logEl.textContent += line + "\n";
    if (logEl.selectionStart == logEl.selectionEnd) {
      logEl.scrollTop = logEl.scrollHeight;
    }
  }
}

function setResponse(data, context = 'RESP') {
  log(context, data);

  const responseEl = document.getElementById('response');
  if (responseEl) {
    responseEl.textContent = toResponseString(data);
  }
}

async function setAsyncResponse(promise, context = 'RESP') {
  promise
    .then(data => setResponse(data, context))
    .catch(error => setResponse(error, context));
}

function byteArrayToArray(buffer) {
  let a = [];
  for (let i = 0; i < buffer.byteLength; i++)
    a.push(buffer.getUint8(i));
  return a;
}

function arrayToHexString(array, join='') {
  return array.map(el => ('00' + el.toString(16)).slice(-2)).join(join);
}

function intArrayToString(array) {
  return array.map(el => String.fromCharCode(el)).join('');
}

function ushortToByteArray(value) {
  console.assert(0 <= value && value <= 65535);
  return [Math.floor(value / 256), value % 256];
}
