'use strict';

const S2 = require('s2-geometry').S2;

class Cell {
    static getCellIdFromLatLon(lat, lon, level = 15) {
        let key = S2.latLngToKey(lat, lon, level);
        let id = S2.keyToId(key);
        return id;
    }
}

module.exports = Cell;
