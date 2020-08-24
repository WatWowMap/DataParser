'use strict';

const moment = require('moment');
const S2 = require('nodes2ts');
const POGOProtos = require('pogo-protos');
//const POGOProtos = require('../POGOProtos.Rpc_pb.js');

const config = require('../config.json');
const Account = require('../models/account.js');
const Device = require('../models/device.js');
const Gym = require('../models/gym.js');
const Pokemon = require('../models/pokemon.js');
const Pokestop = require('../models/pokestop.js');
const Spawnpoint = require('../models/spawnpoint.js');
const { sendResponse, base64_decode } = require('../services/utils.js');

const MySQLConnector = require('../services/mysql.js');
const db = new MySQLConnector(config.db);

const emptyCells = [];
const levelCache = {};

class RouteController {
    constructor() {
    }

    /**
     * Handle incoming device /controler data
     * @param {*} req 
     * @param {*} res 
     */
    async handleControllerData(req, res) {
        let payload = req.body;
        let type = payload['type'];
        let uuid = payload['uuid'];
        if (type === undefined || type === null ||
            uuid === undefined || uuid === null) {
            console.error('[Controller] Failed to parse controller data');
            return res.sendStatus(400);
        }
        //let username = payload['username'];
        let minLevel = 0;//config.minLevel || 35;
        let maxLevel = 30;//config.maxLevel || 40;
        let device = await Device.getById(uuid);

        console.log('[Controller]', uuid, 'received control request:', type);

        switch (type) {
            case 'init':
                await this.handleInitialize(req, res, uuid, device);
                break;
            case 'heartbeat':
                await this.handleHeartbeat(req, res, uuid);
                break;
            case 'get_job':
                await this.handleJob(req, res, uuid, device, minLevel, maxLevel);
                break;
            case 'get_account':
                await this.handleAccount(req, res, device, minLevel, maxLevel);
                break;
            case 'account_banned':
            case 'account_warning':
            case 'account_invalid_credentials':
                await this.handleAccountStatus(req, res, type, device);
                break;
            case 'logged_out':
                await this.handleLogout(req, res, uuid);
                break;
            case 'job_failed':
                sendResponse(res, 'ok', null);
                break;
            default:
                console.error('[Controller] Unhandled Request:', type);
                return res.sendStatus(404);
        }
    }

    async handleInitialize(req, res, uuid, device) {
        let ts = new Date().getTime() / 1000;
        let firstWarningTimestamp;
        if (device === undefined || device.accountUsername === undefined) {
            firstWarningTimestamp = null;
        } else {
            let account = await Account.getWithUsername(device.accountUsername, true);
            if (account instanceof Account) {
                firstWarningTimestamp = account.firstWarningTimestamp;
            } else {
                firstWarningTimestamp = null;
            }
        }
        if (device instanceof Device) {
            // Device is already registered
            console.log('[Controller] Device already registered');
            sendResponse(res, 'ok', {
                assigned: !device.instanceName,//device.instanceName !== undefined && device.instanceName !== null && device.instanceName !== '',
                first_warning_timestamp: firstWarningTimestamp || 0
            });
        } else {
            // Register new device
            console.log('[Controller] Registering device');
            let newDevice = new Device(uuid, config.instanceName, null, null, ts, 0.0, 0.0);
            await newDevice.create();
            sendResponse(res, 'ok', {
                assigned: false,
                first_warning_timestamp: firstWarningTimestamp
            });
        }
    }

    async handleHeartbeat(req, res, uuid) {
        let client = req.socket;
        let host = client 
            ? `${client.remoteAddress}:${client.remotePort}` 
            : '?';
        try {
            await Device.touch(uuid, host, false);
            sendResponse(res, 'ok', null);
        } catch (err) {
            res.send(err);
        }
    }

    async handleJob(req, res, uuid, device, minLevel, maxLevel) {
        if (device && device.accountUsername) {
            let account = await Account.getWithUsername(device.accountUsername, true);
            if (account instanceof Account) {
                //let task = TaskFactory.instance.getTask();
                let task = {
                    'area': 'Test',
                    'action': 'scan_iv',
                    'lat': 49.0,
                    'lon': 2.2,
                    //'id': pokemon.encounter_id,
                    //'is_spawnpoint': pokemon.spawnpoint_id !== undefined && pokemon.spawnpoint_id !== null,
                    'min_level': 1, //this.minLevel,
                    'max_level': 30 //this.maxLevel
                };
                if (task) {
                    console.log('[Controller] Sending job to check filtered IV at', task.lat, task.lon, 'for uuid', uuid);
                    sendResponse(res, 'ok', task);
                } else {
                    console.warn('[Controller] No tasks available yet for uuid', uuid);
                }
            } else {
                console.log('[Controller] Device', uuid, 'not logged into event account, logging out...');
                sendResponse(res, 'ok', {
                    'action': 'switch_account',
                    'min_level': minLevel,
                    'max_level': maxLevel
                });
            }
        } else {
            console.log('[Controller] Device', uuid, 'not assigned any account, switching accounts...');
            sendResponse(res, 'ok', {
                'action': 'switch_account',
                'min_level': minLevel,
                'max_level': maxLevel
            });
        }
    }

    async handleAccount(req, res, device, minLevel, maxLevel) {
        let account = await Account.getNewAccount(minLevel, maxLevel, true);
        console.log('[Controller] GetNewAccount:', account);
        if (device === undefined || device === null || 
            account === undefined || account === null) {
            if (device.accountUsername) {
                account = await Account.getWithUsername(device.accountUsername, true);
                console.log('[Controller] GetOldAccount:', account);
                if (account instanceof Account && 
                    account.level >= minLevel &&
                    account.level <= maxLevel &&
                    account.firstWarningTimestamp === undefined && 
                    account.failed                === undefined && 
                    account.failedTimestamp       === undefined) {
                    sendResponse(res, 'ok', {
                        username: oldAccount.username.trim(),
                        password: oldAccount.password.trim(),
                        first_warning_timestamp: oldAccount.firstWarningTimestamp,
                        level: oldAccount.level
                    });
                    return;
                }
            } else {
                console.error('[Controller] Failed to get event account, device or account is null.');
                return res.sendStatus(400);
            }
        }

        device.accountUsername = account.username;
        device.deviceLevel = account.level;
        await device.save(device.uuid);
        sendResponse(res, 'ok', {
            username: account.username.trim(),
            password: account.password.trim(),
            first_warning_timestamp: account.firstWarningTimestamp,
            level: account.level
        });
    }

