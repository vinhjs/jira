var redis = require("redis");
var config = require('config');
var port = config.get('redis.port');
var server = config.get('redis.server');
var pw = config.get('redis.password');


var redisClient = redis.createClient({
    host: server,
    port: port,
    password: pw
});
redisClient.select(2);
redisClient.on('error', function (err) {
    console.log(new Date().toISOString()+ ' redisSetting connection error to - ' + err);
    process.exit(1);
});
redisClient.on('ready', function (err) {
    console.log(new Date().toISOString()+ ' redisSetting connection success - ' + err);
});

module.exports = {
    redisClient : redisClient
};