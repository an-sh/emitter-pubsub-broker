'use strict'

var semver = require('semver')

// Choosing between a source ES6 syntax and a transpiled ES5.
if (semver.lt(process.version, '6.0.0')) {
  module.exports = require('./lib/EmitterPubsubBroker')
} else {
  module.exports = require('./src/EmitterPubsubBroker')
}
