# 2.0.x API Reference

- [`Jingle.SessionManager`](#jinglesessionmanager)
  - [`new SessionManager(config)`](#new-sessionmanagerconfig)
    - [`prepareSession(opts, [req])`](#preparesessionopts-req)
  - [`SessionManager` Methods](#sessionmanager-methods)
    - [`manager.addICEServer(info)`](#manageraddiceserverinfo)
    - [`manager.addSession(session)`](#manageraddsessionsession)
    - [`manager.endAllSessions([reason], [silent])`](#managerendallsessionsreason-silent)
    - [`manager.endPeerSessions(peer, [reason], [silent])`](#managerendpeersessionspeer-reason-silent)
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
- `selfID` - An optional alternative to `jid`, which MUST be a `{String}`. By default, this is derived from `jid`, if `jid` was provided.
- `iceServers` - An array of known ICE servers. See [`addICEServer()`](#manageraddiceserverinfo) for the required format of each item.
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
    - `peer` - The JID for the initiating peer (may be either a `{String}` or [`{JID}`](https://github.com/otalk/xmpp-jid)).
    - `peerID` - An alternative to `peer`, which MUST be a `{String}` (derived from `peer`).
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

- `info` - Either a `{String}` of the URI of the ICE server, or an object:
    - `url` - The URI of the ICE server
    - `username` - The username for accessing the ICE server
    - `credential` - The password or other shared secret to authenticate the `username` with the ICE server

Saves the URI and any required credentials for an ICE STUN/TURN server for use by *future* sessions.

```js
manager.addICEServer('stun:stun.l.google.com:19302');
manager.addICEServer({
    url: 'stun:stun.mydomain.example',
    username: 'ad24lwra',
    credential: '234lamvnerl13k40au35oahfadad'
});
```

#### `manager.addSession(session)`

- `session` - A `{BaseSession}` (or ideally, a subclass of `BaseSession`) instance

Calling this method allows the manager to begin tracking the session and route actions to it.

For incoming sessions, this step is already handled for you. Using this method is only necessary for when you are initiating a session yourself.

Relevant events generated by `session` will now be proxied through the manager instance, and a [`createdSession`](#createdsession) event will be triggered.

```js
var session = new MyCustomJingleSession({
    sid: 'sid123',
    peer: 'otheruser@theirdomain.example',
    initiator: true
});

manager.on('createdSession', function (sess) {
    console.log('Added Session:', sess.sid === session.sid);
});

manager.addSession(session);
// -> Added Session: true
```

#### `manager.endAllSessions([reason], [silent])`

- `reason` - Why the sessions are being ended (see [`endPeerSessions()`](#managerendpeersessionspeer-reason-silent) for the list of available reasons).
- `silent` - If `true`, then session terminating messages will not be generated to be sent to the peers. This is only intended for cases where you've lost network connection and would not be able to send those messages anyway.

```js
// End all sessions because we're about to go offline
manager.endAllSessions('gone');
```

#### `manager.endPeerSessions(peer, [reason], [silent])`

- `peer` - Either the `{JID}` or `{String}` value of the peer's ID.
- `reason` - Why the session is being ended. This may be either a `{String}` or an object:
    - `condition` - The name of the reason
    - `text` - A freeform description of the reason
    - `alternativeSession` - If the condition is `alternative-session`, this is the `sid` value for that session.
- `silent` - If `true`, the session terminate message will not be generated to be sent to the peer.

The list of valid `reason` (or `reason.condition`) values:

- `alternative-session`
- `busy`
- `cancel`
- `connectivity-error`
- `decline`
- `expired`
- `failed-application`
- `failed-transport`
- `general-error`
- `gone`
- `incompatible-parameters`
- `media-error`
- `security-error`
- `success`
- `timeout`
- `unsupported-applications`
- `unsupported-transports`

See [XEP-0166: Jingle Section 7.4](http://xmpp.org/extensions/xep-0166.html#def-reason) for more information on when each reason condition should be used.

```js
// End sessions with a peer because we've successfully finished them.
manager.endPeerSessions('otheruser@theirdomain.example', 'success');
```

#### `manager.process(packet)`

- `packet` - An object representing an action to process & apply to a session.
    - `from`
    - `to`
    - `id`
    - `type`
    - `jingle`
        - `sid`
        - `action`
        - `contents`
    - `error`
        - `condition`
        - `jingleCondition`


```js
manager.process({
    to: 'my@mydomain.example',
    from: 'otheruser@theirdomain.example',
    id: '123',
    type: 'set',
    jingle: {
        sid: 'sidABC',
        action: 'session-initiate',
        contents: [
            {
                description: {descType: 'stub'},
                transport: {transType: 'stub'}
            }
        ]
    }
});
```

### `SessionManager` Events
#### `createdSession`
#### `error`
#### `incoming`
#### `outgoing`
#### `send`
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
