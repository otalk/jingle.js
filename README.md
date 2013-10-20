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

    jingle.on('peerStreamAdded', function (session) {
         attachMediaStream(session.stream, document.getElementById('remoteVideo'));
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
