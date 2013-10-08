var browserify = require('browserify');
var UglifyJS = require('uglify-js');
var fs = require('fs');


var bundle = browserify();
bundle.add('./index');
bundle.bundle({standalone: 'JingleWebRTC'}, function (err, js) {
    //var result = UglifyJS.minify(js, {fromString: true}).code;
    console.log(err);
    fs.writeFileSync('jingle-webrtc.bundle.js', js);
});
