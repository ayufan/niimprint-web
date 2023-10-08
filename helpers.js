function log(data) {
  console.log("LOG: " + to_string(data));

  const logEl = document.getElementById('log');
  if (logEl) {
    logEl.textContent += to_string(data) + "\n";
    if (logEl.selectionStart == logEl.selectionEnd) {
      logEl.scrollTop = logEl.scrollHeight;
    }
  }
}

function set_content(data, responseId = 'content') {
  log(data);

  const responseEl = document.getElementById(responseId);
  if (responseEl) {
    responseEl.textContent = to_string(data);
  }
}

async function async_content(promise) {
  promise
    .then(data => set_content(data))
    .catch(error => set_content(error));
}

function to_string(data) {
  if (typeof data === 'string' || data instanceof String)
    return data;
  else if (data instanceof Error)
    return data.toString();
  else
    return JSON.stringify(data);
}

function buffer_to_array(buffer) {
  let a = [];
  for (let i = 0; i < buffer.byteLength; i++)
    a.push(buffer.getUint8(i));
  return a;
}

function buffer_to_hex(array, join='') {
  return array.map(el => ('00' + el.toString(16)).slice(-2)).join(join);
}

function buffer_to_string(array) {
  return array.map(el => String.fromCharCode(el)).join('');
}
