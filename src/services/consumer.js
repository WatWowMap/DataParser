'use strict';

const moment = require('moment');
const S2 = require('nodes2ts');

const config = require('../config.json');
const Account = require('../models/account.js');
const Gym = require('../models/gym.js');
const Pokemon = require('../models/pokemon.js');
const Pokestop = require('../models/pokestop.js');
const Spawnpoint = require('../models/spawnpoint.js');

const MySQLConnector = require('../services/mysql.js');
const WebhookController = require('../services/webhook.js');
const Weather = require('../models/weather');
const db = new MySQLConnector(config.db);

// TODO: Break out class into model classes

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
                        if (!pokemon.pokestopId) {
                            continue;
                        }
                        let pokestop;
                        try {
                            pokestop = await Pokestop.getById(pokemon.pokestopId);
                        } catch (err) {
                            console.error('[Pokemon] Error:', err);
                        }
                        if (!pokestop) {
                            continue;
                        }
                        pokemon.lat = pokestop.lat;
                        pokemon.lon = pokestop.lon;
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
                        ${pokemon.capture3 || null},
                        ${pokemon.pvpRankingsGreatLeague ? JSON.stringify(pokemon.pvpRankingsGreatLeague) : null},
                        ${pokemon.pvpRankingsUltraLeague ? JSON.stringify(pokemon.pvpRankingsUltraLeague) : null}
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
                    expire_timestamp_verified, shiny, username, capture_1, capture_2, capture_3,
                    pvp_rankings_great_league, pvp_rankings_ultra_league
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
                    capture_3=VALUES(capture_3),
                    pvp_rankings_great_league=VALUES(pvp_rankings_great_league),
                    pvp_rankings_ultra_league=VALUES(pvp_rankings_ultra_league)                    
                `;
                try {
                    let result = await db.query(sqlUpdate);
                    //console.log('[Wild] Result:', result.affectedRows);
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
                        if (!pokemon.pokestopId) {
                            continue;
                        }
                        let pokestop;
                        try {
                            pokestop = await Pokestop.getById(pokemon.pokestopId);
                        } catch (err) {
                            console.error('[Pokemon] Error:', err);
                        }
                        if (!pokestop) {
                            continue;
                        }
                        pokemon.lat = pokestop.lat;
                        pokemon.lon = pokestop.lon;
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
                        ${pokemon.capture3 || null},
                        ${pokemon.pvpRankingsGreatLeague ? JSON.stringify(pokemon.pvpRankingsGreatLeague) : null},
                        ${pokemon.pvpRankingsUltraLeague ? JSON.stringify(pokemon.pvpRankingsUltraLeague) : null}
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
                    expire_timestamp_verified, shiny, username, capture_1, capture_2, capture_3,
                    pvp_rankings_great_league, pvp_rankings_ultra_league
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
                capture_3=VALUES(capture_3),
                pvp_rankings_great_league=VALUES(pvp_rankings_great_league),
                pvp_rankings_ultra_league=VALUES(pvp_rankings_ultra_league)
                `;
                let result = await db.query(sqlUpdate);
                //console.log('[Nearby] Result:', result.affectedRows);
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
        // First time seeing pokemon
        if (!oldPokemon) {
            // Check if expire timestamp set
            if (!pokemon.expireTimestamp) {
                pokemon.expireTimestamp = now + Pokemon.PokemonTimeUnseen;
            }
            // Set first seen timestamp
            pokemon.firstSeenTimestamp = pokemon.updated;
        } else {
            // Pokemon was seen before, set first seen timestamp to original
            pokemon.firstSeenTimestamp = oldPokemon.firstSeenTimestamp;
            // Check if expire timestamp set
            if (!pokemon.expireTimestamp) {
                // Check if pokemon that doesn't havea a known despawn time was reseen, if so add time to expire timestamp
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
            if (oldPokemon.pvpRankingsGreatLeague && !pokemon.pvpRankingsGreatLeague) {
                pokemon.pvpRankingsGreatLeague = oldPokemon.pvpRankingsGreatLeague;
            }
            if (oldPokemon.pvpRankingsUltraLeague && !pokemon.pvpRankingsUltraLeague) {
                pokemon.pvpRankingsUltraLeague = oldPokemon.pvpRankingsUltraLeague;
            }
            // Check if we need to update IV and old pokemon atk_id is not set and new pokemon atk_id is set
            if (updateIV && !oldPokemon.atkIv && pokemon.atkIv) {
                WebhookController.instance.addPokemonEvent(pokemon.toJson());
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

        // Known spawn_id, check for despawn time
        if (pokemon.spawnId) {
            let spawnpoint;
            let secondOfHour = null;
            if (pokemon.expireTimestampVerified && pokemon.expireTimestamp) {
                let date = moment(pokemon.expireTimestamp * 1000).format('mm:ss');
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

        // First time seeing Pokemon, send webhook
        if (!oldPokemon) {
            WebhookController.instance.addPokemonEvent(pokemon.toJson());
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
                            await this.updateGymValues(gym);
                            gymsSQL.push(`
                            (
                                '${gym.id}',
                                ${gym.lat},
                                ${gym.lon},
                                ${gym.name ? '"' + gym.name + '"' : null},
                                ${gym.url ? '"' + gym.url + '"' : null},
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
                                ${gym.sponsorId},
                                ${gym.raidPokemonEvolution}
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
                            await this.updatePokestopValues(pokestop, false);
                            pokestopsSQL.push(`
                            (
                                '${pokestop.id}',
                                ${pokestop.lat},
                                ${pokestop.lon},
                                ${pokestop.name ? '"' + pokestop.name + '"' : null},
                                ${pokestop.url ? '"' + pokestop.url + '"' : null},
                                ${pokestop.lureExpireTimestamp},
                                ${pokestop.lastModifiedTimestamp},
                                ${pokestop.updated},
                                ${pokestop.enabled},

                                ${pokestop.cellId},
                                ${pokestop.deleted},
                                ${pokestop.lureId},
                                ${pokestop.pokestopDisplay},
                                ${pokestop.incidentExpireTimestamp},
                                ${pokestop.firstSeenTimestamp},
                                ${pokestop.gruntType},
                                ${pokestop.sponsorId}
                            )`);
                            /*
                                ${pokestop.questType},
                                ${pokestop.questTimestamp},
                                ${pokestop.questTarget},
                                ${pokestop.questConditions},
                                ${pokestop.questRewards},
                                ${pokestop.questTemplate},
                            */
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
                    cell_id, deleted, total_cp, first_seen_timestamp, raid_pokemon_gender, sponsor_id, raid_pokemon_evolution
                ) VALUES
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
                    sponsor_id=VALUES(sponsor_id),
                    raid_pokemon_evolution=VALUES(raid_pokemon_evolution)
                `;
                let result = await db.query(sqlUpdate);
                //console.log('[Gym] Result:', result.affectedRows);
            }
            if (pokestopsSQL.length > 0) {
                let sqlUpdate = `INSERT INTO pokestop (
                    id, lat, lon, name, url, lure_expire_timestamp, last_modified_timestamp, updated,
                    enabled, cell_id, deleted, lure_id, pokestop_display, incident_expire_timestamp,
                    first_seen_timestamp, grunt_type, sponsor_id
                ) VALUES
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
                    cell_id=VALUES(cell_id),
                    deleted=VALUES(deleted),
                    lure_id=VALUES(lure_id),
                    pokestop_display=VALUES(pokestop_display),
                    incident_expire_timestamp=VALUES(incident_expire_timestamp),
                    first_seen_timestamp=VALUES(first_seen_timestamp),
                    grunt_type=VALUES(grunt_type),
                    sponsor_id=VALUES(sponsor_id)
                `;
                /*
                    quest_type=VALUES(quest_type),
                    quest_timestamp=VALUES(quest_timestamp),
                    quest_target=VALUES(quest_target),
                    quest_conditions=VALUES(quest_conditions),
                    quest_rewards=VALUES(quest_rewards),
                    quest_template=VALUES(quest_template),
                */
                let result = await db.query(sqlUpdate);
                //console.log('[Pokestop] Result:', result.affectedRows);
            }
        }
    }

    async updateGymValues(gym) {
        let ts = new Date().getTime() / 1000;
        let oldGym;
        try {
            oldGym = await Gym.getById(gym.id, true);
        } catch (err) {
            oldGym = null;
        }
        
        if (gym.raidIsExclusive && Gym.exRaidBossId) {
            gym.raidPokemonId = Gym.exRaidBossId;
            gym.raidPokemonForm = Gym.exRaidBossForm || 0;
        }
        
        gym.updated = ts;
        
        if (!oldGym) {
            WebhookController.instance.addGymEvent(gym.toJson('gym'));
            WebhookController.instance.addGymInfoEvent(gym.toJson('gym-info'));
            let raidBattleTime = new Date((gym.raidBattleTimestamp || 0) * 1000); // TODO: Probably going to get a divide by zero error >.>
            let raidEndTime = Date((gym.raidEndTimestamp || 0) * 1000);
            let now = new Date().getTime() / 1000;            
            
            if (raidBattleTime > now && gym.raidLevel || 0 > 0) {
                WebhookController.instance.addEggEvent(gym.toJson('egg'));
            } else if (raidEndTime > now && gym.raidPokemonId || 0 > 0) {
                WebhookController.instance.addRaidEvent(gym.toJson('raid'));
            }
        } else {
            if (oldGym.cellId && !gym.cellId) {
                gym.cellId = oldGym.cellId;
            }
            if (oldGym.name && !gym.name) {
                gym.name = oldGym.name;
            }
            if (oldGym.url && !gym.url) {
                gym.url = oldGym.url;
            }
            if (oldGym.raidIsExclusive && !gym.raidIsExclusive) {
                gym.raidIsExclusive = oldGym.raidIsExclusive;
            }
            if (oldGym.availableSlots !== gym.availableSlots ||
                oldGym.teamId !== gym.teamId ||
                oldGym.inBattle !== gym.inBattle) {
                WebhookController.instance.addGymInfoEvent(gym.toJson('gym-info'));
            }
            if (!gym.raidEndTimestamp && oldGym.raidEndTimestamp) {
                gym.raidEndTimestamp = oldGym.raidEndTimestamp;
            }
            // TODO: Double check
            if (gym.raidSpawnTimestamp > 0 && (
                    oldGym.raidLevel !== gym.raidLevel ||
                    oldGym.raidPokemonId !== gym.raidPokemonId ||
                    oldGym.raidSpawnTimestamp !== gym.raidSpawnTimestamp
                )) {
                
                let raidBattleTime = new Date((gym.raidBattleTimestamp || 0) * 1000);
                let raidEndTime = new Date((gym.raidEndTimestamp || 0) * 1000);
                let now = new Date().getTime() / 1000;

                if (raidBattleTime > now && gym.raidLevel || 0 > 0) {
                    WebhookController.instance.addEggEvent(gym.toJson('egg'));
                } else if (raidEndTime > now && gym.raidPokemonId || 0 > 0) {
                    WebhookController.instance.addRaidEvent(gym.toJson('raid'));
                }
            }
        }
    }

    async updatePokestopValues(pokestop, updateQuest) {
        let oldPokestop;
        try {
            oldPokestop = await Pokestop.getById(pokestop.id);
        } catch {
            oldPokestop = null;
        }
        pokestop.updated = new Date().getTime() / 1000;
        
        if (!oldPokestop) {
            WebhookController.instance.addPokestopEvent(pokestop.toJson('pokestop'));
            if ((pokestop.lureExpireTimestamp || 0) > 0) {
                WebhookController.instance.addLureEvent(pokestop.toJson('lure'));
            }
            if ((pokestop.questTimestamp || 0) > 0) {
                WebhookController.instance.addQuestEvent(pokestop.toJson('quest'));
            }
            if ((pokestop.incidentExpireTimestamp || 0) > 0) {
                WebhookController.instance.addInvasionEvent(pokestop.toJson('invasion'));
            }
        } else {
            if (oldPokestop.cellId && !pokestop.cellId) {
                pokestop.cellId = oldPokestop.cellId;
            }
            if (oldPokestop.name && !pokestop.name) {
                pokestop.name = oldPokestop.name;
            }
            if (oldPokestop.url && !pokestop.url) {
                pokestop.url = oldPokestop.url;
            }
            if (updateQuest && oldPokestop.questType && pokestop.questType) {
                pokestop.questType = oldPokestop.questType;
                pokestop.questTarget = oldPokestop.questTarget;
                pokestop.questConditions = oldPokestop.questConditions;
                pokestop.questRewards = oldPokestop.questRewards;
                pokestop.questTimestamp = oldPokestop.questTimestamp;
                pokestop.questTemplate = oldPokestop.questTemplate;
            }
            if (oldPokestop.lureId && !pokestop.lureId) {
                pokestop.lureId = oldPokestop.lureId;
            }
            if ((oldPokestop.lureExpireTimestamp || 0) < (pokestop.lureExpireTimestamp || 0)) {
                WebhookController.instance.addLureEvent(pokestop.toJson('lure'));
            }
            if ((oldPokestop.incidentExpireTimestamp || 0) < (pokestop.incidentExpireTimestamp || 0)) {
                WebhookController.instance.addInvasionEvent(pokestop.toJson('invasion'));
            }
            if (updateQuest && (pokestop.questTimestamp || 0) > (oldPokestop.questTimestamp || 0)) {
                WebhookController.instance.addQuestEvent(pokestop.toJson('quest'));
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
                    let name = details.name ? details.name : '';
                    let url = details.image_urls.length > 0 ? details.image_urls[0] : '';
                    let id = details.fort_id;
                    let lat = details.latitude;
                    let lon = details.longitude;
                    fortDetailsSQL.push(`('${id}', ${lat}, ${lon}, "${name}", "${url}", ${ts}, ${ts})`);
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
            //console.log('[FortDetails] Result:', result.affectedRows);
        }
    }

    async updateGymInfos(gymInfos) {
        if (gymInfos.length > 0) {
            let gymInfosSQL = [];
            for (let i = 0; i < gymInfos.length; i++) {
                let info = gymInfos[i];
                try {
                    let name = info.name ? info.name : '';
                    let url = info.url ? info.url : '';
                    let id = info.gym_status_and_defenders.pokemon_fort_proto.id;
                    let lat = info.gym_status_and_defenders.pokemon_fort_proto.latitude;
                    let lon = info.gym_status_and_defenders.pokemon_fort_proto.longitude;
                    gymInfosSQL.push(`('${id}', ${lat}, ${lon}, "${name}", "${url}", UNIX_TIMESTAMP(), UNIX_TIMESTAMP())`);
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
            //console.log('[GymInfos] Result:', result.affectedRows);
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
            //console.log('[Cell] Result:', result.affectedRows);
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
                    const weather = new Weather(cellId, level, lat, lon, gameplayCondition, windDirection, cloudLevel, rainLevel, windLevel, snowLevel, fogLevel, seLevel, severity, warnWeather, ts);
                    WebhookController.instance.addWeatherEvent(weather.toJson());
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
            //console.log('[Weather] Result:', result.affectedRows);
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
                    await this.updatePokemonValues(pokemon);

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
                        ${pokemon.capture3 || null},
                        ${pokemon.pvpRankingsGreatLeague ? "'" + JSON.stringify(pokemon.pvpRankingsGreatLeague) + "'" : null},
                        ${pokemon.pvpRankingsUltraLeague ? "'" + JSON.stringify(pokemon.pvpRankingsUltraLeague) + "'" : null}
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
                expire_timestamp_verified, shiny, username, capture_1, capture_2, capture_3,
                pvp_rankings_great_league, pvp_rankings_ultra_league
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
                capture_3=VALUES(capture_3),
                pvp_rankings_great_league=VALUES(pvp_rankings_great_league),
                pvp_rankings_ultra_league=VALUES(pvp_rankings_ultra_league)
            `;
            try {
                let result = await db.query(sqlUpdate);
                //console.log('[Encounter] Result:', result.affectedRows);
            } catch (err) {
                console.error('[Encounter] Error:', err.message);
            }
        }
    }

    async updateQuests(quests) {
        if (quests.length > 0) {
            let questsSQL = [];
            for (let i = 0; i < quests.length; i++) {
                let quest = quests[i];
                let pokestop;
                try {
                    pokestop = await Pokestop.getById(quest.fort_id);
                } catch {
                    pokestop = null;
                }
                if (pokestop instanceof Pokestop) {
                    // Add quest data to pokestop object
                    pokestop.addQuest(quest);
                    // Check if we need to send any webhooks
                    await this.updatePokestopValues(pokestop, true);
                    questsSQL.push(`
                    (
                        '${quest.fort_id}',
                        ${pokestop.lat},
                        ${pokestop.lon},
                        ${pokestop.name ? '"' + pokestop.name + '"' : null},
                        ${pokestop.url ? '"' + pokestop.url + '"' : null},
                        ${pokestop.lureExpireTimestamp},
                        ${pokestop.lastModifiedTimestamp},
                        ${pokestop.updated},
                        ${pokestop.enabled},
                        ${pokestop.questType},
                        ${pokestop.questTimestamp},
                        ${pokestop.questTarget},
                        '${JSON.stringify(pokestop.questConditions)}',
                        '${JSON.stringify(pokestop.questRewards)}',
                        '${pokestop.questTemplate}',
                        ${pokestop.cellId},
                        ${pokestop.deleted},
                        ${pokestop.lureId},
                        ${pokestop.pokestopDisplay},
                        ${pokestop.incidentExpireTimestamp},
                        ${pokestop.firstSeenTimestamp},
                        ${pokestop.gruntType},
                        ${pokestop.sponsorId}
                    )`);
                }
            }
            if (questsSQL.length > 0) {
                let sqlUpdate = `INSERT INTO pokestop (
                    id, lat, lon, name, url, lure_expire_timestamp, last_modified_timestamp, updated,
                    enabled, quest_type, quest_timestamp, quest_target, quest_conditions, quest_rewards,
                    quest_template, cell_id, deleted, lure_id, pokestop_display, incident_expire_timestamp,
                    first_seen_timestamp, grunt_type, sponsor_id
                ) VALUES
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
                try {
                    let result = await db.query(sqlUpdate);
                    //console.log('[Quest] Result:', result.affectedRows);
                } catch (err) {
                    console.error('[Quest] Error:', err);
                    console.error('sql:', sqlUpdate);
                }
            }
        }
    }

    async updatePlayerData(playerData) {
        if (playerData.length > 0) {
            let playerDataSQL = [];
            for (let i = 0; i < playerData.length; i++) {
                let data = playerData[i];
                try {
                    let account;
                    try {
                        account = await Account.getWithUsername(this.username);
                    } catch {
                        account = null;
                    }
                    if (account instanceof Account) {
                        // Add quest data to pokestop object
                        account.parsePlayerData(data);
                        playerDataSQL.push(`
                        (
                            '${account.username}',
                            '${account.password}',
                            ${account.firstWarningTimestamp},                        
                            ${account.failedTimestamp},
                            ${account.failed},
                            ${account.level},
                            ${account.last_encounter_lat},
                            ${account.last_encounter_lon},
                            ${account.last_encounter_time},
                            ${account.spins},
                            ${account.tutorial},
                            ${account.creationTimestampMs},
                            ${account.warn},
                            ${account.warnExpireMs},
                            ${account.warnMessageAcknowledged},
                            ${account.suspendedMessageAcknowledged},
                            ${account.wasSuspended},
                            ${account.banned},
                            ${account.creationTimestamp},
                            ${account.warnExpireTimestamp}
                        )`);
                    }
                } catch (err) {
                    console.error('[Account] Error:', err);
                }
            }

            if (playerDataSQL.length > 0) {
                let sqlUpdate = `INSERT INTO account (
                    username, password, first_warning_timestamp, failed, level,
                    last_encounter_lat, last_encounter_lon, last_encounter_time,
                    spins, tutorial, creation_timestamp_ms, warn, warn_expire_ms,
                    warn_message_acknowledged, suspended_message_acknowledged,
                    was_suspended, banned, creation_timestamp, warn_expire_timestamp
                ) VALUES
                `;
                sqlUpdate += playerDataSQL.join(',');
                //console.log('sql:', sqlUpdate);
                sqlUpdate += ` 
                ON DUPLICATE KEY UPDATE
                    password=VALUES(password),
                    first_warning_timestamp=VALUES(first_warning_timestamp),
                    failed=VALUES(failed),
                    level=VALUES(level),
                    last_encounter_lat=VALUES(last_encounter_lat),
                    last_encounter_lon=VALUES(last_encounter_lon),
                    last_encounter_time=VALUES(last_encounter_time),
                    spins=VALUES(spins),
                    tutorial=VALUES(tutorial),
                    creation_timestamp_ms=VALUES(creation_timestamp_ms),
                    warn=VALUES(warn),
                    warn_expire_ms=VALUES(warn_expire_ms),
                    warn_message_acknowledged=VALUES(warn_message_acknowledged),
                    suspended_message_acknowledged=VALUES(suspended_message_acknowledged),
                    was_suspended=VALUES(was_suspended),
                    banned=VALUES(banned),
                    creation_timestamp=VALUES(creation_timestamp),
                    warn_expire_timestamp=VALUES(warn_expire_timestamp)
                `;
                let result = await db.query(sqlUpdate);
                console.log('[PlayerData] Result:', result.affectedRows);
            }
        }
    }
}

module.exports = Consumer;
