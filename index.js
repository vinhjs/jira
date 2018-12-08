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
var jiraDomain = 'https://issues.qup.vn';
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
app.post('/sample', authMiddleware, function(req, res){
    var finish = {
        jiraDomain: jiraDomain,
        issuetypes: [],
        point: 0,
        issues: {
            total: 0,
            status: {}
        },
        users: {},
        dates: {},
        components: {},
        fouls: [],
        mydata: {
            logwork: []
        },
        logwork: [],
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
    // var jql= "project in (SL, KAN) AND updated >= -2w";
    var jql= req.body.jql || "Sprint in (291,292,293)";
    var totalResult = [];
    var total = 0;
    var count = 0;
    jira_utils.searchJQL(startAt, jql, req.headers.authorization, true, function(err, rs){
        var result = rs.search;
        finish.session = rs.session;
        if (result && result.total) {   
            totalResult = _.union(totalResult, result.issues);
            total = result.total;
            startAt += 100;
            var tmp = [];
            if(total>100){                                
                while(startAt <= total){
                    tmp.push(startAt);
                    startAt += 100;
                }
            }
            if (tmp.length) {
                async.forEachLimit(tmp, 5, function(startAt, cback){
                    jira_utils.searchJQL(startAt, jql, req.headers.authorization, false, function(err, rs){
                        var result = rs.search;
                        if (result && result.total) {   
                            totalResult = _.union(totalResult, result.issues);
                        }
                        cback();
                    })
                }, function(){
                    finishSearch();
                })
            }
        } else {
            finishSearch()
        }
    })
    function finishSearch(){
        async.forEachLimit(totalResult, 10, function(issue, cback){
            var issuetype = _.get(issue, "fields.issuetype.name", "unknown");
            var issuestatus = _.get(issue, "fields.status.name", "unknown");
            finish.issuetypes = _.uniq(finish.issuetypes.push(issuetype));
            var components = _.get(issue, "fields.components", []);
            if (issue.fields.subtasks.length == 0) {
                var timespent = _.get(issue, "fields.timespent", 0);
                if (!timespent && _.indexOf(["Story"], issuetype) == -1 && _.indexOf(["Open", "Closed", "In Progress"], issuestatus) == -1) {
                    if(issue.fields.assignee) {
                        finish.fouls.push({
                            issueLink: jiraDomain + '/browse/' + issue.key,
                            summary:  issue.fields.summary,
                            key:  issue.key,
                            user: issue.fields.assignee.name,
                            avatar: issue.fields.assignee.avatarUrls["24x24"],
                            msg: "No logwork"
                        })
                    }                                        
                }
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
                });
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
            jira_utils.getWorklog(issue.fields.updated, issue.key, req.headers.authorization, function(err, rs){
                count++;
                if (rs && rs.length) {
                    rs.forEach(function(worklog){
                        if (worklog.name == finish.session.name) {
                            finish.mydata.logwork.push({
                                key: issue.key,
                                time: worklog.created,
                                timespent: (worklog.timeSpentSeconds/60) + ' minutes'
                            });
                        }
                        var duration = moment.duration(new moment().diff(moment(worklog.created.slice(0,19), "YYYY-MM-DDTHH:mm:ss")));
                        var days = duration.asDays();
                        if(days<=3) {
                            finish.logwork.push({
                                name: worklog.name,
                                key: issue.key,
                                issueLink: jiraDomain + '/browse/' + issue.key,
                                summary: issue.fields.summary,
                                time: worklog.created,
                                timespent: (worklog.timeSpentSeconds/60) + ' minutes'
                            })
                        }                        
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
                // console.log(issue.key + ' ' + count +"/"+ total)
                cback();
            })
        }, function(){
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
                });
            }          
            finish.barChartComponentData = {
                labels: components,
                datasets: datasets
            }
            finish.fouls = _.sortBy(finish.fouls, [function(o) { return o.user; }]);
            finish.mydata.logwork = _.sortBy(finish.mydata.logwork, [function(o) { return o.time; }]);
            finish.logwork = _.sortBy(finish.logwork, [function(o) { return o.name; }]);
            res.send(finish);
        })
    }
});
app.get('/', function(req, res){
    res.sendFile(__dirname + '/public/full.html');
})
const port = process.env.PORT || 3001;
http.listen(port, function () {
    console.log('App is running on ' + port);
}); 
