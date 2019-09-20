var gami = require('../gamification');
module.exports = function(app){
    app.get('/leaderboard', function(req, res){
        console.log(new Date().toISOString(), "/leaderboard", req.query);
        gami.getLeaderBoard(req.query, function(err, list){
            // console.log(JSON.stringify(list));
            res.render('leaderboard', {list: list})
        })
        
    })
}