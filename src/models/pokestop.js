'use strict';

const POGOProtos = require('pogo-protos');

const config = require('../config.json');
const MySQLConnector = require('../services/mysql.js');
const WebhookController = require('../services/webhook.js');
const db = new MySQLConnector(config.db);

const QuestReward = {
    Unset: 0,
    Experience: 1,
    Item: 2,
    Stardust: 3,
    Candy: 4,
    AvatarClothing: 5,
    Quest: 6,
    PokemonEncounter: 7,
    Pokecoin: 8,
    Sticker: 11,
    MegaResource: 12,
};

const ConditionType = {
    Unset: 0,
    PokemonType: 1,
    PokemonCategory: 2,
    WeatherBoost: 3,
    DailyCaptureBonus: 4,
    DailySpinBonus: 5,
    WinRaidStatus: 6,
    RaidLevel: 7,
    ThrowType: 8,
    WinGymBattleStatus: 9,
    SuperEffectiveCharge: 10,
    Item: 11,
    UniquePokestop: 12,
    QuestContext: 13,
    ThrowTypeInARow: 14,
    CurveBall: 15,
    BadgeType: 16,
    PlayerLevel: 17,
    WinBattleStatus: 18,
    NewFriend: 19,
    DaysInARow: 20,
    UniquePokemon: 21,
    NpcCombat: 22,
    PvpCombat: 23,
    Location: 24,
    Distance: 25,
    PokemonAlignment: 26,
    InvasionCharacter: 27,
    Buddy: 28,
    BuddyInterestingPoi: 29,
    DailyBuddyAffection: 30
};

/**
 * Pokestop model class.
 */
class Pokestop {
    static LureTime = 1800;

    /**
     * Initialize new Pokestop object.
     * @param data 
     */
    constructor(data) {
        if (data.fort) {
            let ts = new Date().getTime() / 1000;
            this.id = data.fort.id;
            this.lat = data.fort.latitude;
            this.lon = data.fort.longitude;
            this.name = null;
            if (data.fort.sponsor > 0) {
                this.sponsorId = data.fort.sponsor;
            } else {
                this.sponsorId = null;
            }
            this.enabled = data.fort.enabled;
            let lastModifiedTimestamp = data.fort.last_modified_timestamp_ms / 1000;
            if (data.fort.active_fort_modifier && data.fort.active_fort_modifier.length > 0) {
                if (data.fort.active_fort_modifier.includes(POGOProtos.Inventory.Item.ItemId.ITEM_TROY_DISK) ||
                    data.fort.active_fort_modifier.includes(POGOProtos.Inventory.Item.ItemId.ITEM_TROY_DISK_GLACIAL) ||
                    data.fort.active_fort_modifier.includes(POGOProtos.Inventory.Item.ItemId.ITEM_TROY_DISK_MAGNETIC) ||
                    data.fort.active_fort_modifier.includes(POGOProtos.Inventory.Item.ItemId.ITEM_TROY_DISK_MOSSY)) {
                    this.lureExpireTimestamp = lastModifiedTimestamp + Pokestop.LureTime;
                    this.lureId = data.fort.active_fort_modifier[0];
                }
            } else {
                this.lureExpireTimestamp = null;
                this.lureId = null;
            }
            this.lastModifiedTimestamp = lastModifiedTimestamp;
            if (data.fort.image_url) {
                this.url = data.fort.image_url;
            } else {
                this.url = null;
            }
            if (data.fort.pokestop_display) {
                this.incidentExpireTimestamp = data.fort.pokestop_display.incident_expiration_ms / 1000;
                if (data.fort.pokestop_display.character_display) {
                    this.pokestopDisplay = data.fort.pokestop_display.character_display.style;
                    this.gruntType = data.fort.pokestop_display.character_display.character;
                }
            } else if (data.fort.pokestop_displays && data.fort.pokestop_displays.length > 0) {
                this.incidentExpireTimestamp = data.fort.pokestop_displays[0].incident_expiration_ms / 1000;
                if (data.fort.pokestop_displays[0].character_display) {
                    this.pokestopDisplay = data.fort.pokestop_displays[0].character_display.style;
                    this.gruntType = data.fort.pokestop_displays[0].character_display.character;
                }
            } else {
                this.pokestopDisplay = null;
                this.incidentExpireTimestamp = null;
                this.gruntType = null;
            }
            this.questType = null;
            this.questTarget = null;
            this.questTimestamp = null;
            this.questConditions = null;
            this.questRewards = null;
            this.questTemplate = null;
            this.questPokemonId = null;
            this.questRewardType = null;
            this.questItemId = null;
            this.cellId = data.cellId;
            this.firstSeenTimestamp = ts;
            this.updated = ts;
            this.deleted = false;
        } else {
            this.id = data.id;
            this.lat = data.lat;
            this.lon = data.lon;
            this.name = data.name || null;
            this.url = data.url || null;
            this.enabled = data.enabled || 0;
            this.lureExpireTimestamp = data.lure_expire_timestamp || null;
            this.lastModifiedTimestamp = data.last_modified_timestamp || null;
            this.updated = data.updated || 0;
            
            this.questType = data.quest_type || null;
            this.questTarget = data.quest_target || null;
            this.questTimestamp = data.quest_timestamp || null;
            this.questConditions = data.quest_conditions || null;
            this.questRewards = data.quest_rewards || null;
            this.questTemplate = data.quest_template || null;
    
            this.cellId = data.cell_id;
            this.lureId = data.lure_id || 0;
            this.pokestopDisplay = data.pokestop_display || null;
            this.incidentExpireTimestamp = data.incident_expire_timestamp || null;
            this.gruntType = data.grunt_type || null;
            this.sponsorId = data.sponsor_id || null;
            this.firstSeenTimestamp = data.first_seen_timestamp || null;
            this.deleted = data.deleted || 0;
        }
    }

