var redisClient = require('./config/redis').redisClient;
var _ = require('lodash');
function logwork(issue, logworkId, username, point, started){
    redisClient.sadd('QUP:logworkId', logworkId, function(err, ok){
        if (ok){
            var now = new Date();
            console.log(now.toISOString(), "logwork", logworkId, username, point);
            redisClient.zincrby('QUP:leaderboard', point, username);
            var score = new Date(started).getTime();
            redisClient.zadd('QUP:activities_all', score, JSON.stringify({time: started, point: point, action: "logwork", issue: issue, id: logworkId, msg: started + ": " +username + " earned " + point + " points, logwork for issues: " + issue}))
            redisClient.zadd('QUP:activities:' + username, score, JSON.stringify({time: started, point: point, action: "logwork", issue: issue, id: logworkId, msg: started + ": You earned " + point + " points, logwork for issues: " + issue}))
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
function checkStatus(status, assignee, project, key){
    if (project == "SL" && status == "Done") {
        // console.log('checkStatus', status, assignee, project, key)
    }
    if (project == "KAN" && status == "Resolved") {
        console.log('checkStatus', status, assignee, project, key)
    }
    if (project == "QQA" && status == "Closed") {
        console.log('checkStatus', status, assignee, project, key)
    }
}
module.exports = {
    logwork,
    getLeaderBoard,
    getActivities,
    checkStatus
}