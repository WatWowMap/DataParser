'use strict';

const moment = require('moment');

const config = require('../config.json');
const Cell = require('./cell.js');
const Pokestop = require('./pokestop.js');
const Spawnpoint = require('./spawnpoint.js');
const MySQLConnector = require('../services/mysql.js');
const db = new MySQLConnector(config.db);

class Pokemon {
    static DittoPokemonId = 132;
    static WeatherBoostMinLevel = 6;
    static WeatherBoostMinIvStat = 4;
    static PokemonTimeUnseen = 1200;
    static PokemonTimeReseen = 600;
    static DittoDisguises = [46,163,165,167,187,223,293,316,322,399,590];
    static DittoMove1Transform = 242;
    static DittoMove2Struggle = 133;

    /**
     * Initialize new Pokemon object.
     * @param data 
     */
    constructor(data) {
        if (data.wild) {
            this.initWild(data);
        } else if (data.nearby) {
            this.initNearby(data);
        } else {
            this.id = data.id;
            this.lat = data.lat;
            this.lon = data.lon;
            this.pokemonId = data.pokemon_id;
            this.form = data.form;
            this.level = data.level;
            this.costume = data.costume;
            this.weather = data.weather;
            this.gender = data.gender;
            this.spawnId = data.spawn_id ? BigInt(data.spawn_id).toString() : null;
            this.cellId = data.cell_id ? BigInt(data.cell_id).toString() : null;
            this.firstSeenTimestamp = data.first_seen_timestamp || new Date().getTime() / 1000;
            this.expireTimestamp = data.expire_timestamp;
            this.expireTimestampVerified = data.expire_timestamp_verified;
            this.cp = data.cp;
            this.move1 = data.move_1;
            this.move2 = data.move_2;
            this.size = data.size;
            this.weight = data.weight;
            this.atkIv = data.atk_iv;
            this.defIv = data.def_iv;
            this.staIv = data.sta_iv;
            this.username = data.username;
            this.shiny = data.shiny;
            this.updated = data.updated;
            this.changed = data.changed;
            this.pokestopId = data.pokestop_id;
            this.displayPokemonId = data.display_pokemon_id;
            this.capture1 = data.capture_1;
            this.capture2 = data.capture_2;
            this.capture3 = data.capture_3;
            this.pvpRankingsGreatLeague = data.pvp_rankings_great_league;
            this.pvpRankingsUltraLeague = data.pvp_rankings_ultra_league;
        }
        if (!this.firstSeenTimestamp) {
            this.firstSeenTimestamp = new Date().getTime() / 1000;
        }
    }

