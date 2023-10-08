const INFO_DENSITY = 1;
const INFO_PRINTSPEED = 2;
const INFO_LABELTYPE = 3;
const INFO_LANGUAGETYPE = 6;
const INFO_AUTOSHUTDOWNTIME = 7;
const INFO_DEVICETYPE = 8;
const INFO_SOFTVERSION = 9;
const INFO_BATTERY = 10;
const INFO_DEVICESERIAL = 11;
const INFO_HARDVERSION = 12;

const CMD_GET_INFO = 64; // 0x40
const CMD_GET_RFID = 26; // 0x1A
const CMD_HEARTBEAT = 220; // 0xDC
const CMD_SET_LABEL_TYPE = 35; // 0x23
const CMD_SET_LABEL_DENSITY = 33; // 0x21
const CMD_START_PRINT = 1; // 0x01
const CMD_END_PRINT = 243; // 0xF3
const CMD_START_PAGE_PRINT = 3; // 0x03
const CMD_END_PAGE_PRINT = 227; // 0xE3
const CMD_ALLOW_PRINT_CLEAR = 32; // 0x20
const CMD_SET_DIMENSION = 19; // 0x13
const CMD_SET_QUANTITY = 21; // 0x15
const CMD_GET_PRINT_STATUS = 163; // 0xA3
const CMD_IMAGE_SET = 131; // 0x83 // 0006 
const CMD_IMAGE_CLEAR = 132;
const CMD_IMAGE_DATA = 133; // 0x85
const CMD_IMAGE_RECEIVED = 0xD3; // ushort offset, byte last line

// Niimbot D11 has 203 DPI (https://www.niimbotlabel.com/products/niimbot-d11-label-maker)
function niimbotMmToPx(x) {
    return Math.ceil(x / 25.4 * 203);
}

function niimbotPxToMM(x) {
  return Math.floor(x / 203 * 25.4);
}

async function niimbotGetRFID() {
  return niimbotTransceivePacket(CMD_GET_RFID, [1]).then(data => {
    if (data[0] == 0)
      return;

    const uuid = data.splice(0, 8);
    const barcode = data.splice(0, data.shift());
    const serial = data.splice(0, data.shift());
    let totalLen = data.shift() * 256;
    totalLen += data.shift();
    let usedLen = data.shift() * 256;
    usedLen += data.shift();
    let type = data.shift();
    return {
      'uuid': arrayToHexString(uuid),
      'barcode': intArrayToString(barcode),
      'serial': intArrayToString(serial),
      'total_len': totalLen,
      'used_len': usedLen,
      'type': type
    };
  });
}

async function niimbotGetInfoForType(type) {
  return niimbotTransceivePacket(CMD_GET_INFO, [type], type).then(data => {
    switch (type) {
    case INFO_DEVICESERIAL:
      return arrayToHexString(data);

    // case InfoEnum.SOFTVERSION:
    //     return _packet_to_int(packet) / 100
    // case InfoEnum.HARDVERSION:
    //     return _packet_to_int(packet) / 100
    // case _:
    //     return _packet_to_int(packet)

    default:
      return arrayToHexString(data);
    }
  });
}

async function niimbotGetInfo() {
  let sw = niimbotGetInfoForType(INFO_SOFTVERSION);
  let hw = sw.then(_ => niimbotGetInfoForType(INFO_HARDVERSION));
  let sn = hw.then(_ => niimbotGetInfoForType(INFO_DEVICESERIAL));

  return Promise.all([sw, hw, sn]).then(values => {
    return {
      "SW": values[0],
      "HW": values[1],
      "S/N": values[2]
    };
  });
}

async function niimbotGetHeartbeat() {
  return niimbotTransceivePacket(CMD_HEARTBEAT, [1]).then(data => {
    switch (data.length) {
      case 20:
        return {
          'paperstate': data.at(-2),
          'rfidreadstate': data.at(-1)
        };

      case 13:
      case 19:
        return {
          'closingstate': data.at(-4),
          'powerlevel': data.at(-3),
          'paperstate': data.at(-2),
          'rfidreadstate': data.at(-1)
        };

      case 10:
        return {
          'closingstate': data.at(-2),
          'powerlevel': data.at(-1),
          'rfidreadstate': data.at(-2)
        };

      case 9:
        return {
          'closingstate': data.at(-1)
        };

      default:
        return {};
    }
  });
}

async function niimbotSetLabelType(n) {
  console.assert(1 <= n && n <= 3);
  return niimbotTransceivePacket(CMD_SET_LABEL_TYPE, [n], 16).then(data => data[0]);
}

async function niimbotSetLabelDensity(n) {
  console.assert(1 <= n && n <= 3);
  return niimbotTransceivePacket(CMD_SET_LABEL_DENSITY, [n], 16).then(data => data[0]);
}

