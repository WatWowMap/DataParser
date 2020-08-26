# DataParser  

Raw data parser alternative to [RealDeviceMap](https://github.com/RealDeviceMap/RealDeviceMap) /raw endpoint  

## Installation  
1.) Clone repository `git clone https://github.com/versx/DataParser --recursive`  
2.) Install dependencies `npm install`  
3.) Copy config `cp src/config.example.json src/config.json`  
4.) Fill out config `vi src/config.json` (listening port, instances, db info, etc)  
5.) Run `schema.sql` against a fresh database to create the tables  
6.) Run `npm start`  
7.) Point `data_endpoint` config property in [DeviceConfigManager](https://github.com/versx/DeviceConfigManager) to `http://dataparser_ip:9001`  