# 2.0.x API Reference

- [`Jingle.SessionManager`](#jingleesessionmanager)
  - [`new SessionManager(config)`](#new-sessionmanagerconfig)
  - [`SessionManager` Configuration](#sessionmanager-configuration)
  - [`SessionManager` Methods](#sessionmanager-methods)
    - [`manager.addICEServer(info)`](#manageraddiceserverinfo)
    - [`manager.addSession(session)`](#manageraddsessionsession)
    - [`manager.endPeerSessions(peer, [reason], [silent])`](#managerendpeersessionspeer-reason-silent)
    - [`manager.endAllSessions([reason], [silent])`](#managerendallsessionsreason-silent)
    - [`manager.process(packet)`](#managerprocesspacket)
  - [`SessionManager` Events](#sessionmanager-events)
    - [`send`](#send)
    - [`error`](#error)
    - [`incoming`](#incoming)
    - [`outgoing`](#outgoing)
    - [`terminated`](#terminated)
    - [`createdSession`](#createdsession)
    - [`log:[error|debug|info]`](#logerrordebuginfo)
- [`Jingle.BaseSession`](#jinglebasesession)
  - [`new BaseSession(opts)`](#new-basesessionopts)
  - [`BaseSession` Options](#basesession-options)
  - [`BaseSession` Properties](#basesession-properties)
  - [`BaseSession` Methods](#basesession-methods)
    - [`session.process(action, data, cb)`](#sessionprocessaction-data-cb)
    - [`session.send(action, data)`](#sessionsendaction-data)
    - [`session.start()`](#sessionstart)
    - [`session.accept()`](#sessionaccept)
    - [`session.cancel()`](#sessioncancel)
    - [`session.decline()`](#sessiondecline)
    - [`session.end([reason], [silent])`](#sessionendreason-silent)


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
