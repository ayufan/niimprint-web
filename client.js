const BLE_UART_UUID = "49535343-fe7d-4ae5-8fa9-9fafd205e455";
const BLE_UART_TX_CH_UUID = "49535343-1e4d-4bd9-ba61-23c647249616";
const BLE_UART_RX_CH_UUID = "49535343-8841-43f4-a8d4-ecbe34729bb3";

const BLE_THERM_UUID = "e7810a71-73ae-499d-8c15-faa9aef0c3f2";
const BLE_THERM_CH_UUID = "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f";

let options = {
  filters: [
    { namePrefix: "D" },
    // { services: [BLE_UART_UUID] },
    { services: [BLE_THERM_UUID] }
  ]
};

var bluetooth = {};

function to_packet(type, data) {
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

function from_packet(packet) {
  packet = buffer_to_array(packet);

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

async function receive_packet() {
  return new Promise((resolve, reject) => {
    log("RX: Waiting for recv.");
    bluetooth["rx"].addEventListener('characteristicvaluechanged', event => {
      log("RX: " + buffer_to_array(event.target.value));
      resolve(from_packet(event.target.value));
    }, { "once": true });

    setTimeout(() => {
      reject("RX: timeout");
    }, 1000);
  });
}

async function send_packet(type, data) {
  const packet = to_packet(type, data);
  log("TX: Sending... " + packet);
  return bluetooth["tx"].writeValueWithoutResponse(new Uint8Array(packet))
    .then(_ => log("TX: Sent."));
}

async function transceive_packet(type, data, recv_offset = 1) {
  let process = function([recv_type, recv_data]) {
    if (recv_type == 219)
      throw "error";
    else if (recv_type == 0)
      throw "not implemented";
    else if (recv_type == type + recv_offset)
      return recv_data;
    else
      return receive_packet().then(process);
  };

  let recv = receive_packet().then(process);
  let send = send_packet(type, data);

  return Promise.all([send, recv]).then(values => values[1]);
}
async function connect() {
  return await navigator.bluetooth.requestDevice(options).then(device => {
    log(`Name: ${device.name}`);
    bluetooth["device"] = device;

    log('Connecting to GATT Server...');
    return device.gatt.connect();
  }).then(server => {
    bluetooth["gatt"] = server;

    // Note that we could also get all services that match a specific UUID by
    // passing it to getPrimaryServices().
    log('Getting Services...');
    let allServices = server.getPrimaryServices().then(services => {
      log('Getting Characteristics...');
      let queue = Promise.resolve();
      services.forEach(service => {
        queue = queue.then(_ => service.getCharacteristics().then(characteristics => {
          log('> Service: ' + service.uuid);
          characteristics.forEach(characteristic => {
            log('>> Characteristic: ' + characteristic.uuid);
          });
        }).catch(error => {
          log('Argh! ' + error);
        }));
      });
    }).catch(error => {
      log('Argh! ' + error);
    });

    log('Getting Uart Service...');
    // let service = server.getPrimaryService(BLE_UART_UUID).then(service => {
    //   var rx = service.getCharacteristic(BLE_UART_TX_CH_UUID).then(rx => {
    //     bluetooth["rx"] = rx;
    //     return tx.startNotifications();
    //   });
    //   var tx = service.getCharacteristic(BLE_UART_RX_CH_UUID).then(tx => {
    //     bluetooth["tx"] = tx;
    //   });
    //   return Promise.all([tx, rx]);
    // }).catch(error => {
    //   log('Argh! ' + error);
    // });

    let service = server.getPrimaryService(BLE_THERM_UUID).then(service => {
      return service.getCharacteristic(BLE_THERM_CH_UUID);
    }).then(ch => {
      bluetooth["tx"] = ch;
      bluetooth["rx"] = ch;
      return ch.startNotifications();
    }).catch(error => {
      log('Argh! ' + error);
    });

    return Promise.all([service, allServices]);
  }).then(values => {
    log("All done: " + values);
    return bluetooth;
  }).catch(error => {
    log('Argh! ' + error);
    bluetooth = {};
  });
}

function disconnect() {
  if (bluetooth["rx"]) {
    bluetooth["rx"].stopNotifications();
  }
  if (bluetooth["gatt"]) {
    bluetooth["gatt"].disconnect();
  }
  bluetooth = {};
}
