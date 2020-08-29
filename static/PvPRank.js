'use strict';

const config = require('../src/config.json');
const baseStats = require('./masterfile.json');
const cpMultiplier = require('./cp_multiplier.json');
//const fs = require('fs-extra');
const mysql = require('mysql');
//const redis = require('redis');

let pokemon = {};
let pokemonObject = baseStats.pokemon;

// TODO: Switch from mysql to redis
let redisOptions = {
    'host': config.db.host,
    'port': config.db.port,
    'user': config.db.username,
    'password': config.db.password,
    'database': config.db.database
};

calculateAllRanks();

async function calculateAllRanks() {
    for (let pokemonId in pokemonObject) {
        if(pokemonObject[pokemonId].attack) {
            calculateTopRanks(pokemonId,-1,2500);
        }
        for (let formId in pokemonObject[pokemonId].forms) {
            if (pokemonObject[pokemonId].forms[formId].attack) {
                calculateTopRanks(pokemonId, formId, 2500);
            }
        }
    }

    //fs.writeFileSync('./ultra_pvp_ranks.json',JSON.stringify(pokemon, null, 4));   
    console.log('[PvP] About to write ultra_league pvp data to SQL table');
    await writePvPData(pokemon, 'ultra_league');
    console.log('[PvP] Done writing ultra_league data to SQL');

    for (let pokemonId in pokemonObject) {
        if (pokemonObject[pokemonId].attack) {
            calculateTopRanks(pokemonId,-1,1500);
        }
        for (let formId in pokemonObject[pokemonId].forms) {
            if (pokemonObject[pokemonId].forms[formId].attack) {
                calculateTopRanks(pokemonId, formId, 1500);
            }
        }   
    }

    //fs.writeFileSync('./great_pvp_ranks.json',JSON.stringify(pokemon, null, 4));   
    console.log('[PvP] About to write great_league pvp data to SQL table');
    await writePvPData(pokemon, 'great_league');
    console.log('[PvP] All data written');
}

function calculateTopRanks(pokemonId, formId, cap) {
    console.log('[PvP] Calculating Top Ranks for:', baseStats.pokemon[pokemonId].name, '(' + pokemonId + ')', 'with form id:', formId);
    let currentPokemon = initializeBlankPokemon();
    let bestStat = {attack: 0, defense: 0, stamina: 0, value: 0};
    let arrayToSort = [];
    
    if (!pokemon[pokemonId]) {
        pokemon[pokemonId] = {};
    }
   
    for (let a = 0; a <= 15; a++) {
        for (let d = 0; d <= 15; d++) {
            for (let s = 0; s <= 15; s++) {
                let currentStat = calculateBestPvPStat(pokemonId, formId, a, d, s, cap);
                if(currentStat > bestStat.value) {
                    bestStat = { attack: a, defense: d, stamina: s, value: currentStat.value, level: currentStat.level };
                }
                currentPokemon[a][d][s] = { value: currentStat.value, level: currentStat.level, cp: currentStat.cp };
                arrayToSort.push({ attack: a, defense: d, stamina: s, value: currentStat.value });
            }
        }
    }

    arrayToSort.sort((a, b) => b.value - a.value);
	
    let best = arrayToSort[0].value;
    for (let i = 0; i < arrayToSort.length; i++) {
        let percent = precisionRound((arrayToSort[i].value / best) * 100, 2);
        arrayToSort[i].percent = percent;
        currentPokemon[arrayToSort[i].attack][arrayToSort[i].defense][arrayToSort[i].stamina].percent = percent;
        currentPokemon[arrayToSort[i].attack][arrayToSort[i].defense][arrayToSort[i].stamina].rank = i + 1;        
    }
    
    if (formId >= 0) {
        if (!pokemon[pokemonId].forms) {
            pokemon[pokemonId].forms = {};
        }
        pokemon[pokemonId].forms[formId] = currentPokemon;
    } else {
        pokemon[pokemonId] = currentPokemon;  
    }
    return currentPokemon;
}

function calculateBestPvPStat(pokemonId, formId, attack, defense, stamina, cap) {
    let bestStat = 0;
    let level = 0;
    let bestCP = 0;
    for (let i = 1; i <= 40; i += 0.5) {
        let cp = calculateCP(pokemonId, formId, attack, defense, stamina, i);
        if(cp <= cap) {
            let stat = calculatePvPStat(pokemonId, formId, i, attack, defense, stamina);
            if (stat > bestStat) {
                bestStat = stat;
                level = i;   
                bestCP = cp;
            }
        }
    }
    return { value: bestStat, level: level, cp: bestCP };
}

function calculatePvPStat(pokemonId, formId, level, attack, defense, stamina) {
    let pokemonAttack = (formId >= 0 && pokemonObject[pokemonId].forms[formId].attack) ? pokemonObject[pokemonId].forms[formId].attack : pokemonObject[pokemonId].attack;
    let pokemonDefense = (formId >= 0 && pokemonObject[pokemonId].forms[formId].defense) ? pokemonObject[pokemonId].forms[formId].defense : pokemonObject[pokemonId].defense;
    let pokemonStamina = (formId >= 0 && pokemonObject[pokemonId].forms[formId].stamina) ? pokemonObject[pokemonId].forms[formId].stamina : pokemonObject[pokemonId].stamina;

    attack = (attack + pokemonAttack) * cpMultiplier[level];
    defense = (defense + pokemonDefense) * cpMultiplier[level];
    stamina = (stamina + pokemonStamina) * cpMultiplier[level];

    return Math.round(attack * defense * Math.floor(stamina));
}

