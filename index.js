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
var jira_utils = require('./jira_utils');
var colors = require('./colors');
var gamification = require('./gamification');
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

//Configs
var jiraDomain = 'https://issues.qup.vn';
var startDate = moment("2019-07-01T00:00:00", "YYYY-MM-DDTHH:mm:ss")
//==End configs
app.get('/histories', function(req, res){
    jira_utils.getHistory(function(error, data){
        res.send({error, data})
    });
});
var groups = {
    server: '"vinh.tran","thuan.ho","chuong.vo","chuong.nguyen","hoang.nguyen","nhan.phan","nghia.huynht","vi.leh"',
    web: '"huy.nguyen","vi.phantt","thuan.le","dat.huynh","dat.pham","hoang.dinh","oanh.nguyentl"',
    app: '"duy.phan","dung.nguyen","hao.le","phuong.tran","nhuan.vu","hien.do","tam.nguyen","khue.nguyennd","quyen.phanh"',
}
var jqls = [
    "project in (SL, KAN, QS, QQA)&expand=changelog",
    'Sprint in (319,320,321) AND project = "Scrum Lab"&expand=changelog',
    '(Sprint = 321 AND project = "Scrum Lab") OR (project = "QA Operations" AND assignee in ('+groups.server+') AND updated >= 2019-07-01)&expand=changelog',
    '(Sprint = 319 AND project = "Scrum Lab") OR (project = "QA Operations" AND assignee in ('+groups.web+') AND updated >= 2019-07-01)&expand=changelog',
    '(Sprint = 320 AND project = "Scrum Lab") OR (project = "QA Operations" AND assignee in ('+groups.app+') AND updated >= 2019-07-01)&expand=changelog'
];
var whatsapp = require('./whatsapp');
app.get('/test', function(req, res){
    if (req.query.id){
        return res.send({id:1});
    }
    console.log('======');
    res.send({id:2});
})
app.post('/jql', authMiddleware, function(req, res){
    var username = Buffer.from(req.headers.authorization.split(" ")[1], 'base64').toString('ascii').split(":")[0];
    jira_utils.addHistory(username, req.body.jql);   
    whatsapp.send(username + " " + req.body.jql);
    var finish = {
        jiraDomain: jiraDomain,
        issuetypes: [],
        point: 0,
        issues: {
            total: 0,
            status: {},
            types: {}
        },
        users: {},
        dates: {},
        eta: {},
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
    var jqlIndex = 0;
    try {
        jqlIndex = parseInt(req.body.jql);
    } catch (ex) {
        console.log(ex);
    }
    var jql= jqls[jqlIndex] || "project in (SL, KAN, QS, QQA) AND updated >= -2w&expand=changelog";
    if (jqlIndex == 0) {
        jql = "project in (SL, KAN, QS, QQA)";
        jql+=" AND updated >= 2019-07-01&expand=changelog";
    }
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
            } else {
                finishSearch();
            }
        } else {
            finishSearch();
        }
    })
    function finishSearch(){
        async.forEachLimit(totalResult, 10, function(issue, cback){
            var issuetype = _.get(issue, "fields.issuetype.name", "unknown");
            var issuestatus = _.get(issue, "fields.status.name", "unknown");
            var assigneeName = _.get(issue, 'fields.assignee.name', "");
            finish.issuetypes = _.uniq(finish.issuetypes.push(issuetype));
            var components = _.get(issue, "fields.components", []);
            var project = _.get(issue, "fields.project.key", '');
            var timeestimate = _.get(issue, 'fields.timeestimate', 0);
            var duedate = _.get(issue, 'fields.duedate', null);
            if (timeestimate == 0) {
                timeestimate = _.get(issue, 'fields.timeoriginalestimate', 0);
            }
            
            if (issue.fields.subtasks.length == 0) {
                checkChangelog(function(){

                })
                if (!duedate && assigneeName && project == "SL" && _.indexOf(["Open", "In Progress"], issuestatus) > -1){
                    finish.fouls.push({
                        issueLink: jiraDomain + '/browse/' + issue.key,
                        issuesTypeIconUrl: _.get(issue, "fields.issuetype.iconUrl", ""),
                        summary:  issue.fields.summary,
                        key:  issue.key,
                        user: assigneeName,
                        avatar: issue.fields.assignee.avatarUrls["24x24"],
                        msg: "No duedate"
                    })
                }
                var timespent = _.get(issue, "fields.timespent", 0);
                if (!timespent && _.indexOf(["Story"], issuetype) == -1 && _.indexOf(["Open", "Closed", "In Progress"], issuestatus) == -1) {
                    if(issue.fields.assignee) {
                        finish.fouls.push({
                            issueLink: jiraDomain + '/browse/' + issue.key,
                            issuesTypeIconUrl: _.get(issue, "fields.issuetype.iconUrl", ""),
                            summary:  issue.fields.summary,
                            key:  issue.key,
                            user: assigneeName,
                            avatar: issue.fields.assignee.avatarUrls["24x24"],
                            msg: "No logwork"
                        })
                    }                                        
                }
                if (!timeestimate && _.indexOf(["Story"], issuetype) == -1 && project == "SL" && _.indexOf(["Open", "In Progress"], issuestatus) > -1){
                    if(issue.fields.assignee) {
                        finish.fouls.push({
                            issueLink: jiraDomain + '/browse/' + issue.key,
                            issuesTypeIconUrl: _.get(issue, "fields.issuetype.iconUrl", ""),
                            summary:  issue.fields.summary,
                            key:  issue.key,
                            user: assigneeName,
                            avatar: issue.fields.assignee.avatarUrls["24x24"],
                            msg: "No estimate"
                        })
                    } 
                }
                if (timeestimate && (timeestimate/60/60) > 8 && _.indexOf(["Story"], issuetype) == -1) {
                    if(issue.fields.assignee) {
                        finish.fouls.push({
                            issueLink: jiraDomain + '/browse/' + issue.key,
                            issuesTypeIconUrl: _.get(issue, "fields.issuetype.iconUrl", ""),
                            summary:  issue.fields.summary,
                            key:  issue.key,
                            user: assigneeName,
                            avatar: issue.fields.assignee.avatarUrls["24x24"],
                            msg: "Estimate over 8h"
                        })
                    } 
                }
                components.forEach(function(component){
                    if (project == "SL" || project == "KAN") {
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
                    }
                });
            }
            if (issuetype === "Story") {
                finish.point += _.get(issue, "fields.customfield_10004", 0);
            } else if (assigneeName && timeestimate){
                finish.point += _.get(issue, "fields.customfield_10004", 0);
                //get estimate time
                finish.barChartLogworkData.labels.push(assigneeName);
                var users = _.uniq(finish.barChartLogworkData.labels);                                    
                finish.barChartLogworkData.labels = users;
                if (finish.eta[assigneeName]) {
                    finish.eta[assigneeName] += timeestimate /60/60;
                } else {
                    finish.eta[assigneeName] = timeestimate /60/60;
                }
            }
            if(finish.issues.status[issuestatus]) {
                finish.issues.status[issuestatus]++;
            } else {
                finish.issues.status[issuestatus] = 1;
            }
            finish.issues.total++;
            if (finish.issues.types[issuetype]) {
                finish.issues.types[issuetype]++;
            } else {
                finish.issues.types[issuetype] = 1;
            }
            gamification.checkStatus(issuestatus, assigneeName, project, issue.key);
            function checkChangelog(cb){
                var changelog = _.get(issue, 'changelog.histories', []);
                changelog.forEach(function(ch){
                    if (ch.items && ch.items.length) {
                        ch.items.forEach(function(item){
                            if (item.field == "status" && item.toString == "Done") {
                                console.log(assigneeName + " get an item ", issue.key, ch.created);
                            }
                        })
                    }
                })
                cb();
            }
            
            function getWorklog(cb){
                //get log work info
                jira_utils.getWorklog(startDate, issue.fields.updated, issue.key, req.headers.authorization, function(err, rs){
                    count++;
                    if (rs && rs.length) {
                        rs.forEach(function(worklog){
                            if (worklog.name == finish.session.name) {
                                finish.mydata.logwork.push({
                                    key: issue.key,
                                    comment: worklog.comment,
                                    time: worklog.started,
                                    timespent: (worklog.timeSpentSeconds/60) + ' minutes'
                                });
                            }
                            var duration = moment.duration(new moment().diff(moment(worklog.started.slice(0,19), "YYYY-MM-DDTHH:mm:ss")));
                            var days = duration.asDays();
                            if(days<=3) {
                                var timespent = (worklog.timeSpentSeconds/60);
                                finish.logwork.push({
                                    name: worklog.name,
                                    key: issue.key,
                                    status: issuestatus,
                                    issueLink: jiraDomain + '/browse/' + issue.key,
                                    issuesTypeIconUrl: _.get(issue, "fields.issuetype.iconUrl", ""),
                                    summary: issue.fields.summary,
                                    comment: worklog.comment,
                                    date: moment(worklog.started.slice(0,19), "YYYY-MM-DDTHH:mm:ss").format("YYYY-MM-DD"),
                                    time: moment(worklog.started.slice(0,19), "YYYY-MM-DDTHH:mm:ss").format("YYYY-MM-DD HH:mm"),
                                    timespent: timespent < 60 ? (timespent + ' minutes') : (timespent /60 + " hours")
                                })
                            }                        
                            var dateStarted = new moment(worklog.started.slice(0,19), "YYYY-MM-DDTHH:mm:ss").format('YYYY-MM-DD');
                            finish.users[worklog.name] = finish.users[worklog.name] || {total: 0};
                            finish.users[worklog.name].total += worklog.timeSpentSeconds;
                            finish.users[worklog.name][issuetype] = finish.users[worklog.name][issuetype] || 0;
                            finish.users[worklog.name][issuetype] += worklog.timeSpentSeconds;
                            
                            //barchart         
                            finish.barChartLogworkData.labels.push(worklog.name);
                            var users = _.uniq(finish.barChartLogworkData.labels);                                    
                            finish.barChartLogworkData.labels = users;
                            var labelIndex = _.indexOf(users, worklog.name);
                            var datasetIndex = _.findIndex(finish.barChartLogworkData.datasets, function(o) { return o.label == issuetype; });
                            if (datasetIndex == -1) {
                                finish.barChartLogworkData.datasets.push({
                                    label: issuetype,
                                    stack: 'Stack 0',
                                    backgroundColor: colors.issuetypes[finish.barChartLogworkData.datasets.length].code,
                                    data: []
                                });  
                                datasetIndex =  _.findIndex(finish.barChartLogworkData.datasets, function(o) { return o.label == issuetype; });                                    
                            }
                            if(!finish.barChartLogworkData.datasets[datasetIndex].data[labelIndex]) {
                                finish.barChartLogworkData.datasets[datasetIndex].data[labelIndex] = 0;
                            }
                            finish.barChartLogworkData.datasets[datasetIndex].data[labelIndex] += worklog.timeSpentSeconds;

                            finish.dates[dateStarted] = finish.dates[dateStarted] || {};
                            finish.dates[dateStarted][worklog.name] = finish.dates[dateStarted][worklog.name] || {total: 0};
                            finish.dates[dateStarted][worklog.name].total += worklog.timeSpentSeconds;
                            finish.dates[dateStarted][worklog.name][issuetype] = finish.dates[dateStarted][worklog.name][issuetype] || 0;
                            finish.dates[dateStarted][worklog.name][issuetype] += worklog.timeSpentSeconds;
                        })
                    }
                    // console.log(issue.key + ' ' + count +"/"+ total)
                    cb();
                })
            }
            async.parallel([
                function(cback){
                    getWorklog(function(){
                        cback();
                    })
                },
                function(cback){
                    //Check missed sub-task
                    if (project == "SL" && jqlIndex != 0) {
                        var componentsName = _.map(components, 'name');
                        if (components.length == 0){
                            //missed components
                            finish.fouls.push({
                                issueLink: jiraDomain + '/browse/' + issue.key,
                                issuesTypeIconUrl: _.get(issue, "fields.issuetype.iconUrl", ""),
                                summary:  issue.fields.summary,
                                key:  issue.key,
                                user: assigneeName,
                                avatar: issue.fields.assignee.avatarUrls["24x24"],
                                msg: "Missed component"
                            })
                            cback();
                        } else {
                            if (issuetype == "Story" && _.get(issue, "fields.customfield_10004", 0)) {
                                async.forEach(issue.fields.subtasks, function(subtask, cback){
                                    jira_utils.getComponent(subtask.key, req.headers.authorization, function(err, cps){
                                        componentsName = _.pullAll(componentsName, cps);
                                        cback();
                                    })
                                }, function(){
                                    if (componentsName.length) {
                                        finish.fouls.push({
                                            issueLink: jiraDomain + '/browse/' + issue.key,
                                            issuesTypeIconUrl: _.get(issue, "fields.issuetype.iconUrl", ""),
                                            summary:  issue.fields.summary,
                                            key:  issue.key,
                                            user: assigneeName,
                                            avatar: issue.fields.assignee.avatarUrls["24x24"],
                                            msg: "Missed subtask " + componentsName
                                        })
                                    }
                                    cback();
                                })
                            } else {
                                cback();
                            }
                        }
                    } else {
                        cback();
                    }
                    //===========
                }
            ], function(){
                cback();
            })
        }, function(){
            console.log('DONE');
            //remove null value in datasets.data
            var lenDataLabels = finish.barChartLogworkData.labels.length;
            finish.barChartLogworkData.datasets = _.map(finish.barChartLogworkData.datasets, function(dataset) { 
                var data = [];                
                for(var i = 0; i<lenDataLabels; i++) {
                    data.push(dataset.data[i] ? dataset.data[i]/60/60 : 0);
                }
                return {
                    label: dataset.label,
                    stack: "Stack 0",
                    backgroundColor: dataset.backgroundColor,
                    data: data
                }                
            });
            var stack1 = [];
            for (var i in finish.barChartLogworkData.labels) {
                if (finish.eta[finish.barChartLogworkData.labels[i]]) {
                    stack1.push(finish.eta[finish.barChartLogworkData.labels[i]]);
                } else {
                    stack1.push(0);
                }
            }
            finish.barChartLogworkData.datasets.push({
                label: 'Estimate',
                stack: 'Stack 1',
                backgroundColor: "rgb(0, 0, 255)",
                data: stack1
            })
            var components = _.keys(finish.components);
            var issuestatus = _.keys(finish.issues.status);
            var issuetypes = _.keys(finish.issues.types);
            var datasetsBarChartComponent = [];  
            var datasetsDoughnutChartStatus = [{
                data: [],
                backgroundColor: []
            }];  
            var datasetsDoughnutChartTypes = [{
                data: [],
                backgroundColor: []
            }];  
            for(var i in issuestatus) {
                datasetsBarChartComponent.push({
                    "label": issuestatus[i],
                    "backgroundColor": colors.issuestatus[i].code || "rgb(255, 99, 132)",
                    "data": _.map(components, function(component){
                        return finish.components[component][issuestatus[i]] || 0;
                    })
                });
                datasetsDoughnutChartStatus[0].data.push(finish.issues.status[issuestatus[i]]);
                datasetsDoughnutChartStatus[0].backgroundColor.push(colors.issuestatus[i].code || "rgb(255, 99, 132)");
            }   
            for(var i in issuetypes) {
                datasetsDoughnutChartTypes[0].data.push(finish.issues.types[issuetypes[i]]);
                datasetsDoughnutChartTypes[0].backgroundColor.push(colors.issuetypes[i].code || "rgb(255, 99, 132)");
            }
            finish.doughnutChartStatusData = {
                labels: issuestatus,
                datasets: datasetsDoughnutChartStatus
            }   
            finish.doughnutChartTypesData = {
                labels: issuetypes,
                datasets: datasetsDoughnutChartTypes
            }       
            finish.barChartComponentData = {
                labels: components,
                datasets: datasetsBarChartComponent
            }
            finish.fouls = _.sortBy(finish.fouls, [function(o) { return o.user; }]);
            finish.mydata.logwork = _.sortBy(finish.mydata.logwork, [function(o) { return o.time; }]);
            finish.logwork = _.orderBy(finish.logwork, ['date', 'name'], ['asc', 'desc']);
            gamification.getLeaderBoard(function(err, list){
                finish.leaderboard = list;
                res.send(finish);
            })
        })
    }
});
app.get('/', function(req, res){
    res.sendFile(__dirname + '/public/full.html');
})
require('./router/activities')(app);
const port = process.env.PORT || 3001;
http.listen(port, function () {
    console.log('App is running on ' + port);
}); 
