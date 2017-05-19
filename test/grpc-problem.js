'use strict';

const Grpc = require('grpc');

// Validate with next version of grpc
describe.skip('terminated by signal SIGSEGV (Address boundary error)', () => {
    it('will fail with "signal SIGSEGV (Address boundary error)"', next => {
        const Server = require('./fixtures/grpc-problem/server');
        const server = Server.start(50000);
        const client = new Server.proto.Hello('localhost:50000', Grpc.credentials.createInsecure());

        var call = client.sayHelloAll();

        // sending request
        call.write('John');
        setTimeout(function () {
            server.forceShutdown();
            setTimeout(function () {
                call.write('Bob');
                call.end();
            }, 500);
        }, 500);
    });
});
