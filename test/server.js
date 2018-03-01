'use strict';

var Assert = require('assert');
var Trooba = require('trooba');

var transport = require('..');
var routes = require('./fixtures/server/routes');

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
        .use(routes());

        var app = pipeServer.build().create('server:default');

        svr = app.listen();
        Assert.ok(svr.port);

        var pipeClient = Trooba.use(transport, {
            port: svr.port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        });
        var client = pipeClient.build().create('client:default');

        client.sayHello('John', function (err, response) {
            Assert.ok(!err, err && err.stack);
            Assert.equal('Hello John', response);
            done();
        });
    });

    it('should get error', (done) => {
        var Server = require('./fixtures/hello/server');

        var pipeServer = Trooba.use(transport, {
            port: 0,
            hostname: 'localhost',
            proto: Server.proto
        })
        .use(routes());

        var app = pipeServer.build().create('server:default');

        svr = app.listen();
        Assert.ok(svr.port);

        var pipeClient = Trooba.use(transport, {
            port: svr.port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        });
        var client = pipeClient.build().create('client:default');

        client.sayHello('error', function (err, response) {
            Assert.ok(err);
            Assert.equal('10 ABORTED: Test Error', err.message);
            done();
        });
    });

    it('should send and receive metadata', (done) => {
        var Server = require('./fixtures/hello/server');

        var pipeServer = Trooba.use(transport, {
            port: 0,
            hostname: 'localhost',
            proto: Server.proto
        })
        .use(routes());

        var app = pipeServer.build().create('server:default');

        svr = app.listen();
        Assert.ok(svr.port);

        var meta;
        var pipeClient = Trooba
        .use(function catchHeaders(pipe) {
            pipe.on('response', function (response, next) {
                meta = response.headers;
                next();
            });
        })
        .use(transport, {
            port: svr.port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        });
        var client = pipeClient.build().create('client:default');

        client.sayHello('John', {
            meta: true,
            qaz: 'edc'
        }, function (err, response) {
            Assert.ok(!err);
            Assert.deepEqual({
                qaz: 'edc',
                foo: 'bar'
            }, meta);
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
        .use(routes());

        var app = pipeServer.build().create('server:default');

        svr = app.listen();
        Assert.ok(svr.port);

        var pipeClient = Trooba.use(transport, {
            port: svr.port,
            hostname: 'localhost',
            proto: Server.proto.com.xyz.helloworld,
            serviceName: 'Hello'
        });
        var client = pipeClient.build().create('client:default');

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
        .use(routes());

        var app = pipeServer.build().create('server:default');

        svr = app.listen();
        Assert.ok(svr.port);

        var pipeClient = Trooba.use(transport, {
            port: svr.port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        });
        var client = pipeClient.build().create('client:default');

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
        .use(function routes(pipe) {
            var names = [];
            pipe.on('request', function onData(request, next) {
                next();
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

        var app = pipeServer.build().create('server:default');

        svr = app.listen();
        Assert.ok(svr.port);

        var pipeClient = Trooba.use(transport, {
            port: svr.port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        });
        var client = pipeClient.build().create('client:default');

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
        .use(routes());

        var app = pipeServer.build().create('server:default');

        svr = app.listen();
        Assert.ok(svr.port);

        var pipeClient = Trooba.use(transport, {
            port: svr.port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        });
        var client = pipeClient.build().create('client:default');

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

    it('should fail to start server twice on the same endpoint when it is already running',
    function (done) {
        var Server = require('./fixtures/hello-streaming/server');
        var pipeServer = Trooba
        .use(transport, {
            port: 40000,
            hostname: 'localhost',
            proto: Server.proto
        })
        .use(function dummy(pipe) {
            // nothing, just to have a pipeline
        })
        .use(routes());

        var app = pipeServer.build().create('server:default');

        svr = app.listen();

        Assert.throws(function () {
            app.listen();
        }, /The service is already running:localhost:40000/);

        app.listen(function (err) {
            Assert.equal('The service is already running:localhost:40000', err.message);
            done();
        });
    });

    it('should force shutdown', function (done) {
        var Server = require('./fixtures/hello-streaming/server');
        var pipeServer = Trooba
        .use(transport, {
            port: 40000,
            hostname: 'localhost',
            proto: Server.proto
        })
        .use(routes());

        var app = pipeServer.build().create('server:default');

        svr = app.listen();

        var pipeClient = Trooba.use(transport, {
            port: svr.port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        });
        var client = pipeClient.build().create('client:default');
        client.sayHelloAll();

        svr.close(function () {
            done();
        }, 1);
    });
});
