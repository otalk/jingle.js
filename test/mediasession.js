var test = require('tape');
var SessionManager = require('../');
var adapter = require('webrtc-adapter-test'); // jshint ignore:line

function setupSessionManagers() {
    var jingleA = new SessionManager({
        jid: 'userA@example.com/foo'
    });
    var queueA = [];
    var jingleB = new SessionManager({
        jid: 'userB@example.com/bar'
    });
    var queueB = [];
    
    jingleA.on('send', function (data) {
        data.from = jingleA.jid;
        queueB.push(data);
        window.setTimeout(function() {
            var data = queueB.shift();
            if (data) {
                jingleB.process(data);
            }
        }, 0);
    });
    jingleB.on('send', function (data) {
        data.from = jingleB.jid;
        queueA.push(data);
        window.setTimeout(function() {
            var data = queueA.shift();
            if (data) {
                jingleA.process(data);
            }
        }, 0);
    });
    return [jingleA, jingleB];
}

test('Test bidirectional AV session', function (t) {
    var managers = setupSessionManagers();
    navigator.mediaDevices.getUserMedia({audio: true, video: true, fake: true})
    .then(function (stream) {
        t.pass('got media stream');

        managers[1].on('incoming', function (session) {
            t.pass('peer got incoming session');
            // testing bidirectional here
            session.addStream(stream);
            session.accept();
        });

        var sess = managers[0].createMediaSession(managers[1].jid);
        sess.addStream(stream);
        t.pass('added stream to session');
        sess.start();
        t.pass('started session');
        sess.on('change:sessionState', function () {
            if (sess.state === 'active') {
                t.pass('session was accepted');
            }
        });
        sess.on('change:connectionState', function () {
            if (sess.connectionState === 'connected') {
                t.pass('P2P connection established');
                t.end();
            }
        });
    })
    .catch(function (err) {
        t.fail('getUserMedia error' + err.toString());
    });
});
