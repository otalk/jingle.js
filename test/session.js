var test = require('tape');
var util = require('util');
var SessionManager = require('../');
var GenericSession = require('jingle-session');


// We need a Stub Session that acts more like how we'd
// expect real session types to work, instead of ending
// itself when trying to start/accept like the GenericSession.
var StubSession = function (opts) {
    GenericSession.call(this, opts);
};

util.inherits(StubSession, GenericSession);

StubSession.prototype.start = function () {
    this.state = 'pending';
    this.send('session-initiate', {
        contents: [
            {
                description: {descType: 'stub'},
                transport: {transType: 'stub'}
            }
        ]
    });
};

StubSession.prototype.accept = function () {
    this.state = 'active';
    this.send('session-accept', {
        contents: [
            {
                description: {descType: 'stub'},
                transport: {transType: 'stub'}
            }
        ]
    });
};


test('Test accepting base session', function (t) {
    t.plan(3);

    var jingle = new SessionManager({
        jid: 'zuser@example.com'
    });

    var sentResult = false;
    jingle.on('send', function (data) {
        if (!sentResult) {
            t.same(data, {
                to: 'peer@example.com',
                id: '123',
                type: 'result'
            });
            sentResult = true;
        } else {
            // The GenericSession instance doesn't allow for accepting
            // sessions, so we'll test that we successfully terminated
            // the session instead.
            t.same(data, {
                to: 'peer@example.com',
                type: 'set',
                jingle: {
                    sid: 'sid123',
                    action: 'session-terminate',
                    reason: {
                        condition: 'unsupported-applications'
                    }
                }
            });
        }
    });

    jingle.on('incoming', function (session) {
        t.ok(session);
        session.accept();
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

test('Test accepting stub session', function (t) {
    t.plan(3);

    var jingle = new SessionManager({
        jid: 'zuser@example.com',
        prepareSession: function (meta) {
            if (meta.descriptionTypes.indexOf('stub') >= 0) {
                return new StubSession(meta);
            }
        }
    });

    var sentResult = false;
    jingle.on('send', function (data) {
        if (!sentResult) {
            t.same(data, {
                to: 'peer@example.com',
                id: '123',
                type: 'result'
            });
            sentResult = true;
        } else {
            t.same(data, {
                to: 'peer@example.com',
                type: 'set',
                jingle: {
                    sid: 'sid123',
                    action: 'session-accept',
                    contents: [
                        {
                            description: {descType: 'stub'},
                            transport: {transType: 'stub'}
                        }
                    ]
                }
            });
        }
    });

    jingle.on('incoming', function (session) {
        t.ok(session);
        session.accept();
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
                    description: {descType: 'stub'},
                    transport: {transType: 'stub'}
                }
            ]
        }
    });
});

test('Test starting base session', function (t) {
    t.plan(2);

    var jingle = new SessionManager({
        jid: 'zuser@example.com'
    });

    var sess = new GenericSession({
        peer: 'peer@example.com',
        initiator: true
    });

    // Base sessions can't be started, and will terminate
    // on .start()
    jingle.on('terminated', function (session) {
        t.equal(session.sid, sess.sid);
        t.ok(session.ended);
    });

    jingle.addSession(sess);
    sess.start();
});

test('Test starting stub session', function (t) {
    t.plan(6);

    var jingle = new SessionManager({
        jid: 'zuser@example.com'
    });

    var sess = new StubSession({
        peer: 'peer@example.com',
        initiator: true
    });

    jingle.on('send', function (data) {
        t.same(data, {
            to: 'peer@example.com',
            type: 'set',
            jingle: {
                sid: sess.sid,
                action: 'session-initiate',
                contents: [
                    {
                        description: {descType: 'stub'},
                        transport: {transType: 'stub'}
                    }
                ]
            }
        });
    });

    jingle.on('outgoing', function (session) {
        t.equal(session.sid, sess.sid);
        t.equal(session.state, 'pending');
        t.ok(session.pending, true);
        t.notOk(session.active);
        t.notOk(session.ended);
    });

    jingle.addSession(sess);
    sess.start();
});

test('Test declining a session', function (t) {
    t.plan(3);

    var jingle = new SessionManager({
        jid: 'zuser@example.com',
        prepareSession: function (meta) {
            if (meta.descriptionTypes.indexOf('stub') >= 0) {
                return new StubSession(meta);
            }
        }
    });

    var sentResult = false;
    jingle.on('send', function (data) {
        if (!sentResult) {
            t.same(data, {
                to: 'peer@example.com',
                id: '123',
                type: 'result'
            });
            sentResult = true;
        } else {
            t.same(data, {
                to: 'peer@example.com',
                type: 'set',
                jingle: {
                    sid: 'sid123',
                    action: 'session-terminate',
                    reason: {
                        condition: 'decline'
                    }
                }
            });
        }
    });

    jingle.on('incoming', function (session) {
        t.ok(session);
        session.decline();
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
                    description: {descType: 'stub'},
                    transport: {transType: 'stub'}
                }
            ]
        }
    });
});

