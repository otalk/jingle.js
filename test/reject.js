var test = require('tape');
var SessionManager = require('../lib/sessionManager');
var BaseSession = require('../lib/baseSession');


test('Reject content-add by default', function (t) {
    t.plan(2);

    var jingle = new SessionManager({
        jid: 'zuser@example.com'
    });

    var sess = new BaseSession({
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

    var sess = new BaseSession({
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
