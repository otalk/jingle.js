# Jingle WebRTC

## Example

```js
var Jingle = require('jingle');

var conn = new RealtimeConnection(); // stanza.io, xmpp-ftw, strophe, etc
var jingle = new Jingle();
var attachMediaStream = require('attachmediastream');
var localMedia = require('localMedia');

localMedia.on('localStream', function (stream) {
    attachMediaStream(stream, document.getElementById('localVideo'), {
        mirror: true,
        muted: true
    });
});

// Capture incoming Jingle data and feed it to the Jingle
// session manager for processing
conn.on('data', function (data) {
    jingle.process(data);
});

// Capture outgoing Jingle signaling traffic and send it via
// a realtime connection
jingle.on('send', function (data) {
    conn.send(data);
});

jingle.on('peerStreamAdded', function (session, stream) {
    attachMediaStream(stream, document.getElementById('remoteVideo'));
});

// Answering a call request.
jingle.on('incoming', function (session) {
    // attach a media stream if desired
    // session.addStream(localMedia.localStream);
    session.accept(); // Or display an incoming call banner, etc
});

// Starting an A/V session.
localMedia.start(null, function (stream) {
    var sess = jingle.createMediaSession('peer@example.com/resouce');
    sess.addStream(stream);
    sess.start();
});
```
## Integrations
[stanza.io](https://github.com/otalk/stanza.io) and [strophe.jinglejs](https://github.com/sualko/strophe.jinglejs) for integrations of this library.

## Installing

```sh
$ npm install jingle
```

## Building bundled/minified version (for AMD, etc)

```sh
$ make build
```

The bundled and minified files will be in the generated `build` directory.

## Documentation

- [API Reference](docs/Reference.md)

## License

MIT

## Created by

If you like this, follow [@lancestout](http://twitter.com/lancestout) or [@hcornflower](http://twitter.com/hcornflower) on twitter.
