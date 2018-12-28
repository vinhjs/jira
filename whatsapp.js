const accountSid = 'ACa62476ab336efb6bae11e245dc806320'; 
const authToken = '34f53c7aec7710de40b7fca2ee3fbd94'; 
const client = require('twilio')(accountSid, authToken); 

function send(body){
  client.messages 
  .create({ 
     body: body, 
     from: 'whatsapp:+14155238886',       
     to: 'whatsapp:+84988973102' 
   }) 
  .then(message => console.log(message.sid)) 
  .done();
}

module.exports = {send};
