'use strict';

module.exports = function (request, pipe) {
    pipe.respond({
        body: 'Hello ' + request.body.name
    });
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