function calculateCP(pokemonId, formId, attack , defense, stamina, level) {
    let cp = 0;
    let multiplier = cpMultiplier[level];
  
    let pokemonAttack = (formId >= 0 && pokemonObject[pokemonId].forms[formId].attack) ? pokemonObject[pokemonId].forms[formId].attack : pokemonObject[pokemonId].attack;
    let pokemonDefense = (formId >= 0 && pokemonObject[pokemonId].forms[formId].defense) ? pokemonObject[pokemonId].forms[formId].defense : pokemonObject[pokemonId].defense;
    let pokemonStamina = (formId >= 0 && pokemonObject[pokemonId].forms[formId].stamina) ? pokemonObject[pokemonId].forms[formId].stamina : pokemonObject[pokemonId].stamina;

    let attackMultiplier = pokemonAttack + parseInt(attack);
    let defenseMultiplier = Math.pow(pokemonDefense + parseInt(defense), 0.5);
    let staminaMultiplier = Math.pow(pokemonStamina + parseInt(stamina), 0.5);

    multiplier = Math.pow(multiplier, 2);
    cp = Math.floor((attackMultiplier * defenseMultiplier * staminaMultiplier * multiplier) / 10);
    return cp < 10 ? 10 : cp;
}

function initializeBlankPokemon() {
    let newPokemon = {};
    for (let a = 0; a <= 15; a++) {
        newPokemon[a] = {};
        for (let d = 0; d <= 15; d++) {
            newPokemon[a][d] = {};
            for (let s = 0; s <= 15; s++) {
                newPokemon[a][d][s] = {};
            }
        }
    }
    return newPokemon;
}

function precisionRound(number, precision) 
{
    var factor = Math.pow(10, precision);
    return Math.round(number * factor) / factor;
}

async function writePvPData(data, tableName) {
    return await new Promise(async function(resolve) {
        let connection = mysql.createConnection(redisOptions);
        connection.connect(async function(error) {
            if(error) {
                console.log('[PvP] Error connecting to SQL:', error.stack);
                connection.end(function(err) {});
                return resolve(false);
            }

            await createTable(connection, tableName);
            for (let pokemon in data) {
                if (data[pokemon].forms) {
                    for(let form in data[pokemon].forms) {
                        console.log('[PvP] Inserting pokemon_id', pokemon, 'with form_id', form);
                        let currentPokemon = data[pokemon].forms[form];
                        await insertCurrentPokemon(connection, tableName, parseInt(pokemon), parseInt(form), currentPokemon);
                    }
                } else {
                    console.log('[PvP] Inserting pokemon_id', pokemon, 'with no form');
                    let currentPokemon = data[pokemon];
                    await insertCurrentPokemon(connection, tableName, parseInt(pokemon), 0, currentPokemon);
                }
            }
            connection.end(function(err) {
                return resolve(true);
            });
        });
    });
}

async function createTable(connection, tableName) {
    return await new Promise(async function(resolve) {
        let sql = `
		CREATE TABLE IF NOT EXISTS ${tableName} (
			pokemon_id smallint(6) unsigned NOT NULL,
			form smallint(6) unsigned DEFAULT 0,
			attack tinyint(2) unsigned DEFAULT 0,
			defense tinyint(2) unsigned DEFAULT 0,
			stamina tinyint(2) unsigned DEFAULT 0,
			cp smallint(4) UNSIGNED DEFAULT 0,
			level DOUBLE(3,1) UNSIGNED DEFAULT 0,
			rank smallint(4) UNSIGNED DEFAULT 0,
			percent DOUBLE(5, 2) UNSIGNED DEFAULT 0,
			value mediumint(8) UNSIGNED DEFAULT 0,
			PRIMARY KEY(pokemon_id, form, attack, defense, stamina)
		)
		`;
        let pause = sql;
        connection.query(sql, function(error,results) {
            if(error) {
				throw error;
			}
            console.log('[PvP] Table created if needed:', tableName);
            connection.query(`TRUNCATE ${tableName};`, async function(error, results) {
                if(error) {
					throw error;
				}
                console.log('[PvP] Table truncated:', tableName);
                return resolve(true);
            });
        });        
    });
}

async function insertCurrentPokemon(connection, tableName, pokemonId, formId, pokemon) {
    return await new Promise(async function(resolve) {
        let sql = `INSERT INTO ${tableName} (pokemon_id, form, attack, defense, stamina, cp, level, percent, rank, value) VALUES`;
        for (let attack in pokemon) {
            for (let defense in pokemon[attack]) {
                for (let stamina in pokemon[attack][defense]) {
                    let currentValue = pokemon[attack][defense][stamina];
                    sql += `(${pokemonId},${formId},${parseInt(attack)},${parseInt(defense)},${parseInt(stamina)},${currentValue.cp},${currentValue.level},${currentValue.percent},${currentValue.rank},${currentValue.value}),`;
                    //finished.push(WritePokemonRow(connection, tableName, pokemonId, formId, parseInt(attack), parseInt(defense), parseInt(stamina), currentValue.CP, currentValue.level, currentValue.percent, currentValue.rank, currentValue.value));
                }
            }
        }

        sql = sql.slice(0,-1);
        connection.query(sql, async function(error, results) {
            if(error) {
				throw error;
			}
            return resolve(true);
        });
    });
}