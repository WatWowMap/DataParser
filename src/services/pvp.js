'use strict';

const axios = require('axios');
const POGOProtos = require('pogo-protos');

const League = {
    Great: 1500,
    Ultra: 2500
};

const cpMultipliers = {
	"1": 0.09399999678134918,
	"1.5": 0.13513743132352830,
	"2": 0.16639786958694458,
	"2.5": 0.19265091419219970,
	"3": 0.21573247015476227,
	"3.5": 0.23657265305519104,
	"4": 0.25572004914283750,
	"4.5": 0.27353037893772125,
	"5": 0.29024988412857056,
	"5.5": 0.30605737864971160,
	"6": 0.32108759880065920,
	"6.5": 0.33544503152370453,
	"7": 0.34921267628669740,
	"7.5": 0.36245773732662200,
	"8": 0.37523558735847473,
	"8.5": 0.38759241108516856,
	"9": 0.39956727623939514,
	"9.5": 0.41119354951725060,
	"10": 0.4225000143051148,
	"10.5": 0.4329264134104144,
	"11": 0.4431075453758240,
	"11.5": 0.4530599538719858,
	"12": 0.4627983868122100,
	"12.5": 0.4723360780626535,
	"13": 0.4816849529743195,
	"13.5": 0.4908558102324605,
	"14": 0.4998584389686584,
	"14.5": 0.5087017565965652,
	"15": 0.5173939466476440,
	"15.5": 0.5259425118565559,
	"16": 0.5343543291091919,
	"16.5": 0.5426357612013817,
	"17": 0.5507926940917969,
	"17.5": 0.5588305993005633,
	"18": 0.5667545199394226,
	"18.5": 0.5745691470801830,
	"19": 0.5822789072990417,
	"19.5": 0.5898879119195044,
	"20": 0.5974000096321106,
	"20.5": 0.6048236563801765,
	"21": 0.6121572852134705,
	"21.5": 0.6194041110575199,
	"22": 0.6265671253204346,
	"22.5": 0.6336491815745830,
	"23": 0.6406529545783997,
	"23.5": 0.6475809663534164,
	"24": 0.6544356346130370,
	"24.5": 0.6612192690372467,
	"25": 0.6679340004920960,
	"25.5": 0.6745819002389908,
	"26": 0.6811649203300476,
	"26.5": 0.6876849085092545,
	"27": 0.6941436529159546,
	"27.5": 0.7005428969860077,
	"28": 0.7068842053413391,
	"28.5": 0.7131690979003906,
	"29": 0.7193990945816040,
	"29.5": 0.7255756109952927,
	"30": 0.7317000031471252,
	"30.5": 0.7347410172224045,
	"31": 0.7377694845199585,
	"31.5": 0.7407855764031410,
	"32": 0.7437894344329834,
	"32.5": 0.7467812150716782,
	"33": 0.7497610449790955,
	"33.5": 0.7527291029691696,
	"34": 0.7556855082511902,
	"34.5": 0.7586303651332855,
	"35": 0.7615638375282288,
	"35.5": 0.7644860669970512,
	"36": 0.7673971652984619,
	"36.5": 0.7702972739934921,
	"37": 0.7731865048408508,
	"37.5": 0.7760649472475052,
	"38": 0.7789327502250671,
	"38.5": 0.78179006,
	"39": 0.78463697,
	"39.5": 0.78747358,
	"40": 0.79030001
};

class PvPStatsManager {

    static instance = new PvPStatsManager();

    constructor() {
        this.stats = [];
        this.rankingGreat = {};
        this.rankingUltra = {};
        this.eTag = null;
        this.loadMasterFile()
    }

