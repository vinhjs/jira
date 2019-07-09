var redisClient = require('./config/redis').redisClient;
var _ = require('lodash');
function logwork(issue, logworkId, username, point, created){
    redisClient.sadd('QUP:logworkId', logworkId, function(err, ok){
        if (ok){
            var now = new Date();
            console.log(now.toISOString(), "logwork", logworkId, username, point);
            redisClient.zincrby('QUP:leaderboard', point, username);
            var score = new Date(created).getTime();
            redisClient.zadd('QUP:activities_all', score, JSON.stringify({time: created, point: point, action: "logwork", issue: issue, id: logworkId, msg: created + ": " +username + " earned " + point + " points, logwork for issues: " + issue}))
            redisClient.zadd('QUP:activities:' + username, score, JSON.stringify({time: created, point: point, action: "logwork", issue: issue, id: logworkId, msg: created + ": You earned " + point + " points, logwork for issues: " + issue}))
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
function getActivities(username, cb){
    if (username) {
        redisClient.ZRANGE('QUP:activities:' + username, 0, -1, function(err, list){
            cb(err, list);
        })
    } else {
        redisClient.ZRANGE('QUP:activities_all', 0, -1, function(err, list){
            cb(err, list)
        })
    }
    
}
module.exports = {
    logwork,
    getLeaderBoard,
    getActivities
}