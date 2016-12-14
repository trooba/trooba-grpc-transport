'use strict';

var Server = require('./server');

process.on('SIGTERM', close);
process.on('SIGINT', close);

var server = Server.startSsl(6565);

function close() {
    console.log('closing ...');
    server.tryShutdown(function() {
        console.log('done');
    });
}
