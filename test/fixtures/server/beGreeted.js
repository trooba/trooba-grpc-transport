'use strict';

module.exports = function (request, pipe) {
    var reply = 'Hello ' + request.body.name;
    var array = ['Bob', 'John'];
    var responseStream = pipe.streamResponse();
    for (var i = 0; i < array.length; i++) {
        if (i > 0 && request.body.name === 'timeout-after-first-chunk') {
            return;
        }
        if (request.body.name === 'slow') {
            setTimeout(responseStream.write.bind(responseStream, {
                message: reply + ' from ' + array[i]
            }), 100 * (i + 1));
        }
        else {
            responseStream.write({
                message: reply + ' from ' + array[i]
            });
        }
    }
    if (request.body.name === 'no-end') {
        return;
    }
    if (request.body.name === 'slow') {
        setTimeout(responseStream.end.bind(responseStream), 100 * (i + 1));
        return;
    }

    responseStream.end();

};
