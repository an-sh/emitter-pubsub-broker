'use strict'

const Promise = require('bluebird')
const Redis = require('ioredis')
const msgpack = require('msgpack-lite')
const { EventEmitter } = require('eventemitter3')

/**
 * Interface for connector implementations.
 *
 * @interface Connector
 * @extends EventEmitter
 */

/**
 * @method
 * @instance
 * @name publish
 * @memberOf Connector
 * @param {string} channel Channel.
 * @param {Buffer} data Data.
 * @return {Promise<undefined>}
 */

/**
 * @method
 * @instance
 * @name subscribe
 * @memberOf Connector
 * @param {string} channel Channel.
 * @return {Promise<undefined>}
 */

/**
 * @method
 * @instance
 * @name unsubscribe
 * @memberOf Connector
 * @param {string} channel Channel.
 * @return {Promise<undefined>}
 */

/**
 * @method
 * @instance
 * @name close
 * @memberOf Connector
 * @return {Promise<undefined>}
 */

/**
 * @event message
 * @memberOf Connector
 * @param {string} event Event name.
 * @param {Buffer} data Event data.
 */

/**
 * Event will be listened by {@link EmitterPubsubBroker} instance.
 *
 * @event error
 * @memberOf Connector
 * @param {Error} error Error.
 */

class RedisConnector extends EventEmitter {
  constructor (options) {
    super()
    this.pub = new Redis(options)
    this.sub = new Redis(options)
    this.sub.subscribe().catchReturn()
    this.sub.on('messageBuffer', this._onMessage.bind(this))
    this.sub.on('error', this.emit.bind(this))
    this.pub.on('error', this.emit.bind(this))
  }

  _onMessage (buf, data) {
    let ch = buf.toString()
    this.emit('message', ch, data)
  }

  publish (ch, data) {
    return this.pub.publish(ch, data)
  }

  subscribe (ch) {
    return this.sub.subscribe(ch)
  }

  unsubscribe (ch) {
    return this.sub.unsubscribe(ch)
  }

  close () {
    return Promise.all([this.pub.quit(), this.sub.quit()])
  }
}

class MemoryConnector extends EventEmitter {
  constructor (options) {
    super()
  }

  publish (ch, data) {
    return Promise.resolve()
      .then(() => this.emit('message', ch, data))
  }

  subscribe (ch) {
    return Promise.resolve()
  }

  unsubscribe (ch) {
    return Promise.resolve()
  }

  close () {
    return Promise.resolve()
  }
}

/**
 * Messages encoder. Encoded messages will be used to emit messages
 * via event emitters. May also return promises for an asynchronous
 * execution.
 *
 * @callback EmitterPubsubBroker.Encoder
 * @param {*} args Emit arguments.
 * @return {Promise<Object>|Object} Data to send.
 */

/**
 * Messages serialisation. Serialised messages will be used internally
 * via a communication {@link Connector}.  May also return promises
 * for an asynchronous execution.
 *
 * @callback EmitterPubsubBroker.Serialize
 * @param {Object} data Data.
 * @return {Promise<Object>|Object} Serialised data.
 */

/**
 * Messages deserialisation. Serialised messages will be used
 * internally via a communication {@link Connector}.  May also return
 * promises for an asynchronous execution.
 *
 * @callback EmitterPubsubBroker.Deserialize
 * @param {Object} data Serialised data.
 * @return {Promise<Object>|Object} Data.
 */

/**
 * @typedef {Object} EmitterPubsubBroker.Options
 *
 * @property {string} [connect] Connect string for a connector.
 * @property {string} [prefix='emitter-pubsub-broker:'] Prefix for a connector.
 * @property {boolean} [includeChannel=false] Include channel as the
 * first argument.
 * @property {EmitterPubsubBroker.Encoder} [encoder] Optional encoder
 * to run before broadcasting.
 * @property {string} [method='emit'] An alternative emit method.
 * @property {EmitterPubsubBroker.Serialize}
 * [serialize=msgpack.encode] Serialisation function to use with a
 * connector.
 * @property {EmitterPubsubBroker.Deserialize}
 * [deserialize=msgpack.decode] Deserialisation function to use with a
 * connector.
 * @property {Connector} [connector] Custom connector implementation.
 */

/**
 * @extends EventEmitter
 */
class EmitterPubsubBroker extends EventEmitter {
  /**
   * Creates a broker.
   *
   * @param {EmitterPubsubBroker.Options|string} options Options or a
   * connect if a string. If connect string is empty, then an
   * in-memory connector is used.
   */
  constructor (options) {
    super()
    if (options == null || typeof options === 'string') {
      options = { connect: options }
    }
    this.prefix = options.prefix || 'emitter-pubsub-broker:'
    this.method = options.method || 'emit'
    this.serialize = options.serialize || msgpack.encode
    this.deserialize = options.deserialize || msgpack.decode
    this.encoder = options.encoder
    this.includeChannel = options.includeChannel
    this.clientChannels = new Map()
    this.channelClients = new Map()
    if (options.connect || options.connector) {
      this.connector = options.connector || new RedisConnector(options.connect)
      this.useSerialization = true
    } else {
      this.connector = new MemoryConnector()
      this.useSerialization = false
    }
    this.connector.on('message', this._dispatch.bind(this))
    /**
     * Connector error. Does not throw if there are no listeners.
     *
     * @event error
     * @memberOf EmitterPubsubBroker
     * @param {Error} error Error.
     */
    this.connector.on('error', this.emit.bind(this))
  }

