var test = require('tape');
var SessionManager = require('../');
var GenericSession = require('jingle-session');


test('Reject content-add by default', function (t) {
    t.plan(2);

    var jingle = new SessionManager({
        jid: 'zuser@example.com'
    });

    var sess = new GenericSession({
        sid: 'sid123',
        peer: 'peer@example.com'
    });
    jingle.addSession(sess);
    sess.state = 'active';

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
                    action: 'content-reject',
                    reason: {
                        condition: 'failed-application',
                        text: 'content-add is not supported'
                    }
                }
            });
        }
    });

    jingle.process({
        to: 'zuser@example.com',
        from: 'peer@example.com',
        id: '123',
        type: 'set',
        jingle: {
            sid: 'sid123',
            action: 'content-add',
            contents: [
                {
                    description: {descType: 'test'},
                    transport: {transType: 'test'}
                }
            ]
        }
    });
});

test('Reject transport-replace by default', function (t) {
    t.plan(2);

    var jingle = new SessionManager({
        jid: 'zuser@example.com'
    });

    var sess = new GenericSession({
        sid: 'sid123',
        peer: 'peer@example.com'
    });
    jingle.addSession(sess);
    sess.state = 'active';

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
                    action: 'transport-reject',
                    reason: {
                        condition: 'failed-application',
                        text: 'transport-replace is not supported'
                    }
                }
            });
        }
    });

    jingle.process({
        to: 'zuser@example.com',
        from: 'peer@example.com',
        id: '123',
        type: 'set',
        jingle: {
            sid: 'sid123',
            action: 'transport-replace',
            contents: [
                {
                    description: {descType: 'test'},
                    transport: {transType: 'test'}
                }
            ]
        }
    });
});

test('Return error for unknown session-info action', function (t) {
    t.plan(2);

    var jingle = new SessionManager({
        jid: 'zuser@example.com'
    });

    var sess = new GenericSession({
        sid: 'sid123',
        peer: 'peer@example.com'
    });
    jingle.addSession(sess);
    sess.state = 'active';

    var sentError = false;
    jingle.on('send', function (data) {
        if (!sentError) {
            t.same(data, {
                to: 'peer@example.com',
                id: '123',
                type: 'error',
                error: {
                    type: 'modify',
                    condition: 'feature-not-implemented',
                    jingleCondition: 'unsupported-info'
                }
            });
            sentError = true;
        } else {
            t.same(data, {
                to: 'peer@example.com',
                id: '123',
                type: 'result'
            });
        }
    });

    // Should generate an error because of unknownInfoData
    jingle.process({
        to: 'zuser@example.com',
        from: 'peer@example.com',
        id: '123',
        type: 'set',
        jingle: {
            sid: 'sid123',
            action: 'session-info',
            unknownInfoData: true
        }
    });

    // Should generate a normal ack
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

test('Return error for unknown description-info action', function (t) {
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
                type: 'modify',
                condition: 'feature-not-implemented',
                jingleCondition: 'unsupported-info'
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
            action: 'description-info'
        }
    });
});

test('Return error for unknown transport-info action', function (t) {
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
                type: 'modify',
                condition: 'feature-not-implemented',
                jingleCondition: 'unsupported-info'
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
            action: 'transport-info'
        }
    });
});
