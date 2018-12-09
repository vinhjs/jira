var request = require('request');
var _ = require('lodash');
var async = require('async');
var moment = require("moment");

const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')

const adapter = new FileSync('db.json')
const db = low(adapter);
db.defaults({ histories: [] })
.write()
var jiraDomain = 'https://issues.qup.vn';

var searchJQL = function(startAt, jql, auth, session, cb){
    var url = jiraDomain+'/rest/api/2/search?maxResults=100&startAt='+startAt+'&jql=' + jql;
    var date = new Date();
    async.parallel({
        search: function(cback){
            request({
                url: url,
                timeout: 30000,
                json: true,
                headers: {
                    "Authorization": auth
                }
            }, function(error, response, result){
                console.log(url + " : " + (new Date() - date));
                cback(error, result);
            })
        },
        session: function(cback){
            if (session) {
                request({
                    url: jiraDomain + '/rest/auth/1/session',
                    timeout: 30000,
                    json: true,
                    headers: {
                        "Authorization": auth
                    }
                }, function(error, response, result){
                    cback(error, result);
                })
            } else {
                cback(null, {})
            }
        }
    }, function(err, rs){
        cb(err, rs);
    })   
}
var getWorklog = function(updated, key, auth, cb){
    var url = 'https://issues.qup.vn/rest/api/2/issue/'+key+'/worklog';
    getCacheDb(key, updated, function(err, data) {
        if (!err && data) {
            cb(err, data);
        } else {
            var date = new Date();
            request({
                url: url,
                timeout: 10000,
                json: true,
                headers: {
                    "Authorization": auth
                }
            }, function(error, response, result){
                console.log(url + " : " + (new Date() - date));
                if (result && result.total) {
                    function filter(el){
                        return {
                            name: el.updateAuthor.name,
                            created: el.created,
                            timeSpentSeconds: el.timeSpentSeconds
                        }
                    }
                    var rs = _.map(result.worklogs, filter);
                    setCacheDb(key, rs, updated, function(err, ok){})
                    cb(null, rs);
                } else {
                    setCacheDb(key, [], updated, function(err, ok){})
                    cb("notfound", [])
                }
            });
        }
    });   
};
function getCacheDb(key, updated, cb){
    const log = db.get('logwork.'+key).value();
    if (log && log.data) {
        if (log.updated == updated) {
            cb(null, log.data);
        } else {
            cb(null, null);
        }
    } else {
        cb(null, null);
    }
}
function setCacheDb(key, data, updated, cb){
    if (db) {
        db.set('logwork.' + key, {key: key, data: data, time: new Date().toISOString(), updated: updated})
        .write()
        // .then(function(logwork){
        cb(null, true)
        // })
    } else {
        cb("db error", null);
    }
}
function addHistory(username, jql){
    if (db) {
        db.get('histories')
        .push({ username: username, jql: jql, time: new Date()})
        .write()
    }
}
function getHistory(cb){
    if (db) {
        var histories = db.get('histories')
        .value()
        cb(null, histories)
    } else {
        cb(null, [])
    }
}
module.exports = {
    getWorklog,
    searchJQL,
    addHistory,
    getHistory
}