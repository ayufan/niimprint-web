const BLE_UART_UUID = "49535343-fe7d-4ae5-8fa9-9fafd205e455";
const BLE_UART_TX_CH_UUID = "49535343-1e4d-4bd9-ba61-23c647249616";
const BLE_UART_RX_CH_UUID = "49535343-8841-43f4-a8d4-ecbe34729bb3";

const BLE_THERM_UUID = "e7810a71-73ae-499d-8c15-faa9aef0c3f2";
const BLE_THERM_CH_UUID = "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f";

let bluetoothOptions = {
  filters: [
    { namePrefix: "D" },
    // { services: [BLE_UART_UUID] },
    { services: [BLE_THERM_UUID] }
  ]
};

var bluetooth = {};

function niimbotToPacket(type, data) {
  let packet = [type, data.length].concat(data);

  checksum = 0;
  packet.forEach(byte => checksum ^= byte);

  // add header: 2x 0x55
  packet.unshift(0x55);
  packet.unshift(0x55);

  // add footer: checksum + 2x 0xAA
  packet.push(checksum);
  packet.push(0xaa);
  packet.push(0xaa);

  return packet;
}

function niimbotFromPacket(packet) {
  packet = byteArrayToArray(packet);

  if (packet.shift() != 0x55 || packet.shift() != 0x55)
    return [];
  if (packet.pop() != 0xAA || packet.pop() != 0xAA)
    return [];

  checksum = packet.pop();
  packet.forEach(byte => checksum ^= byte);
  if (checksum != 0)
    return [];

  type = packet.shift();
  len = packet.shift();
  if (packet.length != len)
    return [];

  return [type, packet];
}

async function niimbotReceivePacket() {
  return new Promise((resolve, reject) => {
    log("RX", "Waiting for recv.");
    bluetooth["rx"].addEventListener('characteristicvaluechanged', event => {
      log("RX", byteArrayToArray(event.target.value));
      resolve(niimbotFromPacket(event.target.value));
    }, { "once": true });

    setTimeout(() => {
      reject("RX: timeout");
    }, 1000);
  });
}

async function niimbotSendRawData(data, chunkSize = 150) {
  promise = Promise.resolve();

  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);

    log("TX", "Sending... " + chunk);
    promise = promise.then(_ => bluetooth["tx"].writeValueWithoutResponse(new Uint8Array(chunk)))
      .then(_ => log("TX", "Sent."));
  }

  return promise;
}

async function niimbotTransceiveRawData(data, respType, chunkSize = 150) {
  let process = function([recvType, recvData]) {
    if (recvType == 219)
      throw "error";
    else if (recvType == 0)
      throw "not implemented";
    else if (recvType == respType)
      return recvData;
    else
      return niimbotReceivePacket().then(process);
  };

  let recv = niimbotReceivePacket().then(process);
  let send = niimbotSendRawData(data, chunkSize);

  return Promise.all([send, recv]).then(values => values[1]);
}

async function niimbotTransceivePacket(type, data, recv_offset = 1) {
  return niimbotTransceiveRawData(niimbotToPacket(type, data), type + recv_offset);
}

async function niimbotConnect() {
  return navigator.bluetooth.requestDevice(bluetoothOptions).then(device => {
    log("BT", `Device: ${device.name}`);
    bluetooth["device"] = device;

    log("BT", 'Connecting to GATT Server...');
    return device.gatt.connect();
  }).then(server => {
    bluetooth["gatt"] = server;
    log("BT", `Getting the ${BLE_THERM_UUID}...`);
    return server.getPrimaryService(BLE_THERM_UUID);
  }).then(service => {
    bluetooth["service"] = service;
    log("BT", `Getting the ${BLE_THERM_CH_UUID}...`);
    return service.getCharacteristic(BLE_THERM_CH_UUID);
  }).then(ch => {
    bluetooth["tx"] = ch;
    bluetooth["rx"] = ch;
    log("BT", `Listening for notifications...`);
    return ch.startNotifications();
  }).then(_ => {
    log("BT", "All done!");
    return bluetooth;
  }).catch(error => {
    log("BT", 'Argh! ' + error);
    bluetooth = {};
  });
}

function niimbotDisconnect() {
  if (bluetooth["rx"]) {
    bluetooth["rx"].stopNotifications();
  }
  if (bluetooth["gatt"]) {
    bluetooth["gatt"].disconnect();
  }
  bluetooth = {};
}
