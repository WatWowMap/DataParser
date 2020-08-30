# DataParser  

Raw data parser alternative to [RealDeviceMap](https://github.com/RealDeviceMap/RealDeviceMap) `/raw` endpoint  

## Prerequisites  
- [MySQL 8](https://dev.mysql.com/downloads/mysql/) or [MariaDB 10](https://mariadb.org/download/) database server  
- [Redis Server](https://redis.io/download) (For storing PvP ranks)  

## Installation  
1.) Clone repository `git clone --recursive https://github.com/versx/DataParser`  
2.) Install dependencies `npm install`  
3.) Copy config `cp src/config.example.json src/config.json`  
4.) Fill out config `vi src/config.json` (listening port, instances, db info, etc)  
5.) Create PvP stat tables, run `npm run create-pvp-tables` (optional, only needed if you want PvP stats)  
6.) Run `npm run start` (Database tables will be created if they don't exist)  
7.) Point `data_endpoint` config property in [DeviceConfigManager](https://github.com/versx/DeviceConfigManager) to `http://dataparser_ip:9001`  

## Updating  
1.) `git pull`  
2.) `git submodule update`  
3.) `npm install`  
