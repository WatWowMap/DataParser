![Node.js CI](https://github.com/versx/DataParser/workflows/Node.js%20CI/badge.svg)
# DataParser  

Raw proto data parser alternative to [RealDeviceMap](https://github.com/RealDeviceMap/RealDeviceMap) `/raw` endpoint  

Currently parses the following proto responses:  
- GetPlayerResponse (Method 2)
- ~~GetHoloInventoryResponse (Method 4)~~ (Soon)
- FortSearchResponse (Method 101)
- EncounterResponse: (Method 102)
- FortDetailsResponse (Method 104)
- GetMapObjectsResponse (Method 106)
- GymGetInfoResponse (Method 156)

## Prerequisites  
- [MySQL 8](https://dev.mysql.com/downloads/mysql/) or [MariaDB 10](https://mariadb.org/download/) database server  
- [Redis Server](https://redis.io/download)

## Installation  
1.) Clone repository `git clone https://github.com/versx/DataParser`  
2.) Install dependencies `npm install`  
3.) Copy config `cp src/config.example.json src/config.json`  
4.) Fill out config `vi src/config.json` (listening port, instances, db info, etc)  
5.) Create PvP stat tables, run `npm run create-pvp-tables`  
6.) Run `npm run start` (Database tables will be created if they don't exist)  
7.) Point `data_endpoint` config property in [DeviceConfigManager](https://github.com/versx/DeviceConfigManager) to `http://dataparser_ip:9001`  

## Configuration  
```js
{
    // Listening host interface
    "host": "0.0.0.0",
    // Listening port
    "port": 9001,
    // Number of maximum clusters for load balancing
    "clusters": 2,
    // Database connection settings
    "db": {
        // Database host IP address/host
        "host": "127.0.0.1",
        // Database server listening port
        "port": 3306,
        // Database username for authentication
        "username": "user123",
        // Database password for authentication
        "password": "pass123",
        // Database name to write data to
        "database": "bjsdb",
        // Database character set to use
        "charset": "utf8mb4",
        // Database pool maximum connection limit
        "connectionLimit": 1000
    },
    // Logging options
    "logs": {
        /** Log level to set, available options are:
         * debug: 4
         * log: 3
         * info: 2
         * warn: 1
         * error: 0
         * line: 1
         * turn off all logging: -1
         */
        "level": 4,
        // Enable file logging to /logs folder
        "file": false
    },
    // Determine what type of data to parse
    "parse": {
        // Wild and nearby Pokemon
        "pokemon": true,
        // Pokemon encounters
        "encounters": true,
        // Gym forts and details
        "gym": true,
        // Pokestop forts and details
        "pokestops": true,
        // Field research quests
        "quests": true,
        // Gym defenders and trainers
        "gymDefenders": true,
        // Weather cells
        "weather": true
    },
    // Redis server settings (used for saving PvP ranks)
    "redis": {
        // Redis host IP address/host
        "host": "127.0.0.1",
        // Redis server listening port
        "port": 6379,
        // Redis server optional password for authentication
        "password": ""
    },
    // Webhooks relay
    "webhooks": {
        // Enable webhook relay
        "enabled": false,
        // Webhook endpoints
        "urls": ["http://127.0.0.1:9001"],
        // Webhook delay before sending next payload
        "delay": 5,
        // Maximum retry count for failed webhooks
        "retryCount": 5
    }
}
```

## Updating  
1.) `git pull`   
3.) `npm install`  

## Discord  
https://discordapp.com/invite/zZ9h9Xa  
