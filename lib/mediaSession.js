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
    onSourceAdd: function (changes, cb) {
        // note that this method is highly experimental and may 
        // go away without notice
        var self = this;

        // icky stuff that is necessary until chrome 36
        // https://code.google.com/p/webrtc/issues/detail?id=2688
        if (!this.pc || this.pc.iceConnectionState === 'closed') {
            return;
        }
        if (this.pc.iceConnectionState !== 'connected') {
            this.waitForUpdate = true;
            window.setTimeout(function () {
                self.onSourceAdd(changes, cb);
            }, 250);
            return;
        }
        if (this.waitForUpdate) {
            delete this.waitForUpdate;
            window.setTimeout(function () {
                self.onSourceAdd(changes, cb);
            }, 500);
            return;
        }
        
        log(this.sid + ': source-add');

        var newDesc = this.pc.remoteDescription;
        this.pc.remoteDescription.contents.forEach(function (content, idx) {
            var desc = content.description;
            var ssrcs = desc.sources || [];

            changes.contents.forEach(function (newcontent) {
                if (content.name !== newcontent.name) {
                    return;
                }
                var newdesc = newcontent.description;
                var newssrcs = newdesc.sources || [];

                newDesc.contents[idx].description.sources = ssrcs.concat(newssrcs);
            });
        });

        // FIXME: this block is pretty reusable, even though sometimes the 
        // order of setRemoteDescription/setLocalDescription should change
        this.pc.handleOffer({type: 'offer', jingle: newDesc}, function (err) {
            if (err) {
                // handle error
                log(this.sid + ': source-add offer error');
                return cb({condition: 'general-error'});
            }
            self.pc.answer(function (err/*, answer*/) {
                // answer is ignored here
                if (err) {
                    log(this.sid + ': source-add answer error');
                    return cb({condition: 'general-error'});
                }
                cb();
            });
        });
    },
    onSourceRemove: function (changes, cb) {
        // note that this method is highly experimental and may 
        // go away without notice
        var self = this;

        // icky stuff that is necessary until chrome 36
        // https://code.google.com/p/webrtc/issues/detail?id=2688
        if (!this.pc || this.pc.iceConnectionState === 'closed') {
            return;
        }
        if (this.pc.iceConnectionState !== 'connected') {
            this.waitForUpdate = true;
            window.setTimeout(function () {
                self.onSourceRemove(changes, cb);
            }, 250);
            return;
        }
        if (this.waitForUpdate) {
            delete this.waitForUpdate;
            window.setTimeout(function () {
                self.onSourceRemove(changes, cb);
            }, 500);
            return;
        }

        log(this.sid + ': source-remove');

        var newDesc = this.pc.remoteDescription;
        this.pc.remoteDescription.contents.forEach(function (content, idx) {
            var desc = content.description;
            var ssrcs = desc.sources || [];

            changes.contents.forEach(function (newcontent) {
                if (content.name !== newcontent.name) {
                    return;
                }
                var newdesc = newcontent.description;
                var newssrcs = newdesc.sources || [];

                // search the ssrc to be removed in ssrcs
                // FIXME: handle more than one newssrc
                var found = -1;
                for (var i = 0; i < ssrcs.length; i++) {
                    if (newssrcs[0].ssrc === ssrcs[i].ssrc) {
                        found = i;
                        break;
                    }
                }
                if (found > -1) {
                    ssrcs.splice(found, 1);
                    newDesc.contents[idx].description.sources = ssrcs;
                }

            });
        });
        // FIXME: this block is pretty reusable, even though sometimes the 
        // order of setRemoteDescription/setLocalDescription should change
        this.pc.handleOffer({type: 'offer', jingle: newDesc}, function (err) {
            if (err) {
                // handle error
                log(this.sid + ': source-remove offer error');
                return cb({condition: 'general-error'});
            }
            self.pc.answer(function (err/*, answer*/) {
                // answer is ignored here
                if (err) {
                    log(this.sid + ': source-remove answer error');
                    return cb({condition: 'general-error'});
                }
                cb();
            });
        });
    },
    switchStream: function (oldStream, newStream) {
        var self = this;
        // pluck the <source/> to be removed
        // which is where oldstream.label == localDescription.contents[1].description.sources[0].parameters[1].value.split(" ")[0]
        this.pc.localDescription.contents.forEach(function (content) {
            console.log(content.name, 'msid', content.description.sources[0].parameters[1].value.split(' ')[0]);
        });
        this.pc.removeStream(oldStream);
        // FIXME: send a source-remove

        // FIXME: does this belong here? it's rather specific to cam->screenshare
        newStream.addTrack(oldStream.getAudioTracks()[0]);

        //console.log(newStream);
        this.pc.addStream(newStream);
        this.pc.handleOffer({type: 'offer', jingle: this.pc.remoteDescription}, function (err) {
            console.log('handleOffer', err);
            self.pc.answer(function (err, answer) {
                console.log('answer', answer);
                answer.jingle.contents.forEach(function (content) {
                    console.log('answer', content.name, 'msid', content.description.sources[0].parameters[1].value.split(' ')[0]);
                });
            });
        });
        // FIXME: send a source-add
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