    async handleAccountStatus(req, res, type, device) {
        let ts = new Date().getTime() / 1000;
        let account = await Account.getWithUsername(device.accountUsername, true);
        if (account instanceof Account) {
            switch (type) {
                case 'account_banned':
                    if (account.failedTimestamp === undefined || account.failedTimestamp === null || 
                        account.failed === undefined || account.failed === null) {
                            account.failedTimestamp = ts;
                            account.failed = 'banned';
                    }
                    break;
                case 'account_warning':
                    if (account.firstWarningTimestamp === undefined || account.firstWarningTimestamp === null) {
                        account.firstWarningTimestamp = ts;
                    }
                    break;
                case 'account_invalid_credentials':
                    if (account.failedTimestamp === undefined || account.failedTimestamp === null || 
                        account.failed === undefined || account.failed === null) {
                            account.failedTimestamp = ts;
                            account.failed = 'invalid_credentials';
                    }
                    break;
            }
            await account.save(true);
            sendResponse(res, 'ok', null);
        } else {
            if (device === undefined || device === null ||
                account === undefined || account === null) {
                console.error('[Controller] Failed to get account, device or account is null.');
                return res.sendStatus(400);
            }
        }
    }

    async handleLogout(req, res, uuid) {
        try {
            let device = await Device.getById(uuid);
            if (device instanceof Device) {
                if (device.accountUsername === null) {
                    return res.sendStatus(404);
                }
                device.accountUsername = null;
                await device.save(device.uuid);
                sendResponse(res, 'ok', null);
            } else {
                return res.sendStatus(404);
            }
        } catch {
            return res.sendStatus(500);
        }
    }


    /**
     * Handle incoming /raw data
     * @param {*} req 
     * @param {*} res 
     */
    async handleRawData(req, res) {
        let json = req.body;
        if (json === undefined || json === null) {
            console.error('[Raw] Bad data');
            return res.sendStatus(400);
        }
        if (json['payload']) {
            json['contents'] = [json];
        }
    
        let trainerLevel = parseInt(json['trainerlvl'] || json['trainerLevel']) || 0;
        let username = json['username'];
        if (username && trainerLevel > 0) {
            let oldLevel = levelCache[username];
            if (oldLevel !== trainerLevel) {
                await Account.setLevel(username, trainerLevel);
                levelCache[username] = trainerLevel;
            }
        }
        let contents = json['contents'] || json['protos'] || json['gmo'];
        if (contents === undefined || contents === null) {
            console.error('[Raw] Invalid GMO');
            return res.sendStatus(400);
        }
        let uuid = json['uuid'];
        let latTarget = json['lat_target'];
        let lonTarget = json['lon_target'];
        if (uuid && latTarget && lonTarget) {
            try {
                await Device.setLastLocation(uuid, latTarget, lonTarget);
            } catch (err) {
                console.error('[Raw] Error:', err);
            }
        }

        let wildPokemons = [];
        let nearbyPokemons = [];
        let clientWeathers = [];
        let forts = [];
        let fortDetails = [];
        let gymInfos = [];
        let quests = [];
        let encounters = [];
        let cells = [];
    
        let isEmptyGMO = true;
        let isInvalidGMO = true;
        let containsGMO = false;
        let isMadData = false;
    
        for (let i = 0; i < contents.length; i++) {
            const rawData = contents[i];
            let data = {};
            let method = 0;
            if (rawData['data']) {
                data = rawData['data'];
                method = parseInt(rawData['method']) || 106;
            } else if (rawData['payload']) {
                data = rawData['payload'];
                method = parseInt(rawData['type']) || 106;
                isMadData = true;
                username = 'PogoDroid';
            } else {
                console.error('[Raw] Unhandled proto:', rawData);
                return res.sendStatus(400);
            }
    
            switch (method) {
                case 2: // GetPlayerResponse
                    try {
                        let gpr = POGOProtos.Networking.Responses.GetPlayerResponse.decode(base64_decode(data));
                        if (gpr) {
                            // TODO: Parse GetPlayerResponse
                            if (gpr.success) {
                                let data = gpr.player_data;
                                console.debug('[Raw] GetPlayerData:', data);
                            }
                        } else {
                            console.error('[Raw] Malformed GetPlayerResponse');
                        }
                    } catch (err) {
                        console.error('[Raw] Unable to decode GetPlayerResponse');
                    }
                    break;
                case 4: // GetHoloInventoryResponse
                    // TODO: Parse GetHoloInventoryResponse
                    break;
                case 101: // FortSearchResponse
                    try {
                        let fsr = POGOProtos.Networking.Responses.FortSearchResponse.decode(base64_decode(data));
                        if (fsr) {
                            if (fsr.challenge_quest && fsr.challenge_quest.quest) {
                                let quest = fsr.challenge_quest.quest;
                                quests.push(quest);
                            }
                        } else {
                            console.error('[Raw] Malformed FortSearchResponse');
                        }
                    } catch (err) {
                        console.error('[Raw] Unable to decode FortSearchResponse');
                    }
                    break;
                case 102: // EncounterResponse
                    if (trainerLevel >= 30 || isMadData !== false) {
                        try {
                            let er = POGOProtos.Networking.Responses.EncounterResponse.decode(base64_decode(data));
                            if (er) {
                                encounters.push(er);
                            } else {
                                console.error('[Raw] Malformed EncounterResponse');
                            }
                        } catch (err) {
                            console.error('[Raw] Unable to decode EncounterResponse');
                        }
                    }
                    break;
                case 104: // FortDetailsResponse
                    try {
                        let fdr = POGOProtos.Networking.Responses.FortDetailsResponse.decode(base64_decode(data));
                        if (fdr) {
                            fortDetails.push(fdr);
                        } else {
                            console.error('[Raw] Malformed FortDetailsResponse');
                        }
                    } catch (err) {
                        console.error('[Raw] Unable to decode FortDetailsResponse');
                    }
                    break;
                case 106: // GetMapObjectsResponse
                    containsGMO = true;
                    try {
                        let gmo = POGOProtos.Networking.Responses.GetMapObjectsResponse.decode(base64_decode(data));
                        if (gmo) {
                            isInvalidGMO = false;
                            let mapCellsNew = gmo.map_cells;
                            if (mapCellsNew.length === 0) {
                                console.debug('[Raw] Map cells is empty');
                                return res.sendStatus(400);
                            }
                            mapCellsNew.forEach((mapCell) => {
                                let timestampMs = mapCell.current_timestamp_ms;
                                let wildNew = mapCell.wild_pokemons;
                                wildNew.forEach((wildPokemon) => {
                                    wildPokemons.push({
                                        cell: mapCell.s2_cell_id,
                                        data: wildPokemon,
                                        timestampMs: timestampMs
                                    });
                                });
                                let nearbyNew = mapCell.nearby_pokemons;
                                nearbyNew.forEach((nearbyPokemon) => {
                                    nearbyPokemons.push({
                                        cell: mapCell.s2_cell_id,
                                        data: nearbyPokemon
                                    });
                                });
                                let fortsNew = mapCell.forts;
                                fortsNew.forEach((fort) => {
                                    forts.push({
                                        cell: mapCell.s2_cell_id,
                                        data: fort
                                    });
                                });
                                cells.push(mapCell.s2_cell_id);
                            });
            
                            let weather = gmo.client_weather;
                            weather.forEach((wmapCell) => {
                                clientWeathers.push({
                                    cell: wmapCell.s2_cell_id,
                                    data: wmapCell
                                });
                            });
            
                            if (wildPokemons.length === 0 && nearbyPokemons.length === 0 && forts.length === 0) {
                                cells.forEach((cell) => {
                                    let count = emptyCells[cell];
                                    if (count === undefined) {
                                        emptyCells[cell] = 1;
                                    } else {
                                        emptyCells[cell] = count + 1;
                                    }
                                    if (count === 3) {
                                        console.debug('[Raw] Cell', cell, 'was empty 3 times in a row. Assuming empty.');
                                        cells.push(cell);
                                    }
                                });
                                
                                console.debug('[Raw] GMO is empty.');
                            } else {
                                cells.forEach(cell => emptyCells[cell] = 0);
                                isEmptyGMO = false;
                            }
                        } else {
                            console.error('[Raw] Malformed GetMapObjectsResponse');
                        }
                    } catch (err) {
                        console.error('[Raw] Unable to decode GetMapObjectsResponse');
                    }
                    break;
                case 156: // GymGetInfoResponse
                    try {
                        let ggi = POGOProtos.Networking.Responses.GymGetInfoResponse.decode(base64_decode(data));
                        if (ggi) {
                            gymInfos.push(ggi);
                        } else {
                            console.error('[Raw] Malformed GymGetInfoResponse');
                        }
                    } catch (err) {
                        console.error('[Raw] Unable to decode GymGetInfoResponse');
                    }
                    break;
                default:
                    console.error('[Raw] Invalid method provided:', method);
                    return;
            }
        }
    
        let total = wildPokemons.length + nearbyPokemons.length + clientWeathers.length + forts.length + fortDetails.length + gymInfos.length + quests.length + encounters.length + cells.length;
        let startTime = process.hrtime();
        if (cells.length > 0) {
            await this.updateCells(cells);
        }

        if (clientWeathers.length > 0) {
            await this.updateWeather(clientWeathers);
        }

        if (wildPokemons.length > 0 || nearbyPokemons.length > 0) {
            await this.updatePokemon(wildPokemons, nearbyPokemons);
        }

        if (forts.length > 0) {
            await this.updateForts(forts);
        }

        if (fortDetails.length > 0) {
            await this.updateFortDetails(fortDetails);
        }

        if (gymInfos.length > 0) {
            await this.updateGymInfos(gymInfos);
        }

        if (quests.length > 0) {
            await this.updateQuests(quests);
        }

        if (encounters.length > 0) {
            await this.updateEncounters(encounters, username);
        }

        let endTime = process.hrtime(startTime);
        let ms = (endTime[0] * 1000000000 + endTime[1]) / 1000000;
        if (total > 0) {
            console.log('[Raw] Update Count:', total, 'parsed in', ms, 'ms');
        }
        const responseData = {
            'nearby': nearbyPokemons.length,
            'wild': wildPokemons.count,
            'forts': forts.count,
            'quests': quests.count,
            'encounters': encounters.count,
            'level': trainerLevel,
            'only_empty_gmos': containsGMO && isEmptyGMO,
            'only_invalid_gmos': containsGMO && isInvalidGMO,
            'contains_gmos': containsGMO
        };
        sendResponse(res, 'ok', responseData);
    }

