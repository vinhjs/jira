var redisClient = require('./config/redis').redisClient;
var _ = require('lodash');
var async = require('async');
var moment = require('moment');

const SCORE = {
    change_status: {
        "Test": 200,
        "Done": 200
    }
}

function logwork(issue, logworkId, username, point, started){
    if (point > 360) {
        point = 360;
    }
    redisClient.sadd('QUP:logworkId', logworkId, function(err, ok){
        if (ok){
            var now = new Date();
            console.log(now.toISOString(), "logwork", logworkId, username, point);
            redisClient.zincrby('QUP:leaderboard', point, username);
            var today = started.slice(0,10)
            redisClient.zincrby('QUP:leaderboard_date:' + today, point, username);
            redisClient.zincrby('QUP:all_logwork_date', point, today);
            var score = new Date(started).getTime();
            redisClient.zadd('QUP:activities_all', score, JSON.stringify({time: started, point: point, action: "logwork", issue: issue, id: logworkId, msg: started + ": " +username + " earned " + point + " points, logwork for issues: " + issue}))
            redisClient.zadd('QUP:activities:' + username, score, JSON.stringify({time: started, point: point, action: "logwork", issue: issue, id: logworkId, msg: started + ": You earned " + point + " points, logwork for issues: " + issue}))
        }
    })
}
function changeStatus(issue, toStatus, username, created, id){
    redisClient.sadd("QUP:changeStatus", issue + "_" + toStatus + "_" + username, function(err, ok){
        if (ok) {
            var point = SCORE.change_status[toStatus];
            var now = new Date();
            console.log(now.toISOString(), "changeStatus", issue, toStatus, username, point);
            redisClient.zincrby('QUP:leaderboard', point, username);
            var today = created.slice(0,10)
            redisClient.zincrby('QUP:leaderboard_date:' + today, point, username);
            var score = new Date(created).getTime();
            redisClient.SRANDMEMBER("QUP:Items", function(err, rand){
                if (rand) {
                    redisClient.HINCRBY("QUP:User_Items:" + username, rand, 1, function(err, ok){
                        if (ok) {
                            redisClient.zadd('QUP:activities_all', score, JSON.stringify({time: created, item: rand, action: "changeStatus", issue: issue, id: id, msg: created + ": " +username + " earned an item ("+rand+"), change status to "+toStatus+" for issues: " + issue}))
                            redisClient.zadd('QUP:activities:' + username, score, JSON.stringify({time: created, item: rand, action: "changeStatus", issue: issue, id: id, msg: created + ": You earned an item ("+rand+"), change status to "+toStatus+" for issues: " + issue}))
                        }
                    });
                }
            })
            redisClient.zadd('QUP:activities_all', score, JSON.stringify({time: created, point: point, action: "changeStatus", issue: issue, id: id, msg: created + ": " +username + " earned " + point + " points, change status to "+toStatus+" for issues: " + issue}))
            redisClient.zadd('QUP:activities:' + username, score, JSON.stringify({time: created, point: point, action: "changeStatus", issue: issue, id: id, msg: created + ": You earned " + point + " points, change status to "+toStatus+" for issues: " + issue}))
        }
    })
}
function getLeaderBoard(cb){
    redisClient.ZREVRANGE('QUP:leaderboard', 0, -1, "WITHSCORES", function(err, list){
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
        async.forEach(rs, function(item, cback){
            async.parallel({
                info: function(cback){
                    redisClient.get("QUP:User:" + item.username, function(err, info){
                        try {
                            cback(err, JSON.parse(info));
                        } catch (ex) {
                            cback(ex);
                        }
                    });
                },
                items: function(cback){
                    redisClient.HGETALL("QUP:User_Items:" + item.username, function(err, list){
                        var total = 0;
                        var rs = [];
                        if (list) {
                            _.keys(list).forEach(function(key){
                                total += parseInt(list[key]);
                                rs.push({item: key, total: list[key]})
                            })
                        }
                        cback(err, {total, list: rs});
                    })
                },
                level: function(cback){
                    async.parallel({
                        current: function(cback){
                            redisClient.ZREVRANGEBYSCORE("QUP:LEVELS_POINT", item.point, 0, 'WITHSCORES', 'LIMIT', 0 , 1, function(err, level){
                                if (level && level[0]) {
                                    cback(null, level);
                                } else {
                                    cback(null, [0, 0]);
                                }
                            })
                        },
                        nextLevel: function(cback){
                            redisClient.ZRANGEBYSCORE("QUP:LEVELS_POINT", item.point , '+inf', 'WITHSCORES', 'LIMIT', 0, 1, function(err, level){
                                if (level && level[0]) {
                                    cback(null, level);
                                } else {
                                    cback(null, [0, 0])
                                }
                            })
                        }
                    }, function(err, rs){
                        var total = parseInt(rs.nextLevel[1]) - parseInt(rs.current[1]);
                        var userPoint = parseInt(item.point) - parseInt(rs.current[1]);
                        var percent = (userPoint/total * 100).toFixed(0);
                        if (total == 0) {
                            percent = 0;
                        }
                        cback(null, {
                            current: parseInt(rs.current[0]) + 1,
                            percent: percent
                        })
                    })
                },
                today: function(cback){
                    var today = new moment().format("YYYY-MM-DD");
                    redisClient.ZSCORE('QUP:leaderboard_date:' + today, item.username, function(err, score) {
                        if (score) {
                            cback(null, parseInt(score));
                        } else {
                            cback(null, 0)
                        }
                    });
                }
            }, function(err, rs){
                item.info = rs.info;
                item.items = rs.items;
                item.level = rs.level;
                item.today = rs.today;
                cback();
            })
        }, function(){
            // console.log(JSON.stringify(rs));
            cb(err, rs);
        })
        
    })
}
function getActivities(username, cb){
    if (username) {
        redisClient.ZREVRANGE('QUP:activities:' + username, 0, -1, function(err, list){
            cb(err, list);
        })
    } else {
        redisClient.ZREVRANGE('QUP:activities_all', 0, -1, function(err, list){
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
    checkStatus,
    changeStatus
}