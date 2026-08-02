const net = require('net');

class Rcon {
    constructor(host, port, password, timeout = 5000) {
        this.host = host;
        this.port = parseInt(port) || 25575;
        this.password = password;
        this.timeout = timeout;
        this.socket = null;
        this.requestId = 1;
        this.authed = false;
        this.responseCallbacks = new Map();
    }

    connect() {
        return new Promise((resolve, reject) => {
            if (this.socket) {
                if (this.authed) return resolve();
                return reject(new Error('Already connecting or authenticating'));
            }

            let resolved = false;

            this.socket = net.createConnection({ host: this.host, port: this.port }, () => {
                // Connection established, send auth packet
                this.sendPacket(3, this.password) // Type 3 is Auth
                    .then(() => {
                        this.authed = true;
                        resolved = true;
                        resolve();
                    })
                    .catch(err => {
                        this.disconnect();
                        if (!resolved) reject(err);
                    });
            });

            this.socket.setTimeout(this.timeout);

            let buffer = Buffer.alloc(0);
            this.socket.on('data', (data) => {
                buffer = Buffer.concat([buffer, data]);
                while (buffer.length >= 12) {
                    const length = buffer.readInt32LE(0);
                    if (buffer.length < length + 4) break; // Incomplete packet

                    const packet = buffer.subarray(4, length + 4);
                    buffer = buffer.subarray(length + 4);

                    const id = packet.readInt32LE(0);
                    const type = packet.readInt32LE(4);
                    // Payload is null-terminated string
                    const payload = packet.toString('ascii', 8, packet.length - 2);

                    if (type === 2) { // Auth response
                        if (id === -1) {
                            const handler = this.responseCallbacks.get(1);
                            if (handler) {
                                handler.reject(new Error('Auth failed (Incorrect Password)'));
                                this.responseCallbacks.delete(1);
                            }
                        } else {
                            const handler = this.responseCallbacks.get(1);
                            if (handler) {
                                handler.resolve();
                                this.responseCallbacks.delete(1);
                            }
                        }
                    } else if (type === 0) { // Command response
                        const handler = this.responseCallbacks.get(id);
                        if (handler) {
                            handler.resolve(payload);
                            this.responseCallbacks.delete(id);
                        }
                    }
                }
            });

            this.socket.on('error', (err) => {
                this.disconnect();
                if (!resolved) reject(err);
            });

            this.socket.on('close', () => {
                this.disconnect();
            });

            this.socket.on('timeout', () => {
                this.disconnect();
                if (!resolved) reject(new Error('Connection timed out'));
            });
        });
    }

    sendPacket(type, payload) {
        return new Promise((resolve, reject) => {
            if (!this.socket) return reject(new Error('Not connected'));

            const id = type === 3 ? 1 : ++this.requestId;
            const payloadBuffer = Buffer.from(payload, 'ascii');
            const length = 4 + 4 + payloadBuffer.length + 2;

            const packet = Buffer.alloc(4 + length);
            packet.writeInt32LE(length, 0);
            packet.writeInt32LE(id, 4);
            packet.writeInt32LE(type, 8);
            payloadBuffer.copy(packet, 12);
            packet.writeUInt8(0, 12 + payloadBuffer.length); // payload null terminator
            packet.writeUInt8(0, 13 + payloadBuffer.length); // packet padding null terminator

            this.responseCallbacks.set(id, { resolve, reject });
            this.socket.write(packet);
        });
    }

    execute(command) {
        if (!this.authed) {
            return this.connect().then(() => this.execute(command));
        }
        return this.sendPacket(2, command); // Type 2 is Command execution
    }

    disconnect() {
        this.authed = false;
        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }
        for (const [id, callback] of this.responseCallbacks.entries()) {
            callback.reject(new Error('Disconnected'));
        }
        this.responseCallbacks.clear();
    }
}

module.exports = Rcon;
