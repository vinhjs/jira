var gami = require('../gamification');
module.exports = function(app){
    app.get('/gifts', function(req, res){
        if (req.query && req.query.items) {
            items = req.query.items.split(",");
            if (items && items.length){
                gami.checkGifts(items, function(gifts){
                    console.log(req.query.items.split(","));
                    res.render('gifts', {gifts, items});
                    // res.send(gifts);
                })
            }
        }
        
    })
}