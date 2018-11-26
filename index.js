const express = require('express');
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
]
app.get('/sample', function(req, res){
    var barChartData = [[
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
    res.send(barChartData);
})
app.get('/', function(req, res){
    res.sendFile(__dirname + '/public/index.html');
})
http.listen(3000, function () {
    console.log('App is running on ' + 3000);
}); 