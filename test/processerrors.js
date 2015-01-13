var test = require('tape');
var SessionManager = require('../');
var GenericSession = require('jingle-session');


test('Test session-initiate with no contents fails', function (t) {
    t.plan(1);

    var jingle = new SessionManager({
        jid: 'zuser@example.com'
    });

    jingle.on('send', function (data) {
        t.same(data, {
            to: 'peer@example.com',
            id: '123',
            type: 'error',
            error: {
                type: 'cancel',
                condition: 'bad-request'
            }
        });
    });

    jingle.process({
        to: 'zuser@example.com',
        from: 'peer@example.com',
        id: '123',
        type: 'set',
        jingle: {
            sid: 'sid123',
            action: 'session-initiate',
            contents: []
        }
    });
});

test('Test session action from wrong sender', function (t) {
    t.plan(1);

    var jingle = new SessionManager({
        jid: 'zuser@example.com'
    });

    var sess = new GenericSession({
        sid: 'sid123',
        peer: 'otherpeer@example.com'
    });

    // We already sent a session request to the peer
    jingle.addSession(sess);

    sess.state = 'pending';

    jingle.on('send', function (data) {
        t.same(data, {
            to: 'peer@example.com',
            id: '123',
            type: 'error',
            error: {
                type: 'cancel',
                condition: 'item-not-found',
                jingleCondition: 'unknown-session'
            }
        });
    });

    jingle.process({
        to: 'zuser@example.com',
        from: 'peer@example.com',
        id: '123',
        type: 'set',
        jingle: {
            sid: 'sid123',
            action: 'session-info'
        }
    });
});

test('Duplicate session-accept', function (t) {
    t.plan(1);

    var jingle = new SessionManager({
        jid: 'zuser@example.com'
    });

    var sess = new GenericSession({
        sid: 'sid123',
        peer: 'peer@example.com'
    });

    jingle.addSession(sess);
    sess.state = 'active';

    jingle.on('send', function (data) {
        t.same(data, {
            to: 'peer@example.com',
            id: '123',
            type: 'error',
            error: {
                type: 'cancel',
                condition: 'unexpected-request',
                jingleCondition: 'out-of-order'
            }
        });
    });

    jingle.process({
        to: 'zuser@example.com',
        from: 'peer@example.com',
        id: '123',
        type: 'set',
        jingle: {
            sid: 'sid123',
            action: 'session-accept'
        }
    });
});

test('Session-initiate after session accepted', function (t) {
    t.plan(1);

    var jingle = new SessionManager({
        jid: 'zuser@example.com'
    });

    var sess = new GenericSession({
        sid: 'sid123',
        peer: 'peer@example.com'
    });

    jingle.addSession(sess);
    sess.state = 'active';

    jingle.on('send', function (data) {
        t.same(data, {
            to: 'peer@example.com',
            id: '123',
            type: 'error',
            error: {
                type: 'cancel',
                condition: 'unexpected-request',
                jingleCondition: 'out-of-order'
            }
        });
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

test('Test session action for unknown session', function (t) {
    t.plan(1);

    var jingle = new SessionManager({
        jid: 'zuser@example.com'
    });

    var sess = new GenericSession({
        sid: 'sid123',
        peer: 'otherpeer@example.com'
    });

    // We already sent a session request to the peer
    jingle.addSession(sess);

    sess.state = 'pending';

    jingle.on('send', function (data) {
        t.same(data, {
            to: 'peer@example.com',
            id: '123',
            type: 'error',
            error: {
                type: 'cancel',
                condition: 'item-not-found',
                jingleCondition: 'unknown-session'
            }
        });
    });

    jingle.process({
        to: 'zuser@example.com',
        from: 'peer@example.com',
        id: '123',
        type: 'set',
        jingle: {
            sid: 'sidunknown',
            action: 'session-info'
        }
    });
});

test('Test new session with duplicate sid', function (t) {
    t.plan(1);

    var jingle = new SessionManager({
        jid: 'zuser@example.com'
    });

    var sess = new GenericSession({
        sid: 'sid123',
        peer: 'peer@example.com'
    });

    // We already sent a session request to the peer
    jingle.addSession(sess);

    sess.state = 'active';

    jingle.on('send', function (data) {
        t.same(data, {
            to: 'otherpeer@example.com',
            id: '123',
            type: 'error',
            error: {
                type: 'cancel',
                condition: 'service-unavailable'
            }
        });
    });

    jingle.process({
        to: 'zuser@example.com',
        from: 'otherpeer@example.com',
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

test('Test bad actions', function (t) {
    t.plan(1);

    var jingle = new SessionManager({
        jid: 'zuser@example.com'
    });

    var sess = new GenericSession({
        sid: 'sid123',
        peer: 'peer@example.com'
    });

    // We already sent a session request to the peer
    jingle.addSession(sess);

    sess.state = 'active';

    jingle.on('send', function (data) {
        t.same(data, {
            to: 'peer@example.com',
            id: '123',
            type: 'error',
            error: {
                type: 'cancel',
                condition: 'bad-request'
            }
        });
    });

    jingle.process({
        to: 'zuser@example.com',
        from: 'peer@example.com',
        id: '123',
        type: 'set',
        jingle: {
            sid: 'sid123',
            action: 'welp',
            contents: [
                {
                    description: {descType: 'test'},
                    transport: {transType: 'test'}
                }
            ]
        }
    });
});


