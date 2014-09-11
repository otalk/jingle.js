# 2.0.x API Reference

- [`Jingle.SessionManager`](#jingleesessionmnager)
  - [`new SessionManager(config)`](#new-sessionmanager-config)
  - [`SessionManager` Configuration](#sessionmanager-configuration)
  - [`SessionManager` Methods](#sessionmanager-methods)
    - [`manager.addICEServer(info)`](#manageraddiceserver-info)
    - [`manager.addSession(session)`](#manageraddsession-session)
    - [`manager.endPeerSessions(peer, [reason], [silent])`](#managerendpeersessions-peer-reason-silent)
    - [`manager.endAllSessions([reason], [silent])`](#managerendallsessions-reason-silent)
    - [`manager.process(packet)`](#managerprocess-packet)
  - [`SessionManager` Events](#sessionmanager-events)
    - [`send`](#send)
    - [`error`](#error)
    - [`incoming`](#incoming)
    - [`outgoing`](#outgoing)
    - [`terminated`](#terminated)
    - [`createdSession`](#createdsession)
    - [`log:[error|debug|info]`](#log-error-debug-info)
- [`Jingle.BaseSession`](#jinglebasesession)
  - [`new BaseSession(opts)`](#new-basesession-opts)
  - [`BaseSession` Options](#basesession-options)
  - [`BaseSession` Properties](#basesession-properties)
  - [`BaseSession` Methods](#basesession-methods)
    - [`session.process(action, data, cb)`](#sessionprocess-action-data)
    - [`session.send(action, data)`](#sessionsend-action-data)
    - [`session.start()`](#sessionstart)
    - [`session.accept()`](#sessionaccept)
    - [`session.cancel()`](#sessioncancel)
    - [`session.decline()`](#sessiondecline)
    - [`session.end([reason], [silent])`](#sessionend-reason-silent)


## `Jingle.SessionManager`
### `new SessionManager(config)`
### `SessionManager` Configuration
### `SessionManager` Methods
#### `manager.addICEServer(info)`
#### `manager.addSession(session)`
#### `manager.endPeerSessions(peer, [reason], [silent])`
#### `manager.endAllSessions([reason], [silent])`
#### `manager.process(packet)`
### `SessionManager` Events
#### `send`
#### `error`
#### `incoming`
#### `outgoing`
#### `createdSession`
#### `terminated`
#### `log:[error|debug|info]`

## `Jingle.BaseSession`
### `new BaseSession(opts)`
### `BaseSession` Options
### `BaseSession` Properties
### `BaseSession` Methods
#### `session.process(action, data, cb)`
#### `session.send(action, data)`
#### `session.start()`
#### `session.accept()`
#### `session.cancel()`
#### `session.decline()`
#### `session.end([reason], [silent])`
