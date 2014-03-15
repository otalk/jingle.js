# Jingle WebRTC

## Example

    var conn = new RealtimeConnection(); // stanza.io, xmpp-ftw, strophe, etc
    var jingle = new Jingle();
    var attachMediaStream = require('attachmediastream');

    jingle.on('localStream', function (stream) {
        attachMediaStream(stream, document.getElementById('localVideo'), {
            mirror: true,
            muted: true
        });
    });

    jingle.on('send', function (data) {
         conn.send(data);
    });

    jingle.on('peerStreamAdded', function (session, stream) {
         attachMediaStream(stream, document.getElementById('remoteVideo'));
    });

    // Answering a call request.
    jingle.on('incoming', function (session) {
         session.accept(); // Or display an incoming call banner, etc
    });

    // Starting an A/V session.
    jingle.startLocalMedia(null, function () {
        var sess = jingle.createMediaSession('peer@example.com/resouce');
        sess.start();
    });

## Installing

```sh
$ npm install jingle
```

## Building bundled/minified version (for AMD, etc)

```sh
$ grunt
```

The bundled and minified files will be in the generated `build` directory.

## License

MIT

## Created by

If you like this, follow [@lancestout](http://twitter.com/lancestout) or [@hcornflower](http://twitter.com/hcornflower) on twitter.
