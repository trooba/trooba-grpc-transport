'use strict';

module.exports = function (request, pipe) {
    if (request.body.name === 'error') {
        const err = new Error('Test Error');
        err.code = 10;
        return pipe.throw(err);
    }
    var response = {
        body: 'Hello ' + request.body.name
    };
    if (request.headers.meta) {
        response.headers = {
            foo: 'bar',
            qaz: request.headers.qaz
        };
    }
    pipe.respond(response);
};

// module.exports = function (request, pipe) {
//     console.log('------->', request)
//     var names = [];
//     pipe.on('request:data', function onData(data, next) {
//         data && names.push(data.name);
//         next();
//     });
//     pipe.on('request:end', function onEnd() {
//         pipe.respond({
//             body: 'Hello ' + names.join(' and ')
//         });
//     });
// };