    // TODO: Get fort id
    async updatePokemon(wildPokemon, nearbyPokemon, username) {
        if (wildPokemon.length > 0) {
            let wildSQL = [];
            let ts = new Date().getTime() / 1000;
            for (let i = 0; i < wildPokemon.length; i++) {
                let wild = wildPokemon[i];
                try {
                    let pokemon = new Pokemon({
                        username: username,
                        cellId: wild.cell,
                        timestampMs: wild.timestamp_ms,
                        wild: wild.data
                    });
                    await this.updatePokemonValues(pokemon);
        
                    if (pokemon.lat === undefined && pokemon.pokestopId) {
                        if (pokemon.pokestopId) {
                            let pokestop;
                            try {
                                pokestop = await Pokestop.getById(pokemon.pokestopId);
                            } catch (err) {
                                console.error('[Pokemon] Error:', err);
                            }
                            if (pokestop) {
                                pokemon.lat = pokestop.lat;
                                pokemon.lon = pokestop.lon;
                            } else {
                                return;
                            }
                        } else {
                            return;
                        }
                    }
                    pokemon.changed = ts;
                    if (!pokemon.firstSeenTimestamp) {
                        pokemon.firstSeenTimestamp = new Date().getTime() / 1000;
                    }
                    wildSQL.push(`
                    (
                        ${pokemon.id},
                        ${pokemon.pokemonId},
                        ${pokemon.lat},
                        ${pokemon.lon},
                        ${pokemon.spawnId || null},
                        ${pokemon.expireTimestamp || null},
                        ${pokemon.atkIv || null},
                        ${pokemon.defIv || null},
                        ${pokemon.staIv || null},
                        ${pokemon.move1 || null},
                        ${pokemon.move2 || null},
                        ${pokemon.gender},
                        ${pokemon.form},
                        ${pokemon.cp || null},
                        ${pokemon.level || null},
                        ${pokemon.weather || 0},
                        ${pokemon.costume || 0},
                        ${pokemon.weight || null},
                        ${pokemon.size || null},
                        ${pokemon.displayPokemonId || null},
                        ${pokemon.pokestopId ? '\'' + pokemon.pokestopId + '\'' : null},
                        ${pokemon.updated || null},
                        ${pokemon.firstSeenTimestamp || null},
                        ${pokemon.changed || null},
                        ${pokemon.cellId || null},
                        ${pokemon.expireTimestampVerified || 0},
                        ${pokemon.shiny || null},
                        ${pokemon.username ? '\'' + pokemon.username + '\'' : null},
                        ${pokemon.capture1 || null},
                        ${pokemon.capture2 || null},
                        ${pokemon.capture3 || null}
                    )
                    `);
                } catch (err) {
                    console.error('[Wild] Error:', err);
                }
            }
            if (wildSQL.length > 0) {
                let sqlUpdate = `
                INSERT INTO pokemon (
                    id, pokemon_id, lat, lon, spawn_id, expire_timestamp, atk_iv, def_iv, sta_iv,
                    move_1, move_2, gender, form, cp, level, weather, costume, weight, size,
                    display_pokemon_id, pokestop_id, updated, first_seen_timestamp, changed, cell_id,
                    expire_timestamp_verified, shiny, username, capture_1, capture_2, capture_3
                ) VALUES
                `;
                sqlUpdate += wildSQL.join(',');
                //console.log('sql:', sqlUpdate);
                sqlUpdate += ` 
                ON DUPLICATE KEY UPDATE
                pokemon_id=VALUES(pokemon_id),
                lat=VALUES(lat),
                lon=VALUES(lon),
                spawn_id=VALUES(spawn_id),
                expire_timestamp=VALUES(expire_timestamp),
                atk_iv=VALUES(atk_iv),
                def_iv=VALUES(def_iv),
                sta_iv=VALUES(sta_iv),
                move_1=VALUES(move_1),
                move_2=VALUES(move_2),
                gender=VALUES(gender),
                form=VALUES(form),
                cp=VALUES(cp),
                level=VALUES(level),
                weather=VALUES(weather),
                costume=VALUES(costume),
                weight=VALUES(weight),
                size=VALUES(size),
                display_pokemon_id=VALUES(display_pokemon_id),
                pokestop_id=VALUES(pokestop_id),
                updated=VALUES(updated),
                first_seen_timestamp=VALUES(first_seen_timestamp),
                changed=VALUES(changed),
                cell_id=VALUES(cell_id),
                expire_timestamp_verified=VALUES(expire_timestamp_verified),
                shiny=VALUES(shiny),
                username=VALUES(username),
                capture_1=VALUES(capture_1),
                capture_2=VALUES(capture_2),
                capture_3=VALUES(capture_3)
                `;
                let result = await db.query(sqlUpdate);
                //console.log('Result:', result);
            }
        }
        if (nearbyPokemon.length > 0) {
            let nearbySQL = [];
            let ts = new Date().getTime() / 1000;
            for (let i = 0; i < nearbyPokemon.length; i++) {
                let nearby = nearbyPokemon[i];
                try {
                    let pokemon = new Pokemon({
                        username: username,
                        cellId: nearby.cell,
                        //timestampMs: nearbyPokemon.timestamp_ms,
                        nearby: nearby.data
                    });
                    await this.updatePokemonValues(pokemon);
        
                    if ((pokemon.lat === undefined || pokemon.lat === null) && pokemon.pokestopId) {
                        if (pokemon.pokestopId) {
                            let pokestop;
                            try {
                                pokestop = await Pokestop.getById(pokemon.pokestopId);
                            } catch (err) {
                                console.error('[Pokemon] Error:', err);
                            }
                            if (pokestop) {
                                pokemon.lat = pokestop.lat;
                                pokemon.lon = pokestop.lon;
                            } else {
                                continue;
                            }
                        } else {
                            continue;
                        }
                    }
                    if (pokemon.lat === undefined || pokemon.lat === null) {
                        continue;
                    }
                    pokemon.changed = ts;
                    if (!pokemon.firstSeenTimestamp) {
                        pokemon.firstSeenTimestamp = new Date().getTime() / 1000;
                    }
                    nearbySQL.push(`
                    (
                        ${pokemon.id},
                        ${pokemon.pokemonId},
                        ${pokemon.lat || null},
                        ${pokemon.lon || null},
                        ${pokemon.spawnId || null},
                        ${pokemon.expireTimestamp || null},
                        ${pokemon.atkIv || null},
                        ${pokemon.defIv || null},
                        ${pokemon.staIv || null},
                        ${pokemon.move1 || null},
                        ${pokemon.move2 || null},
                        ${pokemon.gender},
                        ${pokemon.form},
                        ${pokemon.cp || null},
                        ${pokemon.level || null},
                        ${pokemon.weather || 0},
                        ${pokemon.costume || 0},
                        ${pokemon.weight || null},
                        ${pokemon.size || null},
                        ${pokemon.displayPokemonId || null},
                        ${pokemon.pokestopId ? '\'' + pokemon.pokestopId + '\'' : null},
                        ${pokemon.updated || null},
                        ${pokemon.firstSeenTimestamp || null},
                        ${pokemon.changed || null},
                        ${pokemon.cellId || null},
                        ${pokemon.expireTimestampVerified || 0},
                        ${pokemon.shiny || null},
                        ${pokemon.username ? '\'' + pokemon.username + '\'' : null},
                        ${pokemon.capture1 || null},
                        ${pokemon.capture2 || null},
                        ${pokemon.capture3 || null}
                    )
                    `);
                } catch (err) {
                    console.error('[Nearby] Error:', err);
                }
            }
            if (nearbySQL.length > 0) {
                let sqlUpdate = `
                INSERT INTO pokemon (
                    id, pokemon_id, lat, lon, spawn_id, expire_timestamp, atk_iv, def_iv, sta_iv,
                    move_1, move_2, gender, form, cp, level, weather, costume, weight, size,
                    display_pokemon_id, pokestop_id, updated, first_seen_timestamp, changed, cell_id,
                    expire_timestamp_verified, shiny, username, capture_1, capture_2, capture_3
                ) VALUES
                `;
                sqlUpdate += nearbySQL.join(',');
                //console.log('sql:', sqlUpdate);
                sqlUpdate += ` 
                ON DUPLICATE KEY UPDATE
                pokemon_id=VALUES(pokemon_id),
                lat=VALUES(lat),
                lon=VALUES(lon),
                spawn_id=VALUES(spawn_id),
                expire_timestamp=VALUES(expire_timestamp),
                atk_iv=VALUES(atk_iv),
                def_iv=VALUES(def_iv),
                sta_iv=VALUES(sta_iv),
                move_1=VALUES(move_1),
                move_2=VALUES(move_2),
                gender=VALUES(gender),
                form=VALUES(form),
                cp=VALUES(cp),
                level=VALUES(level),
                weather=VALUES(weather),
                costume=VALUES(costume),
                weight=VALUES(weight),
                size=VALUES(size),
                display_pokemon_id=VALUES(display_pokemon_id),
                pokestop_id=VALUES(pokestop_id),
                updated=VALUES(updated),
                first_seen_timestamp=VALUES(first_seen_timestamp),
                changed=VALUES(changed),
                cell_id=VALUES(cell_id),
                expire_timestamp_verified=VALUES(expire_timestamp_verified),
                shiny=VALUES(shiny),
                username=VALUES(username),
                capture_1=VALUES(capture_1),
                capture_2=VALUES(capture_2),
                capture_3=VALUES(capture_3)
                `;
                let result = await db.query(sqlUpdate);
                //console.log('Result:', result);
            }
        }
    }

