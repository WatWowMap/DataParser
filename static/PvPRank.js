'use strict';

const config = require('../src/config.json');
const baseStats = require('./masterfile.json');
const cpMultiplier = require('./cp_multiplier.json');

//const fs = require('fs-extra');
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

let pokemon = {};
let pokemonObject = baseStats.pokemon;


const calculateAllRanks = async () => {
    for (let pokemonId in pokemonObject) {
        if (pokemonObject[pokemonId].attack) {
            calculateTopRanks(pokemonId, -1, 1500);
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


    for (let pokemonId in pokemonObject) {
        if (pokemonObject[pokemonId].attack) {
            calculateTopRanks(pokemonId, -1, 2500);
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
};

const calculateTopRanks = (pokemonId, formId, cap) => {
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
};

const calculateBestPvPStat = (pokemonId, formId, attack, defense, stamina, cap) => {
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
};

const calculatePvPStat = (pokemonId, formId, level, attack, defense, stamina) => {
    let pokemonAttack = (formId >= 0 && pokemonObject[pokemonId].forms[formId].attack) ? pokemonObject[pokemonId].forms[formId].attack : pokemonObject[pokemonId].attack;
    let pokemonDefense = (formId >= 0 && pokemonObject[pokemonId].forms[formId].defense) ? pokemonObject[pokemonId].forms[formId].defense : pokemonObject[pokemonId].defense;
    let pokemonStamina = (formId >= 0 && pokemonObject[pokemonId].forms[formId].stamina) ? pokemonObject[pokemonId].forms[formId].stamina : pokemonObject[pokemonId].stamina;

    attack = (attack + pokemonAttack) * cpMultiplier[level];
    defense = (defense + pokemonDefense) * cpMultiplier[level];
    stamina = (stamina + pokemonStamina) * cpMultiplier[level];

    return Math.round(attack * defense * Math.floor(stamina));
};

const calculateCP = (pokemonId, formId, attack , defense, stamina, level) => {
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
};

const initializeBlankPokemon = () => {
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
};

const precisionRound = (number, precision) => {
    let factor = Math.pow(10, precision);
    return Math.round(number * factor) / factor;
};

const writePvPData = async (data, league) => {
    for (let pokemon in data) {
        if (data[pokemon].forms) {
            for (let form in data[pokemon].forms) {
                console.log('[PvP] Inserting pokemon_id', pokemon, 'with form_id', form);
                let currentPokemon = data[pokemon].forms[form];
                await insertCurrentPokemon(league, parseInt(pokemon), parseInt(form), currentPokemon);
            }
        } else {
            console.log('[PvP] Inserting pokemon_id', pokemon, 'with no form');
            let currentPokemon = data[pokemon];
            await insertCurrentPokemon(league, parseInt(pokemon), 0, currentPokemon);
        }
    }
};

const insertCurrentPokemon = async (league, pokemonId, formId, pokemon) => {
    return await new Promise(async (resolve) => {
        for (let attack in pokemon) {
            for (let defense in pokemon[attack]) {
                for (let stamina in pokemon[attack][defense]) {
                    let currentValue = pokemon[attack][defense][stamina];
                    let value = {
                        pokemon_id: pokemonId,
                        form_id: formId,
                        attack: stamina,
                        defense: defense,
                        stamina: attack,
                        cp: currentValue.cp,
                        level: currentValue.level,
                        percent: currentValue.percent,
                        rank: currentValue.rank,
                        value: currentValue.value
                    };
                    client.hset(league, `${pokemonId}-${formId}-${attack}-${defense}-${stamina}`, JSON.stringify(value), (err, reply) => {
                        if (err) {
                            console.error('[Redis] Error:', err);
                            return;
                        }
                        //console.log('[Redis] Reply:', reply);
                    });
                    resolve(null);
                }
            }
        }
    });
};

calculateAllRanks();