    /**
     * Get Pokestop by Pokestop id.
     * @param encounterId 
     */
    static async getById(id) {
        let sql = `
        SELECT id, lat, lon, name, url, lure_expire_timestamp, last_modified_timestamp, updated,
        enabled, quest_type, quest_timestamp, quest_target, quest_conditions, quest_rewards,
        quest_template, cell_id, deleted, lure_id, pokestop_display, incident_expire_timestamp,
        first_seen_timestamp, grunt_type, sponsor_id
        FROM pokestop
        WHERE id = ?
        `;
        let args = [id];
        let results = await db.query(sql, args);
        if (results && results.length) {
            let result = results[0];
            let pokestop = new Pokestop(result);
            return pokestop;
        }
        return null;
    }

    /**
     * Update Pokestop values if changed from already found Pokestop
     */
    async update(updateQuest) {
        let oldPokestop;
        try {
            oldPokestop = await Pokestop.getById(this.id);
        } catch {
            oldPokestop = null;
        }
        this.updated = new Date().getTime() / 1000;
        
        if (!oldPokestop) {
            WebhookController.instance.addPokestopEvent(this.toJson('pokestop'));
            if ((this.lureExpireTimestamp || 0) > 0) {
                WebhookController.instance.addLureEvent(this.toJson('lure'));
            }
            if ((this.questTimestamp || 0) > 0) {
                WebhookController.instance.addQuestEvent(this.toJson('quest'));
            }
            if ((this.incidentExpireTimestamp || 0) > 0) {
                WebhookController.instance.addInvasionEvent(this.toJson('invasion'));
            }
        } else {
            if (oldPokestop.cellId && !this.cellId) {
                this.cellId = oldPokestop.cellId;
            }
            if (oldPokestop.name && !this.name) {
                this.name = oldPokestop.name;
            }
            if (oldPokestop.url && !this.url) {
                this.url = oldPokestop.url;
            }
            if (updateQuest && oldPokestop.questType && this.questType) {
                this.questType = oldPokestop.questType;
                this.questTarget = oldPokestop.questTarget;
                this.questConditions = oldPokestop.questConditions;
                this.questRewards = oldPokestop.questRewards;
                this.questTimestamp = oldPokestop.questTimestamp;
                this.questTemplate = oldPokestop.questTemplate;
            }
            if (oldPokestop.lureId && !this.lureId) {
                this.lureId = oldPokestop.lureId;
            }
            if ((oldPokestop.lureExpireTimestamp || 0) < (this.lureExpireTimestamp || 0)) {
                WebhookController.instance.addLureEvent(this.toJson('lure'));
            }
            if ((oldPokestop.incidentExpireTimestamp || 0) < (this.incidentExpireTimestamp || 0)) {
                WebhookController.instance.addInvasionEvent(this.toJson('invasion'));
            }
            if (updateQuest && (this.questTimestamp || 0) > (oldPokestop.questTimestamp || 0)) {
                WebhookController.instance.addQuestEvent(this.toJson('quest'));
            }
        }
    }

