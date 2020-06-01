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
        }).build().create('client:default');

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
        }).build().create('client:default');

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
        }).build().create('client:default');

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
        }).build().create('client:default');

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
        }).build().create('client:default');

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
        }).create('client:default');

        var call = client.sayHello(function (err, response) {
            // getting response
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
        }).build().create('client:default');

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
        }).build().create('client:default');

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
        }).build().create('client:default');

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
        }).build().create('client:default');

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
        }).build().create('client:default');

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
        }).build().create('client:default');

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
            connectTimeout: 1,
            socketTimeout: 1000
        }).build().create('client:default');

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
            serviceName: 'Hello',
            socketTimeout: 100
        }).build().create('client:default');

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
            serviceName: 'Hello',
            socketTimeout: 100
        }).build().create('client:default');

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

    it('should handle packaged proto', function (done) {
        var Server = require('./fixtures/hello-pkg/server');

        var port = portCounter++;
        server = Server.start(port);
        var meta;

        var client = Trooba
        .use(function catchMeta(pipe) {
            pipe.on('response', function (response, next) {
                meta = response.headers;
                next();
            });
        })
        .use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto.com.xyz.helloworld,
            serviceName: 'Hello'
        })
        .build().create('client:default');

        client.sayHello('John', function (err, response) {
            setTimeout(function () {
                Assert.ok(!err, err && err.stack);
                Assert.equal('Hello John', response);
                Assert.deepEqual({
                    foo: 'bar'
                }, meta);
                done();
            }, 500);
        });

    });

    it('should propagate response metadata', function (done) {
        var Server = require('./fixtures/hello/server');

        var port = portCounter++;
        server = Server.start(port);
        var meta;

        var client = Trooba
        .use(function catchMeta(pipe) {
            pipe.on('response', function (response, next) {
                meta = response.headers;
                next();
            });
        })
        .use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        })
        .build().create('client:default');

        client.sayHello('John', function (err, response) {
            setTimeout(function () {
                Assert.ok(!err, err && err.stack);
                Assert.equal('Hello John', response);
                Assert.deepEqual({
                    foo: 'bar'
                }, meta);
                done();
            }, 500);
        });

    });

    it('should propagate request metadata', function (done) {
        var Server = require('./fixtures/hello/server');

        var port = portCounter++;
        server = Server.start(port);
        var meta;

        var client = Trooba
        .use(function injectMeta(pipe) {
            pipe.on('request', function (request, next) {
                request.headers = {
                    qaz: 'wsx'
                };
                next();
            });
            pipe.on('response', function (response, next) {
                meta = response.headers;
                next();
            });
        })
        .use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        })
        .build().create('client:default');

        client.sayHello('John', function (err, response) {
            setTimeout(function () {
                Assert.ok(!err, err && err.stack);
                Assert.equal('Hello John', response);
                Assert.deepEqual({
                    foo: 'bar',
                    rfv: 'wsx'
                }, meta);
                done();
            }, 500);
        });
    });

    it('should propagate response metadata from response stream', function (done) {

        var Server = require('./fixtures/hello-streaming/server');

        var port = portCounter++;
        server = Server.start(port);
        var meta;

        var client = Trooba
        .use(function handleMeta(pipe) {
            pipe.on('response', function (data, next) {
                meta = data.headers;
                next();
            });
        })
        .use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).build().create('client:default');

        var messageCount = 0;

        client.beGreeted('Jack')
        .on('data', function (data) {
            messageCount++;
            Assert.ok([
                'Hello Jack from John',
                'Hello Jack from Bob'
            ].indexOf(data) !== -1);
        })
        .on('end', function () {
            Assert.equal(2, messageCount);
            Assert.deepEqual({ foo: 'bar' }, meta);
            done();
        })
        .on('error', done);
    });

    it('should propagate request metadata from request stream', function (done) {
        var Server = require('./fixtures/hello-streaming/server');

        var port = portCounter++;
        server = Server.start(port);
        var meta;

        var client = Trooba
        .use(function injectMeta(pipe) {
            pipe.on('request', function (request, next) {
                request.headers = {
                    qaz: 'wsx'
                };
                next();
            });
            pipe.on('response', function (response, next) {
                meta = response.headers;
                next();
            });
        })
        .use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).build().create('client:default');

        var call = client.sayHello(function (err, response) {
            // getting reponse
            Assert.ok(!err, err && err.stack);
            Assert.equal('Hello John and Bob', response);
            Assert.deepEqual({
                foo: 'bar',
                rfv: 'wsx'
            }, meta);
            done();
        });

        call.write('John');
        call.write('Bob');
        call.end();
    });

    it('should propagate response metadata from response stream', function (done) {
        var Server = require('./fixtures/hello-streaming/server');

        var port = portCounter++;
        server = Server.start(port);
        var meta;

        var client = Trooba
        .use(function injectMeta(pipe) {
            pipe.on('request', function (request, next) {
                request.headers = {
                    qaz: 'wsx'
                };
                next();
            });
            pipe.on('response', function (response, next) {
                meta = response.headers;
                next();
            });
        })
        .use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).build().create('client:default');


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
            Assert.deepEqual({
                foo: 'bar',
                rfv: 'wsx'
            }, meta);
            done();
        });

        // sending request
        call.write('John');
        call.write('Bob');
        call.end();

    });

    describe('negative', function () {
        it('should handle connect timeout, request/response', function (done) {
            var Server = require('./fixtures/hello-timeout/server');
            var port = portCounter++;

            var client = Trooba.use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello',
                connectTimeout: 10
            }).build().create('client:default');

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
            }).build().create('client:default');

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
            }).build().create('client:default');

            client.request$({
                name: 'sayHello'
            }, 'John', function (err, response) {
                Assert.ok(err);
                Assert.equal('ETIMEDOUT', err.code);
                done();
            });
        });

        it('should handle timeout error in response stream flow', function (done) {

            var Server = require('./fixtures/hello-streaming/server');

            var port = portCounter++;
            server = Server.start(port);

            var client = Trooba.use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello',
                socketTimeout: 100
            }).build().create('client:default');

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
            }).build().create('client:default');

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
                serviceName: 'Hello',
                socketTimeout: 100
            }).build().create('client:default');

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
            }).build().create('client:default');

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

        it('should handle diconnect while waiting for response', function (done) {
            var Server = require('./fixtures/hello/server');

            var port = portCounter++;
            server = Server.start(port);

            var client = Trooba.use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello'
            }).build().create('client:default');

            client.sayHello('disconnect', function (err, response) {
                Assert.ok(err);
                done();
            });

        });

        it('should handle diconnect while waitng for response stream', function (done) {
            var Server = require('./fixtures/hello-streaming/server');

            var port = 100 + portCounter++;
            server = Server.start(port);

            var client = Trooba.use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello',
                socketTimeout: 100
            }).build().create('client:default');

            var counter = 0;

            client.beGreeted('timeout-after-first-chunk')
            .on('data', function (data) {
                counter++;
                Assert.equal('Hello timeout-after-first-chunk from Bob', data);
                server.forceShutdown();
            })
            .on('error', function (err) {
                Assert.ok(err);
                Assert.equal(1, counter);
                done();
            });
        });

        it('should handle diconnect while sending request', function (done) {
            var Server = require('./fixtures/hello/server');

            var port = portCounter++;
            server = Server.start(port);

            var client = Trooba
            .use(function (pipe) {
                pipe.on('request', function (request, next) {
                    server.forceShutdown();
                    next();
                });
            })
            .use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello',
                connectTimeout: 100
            }).build().create('client:default');

            client.sayHello('disconnect', function (err, response) {
                Assert.ok(err);
                Assert.equal('ETIMEDOUT', err.code);
                done();
            });

        });

        it('should handle diconnect while writing into request stream', function (done) {
            var Server = require('./fixtures/hello-streaming/server');

            var port = portCounter++;
            server = Server.start(port);

            var client = Trooba
            .use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello',
                connectTimeout: 100
            }).build().create('client:default');


            var messageCount = 0;

            var call = client.sayHelloAll();
            call.on('data', function (data) {
                messageCount++;
                Assert.ok([
                    'Hello John',
                    'Hello Bob'
                ].indexOf(data) !== -1);
            })
            .on('error', function (err) {
                Assert.ok(err);
                done();
            });

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

        it('should handle re-connect', function (done) {
            this.timeout(5000);
            var Server = require('./fixtures/hello-streaming/server');

            var port = portCounter++;
            server = Server.start(port);

            var client = Trooba
            .use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello',
                socketTimeout: 2000
            }).build().create('client:default');

            var messageCount = 0;
            var errorCount = 0;

            var call = client.sayHelloAll();
            call.on('data', function (data) {
                messageCount++;
                Assert.ok([
                    'Hello John',
                    'Hello Bob'
                ].indexOf(data) !== -1);
            })
            .on('error', function (err) {
                errorCount++;
            });

            // sending request
            call.write('John');
            setTimeout(function () {
                server.forceShutdown();
                server = Server.start(port);
                setTimeout(function () {
                    var messageCount = 0;

                    var call = client.sayHelloAll();
                    call.on('data', function (data) {
                        messageCount++;
                        Assert.ok([
                            'Hello John',
                            'Hello Bob'
                        ].indexOf(data) !== -1);
                    })
                    .on('end', function () {
                        Assert.equal(2, messageCount);
                        Assert.equal(1, errorCount);
                        done();
                    })
                    .on('error', err => {
                        done(err);
                    });

                    call.write('John');
                    call.write('Bob');
                    call.end();
                }, 100);
            }, 500);
        });

    });

    it('should send a massive number of messages to the server [perf]', function (done) {
        this.timeout(2000);

        var Server = require('./fixtures/hello-streaming/server');

        var port = portCounter++;

        var client = Trooba
        .use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello',
            connectTimeout: 2000
        }).build().create('client:default');

        var MAX = 1000;
        var names = [];
        var paused = false;
        var drained = false;
        var call = client.sayHello(function (err, response) {
            // getting reponse
            Assert.ok(!err, err && err.stack);
            Assert.equal(MAX, names.length);
            Assert.equal('Hello ' + names.join(' and '), response);
            // no pause will happen for now as we queue on pipe point
            // Assert.ok(paused);
            // Assert.ok(drained);
            done();
        });

        function write(index) {
            index = index || 0;
            for (var i = index; i < MAX; i++) {
                var name = 'John' + i;
                names.push(name);
                if (!call.write(name)) {
                    paused = true;
                    call.on('drain', drain);
                    return;
                }
            }
            function drain() {
                drained = true;
                write(i + 1);
            }
            call.end();
        }

        write();

        server = Server.start(port);
    });

    // gRPC does not seem to re-try anymore, starting around 1.3.x version
    // the workaround is to use re-try handler in trooba in case of timeout
    it.skip('should handle write pause at transport side, request stream', function (done) {
        var Server = require('./fixtures/hello-streaming/server');

        var port = portCounter++;

        var client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello',
            connectTimeout: 2000
        }).build().create('client:default');

        var call = client.sayHello(function (err, response) {
            // getting reponse
            Assert.ok(!err, err && err.stack);
            Assert.equal('Hello John and Bob', response);
            done();
        });

        call.write('John');
        call.write('Bob');
        call.end();

        setTimeout(function () {
            server = Server.start(port);
        }, 200);
    });

    it('should handle call.read drain at client side, massive read of messages', function (done) {
        this.timeout(5000);
        var Server = require('./fixtures/hello-streaming/server');

        var port = portCounter++;
        server = Server.start(port);

        var client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).build().create('client:default');

        var messageCount = 0;

        var call = client.beGreeted('massive');

        setTimeout(function () {
            call
            .on('data', function (data) {
                messageCount++;
                Assert.ok(!data || data.indexOf('Hello massive from John') === 0);
            })
            .on('end', function () {
                // reached the end
                Assert.equal(1000, messageCount);
                done();
            })
            .on('error', done);
        }, 1000);
    });

    describe('parallel', function () {
        it('should handle request/response flow', function (done) {
            var Server = require('./fixtures/hello/server');
            var MAX = 1000;
            var port = portCounter++;
            server = Server.start(port);

            var client = Trooba.use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello'
            }).build().create('client:default');

            var count = 0;
            Async.times(MAX, function (n, next) {
                sayHello(n, next);
            }, function (err) {
                Assert.ok(!err);
                Assert.equal(MAX, count);
                done();
            });

            function sayHello(index, next) {
                client.sayHello('' + index, function (err, response) {
                    Assert.ok(!err, err && err.stack);
                    Assert.equal('Hello ' + index, response);
                    count++;
                    next();
                });
            }
        });

        it('should handle stream/response flow', function (done) {
            var Server = require('./fixtures/hello-streaming/server');

            var port = portCounter++;
            server = Server.start(port);

            var client = Trooba.use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello',
                socketTimeout: 10000
            }).build({
                // trace: true,
                // tracer$: function (message, point) {
                //     console.log('*** trace: ', point._id , point.handler.name, message.type, message.context.$points)
                // }
            }).create('client:default');

            var count = 0;
            var REQUESTS = 1000;

            Async.times(REQUESTS, function (n, next) {
                sayHello(n, next);
            }, function (err) {
                Assert.ok(!err);
                Assert.equal(REQUESTS, count);
                done();
            });

            function sayHello(index, next) {
                var call = client.sayHello(function (err, response) {
                    // getting reponse
                    Assert.ok(!err, err && err.stack);
                    Assert.equal('Hello John' + index + ' and Bob' + index, response);
                    count++;
                    next();
                });

                call.write('John' + index);
                call.write('Bob' + index);
                call.end();
            }

        });

        it('should handle stream/stream flow', function (done) {
            this.timeout(5000);
            var Server = require('./fixtures/hello-streaming/server');

            var port = portCounter++;
            server = Server.start(port);

            var client = Trooba
            .use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello',
                socketTimeout: 2000
            }).build().create('client:default');

            var count = 0;

            Async.times(1000, function (n, next) {
                sayHello(n, next);
            }, function (err) {
                Assert.ok(!err);
                Assert.equal(1000, count);
                done();
            });

            function sayHello(index, next) {
                var messageCount = 0;
                var call = client.sayHelloAll();
                call.on('data', function (data) {
                    messageCount++;
                    Assert.ok([
                        'Hello John' + index,
                        'Hello Bob' + index
                    ].indexOf(data) !== -1);
                }).on('end', function () {
                    Assert.equal(2, messageCount);
                    count++;
                    next();
                });

                // sending request
                call.write('John' + index);
                call.write('Bob' + index);
                call.end();
            }
        });
    });
});
