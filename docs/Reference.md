# 2.0.x API Reference

- [`Jingle.SessionManager`](#jingleesessionmanager)
  - [`new SessionManager(config)`](#new-sessionmanagerconfig)
    - [`prepareSession(opts, [req])`](#sessionmanager-configuration)
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

Creates a new Jingle session manager with the following configuration options:

- `jid` - The JID for the entity running the session manager. May be either a `{String}` or [`{JID}`](https://github.com/otalk/xmpp-jid).
- `selfID` - An alternative to `jid`, which MUST be a `{String}`.
- `iceServers` - An array of known ICE servers. See [`addICEServer()`] for the required format of each item.
- `prepareSession` - [See below for how `prepareSession` works](#preparesessionopts-req)

```js
var Jingle = require('jingle');
var manager = new Jingle.SessionManager({
    jid: 'me@mydomain.example',
    iceServers: [
        {url: 'stun:stun.mydomain.example'}
    ],
    prepareSession: function (opts) {
        return new Jingle.BaseSession(opts);
    }
});
```

#### `prepareSession(opts, [req])`

- `opts` - An object summarizing the information in the session initiate request, suitable for passing directly to a session class constructor:
    - `sid` - The ID for the session, as provided by the initiating peer.
    - `peer` - The JID for the initiating peer (may be either a `{String}` or [`{JID}`](https://github.com/otalk/xmpp-jid).
    - `peerID` - An alternative to `peer`, which MUST be a `{String}`.
    - `initiator` - This will always be `false`, as we are the one receiving the initiation request.
    - `descriptionTypes` - An array of content description names.
    - `transportTypes` - An array of content transport names.
- `req` - The original session initiation request, in case you need more information than provided in `opts` for selecting a session type.

Returns a `Session` instance of your choosing or a `falsy` value if you wish to fallback to a `BaseSession` instance.

The `prepareSession()` function allows you to control what type of session is created for a given
incoming session request. If `prepareSession()` is not included when creating the session manager, or
if your `prepareSession()` function does not return a session, a `BaseSession` will be created for you.

```js
new Jingle.SessionManager({
    ...,
    prepareSession: function (opts) {
        // Check if the session request includes "stub" content, and if so
        // create a custom StubSession.
        if (opts.descriptionTypes.indexOf('stub') >= 0) {
            return new StubSession(opts);
        }
    }
});
```

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
