
# emitter-pubsub-broker

[![NPM Version](https://badge.fury.io/js/emitter-pubsub-broker.svg)](https://badge.fury.io/js/emitter-pubsub-broker)
[![Build Status](https://travis-ci.org/an-sh/emitter-pubsub-broker.svg?branch=master)](https://travis-ci.org/an-sh/emitter-pubsub-broker)
[![Appveyor status](https://ci.appveyor.com/api/projects/status/y1hrrpumx5erpa6e/branch/master?svg=true)](https://ci.appveyor.com/project/an-sh/emitter-pubsub-broker)
[![Coverage Status](https://codecov.io/gh/an-sh/emitter-pubsub-broker/branch/master/graph/badge.svg)](https://codecov.io/gh/an-sh/emitter-pubsub-broker)
[![Dependency Status](https://david-dm.org/an-sh/emitter-pubsub-broker.svg)](https://david-dm.org/an-sh/emitter-pubsub-broker)
[![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)

An utility for connecting EventEmitters via a pubsub. Includes Redis
and in-memory backends, and a support of other systems can be added by
implementing a very simple Connector wrapper.


## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [API](#api)
- [Contribute](#contribute)
- [License](#license)


## Installation

```sh
$ npm i emitter-pubsub-broker
```

## Usage

```javascript
const EmitterPubsubBroker = require('emitter-pubsub-broker')
const connect = 'redis://localhost:6379' // or empty for in-memory backend

let broker = new EmitterPubsubBroker(connect)
let client = new EventEmitter() // anything that implements the interface

client.on('myEvent', (...args) => { /* handler code */ })

broker.subscribe(client, 'my-channel')
  .then(() => broker.publish('my-channel', 'myEvent', ...args))
```


## API

[API](https://an-sh.github.io/emitter-pubsub-broker/0.5/index.html)
documentation is available online.


## Contribute

If you encounter a bug in this package, please submit a bug report to
github repo
[issues](https://github.com/an-sh/emitter-pubsub-broker/issues).

PRs are also accepted.


## License

MIT
