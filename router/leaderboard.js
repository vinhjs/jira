var gami = require('../gamification');
module.exports = function(app){
    app.get('/leaderboard', function(req, res){
        gami.getLeaderBoard(function(err, list){
            // console.log(JSON.stringify(list));
            res.render('leaderboard', {list: list})
        })
        
    })
}