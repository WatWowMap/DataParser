'use strict';

/**
 * Base64 decodes the string to raw data.
 * @param {*} data 
 */
const base64_decode = (data) => {
    return Buffer.from(data, 'base64');
};

const sendResponse = (res, status, data) => {
    res.json({
        status: status,
        data: data
    });
};

module.exports = {
    base64_decode,
    sendResponse
};