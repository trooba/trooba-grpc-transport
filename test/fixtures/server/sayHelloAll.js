'use strict';

module.exports = function (request, pipe) {
    let responseStream = pipe.streamResponse();

    pipe.on('request:data', function onData(data, next) {
        data && responseStream.write({
            message: 'Hello ' + data.name
        });
        !data && responseStream.end();
        next();
    });
};