async function niimbotStartPrint() {
  return niimbotTransceivePacket(CMD_START_PRINT, [1]).then(data => data[0]);
}

async function niimbotEndPrint() {
  return niimbotTransceivePacket(CMD_END_PRINT, [1]).then(data => data[0]);
}

async function niimbotStartPagePrint() {
  return niimbotTransceivePacket(CMD_START_PAGE_PRINT, [1]).then(data => data[0]);
}

async function niimbotEndPagePrint() {
  return niimbotTransceivePacket(CMD_END_PAGE_PRINT, [1]).then(data => data[0]);
}

async function niimbotAllowPrintClear() {
  return niimbotTransceivePacket(CMD_ALLOW_PRINT_CLEAR, [1], 16).then(data => data[0]);
}

async function niimbotSetLabelDimensions(w, h) {
  console.assert(1 <= w && w <= niimbotMmToPx(15));
  console.assert(1 <= h && h <= niimbotMmToPx(75));
  return niimbotTransceivePacket(CMD_SET_DIMENSION, [
    Math.floor(h / 256), h % 256,
    Math.floor(w / 256), w % 256
  ]).then(data => data[0]);
}

async function niimbotSetPrintQuality(n) {
  return niimbotTransceivePacket(CMD_SET_QUANTITY, [Math.floor(n / 256), n % 256]).then(data => data[0]);
}

async function niimbotGetPrintStatus(n) {
  return niimbotTransceivePacket(CMD_GET_PRINT_STATUS, [1], 16).then(data => {
    return {
      "page": data[0] * 256 + data[1],
      "progress1": data[2],
      "progress2": data[3]
    };
  });
}

function niimbotPacketClear(y, n = 1) {
  let buffer = [];
  buffer.push(Math.floor(y / 256));
  buffer.push(y % 256);
  buffer.push(n);

  return niimbotToPacket(CMD_IMAGE_CLEAR, buffer);
}

function niimbotPacketImageData(y, w, data, n = 1) {
  let buffer = [];
  buffer.push(Math.floor(y / 256));
  buffer.push(y % 256);

  // add a list of bytes count
  for (let x = 0; x < w; x += 32) {
    let bits = 0;
    for (let b = 0; b < 32; b++)
      if (data[x + b])
        bits++;
    buffer.push(bits);
  }
  buffer.push(n);

  // encode bool map to bits map
  for (let x = 0; x < w; x += 8) {
    let bits = 0;
    for (let b = 0; b < 8; b++)
      if (data[x + b])
        bits |= 1<<(7-b);
    buffer.push(bits);
  }

  return niimbotToPacket(CMD_IMAGE_DATA, buffer);
}

async function niimbotSendImage(w, h, data, sliceSize = 200) {
  let promise = Promise.resolve();

  for (let slice_y = 0; slice_y < h; slice_y += sliceSize) {
    const slice_h = Math.min(h, slice_y + sliceSize);

    let packet = [];

    for (let y = slice_y; y < slice_h; ) {
      const line_y = y;
      lineData = data.slice(y * w, (y+1) * w);

      while (++y < slice_h) {
        nextLineData = data.slice(y * w, (y+1) * w);
        if (lineData.toString() != nextLineData.toString())
          break;
      }

      if (lineData.every(pixel => pixel == 0)) {
        packet.push(...niimbotPacketClear(line_y, y - line_y));
      } else {
        packet.push(...niimbotPacketImageData(line_y, w, lineData, y - line_y));
      }
    }

    promise = promise.then(_ => niimbotTransceiveRawData(packet, CMD_IMAGE_RECEIVED));
  }

  return promise;
}

async function niimbotWaitForPrintComplete(q) {
  return new Promise((resolve, reject) => {
    let process = function(status) {
      log(status);

      if (status["page"] == q)
        return resolve();

      setTimeout(function() {
        niimbotGetPrintStatus().then(process);
      }, 0.1);
    };

    niimbotGetPrintStatus().then(process);
  });
}

async function niimbotPrintImage(w, h, data, q = 1, type = 1, density = 2) {
  log(`Printing image: ${w}x${h}, ${q}q, ${type} type, ${density} density`);
  return niimbotSetLabelType(type)
    .then(_ => niimbotSetLabelType(type)) // 1-3
    .then(_ => niimbotSetLabelDensity(density)) // 1-3
    .then(_ => niimbotStartPrint())
    .then(_ => niimbotAllowPrintClear())
    .then(_ => niimbotStartPagePrint())
    .then(_ => niimbotSetLabelDimensions(w, h))
    .then(_ => niimbotSetPrintQuality(q))
    .then(_ => niimbotSendImage(w, h, data))
    .then(_ => niimbotEndPagePrint())
    .then(_ => niimbotWaitForPrintComplete(q))
    .then(_ => niimbotEndPrint())
    .then(_ => `Printed ${w}x${h}, ${q}q, ${type} type, ${density} density`);
}