    async initWild(data) {
        this.id = BigInt(data.wild.encounter_id).toString();
        let ts = new Date().getTime() / 1000;
        //console.log('Wild Pokemon Data:', data.wild.pokemon_data);
        this.pokemonId = data.wild.pokemon_data.pokemon_id;
        if (data.wild.latitude === undefined || data.wild.latitude === null) {
            console.debug('[Pokemon] Wild Pokemon null lat/lon!');
        }
        this.lat = data.wild.latitude;
        this.lon = data.wild.longitude;
        this.spawnId = BigInt(parseInt(data.wild.spawn_point_id, 16)).toString();
        this.gender = data.wild.pokemon_data.pokemon_display.gender;
        this.form = data.wild.pokemon_data.pokemon_display.form;
        if (data.wild.pokemon_data.pokemon_display) {
            this.costume = data.wild.pokemon_data.pokemon_display.costume;
            this.weather = data.wild.pokemon_data.pokemon_display.weather_boosted_condition;
        }
        this.username = data.wild.username;
        if (data.wild.time_till_hidden_ms > 0 && data.wild.time_till_hidden_ms <= 90000) {
            this.expireTimestamp = Math.round(ts + data.wild.time_till_hidden_ms);
            this.expireTimestampVerified = true;
        } else {
            this.expireTimestampVerified = false;
        }
        if (!this.expireTimestampVerified && this.spawnId) {
            // Spawnpoint not verified, check if we have the tth.
            let spawnpoint;
            try {
                spawnpoint = await Spawnpoint.getById(this.spawnId);
            } catch (err) {
                spawnpoint = null;
            }
            if (spawnpoint instanceof Spawnpoint) {
                let expireTimestamp = this.getDespawnTimer(spawnpoint);
                if (expireTimestamp > 0) {
                    this.expireTimestamp = expireTimestamp;
                    this.expireTimestampVerified = true;
                }
            } else {
                spawnpoint = new Spawnpoint(this.spawnId, this.lat, this.lon, null, new Date().getTime() / 1000);
                await spawnpoint.save(false);
                this.expireTimestamp = null;
            }
        }
        if (data.wild.cell === undefined || data.wild.cell === null) {
            data.wild.cell = Cell.getCellIdFromLatLon(this.lat, this.lon);
        } else {
            this.cellId = BigInt(data.wild.cell).toString();
        }
        if (data.wild.pokemon_data) {
            this.atkIv = data.wild.pokemon_data.individual_attack;
            this.defIv = data.wild.pokemon_data.individual_defense;
            this.staIv = data.wild.pokemon_data.individual_stamina;
            this.move1 = data.wild.pokemon_data.move_1;
            this.move2 = data.wild.pokemon_data.move_2;
            this.cp = data.wild.pokemon_data.cp;
            let cpMultiplier = data.wild.pokemon_data.cp_multiplier;
            let level;
            if (cpMultiplier < 0.734) {
                level = Math.round(58.35178527 * cpMultiplier * cpMultiplier - 2.838007664 * cpMultiplier + 0.8539209906);
            } else {
                level = Math.round(171.0112688 * cpMultiplier - 95.20425243);
            }
            this.level = level;
            this.capture1 = null;
            this.capture2 = null;
            this.capture3 = null;
        } else {
            this.atkIv = null;
            this.defIv = null;
            this.staIv = null;
            this.move1 = null;
            this.move2 = null;
            this.cp = null;
            this.level = null;
            this.capture1 = null;
            this.capture2 = null;
            this.capture3 = null;
        }
        this.changed = ts;
    }

    async initNearby(data) {
        this.id = BigInt(data.nearby.encounter_id).toString();
        this.pokemonId = data.nearby.pokemon_id;
        this.pokestopId = data.nearby.fort_id;
        this.gender = data.nearby.pokemon_display.gender;
        this.form = data.nearby.pokemon_display.form;
        if (data.nearby.pokemon_display) {
            this.costume = data.nearby.pokemon_display.costume;
            this.weather = data.nearby.pokemon_display.weather_boosted_condition;
        }
        this.username = data.username || null;
        let pokestop;
        try {
            pokestop = await Pokestop.getById(data.nearby.fort_id);
        } catch (err) {
            pokestop = null;
            console.error('[Pokemon] InitNearby Error:', err);
        }
        if (pokestop) {
            this.pokestopId = pokestop.id;
            this.lat = pokestop.lat;
            this.lon = pokestop.lon;
        }
        this.cellId = BigInt(data.cellId).toString();
        this.expireTimestampVerified = false;
    }

    /**
     * Get pokemon by pokemon encounter id.
     * @param encounterId 
     */
    static async getById(encounterId) {
        let sql = `
            SELECT
                id, pokemon_id, lat, lon, spawn_id, expire_timestamp, atk_iv, def_iv, sta_iv,
                move_1, move_2, gender, form, cp, level, weather, costume, weight, size,
                display_pokemon_id, pokestop_id, updated, first_seen_timestamp, changed, cell_id,
                expire_timestamp_verified, shiny, username, capture_1, capture_2, capture_3
            FROM pokemon
            WHERE id = ?
            LIMIT 1
        `;
        let args = [encounterId.toString()];
        let results = await db.query(sql, args)
            .then(x => x)
            .catch(err => {
                console.error('[Pokemon] Error:', err);
                return null;
            });
        for (let i = 0; i < results.length; i++) {
            let result = results[i];
            return new Pokemon(result);
        }
        return null;
    }

