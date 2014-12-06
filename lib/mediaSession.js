var util = require('util');
var extend = require('extend-object');
var JingleSession = require('./genericSession');
var RTCPeerConnection = require('rtcpeerconnection');


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
}

util.inherits(MediaSession, JingleSession);


Object.defineProperty(MediaSession.prototype, 'streams', {
    get: function () {
        return this.pc.remoteStreams;
    }
});


MediaSession.prototype = extend(MediaSession.prototype, {
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
            sessDesc.jingle.contents.forEach(function (content) {
                var sources = content.description.sources || [];
                sources.forEach(function (source) {
                    source.parameters = source.parameters.filter(function (parameter) {
                        return !(parameter.key === 'mslabel' || parameter.key === 'label');
                    });
                });
            });
            self.send('session-initiate', sessDesc.jingle);
        });
    },
    end: function (reason, silence) {
        var self = this;
        this.pc.close();
        this.streams.forEach(function (stream) {
            self._onStreamRemoved({stream: stream});
        });
        JingleSession.prototype.end.call(this, reason, silence);
    },
    accept: function () {
        var self = this;

        this._log('debug', 'Accepted incoming session');

        this.state = 'active';
        this.pc.answer(function (err, answer) {
            if (err) {
                self._log('error', 'Could not create WebRTC answer', err);
                return self.end('failed-application');
            }
            // remove mslabel and label ssrc-specific attributes
            answer.jingle.contents.forEach(function (content) {
                var sources = content.description.sources || [];
                sources.forEach(function (source) {
                    source.parameters = source.parameters.filter(function (parameter) {
                        return !(parameter.key === 'mslabel' || parameter.key === 'label');
                    });
                });
            });
            self.send('session-accept', answer.jingle);
        });
    },
    ring: function () {
        this._log('debug', 'Ringing on incoming session');
        this.send('session-info', {ringing: true});
    },
    mute: function (creator, name) {
        this._log('debug', 'Muting');
        this.send('session-info', {mute: {creator: creator, name: name}});
    },
    unmute: function (creator, name) {
        this._log('debug', 'Unmuting');
        this.send('session-info', {unmute: {creator: creator, name: name}});
    },
    hold: function () {
        this._log('debug', 'Placing on hold');
        this.send('session-info', {hold: true});
    },
    resume: function () {
        this._log('debug', 'Resuing from hold');
        this.send('session-info', {active: true});
    },
    addStream: function (stream) {
        this.pc.addStream(stream);
    },
    addStream2: function (stream, cb) {
        // note that this method is highly experimental and may 
        // go away without notice
        // it is basically a renegotiation-capable version of addStream
        cb = cb || function () {};
        var self = this;
        this.pc.addStream(stream);
        this.pc.handleOffer({type: 'offer', jingle: this.pc.remoteDescription}, function (err) {
            if (err) {
                return cb(err);
            }
            self.pc.answer(function (err, answer) {
                if (err) {
                    return cb(err);
                }
                answer.jingle.contents.forEach(function (content) {
                    delete content.transport;
                    delete content.description.payloads;
                    if (content.description.sources) {
                        content.description.sources = content.description.sources.filter(function (source) {
                            return stream.id === source.parameters[1].value.split(' ')[0];
                        });
                    }
                });
                self.send('source-add', answer.jingle);
                cb();
            });
        });
    },
    removeStream: function (stream) {
        this.pc.removeStream(stream);
    },
    removeStream2: function (stream, cb) {
        // note that this method is highly experimental and may 
        // go away without notice
        // it is basically a renegotiation-capable version of removeStream
        cb = cb || function () {};
        var self = this;
        var desc = this.pc.localDescription;
        desc.contents.forEach(function (content) {
            delete content.transport;
            delete content.description.payloads;
            if (content.description.sources) {
                content.description.sources = content.description.sources.filter(function (source) {
                    return stream.id === source.parameters[1].value.split(' ')[0];
                });
            }
        });
        this.send('source-remove', desc);
        this.pc.removeStream(stream);

        this.pc.handleOffer({type: 'offer', jingle: this.pc.remoteDescription}, function (err) {
            if (err) {
                return cb(err);
            }
            self.pc.answer(function (err/*, answer*/) {
                if (err) {
                    return cb(err);
                }
                cb();
            });
        });
    },
    onSessionInitiate: function (changes, cb) {
        var self = this;

        this._log('debug', 'Initiating incoming session');

        this.state = 'pending';
        this.pc.isInitiator = false;

        this.pc.handleOffer({type: 'offer', jingle: changes}, function (err) {
            if (err) {
                self._log('error', 'Could not create WebRTC answer', err);
                return cb({condition: 'general-error'});
            }
            cb();
        });
    },
    onSessionAccept: function (changes, cb) {
        var self = this;

        this._log('debug', 'Activating accepted outbound session');

        this.state = 'active';
        this.pc.handleAnswer({type: 'answer', jingle: changes}, function (err) {
            if (err) {
                self._log('error', 'Could not process WebRTC answer', err);
                return cb({condition: 'general-error'});
            }

            self.parent.emit('accepted', self);
            cb();
        });
    },
    onSessionTerminate: function (changes, cb) {
        var self = this;
        this._log('debug', 'Terminating session');
        this.pc.close();
        this.streams.forEach(function (stream) {
            self._onStreamRemoved({stream: stream});
        });
        JingleSession.prototype.end.call(this, changes.reason, true);
        cb();
    },
    onTransportInfo: function (changes, cb) {
        var self = this;

        this._log('debug', 'Adding ICE candidate');

        this.pc.processIce(changes, function (err) {
            if (err) {
                self._log('error', 'Could not process ICE candidate', err);
            }
            cb();
        });
    },
    onSessionInfo: function (info, cb) {
        this._log('debug', 'Session info', info);
        if (info.ringing) {
            this._log('debug', 'Ringing on remote stream');
            this.parent.emit('ringing', this);
        }

        if (info.hold) {
            this._log('debug', 'On hold');
            this.parent.emit('hold', this);
        }

        if (info.active) {
            this._log('debug', 'Resumed from hold');
            this.parent.emit('resumed', this);
        }

        if (info.mute) {
            this._log('debug', 'Muted', info.mute);
            this.parent.emit('mute', this, info.mute);
        }

        if (info.unmute) {
            this._log('debug', 'Unmuted', info.unmute);
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

        this._log('debug', 'source-add');

        var newDesc = this.pc.remoteDescription;
        this.pc.remoteDescription.contents.forEach(function (content, idx) {
            var desc = content.description;
            var ssrcs = desc.sources || [];
            var groups = desc.sourceGroups || [];

            changes.contents.forEach(function (newcontent) {
                if (content.name !== newcontent.name) {
                    return;
                }
                var newdesc = newcontent.description;
                var newssrcs = newdesc.sources || [];

                // for some reason a JSON-deepcopy is needed
                ssrcs = ssrcs.concat(newssrcs);
                newDesc.contents[idx].description.sources = JSON.parse(JSON.stringify(ssrcs));

                var newgroups = newdesc.sourceGroups || [];
                groups = groups.concat(newgroups);
                newDesc.contents[idx].description.sourceGroups = JSON.parse(JSON.stringify(groups));
            });
        });

        // FIXME: this block is pretty reusable, even though sometimes the
        // order of setRemoteDescription/setLocalDescription should change
        this.pc.handleOffer({type: 'offer', jingle: newDesc}, function (err) {
            if (err) {
                // handle error
                self._log('error', 'source-add offer error');
                return cb({condition: 'general-error'});
            }
            self.pc.answer(function (err/*, answer*/) {
                // answer is ignored here
                if (err) {
                    self._log('error', 'source-add answer error');
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

        this._log('debug', 'source-remove');

        var newDesc = this.pc.remoteDescription;
        this.pc.remoteDescription.contents.forEach(function (content, idx) {
            var desc = content.description;
            var ssrcs = desc.sources || [];
            var groups = desc.sourceGroups || [];

            changes.contents.forEach(function (newcontent) {
                if (content.name !== newcontent.name) {
                    return;
                }
                var newdesc = newcontent.description;
                var newssrcs = newdesc.sources || [];
                var newgroups = newdesc.sourceGroups || [];

                // search the ssrc to be removed in ssrcs
                var found;
                var i, j, k;
                for (i = 0; i < newssrcs.length; i++) {
                    found = -1;
                    for (j = 0; j < ssrcs.length; j++) {
                        if (newssrcs[i].ssrc === ssrcs[j].ssrc) {
                            found = j;
                            break;
                        }
                    }
                    if (found > -1) {
                        // for some reason a JSON-deepcopy is needed
                        ssrcs.splice(found, 1);
                        newDesc.contents[idx].description.sources = JSON.parse(JSON.stringify(ssrcs));
                    }
                }

                // remove any ssrc-groups that are no longer needed
                for (i = 0; i < newgroups.length; i++) {
                    found = -1;
                    for (j = 0; j < groups.length; j++) {
                        // compare groups
                        if (newgroups[i].semantics === groups[j].semantics &&
                                newgroups[i].sources.length === groups[j].sources.length) {
                            // compare sources arrays
                            var same = true;
                            for (k = 0; k < newgroups[i].sources.length; k++) {
                                if (newgroups[i].sources[k] !== groups[j].sources[k]) {
                                    same = false;
                                    break;
                                }
                            }
                            if (same) {
                                found = j;
                                break;
                            }
                        }
                    }
                    if (found > -1) {
                        // for some reason a JSON-deepcopy is needed
                        groups.splice(found, 1);
                        newDesc.contents[idx].description.sourceGroups = JSON.parse(JSON.stringify(groups));
                    }
                }
            });
        });
        // FIXME: this block is pretty reusable, even though sometimes the
        // order of setRemoteDescription/setLocalDescription should change
        this.pc.handleOffer({type: 'offer', jingle: newDesc}, function (err) {
            if (err) {
                // handle error
                self._log('error', 'source-remove offer error');
                return cb({condition: 'general-error'});
            }
            self.pc.answer(function (err/*, answer*/) {
                // answer is ignored here
                if (err) {
                    self._log('error', 'source-remove answer error');
                    return cb({condition: 'general-error'});
                }
                cb();
            });
        });
    },
    switchStream: function (oldStream, newStream, cb) {
        cb = cb || function () {};
        var self = this;
        // pluck the <source/> to be removed
        // which is where oldstream.label == localDescription.contents[1].description.sources[0].parameters[1].value.split(" ")[0]
        // FIXME: generate instead of deleting
        var desc = this.pc.localDescription;
        desc.contents.forEach(function (content) {
            delete content.transport;
            delete content.description.payloads;
        });
        this.pc.removeStream(oldStream);
        // FIXME: send a source-remove
        this.send('source-remove', desc);

        // FIXME: does this belong here? it's rather specific to cam->screenshare
        var audioTracks = oldStream.getAudioTracks();
        if (audioTracks.length) {
            newStream.addTrack(audioTracks[0]);
        }

        this.pc.addStream(newStream);
        this.pc.handleOffer({type: 'offer', jingle: this.pc.remoteDescription}, function (err) {
            if (err) {
                return cb(err);
            }
            self.pc.answer(function (err, answer) {
                if (err) {
                    return cb(err);
                }
                answer.jingle.contents.forEach(function (content) {
                    delete content.transport;
                    delete content.description.payloads;
                });
                self.send('source-add', answer.jingle);
                cb();
            });
        });
    },
    _onIceCandidate: function (candidateInfo) {
        this._log('debug', 'Discovered new ICE candidate', candidateInfo.jingle);
        this.send('transport-info', candidateInfo.jingle);
    },
    _onStreamAdded: function (event) {
        this._log('debug', 'Remote media stream added');

        // unfortunately, firefox does not support this yet
        /*
        event.stream.onended = function () {
            self._onStreamRemoved({stream: event.stream});
        };
        */

        this.parent.emit('peerStreamAdded', this, event.stream);
    },
    _onStreamRemoved: function (event) {
        this._log('debug', 'Remote media stream removed');
        this.parent.emit('peerStreamRemoved', this, event.stream);
    }
});


module.exports = MediaSession;
