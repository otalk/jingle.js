var _ = require('underscore');
var util = require('util');
var bows = require('bows');
var JingleSession = require('./genericSession');
var RTCPeerConnection = require('rtcpeerconnection');


var log = bows('JingleMedia');


function MediaSession(opts) {
    JingleSession.call(this, opts);

    var self = this;

    var config = this.parent.config.peerConnectionConfig;
    var constraints = this.parent.config.peerConnectionConstraints;
    config.useJingle = true;

    this.pc = new RTCPeerConnection(config, constraints);
    this.pc.on('ice', this._onIceCandidate.bind(this));
    this.pc.on('addStream', this._onStreamAdded.bind(this));
    this.pc.on('removeStream', this._onStreamRemoved.bind(this));
    this.pc.on('iceConnectionStateChange', function () {
        switch (self.pc.iceConnectionState) {
        case 'failed':
            // currently, in chrome only the initiator goes to failed
            // so we need to signal this to the peer
            if (self.pc.isInitiator) {
                self.parent.emit('iceFailed', self);
            }
            break;
        }
    });

    if (opts.stream) {
        this.pc.addStream(opts.stream);
        this.localStream = opts.stream;
    } else if (this.parent.localStream) {
        this.pc.addStream(this.parent.localStream);
        this.localStream = this.parent.localStream;
    } else {
        this.parent.once('localStream', function (stream) {
            self.pc.addStream(stream);
            this.localStream = stream;
        });
    }
}

util.inherits(MediaSession, JingleSession);


Object.defineProperty(MediaSession.prototype, 'streams', {
    get: function () {
        return this.pc.remoteStreams;
    }
});


MediaSession.prototype = _.extend(MediaSession.prototype, {
    start: function (constraints) {
        var self = this;
        this.state = 'pending';
        this.pc.isInitiator = true;
        this.pc.offer(constraints, function (err, sessDesc) {
            // a workaround for missing a=sendonly
            // https://code.google.com/p/webrtc/issues/detail?id=1553
            if (constraints && constraints.mandatory) {
                sessDesc.jingle.contents.forEach(function (content) {
                    if (!content.description || content.description.descType !== 'rtp') {
                        return;
                    }
                    if (!constraints.mandatory.OfferToReceiveAudio &&
                            content.description.media === 'audio') {
                        content.senders = 'initiator';
                    }
                    if (!constraints.mandatory.OfferToReceiveVideo &&
                            content.description.media === 'video') {
                        content.senders = 'initiator';
                    }
                });
            }
            self.send('session-initiate', sessDesc.jingle);
        });
    },
    end: function (reason, silence) {
        var self = this;
        this.pc.close();
        _.each(this.streams, function (stream) {
            self._onStreamRemoved({stream: stream});
        });
        JingleSession.prototype.end.call(this, reason, silence);
    },
    accept: function () {
        var self = this;

        log(this.sid + ': Accepted incoming session');

        this.state = 'active';
        this.pc.answer(function (err, answer) {
            if (err) {
                return log(self.sid + ': Could not create WebRTC answer', err);
            }
            self.send('session-accept', answer.jingle);
        });
    },
    ring: function () {
        log(this.sid + ': Ringing on incoming session');
        this.send('session-info', {ringing: true});
    },
    mute: function (creator, name) {
        log(this.sid + ': Muting');
        this.send('session-info', {mute: {creator: creator, name: name}});
    },
    unmute: function (creator, name) {
        log(this.sid + ': Unmuting');
        this.send('session-info', {unmute: {creator: creator, name: name}});
    },
    hold: function () {
        log(this.sid + ': Placing on hold');
        this.send('session-info', {hold: true});
    },
    resume: function () {
        log(this.sid + ': Resuing from hold');
        this.send('session-info', {active: true});
    },
    onSessionInitiate: function (changes, cb) {
        var self = this;

        log(self.sid + ': Initiating incoming session');

        this.state = 'pending';
        this.pc.isInitiator = false;
        this.pc.handleOffer({type: 'offer', jingle: changes}, function (err) {
            if (err) {
                log(self.sid + ': Could not create WebRTC answer', err);
                return cb({condition: 'general-error'});
            }
            cb();
        });
    },
    onSessionAccept: function (changes, cb) {
        var self = this;

        log(this.sid + ': Activating accepted outbound session');

        this.state = 'active';
        this.pc.handleAnswer({type: 'answer', jingle: changes}, function (err) {
            if (err) {
                log(self.sid + ': Could not process WebRTC answer', err);
                return cb({condition: 'general-error'});
            }

            self.parent.emit('accepted', self);
            cb();
        });
    },
    onSessionTerminate: function (changes, cb) {
        var self = this;
        log(this.sid + ': Terminating session');
        this.pc.close();
        _.each(this.streams, function (stream) {
            self._onStreamRemoved({stream: stream});
        });
        JingleSession.prototype.end.call(this, changes.reason, true);
        cb();
    },
    onTransportInfo: function (changes, cb) {
        var self = this;

        log(this.sid + ': Adding ICE candidate');

        this.pc.processIce(changes, function (err) {
            if (err) {
                log(self.sid + ': Could not process ICE candidate', err);
            }
            cb();
        });
    },
    onSessionInfo: function (info, cb) {
        log(info);
        if (info.ringing) {
            log(this.sid + ': Ringing on remote stream');
            this.parent.emit('ringing', this);
        }

        if (info.hold) {
            log(this.sid + ': On hold');
            this.parent.emit('hold', this);
        }

        if (info.active) {
            log(this.sid + ': Resumed from hold');
            this.parent.emit('resumed', this);
        }

        if (info.mute) {
            log(this.sid + ': Muted', info.mute);
            this.parent.emit('mute', this, info.mute);
        }

        if (info.unmute) {
            log(this.sid + ': Unmuted', info.unmute);
            this.parent.emit('unmute', this, info.unmute);
        }

        cb();
    },
    _onIceCandidate: function (candidateInfo) {
        log(this.sid + ': Discovered new ICE candidate', candidateInfo.jingle);
        this.send('transport-info', candidateInfo.jingle);
    },
    _onStreamAdded: function (event) {
        log(this.sid + ': Remote media stream added');

        // unfortunately, firefox does not support this yet
        /*
        event.stream.onended = function () {
            self._onStreamRemoved({stream: event.stream});
        };
        */

        this.parent.emit('peerStreamAdded', this, event.stream);
    },
    _onStreamRemoved: function (event) {
        log(this.sid + ': Remote media stream removed');
        this.parent.emit('peerStreamRemoved', this, event.stream);
    }
});


module.exports = MediaSession;
