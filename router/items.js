var gami = require('../gamification');
module.exports = function(app){
    app.get('/items', function(req, res){
        gami.getItems(function(err, items){
            res.render('items', {items});
        })
    })
}