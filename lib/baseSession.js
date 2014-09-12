var util = require('util');
var async = require('async');
var extend = require('extend-object');
var WildEmitter = require('wildemitter');


var ACTIONS = {
    'content-accept': 'onContentAccept',
    'content-add': 'onContentAdd',
    'content-modify': 'onConentModify',
    'content-reject': 'onContentReject',
    'content-remove': 'onContentRemove',
    'description-info': 'onDescriptionInfo',
    'session-accept': 'onSessionAccept',
    'session-info': 'onSessionInfo',
    'session-initiate': 'onSessionInitiate',
    'session-terminate': 'onSessionTerminate',
    'transport-accept': 'onTransportAccept',
    'transport-info': 'onTransportInfo',
    'transport-reject': 'onTransportReject',
    'transport-replace': 'onTransportReplace',

    // Unstandardized actions: might go away anytime without notice
    'source-add': 'onSourceAdd',
    'source-remove': 'onSourceRemove'
};

var STATES = {
    'starting': 'isStarting',
    'pending': 'isPending',
    'active': 'isActive',
    'ended': 'isEnded',
    'connecting': 'isConnecting',
    'connected': 'isConnected',
    'disconnected': 'isDisconnected',
    'interrupted': 'isInterrupted'
};


function BaseSession(opts) {
    WildEmitter.call(this);

    var self = this;

    this.sid = opts.sid || Date.now().toString();
    this.peer = opts.peer;
    this.peerID = opts.peerID || this.peer.full || this.peer;
    this.isInitiator = opts.initiator || false;
    this.state = 'starting';
    this.connectionState = 'starting';

    // We track the intial pending description types in case
    // of the need for a tie-breaker.
    this.pendingDescriptionTypes = opts.descriptionTypes || [];

    this.pendingAction = false;

    // Here is where we'll ensure that all actions are processed
    // in order, even if a particular action requires async handling.
    this.processingQueue = async.queue(function (task, next) {
        var action = task.action;
        var changes = task.changes;
        var cb = task.cb;

        self._log('debug', action);

        if (!ACTIONS[action]) {
            self._log('error', 'Invalid action: ' + action);
            cb({condition: 'bad-request'});
            return next();
        }

        self[ACTIONS[action]](changes, function (err, result) {
            cb(err, result);
            return next();
        });
    });
}


util.inherits(BaseSession, WildEmitter);

// We don't know how to handle any particular content types,
// so no actions are supported.
Object.keys(ACTIONS).forEach(function (action) {
    var method = ACTIONS[action];
    BaseSession.prototype[method] = function (changes, cb) {
        this._log('error', 'Unsupported action: ' + action);
        cb();
    };
});

// Provide some convenience properties for checking
// the session's state.
Object.defineProperties(BaseSession.prototype, {
    state: {
        get: function () {
            return this._sessionState;
        },
        set: function (value) {
            if (value !== this._sessionState) {
                var prev = this._sessionState;
                this._log('info', 'Changing session state to: ' + value);
                this._sessionState = value;
                this.emit('change:sessionState', this, value);
                this.emit('change:' + STATES[value], this, true);
                if (prev) {
                    this.emit('change:' + STATES[prev], this, false);
                }
            }
        }
    },
    connectionState: {
        get: function () {
            return this._connectionState;
        },
        set: function (value) {
            if (value !== this._connectionState) {
                var prev = this._connectionState;
                this._log('info', 'Changing connection state to: ' + value);
                this._connectionState = value;
                this.emit('change:connectionState', this, value);
                this.emit('change:' + STATES[value], this, true);
                if (prev) {
                    this.emit('change:' + STATES[prev], this, false);
                }
            }
        }
    },
    isStarting: {
        get: function () {
            return this._sessionState === 'starting';
        }
    },
    isPending: {
        get: function () {
            return this._sessionState === 'pending';
        }
    },
    isActive: {
        get: function () {
            return this._sessionState === 'active';
        }
    },
    isEnded: {
        get: function () {
            return this._sessionState === 'ended';
        }
    },
    isConnected: {
        get: function () {
            return this._connectionState === 'connected';
        }
    },
    isConnecting: {
        get: function () {
            return this._connectionState === 'connecting';
        }
    },
    isDisconnected: {
        get: function () {
            return this._connectionState === 'disconnected';
        }
    },
    isInterrupted: {
        get: function () {
            return this._connectionState === 'interrupted';
        }
    }
});

BaseSession.prototype = extend(BaseSession.prototype, {
    _log: function (level, message) {
        message = this.sid + ': ' + message;
        this.emit('log:' + level, message);
    },
    
    send: function (action, data) {
        data = data || {};
        data.sid = this.sid;
        data.action = action;
        if (action !== 'session-terminate') {
            this.pendingAction = action;
        }
        this.emit('send', {
            to: this.peer,
            type: 'set',
            jingle: data
        });
    },
    
    process: function (action, changes, cb) {
        this.processingQueue.push({
            action: action,
            changes: changes,
            cb: cb
        });
    },
    
    start: function () {
        this._log('error', 'Can not start base sessions');
        this.end('unsupported-applications', true);
    },
    
    accept: function () {
        this._log('error', 'Can not accept base sessions');
        this.end('unsupported-applications');
    },
    
    cancel: function () {
        this.end('cancel');
    },
    
    decline: function () {
        this.end('decline');
    },
    
    end: function (reason, silent) {
        this.state = 'ended';

        if (!reason) {
            reason = 'success';
        }

        if (typeof reason === 'string') {
            reason = {
                condition: reason
            };
        }
    
        if (!silent) {
            this.send('session-terminate', {
                reason: reason
            });
        }
    
        this.emit('terminated', this, reason);
    },

    // It is mandatory to reply to a session-info action with 
    // an unsupported-info error if the info isn't recognized.
    onSessionInfo: function (changes, cb) {
        cb({
            type: 'modify',
            condition: 'feature-not-implemented',
            jingleCondition: 'unsupported-info'
        });
    },

    // It is mandatory to reply to a description-info action with 
    // an unsupported-info error if the info isn't recognized.
    onDescriptionInfo: function (changes, cb) {
        cb({
            type: 'modify',
            condition: 'feature-not-implemented',
            jingleCondition: 'unsupported-info'
        });
    },

    // It is mandatory to reply to a transport-info action with 
    // an unsupported-info error if the info isn't recognized.
    onTransportInfo: function (changes, cb) {
        cb({
            type: 'modify',
            condition: 'feature-not-implemented',
            jingleCondition: 'unsupported-info'
        });
    },

    // It is mandatory to reply to a content-add action with either
    // a content-accept or content-reject.
    onContentAdd: function (changes, cb) {
        // Allow ack for the content-add to be sent.
        cb();

        this.send('content-reject', {
            reason: {
                condition: 'failed-application',
                text: 'content-add is not supported'
            }
        });
    },

    // It is mandatory to reply to a transport-add action with either
    // a transport-accept or transport-reject.
    onTransportReplace: function (changes, cb) {
        // Allow ack for the transport-replace be sent.
        cb();

        this.send('transport-reject', {
            reason: {
                condition: 'failed-application',
                text: 'transport-replace is not supported'
            }
        });
    }
});


module.exports = BaseSession;
