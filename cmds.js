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
const CMD_IMAGE_DATA3 = 131; // 0x83 // 0006 
const CMD_IMAGE_DATA2 = 132; // 0x84? Resp. 0xD3, 153 bytes, 2191 = 143+8*256 // 0000 06
const CMD_IMAGE_CLEAR = 132;
const CMD_IMAGE_DATA = 133; // 0x85

// Niimbot D11 has 203 DPI (https://www.niimbotlabel.com/products/niimbot-d11-label-maker)
function mm_to_px(x) {
    return Math.ceil(x / 25.4 * 203);
}

function px_to_mm(x) {
  return Math.floor(x / 203 * 25.4);
}

async function get_rfid() {
  return transceive_packet(CMD_GET_RFID, [1]).then(data => {
    if (data[0] == 0)
      return;

    const uuid = data.splice(0, 8);
    const barcode = data.splice(0, data.shift());
    const serial = data.splice(0, data.shift());
    let total_len = data.shift() * 256;
    total_len += data.shift();
    let used_len = data.shift() * 256;
    used_len += data.shift();
    let type = data.shift();
    return {
      'uuid': buffer_to_hex(uuid),
      'barcode': buffer_to_string(barcode),
      'serial': buffer_to_string(serial),
      'total_len': total_len,
      'used_len': used_len,
      'type': type
    };
  });
}

async function get_info_type(type) {
  return transceive_packet(CMD_GET_INFO, [type], type).then(data => {
    switch (type) {
    case INFO_DEVICESERIAL:
      return buffer_to_hex(data);

    // case InfoEnum.SOFTVERSION:
    //     return _packet_to_int(packet) / 100
    // case InfoEnum.HARDVERSION:
    //     return _packet_to_int(packet) / 100
    // case _:
    //     return _packet_to_int(packet)

    default:
      return buffer_to_hex(data);
    }
  });
}

async function get_info() {
  let sw = get_info_type(INFO_SOFTVERSION);
  let hw = get_info_type(INFO_HARDVERSION);
  let sn = get_info_type(INFO_DEVICESERIAL);

  return Promise.all([sw, hw, sn]).then(values => {
    return {
      "SW": values[0],
      "HW": values[1],
      "S/N": values[2]
    };
  });
}

async function get_heartbeat() {
  return transceive_packet(CMD_HEARTBEAT, [1]).then(data => {
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

async function set_label_type(n) {
  console.assert(1 <= n && n <= 3);
  return transceive_packet(CMD_SET_LABEL_TYPE, [n], 16).then(data => data[0]);
}

async function set_label_density(n) {
  console.assert(1 <= n && n <= 3);
  return transceive_packet(CMD_SET_LABEL_DENSITY, [n], 16).then(data => data[0]);
}

async function start_print() {
  return transceive_packet(CMD_START_PRINT, [1]).then(data => data[0]);
}

async function end_print() {
  return transceive_packet(CMD_END_PRINT, [1]).then(data => data[0]);
}

async function start_page_print() {
  return transceive_packet(CMD_START_PAGE_PRINT, [1]).then(data => data[0]);
}

async function end_page_print() {
  return transceive_packet(CMD_END_PAGE_PRINT, [1]).then(data => data[0]);
}

async function allow_print_clear() {
  return transceive_packet(CMD_ALLOW_PRINT_CLEAR, [1], 16).then(data => data[0]);
}

async function set_dimension(w, h) {
  console.assert(1 <= w && w <= mm_to_px(15));
  console.assert(1 <= h && h <= mm_to_px(75));
  return transceive_packet(CMD_SET_DIMENSION, [
    Math.floor(w / 256), w % 256,
    Math.floor(h / 256), h % 256
  ]).then(data => data[0]);
}

async function set_quantity(n) {
  return transceive_packet(CMD_SET_DIMENSION, [Math.floor(n / 256), n % 256]).then(data => data[0]);
}

async function get_print_status(n) {
  return transceive_packet(CMD_GET_PRINT_STATUS, [1], 16).then(data => {
    return {
      "page": data[0] * 256 + data[1],
      "progress1": data[2],
      "progress2": data[3]
    };
  });
}

function packet_line_clear(y, n = 1) {
  let buffer = [];
  buffer.push(Math.floor(y / 256));
  buffer.push(y % 256);
  buffer.push(n);

  return to_packet(CMD_IMAGE_CLEAR, buffer);
}

function packet_line_data(y, w, line_data, n = 1) {
  let buffer = [];
  buffer.push(Math.floor(y / 256));
  buffer.push(y % 256);

  // add a list of bytes count
  for (let x = 0; x < w; x += 32) {
    let bits = 0;
    for (let b = 0; b < 32; b++)
      if (line_data[x + b])
        bits++;
    buffer.push(bits);
  }
  buffer.push(n);

  // encode bool map to bits map
  for (let x = 0; x < w; x += 8) {
    let bits = 0;
    for (let b = 0; b < 8; b++)
      if (line_data[x + b])
        bits |= 1<<(7-b);
    buffer.push(bits);
  }

  return to_packet(CMD_IMAGE_DATA, buffer);
}

async function send_image(w, h, data) {
  let packet = [];

  const max_n = 1; // 255;

  for (let y = 0; y < h;) {
    const line_y = y;
    line_data = data.slice(y * w, (y+1) * w);

    // for ( ; y++ < h && y - line_y < max_n; ) {
    //   next_line_data = data.slice(y * w, (y+1) * w);
    //   if (line_data.toString() != next_line_data.toString())
    //     break;
    // }
    y++;

    if (line_data.every(pixel => pixel == 0)) {
     packet.push(...packet_line_clear(line_y, y - line_y));
    } else {
      packet.push(...packet_line_data(line_y, w, line_data, y - line_y));
    }
  }

  return send_rawdata(packet);
}

async function wait_for_quantity(q) {
  return new Promise((resolve, reject) => {
    let process = function(status) {
      if (status["page"] == q)
        return resolve();

      log(status);

      setTimeout(function() {
        get_print_status().then(process);
      }, 0.1);
    };

    get_print_status().then(process);
  });
}

async function print_image(w, h, data, q = 1, type = 1, density = 2) {
  log(`Printing image: ${w}x${h}, ${q}q, ${type} type, ${density} density`);
  return set_label_type(type)
    .then(_ => set_label_type(type)) // 1-3
    .then(_ => set_label_density(density)) // 1-3
    .then(_ => start_print())
    .then(_ => allow_print_clear())
    .then(_ => start_page_print())
    .then(_ => set_dimension(w, h))
    .then(_ => set_quantity(q))
    .then(_ => send_image(w, h, data))
    .then(_ => end_page_print())
    .then(_ => wait_for_quantity(q))
    .then(_ => end_print())
    .then(_ => `Printed ${w}x${h}, ${q}q, ${type} type, ${density} density`);
}