  _channelAddClient (client, channel) {
    let clients = this.channelClients.get(channel)
    if (clients == null) {
      clients = new Set()
      this.channelClients.set(channel, clients)
      clients.add(client)
      let ch = this.prefix + channel
      return this.connector.subscribe(ch)
    } else {
      clients.add(client)
      return Promise.resolve()
    }
  }

  _channelRemoveClient (client, channel) {
    let clients = this.channelClients.get(channel)
    let nclients
    if (clients != null) {
      clients.delete(client)
      nclients = clients.size
    }
    if (nclients === 0) {
      let ch = this.prefix + channel
      return this.connector.unsubscribe(ch)
    } else {
      return Promise.resolve()
    }
  }

  _makeMessage (msg) {
    return Promise.try(() => this.useSerialization ? this.serialize(msg) : msg)
  }

  _unpackMessage (data) {
    return Promise.try(() => this.useSerialization ? this.deserialize(data) : data)
  }

  /**
   * Subscribes emitter to a channel.
   *
   * @param {EventEmitter} client Emitter.
   * @param {string} channel Channel.
   * @return {Promise<undefined>}
   */
  subscribe (client, channel) {
    let channels = this.clientChannels.get(client)
    if (!channels) {
      channels = new Set()
      this.clientChannels.set(client, channels)
    }
    channels.add(channel)
    return this._channelAddClient(client, channel)
  }

  /**
   * Unsubscribes emitter from a channel.
   *
   * @param {EventEmitter} client Emitter.
   * @param {string} channel Channel.
   * @return {Promise<undefined>}
   */
  unsubscribe (client, channel) {
    let channels = this.clientChannels.get(client)
    if (channels) {
      channels.delete(channel)
    }
    return this._channelRemoveClient(client, channel)
  }

  /**
   * Unsubscribes emitter from all channels.
   *
   * @param {EventEmitter} client Emitter.
   * @return {Promise<undefined>}
   */
  unsubscribeAll (client) {
    let channels = this.clientChannels.get(client)
    this.clientChannels.delete(client)
    if (channels) {
      return Promise.each(
        channels, this._channelRemoveClient.bind(this, client))
    } else {
      return Promise.resolve()
    }
  }

  /**
   * Publish an event to a channel.
   *
   * @param {string} channel Channel.
   * @param {string} name Event name.
   * @param {*} args Arguments.
   * @return {Promise<undefined>}
   */
  publish (channel, name, ...args) {
    let ch = this.prefix + channel
    return this._makeMessage({name, args})
      .then(msg => this.connector.publish(ch, msg))
  }

  /**
   * Publish an event to a channel, excluding the sender. The client
   * object __MUST__ have an unique `id` field.
   *
   * @param {EventEmitter} client Emitter.
   * @param {string} channel Channel.
   * @param {string} name Event name.
   * @param {*} args Arguments.
   * @return {Promise<undefined>}
   */
  send (client, channel, name, ...args) {
    let ch = this.prefix + channel
    let sender = client.id
    return this._makeMessage({sender, name, args})
      .then(msg => this.connector.publish(ch, msg))
  }

  /**
   * Returns set of client subscriptions. The result __MUST NOT__ be
   * modified.
   *
   * @param {EventEmitter} client Emitter.
   * @return {Set<string>|undefined}
   */
  getSubscriptions (client) {
    return this.clientChannels.get(client)
  }

  /**
   * Returns _internal_ set of channel clients of EmitterPubsubBroker
   * instance. The result __MUST NOT__ be modified.
   *
   * @param {string} channel Channel.
   * @return {Set<EventEmitter>|undefined}
   */
  getClients (channel) {
    return this.channelClients.get(channel)
  }

  /**
   * Closes broker.
   *
   * @return {Promise<undefined>}
   */
  close () {
    this.channelClients.clear()
    this.clientChannels.clear()
    return this.connector.close()
  }

  _dispatch (ch, data) {
    this._unpackMessage(data).then(message => {
      let channel = ch.slice(this.prefix.length)
      let clients = this.channelClients.get(channel)
      /* istanbul ignore else */
      if (clients) {
        let args = this.includeChannel
          ? [message.name, channel, ...message.args]
          : [message.name, ...message.args]
        Promise.try(() => this.encoder ? this.encoder(args) : args).then(data => {
          const method = this.method
          const encoder = this.encoder
          const sender = message.sender
          clients.forEach(client => {
            if (!sender || client.id !== sender) {
              Promise
                .try(() => encoder ? client[method](data) : client[method](...data))
                .catchReturn()
            }
          })
        })
      }
    })
  }
}

// compatibility
EmitterPubsubBroker.prototype.unsubscribeall = EmitterPubsubBroker.prototype.unsubscribeAll

module.exports = EmitterPubsubBroker
