'use strict';

const config = require('../config.json');
const redis = require('redis');

const redisOptions = {
    host: config.redis.host,
    port: config.redis.port,
    //string_numbers: true,
    //socket_keepalive: true,
    //db: null,
    tls: false
};
if (config.redis.password) {
    redisOptions.password = config.redis.password;
}
const client = redis.createClient(redisOptions);
client.on('connect', () => {
    console.log('[Redis] Connected');
});
client.on('error', (error) => {
    console.error('[Redis] Error:', error);
});

class Redis {
    static instance = new Redis();

    constructor() {
    }

    async hget(key, field) {
        return new Promise(async (resolve, reject) => {
            client.hget(key, field, (err, reply) => {
                if (err) {
                    console.error('[Redis] Error:', err);
                    return reject(err);
                }
                if (!reply) {
                    return resolve(reply);
                }
                let obj = JSON.parse(reply);
                return resolve(obj);
            });
        });
    }

    async hset(key, field, value) {
        return new Promise(async (resolve, reject) => {
            client.hset(key, field, JSON.stringify(value), (err, reply) => {
                if (err) {
                    console.error('[Redis] Error:', err);
                    return reject(err);
                }
                //console.log('[Redis] Reply:', reply);
                resolve(reply);
            });
        });
    }
}

module.exports = Redis.instance;