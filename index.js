const express = require('express');
const request = require('request');
var moment = require('moment');
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
var colors = require('./colors');
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
app.get('/database', function(req, res){
    var fs = require('fs');
    fs.readFile(__dirname + '/database.json', 'utf8', function(err, data){
        try {
            res.send(JSON.parse(data));
        } catch (ex) {
            res.send(ex);
        }
    });

})
app.get('/sample', authMiddleware, function(req, res){
    var finish = {
        issuetypes: [],
        point: 0,
        issues: {
            total: 0,
            status: {}
        },
        users: {},
        dates: {},
        components: {},
        barChartLogworkData: {
            labels: [],
            datasets: []
        },
        barChartComponentData: {
            labels: [],
            datasets: []
        }
    } 
    var startAt = 0;
    var total = 50  
    async.whilst(
        function () { return startAt < total; },
        function (callback) {
            request({
                url: 'https://issues.qup.vn/rest/api/2/search?startAt='+startAt+'&jql=Sprint in (291,292,293)',
                timeout: 10000,
                json: true,
                headers: {
                    "Authorization": req.headers.authorization
                }
            }, function(error, response, result){
                if (result && result.total) {                                           
                    total = result.total;
                    startAt += 50;
                    async.forEachLimit(result.issues, 10, function(issue, cback){ 
                        var issuetype = _.get(issue, "fields.issuetype.name", "unknown");
                        var issuestatus = _.get(issue, "fields.status.name", "unknown");
                        finish.issuetypes = _.uniq(finish.issuetypes.push(issuetype));
                        var components = _.get(issue, "fields.components", []);
                        if (issue.fields.subtasks.length == 0) {
                            components.forEach(function(component){
                                if (finish.components[component.name]) {
                                    finish.components[component.name].total++;
                                    if (finish.components[component.name][issuestatus]) {
                                        finish.components[component.name][issuestatus]++;
                                    } else {
                                        finish.components[component.name][issuestatus] = 1;
                                    }
                                } else {
                                    finish.components[component.name] = {
                                        total: 1
                                    }
                                    finish.components[component.name][issuestatus] = 1;
                                }
                            })
                        }
                        if (issuetype === "Story") {
                            finish.point += _.get(issue, "fields.customfield_10004", 0);
                        }
                        if(finish.issues.status[issuestatus]) {
                            finish.issues.status[issuestatus]++;
                        } else {
                            finish.issues.status[issuestatus] = 1;
                        }
                        finish.issues.total++;
                        finish.issues[issuetype] = finish.issues[issuetype] ? finish.issues[issuetype] + 1 : 1;
                        //get log work info
                        jira_utils.getWorklog(issue.key, req.headers.authorization, function(err, rs){
                            if (rs && rs.length) {
                                rs.forEach(function(worklog){
                                    var dateCreated = new moment(worklog.created).format('YYYY-MM-DD');
                                    finish.users[worklog.name] = finish.users[worklog.name] || {total: 0};
                                    finish.users[worklog.name].total += worklog.timeSpentSeconds;
                                    finish.users[worklog.name][issuetype] = finish.users[worklog.name][issuetype] || 0;
                                    finish.users[worklog.name][issuetype] += worklog.timeSpentSeconds;
                                    
                                    //barchart         
                                    finish.barChartLogworkData.labels.push(worklog.name)
                                    var users = _.uniq(finish.barChartLogworkData.labels);                                    
                                    finish.barChartLogworkData.labels = users;
                                    var labelIndex = _.indexOf(users, worklog.name);
                                    var datasetIndex = _.findIndex(finish.barChartLogworkData.datasets, function(o) { return o.label == issuetype; });
                                    if (datasetIndex == -1) {
                                        finish.barChartLogworkData.datasets.push({
                                            label: issuetype,
                                            backgroundColor: colors.issuetypes[finish.barChartLogworkData.datasets.length].code,
                                            data: []
                                        });  
                                        datasetIndex =  _.findIndex(finish.barChartLogworkData.datasets, function(o) { return o.label == issuetype; });                                    
                                    }
                                    if(!finish.barChartLogworkData.datasets[datasetIndex].data[labelIndex]) {
                                        finish.barChartLogworkData.datasets[datasetIndex].data[labelIndex] = 0;
                                    }
                                    finish.barChartLogworkData.datasets[datasetIndex].data[labelIndex] += worklog.timeSpentSeconds;

                                    finish.dates[dateCreated] = finish.dates[dateCreated] || {};
                                    finish.dates[dateCreated][worklog.name] = finish.dates[dateCreated][worklog.name] || {total: 0};
                                    finish.dates[dateCreated][worklog.name].total += worklog.timeSpentSeconds;
                                    finish.dates[dateCreated][worklog.name][issuetype] = finish.dates[dateCreated][worklog.name][issuetype] || 0;
                                    finish.dates[dateCreated][worklog.name][issuetype] += worklog.timeSpentSeconds;
                                })
                            }
                            console.log(finish.issues.total +"/"+ result.total)
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
            //remove null value in datasets.data
            finish.barChartLogworkData.datasets = _.map(finish.barChartLogworkData.datasets, function(dataset) { 
                return {
                    label: dataset.label,
                    backgroundColor: dataset.backgroundColor,
                    data: _.map(dataset.data, function(dts) { 
                        if (!dts) {
                            return 0;
                        } else {
                            return (dts/60/60);
                        }                        
                    })
                }                
            });
            var components = _.keys(finish.components);
            var issuestatus = _.keys(finish.issues.status);
            var datasets = [];  
            for(var i in issuestatus) {
                datasets.push({
                    "label": issuestatus[i],
                    "backgroundColor": colors.issuestatus[i].code || "rgb(255, 99, 132)",
                    "data": _.map(components, function(component){
                        return finish.components[component][issuestatus[i]] || 0;
                    })
                })
            }          
            finish.barChartComponentData = {
                labels: components,
                datasets: datasets
            } 
            console.log(JSON.stringify(finish));
        }
    );
    var barChartLogworkData = [[
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
    res.send(barChartLogworkData);
})
app.get('/', function(req, res){
    res.sendFile(__dirname + '/public/full.html');
})
const port = process.env.PORT || 3000;
http.listen(port, function () {
    console.log('App is running on ' + port);
}); 
