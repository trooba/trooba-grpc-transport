'use strict';

var Assert = require('assert');
var Async = require('async');
var Domain = require('domain');
var Trooba = require('trooba');
var grpcTransport = require('..');
const { reject } = require('lodash');

describe(__filename, function () {

    var server;
    var portCounter = 50000;

    afterEach(function () {
        server && server.forceShutdown();
    });

    it('should expose proto API', async () => {
        var Server = require('./fixtures/hello/server');

        var port = portCounter++;
        server = await Server.start(port);

        var client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).build().create('client:default');

        const response = await new Promise((resolve, reject) => {
            client.sayHello({
                name: 'John'
            }, (err, response) => {
                if (err) {
                    return reject(err);
                }
                resolve(response);
            });
        });

        Assert.equal('Hello John', response);
    });

    it('should do ssl', async () => {
        const Server = require('./fixtures/hello/server');

        const port = portCounter++;
        server = await Server.startSsl(port);

        const client = Trooba.use(grpcTransport, {
            port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello',
            credentials: Server.clientCredentials
        }).build().create('client:default');

        const response = await new Promise((resolve, reject) => {
            client.sayHello({
                name: 'John'
            }, (err, response) => {
                if (err) {
                    return reject(err);
                }
                resolve(response);
            });
        });

        Assert.equal('Hello John', response);
    });

    it.skip('should do real example', async () => {
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

        const response = await new Promise((resolve, reject) => {
            client.sayHello({
                name: 'John'
            }, (err, response) => {
                if (err) {
                    return reject(err);
                }
                resolve(response);
            });
        });
    });


    it('should expose proto API with multiple methods, serial', async () => {
        const Server = require('./fixtures/multi-hello/server');

        const port = portCounter++;
        server = await Server.start(port);

        const client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).build().create('client:default');

        const response = await new Promise((resolve, reject) => {
            client.sayHello({
                name: 'John'
            }, (err, response) => {
                if (err) {
                    return reject(err);
                }
                resolve(response);
            });
        });

        Assert.equal('Hello John', response);

        const responseHi = await new Promise((resolve, reject) => {
            client.sayHi({
                name: 'Bob'
            }, (err, response) => {
                if (err) {
                    return reject(err);
                }
                resolve(response);
            });
        });

        Assert.equal('Hi Bob', responseHi);
    });

    it('should expose proto API with multiple methods, parallel', async () => {
        const Server = require('./fixtures/multi-hello/server');

        const port = portCounter++;
        server = await Server.start(port);

        const client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).build().create('client:default');

        const [responseHello, responseHi] = await Promise.all([new Promise((resolve, reject) => {
            client.sayHello({
                name: 'John'
            }, (err, response) => {
                if (err) {
                    return reject(err);
                }
                resolve(response);
            });
        }),
        new Promise((resolve, reject) => {
            client.sayHi({
                name: 'Bob'
            }, (err, response) => {
                if (err) {
                    return reject(err);
                }
                resolve(response);
            });
        })]);
        Assert.equal('Hello John', responseHello);
        Assert.equal('Hi Bob', responseHi);
    });

    it('should expose proto with streaming request API', async () => {
        const Server = require('./fixtures/hello-streaming/server');

        const port = portCounter++;
        server = await Server.start(port);

        const client = Trooba.use(grpcTransport, {
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

        const response = await new Promise((resolve, reject) => {
            const call = client.sayHello((err, response) => {
                if (err) {
                    return reject(err);
                }
                resolve(response);
            });

            call.write({
                name: 'John'
            });
            call.write({
                name: 'Bob'
            });
            call.end();
        });

        Assert.equal('Hello John and Bob', response);
    });

    it('should expose proto with streaming response API', async () => {
        const Server = require('./fixtures/hello-streaming/server');

        const port = portCounter++;
        server = await Server.start(port);

        const client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).build().create('client:default');

        let messageCount = 0;

        await new Promise((resolve, reject) => {
            const call = client.beGreeted({
                name: 'Jack'
            });
            call.on('data', function (data) {
                messageCount++;
                try {
                    Assert.ok([
                        'Hello Jack from John',
                        'Hello Jack from Bob'
                    ].indexOf(data) !== -1);
                }
                catch (err) {
                    reject(err);
                }
            })
            .on('end', function () {
                // reached the end
                try {
                    Assert.equal(2, messageCount);
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            })
            .on('error', reject);            
        });
    });

    it('stream/stream, should expose streaming API', async () => {
        const Server = require('./fixtures/hello-streaming/server');

        const port = portCounter++;
        server = await Server.start(port);

        const client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).build().create('client:default');

        let messageCount = 0;

        return new Promise((resolve, reject) => {
            const call = client.sayHelloAll();
            call.on('data', function (data) {
                messageCount++;
                try {
                    // Assert.ok([
                    //     'Hello John',
                    //     'Hello Bob'
                    // ].indexOf(data) !== -1);
                }
                catch (err) {
                    reject(err);
                }
            }).on('end', function () {
                try {
                    // Assert.equal(2, messageCount);
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            });

            // sending request
            call.write({
                name: 'John'
            });
            call.write({
                name: 'Bob'
            });
            call.end();
        });
    });

    it('should expose proto API with multiple services', async () => {
        const Server = require('./fixtures/multi-hello/server');
        const port = portCounter++;
        server = await Server.start(port);

        const client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).build().create('client:default');

        const response = await new Promise((resolve, reject) => {
            client.sayHello({
                name: 'John'
            }, (err, response) => {
                if (err) {
                    return reject(err);
                }
                resolve(response);
            });
        });
        Assert.equal('Hello John', response);
    });

    it('should invoke grpc operation', async () => {
        const Server = require('./fixtures/multi-hello/server');
        const port = portCounter++;
        server = await Server.start(port);

        const client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).build().create('client:default');

        const response = await new Promise((resolve, reject) => {
            client.request$({
                name: 'sayHello'
            }, {
                name: 'John'
            }, (err, response) => {
                if (err) return reject(err);
                resolve(response);
            })
        });
        Assert.equal('Hello John', response);
    });

    it('should keep context with request/response', async () => {
        const Server = require('./fixtures/multi-hello/server');
        const port = portCounter++;
        server = await Server.start(port);

        const client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).build().create('client:default');

        const domain = Domain.create();
        return new Promise((resolve, reject) => {
            domain.run(function () {
                process.domain.foo = 'bar';

                client.request$({
                    name: 'sayHello'
                }, {
                    name: 'John'
                }, function (err, response) {
                    try {
                        Assert.ok(!err, err && err.stack);
                        Assert.equal('Hello John', response);
                        Assert.equal('bar', process.domain.foo);
                        resolve();
                    }
                    catch (err) {
                        reject(err);
                    }
                });
            });            
        });
    });

    it('should keep context with response stream', async () => {
        const Server = require('./fixtures/hello-streaming/server');

        const port = portCounter++;
        server = await Server.start(port);

        const client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).build().create('client:default');

        return new Promise((resolve, reject) => {
            const domain = Domain.create();
            domain.run(function () {
                process.domain.foo = 'bar';

                var messageCount = 0;

                client.beGreeted({
                    name: 'Jack'
                })
                .on('data', function (data) {
                    messageCount++;
                    try {
                        Assert.ok([
                            'Hello Jack from John',
                            'Hello Jack from Bob'
                        ].indexOf(data) !== -1);
                    }
                    catch (err) {
                        reject(err);
                    }
                })
                .on('end', function () {
                    try {
                        Assert.equal(2, messageCount);
                        Assert.equal('bar', process.domain.foo);
                        resolve();
                    }
                    catch (err) {
                        reject(err);
                    }
                })
                .on('error', reject);
            });
        });
    });

    it('should keep context when connect error happens', async () => {
        const Server = require('./fixtures/hello-timeout/server');
        const port = portCounter++;
        server = await Server.start(port);

        const client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello',
            connectTimeout: 1,
            socketTimeout: 1000
        }).build().create('client:default');

        const domain = Domain.create();
        return new Promise((resolve, reject) => {
            domain.run(function () {
                process.domain.foo = 'bar';

                client.request$({
                    name: 'sayHello'
                }, 'John', function (err, response) {
                    try {
                        Assert.ok(err);
                        Assert.equal('ETIMEDOUT', err.code);
                        Assert.equal('bar', process.domain.foo);
                        resolve();
                    }
                    catch (err) {
                        reject(err);
                    }
                });
            });
        });
    });

    it('should keep context when response timeout error happens', async () => {
        const Server = require('./fixtures/hello-timeout/server');

        const port = portCounter++;
        server = await Server.start(port);

        const client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello',
            socketTimeout: 100
        }).build().create('client:default');

        const domain = Domain.create();
        return new Promise((resolve, reject) => {
            domain.run(function () {
                process.domain.foo = 'bar';

                client.request$({
                    name: 'sayHello'
                }, {
                    name: 'timeout'
                }, function (err, response) {
                    try {
                        Assert.ok(err);
                        Assert.equal('ETIMEDOUT', err.code);
                        Assert.equal('ESOCKTIMEDOUT', err.type);
                        Assert.equal('bar', process.domain.foo);
                        resolve();
                    }
                    catch (err) {
                        reject(err);
                    }
                });
            });
        });
    });

    it('should keep context when response stream error happens', async () => {
        const Server = require('./fixtures/hello-streaming/server');

        const port = portCounter++;
        server = await Server.start(port);

        const client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello',
            socketTimeout: 100
        }).build().create('client:default');

        return new Promise((resolve, reject) => {
            const domain = Domain.create();
            domain.run(function () {
                process.domain.foo = 'bar';
                client.beGreeted({
                    name: 'timeout'
                })
                .on('error', function (err) {
                    try {
                        Assert.ok(err);
                        Assert.equal('bar', process.domain.foo);
                        Assert.equal('ETIMEDOUT', err.code);
                        Assert.equal('ESOCKTIMEDOUT', err.type);
                        resolve();
                    }
                    catch (err) {
                        reject(err);
                    }
                })
                .on('data', function () {
                    reject(new Error('Should not happen'));
                });
            });
        });
    });

    it('should handle packaged proto', async () => {
        const Server = require('./fixtures/hello-pkg/server');

        const port = portCounter++;
        server = await Server.start(port);
        let meta;

        const client = Trooba
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

        return new Promise((resolve, reject) => {
            client.sayHello({
                name: 'John'
            }, function (err, response) {
                try {
                    Assert.ok(!err, err && err.stack);
                    Assert.equal('Hello John', response);
                    Assert.deepEqual({
                        foo: 'bar'
                    }, {
                        foo: meta.foo
                    });
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            });
        });
    });

    it('should propagate response metadata', async () => {
        const Server = require('./fixtures/hello/server');

        const port = portCounter++;
        server = await Server.start(port);
        let meta;

        const client = Trooba
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

        return new Promise((resolve, reject) => {
            client.sayHello({
                name: 'John'
            }, function (err, response) {
                try {
                    Assert.ok(!err, err && err.stack);
                    Assert.equal('Hello John', response);
                    Assert.deepEqual({
                        foo: 'bar'
                    }, {
                        foo: meta.foo
                    });
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            });
        });
    });

    it('should propagate request metadata', async () => {
        const Server = require('./fixtures/hello/server');

        const port = portCounter++;
        server = await Server.start(port);
        let meta;

        const client = Trooba
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

        return new Promise((resolve, reject) => {
            client.sayHello({
                name: 'John'
            }, function (err, response) {
                try {
                    Assert.ok(!err, err && err.stack);
                    Assert.equal('Hello John', response);
                    const { "content-type": ct, date, ...rest } = meta;
                    Assert.deepEqual({
                        foo: 'bar',
                        rfv: 'wsx'
                    }, rest);
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            });
        });
    });

    it('should propagate response metadata from response stream', async () => {
        const Server = require('./fixtures/hello-streaming/server');

        const port = portCounter++;
        server = await Server.start(port);
        let meta;

        const client = Trooba
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

        let messageCount = 0;

        return new Promise((resolve, reject) => {
            client.beGreeted({
                name: 'Jack'
            })
            .on('data', function (data) {
                messageCount++;
                try {
                    Assert.ok([
                        'Hello Jack from John',
                        'Hello Jack from Bob'
                    ].indexOf(data) !== -1);
                }
                catch (err) {
                    reject(err);
                }
            })
            .on('end', function () {
                try {
                    Assert.equal(2, messageCount);
                    Assert.deepEqual({ foo: 'bar' }, {
                        foo: meta.foo
                    });
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            })
            .on('error', reject);
        });
    });

    it('should propagate request metadata from request stream', async () => {
        const Server = require('./fixtures/hello-streaming/server');

        const port = portCounter++;
        server = await Server.start(port);
        let meta;

        const client = Trooba
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

        return new Promise((resolve, reject) => {
            const call = client.sayHello(function (err, response) {
                // getting reponse
                try {
                    Assert.ok(!err, err && err.stack);
                    Assert.equal('Hello John and Bob', response);
                    Assert.deepEqual({
                        foo: 'bar',
                        rfv: 'wsx'
                    }, {
                        foo: meta.foo,
                        rfv: meta.rfv
                    });
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            });

            call.write({
                name: 'John'
            });
            call.write({
                name: 'Bob'
            });
            call.end();
        });
    });

    it('should propagate request and response metadata from response stream', async () => {
        const Server = require('./fixtures/hello-streaming/server');

        const port = portCounter++;
        server = await Server.start(port);
        let meta;

        const client = Trooba
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

        return new Promise((resolve, reject) => {
            const call = client.sayHelloAll();
            call.on('data', function (data) {
                messageCount++;
                try {
                    Assert.ok([
                        'Hello John',
                        'Hello Bob'
                    ].indexOf(data) !== -1);
                }
                catch (err) {
                    reject(err);
                }
            }).on('end', function () {
                try {
                    Assert.equal(2, messageCount);
                    const { foo, rfv, ...rest } = meta;
                    Assert.deepEqual({
                        foo: 'bar',
                        rfv: 'wsx'
                    }, {
                        foo, rfv
                    });
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            });

            // sending request
            call.write({
                name: 'John'
            });
            call.write({
                name: 'Bob'
            });
            call.end();
        });
    });

    describe('negative', function () {
        it('should handle connect timeout, request/response', async () => {
            const Server = require('./fixtures/hello-timeout/server');
            const port = portCounter++;

            const client = Trooba.use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello',
                connectTimeout: 10
            }).build().create('client:default');

            return new Promise((resolve, reject) => {
                client.request$({
                    name: 'sayHello'
                }, {
                    name: 'John'
                }, function (err, response) {
                    try {
                        Assert.ok(err);
                        Assert.equal('ETIMEDOUT', err.code);
                        resolve();
                    }
                    catch (err) {
                        reject(err);
                    }
                });
            });
        });

        it('should handle socket/read timeout, request/response', async () => {
            const Server = require('./fixtures/hello-timeout/server');
            const port = portCounter++;
            server = await Server.start(port);

            const client = Trooba.use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello',
                socketTimeout: 10
            }).build().create('client:default');

            return new Promise((resolve, reject) => {
                client.request$({
                    name: 'sayHello'
                }, {
                    name: 'John'
                }, function (err, response) {
                    try {
                        Assert.ok(err);
                        Assert.equal('ETIMEDOUT', err.code);
                        resolve();
                    }
                    catch (err) {
                        reject(err);
                    }
                });
            });
        });

        it('should handle bad hostname', async () => {
            const Server = require('./fixtures/hello/server');
            const port = portCounter++;
            server = await Server.start(port);

            const client = Trooba.use(grpcTransport, {
                port: port,
                hostname: 'bad-host',
                proto: Server.proto,
                serviceName: 'Hello',
                connectTimeout: 200
            }).build().create('client:default');

            return new Promise((resolve, reject) => {
                client.request$({
                    name: 'sayHello'
                }, {
                    name: 'John'
                }, function (err, response) {
                    try {
                        Assert.ok(err);
                        Assert.equal('ETIMEDOUT', err.code);
                        resolve();
                    }
                    catch (err) {
                        reject(err);
                    }
                });
            });
        });

        it('should handle timeout error in response stream flow', async () => {

            const Server = require('./fixtures/hello-streaming/server');

            const port = portCounter++;
            server = await Server.start(port);

            const client = Trooba.use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello',
                socketTimeout: 100
            }).build().create('client:default');

            return new Promise((resolve, reject) => {
                client.beGreeted({
                    name: 'timeout'
                })
                .on('error', function (err) {
                    try {
                        Assert.ok(err);
                        Assert.equal('ETIMEDOUT', err.code);
                        Assert.equal('ESOCKTIMEDOUT', err.type);
                        resolve();
                    }
                    catch (err) {
                        reject(err);
                    }
                })
                .on('data', function () {
                    reject(new Error('Should never happen'));
                });
            });           
        });

        it('should handle timeout error in response stream flow after first chunk', async () => {
            const Server = require('./fixtures/hello-streaming/server');

            const port = 100 + portCounter++;
            server = await Server.start(port);

            const client = Trooba.use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello',
                socketTimeout: 100
            }).build().create('client:default');

            let counter = 0;

            return new Promise((resolve, reject) => {
                client.beGreeted({
                    name: 'timeout-after-first-chunk'
                })
                .on('data', function (data) {
                    counter++;
                    try {
                        Assert.equal('Hello timeout-after-first-chunk from Bob', data);                        
                    }
                    catch (err) {
                        reject(err);
                    }
                })
                .on('error', function (err) {
                    try {
                        Assert.ok(err);
                        Assert.equal('ETIMEDOUT', err.code);
                        Assert.equal('ESOCKTIMEDOUT', err.type);
                        Assert.equal(1, counter);
                        resolve();
                    }
                    catch (err) {
                        reject(err);
                    }
                });
            });
        });

        it('should handle timeout error with no response end', async () => {
            const Server = require('./fixtures/hello-streaming/server');

            const port = portCounter++;
            server = await Server.start(port);

            const client = Trooba.use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello',
                socketTimeout: 100
            }).build().create('client:default');

            let messageCount = 0;

            return new Promise((resolve, reject) => {
                client.beGreeted({
                    name: 'no-end'
                })
                .on('data', function (data) {
                    messageCount++;
                    try {
                        Assert.ok([
                            'Hello no-end from John',
                            'Hello no-end from Bob'
                        ].indexOf(data) !== -1);
                    }
                    catch (err) {
                        reject(err);
                    }
                })
                .on('error', function (err) {
                    try {
                        Assert.ok(err);
                        Assert.equal('ETIMEDOUT', err.code);
                        Assert.equal('ESOCKTIMEDOUT', err.type);
                        Assert.equal(2, messageCount);
                        resolve();
                    }
                    catch (err) {
                        reject(err);
                    }
                });
            });
        });

        it('should re-set response timeout after each received chunk', async () => {
            const Server = require('./fixtures/hello-streaming/server');

            const port = portCounter++;
            server = await Server.start(port);

            const client = Trooba.use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello',
                socketTimeout: 130
            }).build().create('client:default');

            let messageCount = 0;

            return new Promise((resolve, reject) => {
                client.beGreeted({
                    name: 'slow'
                })
                .on('data', function (data) {
                    messageCount++;
                    try {
                        Assert.ok([
                            'Hello slow from John',
                            'Hello slow from Bob'
                        ].indexOf(data) !== -1);
                    }
                    catch (err) {
                        reject(err);
                    }
                })
                .on('error', reject)
                .on('end', function () {
                    try {
                        Assert.equal(2, messageCount);
                        resolve();
                    }
                    catch (err) {
                        reject(err);
                    }
                });
            });
        });

        it('should handle diconnect while waiting for response', async () => {
            const Server = require('./fixtures/hello/server');

            const port = portCounter++;
            server = await Server.start(port);

            const client = Trooba.use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello'
            }).build().create('client:default');

            return new Promise((resolve, reject) => {
                client.sayHello({
                    name: 'disconnect'
                }, function (err, response) {
                    if (err) {
                        return resolve(err);
                    }
                    reject(new Error('Should never happen'));
                });
            });
        });

        it('should handle diconnect while waitng for response stream', async () => {
            const Server = require('./fixtures/hello-streaming/server');

            const port = 100 + portCounter++;
            server = await Server.start(port);

            const client = Trooba.use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello',
                socketTimeout: 100
            }).build().create('client:default');

            let counter = 0;

            client.beGreeted({
                name: 'timeout-after-first-chunk'
            })
            .on('data', function (data) {
                counter++;
                try {
                    Assert.equal('Hello timeout-after-first-chunk from Bob', data);
                    server.forceShutdown();
                }
                catch (err) {
                    reject(err);
                }
            })
            .on('error', function (err) {
                try {
                    Assert.ok(err);
                    Assert.equal(1, counter);
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            });
        });

        it('should handle diconnect while sending request', async () => {
            const Server = require('./fixtures/hello/server');

            const port = portCounter++;
            server = await Server.start(port);

            const client = Trooba
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

            return new Promise((resolve, reject) => {
                client.sayHello({
                    name: 'disconnect'
                }, function (err, response) {
                    try {
                        Assert.ok(err);
                        Assert.equal('ETIMEDOUT', err.code);
                        resolve();
                    }
                    catch (err) {
                        reject(err);
                    }
                });                
            });
        });

        it('should handle diconnect while writing into request stream', async () => {
            const Server = require('./fixtures/hello-streaming/server');

            const port = portCounter++;
            server = await Server.start(port);

            const client = Trooba
            .use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello',
                connectTimeout: 100
            }).build().create('client:default');

            let messageCount = 0;

            return new Promise((resolve, reject) => {
                const call = client.sayHelloAll();
                call.on('data', function (data) {
                    messageCount++;
                    try {
                        Assert.ok([
                            'Hello John',
                            'Hello Bob'
                        ].indexOf(data) !== -1);                        
                    }
                    catch (err) {
                        reject(err);
                    }
                })
                .on('error', function (err) {
                    try {
                        Assert.ok(err);
                        resolve();
                    }
                    catch (err) {
                        reject(err);
                    }
                });

                // sending request
                call.write({
                    name: 'John'
                });
                setTimeout(function () {
                    server.forceShutdown();
                    setTimeout(function () {
                        call.write({
                            name: 'Bob'
                        });
                        call.end();
                    }, 500);
                }, 500);                
            });
        });

        it('should handle re-connect', async () => {
            this.timeout(5000);
            const Server = require('./fixtures/hello-streaming/server');

            const port = portCounter++;
            server = await Server.start(port);

            const client = Trooba
            .use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello',
                socketTimeout: 2000,
                connectTimeout: 5000
            }).build().create('client:default');

            let messageCount = 0;
            let errorCount = 0;

            return new Promise((resolve, reject) => {
                const call = client.sayHelloAll();
                call.on('data', function (data) {
                    messageCount++;
                    try {
                        Assert.ok([
                            'Hello John',
                            'Hello Bob'
                        ].indexOf(data) !== -1);
                    }
                    catch (err) {
                        reject(err);
                    }
                })
                .on('error', function (err) {
                    errorCount++;
                });

                // sending request
                call.write({
                    name: 'John'
                });
                setTimeout(async function () {
                    server.forceShutdown();
                    server = await Server.start(port);
                    setTimeout(function () {
                        let messageCount = 0;

                        const call = client.sayHelloAll();
                        call.on('data', function (data) {
                            messageCount++;
                            try {
                                Assert.ok([
                                    'Hello John',
                                    'Hello Bob'
                                ].indexOf(data) !== -1);
                            }
                            catch (err) {
                                reject(err);
                            }
                        })
                        .on('end', function () {
                            try {
                                Assert.equal(2, messageCount);
                                Assert.equal(1, errorCount);
                                resolve();
                            }
                            catch (err) {
                                reject(err);
                            }
                        })
                        .on('error', reject);

                        call.write({
                            name: 'John'
                        });
                        call.write({
                            name: 'Bob'
                        });
                        call.end();
                    }, 1000);
                }, 500);
            });
        });
    });

    it('should send a massive number of messages to the server [perf]', async () => {
        this.timeout(2000);

        const Server = require('./fixtures/hello-streaming/server');

        const port = portCounter++;

        const client = Trooba
        .use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello',
            connectTimeout: 2000
        }).build().create('client:default');

        return new Promise(async (resolve, reject) => {
            const MAX = 1000;
            const names = [];
            let paused = false;
            let drained = false;
            const call = client.sayHello(function (err, response) {
                try {
                    // getting reponse
                    Assert.ok(!err, err && err.stack);
                    Assert.equal(MAX, names.length);
                    Assert.equal('Hello ' + names.join(' and '), response);
                    // no pause will happen for now as we queue on pipe point
                    // Assert.ok(paused);
                    // Assert.ok(drained);
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            });

            function write(index) {
                index = index || 0;
                for (var i = index; i < MAX; i++) {
                    var name = 'John' + i;
                    names.push(name);
                    if (!call.write({
                        name
                    })) {
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

            server = await Server.start(port);
        });
    });

    // gRPC does not seem to re-try anymore, starting around 1.3.x version
    // the workaround is to use re-try handler in trooba in case of timeout
    it.skip('should handle write pause at transport side, request stream', async () => {
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

        call.write({
            name: 'John'
        });
        call.write({
            name: 'Bob'
        });
        call.end();

        setTimeout(async () => {
            server = await Server.start(port);
        }, 200);
    });

    it('should handle call.read drain at client side, massive read of messages', async () => {
        this.timeout(5000);
        const Server = require('./fixtures/hello-streaming/server');

        const port = portCounter++;
        server = await Server.start(port);

        const client = Trooba.use(grpcTransport, {
            port: port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).build().create('client:default');

        let messageCount = 0;

        return new Promise((resolve, reject) => {
            const call = client.beGreeted({
                name: 'massive'
            });
            setTimeout(function () {
                call
                .on('data', function (data) {
                    messageCount++;
                    try {
                        Assert.ok(!data || data.indexOf('Hello massive from John') === 0);
                    }
                    catch (err) {
                        reject(err);
                    }
                })
                .on('end', function () {
                    // reached the end
                    try {
                        Assert.equal(1000, messageCount);
                        resolve();
                    }
                    catch (err) {
                        reject(err);
                    }
                })
                .on('error', reject);
            }, 1000);            
        });
    });

    describe('parallel', function () {
        it('should handle request/response flow', async () => {
            const Server = require('./fixtures/hello/server');
            const MAX = 1000;
            const port = portCounter++;
            server = await Server.start(port);

            const client = Trooba.use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello'
            }).build().create('client:default');

            let count = 0;
            return new Promise((resolve, reject) => {
                Async.times(MAX, function (n, next) {
                    sayHello(n, next);
                }, function (err) {
                    try {
                        Assert.ok(!err);
                        Assert.equal(MAX, count);
                        resolve();
                    }
                    catch (err) {
                        reject(err);
                    }
                });
            });

            function sayHello(index, next) {
                client.sayHello({ name: '' + index }, function (err, response) {
                    try {
                        Assert.ok(!err, err && err.stack);
                        Assert.equal('Hello ' + index, response);
                        count++;
                        next();
                    }
                    catch(err) {
                        next(err);
                    }
                });
            }
        });

        it('should handle stream/response flow', async () => {
            const Server = require('./fixtures/hello-streaming/server');

            const port = portCounter++;
            server = await Server.start(port);

            const client = Trooba.use(grpcTransport, {
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

            let count = 0;
            const REQUESTS = 1000;

            return new Promise((resolve, reject) => {
                Async.times(REQUESTS, function (n, next) {
                    sayHello(n, next);
                }, function (err) {
                    try {
                        Assert.ok(!err);
                        Assert.equal(REQUESTS, count);
                        resolve();
                    }
                    catch (err) {
                        reject(err);
                    }
                });

                function sayHello(index, next) {
                    var call = client.sayHello(function (err, response) {
                        // getting reponse
                        try {
                            Assert.ok(!err, err && err.stack);
                            Assert.equal('Hello John' + index + ' and Bob' + index, response);
                            count++;
                            next();
                        }
                        catch (err) {
                            reject(err);
                        }
                    });

                    call.write({
                        name: 'John' + index
                    });
                    call.write({
                        name: 'Bob' + index
                    });
                    call.end();
                }
            });
        });

        it('should handle stream/stream flow', async () => {
            this.timeout(5000);
            const Server = require('./fixtures/hello-streaming/server');

            const port = portCounter++;
            server = await Server.start(port);

            const client = Trooba
            .use(grpcTransport, {
                port: port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello',
                socketTimeout: 2000
            }).build().create('client:default');

            let count = 0;

            return new Promise((resolve, reject) => {
                Async.times(1000, function (n, next) {
                    sayHello(n, next);
                }, function (err) {
                    Assert.ok(!err);
                    Assert.equal(1000, count);
                    resolve();
                });

                function sayHello(index, next) {
                    var messageCount = 0;
                    var call = client.sayHelloAll();
                    call.on('data', function (data) {
                        messageCount++;
                        try {
                            Assert.ok([
                                'Hello John' + index,
                                'Hello Bob' + index
                            ].indexOf(data) !== -1);
                        }
                        catch (err) {
                            reject(err);
                        }
                    }).on('end', function () {
                        try {
                            Assert.equal(2, messageCount);
                            count++;
                            next();
                        }
                        catch (err) {
                            reject(err);
                        }
                    });

                    // sending request
                    call.write({
                        name: 'John' + index
                    });
                    call.write({
                        name: 'Bob' + index
                    });
                    call.end();
                }
            });
        });
    });
});
