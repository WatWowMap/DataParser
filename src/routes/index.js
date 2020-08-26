'use strict';

const POGOProtos = require('pogo-protos');
//const POGOProtos = require('../POGOProtos.Rpc_pb.js');

const Account = require('../models/account.js');
const Device = require('../models/device.js');

const { sendResponse, base64_decode } = require('../services/utils.js');

const Consumer = require('../services/consumer.js');

class RouteController {

    constructor() {
        this.emptyCells = [];
        this.levelCache = {};
        this.consumers = {};
    }

    /**
     * Handle incoming /raw data
     * @param {*} req 
     * @param {*} res 
     */
    async handleRawData(req, res) {
        let json = req.body;
        if (!json) {
            console.error('[Raw] Bad data');
            return res.sendStatus(400);
        }
        if (json['payload']) {
            json['contents'] = [json];
        }
    
        let trainerLevel = parseInt(json['trainerlvl'] || json['trainerLevel']) || 0;
        let username = json['username'];
        if (username && trainerLevel > 0) {
            let oldLevel = this.levelCache[username];
            if (oldLevel !== trainerLevel) {
                await Account.setLevel(username, trainerLevel);
                this.levelCache[username] = trainerLevel;
            }
        }
        let contents = json['contents'] || json['protos'] || json['gmo'];
        if (!contents) {
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
                    /*
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
                    */
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
                                console.debug('[Raw] Map cells are empty');
                                return res.sendStatus(400);
                            }
                            mapCellsNew.forEach(mapCell => {
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
                                nearbyNew.forEach(nearbyPokemon => {
                                    nearbyPokemons.push({
                                        cell: mapCell.s2_cell_id,
                                        data: nearbyPokemon
                                    });
                                });
                                let fortsNew = mapCell.forts;
                                fortsNew.forEach(fort => {
                                    forts.push({
                                        cell: mapCell.s2_cell_id,
                                        data: fort
                                    });
                                });
                                cells.push(mapCell.s2_cell_id);
                            });
            
                            let weather = gmo.client_weather;
                            weather.forEach(wmapCell => {
                                clientWeathers.push({
                                    cell: wmapCell.s2_cell_id,
                                    data: wmapCell
                                });
                            });
            
                            if (wildPokemons.length === 0 && nearbyPokemons.length === 0 && forts.length === 0) {
                                cells.forEach(cell => {
                                    let count = this.emptyCells[cell];
                                    if (!count) {
                                        this.emptyCells[cell] = 1;
                                    } else {
                                        this.emptyCells[cell] = count + 1;
                                    }
                                    if (count === 3) {
                                        console.debug('[Raw] Cell', cell, 'was empty 3 times in a row. Assuming empty.');
                                        cells.push(cell);
                                    }
                                });
                                
                                console.debug('[Raw] GMO is empty.');
                            } else {
                                cells.forEach(cell => this.emptyCells[cell] = 0);
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

        if (!this.consumers[username]) {
            this.consumers[username] = new Consumer(username);
        }
    
        let total = wildPokemons.length + nearbyPokemons.length + clientWeathers.length + forts.length + fortDetails.length + gymInfos.length + quests.length + encounters.length + cells.length;
        let startTime = process.hrtime();
        if (cells.length > 0) {
            await this.consumers[username].updateCells(cells);
        }

        if (clientWeathers.length > 0) {
            await this.consumers[username].updateWeather(clientWeathers);
        }

        if (wildPokemons.length > 0 || nearbyPokemons.length > 0) {
            await this.consumers[username].updatePokemon(wildPokemons, nearbyPokemons);
        }

        if (forts.length > 0) {
            await this.consumers[username].updateForts(forts);
        }

        if (fortDetails.length > 0) {
            await this.consumers[username].updateFortDetails(fortDetails);
        }

        if (gymInfos.length > 0) {
            await this.consumers[username].updateGymInfos(gymInfos);
        }

        if (quests.length > 0) {
            await this.consumers[username].updateQuests(quests);
        }

        if (encounters.length > 0) {
            await this.consumers[username].updateEncounters(encounters);
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
}

module.exports = RouteController;