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
 * @typedef {Object} EmitterPubsubBroker.Options
 *
 * @property {string} connect Connect string.
 * @property {string} [prefix='emitter-pubsub-broker:'] Prefix.
 * @property {boolean} [includeChannel=false] Include channel as the
 * first argument.
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
    this.includeChannel = options.includeChannel
    this.clientChannels = new Map()
    this.channelClients = new Map()
    if (options.connect || options.connector) {
      this.connector = options.connector || new RedisConnector(options.connect)
      this.serialize = true
    } else {
      this.connector = new MemoryConnector()
      this.serialize = false
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

  _channelAddClient (client, ch) {
    let clients = this.channelClients.get(ch)
    if (clients == null) {
      clients = new Set()
      this.channelClients.set(ch, clients)
      clients.add(client)
      return this.connector.subscribe(ch)
    } else {
      clients.add(client)
      return Promise.resolve()
    }
  }

  _channelRemoveClient (client, ch) {
    let clients = this.channelClients.get(ch)
    let nclients
    if (clients != null) {
      clients.delete(client)
      nclients = clients.size
    }
    if (nclients === 0) {
      return this.connector.unsubscribe(ch)
    } else {
      return Promise.resolve()
    }
  }

  _makeMessage (msg) {
    return this.serialize ? msgpack.encode(msg) : msg
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
    let ch = this.prefix + channel
    channels.add(ch)
    return this._channelAddClient(client, ch)
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
    let ch = this.prefix + channel
    if (channels) {
      channels.delete(ch)
    }
    return this._channelRemoveClient(client, ch)
  }

  /**
   * Unsubscribes emitter from all channel.
   *
   * @param {EventEmitter} client Emitter.
   * @return {Promise<undefined>}
   */
  unsubscribeall (client) {
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
    let msg = this._makeMessage({name, args})
    return this.connector.publish(ch, msg)
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
    let msg = this._makeMessage({sender, name, args})
    return this.connector.publish(ch, msg)
  }

  /**
   * Returns client subscriptions.
   *
   * @param {EventEmitter} client Emitter.
   * @return {Array<string>}
   */
  getSubscriptions (client) {
    let channels = this.clientChannels.get(client)
    let res = []
    if (channels) {
      let plen = this.prefix.length
      for (let channel of channels) {
        res.push(channel.slice(plen))
      }
    }
    return res
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
    let channel = ch.slice(this.prefix.length)
    let message = this.serialize ? msgpack.decode(data) : data
    let clients = this.channelClients.get(ch)
    /* istanbul ignore else */
    if (clients) {
      let args
      if (this.includeChannel) {
        args = [message.name, channel, ...message.args]
      } else {
        args = [message.name, ...message.args]
      }
      for (let client of clients) {
        if (!message.sender || client.id !== message.sender) {
          client.emit(...args)
        }
      }
    }
  }

}

module.exports = EmitterPubsubBroker