    async updatePokemonValues(pokemon) {
        let updateIV = false;
        let now = new Date().getTime() / 1000;
        pokemon.updated = now;
        let oldPokemon;
        try {
            oldPokemon = await Pokemon.getById(pokemon.id);
        } catch (err) {
            oldPokemon = null;
        }
        if (oldPokemon === undefined || oldPokemon === null) {
            if (pokemon.expireTimestamp === undefined || pokemon.expireTimestamp === null) {
                pokemon.expireTimestamp = now + Pokemon.PokemonTimeUnseen;
            }
            pokemon.firstSeenTimestamp = pokemon.updated;
        } else {
            pokemon.firstSeenTimestamp = oldPokemon.firstSeenTimestamp;
            if (pokemon.expireTimestamp === undefined || pokemon.expireTimestamp === null) {
                let oldExpireDate = oldPokemon.expireTimestamp;
                if ((oldExpireDate - now) < Pokemon.PokemonTimeReseen) {
                    pokemon.expireTimestamp = now + Pokemon.PokemonTimeReseen;
                } else {
                    pokemon.expireTimestamp = oldPokemon.expireTimestamp;
                }
            }
            if (pokemon.expireTimestampVerified === false && oldPokemon.expireTimestampVerified) {
                pokemon.expireTimestampVerified = oldPokemon.expireTimestampVerified;
                pokemon.expireTimestamp = oldPokemon.expireTimestamp;
            }
            if (oldPokemon.pokemonId !== pokemon.pokemonId) {
                if (oldPokemon.pokemonId !== Pokemon.DittoPokemonId) {
                    console.log('[POKEMON] Pokemon', pokemon.id, 'changed from', oldPokemon.pokemonId, 'to', pokemon.pokemonId);
                } else if (oldPokemon.displayPokemonId || 0 !== pokemon.pokemonId) {
                    console.log('[POKEMON] Pokemon', pokemon.id, 'Ditto diguised as', (oldPokemon.displayPokemonId || 0), 'now seen as', pokemon.pokemonId);
                }
            }
            if (oldPokemon.cellId && (pokemon.cellId === undefined || pokemon.cellId === null)) {
                pokemon.cellId = oldPokemon.cellId;
            }
            if (oldPokemon.spawnId && (pokemon.spawnId === undefined || pokemon.spawnId == null)) {
                pokemon.spawnId = oldPokemon.spawnId;
                pokemon.lat = oldPokemon.lat;
                pokemon.lon = oldPokemon.lon;
            }
            if (oldPokemon.pokestopId && (pokemon.pokestopId === undefined || pokemon.pokestopId == null)) {
                pokemon.pokestopId = oldPokemon.pokestopId;
            }

            if (updateIV && (oldPokemon.atkIv === undefined || oldPokemon.atkIv === null) && pokemon.atkIv) {
                //WebhookController.instance.addPokemonEvent(this);
                //InstanceController.instance.gotIV(this);
                pokemon.changed = now;
            } else {
                pokemon.changed = oldPokemon.changed || now;
            }

            if (updateIV && oldPokemon.atkIv && (pokemon.atkIv === undefined || pokemon.atkIv === null)) {
                if (
                    !(((oldPokemon.weather === undefined || oldPokemon.weather === null) || oldPokemon.weather === 0) && (pokemon.weather || 0 > 0) ||
                        ((pokemon.weather === undefined || pokemon.weather === null) || pokemon.weather === 0) && (oldPokemon.weather || 0 > 0))
                ) {
                    pokemon.atkIv = oldPokemon.atkIv;
                    pokemon.defIv = oldPokemon.defIv;
                    pokemon.staIv = oldPokemon.staIv;
                    pokemon.cp = oldPokemon.cp;
                    pokemon.weight = oldPokemon.weight;
                    pokemon.size = oldPokemon.size;
                    pokemon.move1 = oldPokemon.move1;
                    pokemon.move2 = oldPokemon.move2;
                    pokemon.level = oldPokemon.level;
                    pokemon.shiny = oldPokemon.shiny;
                    pokemon.isDitto = Pokemon.isDittoDisguisedFromPokemon(oldPokemon);
                    if (pokemon.isDitto) {
                        console.log('[POKEMON] oldPokemon', pokemon.id, 'Ditto found, disguised as', pokemon.pokemonId);
                        pokemon.setDittoAttributes(pokemon.pokemonId);
                    }
                }
            }

            //let shouldWrite = Pokemon.shouldUpdate(oldPokemon, pokemon);
            //if (!shouldWrite) {
            //    return;
            //}

            if (oldPokemon.pokemonId === Pokemon.DittoPokemonId && pokemon.pokemonId !== Pokemon.DittoPokemonId) {
                console.log('[POKEMON] Pokemon', pokemon.id, 'Ditto changed from', oldPokemon.pokemonId, 'to', pokemon.pokemonId);
            }
        }

        if (pokemon.spawnId) {
            let spawnpoint;
            if (pokemon.expireTimestampVerified && pokemon.expireTimestamp) {
                let date = moment(pokemon.expireTimestamp).format('mm:ss');
                let split = date.split(':');
                let minute = parseInt(split[0]);
                let second = parseInt(split[1]);
                let secondOfHour = second + minute * 60;
                spawnpoint = new Spawnpoint(
                    pokemon.spawnId,
                    pokemon.lat,
                    pokemon.lon,
                    secondOfHour,
                    pokemon.updated
                );
            } else {
                spawnpoint = new Spawnpoint(
                    pokemon.spawnId,
                    pokemon.lat,
                    pokemon.lon,
                    null,
                    pokemon.updated
                );
            }
            try {
                await spawnpoint.save(true);
            } catch (err) {
                console.error('[Spawnpoint] Error:', err);
            }
        }
    }

