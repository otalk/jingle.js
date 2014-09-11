var util = require('util');
var intersect = require('intersect');
var WildEmitter = require('wildemitter');

var BaseSession = require('./baseSession');


function SessionManager(conf) {
    WildEmitter.call(this);

    this.jid = conf.jid;
    this.selfID = conf.selfID || this.jid.full || this.jid;

    this.sessions = {};
    this.peers = {};

    this.iceServers = conf.iceServers || [];
    this.prepareSession = conf.prepareSession;
}


util.inherits(SessionManager, WildEmitter);


SessionManager.prototype.addICEServer = function (server) {
    // server == {
    //    url: '',
    //    [username: '',]
    //    [credential: '']
    // }
    if (typeof server === 'string') {
        server = {url: server};
    }
    this.iceServers.push(server);
};

SessionManager.prototype.addSession = function (session) {
    var self = this;

    var sid = session.sid;
    var peer = session.peerID;

    this.sessions[sid] = session;
    if (!this.peers[peer]) {
        this.peers[peer] = [];
    }

    this.peers[peer].push(session);

    // Automatically clean up tracked sessions
    session.on('terminated', function () {
        var peers = self.peers[peer] || [];
        if (peers.length) {
            peers.splice(peers.indexOf(session), 1);
        }
        delete self.sessions[sid];
    });

    // Proxy session events
    session.on('*', function (name, data, extraData) {
        // Listen for when we actually try to start a session to
        // trigger the outgoing event.
        if (name === 'send') {
            var action = data.jingle && data.jingle.action;
            if (session.isInitiator && action === 'session-initiate') {
                self.emit('outgoing', session);
            }
        }

        // Don't proxy change:* events, since those don't apply to
        // the session manager itself.
        if (name.indexOf('change') === 0) {
            return;
        }

        if (extraData) {
            self.emit(name, data, extraData);
        } else {
            self.emit(name, data);
        }
    });

    this.emit('createdSession', session);

    return session;
};

SessionManager.prototype.endPeerSessions = function (peer, reason, silent) {
    peer = peer.full || peer;

    var sessions = this.peers[peer] || [];
    delete this.peers[peer];

    sessions.forEach(function (session) {
        session.end(reason || 'gone', silent);
    });
};

SessionManager.prototype.endAllSessions = function (reason, silent) {
    var self = this;
    Object.keys(this.peers).forEach(function (peer) {
        self.endPeerSessions(peer, reason, silent);
    });
};

SessionManager.prototype._createIncomingSession = function (meta, req) {
    var session;

    if (this.prepareSession) {
        session = this.prepareSession(meta, req);
    }

    // Fallback to a generic session type, which can
    // only be used to end the session.

    if (!session) {
        session = new BaseSession(meta);
    }

    this.addSession(session);

    return session;
};

SessionManager.prototype._sendError = function (to, id, data) {
    data.type = 'cancel';
    this.emit('send', {
        to: to,
        id: id,
        type: 'error',
        error: data
    });
};

SessionManager.prototype._log = function (level, message) {
    this.emit('log:' + level, message);
};

SessionManager.prototype.process = function (req) {
    var self = this;

    // Extract the request metadata that we need to verify
    var sid = !!req.jingle ? req.jingle.sid : null;
    var session = this.sessions[sid] || null;
    var rid = req.id;
    var sender = req.from.full || req.from;


    if (req.type === 'error') {
        var isTieBreak = req.error && req.error.jingleCondition === 'tie-break';
        if (session && session.isPending && isTieBreak) {
            return session.end('alternative-session', true);
        } else {
            if (session) {
                session.pendingAction = false;
            }
            return this.emit('error', req);
        }
    }

    if (req.type === 'result') {
        if (session) {
            session.pendingAction = false;
        }
        return;
    }

    var action = req.jingle.action;
    var contents = req.jingle.contents || [];

    var descriptionTypes = contents.map(function (content) {
        return content.description.descType;
    });
    var transportTypes = contents.map(function (content) {
        return content.transport.transType;
    });


    // Now verify that we are allowed to actually process the
    // requested action

    if (action !== 'session-initiate') {
        // Can't modify a session that we don't have.
        if (!session) {
            this._log('error', 'Unknown session', sid);
            return this._sendError(sender, rid, {
                condition: 'item-not-found',
                jingleCondition: 'unknown-session'
            });
        }

        // Check if someone is trying to hijack a session.
        if (session.peerID !== sender || session.isEnded) {
            this._log('error', 'Session has ended, or action has wrong sender');
            return this._sendError(sender, rid, {
                condition: 'item-not-found',
                jingleCondition: 'unknown-session'
            });
        }

        // Can't accept a session twice
        if (action === 'session-accept' && !session.isPending) {
            this._log('error', 'Tried to accept session twice', sid);
            return this._sendError(sender, rid, {
                condition: 'unexpected-request',
                jingleCondition: 'out-of-order'
            });
        }

        // Can't process two requests at once, need to tie break
        if (action !== 'session-terminate' && action === session.pendingAction) {
            this._log('error', 'Tie break during pending request');
            if (session.isInitiator) {
                return this._sendError(sender, rid, {
                    condition: 'conflict',
                    jingleCondition: 'tie-break'
                });
            }
        }
    } else if (session) {
        // Don't accept a new session if we already have one.
        if (session.peerID !== sender) {
            this._log('error', 'Duplicate sid from new sender');
            return this._sendError(sender, rid, {
                condition: 'service-unavailable'
            });
        }

        // Check if we need to have a tie breaker because both parties
        // happened to pick the same random sid.
        if (session.isPending) {
            if (this.selfID > session.peerID) {
                this._log('error', 'Tie break new session because of duplicate sids');
                return this._sendError(sender, rid, {
                    condition: 'conflict',
                    jingleCondition: 'tie-break'
                });
            }
        } else {
            // The other side is just doing it wrong.
            this._log('error', 'Someone is doing this wrong');
            return this._sendError(sender, rid, {
                condition: 'unexpected-request',
                jingleCondition: 'out-of-order'
            });
        }
    } else if (this.peers[sender] && this.peers[sender].length) {
        // Check if we need to have a tie breaker because we already have
        // a different session with this peer that is using the requested
        // content description types.
        for (var i = 0, len = this.peers[sender].length; i < len; i++) {
            var sess = this.peers[sender][i];
            if (sess && sess.isPending) {
                if (intersect(descriptionTypes, sess.pendingDescriptionTypes).length) {
                    // We already have a pending session request for this content type.
                    if (sess.sid > sid) {
                        // We won the tie breaker
                        this._log('info', 'Tie break');
                        return this._sendError(sender, rid, {
                            condition: 'conflict',
                            jingleCondition: 'tie-break'
                        });
                    }
                }
            }
        }
    }

    // We've now weeded out invalid requests, so we can process the action now.

    if (action === 'session-initiate') {
        if (!contents.length) {
            return self._sendError(sender, rid, {
                condition: 'bad-request'
            });
        }

        session = this._createIncomingSession({
            sid: sid,
            peer: req.from,
            peerID: sender,
            initiator: false,
            descriptionTypes: descriptionTypes,
            transportTypes: transportTypes
        }, req);
    }

    session.process(action, req.jingle, function (err) {
        if (err) {
            self._log('error', 'Could not process request', req, err);
            self._sendError(sender, rid, err);
        } else {
            self.emit('send', {
                to: sender,
                id: rid,
                type: 'result',
            });

            // Wait for the initial action to be processed before emitting
            // the session for the user to accept/reject.
            if (action === 'session-initiate') {
                self.emit('incoming', session);
            }
        }
    });
};


module.exports = SessionManager;
