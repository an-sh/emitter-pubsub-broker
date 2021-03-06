'use strict'
/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

const EmitterPubsubBroker = require('../index.js')
const eventToPromise = require('event-to-promise')
const msgpack = require('msgpack-lite')
const Promise = require('bluebird')
const { expect } = require('chai')
const { EventEmitter } = require('events')

const configs = [{ name: 'memory', connect: '' },
  { name: 'redis', connect: 'redis://localhost:6379' }]

let broker

function notReachable (error) {
  throw new Error(`This code should not be reachable ${error}`)
}

afterEach(function () {
  if (broker) {
    return broker.close().catch(() => {})
  }
})

describe('emitter-pubsub-broker', function () {
  configs.forEach(state => describe(state.name, function () {
    const { connect } = state

    it('should create an object', function () {
      broker = new EmitterPubsubBroker(connect)
    })

    it('should emit published messages', function () {
      broker = new EmitterPubsubBroker(connect)
      const client = new EventEmitter()
      return broker.subscribe(client, 'my-channel').then(() => {
        broker.publish('my-channel', 'myEvent', 1, '2')
        return eventToPromise(client, 'myEvent', { array: true }).then(args => {
          const [x, y] = args
          expect(x).equal(1)
          expect(y).equal('2')
        })
      })
    })

    it('should emit published encoded messages', function (done) {
      broker = new EmitterPubsubBroker({ connect, encoder: JSON.stringify, method: 'send' })
      const client = new EventEmitter()
      client.send = function (args) {
        const [ev, x, y] = JSON.parse(args)
        expect(ev).equal('myEvent')
        expect(x).equal(1)
        expect(y).equal('2')
        done()
      }
      broker.subscribe(client, 'my-channel').then(() => {
        broker.publish('my-channel', 'myEvent', 1, '2')
      })
    })

    it('should use custom serialisation', function () {
      const serialize = (data) => Promise.try(() => msgpack.encode(data))
      const deserialize = (data) => Promise.try(() => msgpack.decode(data))
      broker = new EmitterPubsubBroker({ connect, serialize, deserialize })
      const client = new EventEmitter()
      return broker.subscribe(client, 'my-channel').then(() => {
        broker.publish('my-channel', 'myEvent', 1, '2')
        return eventToPromise(client, 'myEvent', { array: true }).then(args => {
          const [x, y] = args
          expect(x).equal(1)
          expect(y).equal('2')
        })
      })
    })

    it('should prepend a channel argument', function () {
      broker = new EmitterPubsubBroker({ connect, includeChannel: true })
      const client = new EventEmitter()
      return broker.subscribe(client, 'my-channel').then(() => {
        broker.publish('my-channel', 'myEvent', 1, '2')
        return eventToPromise(client, 'myEvent', { array: true }).then(args => {
          const [ch, x, y] = args
          expect(ch).equal('my-channel')
          expect(x).equal(1)
          expect(y).equal('2')
        })
      })
    })

    it('should unsubscribe from a channel', function () {
      this.timeout(4000)
      this.slow(2000)
      broker = new EmitterPubsubBroker({ connect, includeChannel: true })
      const client = new EventEmitter()
      return broker.subscribe(client, 'my-channel')
        .then(() => broker.unsubscribe(client, 'my-channel'))
        .then(() => {
          broker.publish('my-channel', 'myEvent', 1, '2')
          eventToPromise(client, 'myEvent').then(notReachable)
          return new Promise(resolve => setTimeout(resolve, 1000))
        })
    })

    it('should send messages only to others', function () {
      this.timeout(4000)
      this.slow(2000)
      broker = new EmitterPubsubBroker(connect)
      const client1 = new EventEmitter()
      const client2 = new EventEmitter()
      client1.id = 'uniq'
      return broker.subscribe(client1, 'my-channel')
        .then(() => broker.subscribe(client2, 'my-channel'))
        .then(() => {
          broker.send(client1, 'my-channel', 'myEvent', 'arg')
          eventToPromise(client1, 'myEvent').then(notReachable)
          return Promise.all([
            eventToPromise(client2, 'myEvent'),
            new Promise(resolve => setTimeout(resolve, 1000))])
        })
    })

    it('should get all subscriptions', function () {
      broker = new EmitterPubsubBroker(connect)
      const client1 = new EventEmitter()
      return Promise.all([
        broker.subscribe(client1, 'my-channel'),
        broker.subscribe(client1, 'channel')])
        .then(() => {
          const subs = broker.getSubscriptions(client1)
          expect(subs.size).equal(2)
          expect(subs.has('my-channel')).true
          expect(subs.has('channel')).true
        })
    })

    it('should get clients set', function () {
      broker = new EmitterPubsubBroker(connect)
      const client1 = new EventEmitter()
      const client2 = new EventEmitter()
      return Promise.all([
        broker.subscribe(client1, 'channel'),
        broker.subscribe(client2, 'channel')])
        .then(() => {
          const subs = broker.getClients('channel')
          expect(subs.size).equal(2)
          expect(subs.has(client1)).true
          expect(subs.has(client2)).true
        })
    })

    it('should unsubscribe all', function () {
      this.timeout(4000)
      this.slow(2000)
      broker = new EmitterPubsubBroker(connect)
      const client1 = new EventEmitter()
      return Promise.all([
        broker.subscribe(client1, 'my-channel'),
        broker.subscribe(client1, 'channel')])
        .then(() => broker.unsubscribeAll(client1))
        .then(() => {
          expect(broker.getSubscriptions(client1)).undefined
          eventToPromise(client1, 'myEvent').then(notReachable)
          broker.send(client1, 'my-channel', 'myEvent', 'arg')
          return new Promise(resolve => setTimeout(resolve, 1000))
        })
    })

    it('should handle non-existent unsubscribe', function () {
      broker = new EmitterPubsubBroker(connect)
      const client1 = new EventEmitter()
      return broker.unsubscribe(client1, 'my-channel')
    })

    it('should handle non-existent unsubscribeAll', function () {
      broker = new EmitterPubsubBroker(connect)
      const client1 = new EventEmitter()
      return broker.unsubscribeAll(client1)
    })
  }))
})
