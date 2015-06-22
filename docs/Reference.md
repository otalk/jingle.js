# 1.7.x API Reference

- [`Jingle`](#jinglejingle)
  - [`new Jingle(config)`](#new-jingleconfig)
    - [`prepareSession(opts, [req])`](#preparesessionopts-req)
    - [`performTieBreak(existingSession, req)`](#performtiebreakexistingsession-req)
  - [`Jingle` Methods](#jingle-methods)
    - [`jingle.addICEServer(info)`](#jingleaddiceserverinfo)
    - [`jingle.addSession(session)`](#jingleaddsessionsession)
    - [`jingle.endAllSessions([reason], [silent])`](#jingleendallsessionsreason-silent)
    - [`jingle.endPeerSessions(peer, [reason], [silent])`](#jingleendpeersessionspeer-reason-silent)
    - [`jingle.process(packet)`](#jingleprocesspacket)
  - [`Jingle` Events](#jingle-events)
    - [`send`](#send)
    - [`incoming`](#incoming)
    - [`outgoing`](#outgoing)
    - [`terminated`](#terminated)
    - [`log:[error|debug|info]`](#logerrordebuginfo)

- See also:
  - [`Base Session`](https://github.com/otalk/jingle-session/blob/master/docs/Reference.md)
  - [`Media Session`](https://github.com/otalk/jingle-media-session/blob/master/docs/Reference.md)
  - [`File Transfer Session`](https://github.com/otalk/jingle-filetransfer-session/blob/master/docs/Reference.md)


## `Jingle.Jingle`
### `new Jingle(config)`

Creates a new Jingle session jingle with the following configuration options:

- `jid` - The JID for the entity running the session jingle. May be either a `{String}` or [`{JID}`](https://github.com/otalk/xmpp-jid).
- `selfID` - An optional alternative to `jid`, which MUST be a `{String}`. By default, this is derived from `jid`, if `jid` was provided.
- `iceServers` - An array of known ICE servers. See [`addICEServer()`](#jingleaddiceserverinfo) for the required format of each item.
- `prepareSession` - [See below for how `prepareSession` works](#preparesessionopts-req)
- `performTieBreak` - [See below for how `performTieBreak` works](#performtiebreakexistingsession-req)

```js
var Jingle = require('jingle');
var BaseSession = require('jingle-session');

var jingle = new Jingle({
    jid: 'me@mydomain.example',
    iceServers: [
        {url: 'stun:stun.mydomain.example'}
    ],
    prepareSession: function (opts) {
        return new Session(opts);
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

Returns a `Session` instance of your choosing or a `falsy` value if you wish to fallback to a `BaseSession` instance (the `jingle-session` module).

The `prepareSession()` function allows you to control what type of session is created for a given
incoming session request. If `prepareSession()` is not included when creating the session jingle, or
if your `prepareSession()` function does not return a session, a `BaseSession` will be created for you.

```js
new Jingle.Jingle({
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

#### `performTieBreak(existingSession, req)`

- `existingSession` - A Session object.
- `req` - The incoming session initiation request that triggered the tie break check.

A tie break check is performed when receiving a `session-initiate` if:

- A session in the `pending` state already exists for the peer.
- The existing pending session ID is greater than the one used by the incoming session request

The `performTieBreak()` method allows you to control whether or not the session request is declined to resolve the tie. In some applications, you may wish to allow two simultaneous sessions (e.g., multiple uni-directional video sessions). In others you may wish to allow the tie break to force the use of a single session (e.g., a bidirectional video session).

Returning `true` will trigger the tie break and deny the request; returning `false` will allow the session request to proceed.

### `Jingle` Methods
#### `jingle.addICEServer(info)`

- `info` - Either a `{String}` of the URI of the ICE server, or an object:
    - `url` - The URI of the ICE server
    - `username` - The username for accessing the ICE server
    - `credential` - The password or other shared secret to authenticate the `username` with the ICE server

Saves the URI and any required credentials for an ICE STUN/TURN server for use by *future* sessions.

```js
jingle.addICEServer('stun:stun.l.google.com:19302');
jingle.addICEServer({
    url: 'stun:stun.mydomain.example',
    username: 'ad24lwra',
    credential: '234lamvnerl13k40au35oahfadad'
});
```

#### `jingle.addSession(session)`

- `session` - A `{BaseSession}` (or ideally, a subclass of `BaseSession`) instance

Calling this method allows the Jingle instance to begin tracking the session and route actions to it.

For incoming sessions, this step is already handled for you. Using this method is only necessary for when you are initiating a session yourself.

Relevant events generated by `session` will now be proxied through the Jingle instance.

```js
var session = new MyCustomJingleSession({
    sid: 'sid123',
    peer: 'otheruser@theirdomain.example',
    initiator: true
});

jingle.addSession(session);
```

#### `jingle.endAllSessions([reason], [silent])`

- `reason` - Why the sessions are being ended (see [`session.end()`](#sessionend) for the list of available reasons).
- `silent` - If `true`, then session terminating messages will not be generated to be sent to the peers. This is only intended for cases where you've lost network connection and would not be able to send those messages anyway.

```js
// End all sessions because we're about to go offline
jingle.endAllSessions('gone');
```

#### `jingle.endPeerSessions(peer, [reason], [silent])`

- `peer` - Either the `{JID}` or `{String}` value of the peer's ID.
- `reason` - Why the session is being ended (see [`session.end()`](#sessionend) for the list of available reasons).
- `reason` - Why the session is being ended. This may be either a `{String}` or an object:
    - `condition` - The name of the reason
    - `text` - A freeform description of the reason
    - `alternativeSession` - If the condition is `alternative-session`, this is the `sid` value for that session.
- `silent` - If `true`, the session terminate message will not be generated to be sent to the peer.

```js
// End sessions with a peer because we've successfully finished them.
jingle.endPeerSessions('otheruser@theirdomain.example', 'success');
```

#### `jingle.process(packet)`

- `packet` - An object representing an action to process & apply to a session.
    - `from` - The ID for the peer which sent the packet
    - `to` - Optional, this should be the ID for the session jingle
    - `id` - ID of the packet
    - `type` - One of: `set`, `result`, or `error`
    - `jingle` - This is the data that will be forwarded to the matching session
        - `sid` - The session ID
        - `action` - The action for the session to perform, using the data in `jingle`
    - `error` - Optional error object with a condition:
        - `condition` - The type of error
        - `jingleCondition` - A Jingle specific error condition, if applicable

The `.process()` method is the heart of how the Jingle module works. It verifies that the incoming packet is valid (e.g. preventing session hijacking or handling tie-breaking conditions), and then routes the packet to the matching session for further, session-type specific processing.


```js
jingle.process({
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

### `Jingle` Events
#### `incoming`

The `incoming` event is triggered when a session initiation request is received from a peer.

```js
jingle.on('incoming', function (session) {
    // Auto-accept sessions 
    session.accept(); 
});
```

#### `outgoing`

The `outgoing` event is triggered when a tracked session has its [`.start()`](#sessionstart) method called.

```js
jingle.on('outgoing', function (session) {
    renderOutgoingSessionUI(session);
});
```

#### `send`

The `send` event provides a Jingle packet suitable for sending to the peer. Each packet includes some routing information, an optional Jingle payload, and an optional error payload.

```js
jingle.on('send', function (data) {
    realtimeConnection.send(data, function (err, result) {
        // We want to process both successful acks, and errors
        var resp = err || result;

        // Ensure that we have the sid included in the ack so
        // that it routes properly to the correct session.
        resp.jingle = resp.jingle || {};
        resp.jingle.sid = data.jingle.sid;

        // Process the ack response
        jingle.process(resp);
    });
});
```

#### `terminated`

The `terminated` event is triggered when a session has been ended, either locally via the session's [`.end()`](#sessionendreason-silent) method, or from a session terminate action from the peer.

```js
jingle.on('terminated', function (session) {
    closeSessionUI();
});
```

#### `log:[error|debug|info]`

Log messages can be listened for with the `log:error`, `log:debug`, and `log:info` events.

```js
jingle.on('log:*', function (logLevel, msg) {
    console.log(logLevel, msg);
});
```
