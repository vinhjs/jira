var redisClient = require('./config/redis').redisClient;
const redisLock = require('redis-lock')(redisClient);
var _ = require('lodash');
var async = require('async');
var moment = require('moment');

const SCORE = {
    change_status: {
        "Test": 80,
        "Done": 80
    }
}
const MAX_LOGWORK_PER_DAY = 600; //600 mins = 1- hours
const SPRINT_TIMES = {
    "s35s36": {
        from: "2019-08-08",
        to: "2019-09-17"
    },
    "s37": {
        from: "2019-09-18",
        to: "2019-09-30"
    }
}
function getItems(cb){
    const low = require('lowdb')
    const FileSync = require('lowdb/adapters/FileSync')

    const adapter = new FileSync('items.json')
    const db = low(adapter);
    const items = db.get('items').value();

    var avatars = {}
    async.forEachLimit(items, 50, function(item, cback){
        redisClient.SMEMBERS("QUP:Item_Users:" + item.id, function(err, members){
            if (members && members.length) {
                var mbs = [];
                async.forEach(members, function(mb, cback){
                    if (avatars[mb]){
                        mbs.push(avatars[mb]);
                        cback();
                    } else {
                        redisClient.get("QUP:User:" + mb, function(err, info){
                            try {
                                let user_info = JSON.parse(info);
                                avatars[mb] = user_info.avatarUrls["24x24"];
                                mbs.push(user_info.avatarUrls["24x24"]);
                                cback();
                            } catch (ex) {
                                cback();
                            }
                        });
                    }
                }, function(){
                    item.members = mbs;
                    cback();
                })
            } else {
                item.members = [];
                cback();
            }
        })
    }, function(){
        cb(null, items);
    })
}
function logwork(issue, logworkId, username, point, started, comment, created){
    if (point > 180) {
        point = 180;
    }
    var now = new Date();

    redisLock('LOCK_Lockwork:' + username, 5000, function (unLock) {
        var score = new Date(started).getTime();
        redisClient.sadd('QUP:logworkId', logworkId, function(err, ok){
            if (ok){
                if (comment) {
                    var momentStarted = moment(started.slice(0,19), "YYYY-MM-DDTHH:mm:ss");
                    var momentCreated = moment(created.slice(0,19), "YYYY-MM-DDTHH:mm:ss");
                    var durationCreateStart = moment.duration(momentCreated.diff(momentStarted)).asDays();
                    if (durationCreateStart <= 3) {
                        var today = started.slice(0,10);
                        redisClient.ZSCORE('QUP:logwork_date:' + today, username, function(err, current){
                            if (!err) {
                                current = current || 0;
                                try {
                                    let available = 0;
                                    current = parseInt(current);
                                    if (current < MAX_LOGWORK_PER_DAY) {
                                        available = MAX_LOGWORK_PER_DAY - current;
                                    } else {
                                        available = 0;
                                    }
                                    if (available) {
                                        if (available < point) {
                                            point = available;
                                        }
                                        redisClient.zincrby('QUP:logwork_date:' + today, point, username, function(err, current){
                                            console.log(now.toISOString(), "logwork", logworkId, username, point);
                                            redisClient.zincrby('QUP:leaderboard_date:' + today, point, username);
                                            redisClient.zincrby('QUP:leaderboard', point, username);
                                            
                                
                                            _.keys(SPRINT_TIMES).forEach(function(key){
                                                if(new moment(today).isBetween(new moment(SPRINT_TIMES[key].from, "YYYY-MM-DD"), new moment(SPRINT_TIMES[key].to, "YYYY-MM-DD"), null, '[]')) {
                                                    redisClient.zincrby('QUP:leaderboard_sprint:' + key, point, username);
                                                }
                                            })
                                
                                            
                                            redisClient.zincrby('QUP:all_logwork_date', point, today);
                                            
                                            redisClient.zadd('QUP:activities_all', score, JSON.stringify({time: started, point: point, action: "logwork", issue: issue, id: logworkId, msg: started + ": " +username + " earned " + point + " points, logwork for issues: " + issue}))
                                            redisClient.zadd('QUP:activities:' + username, score, JSON.stringify({time: started, point: point, action: "logwork", issue: issue, id: logworkId, msg: started + ": You earned " + point + " points, logwork for issues: " + issue}))
                                            unLock(function () {});
                                        })
                                    } else {
                                        //over perday
                                        redisClient.zadd('QUP:warn_activities_all', score, JSON.stringify({msg: started + ": " +username + " earned " + point + " points, logwork for issues: " + issue + " WARNING: OVER LOGWORK TODAY"}))
                                            
                                        console.log(now.toISOString(), "logwork", logworkId, username, 0, "over today");
                                        unLock(function () {});
                                    }
                                } catch (ex) {
                                    console.log('logwork exception', ex);
                                    unLock(function () {});
                                }
                            } else {
                                unLock(function () {});
                            }
                        });                        
                    } else {
                        console.log(now.toISOString(), "logwork", logworkId, username, 0, "overtime to logwork");
                        redisClient.zadd('QUP:warn_activities_all', score, JSON.stringify({msg: started + ": " +username + " earned " + point + " points, logwork for issues: " + issue + " WARNING: OVERTIME TO LOGWORK, Logwork must have less than 3 days from today"}))
                                        
                        unLock(function () {});
                    }
                } else {
                    console.log(now.toISOString(), "logwork", logworkId, username, 0, "no comment");
                    redisClient.zadd('QUP:warn_activities_all', score, JSON.stringify({msg: started + ": " +username + " earned " + point + " points, logwork for issues: " + issue + " WARNING: no comment"}))
                        
                    unLock(function () {});
                }
            } else {
                unLock(function () {});
            }
        })
    })

}
function changeStatus(issue, toStatus, username, created, id){
    redisClient.sadd("QUP:changeStatus", issue + "_" + toStatus + "_" + username, function(err, ok){
        if (ok) {
            var point = SCORE.change_status[toStatus];
            var now = new Date();
            console.log(now.toISOString(), "changeStatus", issue, toStatus, username, point);
            redisClient.zincrby('QUP:leaderboard', point, username);
            var today = created.slice(0,10);
            _.keys(SPRINT_TIMES).forEach(function(key){
                if(new moment(today).isBetween(new moment(SPRINT_TIMES[key].from, "YYYY-MM-DD"), new moment(SPRINT_TIMES[key].to, "YYYY-MM-DD"), null, '[]')) {
                    redisClient.zincrby('QUP:leaderboard_sprint:' + key, point, username);
                }
            })
            redisClient.zincrby('QUP:leaderboard_date:' + today, point, username);
            var score = new Date(created).getTime();
            redisClient.SRANDMEMBER("QUP:Items", function(err, rand){
                if (rand) {
                    redisClient.HINCRBY("QUP:User_Items:" + username, rand, 1, function(err, ok){
                        if (ok) {
                            redisClient.sadd("QUP:Item_Users:" + rand, username);
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
function getLeaderBoard(query, cb){
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
                },
                s35s36: function(cback){
                    redisClient.ZSCORE('QUP:leaderboard_sprint:s35s36', item.username, function(err, score) {
                        if (score) {
                            cback(null, parseInt(score));
                        } else {
                            cback(null, 0)
                        }
                    });
                },
                s37: function(cback){
                    redisClient.ZSCORE('QUP:leaderboard_sprint:s37', item.username, function(err, score) {
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
                item.s35s36 = rs.s35s36;
                item.s37 = rs.s37;
                cback();
            })
        }, function(){
            // console.log(JSON.stringify(rs));
            if (query) {
                if (query.sort == "sprev") {
                    rs = _.orderBy(rs, ['s35s36', 'point'], ['desc', 'desc'])
                }
                if (query.sort == "scur") {
                    rs = _.orderBy(rs, ['s37', 'point'], ['desc', 'desc'])
                }
                if (query.sort == "today") {
                    rs = _.orderBy(rs, ['today', 'point'], ['desc', 'desc'])
                }
            }
            
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
// redisClient.zrange("QUP:all_logwork_date", 0, 100000, 'WITHSCORES', function(err, list){
//     if (list && list.length) {
//         var rs = [];
//         var dates = {};
//         var data = {
//             "type": "serial",
//             "categoryField": "category",
//             "startDuration": 1,
//             "categoryAxis": {
//                 "gridPosition": "start"
//             },
//             "chartCursor": {
//                 "enabled": true
//             },
//             "chartScrollbar": {
//                 "enabled": true
//             },
//             "trendLines": [],
//             "graphs": [
//                 {
//                     "fillAlphas": 1,
//                     "id": "AmGraph-1",
//                     "title": "graph 1",
//                     "type": "column",
//                     "valueField": "column-1"
//                 }
//             ],
//             "guides": [],
//             "valueAxes": [
//                 {
//                     "id": "ValueAxis-1",
//                     "title": "Axis title"
//                 }
//             ],
//             "allLabels": [],
//             "balloon": {},
//             "titles": [
//                 {
//                     "id": "Title-1",
//                     "size": 15,
//                     "text": "Chart Title"
//                 }
//             ],
//             "dataProvider": [
                
//             ]
//         };
//         for (var i in list) {
//             if (i%2 == 0) {
//                 dates[list[i]] = parseInt(list[parseInt(i)+1]);
//                 rs.push({
//                     "category": list[i],
//                     "column-1": parseInt(list[parseInt(i)+1])
//                 })
                
//             }
//         }
//         var startDate = new moment("01-01-2019", "MM-DD-YYYY");
//         var now = new moment();

//         var stop = false;
//         async.whilst(
//         function() { return !stop; },
//         function(callback) {
//             var duration = moment.duration(startDate.diff(now)).asDays();
//             // console.log(duration)
//             if(duration < 0) {
//                 if (!dates[startDate.format("YYYY-MM-DD")]) {
//                     dates[startDate.format("YYYY-MM-DD")] = 0;
//                     rs.push({
//                         "category": startDate.format("YYYY-MM-DD"),
//                         "column-1": 0
//                     })
//                 }
//                 startDate.add(1, 'd');
//                 callback();
//             } else {
//                 stop = true;
//                 callback();
//             }
//         },
//         function (err, res) {
//             rs = _.sortBy(rs, ['category']);
//             data.dataProvider = rs;
//             console.log(JSON.stringify(data));
//         }
//         );
//     }
// })
function checkGifts(items, cb){
    redisClient.KEYS("QUP:User_Items:*", function(err, keys){
        var rs = [];
        async.forEach(keys, function(key, cback){
            var username = key.split(":")[2];
            redisClient.HGETALL(key, function(err, info){
                if (info) {
                    // console.log(username)
                    // console.log(_.keys(info));
                    // console.log(items);
                    // console.log(_.intersection(_.keys(info), items))
                    if(_.xor(_.intersection(_.keys(info), items), items).length == 0) {
                        redisClient.get("QUP:User:" + username, function(err, userInfo){
                            try {
                                rs.push(JSON.parse(userInfo));
                                cback();
                            } catch (ex) {
                                console.log(ex);
                                cback();
                            }
                        });
                    } else {
                        cback();
                    }
                } else {
                    cback();
                }
            })
        }, function(){
            cb(rs);
        })
    })
}
function generate_levels(){
    redisClient.zadd("QUP:LEVELS_POINT", 1000, 1);
    redisClient.zadd("QUP:LEVELS_POINT", 3000, 2);
    redisClient.zadd("QUP:LEVELS_POINT", 6000, 3);
    redisClient.zadd("QUP:LEVELS_POINT", 10000, 4);
    redisClient.zadd("QUP:LEVELS_POINT", 16000, 5);
    redisClient.zadd("QUP:LEVELS_POINT", 23000, 6);
    redisClient.zadd("QUP:LEVELS_POINT", 31000, 7);
    redisClient.zadd("QUP:LEVELS_POINT", 40000, 8);
    redisClient.zadd("QUP:LEVELS_POINT", 50000, 9);
    redisClient.zadd("QUP:LEVELS_POINT", 61000, 10);
}
function generate_items(){
    const low = require('lowdb')
    const FileSync = require('lowdb/adapters/FileSync')

    const adapter = new FileSync('items.json')
    const db = low(adapter);
    const items = db.get('items').value();
    items.forEach(function(item){
        redisClient.sadd('QUP:Items', item.id);
    })
}
//    redisClient.keys("QUP:User_Items:*", function(err, keys){
//         if (!err && keys) {
//             async.forEach(keys, function(key, cback){
//                 redisClient.HGETALL(key, function(err, hash){
//                     if (!err && hash) {
//                         var username = key.split(":")[2];
//                         async.forEach(_.keys(hash), function(k, cback){
//                             redisClient.sadd("QUP:Item_Users:" + k, username, function(){
//                                 cback();
//                             })
//                         }, function(){
//                             cback();
//                         })
//                     } else {
//                         cback();
//                     }
//                 })
//             })
//         }
//     })
module.exports = {
    logwork,
    getLeaderBoard,
    getActivities,
    checkStatus,
    changeStatus,
    getItems,
    checkGifts,
    generate_levels,
    generate_items
}