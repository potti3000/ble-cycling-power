var util = require('util');
var os = require('os');
var exec = require('child_process').exec;
var debug = require('debug')('csc');

var bleno = require('bleno');

var Descriptor = bleno.Descriptor;
var Characteristic = bleno.Characteristic;

// Spec
//https://developer.bluetooth.org/gatt/characteristics/Pages/CharacteristicViewer.aspx?u=org.bluetooth.characteristic.csc_measurement.xml

var CSCMeasurementCharacteristic = function() {
  CSCMeasurementCharacteristic.super_.call(this, {
    uuid: '2A5B',
    properties: ['notify'],
    descriptors: [
      new Descriptor({
        // Client Characteristic Configuration
        uuid: '2902',
        value: new Buffer([0])
      })
    ]
  });

  this._updateValueCallback = null;

  console.log('[BLE] CSC intialized');

};

util.inherits(CSCMeasurementCharacteristic, Characteristic);

CSCMeasurementCharacteristic.prototype.onSubscribe = function(maxValueSize, updateValueCallback) {
  console.log('[BLE] client subscribed to CSC');
  this._updateValueCallback = updateValueCallback;
};

CSCMeasurementCharacteristic.prototype.onUnsubscribe = function() {
  console.log('[BLE] client unsubscribed from CSC');
  this._updateValueCallback = null;
};

var last_speed = Date.now();
var last_rev = 0;
var wheel_circ = 2095;
var last_stroke = 0;

CSCMeasurementCharacteristic.prototype.notify = function(event) {
  if (!('speed_cm_s' in event)) {
    // ignore events with no relevant data
    return;
  }
  var buffer = new Buffer(12);
  buffer.fill(0);
  var flags = 0;
  // flags
  // 00000001 - 1   - 0x001 - Wheel Revolution Data Present
  // 00000010 - 2   - 0x002 - Crank Revolution Data Present
  var flags = 0;

  var now = Date.now();

  var pos = 1;

  debug ('Got event '+ JSON.stringify(event));
  
  if ('speed_cm_s' in event) {
    var delta = (now - last_speed);
    var speed = event.speed_cm_s * 10; // mm/s
    var rev = Math.floor (speed * delta / wheel_circ / 1000);
    debug("\nspeed: " + speed + " rev: " + rev);
    debug ('now/last: ' + now +  ' / ' + last_speed);
    if (rev != 0) {
      last_rev += rev;
      last_speed += Math.floor ((wheel_circ * rev) * 1000 / speed);
      debug("new_speed/delta: " + last_speed + " / " + delta);
      buffer.writeUInt32LE(last_rev, pos);
      buffer.writeUInt16LE((last_speed * 2048 / 1000)% 65536, pos+4);
      pos += 6;
      flags |= 0x01;
    }
  }

  if ('stroke_count' in event && event.stroke_count > last_stroke) {
    last_stroke = event.stroke_count;
    debug("stroke_count: " + last_stroke);
    buffer.writeUInt16LE(last_stroke, pos);
    
    var now_1024 = Math.floor(now*1024/1000);
    var event_time = now_1024 % 65536; // rolls over every 64 seconds
    debug("event time: " + event_time);
    buffer.writeUInt16LE(event_time, pos+2);
    pos += 4;
    flags |= 0x02;
  }

  buffer.writeUInt8(flags, 0);

  debug ("Send: " + buffer.toString('hex'));
  if (this._updateValueCallback) {
    this._updateValueCallback(buffer);
  }

}

module.exports = CSCMeasurementCharacteristic;
