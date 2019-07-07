var redisClient = require('./config/redis').redisClient;
var _ = require('lodash');
function logwork(logworkId, username, point){
    redisClient.sadd('QUP:logworkId', logworkId, function(err, ok){
        if (ok){
            console.log(new Date().toISOString(), "logwork", logworkId, username, point);
            redisClient.zincrby('QUP:leaderboard', point, username);
        }
    })
}
function getLeaderBoard(cb){
    redisClient.ZRANGE('QUP:leaderboard', 0, -1, "WITHSCORES", function(err, list){
        var rs = []
        if (list && list.length) {
            for (var i in list) {
                if (i%2 == 0) {
                    rs.push({
                        username: list[i],
                        point: parseInt(list[parseInt(i)+1])
                    })
                }
            }
        }
        cb(err, rs);
    })
}
module.exports = {
    logwork,
    getLeaderBoard
}