    async updateForts(forts) {
        if (forts.length > 0) {
            let gymsSQL = [];
            let pokestopsSQL = [];
            for (let i = 0; i < forts.length; i++) {
                let fort = forts[i];
                try {
                    switch (fort.data.type) {
                        case 0: // gym
                            let gym = new Gym({
                                cellId: fort.cell,
                                fort: fort.data
                            });
                            gymsSQL.push(`
                            (
                                '${gym.id}',
                                ${gym.lat},
                                ${gym.lon},
                                ${gym.name ? '\'' + gym.name + '\'' : null},
                                ${gym.url ? '\'' + gym.url + '\'' : null},
                                ${gym.lastModifiedTimestamp},
                                ${gym.raidEndTimestamp},
                                ${gym.raidSpawnTimestamp},
                                ${gym.raidBattleTimestamp},
                                ${gym.updated},
                                ${gym.raidPokemonId},
                                ${gym.guardingPokemonId},
                                ${gym.availableSlots},
                                ${gym.teamId},
                                ${gym.raidLevel},
                                ${gym.enabled},
                                ${gym.exRaidEligible},
                                ${gym.inBattle},
                                ${gym.raidPokemonMove1},
                                ${gym.raidPokemonMove2},
                                ${gym.raidPokemonForm},
                                ${gym.raidPokemonCp},
                                ${gym.raidIsExclusive},
                                ${gym.cellId},
                                ${gym.deleted},
                                ${gym.totalCp},
                                ${gym.firstSeenTimestamp},
                                ${gym.raidPokemonGender},
                                ${gym.sponsorId}
                            )
                            `);
                            //if (this.gymIdsPerCell[fort.cell] === undefined) {
                            //    this.gymIdsPerCell[fort.cell] = [];
                            //}
                            //this.gymIdsPerCell[fort.cell.toString()].push(fort.data.id.toString());
                            break;
                        case 1: // checkpoint
                            let pokestop = new Pokestop({
                                cellId: fort.cell,
                                fort: fort.data
                            });
                            pokestopsSQL.push(`
                            (
                                '${pokestop.id}',
                                ${pokestop.lat},
                                ${pokestop.lon},
                                ${pokestop.name ? '\'' + pokestop.name + '\'' : null},
                                ${pokestop.url ? '\'' + pokestop.url + '\'' : null},
                                ${pokestop.lureExpireTimestamp},
                                ${pokestop.lastModifiedTimestamp},
                                ${pokestop.updated},
                                ${pokestop.enabled},
                                ${pokestop.questType},
                                ${pokestop.questTimestamp},
                                ${pokestop.questTarget},
                                ${pokestop.questConditions},
                                ${pokestop.questRewards},
                                ${pokestop.questTemplate},
                                ${pokestop.cellId},
                                ${pokestop.deleted},
                                ${pokestop.lureId},
                                ${pokestop.pokestopDisplay},
                                ${pokestop.incidentExpireTimestamp},
                                ${pokestop.firstSeenTimestamp},
                                ${pokestop.gruntType},
                                ${pokestop.sponsorId}
                            )`);
                            //if (this.stopsIdsPerCell[fort.cell] === undefined) {
                            //    this.stopsIdsPerCell[fort.cell] = [];
                            //}
                            //this.stopsIdsPerCell[fort.cell.toString()].push(fort.data.id.toString());
                            break;
                    }
                } catch (err) {
                    console.error('[Forts] Error:', err);
                }
            }
            if (gymsSQL.length > 0) {
                let sqlUpdate = `
                INSERT INTO gym (
                    id, lat, lon, name, url, last_modified_timestamp, raid_end_timestamp, raid_spawn_timestamp, raid_battle_timestamp, 
                    updated, raid_pokemon_id, guarding_pokemon_id, availble_slots, team_id, raid_level, enabled, ex_raid_eligible, 
                    in_battle, raid_pokemon_move_1, raid_pokemon_move_2, raid_pokemon_form, raid_pokemon_cp, raid_is_exclusive, 
                    cell_id, deleted, total_cp, first_seen_timestamp, raid_pokemon_gender, sponsor_id) VALUES
                `;
                sqlUpdate += gymsSQL.join(',');
                //console.log('sql:', sqlUpdate);
                sqlUpdate += ` 
                ON DUPLICATE KEY UPDATE
                lat=VALUES(lat),
                lon=VALUES(lon),
                name=VALUES(name),
                url=VALUES(url),
                last_modified_timestamp=VALUES(last_modified_timestamp),
                raid_end_timestamp=VALUES(raid_end_timestamp),
                raid_spawn_timestamp=VALUES(raid_spawn_timestamp),
                raid_battle_timestamp=VALUES(raid_battle_timestamp),
                updated=VALUES(updated),
                raid_pokemon_id=VALUES(raid_pokemon_id),
                guarding_pokemon_id=VALUES(guarding_pokemon_id),
                availble_slots=VALUES(availble_slots),
                team_id=VALUES(team_id),
                raid_level=VALUES(raid_level),
                enabled=VALUES(enabled),
                ex_raid_eligible=VALUES(ex_raid_eligible),
                in_battle=VALUES(in_battle),
                raid_pokemon_move_1=VALUES(raid_pokemon_move_1),
                raid_pokemon_move_2=VALUES(raid_pokemon_move_2),
                raid_pokemon_form=VALUES(raid_pokemon_form),
                raid_pokemon_cp=VALUES(raid_pokemon_cp),
                raid_is_exclusive=VALUES(raid_is_exclusive),
                cell_id=VALUES(cell_id),
                deleted=VALUES(deleted),
                total_cp=VALUES(total_cp),
                first_seen_timestamp=VALUES(first_seen_timestamp),
                raid_pokemon_gender=VALUES(raid_pokemon_gender),
                sponsor_id=VALUES(sponsor_id)
                `;
                let result = await db.query(sqlUpdate);
                //console.log('Result:', result);
            }
            if (pokestopsSQL.length > 0) {
                let sqlUpdate = `INSERT INTO pokestop (
                    id, lat, lon, name, url, lure_expire_timestamp, last_modified_timestamp, updated, enabled, quest_type,
                    quest_timestamp, quest_target, quest_conditions, quest_rewards, quest_template,  cell_id, deleted, lure_id, pokestop_display, incident_expire_timestamp,
                    first_seen_timestamp, grunt_type, sponsor_id) VALUES
                `;
                sqlUpdate += pokestopsSQL.join(',');
                //console.log('sql:', sqlUpdate);
                sqlUpdate += ` 
                ON DUPLICATE KEY UPDATE
                lat=VALUES(lat),
                lon=VALUES(lon),
                name=VALUES(name),
                url=VALUES(url),
                lure_expire_timestamp=VALUES(lure_expire_timestamp),
                last_modified_timestamp=VALUES(last_modified_timestamp),
                updated=VALUES(updated),
                enabled=VALUES(enabled),
                quest_type=VALUES(quest_type),
                quest_timestamp=VALUES(quest_timestamp),
                quest_target=VALUES(quest_target),
                quest_conditions=VALUES(quest_conditions),
                quest_rewards=VALUES(quest_rewards),
                quest_template=VALUES(quest_template),
                cell_id=VALUES(cell_id),
                deleted=VALUES(deleted),
                lure_id=VALUES(lure_id),
                pokestop_display=VALUES(pokestop_display),
                incident_expire_timestamp=VALUES(incident_expire_timestamp),
                first_seen_timestamp=VALUES(first_seen_timestamp),
                grunt_type=VALUES(grunt_type),
                sponsor_id=VALUES(sponsor_id)
                `;
                let result = await db.query(sqlUpdate);
                //console.log('Result:', result);
            }
        }
    }

