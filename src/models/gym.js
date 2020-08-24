'use strict';

class Gym {
    constructor(data) {
        if (data.fort) {
            this.id = data.fort.id;
            this.lat = data.fort.latitude;
            this.lon = data.fort.longitude;
            this.name = null;
            this.enabled = data.fort.enabled;
            this.guardingPokemonId = data.fort.guard_pokemon_id;
            this.teamId = data.fort.owned_by_team;
            this.availableSlots = data.fort.gym_display.slots_available;
            this.lastModifiedTimestamp = data.fort.last_modified_timestamp_ms / 1000;
            this.exRaidEligible = data.fort.is_ex_raid_eligible;
            this.inBattle = data.fort.is_in_battle;
            if (data.fort.sponsor > 0) {
                this.sponsorId = data.fort.sponsor;
            } else {
                this.sponsorId = 0;
            }
            if (data.fort.image_url) {
                this.url = data.fort.image_url;
            } else {
                this.url = null;
            }
            this.totalCp = data.fort.owned_by_team ? data.fort.gym_display.total_gym_cp : 0;
            if (data.fort.raid_info) {
                this.raidEndTimestamp = data.fort.raid_info.raid_end_ms / 1000;
                this.raidSpawnTimestamp = data.fort.raid_info.raid_spawn_ms / 1000;
                this.raidBattleTimestamp = data.fort.raid_info.raid_battle_ms / 1000;
                this.raidLevel = data.fort.raid_info.raid_level;
                this.raidIsExclusive = data.fort.raid_info.is_exclusive;
                if (data.fort.raid_info.raid_pokemon) {
                    this.raidPokemonId = data.fort.raid_info.raid_pokemon.pokemon_id;
                    this.raidPokemonMove1 = data.fort.raid_info.raid_pokemon.move_1;
                    this.raidPokemonMove2 = data.fort.raid_info.raid_pokemon.move_2;
                    this.raidPokemonCp = data.fort.raid_info.raid_pokemon.cp;
                    this.raidPokemonForm = data.fort.raid_info.raid_pokemon.pokemon_display.form;
                    this.raidPokemonGender = data.fort.raid_info.raid_pokemon.pokemon_display.gender;
                } else {
                    this.raidPokemonId = null;
                    this.raidPokemonMove1 = null;
                    this.raidPokemonMove2 = null;
                    this.raidPokemonCp = null;
                    this.raidPokemonForm = null;
                    this.raidPokemonGender = null;
                }
            } else {
                this.raidEndTimestamp = null;
                this.raidSpawnTimestamp = null;
                this.raidBattleTimestamp = null;
                this.raidLevel = null;
                this.raidIsExclusive = null;
                this.raidPokemonId = null;
                this.raidPokemonMove1 = null;
                this.raidPokemonMove2 = null;
                this.raidPokemonCp = null;
                this.raidPokemonForm = null;
                this.raidPokemonGender = null;
            }
            let ts = new Date().getTime() / 1000;
            this.cellId = data.cellId;
            this.deleted = false;
            this.firstSeenTimestamp = ts;
            this.updated = ts;
        } else {
            this.id = data.id;
            this.lat = data.lat;
            this.lon = data.lon;
            this.name = data.name || null;
            this.url = data.url || null;
            this.guardingPokemonId = data.guarding_pokemon_id || 0;
            this.enabled = data.enabled || 0;
            this.lastModifiedTimestamp = data.last_modified_timestamp || null;
            this.teamId = data.team_id || 0;
            this.raidEndTimestamp = data.raid_end_timestamp || null;
            this.raidSpawnTimestamp = data.raid_spawn_timestamp || null;
            this.raidBattleTimestamp = data.raid_battle_timestamp || null;
            this.raidPokemonId = data.raid_pokemon_id || null;
            this.raidLevel = data.raid_level || null;
            this.availableSlots = data.available_slots || 0;
            this.updated = data.updated;
            this.exRaidEligible = data.ex_raid_eligible || 0;
            this.inBattle = data.in_battle || 0;
            this.raidPokemonMove1 = data.raid_pokemon_move_1 || null;
            this.raidPokemonMove2 = data.raid_pokemon_move_2 || null;
            this.raidPokemonForm = data.raid_pokemon_form || null;
            this.raidPokemonCp = data.raidPokemon_cp || null;
            this.raidPokemonGender = data.raid_pokemon_gender || null;
            this.raidIsExclusive = data.raid_is_exclusive || null;
            this.cellId = data.cell_id;
            this.totalCp = data.total_cp || 0;
            this.deleted = data.deleted || 0;
            this.firstSeenTimestamp = data.first_seen_timestamp;
            this.sponsorId = data.sponsor_id || null;
        }
    }
}

module.exports = Gym;