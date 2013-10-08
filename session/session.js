var async = require('async');
var WildEmitter = require('wildemitter');
var JinglePeerConnection = require('jingle-rtcpeerconnection');
var JingleJSON = require('sdp-jingle-json');


function JingleSession(opts) {
    var self = this;
    this.sid = opts.sid || Date.now().toString();
    this.peer = opts.peer;
    this.isInitiator = opts.initiator || false;
    this.state = 'starting';
    this.parent = opts.parent;

    this.processingQueue = async.queue(function (task, next) {
        var action  = task.action;
        var changes = task.changes;
        var cb = task.cb;

        self[action](changes, function (err) {
            cb(err);
            next();
        });
    });
}

JingleSession.prototype = Object.create(WildEmitter.prototype, {
    constructor: {
        value: JingleSession
    }
});


JingleSession.prototype.start = function () {
};

JingleSession.prototype.end = function () {
};

JingleSession.prototype.process = function (action, changes, cb) {
    var self = this;

    var words = action.split('-');
    var method = 'on' + words[0][0].toUpperCase() + words[0].substr(1) + words[1][0].toUpperCase() + words[1].substr(1);

    this.processingQueue.push({
        action: method,
        changes: changes,
        cb: cb
    });
};

JingleSession.prototype.send = function (type, data) {
    data = data || {};
    data.sid = this.sid;
    data.action = type;
    this.parent.emit('send', {
        to: this.peer,
        type: 'set',
        jingle: data
    });
};

Object.defineProperty(JingleSession.prototype, 'starting', {
    get: function () {
        return this.state == 'starting';
    }
});
Object.defineProperty(JingleSession.prototype, 'pending', {
    get: function () {
        return this.state == 'pending';
    }
});
Object.defineProperty(JingleSession.prototype, 'active', {
    get: function () {
        return this.state == 'active';
    }
});
Object.defineProperty(JingleSession.prototype, 'ended', {
    get: function () {
        return this.state == 'ended';
    }
});

JingleSession.prototype.onContentAccept = function (changes, cb) {
    cb();
};

JingleSession.prototype.onContentAdd = function (changes, cb) {
    cb();
};

JingleSession.prototype.onContentModify = function (changes, cb) {
    cb();
};

JingleSession.prototype.onContentReject = function (changes, cb) {
    cb();
};

JingleSession.prototype.onContentRemove = function (changes, cb) {
    cb();
};

JingleSession.prototype.onDescriptionInfo = function (changes, cb) {
    cb();
};

JingleSession.prototype.onSessionAccept = function (changes, cb) {
    cb();
};

JingleSession.prototype.onSessionInfo = function (changes, cb) {
    cb();
};

JingleSession.prototype.onSessionInitiate = function (changes, cb) {
    cb();
};

JingleSession.prototype.onSessionTerminate = function (changes, cb) {
    cb();
};

JingleSession.prototype.onTransportAccept = function (changes, cb) {
    cb();
};

JingleSession.prototype.onTransportInfo = function (changes, cb) {
    cb();
};

JingleSession.prototype.onTransportReject = function (changes, cb) {
    cb();
};

JingleSession.prototype.onTransportReplace = function (changes, cb) {
    cb();
};

module.exports = JingleSession;