    async updateFortDetails(fortDetails) {
        // Update Pokestop
        if (fortDetails.length > 0) {
            let ts = new Date().getTime() / 1000;
            let fortDetailsSQL = [];
            for (let i = 0; i < fortDetails.length; i++) {
                let details = fortDetails[i];
                try {
                    let name = '';
                    let url = '';
                    if (details.image_urls.length > 0) {
                        url = details.image_urls[0];
                    }
                    if (details.name) {
                        name = details.name
                    }
                    let id = details.fort_id;
                    let lat = details.latitude;
                    let lon = details.longitude;
                    fortDetailsSQL.push(`('${id}', ${lat}, ${lon}, '${name}', '${url}', ${ts}, ${ts})`);
                } catch (err) {
                    console.error('[FortDetails] Error:', err);
                }
            }
            let sqlUpdate = 'INSERT INTO gym (id, lat, lon, name, url, updated, first_seen_timestamp) VALUES';
            sqlUpdate += fortDetailsSQL.join(',');
            sqlUpdate += ` 
            ON DUPLICATE KEY UPDATE
            lat=VALUES(lat),
            lon=VALUES(lon),
            name=VALUES(name),
            url=VALUES(url),
            updated=VALUES(updated),
            first_seen_timestamp=VALUES(first_seen_timestamp)
            `;
            let result = await db.query(sqlUpdate);
            //console.log('Result:', result);
        }
    }