    loadMasterFile() {
        console.debug('[PVPStatsManager] Loading game master file');
        axios.get('https://raw.githubusercontent.com/pokemongo-dev-contrib/' +
                  'pokemongo-game-master/master/versions/latest/GAME_MASTER.json',
        ).then(resp => {
            //eTag = result.get(eTag);
            console.debug('[PVPStatsManager] Parsing game master file');
            let templates = resp.data['itemTemplate'];
            if (!templates) {
                console.error('[PVPStatsManager] Failed to parse game master file');
                return;
            }
            let stats = {};//[PokemonWithForm: Stats]();
            for (let i = 0; i < templates.length; i++) {
                let template = templates[i];
                let id = template['templateId'];
                if (!id) {
                    return;
                }
                if (id && id[0] === 'V' && id.includes('_POKEMON_')) {
                    let pokemonInfo = template['pokemon'];
                    if (!pokemonInfo) {
                        continue;
                    }
                    let pokemonName = pokemonInfo['uniqueId'];
                    let statsInfo = pokemonInfo['stats'];
                    let baseStamina = parseInt(statsInfo['baseStamina']);
                    let baseAttack = parseInt(statsInfo['baseAttack']);
                    let baseDefense = parseInt(statsInfo['baseDefense']);
                    let pokemon = this.pokemonFrom(pokemonName);
                    if (!pokemon) {
                        console.warn(`[PVPStatsManager] Failed to get pokemon for: ${pokemonName}`);
                        return
                    }
                    let formName = pokemonInfo['form'];
                    let form = null;//: POGOProtos_Enums_Form?
                    if (formName) {
                        let formT = this.formFrom(formName);
                        if (!formT) {
                            console.warn(`[PVPStatsManager] Failed to get form for: ${formName}`);
                            return;
                        }
                        form = formT;
                    }
                    var evolutions = []; //PokemonWithForm
                    let evolutionsInfo = pokemonInfo['evolutionBranch'] || [];// as? [[String: Any]] ?? []
                    for (let j = 0; j < evolutionsInfo.length; j++) {
                        let info = evolutionsInfo[j];
                        let pokemonName = info['evolution'];
                        let pokemon = this.pokemonFrom(pokemonName);
                        if (pokemonName && pokemon) {
                            let formName = info['form'];
                            let form = formName ? this.formFrom(formName) : null;
                            evolutions.push(new PokemonWithForm(pokemon, form));
                        }
                    }
                    let stat = new Stats(baseAttack, baseDefense, baseStamina, evolutions);
                    stats[new PokemonWithForm(pokemon, form)] = stat;
                }
            }
            this.stats = stats;
            this.rankingGreat = {};//[:]
            this.rankingUltra = {};//[:]
            console.debug('[PVPStatsManager] Done parsing game master file');
        }).catch(err => {
            console.error('[PVPStatsManager] Failed to load game master file:', err);
            return;
        });
    }

    getPVPStats(pokemon, form, iv, level, league) {
        let stats = this.getTopPVP(pokemon, form, league);
        if (!stats || stats.length === 0) {
            return null;
        }
        let index = stats.findIndex(value => {
            for (let ivlevel in value.ivs) {
                if (ivlevel.iv === iv && ivlevel.level >= level) {
                    return true;
                }
            }
            return false;
        });
        if (!index) {
            return null;
        }
        let max = parseFloat(stats[0].rank);
        let result = stats[index];
        let value = parseFloat(result.rank);
        let ivs = [];//[Response.IVWithCP];
        let currentIV = result.iv.find(value => value.iv === iv);
        if (currentIV) {
            ivs = [currentIV];
        } else {
            ivs = [];
        }
        return new Response(index + 1, value / max, ivs);
    }

    getPVPStatsWithEvolutions(pokemon, form, costume, iv, level, league) {
        let current = this.getPVPStats(pokemon, form, iv, level, league);
        let pokemonWithForm = new PokemonWithForm(pokemon, form);
        let result = [{ pokemonWithForm, current }];//[(pokemon: pokemonWithForm, response: current)]
        let stat = this.stats[pokemonWithForm];
        if (!stat) {
            // TODO: 
            return null;
        }
        if ((costume || '').toLowerCase().includes('noevolve') || stat.evolutions.length === 0) {
            return result
        }
        for (let evolution in stat.evolutions) {
            let pvpStats = this.getPVPStatsWithEvolutions(evolution.pokemon, evolution.form, costume, iv, level, league);
            result.push(pvpStats);
        }
        return result;
    }