test('Test cancelling a pending session', function (t) {
    t.plan(2);

    var jingle = new SessionManager({
        jid: 'zuser@example.com'
    });

    var sess = new StubSession({
        peer: 'peer@example.com',
        initiator: true
    });

    var started = false;
    jingle.on('send', function (data) {
        if (!started) {
            t.same(data, {
                to: 'peer@example.com',
                type: 'set',
                jingle: {
                    sid: sess.sid,
                    action: 'session-initiate',
                    contents: [
                        {
                            description: {descType: 'stub'},
                            transport: {transType: 'stub'}
                        }
                    ]
                }
            });
            started = true;
        } else {
            t.same(data, {
                to: 'peer@example.com',
                type: 'set',
                jingle: {
                    sid: sess.sid,
                    action: 'session-terminate',
                    reason: {
                        condition: 'cancel'
                    }
                }
            });
        }
    });

    jingle.addSession(sess);
    sess.start();
    sess.cancel();
});

test('Test ending a session (successful session)', function (t) {
    t.plan(4);

    var jingle = new SessionManager({
        jid: 'zuser@example.com'
    });

    var sess = new StubSession({
        peer: 'peer@example.com',
        initiator: true
    });

    jingle.addSession(sess);

    sess.state = 'active';

    jingle.on('send', function (data) {
        t.same(data, {
            to: 'peer@example.com',
            type: 'set',
            jingle: {
                sid: sess.sid,
                action: 'session-terminate',
                reason: {
                    condition: 'success'
                }
            }
        });
    });

    jingle.on('terminated', function (session) {
        t.equal(session.sid, sess.sid);
        t.ok(session.ended);
        t.notOk(session.active);
    });

    sess.end();
});

test('Test ending a session (non-successful session)', function (t) {
    t.plan(6);

    var jingle = new SessionManager({
        jid: 'zuser@example.com'
    });

    var sess = new StubSession({
        peer: 'peer@example.com',
        initiator: true
    });

    jingle.addSession(sess);

    sess.state = 'active';

    jingle.on('send', function (data) {
        t.same(data, {
            to: 'peer@example.com',
            type: 'set',
            jingle: {
                sid: sess.sid,
                action: 'session-terminate',
                reason: {
                    condition: 'failed-application',
                    text: 'not working'
                }
            }
        });
    });

    jingle.on('terminated', function (session) {
        t.equal(session.sid, sess.sid);
        t.ok(session.ended);
        t.notOk(session.starting);
        t.notOk(session.active);
        t.notOk(session.pending);
    });

    sess.end({
        condition: 'failed-application',
        text: 'not working'
    });
});

test('Test pending actions', function (t) {
    var jingle = new SessionManager({
        jid: 'zuser@example.com'
    });

    var sess = new StubSession({
        sid: 'sid123',
        peer: 'peer@example.com',
        initiator: true
    });

    jingle.addSession(sess);

    sess.state = 'active';

    t.notOk(sess.pendingAction);

    sess.send('transport-replace');

    t.equal(sess.pendingAction, 'transport-replace');

    jingle.process({
        type: 'result',
        from: 'peer@example.com',
        jingle: {
            sid: 'sid123'
        }
    });

    t.notOk(sess.pendingAction);

    sess.send('transport-replace');

    t.equal(sess.pendingAction, 'transport-replace');

    jingle.process({
        type: 'error',
        from: 'peer@example.com',
        jingle: {
            sid: 'sid123'
        }
    });

    t.notOk(sess.pendingAction);

    t.end();
});


test('Test connectionState', function (t) {
    t.plan(13);

    var sess = new StubSession({
        sid: 'sid123',
        peer: 'peer@example.com',
        initiator: true
    });

    sess.on('change:connectionState', function () {
        t.ok(sess.connectionState);
    });

    t.equal(sess.connectionState, 'starting');

    // Should only trigger a change event once
    sess.connectionState = 'connecting';
    sess.connectionState = 'connecting';
    sess.connectionState = 'connecting';
    sess.connectionState = 'connecting';
    sess.connectionState = 'connecting';

    t.ok(sess.connecting);
    t.equal(sess.connectionState, 'connecting');

    sess.connectionState = 'connected';

    t.ok(sess.connected);
    t.equal(sess.connectionState, 'connected');

    sess.connectionState = 'disconnected';

    t.ok(sess.disconnected);
    t.equal(sess.connectionState, 'disconnected');

    sess.connectionState = 'interrupted';

    t.ok(sess.interrupted);
    t.equal(sess.connectionState, 'interrupted');
});
