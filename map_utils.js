var fs = require('fs');
fs.readFile(__dirname + '/database.json', 'utf8', function(err, data){
    try {
        data = JSON.parse(data);
        buidLogWorkByDate(data.users, data.times)
    } catch (ex) {
        console.log(ex);
    }
});
var _ = require('lodash');
var moment = require("moment");
var colors = require('./colors');
function buidLogWorkByDate(users, times){
    var timeFormat = 'MM/DD/YYYY HH:mm';
    
}