    /**
     * Add Pokemon encounter proto data.
     * @param encounter 
     * @param username 
     */
    async addEncounter(encounter, username) {
        this.pokemonId = encounter.wild_pokemon.pokemon_data.pokemon_id;
        this.cp = encounter.wild_pokemon.pokemon_data.cp;
        this.move1 = encounter.wild_pokemon.pokemon_data.move_1;
        this.move2 = encounter.wild_pokemon.pokemon_data.move_2;
        this.size = encounter.wild_pokemon.pokemon_data.height_m;
        this.weight = encounter.wild_pokemon.pokemon_data.weight_kg;
        this.atkIv = encounter.wild_pokemon.pokemon_data.individual_attack;
        this.defIv = encounter.wild_pokemon.pokemon_data.individual_defense;
        this.staIv = encounter.wild_pokemon.pokemon_data.individual_stamina;
        this.costume = encounter.wild_pokemon.pokemon_data.pokemon_display.costume;
        this.shiny = encounter.wild_pokemon.pokemon_data.pokemon_display.shiny;
        this.username = username;
        this.form = encounter.wild_pokemon.pokemon_data.pokemon_display.form;
        this.gender = encounter.wild_pokemon.pokemon_data.pokemon_display.gender;
        if (encounter.capture_probability) {
            this.capture1 = parseFloat(encounter.capture_probability.capture_probability[0]);
            this.capture2 = parseFloat(encounter.capture_probability.capture_probability[1]);
            this.capture3 = parseFloat(encounter.capture_probability.capture_probability[2]);
        }
        let cpMultiplier = encounter.wild_pokemon.pokemon_data.cp_multiplier;
        let level;
        if (cpMultiplier < 0.734) {
            level = Math.round(58.35178527 * cpMultiplier * cpMultiplier - 2.838007664 * cpMultiplier + 0.8539209906);
        } else {
            level = Math.round(171.0112688 * cpMultiplier - 95.20425243);
        }
        this.level = level;
        this.isDitto = Pokemon.isDittoDisguised(this.pokemonId,
                                                this.level || 0,
                                                this.weather || 0,
                                                this.atkIv || 0,
                                                this.defIv || 0,
                                                this.staIv || 0
        );
        if (this.isDitto) {
            console.log('[POKEMON] Pokemon', this.id, 'Ditto found, disguised as', this.pokemonId);
            this.setDittoAttributes(this.pokemonId);
        }

        if (!this.spawnId) {
            this.spawnId = parseInt(encounter.wild_pokemon.spawn_point_id, 16);
            this.lat = encounter.wild_pokemon.latitude;
            this.lon = encounter.wild_pokemon.longitude;

            if (!this.expireTimestampVerified && this.spawnId) {
                let spawnpoint;
                try {
                    spawnpoint = await Spawnpoint.getById(this.spawnId);
                } catch (err) {
                    spawnpoint = null;
                }
                if (spawnpoint instanceof Spawnpoint) {
                    let expireTimestamp = this.getDespawnTimer(spawnpoint);
                    if (expireTimestamp > 0) {
                        this.expireTimestamp = expireTimestamp;
                        this.expireTimestampVerified = true;
                    }
                } else {
                    spawnpoint = new Spawnpoint(this.spawnId, this.lat, this.lon, null, new Date().getTime() / 1000);
                    await spawnpoint.save(true);
                }
            }
        }

        this.updated = new Date().getTime() / 1000;
        this.changed = this.updated;
    }

    /**
     * Set default Ditto attributes.
     * @param displayPokemonId 
     */
    setDittoAttributes(displayPokemonId) {
        this.displayPokemonId = displayPokemonId;
        this.pokemonId = Pokemon.DittoPokemonId;
        this.form = 0;
        this.move1 = Pokemon.DittoMove1Transform;
        this.move2 = Pokemon.DittoMove2Struggle;
        this.gender = 3;
        this.costume = 0;
        this.size = 0;
        this.weight = 0;
    }