    async updateGymInfos(gymInfos) {
        if (gymInfos.length > 0) {
            let gymInfosSQL = [];
            for (let i = 0; i < gymInfos.length; i++) {
                let info = gymInfos[i];
                try {
                    let name = '';
                    let url = '';
                    if (info.name) {
                        name = info.name;
                    }
                    if (info.name) {
                        url = info.url
                    }            
                    gymInfosSQL.push(`('${name}', '${url}')`);
                } catch (err) {
                    console.error('[GymInfos] Error:', err);
                }
            }
            let sqlUpdate = 'INSERT INTO gym (name, url) VALUES';
            sqlUpdate += gymInfosSQL.join(',');
            sqlUpdate += ` 
            ON DUPLICATE KEY UPDATE
            name=VALUES(name),
            url=VALUES(url)
            `;
            // TODO: Get gym id
            //let result = await db.query(sqlUpdate);
            //console.log('Result:', result);
        }
    }

    async updateCells(cells) {
        if (cells.length > 0) {
            let cellsSQL = [];
            let ts = new Date().getTime() / 1000;
            for (let i = 0; i < cells.length; i++) {
                let cellId = BigInt(cells[i]).toString();
                try {
                    let s2cell = new S2.S2Cell(new S2.S2CellId(cellId));
                    let center = s2cell.getRectBound().getCenter();
                    let lat = center.latDegrees;
                    let lon = center.lngDegrees;
                    //s2cell.capBound.rectBound.center.lng.degrees
                    let level = s2cell.level;
                    cellsSQL.push(`(${cellId}, ${level}, ${lat}, ${lon}, ${ts})`);
                } catch (err) {
                    console.error('[Cell] Error:', err);
                }
               
                //if (this.gymIdsPerCell[cellId] === undefined) {
                //    this.gymIdsPerCell[cellId] = [];
                //}
                //if (this.stopsIdsPerCell[cellId] === undefined) {
                //    this.stopsIdsPerCell[cellId] = [];
                //} 
            }
            let sqlUpdate = 'INSERT INTO s2cell (id, level, center_lat, center_lon, updated) VALUES';
            sqlUpdate += cellsSQL.join(',');
            sqlUpdate += ` 
            ON DUPLICATE KEY UPDATE
            level=VALUES(level),
            center_lat=VALUES(center_lat),
            center_lon=VALUES(center_lon),
            updated=VALUES(updated)
            `;
            let result = await db.query(sqlUpdate);
            //console.log('Result:', result);
        }
    }

    async updateWeather(weather) {
        if (weather.length > 0) {
            let weatherSQL = [];
            let ts = new Date().getTime() / 1000;
            for (let i = 0; i < weather.length; i++) {
                let conditions = weather[i];
                try {
                    let cellId = conditions.cell.toString();
                    let s2cell = new S2.S2Cell(new S2.S2CellId(cellId));
                    let center = s2cell.getRectBound().getCenter();
                    let lat = center.latDegrees;
                    let lon = center.lngDegrees;
                    let level = s2cell.level;
                    let gameplayCondition = conditions.data.gameplay_weather.gameplay_condition || 0;
                    let windDirection = conditions.data.display_weather.wind_direction || 0;
                    let cloudLevel = conditions.data.display_weather.cloud_level || 0;
                    let rainLevel = conditions.data.display_weather.rain_level || 0;
                    let windLevel = conditions.data.display_weather.wind_level || 0;
                    let snowLevel = conditions.data.display_weather.snow_level || 0;
                    let fogLevel = conditions.data.display_weather.fog_level || 0;
                    let seLevel = conditions.data.display_weather.special_effect_level || 0;
                    let severity = 0;
                    let warnWeather = 0;
                    for (let i = 0; i < conditions.data.alerts.length; i++) {
                        let severityCondition = conditions.data.alerts[i];
                        severity = severityCondition.severity;
                        warnWeather = severityCondition.warn_weather;
                    }
                    weatherSQL.push(`(${cellId}, ${level}, ${lat}, ${lon}, ${gameplayCondition}, ${windDirection}, ${cloudLevel}, ${rainLevel}, ${windLevel}, ${snowLevel}, ${fogLevel}, ${seLevel}, ${severity}, ${warnWeather}, ${ts})`);
                } catch (err) {
                    console.error('[Weather] Error:', err);
                }
            }
            let sqlUpdate = 'INSERT INTO weather (id, level, latitude, longitude, gameplay_condition, wind_direction, cloud_level, rain_level, wind_level, snow_level, fog_level, special_effect_level, severity, warn_weather, updated) VALUES ';
            sqlUpdate += weatherSQL.join(',');
            sqlUpdate += `
            ON DUPLICATE KEY UPDATE
            level=VALUES(level),
            latitude=VALUES(latitude),
            longitude=VALUES(longitude),
            gameplay_condition=VALUES(gameplay_condition),
            wind_direction=VALUES(wind_direction),
            cloud_level=VALUES(cloud_level),
            rain_level=VALUES(rain_level),
            wind_level=VALUES(wind_level),
            snow_level=VALUES(snow_level),
            fog_level=VALUES(fog_level),
            special_effect_level=VALUES(special_effect_level),
            severity=VALUES(severity),
            warn_weather=VALUES(warn_weather),
            updated=VALUES(updated)
            `;
            let result = await db.query(sqlUpdate);
            //console.log('Result:', result);
        }
    }

