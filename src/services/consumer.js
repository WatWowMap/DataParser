'use strict';

const moment = require('moment');
const S2 = require('nodes2ts');

const config = require('../config.json');
const Gym = require('../models/gym.js');
const Pokemon = require('../models/pokemon.js');
const Pokestop = require('../models/pokestop.js');
const Spawnpoint = require('../models/spawnpoint.js');

const MySQLConnector = require('../services/mysql.js');
const db = new MySQLConnector(config.db);

class Consumer {

    constructor(username) {
        this.username = username;
        this.gymIdsPerCell = {};
        this.stopsIdsPerCell = {};
    }

    // TODO: Get fort id
    async updatePokemon(wildPokemon, nearbyPokemon) {
        if (wildPokemon.length > 0) {
            let wildSQL = [];
            let ts = new Date().getTime() / 1000;
            for (let i = 0; i < wildPokemon.length; i++) {
                let wild = wildPokemon[i];
                try {
                    let pokemon = new Pokemon({
                        username: this.username,
                        cellId: wild.cell,
                        timestampMs: wild.timestamp_ms,
                        wild: wild.data
                    });
                    await this.updatePokemonValues(pokemon);
        
                    if (!pokemon.lat && pokemon.pokestopId) {
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
                try {
                    let result = await db.query(sqlUpdate);
                    //console.log('Result:', result);
                } catch (err) {
                    console.error('[Wild] Error:', err);
                    console.error('[Wild] sql:', sqlUpdate);
                }
            }
        }
        if (nearbyPokemon.length > 0) {
            let nearbySQL = [];
            let ts = new Date().getTime() / 1000;
            for (let i = 0; i < nearbyPokemon.length; i++) {
                let nearby = nearbyPokemon[i];
                try {
                    let pokemon = new Pokemon({
                        username: this.username,
                        cellId: nearby.cell,
                        //timestampMs: nearbyPokemon.timestamp_ms,
                        nearby: nearby.data
                    });
                    await this.updatePokemonValues(pokemon);
        
                    if (!pokemon.lat && pokemon.pokestopId) {
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
                    if (!pokemon.lat) {
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
        if (!oldPokemon) {
            if (!pokemon.expireTimestamp) {
                pokemon.expireTimestamp = now + Pokemon.PokemonTimeUnseen;
            }
            pokemon.firstSeenTimestamp = pokemon.updated;
        } else {
            pokemon.firstSeenTimestamp = oldPokemon.firstSeenTimestamp;
            if (!pokemon.expireTimestamp) {
                let oldExpireDate = oldPokemon.expireTimestamp;
                if ((oldExpireDate - now) < Pokemon.PokemonTimeReseen) {
                    pokemon.expireTimestamp = now + Pokemon.PokemonTimeReseen;
                } else {
                    pokemon.expireTimestamp = oldPokemon.expireTimestamp;
                }
            }
            if (!pokemon.expireTimestampVerified && oldPokemon.expireTimestampVerified) {
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
            // Check if old pokemon cell_id is set and new pokemon cell_id is not
            if (oldPokemon.cellId && !pokemon.cellId) {
                pokemon.cellId = oldPokemon.cellId;
            }
            // Check if old pokemon spawn_id is set and new pokemon spawn_id is not
            if (oldPokemon.spawnId && !pokemon.spawnId) {
                pokemon.spawnId = oldPokemon.spawnId;
                pokemon.lat = oldPokemon.lat;
                pokemon.lon = oldPokemon.lon;
            }
            // Check if old pokemon pokestop_id is set and new pokemon pokestop_id is not
            if (oldPokemon.pokestopId && !pokemon.pokestopId) {
                pokemon.pokestopId = oldPokemon.pokestopId;
            }
            // Check if we need to update IV and old pokemon atk_id is not set and new pokemon atk_id is set
            if (updateIV && !oldPokemon.atkIv && pokemon.atkIv) {
                //WebhookController.instance.addPokemonEvent(this);
                //InstanceController.instance.gotIV(this);
                pokemon.changed = now;
            } else {
                pokemon.changed = oldPokemon.changed || now;
            }

            // Check if old pokemon cell_id is set and new pokemon cell_id is not
            if (updateIV && oldPokemon.atkIv && !pokemon.atkIv) {
                // Weather or spawn change
                if (
                    !((!oldPokemon.weather || oldPokemon.weather === 0) && (pokemon.weather || 0 > 0) ||
                        (!pokemon.weather || pokemon.weather === 0) && (oldPokemon.weather || 0 > 0))
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
            let secondOfHour = null;
            if (pokemon.expireTimestampVerified && pokemon.expireTimestamp) {
                let date = moment(pokemon.expireTimestamp).format('mm:ss');
                let split = date.split(':');
                let minute = parseInt(split[0]);
                let second = parseInt(split[1]);
                secondOfHour = second + minute * 60;
            }
            spawnpoint = new Spawnpoint(
                pokemon.spawnId,
                pokemon.lat,
                pokemon.lon,
                secondOfHour,
                pokemon.updated
            );
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
                            if (!this.gymIdsPerCell[fort.cell]) {
                                this.gymIdsPerCell[fort.cell] = [];
                            }
                            this.gymIdsPerCell[fort.cell.toString()].push(fort.data.id.toString());
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
                            if (!this.stopsIdsPerCell[fort.cell]) {
                                this.stopsIdsPerCell[fort.cell] = [];
                            }
                            this.stopsIdsPerCell[fort.cell.toString()].push(fort.data.id.toString());
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
                    let id = info.gym_status_and_defenders.pokemon_fort_proto.id;
                    let lat = info.gym_status_and_defenders.pokemon_fort_proto.latitude;
                    let lon = info.gym_status_and_defenders.pokemon_fort_proto.longitude;
                    gymInfosSQL.push(`('${id}', ${lat}, ${lon}, '${name}', '${url}', UNIX_TIMESTAMP(), UNIX_TIMESTAMP())`);
                } catch (err) {
                    console.error('[GymInfos] Error:', err);
                }
            }
            let sqlUpdate = 'INSERT INTO gym (id, lat, lon, name, url, updated, first_seen_timestamp) VALUES';
            sqlUpdate += gymInfosSQL.join(',');
            sqlUpdate += ` 
            ON DUPLICATE KEY UPDATE
            lat=VALUES(lat),
            lon=VALUES(lon),
            name=VALUES(name),
            url=VALUES(url),
            updated=VALUES(updated),
            updated=VALUES(first_seen_timestamp)
            `;
            let result = await db.query(sqlUpdate);
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
               
                if (!this.gymIdsPerCell[cellId]) {
                    this.gymIdsPerCell[cellId] = [];
                }
                if (!this.stopsIdsPerCell[cellId]) {
                    this.stopsIdsPerCell[cellId] = [];
                } 
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

    async updateEncounters(encounters) {
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
                        await pokemon.addEncounter(encounter, this.username);
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
                                username: this.username,
                                cellId: cellId,
                                timestampMs: encounter.wild_pokemon.last_modified_timestamp_ms //last_modified_timestamp_ms / timestamp_ms
                            });
                            await pokemon.addEncounter(encounter, this.username);
                        //}
                    }
                    if (!pokemon.spawnId) {
                        pokemon.spawnId = parseInt(encounter.wild_pokemon.spawn_point_id, 16);
                        let spawnpoint = new Spawnpoint(pokemon.spawnId, pokemon.lat, pokemon.lon, null, ts);
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
                        '${quest.fort_id}',
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
            sqlUpdate += questsSQL.join(',');
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

module.exports = Consumer;