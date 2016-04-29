var BluetoothPeripheral = function(name, services) {
  var bleno = require('bleno');
  var Services = services.map(require);
  process.env['BLENO_DEVICE_NAME'] = name;
  this.Services = Services.map(s => new s());
  var self = this;
  console.log (this.Services.map(s => s.uuid));
  var debug = require('debug')('ble');

  bleno.on('stateChange', function(state) {
    console.log('BLE state change: ' + state);

    if (state === 'poweredOn') {
      bleno.startAdvertising(process.env['BLENO_DEVICE_NAME'], self.Services.map(s => s.uuid))
    } else {
      bleno.stopAdvertising();
    }
  });

  bleno.on('advertisingStart', function(error) {
    debug('advertisingStart: ' + (error ? 'error ' + error : 'success'));

    if (!error) {
      bleno.setServices(self.Services, function(error){
        debug('setServices: '  + (error ? 'error ' + error : 'success'));
      });
    }
  });

  this.notify = function(event) {
    debug("[BLE] notification " + JSON.stringify(event));
    self.Services.map(s => s.notify(event));
  };

};

module.exports.BluetoothPeripheral = BluetoothPeripheral;