    async updateEncounters(encounters, username) {
        if (encounters.length > 0) {
            let encountersSQL = [];
            let ts = new Date().getTime() / 1000;
            for (let i = 0; i < encounters.length; i++) {
                let encounter = encounters[i];
                try {
                    let pokemon;
                    try {
                        pokemon = await Pokemon.getById(encounter.wild_pokemon.encounter_id);
                    } catch (err) {
                        pokemon = null;
                    }
                    if (pokemon) {
                        await pokemon.addEncounter(encounter, username);
                    } else {
                        let centerCoord = new S2.S2Point(encounter.wild_pokemon.latitude, encounter.wild_pokemon.longitude, 0);
                        let center = S2.S2LatLng.fromPoint(centerCoord);
                        let centerNormalized = center.normalized();
                        let centerNormalizedPoint = centerNormalized.toPoint();
                        let circle = new S2.S2Cap(centerNormalizedPoint, 0.0);
                        let coverer = new S2.S2RegionCoverer();
                        coverer.setMaxCells(1);
                        coverer.setMinLevel(15);
                        coverer.setMaxLevel(15);
                        let cellIds = coverer.getCoveringCells(circle);
                        let cellId = cellIds.pop();
                        //if (cellId) {
                            pokemon = new Pokemon({
                                wild: encounter.wild_pokemon,
                                username: username,
                                cellId: cellId,
                                timestampMs: encounter.wild_pokemon.last_modified_timestamp_ms //last_modified_timestamp_ms / timestamp_ms
                            });
                            await pokemon.addEncounter(encounter, username);
                        //}
                    }
                    if (!pokemon.spawnId) {
                        this.spawnId = parseInt(encounter.wild_pokemon.spawn_point_id, 16);
                        let spawnpoint = new Spawnpoint(this.spawnId, this.lat, this.lon, null, ts);
                        await spawnpoint.save(false);
                        //console.log('spawnpoint id is null:', pokemon);
                    }

                    encountersSQL.push(`
                    (
                        ${String(pokemon.id)},
                        ${pokemon.pokemonId},
                        ${pokemon.lat || null},
                        ${pokemon.lon || null},
                        ${pokemon.spawnId || null},
                        ${pokemon.expireTimestamp || null},
                        ${pokemon.atkIv || null},
                        ${pokemon.defIv || null},
                        ${pokemon.staIv || null},
                        ${pokemon.move1 || null},
                        ${pokemon.move2 || null},
                        ${pokemon.gender},
                        ${pokemon.form},
                        ${pokemon.cp || null},
                        ${pokemon.level || null},
                        ${pokemon.weather || 0},
                        ${pokemon.costume || 0},
                        ${pokemon.weight || null},
                        ${pokemon.size || null},
                        ${pokemon.displayPokemonId || null},
                        ${pokemon.pokestopId ? '\'' + pokemon.pokestopId + '\'' : null},
                        ${pokemon.updated || null},
                        ${pokemon.firstSeenTimestamp || null},
                        ${pokemon.changed || null},
                        ${pokemon.cellId || null},
                        ${pokemon.expireTimestampVerified || 0},
                        ${pokemon.shiny || null},
                        ${pokemon.username ? '\'' + pokemon.username + '\'' : null},
                        ${pokemon.capture1 || null},
                        ${pokemon.capture2 || null},
                        ${pokemon.capture3 || null}
                    )
                    `);
                } catch (err) {
                    console.error('[Encounter] Error:', err);
                }
            }
            let sqlUpdate = `
            INSERT INTO pokemon (
                id, pokemon_id, lat, lon, spawn_id, expire_timestamp, atk_iv, def_iv, sta_iv,
                move_1, move_2, gender, form, cp, level, weather, costume, weight, size,
                display_pokemon_id, pokestop_id, updated, first_seen_timestamp, changed, cell_id,
                expire_timestamp_verified, shiny, username, capture_1, capture_2, capture_3
            ) VALUES
            `;
            sqlUpdate += encountersSQL.join(',');
            //console.log('sql:', encountersSQL);
            sqlUpdate += ` 
            ON DUPLICATE KEY UPDATE
            pokemon_id=VALUES(pokemon_id),
            lat=VALUES(lat),
            lon=VALUES(lon),
            spawn_id=VALUES(spawn_id),
            expire_timestamp=VALUES(expire_timestamp),
            atk_iv=VALUES(atk_iv),
            def_iv=VALUES(def_iv),
            sta_iv=VALUES(sta_iv),
            move_1=VALUES(move_1),
            move_2=VALUES(move_2),
            gender=VALUES(gender),
            form=VALUES(form),
            cp=VALUES(cp),
            level=VALUES(level),
            weather=VALUES(weather),
            costume=VALUES(costume),
            weight=VALUES(weight),
            size=VALUES(size),
            display_pokemon_id=VALUES(display_pokemon_id),
            pokestop_id=VALUES(pokestop_id),
            updated=VALUES(updated),
            first_seen_timestamp=VALUES(first_seen_timestamp),
            changed=VALUES(changed),
            cell_id=VALUES(cell_id),
            expire_timestamp_verified=VALUES(expire_timestamp_verified),
            shiny=VALUES(shiny),
            username=VALUES(username),
            capture_1=VALUES(capture_1),
            capture_2=VALUES(capture_2),
            capture_3=VALUES(capture_3)
            `;
            try {
                let result = await db.query(sqlUpdate);
                //console.log('Result:', result);
            } catch (err) {
                console.error('encounter error:', err.message);
            }
        }
    }

    async updateQuests(quests) {
        if (quests.length > 0) {
            let questsSQL = [];
            let ts = new Date().getTime() / 1000;
            for (let i = 0; i < quests.length; i++) {
                let quest = quests[i];
                try {
                    let pokestop;
                    try {
                        pokestop = Pokestop.getWithId(quest.fort_id);
                    } catch {
                        pokestop = null;
                    }
                    if (pokestop instanceof Pokestop) {
                        pokestop.addQuest(quest);
                    }
                    questsSQL.push(`
                    (
                        '${pokestop.id}',
                        ${pokestop.lat},
                        ${pokestop.lon},
                        ${pokestop.name ? '\'' + pokestop.name + '\'' : null},
                        ${pokestop.url ? '\'' + pokestop.url + '\'' : null},
                        ${pokestop.lureExpireTimestamp},
                        ${pokestop.lastModifiedTimestamp},
                        ${pokestop.updated},
                        ${pokestop.enabled},
                        ${pokestop.questType},
                        ${pokestop.questTimestamp},
                        ${pokestop.questTarget},
                        ${pokestop.questConditions},
                        ${pokestop.questRewards},
                        ${pokestop.questTemplate},
                        ${pokestop.cellId},
                        ${pokestop.deleted},
                        ${pokestop.lureId},
                        ${pokestop.pokestopDisplay},
                        ${pokestop.incidentExpireTimestamp},
                        ${pokestop.firstSeenTimestamp},
                        ${pokestop.gruntType},
                        ${pokestop.sponsorId}
                    )`);
                } catch (err) {
                    console.error('[Quests] Error:', err);
                }
            }
            let sqlUpdate = `INSERT INTO pokestop (
                id, lat, lon, name, url, lure_expire_timestamp, last_modified_timestamp, updated, enabled, quest_type,
                quest_timestamp, quest_target, quest_conditions, quest_rewards, quest_template,  cell_id, deleted, lure_id, pokestop_display, incident_expire_timestamp,
                first_seen_timestamp, grunt_type, sponsor_id) VALUES
            `;
            sqlUpdate += pokestopsSQL.join(',');
            //console.log('sql:', sqlUpdate);
            sqlUpdate += ` 
            ON DUPLICATE KEY UPDATE
            lat=VALUES(lat),
            lon=VALUES(lon),
            name=VALUES(name),
            url=VALUES(url),
            lure_expire_timestamp=VALUES(lure_expire_timestamp),
            last_modified_timestamp=VALUES(last_modified_timestamp),
            updated=VALUES(updated),
            enabled=VALUES(enabled),
            quest_type=VALUES(quest_type),
            quest_timestamp=VALUES(quest_timestamp),
            quest_target=VALUES(quest_target),
            quest_conditions=VALUES(quest_conditions),
            quest_rewards=VALUES(quest_rewards),
            quest_template=VALUES(quest_template),
            cell_id=VALUES(cell_id),
            deleted=VALUES(deleted),
            lure_id=VALUES(lure_id),
            pokestop_display=VALUES(pokestop_display),
            incident_expire_timestamp=VALUES(incident_expire_timestamp),
            first_seen_timestamp=VALUES(first_seen_timestamp),
            grunt_type=VALUES(grunt_type),
            sponsor_id=VALUES(sponsor_id)
            `;
            let result = await db.query(sqlUpdate);
            //console.log('Result:', result);
        }
    }
}

module.exports = RouteController;