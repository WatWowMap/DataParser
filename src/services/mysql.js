'use strict';

const mysql = require('mysql');
const config = require('../config.json');

const pool  = mysql.createPool({
    connectionLimit  : 10,
    host             : config.db.host,
    port             : config.db.port,
    user             : config.db.username,
    password         : config.db.password,
    database         : config.db.database,
    charset          : config.db.charset,
    supportBigNumbers: true,
    connectionLimit  : 1000,
    //connectTimeout   : 15 * 1000,
    //acquireTimeout   : 15 * 1000,
    //timeout          : 15 * 1000
});

//pool.on('acquire', (connection) => {
//    console.log('[MySQL] Connection %d acquired', connection.threadId);
//});

pool.on('enqueue', () => {
    console.log('[MySQL] Waiting for available connection slot');
});

//pool.on('release', (connection) => {
//    console.log('[MySQL] Connection %d released', connection.threadId);
//});

class MySQLConnector {

    constructor(config) {
        this.config = config;
    }

    async query(sql, args) {
        return new Promise((resolve, reject) => {
            pool.getConnection((err, connection) => {
                if (err) {
                    // Not connected
                    return reject(err);
                }
          
                // Use the connection
                connection.query(sql, args, (error, results, fields) => {
                    // When done with the connection, release it
                    connection.release();
                    // Handle error after the release
                    if (error) {
                        return reject(error);
                    }
                    resolve(results);
                });
            });
        });
    }
}

module.exports = MySQLConnector;