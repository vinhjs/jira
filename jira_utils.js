var request = require('request');
var _ = require('lodash');
var MongoClient = require('mongodb').MongoClient;
var url      = 'mongodb://192.168.2.85:27017';
var mongodb = null;
function connectMongo(){
    MongoClient.connect(url, function(err, client) {
        if (err) {
            console.log(err);
        } 
        if (client) {
            console.log("MongoDb connected");
        }
        mongodb = client.db('testCopy');
    });
}

connectMongo();
var getWorklog = function(updated, key, auth, cb){
    var url = 'https://issues.qup.vn/rest/api/2/issue/'+key+'/worklog';
    getCacheMongo(key, function(err, data) {
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
                    setCacheMongo(key, rs, function(err, ok){})
                    cb(null, rs);
                } else {
                    setCacheMongo(key, [], function(err, ok){})
                    cb("notfound", [])
                }
            });
        }
    });   
};
var setResults = function(sql, data){
    if (mongodb) {
        var bindData = {
            time: new Date(),
            sql: sql,
            data: JSON.stringify(data)
        };
        var JiraResults = mongodb.collection('JiraResults');
        JiraResults.insertOne(bindData);
    } else {
        console.log("mongodb error", error);
    }
}; 
var getResults = function(sql, cb){
    if (mongodb) {
        var JiraResults = mongodb.collection('JiraResults');
        JiraResults.findOne({
            sql: sql
        }, function(err, data){
            if (!err && data) {
                cb(null, data);
            } else {
                cb("mongodb error", null);
            }
        });
    } else {
        cb("mongodb error", null);
    }
}; 
function getCacheMongo(key, cb){
    if (mongodb) {
        var JiraLogworks = mongodb.collection('JiraLogworks');
        JiraLogworks.findOne({
            key: key
        }, function(err, data){
            if (!err && data && data.data) {
                cb(null, data.data);
            } else {
                cb("mongodb error", null);
            }
        });
    } else {
        cb("mongodb error", null);
    }
}
function setCacheMongo(key, data, cb){
    if (mongodb) {
        var JiraLogworks = mongodb.collection('JiraLogworks');
        JiraLogworks.insertOne({
            time: new Date(),
            key: key,
            data: data
        }, cb);
    } else {
        cb("mongodb error", null);
    }
}
module.exports = {
    getWorklog,
    setResults,
    getResults
}