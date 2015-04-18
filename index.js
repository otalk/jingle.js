var util = require('util');
var WildEmitter = require('wildemitter');
var webrtc = require('webrtcsupport');

var BaseSession = require('jingle-session');
var MediaSession = require('jingle-media-session');
var FileSession = require('jingle-filetransfer-session');


var defaultDeny = function () {
    console.log(arguments);
    return false;
};


function SessionManager(conf) {
    WildEmitter.call(this);

    conf = conf || {};

    this.jid = conf.jid;
    this.selfID = conf.selfID || (this.jid && this.jid.full) || this.jid || '';

    this.sessions = {};
    this.peers = {};

    this.prepareSession = conf.prepareSession || function (opts) {
        if (opts.descriptionTypes.indexOf('rtp') >= 0) {
            return new MediaSession(opts);
        }
        if (opts.descriptionTypes.indexOf('filetransfer') >= 0) {
            return new FileSession(opts);
        }
    };

    this.trustInitiator = conf.trustInitiator || defaultDeny;
    this.trustResponder = conf.trustResponder || defaultDeny;
    this.checkSessionTie = conf.checkSessionTie || defaultDeny;

    console.log(conf);

    this.screenSharingSupport = webrtc.screenSharing;

    this.capabilities = [
        'urn:xmpp:jingle:1'
    ];
    if (webrtc.support) {
        this.capabilities = [
            'urn:xmpp:jingle:1',
            'urn:xmpp:jingle:apps:rtp:1',
            'urn:xmpp:jingle:apps:rtp:audio',
            'urn:xmpp:jingle:apps:rtp:video',
            'urn:xmpp:jingle:apps:rtp:rtcb-fb:0',
            'urn:xmpp:jingle:apps:rtp:rtp-hdrext:0',
            'urn:xmpp:jingle:apps:rtp:ssma:0',
            'urn:xmpp:jingle:apps:dtls:0',
            'urn:xmpp:jingle:apps:grouping:0',
            'urn:xmpp:jingle:apps:file-transfer:3',
            'urn:xmpp:jingle:transports:ice-udp:1',
            'urn:xmpp:jingle:transports.dtls-sctp:1',
            'urn:ietf:rfc:3264',
            'urn:ietf:rfc:5576',
            'urn:ietf:rfc:5888'
        ];
    }

    this.config = {
        debug: false,
        peerConnectionConfig: {
            iceServers: conf.iceServers || [{'url': 'stun:stun.l.google.com:19302'}]
        },
        peerConnectionConstraints: {
            optional: [
                {DtlsSrtpKeyAgreement: true},
                {RtpDataChannels: false}
            ]
        },
        media: {
            audio: true,
            video: true
        }
    };

    for (var item in conf) {
        this.config[item] = conf[item];
    }

    this.iceServers = this.config.peerConnectionConfig.iceServers;
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

SessionManager.prototype._addSessionForPeer = function (peerID, session) {
    if (!this.peers[peerID]) {
        this.peers[peerID] = [];
    }

    this.peers[peerID].push(session);
};

SessionManager.prototype._removeSessionForPeer = function (peerID, session) {
    var peers = this.peers[peerID] || [];
    if (peers.length) {
        peers.splice(peers.indexOf(session), 1);
    }
};

SessionManager.prototype.addSession = function (session) {
    var self = this;

    var sid = session.sid;
    var peer = session.peerID;

    this.sessions[sid] = session;
    this._addSessionForPeer(peer, session);

    // Automatically clean up tracked sessions
    session.on('terminated', function () {
        self._removeSessionForPeer(peer, session);
        delete self.sessions[sid];
    });

    // Proxy session events
    session.on('*', function (name, data, extraData, extraData2) {
        // Listen for when we actually try to start a session to
        // trigger the outgoing event.
        if (name === 'send') {
            var action = data.jingle && data.jingle.action;
            if (session.isInitiator && action === 'session-initiate') {
                self.emit('outgoing', session);
            }
        }

        if (self.config.debug && (name === 'log:debug' || name === 'log:error')) {
            console.log('Jingle:', data, extraData, extraData2);
        }

        // Don't proxy change:* events, since those don't apply to
        // the session manager itself.
        if (name.indexOf('change') === 0) {
            return;
        }

        self.emit(name, data, extraData, extraData2);
    });

    this.emit('createdSession', session);

    return session;
};

SessionManager.prototype.createMediaSession = function (peer, sid, stream) {
    var session = new MediaSession({
        sid: sid,
        peer: peer,
        initiator: true,
        stream: stream,
        parent: this,
        iceServers: this.iceServers,
        constraints: this.config.peerConnectionConstraints
    });

    this.addSession(session);

    return session;
};

SessionManager.prototype.createFileTransferSession = function (peer, sid) {
    var session = new FileSession({
        sid: sid,
        peer: peer,
        initiator: true,
        parent: this
    });

    this.addSession(session);

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
    if (!data.type) {
        data.type = 'cancel';
    }
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
    var sender = req.from;
    var senderID = sender.full || sender;

    var responder = !!req.jingle ? req.jingle.responder : null;
    var initiator = !!req.jingle ? req.jingle.initiator : null;


    if (req.type === 'error') {
        var isTieBreak = req.error && req.error.jingleCondition === 'tie-break';
        if (session && session.pending && isTieBreak) {
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
        if (content.description) {
            return content.description.descType;
        }
    });
    var transportTypes = contents.map(function (content) {
        if (content.transport) {
            return content.transport.transType;
        }
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
        if (session.peerID !== sender || session.ended) {
            this._log('error', 'Session has ended, or action has wrong sender');
            return this._sendError(sender, rid, {
                condition: 'item-not-found',
                jingleCondition: 'unknown-session'
            });
        }

        // Can't accept a session twice
        if (action === 'session-accept' && !session.pending) {
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
        if (session.peerID !== senderID) {
            this._log('error', 'Duplicate sid from new sender');
            return this._sendError(sender, rid, {
                condition: 'service-unavailable'
            });
        }

        // Check if we need to have a tie breaker because both parties
        // happened to pick the same random sid.
        if (session.pending) {
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
    } else if (this.peers[senderID] && this.peers[senderID].length) {
        // Check if we need to have a tie breaker because we already have
        // a different session with this peer that is using the requested
        // content description types.
        for (var i = 0, len = this.peers[senderID].length; i < len; i++) {
            var sess = this.peers[senderID][i];
            if (sess && sess.pending && sess.sid > sid && this.checkSessionTie(sess, descriptionTypes, sender)) {
                // We won the tie breaker
                this._log('info', 'Tie break');
                return this._sendError(sender, rid, {
                    condition: 'conflict',
                    jingleCondition: 'tie-break'
                });
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

        if (!initiator || !this.trustInitiator(sender, initiator)) {
            initiator = req.from;
        }

        session = this._createIncomingSession({
            sid: sid,
            peer: initiator,
            initiator: false,
            parent: this,
            descriptionTypes: descriptionTypes,
            transportTypes: transportTypes,
            iceServers: this.iceServers,
            constraints: this.config.peerConnectionConstraints
        }, req);
    }

    if (action === 'session-accept' && this.trustResponder(sender, responder)) {
        this._removeSessionForPeer(session.peerID, session);

        session.changePeer(responder);

        this._addSessionForPeer(session.peerID, session);
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