        /**
     * Add quest proto data to pokestop.
     * @param quest 
     */
    addQuest(quest) {
        this.questType = parseInt(quest.quest_type);
        this.questTarget = parseInt(quest.goal.target);
        this.questTemplate = quest.template_id.toLowerCase();
        
        let ts = new Date().getTime() / 1000;
        let conditions = [];
        let rewards = [];
        for (let i = 0; i < quest.goal.condition.length; i++) {
            let condition = quest.goal.condition[i];
            let conditionData = {};
            let infoData = {};
            conditionData['type'] = condition.type;
            // TODO: Needs testing
            let info = condition;
            switch (condition.type) {
                case ConditionType.BadgeType:
                    infoData['amount'] = info.badge_type.amount;
                    infoData['badge_rank'] = info.badge_rank;
                    let badgeTypesById = [];
                    info.badge_type.forEach(badge => badgeTypesById.push(badge));
                    infoData['badge_types'] = badgeTypesById;
                    break;
                case ConditionType.Item:
                    if (info.item !== 0) {
                        infoData['item_id'] = info.item;
                    }
                    break;
                case ConditionType.RaidLevel:
                    let raidLevelById = [];
                    info.with_raid_level.raid_level.forEach(raidLevel => raidLevelById.push(raidLevel));
                    infoData['raid_levels'] = raidLevelById;
                    break;
                case ConditionType.PokemonType:
                    let pokemonTypesById = [];
                    info.with_pokemon_type.pokemon_type.forEach(type => pokemonTypesById.push(type));
                    infoData['pokemon_type_ids'] = pokemonTypesById;
                    break;
                case ConditionType.PokemonCategory:
                    if (info.with_pokemon_category.category_name) {
                        infoData['category_name'] = info.with_pokemon_category.category_name; // TODO: Does with_pokemon_category.category_name exist?
                    }
                    if (info.with_pokemon_category.pokemon_ids) {
                        infoData['pokemon_ids'] = info.with_pokemon_category.pokemon_ids;
                    }
                    break;
                case ConditionType.WinRaidStatus:
                    break;
                case ConditionType.ThrowType:
                    if (info.with_throw_type.throw_type > 0) {
                        infoData['throw_type_id'] = info.with_throw_type.throw_type;
                    }
                    break;
                case ConditionType.ThrowTypeInARow:
                    if (info.with_throw_type.throw_type > 0) {
                        infoData['throw_type_id'] = info.with_throw_type.throw_type;
                    }
                    break;
                case ConditionType.Location:
                    infoData['cell_ids'] = info.s2_cell_id;
                    break;
                case ConditionType.Distance:
                    infoData['distance'] = info.distance_km;
                    break;
                case ConditionType.PokemonAlignment:
                    infoData['alignment_ids'] = info.pokemon_alignment.alignment.map(x => parseInt(x));
                    break;
                case ConditionType.InvasionCharacter:
                    infoData['character_category_ids'] = info.with_invasion_character.category.map(x => parseInt(x));
                    break;
                case ConditionType.NpcCombat:
                    infoData['win'] = info.with_npc_combat.requires_win || false; // TODO: requires_win exists?
                    infoData['trainer_ids'] = info.with_npc_combat.combat_npc_trainer_id;
                    break;
                case ConditionType.PvpCombat:
                    infoData['win'] = info.with_pvp_combat.requires_win || false; // TODO: requires_win exists?
                    infoData['trainer_ids'] = info.with_pvp_combat.combat_league_template_id;
                    break;
                case ConditionType.Buddy:
                    if (info.with_buddy) {
                        infoData['min_buddy_level'] = info.with_buddy.min_buddy_level; // TODO: with_buddy? is Condition
                        infoData['must_be_on_map'] = info.with_buddy.must_be_on_map;
                    }
                    break;
                case ConditionType.DailyBuddyAffection:
                    infoData['min_buddy_affection_earned_today'] = info.daily_buddy_affection.min_buddy_affection_earned_today;
                    break;
                case ConditionType.WinGymBattleStatus: break;
                case ConditionType.SuperEffectiveCharge: break;
                case ConditionType.UniquePokestop: break;
                case ConditionType.QuestContext: break;
                case ConditionType.WinBattleStatus: break;
                case ConditionType.CurveBall: break;
                case ConditionType.NewFriend: break;
                case ConditionType.DaysInARow: break;
                case ConditionType.WeatherBoost: break;
                case ConditionType.DailyCaptureBonus: break;
                case ConditionType.DailySpinBonus: break;
                case ConditionType.UniquePokemon: break;
                case ConditionType.BuddyInterestingPoi: break;
                case ConditionType.Unset: break;
            }
            if (infoData) {
                conditionData['info'] = infoData;
            }
            conditions.push(conditionData);
        }
        for (let i = 0; i < quest.quest_rewards.length; i++) {
            let reward = quest.quest_rewards[i];
            let rewardData = {};
            let infoData = {};
            rewardData['type'] = reward.type;
            switch (reward.type) {
                case QuestReward.AvatarClothing:
                    break;
                case QuestReward.Candy:
                    infoData['amount'] = reward.amount;
                    infoData['pokemon_id'] = reward.pokemon_id;
                    break;
                case QuestReward.Experience:
                    infoData['amount'] = reward.exp;
                    break;
                case QuestReward.Item:
                    infoData['amount'] = reward.item.amount;
                    infoData['item_id'] = reward.item.item;
                    break;
                case QuestReward.PokemonEncounter:
                    if (reward.pokemon_encounter.is_hidden_ditto) {
                        infoData['pokemon_id'] = 132;
                        infoData['pokemon_id_display'] = reward.pokemon_encounter.pokemon_id;
                    } else {
                        infoData['pokemon_id'] = reward.pokemon_encounter.pokemon_id;
                    }
                    if (reward.pokemon_encounter.pokemon_display) {
                        infoData['costume_id'] = reward.pokemon_encounter.pokemon_display.costume || 0;
                        infoData['form_id'] = reward.pokemon_encounter.pokemon_display.form || 0;
                        infoData['gender_id'] = reward.pokemon_encounter.pokemon_display.gender || 0;
                        infoData['shiny'] = reward.pokemon_encounter.pokemon_display.shiny || false;
                    }
                    break;
                case QuestReward.Quest:
                    break;
                case QuestReward.Stardust:
                    infoData['amount'] = reward.stardust;
                    break;
                case QuestReward.MegaResource:
                    infoData['amount'] = reward.amount;
                    infoData['pokemon_id'] = reward.pokemon_id;
                    break;
                case QuestReward.Unset:
                    break;
                default:
                    console.warn('Unrecognized reward.type', reward.type);
                    break;
            }
            rewardData['info'] = infoData;
            rewards.push(rewardData);
        }
        this.questConditions = conditions;
        this.questRewards = rewards;
        this.questTimestamp = ts;
    }

