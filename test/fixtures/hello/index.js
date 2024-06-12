'use strict';

var Server = require('./server');

process.on('SIGTERM', close);
process.on('SIGINT', close);

var server = Server.startSsl(6565);

async function close() {
    console.log('closing ...');
    (await server).tryShutdown(function() {
        console.log('done');
    });
}
