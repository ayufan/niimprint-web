// Taken from: https://leimao.github.io/blog/HTML-Canvas-Mouse-Touch-Drawing/
let canvas;
let canvasContext;
let isDrawing = false;
let x = 0;
let y = 0;
var offsetX;
var offsetY;

document.addEventListener("DOMContentLoaded", _ => {
  canvas = document.getElementById('canvas');
  canvasContext = canvas.getContext('2d');

  canvas.addEventListener('touchstart', handleStart);
  canvas.addEventListener('touchend', handleEnd);
  canvas.addEventListener('touchcancel', handleCancel);
  canvas.addEventListener('touchmove', handleMove);
  canvas.addEventListener('mousedown', (e) => {
    x = e.offsetX;
    y = e.offsetY;
    isDrawing = true;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (isDrawing) {
      drawLine(canvasContext, x, y, e.offsetX, e.offsetY);
      x = e.offsetX;
      y = e.offsetY;
    }
  });

  canvas.addEventListener('mouseup', (e) => {
    if (isDrawing) {
      drawLine(canvasContext, x, y, e.offsetX, e.offsetY);
      x = 0;
      y = 0;
      isDrawing = false;
    }
  });
});

const ongoingTouches = [];

function handleStart(evt) {
  evt.preventDefault();
  const touches = evt.changedTouches;
  offsetX = canvas.getBoundingClientRect().left;
  offsetY = canvas.getBoundingClientRect().top;
  for (let i = 0; i < touches.length; i++) {
    ongoingTouches.push(copyTouch(touches[i]));
  }
}

function handleMove(evt) {
  evt.preventDefault();
  const touches = evt.changedTouches;
  for (let i = 0; i < touches.length; i++) {
    const color = 'black';
    const idx = ongoingTouchIndexById(touches[i].identifier);
    if (idx >= 0) {
      canvasContext.beginPath();
      canvasContext.moveTo(ongoingTouches[idx].clientX - offsetX, ongoingTouches[idx].clientY - offsetY);
      canvasContext.lineTo(touches[i].clientX - offsetX, touches[i].clientY - offsetY);
      canvasContext.lineWidth = document.getElementById('canvas_line_width').value;
      canvasContext.strokeStyle = color;
      canvasContext.lineJoin = "round";
      canvasContext.closePath();
      canvasContext.stroke();
      ongoingTouches.splice(idx, 1, copyTouch(touches[i]));  // swap in the new touch record
    }
  }
}

function handleEnd(evt) {
  evt.preventDefault();
  const touches = evt.changedTouches;
  for (let i = 0; i < touches.length; i++) {
    const color = 'black';
    let idx = ongoingTouchIndexById(touches[i].identifier);
    if (idx >= 0) {
      canvasContext.lineWidth = document.getElementById('canvas_line_width').value;
      canvasContext.fillStyle = color;
      ongoingTouches.splice(idx, 1);  // remove it; we're done
    }
  }
}

function handleCancel(evt) {
  evt.preventDefault();
  const touches = evt.changedTouches;
  for (let i = 0; i < touches.length; i++) {
    let idx = ongoingTouchIndexById(touches[i].identifier);
    ongoingTouches.splice(idx, 1);  // remove it; we're done
  }
}

function copyTouch({ identifier, clientX, clientY }) {
  return { identifier, clientX, clientY };
}

function ongoingTouchIndexById(idToFind) {
  for (let i = 0; i < ongoingTouches.length; i++) {
    const id = ongoingTouches[i].identifier;
    if (id === idToFind) {
      return i;
    }
  }
  return -1;    // not found
}

function drawLine(canvasContext, x1, y1, x2, y2) {
  canvasContext.beginPath();
  canvasContext.strokeStyle = 'black';
  canvasContext.lineWidth = document.getElementById('canvas_line_width').value;
  canvasContext.lineJoin = "round";
  canvasContext.moveTo(x1, y1);
  canvasContext.lineTo(x2, y2);
  canvasContext.closePath();
  canvasContext.stroke();
}

function clearArea() {
  canvasContext.setTransform(1, 0, 0, 1, 0, 0);
  canvasContext.clearRect(0, 0, canvasContext.canvas.width, canvasContext.canvas.height);
}
