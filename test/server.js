'use strict';

var Assert = require('assert');
var Trooba = require('trooba');

var transport = require('..');
var controller = require('./fixtures/server/controller');

describe(__filename, () => {
    var svr;

    afterEach(function (next) {
        svr.close(next);
        svr = undefined;
    });

    it('should start the server and do request/reponse', (done) => {
        var Server = require('./fixtures/hello/server');

        var pipeServer = Trooba.use(transport, {
            port: 0,
            hostname: 'localhost',
            proto: Server.proto
        })
        .use(controller());

        var app = pipeServer.build('server:default');

        svr = app.listen();
        Assert.ok(svr.port);

        var pipeClient = Trooba.use(transport, {
            port: svr.port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        });
        var client = pipeClient.build('client:default');

        client.sayHello('John', function (err, response) {
            Assert.ok(!err, err && err.stack);
            Assert.equal('Hello John', response);
            done();
        });
    });

    it('should start the server and do request/reponse with namespace', (done) => {
        var Server = require('./fixtures/hello-pkg/server');

        var pipeServer = Trooba.use(transport, {
            port: 0,
            hostname: 'localhost',
            proto: Server.proto
        })
        .use(controller());

        var app = pipeServer.build('server:default');

        svr = app.listen();
        Assert.ok(svr.port);

        var pipeClient = Trooba.use(transport, {
            port: svr.port,
            hostname: 'localhost',
            proto: Server.proto.com.xyz.helloworld,
            serviceName: 'Hello'
        });
        var client = pipeClient.build('client:default');

        client.sayHello('John', function (err, response) {
            Assert.ok(!err, err && err.stack);
            Assert.equal('Hello John', response);
            done();
        });
    });

    it('should start the server and do request/stream', (done) => {
        var Server = require('./fixtures/hello-streaming/server');

        var pipeServer = Trooba.use(transport, {
            port: 0,
            hostname: 'localhost',
            proto: Server.proto
        })
        .use(controller());

        var app = pipeServer.build('server:default');

        svr = app.listen();
        Assert.ok(svr.port);

        var pipeClient = Trooba.use(transport, {
            port: svr.port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        });
        var client = pipeClient.build('client:default');

        var messageCount = 0;
        var call = client.beGreeted('Jack');
        call
        .on('data', function (data) {
            messageCount++;
            Assert.ok([
                'Hello Jack from John',
                'Hello Jack from Bob'
            ].indexOf(data) !== -1);
        })
        .on('end', function () {
            // reached the end
            Assert.equal(2, messageCount);
            done();
        })
        .on('error', done);
    });

    it('should start the server and do stream/response', (done) => {
        var Server = require('./fixtures/hello-streaming/server');

        var pipeServer = Trooba
        .use(transport, {
            port: 0,
            hostname: 'localhost',
            proto: Server.proto
        })
        .use(function dummy(pipe) {
            // nothing, just to have a pipeline
        })
        .use(function controller(pipe) {
            var names = [];
            pipe.on('request', function onData(request) {
            });
            pipe.on('request:data', function onData(data, next) {
                data && names.push(data.name);
                next();
            });
            pipe.on('request:end', function onEnd() {
                pipe.respond({
                    body: 'Hello ' + names.join(' and ')
                });
            });
        });

        var app = pipeServer.build('server:default');

        svr = app.listen();
        Assert.ok(svr.port);

        var pipeClient = Trooba.use(transport, {
            port: svr.port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        });
        var client = pipeClient.build('client:default');

        var call = client.sayHello(function (err, response) {
            // getting reponse
            Assert.ok(!err, err && err.stack);
            Assert.equal('Hello John and Bob', response);
            done();
        });

        call.write('John');
        call.write('Bob');
        call.end();

    });

    it('should start the server and do stream/stream', (done) => {
        var Server = require('./fixtures/hello-streaming/server');

        var pipeServer = Trooba
        .use(transport, {
            port: 0,
            hostname: 'localhost',
            proto: Server.proto
        })
        .use(function dummy(pipe) {
            // nothing, just to have a pipeline
        })
        .use(controller());

        var app = pipeServer.build('server:default');

        svr = app.listen();
        Assert.ok(svr.port);

        var pipeClient = Trooba.use(transport, {
            port: svr.port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        });
        var client = pipeClient.build('client:default');

        let messageCount = 0;

        var call = client.sayHelloAll();

        call.on('data', function (data) {
            messageCount++;
            try {
                Assert.ok([
                    'Hello John',
                    'Hello Bob'
                ].indexOf(data) !== -1);
            }
            catch (err) {
                done(err);
                done = function noop() {};
            }
        }).on('end', function () {
            Assert.equal(2, messageCount);
            done();
        })
        .on('error', done);

        call.write('John');
        call.write('Bob');
        call.end();

    });
});
