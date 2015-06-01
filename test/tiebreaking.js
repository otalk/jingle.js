var test = require('tape');
var SessionManager = require('../');
var GenericSession = require('jingle-session');


test('Test tie-break from duplicate sids', function (t) {
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

    sess.state = 'pending';
    sess.pendingDescriptionTypes = ['test'];

    jingle.on('send', function (data) {
        t.same(data, {
            to: 'peer@example.com',
            id: '123',
            type: 'error',
            error: {
                type: 'cancel',
                condition: 'conflict',
                jingleCondition: 'tie-break'
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

test('Test tie-break from existing session', function (t) {
    t.plan(1);

    var jingle = new SessionManager({
        jid: 'zuser@example.com'
    });

    var sess = new GenericSession({
        sid: 'sid999',
        peer: 'peer@example.com',
        descriptionTypes: ['othertest']
    });
    jingle.addSession(sess);
    sess.state = 'pending';

    var sess2 = new GenericSession({
        sid: 'sid998',
        peer: 'peer@example.com',
        descriptionTypes: ['test']
    });
    jingle.addSession(sess2);
    sess2.state = 'pending';


    jingle.on('send', function (data) {
        t.same(data, {
            to: 'peer@example.com',
            id: '123',
            type: 'error',
            error: {
                type: 'cancel',
                condition: 'conflict',
                jingleCondition: 'tie-break'
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


test('Test tie-break from pending action', function (t) {
    t.plan(1);

    var jingle = new SessionManager({
        jid: 'zuser@example.com'
    });

    var sess = new GenericSession({
        sid: 'sid123',
        peer: 'peer@example.com',
        initiator: true
    });

    // We already sent a session request to the peer
    jingle.addSession(sess);

    sess.state = 'active';
    sess.pendingAction = 'content-modify';

    jingle.on('send', function (data) {
        t.same(data, {
            to: 'peer@example.com',
            id: '123',
            type: 'error',
            error: {
                type: 'cancel',
                condition: 'conflict',
                jingleCondition: 'tie-break'
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
            action: 'content-modify',
            contents: [
                {
                    description: {descType: 'test'},
                    transport: {transType: 'test'}
                }
            ]
        }
    });
});


test('Test terminate session from lost tie-break during startup', function (t) {
    t.plan(1);

    var jingle = new SessionManager({
        jid: 'auser@example.com'
    });

    var sess = new GenericSession({
        sid: 'sid123',
        peer: 'peer@example.com'
    });

    // We already sent a session request to the peer
    jingle.addSession(sess);

    sess.state = 'pending';

    jingle.on('terminated', function (session) {
        t.equal(session.sid, 'sid123');
    });

    jingle.process({
        to: 'auser@example.com',
        from: 'peer@example.com',
        id: '123',
        type: 'error',
        jingle: {
            sid: 'sid123'
        },
        error: {
            type: 'cancel',
            condition: 'conflict',
            jingleCondition: 'tie-break'
        }
    });
});
