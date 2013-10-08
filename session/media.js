var _ = require('underscore');
var JingleSession = require('./session');
var JinglePeerConnection = require('jingle-rtcpeerconnection');


function MediaSession(opts) {
    JingleSession.call(this, opts);

    this.pc = new JinglePeerConnection(this.parent.config.peerConnectionConfig,
                                       this.parent.config.peerConnectionConstraints);
    this.pc.on('ice', this.onIceCandidate.bind(this));
    this.pc.on('addStream', this.onStreamAdded.bind(this));
    this.pc.on('removeStream', this.onStreamRemoved.bind(this));
    this.pendingAnswer = null;

    this.pc.addStream(this.parent.localStream);

    this.stream = null;
}

MediaSession.prototype = Object.create(JingleSession.prototype, {
    constructor: {
        value: MediaSession
    }
});

MediaSession.prototype = _.extend(MediaSession.prototype, {
    start: function () {
        var self = this;
        this.state = 'pending';
        this.pc.isInitiator = true;
        this.pc.offer(function (err, sessDesc) {
            self.send('session-initiate', sessDesc.json);
        });
    },
    end: function () {
        this.pc.close();
        this.onStreamRemoved();
        this.state = 'ended';
        this.send('session-terminate');
    },
    accept: function () {
        this.send('session-accept', this.pendingAnswer);
    },
    ring: function () {
        this.send('session-info', {ringing: true});
    },
    mute: function (creator, name) {
        this.send('session-info', {mute: {creator: creator, name: name}});
    },
    unmute: function (creator, name) {
        this.send('session-info', {unmute: {creator: creator, name: name}});
    },
    hold: function () {
        this.send('session-info', {hold: true});
    },
    resume: function () {
        this.send('session-info', {active: true});
    },
    onSessionInitiate: function (changes, cb) {
        var self = this;
        this.state = 'pending';
        this.pc.isInitiator = false;
        this.pc.answer({type: 'offer', json: changes}, function (err, answer) {
            if (err) return cb(err);
            self.pendingAnswer = answer.json;
            cb();
        });
    },
    onSessionAccept: function (changes, cb) {
        this.state = 'active';
        this.pc.handleAnswer({type: 'answer', json: changes}, function (err) {
            cb(err);
        });
    },
    onSessionTerminate: function (changes, cb) {
        this.state = 'ended';
        this.pc.close();
        this.onStreamRemoved();
        cb();
    },
    onTransportInfo: function (changes, cb) {
        this.pc.processIce(changes, cb);
    },
    onIceCandidate: function (candidateInfo) {
        this.send('transport-info', candidateInfo);
    },
    onStreamAdded: function (event) {
        if (this.stream) {
        } else {
            this.stream = event.stream;
            this.parent.emit('peerStreamAdded', this);
        }
    },
    onStreamRemoved: function () {
        this.parent.peers.splice(this.parent.peers.indexOf(this), 1);
        this.state = 'ended';
        this.parent.emit('peerStreamRemoved', this);
    }
});


module.exports = MediaSession;
