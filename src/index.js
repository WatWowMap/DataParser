'use strict';

const express = require('express');
const app = express();

const config = require('./config.json');

const RouteController = require('./routes/index.js');
const routes = new RouteController();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.get('/', (req, res) => {
    res.send('OK');
});

app.post('/raw', async (req, res) => await routes.handleRawData(req, res));
app.post('/controler', async (req, res) => await routes.handleControllerData(req, res));

app.listen(config.port, config.host, () => console.log(`Listening on ${config.host}:${config.port}...`));