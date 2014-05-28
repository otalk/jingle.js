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
    this.pc.on('ice', this.onIceCandidate.bind(this));
    this.pc.on('addStream', this.onStreamAdded.bind(this));
    this.pc.on('removeStream', this.onStreamRemoved.bind(this));

    if (this.parent.localStream) {
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
    start: function () {
        var self = this;
        this.state = 'pending';
        this.pc.isInitiator = true;
        this.pc.offer(function (err, sessDesc) {
            self.send('session-initiate', sessDesc.jingle);
        });
    },
    end: function (reason) {
        var self = this;
        this.pc.close();
        _.each(this.streams, function (stream) {
            self.onStreamRemoved({stream: stream});
        });
        JingleSession.prototype.end.call(this, reason);
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
            self.onStreamRemoved({stream: stream});
        });
        JingleSession.prototype.end.call(this, changes.reason, true);
        cb();
    },
    onTransportInfo: function (changes, cb) {
        var self = this;

        log(this.sid + ': Adding ICE candidate');

        // demuxing based on content name
        var pc = this.pc;
        if (changes.contents && changes.contents[0].name === 'screen') {
            if (this.pc2.isInitiator) {
                changes.contents[0].name = 'video';
            }
            pc = this.pc2;
        }
        pc.processIce(changes, function (err) {
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
    onIceCandidate: function (candidateInfo) {
        log(this.sid + ': Discovered new ICE candidate', candidateInfo.jingle);
        this.send('transport-info', candidateInfo.jingle);
    },
    onStreamAdded: function (event) {
        log(this.sid + ': Remote media stream added');

        // unfortunately, firefox does not support this yet
        /*
        event.stream.onended = function () {
            self.onStreamRemoved({stream: event.stream});
        };
        */

        this.parent.emit('peerStreamAdded', this, event.stream);
    },
    onStreamRemoved: function (event) {
        log(this.sid + ': Remote media stream removed');
        this.parent.emit('peerStreamRemoved', this, event.stream);
    },

    // experimental multi-peerconnection stuff -- use at your own risk
    addStream: function (stream) {
        var self = this;
        var config = this.parent.config.peerConnectionConfig;
        var constraints = this.parent.config.peerConnectionConstraints;
        config.useJingle = true;

        this.pc2 = new RTCPeerConnection(config, constraints);
        this.pc2.isInitiator = true;
        this.pc2.addStream(stream);
        this.pc2.on('ice', function (candidateInfo) {
            if (candidateInfo.jingle) {
                candidateInfo.jingle.contents[0].name = 'screen';
            }
            self.onIceCandidate(candidateInfo);
        });
        this.pc2.on('addStream', this.onStreamAdded.bind(this));
        this.pc2.on('removeStream', this.onStreamRemoved.bind(this));
        this.pc2.offer({mandatory: {
                OfferToReceiveAudio: false,
                OfferToReceiveVideo: false
            }},
            function (err, sessDesc) {
                delete sessDesc.jingle.groups; // we dont want to be considered part of the bundle

                // FIXME: needs to avoid collisions
                sessDesc.jingle.contents[0].name = 'screen';
                sessDesc.jingle.contents[0].senders = 'initiator';
                self.send('content-add', sessDesc.jingle);
            }
        );
    },
    removeStream: function () {
        // send a content-remove
        this.send('content-remove', {
            action: 'content-remove', 
            contents: [
                {name: 'screen'}
            ]
        });
        if (this.pc2) {
            this.pc2.close();
            delete this.pc2;
        }
    },
    onContentAdd: function (changes, cb) {
        var self = this;
        var config = this.parent.config.peerConnectionConfig;
        var constraints = this.parent.config.peerConnectionConstraints;
        config.useJingle = true;

        this.pc2 = new RTCPeerConnection(config, constraints);
        this.pc2.isInitiator = false;
        this.pc2.on('addStream', this.onStreamAdded.bind(this));
        this.pc2.on('removeStream', this.onStreamRemoved.bind(this));
        this.pc2.on('ice', function (candidateInfo) {
            if (candidateInfo.jingle) {
                candidateInfo.jingle.contents[0].name = 'screen';
            }
            self.onIceCandidate(candidateInfo);
        });
        this.pc2.handleOffer({type: 'offer', jingle: changes}, function (err) {
            if (err) {
                log(self.sid + ': Could not create WebRTC answer', err);
                return cb({condition: 'general-error'});
            }
            cb();
            self.pc2.answer(function (err, sessDesc) {
                self.send('content-accept', sessDesc.jingle);
            });
        });
    },
    onContentAccept: function (changes, cb) {
        var self = this;
        changes.contents[0].name = 'video';
        this.pc2.handleAnswer({type: 'answer', jingle: changes}, function (err) {
            if (err) {
                log(self.sid + ': Could not create WebRTC answer', err);
                return cb({condition: 'general-error'}); // FIXME
            }
            cb();
        });
    },
    onContentRemove: function (changes, cb) {
        var self = this;
        if (this.pc2) {
            this.pc2.getRemoteStreams().forEach(function (stream) {
                self.onStreamRemoved({stream: stream});
            });
            this.pc2.close();
            delete this.pc2;
        }
        cb();
    }
});


module.exports = MediaSession;
