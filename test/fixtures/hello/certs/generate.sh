#!/bin/bash

# Generate CA key:
openssl genrsa -passout pass:1111 -des3 -out ca.key 2048

# Generate CA certificate:
openssl req -passin pass:1111 -new -x509 -days 365 -key ca.key -out ca.crt -subj  "/C=US/ST=California/O=MyComp Inc/CN=localhost"

# Generate server key:
openssl genrsa -passout pass:1111 -des3 -out server.key 2048

# Generate server signing request:
openssl req -passin pass:1111 -new -key server.key -out server.csr -subj  "/C=US/ST=California/O=MyComp Inc/CN=localhost"

# Self-sign server certificate:
openssl x509 -passin pass:1111 -req -days 365 -in server.csr -CA ca.crt -CAkey ca.key -set_serial 01 -out server.crt

# Remove passphrase from the server key:
openssl rsa -passin pass:1111 -in server.key -out server.key



# Generate client key:
openssl genrsa -passout pass:1111 -des3 -out client.key 2048

# Generate client signing request:
openssl req -passin pass:1111 -new -key client.key -out client.csr -subj  "/C=US/ST=California/O=MyComp Inc/CN=localhost"

# Self-sign client certificate:
openssl x509 -passin pass:1111 -req -days 365 -in client.csr -CA ca.crt -CAkey ca.key -set_serial 01 -out client.crt
# Generate CA key:
openssl genrsa -passout pass:1111 -des3 -out ca.key 2048

# Generate CA certificate:
openssl req -passin pass:1111 -new -x509 -days 365 -key ca.key -out ca.crt -subj  "/C=US/ST=California/O=MyComp Inc/CN=localhost"

# Generate server key:
openssl genrsa -passout pass:1111 -des3 -out server.key 2048

# Generate server signing request:
openssl req -passin pass:1111 -new -key server.key -out server.csr -subj  "/C=US/ST=California/O=MyComp Inc/CN=localhost"

# Self-sign server certificate:
openssl x509 -passin pass:1111 -req -days 365 -in server.csr -CA ca.crt -CAkey ca.key -set_serial 01 -out server.crt

# Remove passphrase from the server key:
openssl rsa -passin pass:1111 -in server.key -out server.key



# Generate client key:
openssl genrsa -passout pass:1111 -des3 -out client.key 2048

# Generate client signing request:
openssl req -passin pass:1111 -new -key client.key -out client.csr -subj  "/C=US/ST=California/O=MyComp Inc/CN=localhost"

# Self-sign client certificate:
openssl x509 -passin pass:1111 -req -days 365 -in client.csr -CA ca.crt -CAkey ca.key -set_serial 01 -out client.crt

# Remove passphrase from the client key:
openssl rsa -passin pass:1111 -in client.key -out client.key
