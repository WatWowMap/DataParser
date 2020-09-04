CREATE TABLE IF NOT EXISTS `instance` (
   `name` varchar(30) NOT NULL,
   `type` enum('circle_pokemon','circle_raid','circle_smart_raid','auto_quest','pokemon_iv') NOT NULL,
   `data` longtext NOT NULL,
   PRIMARY KEY (`name`)
);

CREATE TABLE IF NOT EXISTS `assignment` (
   `device_uuid` varchar(40) NOT NULL,
   `instance_name` varchar(30) NOT NULL,
   `time` mediumint(6) unsigned NOT NULL,
   `enabled` tinyint(1) unsigned NOT NULL DEFAULT 1,
   PRIMARY KEY (`device_uuid`,`instance_name`,`time`),
   KEY `assignment_fk_instance_name` (`instance_name`),
   CONSTRAINT `assignment_fk_device_uuid` FOREIGN KEY (`device_uuid`) REFERENCES `device` (`uuid`) ON DELETE CASCADE ON UPDATE CASCADE,
   CONSTRAINT `assignment_fk_instance_name` FOREIGN KEY (`instance_name`) REFERENCES `instance` (`name`) ON DELETE CASCADE ON UPDATE CASCADE
);