    /**
     * Get Pokestop object as sql string
     */
    toSql(type) {
        switch (type) {
            case 'quest':
                return {
                    sql: `
                    (
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?
                    )
                    `,
                    args: [
                        this.id.toString(),
                        this.lat,
                        this.lon,
                        this.name,
                        this.url,
                        this.lureExpireTimestamp,
                        this.lastModifiedTimestamp,
                        this.updated,
                        this.enabled,
                        this.questType,
                        this.questTimestamp,
                        this.questTarget,
                        JSON.stringify(this.questConditions),
                        JSON.stringify(this.questRewards),
                        this.questTemplate,
                        this.cellId.toString(),
                        this.deleted,
                        this.lureId,
                        this.pokestopDisplay,
                        this.incidentExpireTimestamp,
                        this.firstSeenTimestamp,
                        this.gruntType,
                        this.sponsorId
                    ]
                };
            default:
                return {
                    sql: `
                    (
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,

                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?
                    )
                    `,
                    args: [
                        this.id.toString(),
                        this.lat,
                        this.lon,
                        this.name,
                        this.url,
                        this.lureExpireTimestamp,
                        this.lastModifiedTimestamp,
                        this.updated,
                        this.enabled,

                        this.cellId.toString(),
                        this.deleted,
                        this.lureId,
                        this.pokestopDisplay,
                        this.incidentExpireTimestamp,
                        this.firstSeenTimestamp,
                        this.gruntType,
                        this.sponsorId
                    ]
                };
        }
    }

