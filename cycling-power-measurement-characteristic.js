var util = require('util');
var os = require('os');
var exec = require('child_process').exec;
var debug = require('debug')('pm');

var bleno = require('bleno');

var Descriptor = bleno.Descriptor;
var Characteristic = bleno.Characteristic;

// Spec
//https://developer.bluetooth.org/gatt/characteristics/Pages/CharacteristicViewer.aspx?u=org.bluetooth.characteristic.cycling_power_measurement.xml

var CyclingPowerMeasurementCharacteristic = function() {
  CyclingPowerMeasurementCharacteristic.super_.call(this, {
    uuid: '2A63',
    properties: ['notify'],
    descriptors: [
      new Descriptor({
        // Client Characteristic Configuration
        uuid: '2902',
        value: new Buffer([0])
      }),
      new Descriptor({
        // Server Characteristic Configuration
        uuid: '2903',
        value: new Buffer([0])
      })
    ]
  });

  this._updateValueCallback = null;
};

util.inherits(CyclingPowerMeasurementCharacteristic, Characteristic);

CyclingPowerMeasurementCharacteristic.prototype.onSubscribe = function(maxValueSize, updateValueCallback) {
  console.log('[BLE] client subscribed to PM');
  this._updateValueCallback = updateValueCallback;
};

CyclingPowerMeasurementCharacteristic.prototype.onUnsubscribe = function() {
  console.log('[BLE] client unsubscribed from PM');
  this._updateValueCallback = null;
};

var last_speed = Date.now();
var last_rev = 0;
var wheel_circ = 2095;

CyclingPowerMeasurementCharacteristic.prototype.notify = function(event) {
  if (!('watts' in event)) {
    // ignore events with no power data
    return;
  }
  var buffer = new Buffer(14);
  buffer.fill(0); //initialize buffer
  
  // flags
  // 00000001 - 1   - 0x001 - Pedal Power Balance Present
  // 00000010 - 2   - 0x002 - Pedal Power Balance Reference
  // 00000100 - 4   - 0x004 - Accumulated Torque Present
  // 00001000 - 8   - 0x008 - Accumulated Torque Source
  // 00010000 - 16  - 0x010 - Wheel Revolution Data Present
  // 00100000 - 32  - 0x020 - Crank Revolution Data Present
  // 01000000 - 64  - 0x040 - Extreme Force Magnitudes Present
  // 10000000 - 128 - 0x080 - Extreme Torque Magnitudes Present
  var flags = 0;
  var pos = 4;
  var now = Date.now();
  var watts = event.watts;

  debug("power: " + watts);
  buffer.writeInt16LE(watts, 2);
  
  if ('wheel_rev' in event && 'wheel_time' in event) {
   
    var rev = event.wheel_rev;
   
    buffer.writeUInt32LE(rev, pos);

    //time definition
    var now_1024 = Math.floor(event.wheel_time*2048/1000);
    var event_time = now_1024 % 65536; // rolls over every 64 seconds

    buffer.writeUInt16LE(event_time, pos+4);
    
    pos += 6;
    flags |= 0x010;

  }

  if ('rev_count' in event && 'rev_time' in event) {
    debug("rev_count: " + event.rev_count);
    buffer.writeUInt16LE(event.rev_count, pos);
    
    var now_1024 = Math.floor(event.rev_time*1024/1000);
    var event_time = now_1024 % 65536; // rolls over every 64 seconds
    debug("event time: " + event_time);
    buffer.writeUInt16LE(event_time, pos+2);
    pos += 4;
    flags |= 0x020;
  }

  buffer.writeUInt16LE(flags, 0);

  debug ("Send: " + buffer.toString('hex'));
  if (this._updateValueCallback) {
    this._updateValueCallback(buffer);
  }
}

module.exports = CyclingPowerMeasurementCharacteristic;
