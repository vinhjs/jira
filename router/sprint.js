var jira_utils = require('../jira_utils');
var async = require('async');
var _ = require('lodash');
var moment = require('moment');
var auth = require('http-auth');
var request = require('request');
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


var jqlTemplate = {
	"37": 'Sprint in (331, 332, 333) AND issuetype in (Task, Improvement, Story)&expand=changelog',
	"38": 'Sprint in (335,336,337) AND issuetype in (Task, Improvement, Story)&expand=changelog',
};
var des = {
	"S38-1": "Setting to hide payment methods on Driver App before P.O.B",
	"S38-2": "Corp project",
	"S38-3": "P.O.B distance too far",
	"S38-4": "Limit DO by country",
	"S38-5": "Asking driver to join queue when driver travel into queue area",
	"S38-6": "Support multiple wallets for Driver & Pax to top up",
	"S38-7": "Integrate PayMaYa for Avis driver to top up credit wallet",
	"S38-8": "Search accounts by 'Module Search' instead of query MongoDB - Customer/Driver",
	"S38-9": "Hydra - Enhance 'Cue' - actions Them task cho DMC & CC"
}
module.exports = function (app) {
	app.get('/sprint', authMiddleware, function (req, res) {
		var finish = {
			others: []
		};
		var jql = jqlTemplate[req.query.s || "38"];
		if (jql) {
			var startAt = 0;
			jira_utils.searchJQL(startAt, jql, req.headers.authorization, true, function (err, rs) {
				var result = rs.search;
				var totalResult = [];
				var total = 0;
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
					function finishSearch(){
						async.forEachLimit(totalResult, 10, function(issue, cback){
								var issuetype = _.get(issue, "fields.issuetype.name", "unknown");
								var issuestatus = _.get(issue, "fields.status.name", "unknown");
								var assigneeName = _.get(issue, 'fields.assignee.name', "");
								var components = _.get(issue, "fields.components", []);
								var project = _.get(issue, "fields.project.key", '');
								var timeestimate = _.get(issue, 'fields.timeestimate', 0);
								var duedate = _.get(issue, 'fields.duedate', null);
								var issuelabels = _.get(issue, 'fields.labels', []);
								var point = _.get(issue, "fields.customfield_10004", 0);
								var changelog = _.get(issue, "changelog.histories", []);
								//duedate
								if (true){
									// checkDueDate(issue, req.headers.authorization);
									var link = "";
									if (issuetype == "Improvement") {
										link = "Improvement";
									}
									issuelabels.forEach(function(label){
										if (label.indexOf("S36-") != -1) {
											link = label;
										}
										if (label.indexOf("S37-") != -1) {
											link = label;
										}
										if (des[label]) {
											link = des[label];
										}
										if (label.indexOf("Automation") != -1) {
											link = label;
										}
										if (label.indexOf("CloneApp") != -1) {
											link = label;
										}
										
										if (label.indexOf("Improvement") != -1) {
											link = label;
										}
									})
									var subtasks = _.map(issue.fields.subtasks, 'key', []);
									var tmp = {
										summary: issue.fields.summary,
										key: issue.key,
										point: point,
										subtasks: subtasks,
										status: issuestatus,
										aggregatetimespent: issue.fields.aggregatetimespent || 0,
										aggregateprogress: issue.fields.aggregateprogress,
										progress: issue.fields.progress,
										duedate: duedate,
										overduedate: moment.duration(new moment(duedate, 'YYYY-MM-DD').diff(new moment())).asDays(),
										originduedate: ""
									};
									switch (issuestatus) {
										case "Done":
										case "Closed":
										case "In Lab":
										case "In Beta":
											tmp.backgroundColor = "#c7ffc6";
											break;
										default:
											tmp.backgroundColor = "white" 
									}
									changelog.forEach(function(ch){
										if (ch.items && ch.items.length) {
											ch.items.forEach(function(item){
												if (item.field == "duedate" && item.fromString == null && item.toString) {
													tmp.originduedate = item.to
												}
											})
										}
									})
									if (link) {
										if (finish[link]) {
											finish[link].push(tmp)
										} else {
											finish[link] = [tmp]
										}
									} else {
										finish.others.push(tmp);
									}
									
									cback();
								} else {
									// issuelabels.forEach(function(label){
									// 	if (label.indexOf("S36-") != -1) {
									// 		checkDueDate(issue, req.headers.authorization);
									// 	}
									// })
									cback();
								}
						}, function(){
							var keys = _.keys(finish);
							keys.forEach(function(key){
								finish[key] = _.sortBy(finish[key], ['status','duedate']);
							})
							console.log("DONE");
							res.render('sprint', {finish, keys})
						})
					}
				} else {
					res.send('not found issues');
				}
			})
		} else {
			res.send("invalid params");
		}
	})
}

function checkDueDate(issue, auth){
	// var duedate = _.get(issue, 'fields.duedate', null);
	// if (!duedate) {
		var lastDuedate = null;
		async.forEach(issue.fields.subtasks, function(subtask, cback){
			jira_utils.getIssueInfo(subtask.key, auth, function(err, result){
				var duedate_subtask = _.get(result, 'fields.duedate', null);
				if (duedate_subtask) {
					if (!lastDuedate) {
						lastDuedate = new moment(duedate_subtask, "YYYY-MM-DD");
					} else {
						var currentDuedate = new moment(duedate_subtask, "YYYY-MM-DD");
						if (currentDuedate > lastDuedate) {
							lastDuedate = currentDuedate;
						}
					}
					cback();
				} else {
					cback();
				}
			})
		}, function(){
			if (lastDuedate) {
				console.log("Duedate", issue.key, lastDuedate.format("YYYY-MM-DD"));
				jira_utils.updateDuedate(issue.key, lastDuedate.format("YYYY-MM-DD"), auth, function(){})
			}
		})
	// }
}
function checkStory(issue, auth, cb){
	async.forEach(issue.fields.subtasks, function(subtask, cback){
		jira_utils.getIssueInfo(subtask.key, auth, function(err, result){
			if (!err && result) {
				var timeestimate = _.get(issue, 'fields.timeestimate', 0);
				var duedate = _.get(issue, 'fields.duedate', null);
				var aggregatetimespent = _.get(issue, 'fields.aggregatetimespent', 0);
			} else {
				cback();
			}
		})
	}, function(){
		cb
	})
}