    /**
     * Get Pokestop object as JSON object with correct property keys for webhook payload
     * @param {*} type 
     */
    toJson(type) {
        switch (type) {
            case "quest": // Quest
                return {
                    type: "quest",
                    message: {
                        pokestop_id: this.id,
                        latitude: this.lat,
                        longitude: this.lon,
                        type: this.questType,
                        target: this.questTarget,
                        template: this.questTemplate,
                        conditions: this.questConditions,
                        rewards: this.questRewards,
                        updated: this.questTimestamp,
                        pokestop_name: this.name || "Unknown",
                        pokestop_url: this.url || ""
                    }
                };
            case "invasion": // Invasion
                return {
                    type: "invasion",
                    message: {
                        pokestop_id: this.id,
                        latitude: this.lat,
                        longitude: this.lon,
                        name: this.name || "Unknown",
                        url: this.url || "",
                        lure_expiration: this.lureExpireTimestamp || 0,
                        last_modified: this.lastModifiedTimestamp || 0,
                        enabled: this.enabled || true,
                        lure_id: this.lureId || 0,
                        pokestop_display: this.pokestopDisplay || 0,
                        incident_expire_timestamp: this.incidentExpireTimestamp || 0,
                        grunt_type: this.gruntType || 0,
                        updated: this.updated || 1
                    }
                };
            default: // Pokestop
                return {
                    type: "pokestop",
                    message: {
                        pokestop_id: this.id,
                        latitude: this.lat,
                        longitude: this.lon,
                        name: this.name || "Unknown",
                        url: this.url || "",
                        lure_expiration: this.lureExpireTimestamp || 0,
                        last_modified: this.lastModifiedTimestamp || 0,
                        enabled: this.enabled || true,
                        lure_id: this.lureId || 0,
                        pokestop_display: this.pokestopDisplay || 0,
                        incident_expire_timestamp: this.incidentExpireTimestamp || 0,
                        updated: this.updated || 1
                    }
                };
        }
    }
}

// Export the class
module.exports = Pokestop;
