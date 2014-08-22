var _ = require('underscore');
var util = require('util');
var bows = require('bows');
var JingleSession = require('./genericSession');
var RTCPeerConnection = require('rtcpeerconnection');
var FileTransfer = require('filetransfer');


var log = bows('JingleFile');


function FileSession(opts) {
    JingleSession.call(this, opts);

    var self = this;

    var config = this.parent.config.peerConnectionConfig;
    var constraints = this.parent.config.peerConnectionConstraints;
    config.useJingle = true;

    this.pc = new RTCPeerConnection(config, constraints);
    this.pc.on('addChannel', this._onChannelAdded.bind(this));

    this.pc.on('ice', this._onIceCandidate.bind(this));
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
    this.sender = new FileTransfer.Sender();
    this.sender.on('progress', function (sent, size) {
        log(self.sid + ': Send progress ' + sent + '/' + size);
    });
    this.sender.on('sentFile', function (metadata) {
        log(self.sid + ': Sent file ' + metadata.name);

        // send hash via description update
        var content = self.pc.localDescription.contents[0];
        delete content.transport;
        content.description = {
            descType: 'filetransfer',
            offer: {
                hash: {
                    algo: metadata.algo,
                    value: metadata.hash
                }
            }
        };
        self.send('description-info', { contents: [content] });
        self.parent.emit('sentFile', self, metadata);
    });

    this.receiver = new FileTransfer.Receiver();
    this.receiver.on('receivedFile', function (file) {
        self.receivedFile = file;
        self.maybeReceivedFile();
    });
    this.receiver.on('progress', function (received, size) {
        log(self.sid + ': Receive progress ' + received + '/' + size);
    });
}

util.inherits(FileSession, JingleSession);

FileSession.prototype._onChannelAdded = function (channel) {
    this.receiver.receive(null, channel);
};

FileSession.prototype = _.extend(FileSession.prototype, {
    start: function (file) {
        var self = this;
        this.state = 'pending';
        this.pc.isInitiator = true;
        var sendChannel = this.pc.createDataChannel('filetransfer');
        sendChannel.onopen = function () {
            self.sender.send(file, sendChannel);
        };

        var constraints = { mandatory: {
            OfferToReceiveAudio: false,
            OfferToReceiveVideo: false
        }};
        this.pc.offer(constraints, function (err, sessDesc) {
            // amend xep-0234 info
            sessDesc.jingle.contents[0].description = {
                descType: 'filetransfer',
                offer: {
                    date: file.lastModifiedDate,
                    //desc: '...',
                    name: file.name,
                    //range: null,
                    size: file.size,
                    hash: {
                        algo: 'sha-1',
                        value: ''
                    }
                }
            };
            self.send('session-initiate', sessDesc.jingle);
        });
    },
    end: function (reason, silence) {
        this.pc.close();
        JingleSession.prototype.end.call(this, reason, silence);
    },
    accept: function () {
        var self = this;

        log(this.sid + ': Accepted incoming session');

        this.state = 'active';
        this.pc.answer(function (err, answer) {
            if (err) {
                log(self.sid + ': Could not create WebRTC answer', err);
                return self.end('failed-application');
            }
            // FIXME: do we need to add the 0234 parts again? whyyyyyy...

            // work around firefox...
            answer.jingle.contents[0].name = 'data';

            self.send('session-accept', answer.jingle);
        });
    },
    onSessionInitiate: function (changes, cb) {
        var self = this;

        log(self.sid + ': Initiating incoming session');

        this.state = 'pending';
        this.pc.isInitiator = false;
        // strip XEP-0234 parts
        var desc = changes.contents[0].description;
        this.receiver.metadata = desc.offer.toJSON();

        // set hash used by peer
        if (this.receiver.metadata.hash) {
            this.receiver.config.hash = this.receiver.metadata.hash.algo;
        }
        // FIXME: checks on name, size and maxiumum allowed size

        // then feed to SJJ
        changes.contents[0].description = {
            descType: 'datachannel'
        };
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
        changes.contents[0].description = {
            descType: 'datachannel'
        };
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
        log(this.sid + ': Terminating session');
        this.pc.close();
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
    onDescriptionInfo: function (changes, cb) {
        // ignore anything but the value (which is the only thing that can change in a meaningful way)
        var hash = changes.contents[0].description.offer.hash;
        this.receiver.metadata.hash = hash;
        if (this.receiver.metadata.actualhash) {
            this.maybeReceivedFile();
        } else {
            // file is not yet complete
        }
        cb();
    },
    _onIceCandidate: function (candidateInfo) {
        log(this.sid + ': Discovered new ICE candidate', candidateInfo.jingle);
        candidateInfo.jingle.contents[0].name = 'data';
        this.send('transport-info', candidateInfo.jingle);
    },
    maybeReceivedFile: function () {
        if (!this.receiver.metadata.hash.value) {
            // hash not known yet
        } else if (this.receiver.metadata.hash.value === this.receiver.metadata.actualhash) {
            log(this.sid + ': Hash matches');
            this.parent.emit('receivedFile', this, this.receivedFile, this.receiver.metadata);
            this.end('success');
        } else {
            log(this.sid + ': Hash mismatch, terminating');
            this.end('media-error');
        }
    }
});

module.exports = FileSession;