    /**
     * Check if Pokemon is Ditto disguised.
     * @param pokemon 
     */
    static isDittoDisguisedFromPokemon(pokemon) {
        let isDisguised = (pokemon.pokemonId == Pokemon.DittoPokemonId) || (Pokemon.DittoDisguises.includes(pokemon.pokemonId) || false);
        let isUnderLevelBoosted = pokemon.level > 0 && pokemon.level < Pokemon.WeatherBoostMinLevel;
        let isUnderIvStatBoosted = pokemon.level > 0 && (pokemon.atkIv < Pokemon.WeatherBoostMinIvStat || pokemon.defIv < Pokemon.WeatherBoostMinIvStat || pokemon.staIv < Pokemon.WeatherBoostMinIvStat);
        let isWeatherBoosted = pokemon.weather > 0;
        return isDisguised && (isUnderLevelBoosted || isUnderIvStatBoosted) && isWeatherBoosted;
    }

    /**
     * Check if Pokemon is Ditto disguised.
     * @param pokemonId 
     * @param level 
     * @param weather 
     * @param atkIv 
     * @param defIv 
     * @param staIv 
     */
    static isDittoDisguised(pokemonId, level, weather, atkIv, defIv, staIv) {
        let isDisguised = (pokemonId == Pokemon.DittoPokemonId) || (Pokemon.DittoDisguises.includes(pokemonId) || false);
        let isUnderLevelBoosted = level > 0 && level < Pokemon.WeatherBoostMinLevel;
        let isUnderIvStatBoosted = level > 0 && (atkIv < Pokemon.WeatherBoostMinIvStat || defIv < Pokemon.WeatherBoostMinIvStat || staIv < Pokemon.WeatherBoostMinIvStat);
        let isWeatherBoosted = weather > 0;
        return isDisguised && (isUnderLevelBoosted || isUnderIvStatBoosted) && isWeatherBoosted;
    }

    /**
     * Calculate despawn timer of spawnpoint
     * @param spawnpoint 
     * @param timestampMs 
     */
    getDespawnTimer(spawnpoint, timestampMs) {
        let despawnSecond = spawnpoint.despawnSecond;
        if (despawnSecond) {
            let currentDate = new Date();
            let currentTime = Math.floor(currentDate / 1000);
            let ts = currentTime.toString();
            let minute = currentDate.getMinutes();
            let second = currentDate.getSeconds();
            let secondOfHour = second + minute * 60;

            let despawnOffset;
            if (despawnSecond < secondOfHour) {
                despawnOffset = 3600 + despawnSecond - secondOfHour;
            } else {
                despawnOffset = despawnSecond - secondOfHour;
            }
            let despawn = parseInt(ts) + despawnOffset;
            return despawn;
        }
    }

    /**
     * Get Pokemon object as JSON object with correct property keys for webhook payload
     */
    toJson() {
        return {
            type: 'pokemon',
            message: {
                spawnpoint_id: this.spawnId ? this.spawnId.toString(16) : 'None',
                pokestop_id: this.pokestopId || 'None',
                encounter_id: this.id,
                pokemon_id: this.pokemonId,
                latitude: this.lat,
                longitude: this.lon,
                disappear_time: this.expireTimestamp || 0,
                disappear_time_verified: this.expireTimestampVerified,
                first_seen: this.firstSeenTimestamp || 1,
                last_modified_time: this.updated || 1,
                gender: this.gender,
                cp: this.cp,
                form: this.form,
                costume: this.costume,
                individual_attack: this.atkIv,
                individual_defense: this.defIv,
                individual_stamina: this.staIv,
                pokemon_level: this.level,
                move_1: this.move1,
                move_2: this.move2,
                weight: this.weight,
                height: this.size,
                weather: this.weather,
                shiny: this.shiny,
                username: this.username,
                display_pokemon_id: this.displayPokemonId,
                capture_1: this.capture1,
                capture_2: this.capture2,
                capture_3: this.capture3
            }
        }
    }
}

module.exports = Pokemon;