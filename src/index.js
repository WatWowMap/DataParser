'use strict';

const cluster = require('cluster');
const express = require('express');
const app = express();

const config = require('./config.json');
const instances = config.clusters || 4;

// TODO: Webhooks
// TODO: Add raw proto to redis
// TODO: Loop redis insert into mysql

if (cluster.isMaster) {
    console.log(`[Cluster] Master ${process.pid} is running`);
  
    // Fork workers
    for (let i = 0; i < instances; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`[Cluster] Worker ${worker.process.pid} died`);
    });
} else {
    const RouteController = require('./routes/index.js');
    const routes = new RouteController();

    app.use(express.json({ limit: '50mb' }));

    app.get('/', (req, res) => res.send('OK'));
    app.post('/raw', async (req, res) => await routes.handleRawData(req, res));

    app.listen(config.port, config.host, () => console.log(`Listening on ${config.host}:${config.port}...`));
}