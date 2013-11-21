var browserify = require('browserify');
var UglifyJS = require('uglify-js');
var fs = require('fs');

var bundle = browserify();
bundle.add('./index');

var options = { standalone: 'Jingle' };
if (-1 != process.argv.indexOf('-d')) options.debug = true;

bundle.bundle({ standalone: 'Jingle', debug: true }, function (err, js) {
    if (err) {
        console.log(err);
    }
    var result = (options.debug) ? js :
        UglifyJS.minify(js, {fromString: true}).code;
  
    fs.writeFileSync('jingle.bundle.js', result);
});
