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
    - [`session.on<SessionAction>(data, cb)`](#sessiononsessionactiondata-cb)


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

- `reason` - Why the sessions are being ended (see [`session.end()`](#sessionend) for the list of available reasons).
- `silent` - If `true`, then session terminating messages will not be generated to be sent to the peers. This is only intended for cases where you've lost network connection and would not be able to send those messages anyway.

```js
// End all sessions because we're about to go offline
manager.endAllSessions('gone');
```

#### `manager.endPeerSessions(peer, [reason], [silent])`

- `peer` - Either the `{JID}` or `{String}` value of the peer's ID.
- `reason` - Why the session is being ended (see [`session.end()`](#sessionend) for the list of available reasons).
- `reason` - Why the session is being ended. This may be either a `{String}` or an object:
    - `condition` - The name of the reason
    - `text` - A freeform description of the reason
    - `alternativeSession` - If the condition is `alternative-session`, this is the `sid` value for that session.
- `silent` - If `true`, the session terminate message will not be generated to be sent to the peer.

```js
// End sessions with a peer because we've successfully finished them.
manager.endPeerSessions('otheruser@theirdomain.example', 'success');
```

#### `manager.process(packet)`

- `packet` - An object representing an action to process & apply to a session.
    - `from` - The ID for the peer which sent the packet
    - `to` - Optional, this should be the ID for the session manager
    - `id` - ID of the packet
    - `type` - One of: `set`, `result`, or `error`
    - `jingle` - This is the data that will be forwarded to the matching session
        - `sid` - The session ID
        - `action` - The action for the session to perform, using the data in `jingle`
        - `contents` -
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
#### `incoming`

The `incoming` event is triggered when a session initiation request is received from a peer.

```js
manager.on('incoming', function (session) {
    // Auto-accept sessions 
    session.accept(); 
});
```

#### `outgoing`

The `outgoing` event is triggered when a tracked session has its [`.start()`](#sessionstart) method called.

```js
manager.on('outgoing', function (session) {
    renderOutgoingSessionUI(session);
});
```

#### `send`

The `send` event provides a Jingle packet suitable for sending to the peer. Each packet includes some routing information, an optional Jingle payload, and an optional error payload.

```js
manager.on('send', function (data) {
    realtimeConnection.send(data, function (err, result) {
        // We want to process both successful acks, and errors
        var resp = err || result;

        // Ensure that we have the sid included in the ack so
        // that it routes properly to the correct session.
        resp.jingle = resp.jingle || {};
        resp.jingle.sid = data.jingle.sid;

        // Process the ack response
        manager.process(resp);
    });
});
```

#### `terminated`

The `terminated` event is triggered when a session has been ended, either locally via the session's [`.end()`](#sessionendreason-silent) method, or from a session terminate action from the peer.

```js
manager.on('terminated', function (session) {
    closeSessionUI();
});
```

#### `log:[error|debug|info]`

Log messages can be listened for with the `log:error`, `log:debug`, and `log:info` events.

```js
manager.on('log:*', function (logLevel, msg) {
    console.log(logLevel, msg);
});
```

## `Jingle.BaseSession`

The `BaseSession` class is intended to be a common base for covering the general requirements of a Jingle session. Subclasses of `BaseSession` are needed to actually do interesting things, such as media or file transfer.

### `new BaseSession(opts)`

- `opts` - An object summarizing the information in the session initiate request, suitable for passing directly to a session class constructor:
    - `sid` - The ID for the session, as provided by the initiating peer.
    - `peer` - The JID for the initiating peer (may be either a `{String}` or [`{JID}`](https://github.com/otalk/xmpp-jid)).
    - `peerID` - An alternative to `peer`, which MUST be a `{String}` (derived from `peer`).
    - `initiator` - This will always be `false`, as we are the one receiving the initiation request.
    - `descriptionTypes` - An array of content description names.
    - `transportTypes` - An array of content transport names.

### `BaseSession` Properties

- `sid` - A unique ID for the session.
- `peer` - The JID for the initiating peer (may be either a `{String}` or [`{JID}`](https://github.com/otalk/xmpp-jid)).
- `peerID` - An alternative to `peer`, which MUST be a `{String}` (derived from `peer`).
- `state` - Always one of:
    - `starting`
    - `pending`
    - `active`
    - `ended`
- `connectionState` - Always one of:
    - `starting`
    - `connecting`
    - `connected`
    - `disconnected`
    - `interrupted`
- `pendingAction` - The name of the action that has just been sent to the peer, so we can check for tie-breaking if the same action is requested from both parties at the same time.
- `pendingDescriptionTypes` - The list of content types gathered from a session initiate request, so that we can perform tie-breaking if another session initiation request is received for the same content types.
- `isInitiator` - This flag is `true` if the `initiator` field is `true` when creating the session.
- `isStarting` - This flag is `true` when `.state` equals `'starting'`.
- `isPending` - This flag is `true` when `.state` equals `'pending'`.
- `isActive` - This flag is `true` when `.state` equals `'active'`.
- `isEnded` - This flag is `true` when `.state` equals `'ended'`.
- `isConnecting` - This flag is `true` when `.connectionState` equals `'connecting'`.
- `isConnected` - This flag is `true` when `.connectionState` equals `'connected'`.
- `isDisconnected` - This flag is `true` when `.connectionState` equals `'disconnected'`.
- `isInterrupted` - This flag is `true` when `.connectionState` equals `'interrupted'`.

### `BaseSession` Methods

#### `session.process(action, data, cb)`
- `action` - The session action to apply to the session.
- `data` - The contents of the `jingle` field of a Jingle packet.
- `cb([err])` - callback for returning potential errors, and triggering processing for the next queued action.
    - `err` - An error object if the action could not be performed
        - `condition` - The general error condition
        - `jingleCondition` - A Jingle specific error condition, if applicable

Calling this method places the action and its associated data and callback into the session's processing queue.

Each action is processed sequentially, calling `cb()` to trigger sending an ack result to the peer, and then process the next action. If `cb()` is given an error object, an error response will be sent to the peer.

This method is not intended to be called directly by the user, but is a required method for any `Session` instance to be able to work with the session manager.

#### `session.send(action, data)`

- `action` - The session action the peer should perform based on this request.
- `data` - Information to insert into the `jingle` section of the packet. The `sid` and `action` fields will be automatically set.

Emits a `send` event for a new Jingle packet:

```js
// Send a session terminate message directly:
session.send('session-terminate', {
    reason: {
        condition: 'gone'
    }
});

// emitted send event: {
//    to: 'otherpeer@theirdomain.example',
//    type: 'set',
//    jingle: {
//        sid: 'sid123',
//
//        // the provided action:
//        action: 'session-terminate',
//
//        // the provided data:
//        reason: {
//            condition: 'gone'
//        }
//    }
//}
```

#### `session.start()`

Initiate a the session request to the peer. Calling this method will move the session from the `starting` state to `pending`, and will trigger an `outgoing` event on the session manager.

The session should have been added to the session manager with [`.addSession()`](#manageraddsessionsession) before calling `.start()`.

```js
var session = new MyCustomSession({
    peer: 'otheruser@theirdomain.example',
    initiator: true
});

manager.addSession(session);
manager.on('outgoing', function (sess) {
    console.log('Outgoing session:', sess.sid === session.sid);
});

session.start();
// -> Outgoing session: true
```

#### `session.accept()`

Moves the session to the `active` state, and sends a `session-accept` action.

For a `BaseSession` instance, this actually calls `.end('unsupported-applications')`.

```js
manager.on('incoming', function (session) {
    // Auto-accept an incoming session
    session.accept();
});
```

#### `session.cancel()`

This is a shortcut for calling `session.end('cancel')`.

Calling `session.cancel()` should only be done after initiating the session and before it is accepted by the peer. After that point, calling `session.end()` is more appropriate.

#### `session.decline()`

This is a shortcut for calling `session.end('decline')`.

Calling `session.decline()` should only be done after receiving a session initiation request and before (or rather, instead of) accepting the session.

#### `session.end([reason], [silent])`

- `reason` - Why the session is being ended. This may be either a `{String}` or an object:
    - `condition` - The name of the reason
    - `text` - A freeform description of the reason
    - `alternativeSession` - If the condition is `alternative-session`, this is the `sid` value for that session.
- `silent` - If `true`, the session terminate message will not be generated to be sent to the peer.

Once `.end()` is called, the session moves to the `ended` state.

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
// We succesfully used the session, and are now ending it:
session.end('success');

// Declining a session in favor of an existing one:
session.end({
    condition: 'alternative-session',
    alternativeSession: 'othersessionsid'
});
```

#### `session.on<SessionAction>(data, cb)`

- `data` - The `jingle` payload of a Jingle packet
- `cb` - Callback for sending an ack or error to the peer, and allow processing of the next action.

Each session action has a corresponding `onX(data, cb)` method, where `X` is the action name in CamelCase without dashes.

The full list of standard session actions:

- `content-accept`
- `content-add`
- `content-modify`
- `content-reject`
- `content-remove`
- `description-info`
- `session-accept`
- `session-info`
- `session-initiate`
- `session-terminate`
- `transport-accept`
- `transport-info`
- `transport-reject`
- `transport-replace`

See [XEP-0166: Jingle Section 7.2](http://xmpp.org/extensions/xep-0166.html#def-action) for more information on when each action is used.
