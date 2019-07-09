var gami = require('../gamification');
module.exports = function(app){
    app.get('/activities', function(req, res){
        var username = req.query.username;
        gami.getActivities(username, function(err, list){
            var html = "";
            list.forEach(element => {
                element = JSON.parse(element);
                html += "<br>" + element.msg;
            });
            res.send(html);
        })
    })
}