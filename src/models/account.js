'use strict';

const config = require('../config.json');
const MySQLConnector = require('../services/mysql.js');
const db = new MySQLConnector(config.db);

/**
 * Account model class.
 */
class Account {

    /**
     * Initalize new Account object.
     * @param username 
     * @param password 
     * @param firstWarningTimestamp 
     * @param failedTimestamp 
     * @param failed 
     * @param level 
     * @param lastEncounterLat 
     * @param lastEncounterLon 
     * @param lastEncounterTime 
     */
    constructor(username, password, firstWarningTimestamp, failedTimestamp, failed,
        level, lastEncounterLat, lastEncounterLon, lastEncounterTime,) {
        this.username = username;
        this.password = password;
        if (firstWarningTimestamp > 0) {
            this.firstWarningTimestamp = firstWarningTimestamp;
        }
        if (failedTimestamp > 0) {
            this.failedTimestamp = failedTimestamp;
        }
        this.failed = failed;
        this.level = level;
        this.lastEncounterLat = lastEncounterLat;
        this.lastEncounterLon = lastEncounterLon;
        if (lastEncounterTime > 0) {
            this.lastEncounterTime = lastEncounterTime;
        }
    }

    /**
     * Get new account between minimum and maximum level.
     * @param minLevel 
     * @param maxLevel 
     */
    static async getNewAccount(minLevel, maxLevel, hasTicket) {
        let sql = `
        SELECT username, password, level, first_warning_timestamp, failed_timestamp, failed, last_encounter_lat, last_encounter_lon, last_encounter_time
        FROM account
        LEFT JOIN device ON username = account_username
        WHERE first_warning_timestamp is NULL AND failed_timestamp is NULL and device.uuid IS NULL AND level >= ? AND level <= ? AND failed IS NULL AND (last_encounter_time IS NULL OR UNIX_TIMESTAMP() - CAST(last_encounter_time AS SIGNED INTEGER) >= 7200)
        ORDER BY level DESC, RAND()
        LIMIT 1
        `;
        let results = await db.query(sql, [minLevel, maxLevel])
            .then(x => x)
            .catch(err => { 
                console.error('[Account] Failed to get new Account', err);
                return null;
            });
        if (results && results.length > 0) {
            const result = results[0];
            return new Account(
                result.username,
                result.password,
                result.first_warning_timestamp,
                result.failed_timestamp,
                result.failed,
                result.level,
                result.last_encounter_lat,
                result.last_encounter_lon,
                result.last_encounter_time
            );
        }
        return null;
    }

    /**
     * Get account with username.
     * @param username 
     */
    static async getWithUsername(username) {
        let sql = `
        SELECT username, password, first_warning_timestamp, failed_timestamp, failed, level, last_encounter_lat, last_encounter_lon, last_encounter_time
        FROM account
        WHERE username = ?
        LIMIT 1
        `;
        let args = [username];
        let results = await db.query(sql, args)
            .then(x => x)
            .catch(err => { 
                console.error('[Account] Failed to get Account with username', username, 'Error:', err);
                return null;
            });
        if (results && results.length > 0) {
            const result = results[i];
            return new Account(
                result.username,
                result.password,
                result.first_warning_timestamp,
                result.failed_timestamp,
                result.failed,
                result.level,
                result.last_encounter_lat,
                result.last_encounter_lon,
                result.last_encounter_time
            );
        }
        return null;
    }

    /**
     * Add encounter data to specified account.
     * @param username 
     * @param newLat 
     * @param newLon 
     * @param encounterTime 
     */
    static async didEncounter(username, newLat, newLon, encounterTime) {
        let sql = `
        UPDATE account
        SET last_encounter_lat = ?, last_encounter_lon = ?, last_encounter_time = ?
        WHERE username = ?
        `;
        let args = [newLat, newLon, encounterTime, username];
        let result = await db.query(sql, args)
            .then(x => x)
            .catch(err => {
                console.error('[Account] Failed to set encounter info for account with username', username, 'Error:', err);
                return null;
            });
            console.log('[Account] DidEncounter:', result);
    }

    /**
     * Set account level.
     * @param username 
     * @param level 
     */
    static async setLevel(username, level) {
        let sql = `
        UPDATE account
        SET level = ?
        WHERE username = ?
        `;
        let args = [level, username];
        let result = await db.query(sql, args)
            .then(x => x)
            .catch(err => { 
                console.error('[Account] Failed to set Account level for username', username, 'Error:', err);
                return null;
            });
        //console.log('[Account] SetLevel:', result);
    }

    /**
     * Save account.
     * @param update 
     */
    async save(update) {
        const sql = `
        INSERT INTO account (username, password, level, first_warning_timestamp, failed_timestamp, failed, last_encounter_lat, last_encounter_lon, last_encounter_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE UPDATE
        username=VALUES(username),
        username=VALUES(password),
        username=VALUES(level),
        username=VALUES(first_warning_timestamp),
        username=VALUES(failed_timestamp),
        username=VALUES(failed),
        username=VALUES(last_encounter_lat),
        username=VALUES(last_encounter_lon),
        username=VALUES(last_encounter_time)
        `;
        const args = [this.username, this.password, this.level, this.firstWarningTimestamp, this.failedTimestamp, this.failed, this.lastEncounterLat, this.lastEncounterLon, this.lastEncounterTime];
        let result = await db.query(sql, args)
            .then(x => x)
            .catch(err => {
                console.error('[Account] Error:', err);
                return null;
            });
        //console.log('[Account] Save:', result)
    }
}

// Export the class
module.exports = Account;