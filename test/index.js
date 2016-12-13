'use strict';

var Assert = require('assert');
var Async = require('async');
var Domain = require('domain');
var Trooba = require('trooba');
var grpcTransport = require('..');

describe(__filename, function () {

    var server;
    var portCounter = 50000;

    afterEach(function () {
        server && server.forceShutdown();
    });

    it('should expose proto API', function (done) {
        var Server = require('./fixtures/hello/server');

        var port = portCounter++;
        server = Server.start(port);

        var client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).build('client:default');

        client.sayHello('John', function (err, response) {
            Assert.ok(!err, err && err.stack);
            Assert.equal('Hello John', response);
            done();
        });
    });

    it('should do ssl', function (done) {
        var Server = require('./fixtures/hello/server');

        var port = portCounter++;
        server = Server.startSsl(port);

        var client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello',
            credentials: Server.clientCredentials
        }).build('client:default');

        client.sayHello('John', function (err, response) {
            Assert.ok(!err, err && err.stack);
            Assert.equal('Hello John', response);
            done();
        });
    });

    it.skip('should do real example', function (done) {
        this.timeout(10000);
        var Server = require('./fixtures/hello/server');

        var client = Trooba.use(grpcTransport, {
            port: 6565,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello',
            credentials: Server.clientRaptorCredentials,
            options: {
                'grpc.ssl_target_name_override': 'localhost',
                'grpc.default_authority': 'localhost'
            }
        }).build('client:default');

        client.sayHello('John', function (err, response) {
            console.log(err, response)
            // Assert.ok(!err, err && err.stack);
            // Assert.equal('Hello John', response);
            done();
        });
    });


    it('should expose proto API with multiple methods, serial', function (done) {
        var Server = require('./fixtures/multi-hello/server');

        var port = portCounter++;
        server = Server.start(port);

        var client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).build('client:default');

        Async.series({
            hello: function (next) {
                client.sayHello('John', function (err, response) {
                    Assert.ok(!err, err && err.stack);
                    Assert.equal('Hello John', response);
                    next();
                });
            },

            hi: function (next) {
                client.sayHi('Bob', function (err, response) {
                    Assert.ok(!err, err && err.stack);
                    Assert.equal('Hi Bob', response);
                    next();
                });
            }
        }, function validate(err, result) {
            Assert.ok(!err, err && err.stack);
            done();
        });

    });

    it('should expose proto API with multiple methods, parallel', function (done) {
        var Server = require('./fixtures/multi-hello/server');

        var port = portCounter++;
        server = Server.start(port);

        var client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).build('client:default');

        Async.parallel({
            hello: function (next) {
                client.sayHello('John', function (err, response) {
                    Assert.ok(!err, err && err.stack);
                    Assert.equal('Hello John', response);
                    next();
                });
            },

            hi: function (next) {
                client.sayHi('Bob', function (err, response) {
                    Assert.ok(!err, err && err.stack);
                    Assert.equal('Hi Bob', response);
                    next();
                });
            }
        }, function validate(err, result) {
            Assert.ok(!err, err && err.stack);
            done();
        });

    });

    it('should expose proto with streaming request API', function (done) {
        var Server = require('./fixtures/hello-streaming/server');

        var port = portCounter++;
        server = Server.start(port);

        var client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).build({
            // trace: true,
            // tracer$: function (message, point) {
            //     console.log('*** trace: ', point._id , point.handler.name, message.type, message.context.$points)
            // }
        }, 'client:default');

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

    it('should expose proto with streaming response API', function (done) {
        var Server = require('./fixtures/hello-streaming/server');

        var port = portCounter++;
        server = Server.start(port);

        var client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).build('client:default');

        var messageCount = 0;

        var call = client.beGreeted('Jack');
        call.on('data', function (data) {
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

    it('stream/stream, should expose streaming API', function (done) {
        var Server = require('./fixtures/hello-streaming/server');

        var port = portCounter++;
        server = Server.start(port);

        var client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).build('client:default');

        var messageCount = 0;

        var call = client.sayHelloAll();
        call.on('data', function (data) {
            messageCount++;
            Assert.ok([
                'Hello John',
                'Hello Bob'
            ].indexOf(data) !== -1);
        }).on('end', function () {
            Assert.equal(2, messageCount);
            done();
        });

        // sending request
        call.write('John');
        call.write('Bob');
        call.end();
    });

    it('should expose proto API with multiple services', function (done) {
        var Server = require('./fixtures/multi-hello/server');
        var port = portCounter++;
        server = Server.start(port);

        var client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).build('client:default');

        client.sayHello('John', function (err, response) {
            Assert.ok(!err, err && err.stack);
            Assert.equal('Hello John', response);
            done();
        });
    });

    it('should invoke grpc operation', function (done) {
        var Server = require('./fixtures/multi-hello/server');
        var port = portCounter++;
        server = Server.start(port);

        var client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).build('client:default');

        client.request$({
            name: 'sayHello'
        }, 'John', function (err, response) {
            Assert.ok(!err, err && err.stack);
            Assert.equal('Hello John', response);
            done();
        });
    });

    it('should keep context with request/response', function (done) {
        var Server = require('./fixtures/multi-hello/server');
        var port = portCounter++;
        server = Server.start(port);

        var client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).build('client:default');

        var domain = Domain.create();
        domain.run(function () {
            process.domain.foo = 'bar';

            client.request$({
                name: 'sayHello'
            }, 'John', function (err, response) {
                Assert.ok(!err, err && err.stack);
                Assert.equal('Hello John', response);
                Assert.equal('bar', process.domain.foo);
                done();
            });
        });
    });

    it('should keep context with response stream', function (done) {

        var Server = require('./fixtures/hello-streaming/server');

        var port = portCounter++;
        server = Server.start(port);

        var client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).build('client:default');

        var domain = Domain.create();
        domain.run(function () {
            process.domain.foo = 'bar';

            var messageCount = 0;

            client.beGreeted('Jack')
            .on('data', function (data) {
                messageCount++;
                Assert.ok([
                    'Hello Jack from John',
                    'Hello Jack from Bob'
                ].indexOf(data) !== -1);
                Assert.equal('bar', process.domain.foo);
            })
            .on('end', function () {
                Assert.equal(2, messageCount);
                Assert.equal('bar', process.domain.foo);
                done();
            })
            .on('error', done);

        });

    });

    it('should keep context when connect error happens', function (done) {
        var Server = require('./fixtures/hello-timeout/server');
        var port = portCounter++;
        server = Server.start(port);

        var client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello',
            connectTimeout: 1
        }).build('client:default');

        var domain = Domain.create();
        domain.run(function () {
            process.domain.foo = 'bar';

            client.request$({
                name: 'sayHello'
            }, 'John', function (err, response) {
                Assert.ok(err);
                Assert.equal('ETIMEDOUT', err.code);
                Assert.equal('bar', process.domain.foo);
                done();
            });

        });
    });

    it('should keep context when response timeout error happens', function (done) {
        var Server = require('./fixtures/hello-timeout/server');

        var port = portCounter++;
        server = Server.start(port);

        var client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).build('client:default');

        var domain = Domain.create();
        domain.run(function () {
            process.domain.foo = 'bar';

            client.request$({
                name: 'sayHello'
            }, 'John', function (err, response) {
                Assert.ok(err);
                Assert.equal('ETIMEDOUT', err.code);
                Assert.equal('ESOCKTIMEDOUT', err.type);
                Assert.equal('bar', process.domain.foo);
                done();
            });
        });

    });

    it('should keep context when response stream error happens', function (done) {
        var Server = require('./fixtures/hello-streaming/server');

        var port = portCounter++;
        server = Server.start(port);

        var client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).build('client:default');

        var domain = Domain.create();
        domain.run(function () {
            process.domain.foo = 'bar';
            client.beGreeted('timeout')
            .on('error', function (err) {
                Assert.ok(err);
                Assert.equal('bar', process.domain.foo);
                Assert.equal('ETIMEDOUT', err.code);
                Assert.equal('ESOCKTIMEDOUT', err.type);
                done();
            })
            .on('data', function () {
                done(new Error('Should not happen'));
            });
        });
    });

    it.skip('should propagate request metadata', function (done) {
    });

    it.skip('should propagate response metadata', function (done) {
    });

    describe('negative', function () {
        it('should handle connect timeout, request/response', function (done) {
            var Server = require('./fixtures/hello-timeout/server');
            var port = portCounter++;
            server = Server.start(port);

            var client = Trooba.use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello',
                connectTimeout: 1
            }).build('client:default');

            client.request$({
                name: 'sayHello'
            }, 'John', function (err, response) {
                Assert.ok(err);
                Assert.equal('ETIMEDOUT', err.code);
                done();
            });
        });

        it('should handle socket/read timeout, request/response', function (done) {
            var Server = require('./fixtures/hello-timeout/server');
            var port = portCounter++;
            server = Server.start(port);

            var client = Trooba.use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello',
                socketTimeout: 10
            }).build('client:default');

            client.request$({
                name: 'sayHello'
            }, 'John', function (err, response) {
                Assert.ok(err);
                Assert.equal('ETIMEDOUT', err.code);
                done();
            });
        });

        it('should handle bad hostname', function (done) {
            var Server = require('./fixtures/hello/server');
            var port = portCounter++;
            server = Server.start(port);

            var client = Trooba.use(grpcTransport, {
                port: port,
                hostname: 'bad-host',
                proto: Server.proto,
                serviceName: 'Hello',
                connectTimeout: 200
            }).build('client:default');

            client.request$({
                name: 'sayHello'
            }, 'John', function (err, response) {
                Assert.ok(err);
                Assert.equal('ETIMEDOUT', err.code);
                done();
            });
        });

        it.skip('should handle error in request stream/response flow', function (done) {
        });

        it.skip('should handle timeout error in request stream when server never reads it', function (done) {
        });

        it('should handle timeout error in response stream flow', function (done) {

            var Server = require('./fixtures/hello-streaming/server');

            var port = portCounter++;
            server = Server.start(port);

            var client = Trooba.use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello'
            }).build('client:default');

            client.beGreeted('timeout')
            .on('error', function (err) {
                Assert.ok(err);
                Assert.equal('ETIMEDOUT', err.code);
                Assert.equal('ESOCKTIMEDOUT', err.type);
                done();
            })
            .on('data', function () {
                done(new Error('Should never happen'));
            });
        });

        it('should handle timeout error in response stream flow after first chunk', function (done) {

            var Server = require('./fixtures/hello-streaming/server');

            var port = 100 + portCounter++;
            server = Server.start(port);

            var client = Trooba.use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello',
                socketTimeout: 100
            }).build('client:default');

            var counter = 0;

            client.beGreeted('timeout-after-first-chunk')
            .on('data', function (data) {
                counter++;
                Assert.equal('Hello timeout-after-first-chunk from Bob', data);
            })
            .on('error', function (err) {
                Assert.ok(err);
                Assert.equal('ETIMEDOUT', err.code);
                Assert.equal('ESOCKTIMEDOUT', err.type);
                Assert.equal(1, counter);
                done();
            });
        });

        it('should handle timeout error with no response end', function (done) {

            var Server = require('./fixtures/hello-streaming/server');

            var port = portCounter++;
            server = Server.start(port);

            var client = Trooba.use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello'
            }).build('client:default');

            var messageCount = 0;

            client.beGreeted('no-end')
            .on('data', function (data) {
                messageCount++;
                Assert.ok([
                    'Hello no-end from John',
                    'Hello no-end from Bob'
                ].indexOf(data) !== -1);
            })
            .on('error', function (err) {
                Assert.ok(err);
                Assert.equal('ETIMEDOUT', err.code);
                Assert.equal('ESOCKTIMEDOUT', err.type);
                Assert.equal(2, messageCount);
                done();
            });
        });

        it('should re-set response timeout after each received chunk', function (done) {
            var Server = require('./fixtures/hello-streaming/server');

            var port = portCounter++;
            server = Server.start(port);

            var client = Trooba.use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello',
                socketTimeout: 130
            }).build('client:default');

            var messageCount = 0;

            client.beGreeted('slow')
            .on('data', function (data) {
                messageCount++;
                Assert.ok([
                    'Hello slow from John',
                    'Hello slow from Bob'
                ].indexOf(data) !== -1);
            })
            .on('error', done)
            .on('end', function () {
                Assert.equal(2, messageCount);
                done();
            });
        });

        it.skip('should handle diconnect while waitng for response', function (done) {
        });

        it.skip('should handle diconnect while waitng for response stream', function (done) {
        });

        it.skip('should handle diconnect while sending request', function (done) {
        });

        it.skip('should handle diconnect while writing into request stream', function (done) {
        });

        it.skip('should handle re-connect', function (done) {
        });

    });

    describe('parallel', function () {
        it.skip('should handle request/response flow', function (done) {
        });

        it.skip('should handle request stream/response flow', function (done) {
        });

        it.skip('should handle request/response stream flow', function (done) {
        });

        it.skip('should handle stream/stream flow', function (done) {
        });
    });
});
