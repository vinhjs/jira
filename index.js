const express = require('express');
const request = require('request');
const async = require('async');
const _ = require('lodash');
const app = express();
const http = require('http').Server(app);
const bodyParser = require('body-parser');
const path = require('path');
app.use(bodyParser.urlencoded({limit: '2mb', extended: true}));
app.use(bodyParser.json({limit: '2mb'}));
app.use('/public', express.static(path.join(__dirname, 'public')))
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Authorization, Content-Type, Accept");
    next();
});
var randomScalingFactor = function() {
    return Math.floor((Math.random() * 100) + 50);;
};
var randomScalingFactor50 = function() {
    return Math.floor((Math.random() * 50) + 1);;
};
var jira_utils = require('./jira_utils');
var auth = require('http-auth');
var basic = auth.basic({
    realm: 'LOGIN WITH JIRA ACCOUNT'
}, function(username, password, callback) {
    var url = 'http://issues.qup.vn/rest/api/2/user?username=' + username;
    request.get({url: url, body: {}, json: true, timeout: 30000, auth: {username: username, password: password}}, function(error, response, body){
        console.log("INFO", "api fleet", "request.get: - response body", {url}, null);
        if (body && body.active) {
            callback(true);
        } else {
            callback(false);
        }
    })
});
var authMiddleware = auth.connect(basic);
var sprints = [
    {
        id: 283,
        name: "web 4.6.26"
    },
    {
        id: 284,
        name: "app 4.6.26"
    },
    {
        id: 285,
        name: "server 4.6.26"
    },
    {
        id: 286,
        name: "web_booking 4.6.26"
    },
    {
        id: 287,
        name: "server 4.6.27"
    },
    {
        id: 288,
        name: "web 4.6.27"
    },
    {
        id: 289,
        name: "app 4.6.27"
    },
    {
        id: 291,
        name: "app 4.6.28"
    },
    {
        id: 292,
        name: "web 4.6.28"
    },
    {
        id: 293,
        name: "server 4.6.28"
    }
];
var redis = require('./redis');
app.get('/sample', authMiddleware, function(req, res){
    var startAt = 0;
    var total = 50  
    async.whilst(
        function () { return startAt < total; },
        function (callback) {
            request({
                url: 'https://issues.qup.vn/rest/api/2/search?startAt='+startAt+'&jql=Sprint = 293',
                timeout: 10000,
                json: true,
                headers: {
                    "Authorization": req.headers.authorization
                }
            }, function(error, response, result){
                console.log('request qup done');
                if (result && result.total) {                        
                    total = result.total;
                    startAt += 50;
                    async.forEachLimit(result.issues, 1, function(issue, cback){ 
                        var issuetype = _.get(issue, "fields.issuetype.name", "unknown");
                        switch (issuetype) {
                            case "Story":
                                var point = _.get(issue, "fields.customfield_10004", 0);
                            break;
                        }
                        //get log work info
                        jira_utils.getWorklog(issue.key, req.headers.authorization, function(err, rs){
                            console.log("worklogs: " + issue.key);
                            console.log(rs);
                            console.log("==========");
                            cback();
                        })
                    }, function(){
                        callback();
                    })
                } else {
                    callback(error || response.statusCode);
                }
            })
        },
        function (err, n) {
            if (err) {
                console.log(err);
            }
            console.log('DONE');
        }
    );
    var barChartData = [[
                randomScalingFactor(),
                randomScalingFactor(),
                randomScalingFactor(),
                randomScalingFactor(),
                randomScalingFactor(),
                randomScalingFactor(),
                randomScalingFactor()
            ],[
                randomScalingFactor50(),
                randomScalingFactor50(),
                randomScalingFactor50(),
                randomScalingFactor50(),
                randomScalingFactor50(),
                randomScalingFactor50(),
                randomScalingFactor50()
            ]
        ];
    res.send(barChartData);
})
app.get('/', function(req, res){
    res.sendFile(__dirname + '/public/index.html');
})
http.listen(3000, function () {
    console.log('App is running on ' + 3000);
}); 