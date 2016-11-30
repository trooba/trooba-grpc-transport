'use strict';

var Assert = require('assert');
var Async = require('async');
var Domain = require('domain');
var Trooba = require('trooba');
var grpcTransport = require('..');

describe(__filename, function () {

    var server;

    afterEach(function () {
        server && server.forceShutdown();
    });

    it('should expose proto API', function (done) {
        var Server = require('./fixtures/hello/server');

        server = Server.start(50001);

        var client = Trooba.transport(grpcTransport, {
            port: 50001,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).create();

        client.sayHello('John', function (err, response) {
            Assert.ok(!err, err && err.stack);
            Assert.equal('Hello John', response);
            done();
        });
    });

    it('should do ssl', function (done) {
        var Server = require('./fixtures/hello/server');

        server = Server.startSsl(50006);

        var client = Trooba.transport(grpcTransport, {
            port: 50006,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello',
            credentials: Server.clientCredentials
        }).create();

        client.sayHello('John', function (err, response) {
            Assert.ok(!err, err && err.stack);
            Assert.equal('Hello John', response);
            done();
        });
    });

    it.skip('should do real example', function (done) {
        this.timeout(10000);
        var Server = require('./fixtures/hello/server');

        var client = Trooba.transport(grpcTransport, {
            port: 6565,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello',
            credentials: Server.clientRaptorCredentials,
            options: {
                'grpc.ssl_target_name_override': 'localhost',
                'grpc.default_authority': 'localhost'
            }
        }).create();

        client.sayHello('John', function (err, response) {
            console.log(err, response)
            // Assert.ok(!err, err && err.stack);
            // Assert.equal('Hello John', response);
            done();
        });
    });


    it('should expose proto API with multiple methods, serial', function (done) {
        var Server = require('./fixtures/multi-hello/server');

        server = Server.start(50002);

        var client = Trooba.transport(grpcTransport, {
            port: 50002,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).create();

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

        server = Server.start(50002);

        var client = Trooba.transport(grpcTransport, {
            port: 50002,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).create();

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

        server = Server.start(50004);

        var client = Trooba.transport(grpcTransport, {
            port: 50004,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).create();

        client.sayHello(function (err, response) {
            // getting reponse
            Assert.ok(!err, err && err.stack);
            Assert.equal('Hello John and Bob', response);
            done();
        }).connection.on(function (call) {
            // sending request
            call.write('John');
            call.write('Bob');
            call.end();
        });
    });

    it('should expose proto with streaming response API', function (done) {
        var Server = require('./fixtures/hello-streaming/server');

        server = Server.start(50005);

        var client = Trooba.transport(grpcTransport, {
            port: 50005,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).create();

        var messageCount = 0;

        client.beGreeted('Jack', function (err, response) {
            // getting reponse
            Assert.ok(!err, err && err.stack);
            if (err === undefined && response === undefined) {
                // reached the end
                Assert.equal(2, messageCount);
                done();
            }
            messageCount++;
            Assert.ok([
                'Hello Jack from John',
                'Hello Jack from Bob'
            ].indexOf(response) !== -1);
        });
    });

    it('stream/stream, should expose streaming API', function (done) {
        var Server = require('./fixtures/hello-streaming/server');

        server = Server.start(50007);

        var client = Trooba.transport(grpcTransport, {
            port: 50007,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).create();

        var messageCount = 0;

        client.sayHelloAll(function (err, response) {
            // getting reponse
            // getting reponse
            Assert.ok(!err, err && err.stack);
            if (err === undefined && response === undefined) {
                // reached the end
                Assert.equal(2, messageCount);
                done();
            }
            messageCount++;
            Assert.ok([
                'Hello John',
                'Hello Bob'
            ].indexOf(response) !== -1);
        }).connection.on(function (call) {
            // sending request
            call.write('John');
            call.write('Bob');
            call.end();
        });

    });

    it('should expose proto API with multiple services', function (done) {
        var Server = require('./fixtures/multi-hello/server');
        server = Server.start(50001);

        var client = Trooba.transport(grpcTransport, {
            port: 50001,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).create();

        client.sayHello('John', function (err, response) {
            Assert.ok(!err, err && err.stack);
            Assert.equal('Hello John', response);
            done();
        });
    });

    it('should invoke grpc operation', function (done) {
        var Server = require('./fixtures/multi-hello/server');
        server = Server.start(50001);

        var client = Trooba.transport(grpcTransport, {
            port: 50001,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).create();

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
        server = Server.start(50001);

        var client = Trooba.transport(grpcTransport, {
            port: 50001,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).create();

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

        server = Server.start(50015);

        var client = Trooba.transport(grpcTransport, {
            port: 50015,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).create();

        var domain = Domain.create();
        domain.run(function () {
            process.domain.foo = 'bar';

            var messageCount = 0;

            client.beGreeted('Jack', function (err, response) {
                // getting reponse
                Assert.ok(!err, err && err.stack);
                if (err === undefined && response === undefined) {
                    // reached the end
                    Assert.equal(2, messageCount);
                    Assert.equal('bar', process.domain.foo);
                    done();
                }
                messageCount++;
                Assert.ok([
                    'Hello Jack from John',
                    'Hello Jack from Bob'
                ].indexOf(response) !== -1);
                Assert.equal('bar', process.domain.foo);
            });

        });

    });

    it('should keep context when connect error happens', function (done) {
        var Server = require('./fixtures/hello-timeout/server');
        server = Server.start(50001);

        var client = Trooba.transport(grpcTransport, {
            port: 50001,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello',
            connectTimeout: 1
        }).create();

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

    it.skip('should keep context when response error happens', function (done) {
    });

    it.skip('should keep context when response stream error happens', function (done) {
        var Server = require('./fixtures/hello-streaming/server');

        server = Server.start(50015);

        var client = Trooba.transport(grpcTransport, {
            port: 50015,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).create();

        var domain = Domain.create();
        domain.run(function () {
            process.domain.foo = 'bar';

            client.beGreeted('timeout', function (err, response) {
                // getting reponse
                Assert.ok(!err, err && err.stack);
                Assert.equal('bar', process.domain.foo);
                done();
            });

        });
    });

    describe('negative', function () {
        it('should handle connect timeout, request/response', function (done) {
            var Server = require('./fixtures/hello-timeout/server');
            server = Server.start(50001);

            var client = Trooba.transport(grpcTransport, {
                port: 50001,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello',
                connectTimeout: 1
            }).create();

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
            server = Server.start(50001);

            var client = Trooba.transport(grpcTransport, {
                port: 50001,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello',
                socketTimeout: 10
            }).create();

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
            server = Server.start(50001);

            var client = Trooba.transport(grpcTransport, {
                port: 50001,
                hostname: 'bad-host',
                proto: Server.proto,
                serviceName: 'Hello',
                connectTimeout: 200
            }).create();

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

            server = Server.start(50015);

            var client = Trooba.transport(grpcTransport, {
                port: 50015,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello'
            }).create();

            client.beGreeted('timeout', function (err, response) {
                Assert.ok(err);
                Assert.equal('ETIMEDOUT', err.code);
                Assert.equal('ESOCKTIMEDOUT', err.type);
                done();
            });
        });

        it('should handle timeout error in response stream flow after firist chunk', function (done) {

            var Server = require('./fixtures/hello-streaming/server');

            server = Server.start(50015);

            var client = Trooba.transport(grpcTransport, {
                port: 50015,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello'
            }).create();

            var counter = 0;

            client.beGreeted('timeout-after-first-chunk', function (err, response) {
                if (counter++ === 0) {
                    Assert.equal('Hello timeout-after-first-chunk from Bob', response);
                }
                else {
                    Assert.ok(err);
                    Assert.equal('ETIMEDOUT', err.code);
                    Assert.equal('ESOCKTIMEDOUT', err.type);
                    done();
                }
            });
        });

        it('should handle timeout error with no response end', function (done) {

            var Server = require('./fixtures/hello-streaming/server');

            server = Server.start(50015);

            var client = Trooba.transport(grpcTransport, {
                port: 50015,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello'
            }).create();

            var messageCount = 0;

            client.beGreeted('no-end', function (err, response) {
                if (messageCount++ > 1) {
                    Assert.ok(err);
                    Assert.equal('ETIMEDOUT', err.code);
                    Assert.equal('ESOCKTIMEDOUT', err.type);
                    done();
                }
                Assert.ok(!err, err && err.stack);
                Assert.ok([
                    'Hello no-end from John',
                    'Hello no-end from Bob'
                ].indexOf(response) !== -1);
            });
        });

        it.skip('should handle error in stream/stream flow', function (done) {
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
