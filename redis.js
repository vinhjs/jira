var redis = require('redis');

/**
 * redis Ack connection
 */
var redisClient = redis.createClient(13029, "redis-13029.c44.us-east-1-2.ec2.cloud.redislabs.com");
redisClient.auth("wzHrFUxiuKeF4DPcUwymBOgIOMaJC3p1");
redisClient.on('error', function (err) {
    console.log(new Date().toISOString()+ ' redisAck connection error to - ' + err);
    process.exit(1);
});
redisClient.on('ready', function () {
    console.log(new Date().toISOString()+ ' redisAck connection ready');
});
module.exports = redisClient;