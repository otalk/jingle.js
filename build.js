var browserify = require('browserify');
var UglifyJS = require('uglify-js');
var fs = require('fs');


var bundle = browserify();
bundle.add('./index');
bundle.bundle({standalone: 'Jingle'}, function (err, js) {
    if (err) {
        console.log(err);
    }
    var result = UglifyJS.minify(js, {fromString: true}).code;
    fs.writeFileSync('jingle.bundle.js', result);
});