    getTopPVP(pokemon, form, league) {
        let info = new PokemonWithForm(pokemon, form);
        let cached;//: ResponsesOrEvent;
        switch (league) {
            case League.Great:
                cached = this.rankingGreat[info];
                break;
            case League.Ultra:
                cached = this.rankingUltra[info];
                break;
        }

        if (!cached) {
            let stats = this.stats[info];
            if (!stats) {
                return null;
            }
            let values = this.getPVPValuesOrdered(stats, parseInt(league));
            switch (league) {
                case League.Great:
                    this.rankingGreat[info] = values;
                    break;
                case League.Ultra:
                    this.rankingUltra[info] = values;
                    break;
            }

            return values;
        }
        return cached ? cached : this.getTopPVP(pokemon, form, league);
    }

    getPVPValuesOrdered(stats, cap) {
        let ranking = {};//[Int: Response]()
        for (let iv in IV.all) {
            let maxLevel = 0
            let maxCP = 0
            for (let i = 0; i < 40; i += 0.5) {
                const level = i;
                let cp = cap ? getCPValue(iv, level, stats) : 0;
                if (cp <= (cap || 0)) {
                    maxLevel = level;
                    maxCP = cp;
                    break;
                }
            }
            if (maxLevel > 0) {
                let value = getPVPValue(iv, maxLevel, stats);
                if (!ranking[value]) {
                    ranking[value] = new Response(value, 0.0, []);
                } else {
                    ranking[value].ivs.push(new Response(iv, maxLevel, maxCP));
                }
            }
        }
        //ranking.sort((x, y) => x >= y);
        return Object.values(ranking).map(x => x.value);
        /*
        return ranking.sorted { (lhs, rhs) -> Bool in
            return lhs.key >= rhs.key;
        }.map { (value) -> Response in
            return value.value;
        }
        */
    }

    getPVPValue(iv, level, stats) {
        let mutliplier = cpMultipliers[level] || 0;
        let attack = parseFloat(iv.attack + stats.baseAttack) * mutliplier;
        let defense = parseFloat(iv.defense + stats.baseDefense) * mutliplier;
        let stamina = parseFloat(iv.stamina + stats.baseStamina) * mutliplier;
        return parseInt(Math.round(attack * defense * Math.floor(stamina)));
    }

    getCPValue(iv, level, stats) {
        let attack = parseFloat(stats.baseAttack + iv.attack);
        let defense = Math.pow(parseFloat(stats.baseDefense + iv.defense), 0.5);
        let stamina =  Math.pow(parseFloat(stats.baseStamina + iv.stamina), 0.5);
        let multiplier = Math.pow((cpMultipliers[level] || 0), 2);
        return Math.max(parseInt(Math.floor(attack * defense * stamina * multiplier / 10)), 10);
    }

    formFrom(name) {
        const keys = Object.keys(POGOProtos.Enums.Form);
        const found = keys.find(value => value.toLowerCase() === name.toLowerCase());
        return found;
    }

    pokemonFrom(name) {
        const keys = Object.keys(POGOProtos.Enums.PokemonId);
        const found = keys.find(value => value.toLowerCase() === name.toLowerCase());
        return found;
    }
}

class PokemonWithForm {
    constructor(pokemonId, form) {
        this.pokemonId = pokemonId;
        this.form = form;
    }
}

class Stats {
    constructor(baseAtk, baseDef, baseSta, evolutions) {
        this.baseAtk = baseAtk;
        this.baseDef = baseDef;
        this.baseSta = baseSta;
        this.evolutions = evolutions;
    }
}

class IV {

    constructor(atk, def, sta) {
        this.attack = atk;
        this.defense = def;
        this.stamina = sta;
    }

    getAll() {
        let all = [];
        for (let atk = 0; atk <= 15; atk++) {
            for (let def = 0; def <= 15; def++) {
                for (let sta = 0; sta <= 15; sta++) {
                    all.push(new IV(atk, def, sta));
                }
            }
        }
        return all;
    }
}

class Response {
    constructor(rank, percentage, ivs) {
        this.rank = rank;
        this.percentage = percentage;
        this.ivs = ivs;
    }
}

class IVWithCP { // PvPRank
    constructor(iv, level, cp) {
        this.iv = iv;
        this.level = level;
        this.cp = cp;
    }
}

module.exports = { PvPStatsManager, IV, Response, IVWithCP, League };