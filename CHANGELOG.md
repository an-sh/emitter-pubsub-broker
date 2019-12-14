# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.


<a name="0.5.0"></a>
# [0.5.0](https://github.com/an-sh/emitter-pubsub-broker/compare/v0.4.0...v0.5.0) (2017-01-06)


### Bug Fixes

* ignore broadcast errors ([e895e96](https://github.com/an-sh/emitter-pubsub-broker/commit/e895e96))


### Code Refactoring

* change getSubscriptions return type ([338a47a](https://github.com/an-sh/emitter-pubsub-broker/commit/338a47a))
* rename unsubscribeall to unsubscribeAll ([3a25f07](https://github.com/an-sh/emitter-pubsub-broker/commit/3a25f07))


### Features

* add custom serialisation support ([c3f218d](https://github.com/an-sh/emitter-pubsub-broker/commit/c3f218d))
* add getClients ([f728105](https://github.com/an-sh/emitter-pubsub-broker/commit/f728105))
* support broadcast data encoding ([392c173](https://github.com/an-sh/emitter-pubsub-broker/commit/392c173))


### BREAKING CHANGES

* Now getSubscriptions method returns a shared Set
instead of a fresh Array.
* Rename unsubscribeall to unsubscribeAll.



<a name="0.4.0"></a>
# [0.4.0](https://github.com/an-sh/emitter-pubsub-broker/compare/v0.3.0...v0.4.0) (2016-11-29)


### Chores

* use es2015-node4 preset ([5e05222](https://github.com/an-sh/emitter-pubsub-broker/commit/5e05222))


### BREAKING CHANGES

* Possible node 4.x regression due to the preset change.



<a name="0.3.0"></a>
# [0.3.0](https://github.com/an-sh/emitter-pubsub-broker/compare/v0.2.1...v0.3.0) (2016-10-21)


### Code Refactoring

* drop node 0.12 support/tests ([b8e1f4d](https://github.com/an-sh/emitter-pubsub-broker/commit/b8e1f4d))


### BREAKING CHANGES

* Node.js minimum version now is 4.x



<a name="0.2.1"></a>
## [0.2.1](https://github.com/an-sh/emitter-pubsub-broker/compare/v0.2.0...v0.2.1) (2016-10-12)


### Bug Fixes

* handle undefined options ([652d41d](https://github.com/an-sh/emitter-pubsub-broker/commit/652d41d))



<a name="0.2.0"></a>
# [0.2.0](https://github.com/an-sh/emitter-pubsub-broker/compare/v0.1.0...v0.2.0) (2016-10-09)


### Features

* safely propagate connector error events ([82d57c3](https://github.com/an-sh/emitter-pubsub-broker/commit/82d57c3))



<a name="0.1.0"></a>
# 0.1.0 (2016-10-04)


### Features

* initial release ([9651972](https://github.com/an-sh/emitter-pubsub-broker/commit/9651972))
