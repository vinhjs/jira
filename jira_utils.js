var request = require('request');
var _ = require('lodash');
var redis = require('./redis');
var getWorklog = function(key, auth, cb){
    var url = 'https://issues.qup.vn/rest/api/2/issue/'+key+'/worklog';
    getCacheRedis(url, function(err, data) {
        if (!err && data) {
            cb(err, data);
        } else {
            request({
                url: url,
                timeout: 10000,
                json: true,
                headers: {
                    "Authorization": auth
                }
            }, function(error, response, result){
                if (result && result.total) {
                    function filter(el){
                        return {
                            name: el.updateAuthor.name,
                            created: el.created,
                            timeSpentSeconds: el.timeSpentSeconds
                        }
                    }
                    var rs = _.map(result.worklogs, filter);
                    setCacheRedis(url, rs, 60 * 60 * 30, function(err, ok){})
                    cb(null, rs);
                } else {
                    cb("notfound", [])
                }
            })
        }
    })   
}
function getCacheRedis(key, cb){
    redis.get(key, function(err, data){
        if (err) {
            console.log('getCacheRedis error');
            console.log(err);
            cb(err, data);
        } else {
            try {
                cb(null, JSON.parse(data));
            } catch (ex) {
                console.log('getCacheRedis error');
                console.log(ex);
                cb(ex, null)
            }
        }
    })
}
function setCacheRedis(key, data, time, cb){
    redis.setex(key, time, JSON.stringify(data), function(err, ok){
        if (err) {
            console.log('setCacheRedis error');
            console.log(err);
        }
        cb(err, ok);
    })
}
module.exports = {
    getWorklog
}