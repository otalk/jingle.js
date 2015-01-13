var test = require('tape');
var SessionManager = require('../');
var GenericSession = require('jingle-session');


require('./tiebreaking');
require('./processerrors');
require('./reject');
require('./session');


test('Test session-initiate', function (t) {
    t.plan(2);

    var jingle = new SessionManager({
        jid: 'zuser@example.com'
    });

    jingle.on('send', function (data) {
        t.same(data, {
            to: 'peer@example.com',
            id: '123',
            type: 'result'
        });
    });

    jingle.on('incoming', function (session) {
        t.ok(session);
    });

    jingle.process({
        to: 'zuser@example.com',
        from: 'peer@example.com',
        id: '123',
        type: 'set',
        jingle: {
            sid: 'sid123',
            action: 'session-initiate',
            contents: [
                {
                    description: {descType: 'test'},
                    transport: {transType: 'test'}
                }
            ]
        }
    });
});

test('Test ending sessions for peer', function (t) {
    t.plan(2);

    var jingle = new SessionManager({
        jid: 'zuser@example.com'
    });

    var sess = new GenericSession({
        sid: 'sid123',
        peer: 'peer@example.com'
    });
    jingle.addSession(sess);

    var sess2 = new GenericSession({
        sid: 'sid124',
        peer: 'peer@example.com'
    });
    jingle.addSession(sess2);

    var sess3 = new GenericSession({
        sid: 'sid125',
        peer: 'otherpeer@example.com'
    });
    jingle.addSession(sess3);


    jingle.on('terminated', function (session) {
        t.equal(session.peerID, 'peer@example.com');
    });

    jingle.endPeerSessions('peer@example.com');
});

test('Test ending sessions for peer with no sessions', function (t) {
    var jingle = new SessionManager({
        jid: 'zuser@example.com'
    });

    jingle.endPeerSessions('peer@example.com');

    t.notOk(jingle.peers['peer@example.com']);
    t.end();
});


test('Test ending sessions for all peers', function (t) {
    t.plan(3);

    var jingle = new SessionManager({
        jid: 'zuser@example.com'
    });

    var sess = new GenericSession({
        sid: 'sid123',
        peer: 'peer@example.com'
    });
    jingle.addSession(sess);

    var sess2 = new GenericSession({
        sid: 'sid124',
        peer: 'peer@example.com'
    });
    jingle.addSession(sess2);

    var sess3 = new GenericSession({
        sid: 'sid125',
        peer: 'otherpeer@example.com'
    });
    jingle.addSession(sess3);


    jingle.on('terminated', function (session) {
        t.ok(session);
    });

    jingle.endAllSessions();
});

test('Prepare session', function (t) {
    t.plan(1);

    var jingle = new SessionManager({
        jid: 'zuser@example.com',
        prepareSession: function (meta) {
            t.ok(meta);
            return new GenericSession(meta);
        }
    });

    jingle.process({
        to: 'zuser@example.com',
        from: 'peer@example.com',
        id: '123',
        type: 'set',
        jingle: {
            sid: 'sid123',
            action: 'session-initiate',
            contents: [
                {
                    description: {descType: 'test'},
                    transport: {transType: 'test'}
                }
            ]
        }
    });
});

test('Add ICE server', function (t) {
    var jingle = new SessionManager({
        jid: 'zuser@example.com',
        iceServers: []
    });

    jingle.addICEServer({
        url: 'turn:example.com'
    });
   
    t.same(jingle.iceServers, [
        {url: 'turn:example.com'}
    ]);

    t.end();
});

test('Add ICE server as just a string', function (t) {
    var jingle = new SessionManager({
        jid: 'zuser@example.com',
        iceServers: []
    });

    jingle.addICEServer('turn:example.com');
   
    t.same(jingle.iceServers, [
        {url: 'turn:example.com'}
    ]);

    t.end();
});
