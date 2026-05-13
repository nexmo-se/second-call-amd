'use strict'

//-------------

require('dotenv').config();

//--
const express = require('express');
const bodyParser = require('body-parser')
const app = express();

app.use(bodyParser.json());

//---- CORS policy - Update this section as needed ----

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "OPTIONS,GET,POST,PUT,DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
  next();
});

//-------

const servicePhoneNumber = process.env.SERVICE_PHONE_NUMBER;
console.log("Service phone number:", servicePhoneNumber);

const pstnCalleeNumber1 = process.env.PSTN_CALLEE_NUMBER_1;
console.log("First PSTN phone number:", pstnCalleeNumber1);

const pstnCalleeNumber2 = process.env.PSTN_CALLEE_NUMBER_2;
console.log("Second PSTN phone number:", pstnCalleeNumber2);

//--- Vonage API ---

const { Auth } = require('@vonage/auth');

const credentials = new Auth({
  apiKey: process.env.API_KEY,
  apiSecret: process.env.API_SECRET,
  applicationId: process.env.APP_ID,
  privateKey: './.private.key'    // private key file name with a leading dot 
});

// const apiBaseUrl = "https://" + process.env.API_REGION;

// const options = {
//   apiHost: apiBaseUrl
// };

const { Vonage } = require('@vonage/server-sdk');

// const vonage = new Vonage(credentials, options);
const vonage = new Vonage(credentials);


// Use for direct REST API calls - Sample code
// const appId = process.env.APP_ID; // used by tokenGenerate
// const privateKey = fs.readFileSync('./.private.key'); // used by tokenGenerate
// const { tokenGenerate } = require('@vonage/jwt');

//============= Initiating outbound PSTN call ===============

//-- use case where the first PSTN call is outbound
//-- manually trigger outbound PSTN call to "callee" number - see sample request below
//-- establish first the WebSocket leg before the PSTN leg
//-- sample request: https://<server-address>/startcall?callee=12995550101
//-- or https://<server-address>/startcall
app.get('/startcall', async(req, res) => {

  res.status(200).send('Ok');

  const hostName = req.hostname;

  vonage.voice.createOutboundCall({
    to: [{
      type: 'phone',
      number: pstnCalleeNumber1
    }],
    from: {
      type: 'phone',
      number: servicePhoneNumber
    },
    event_url: ['https://' + hostName + '/event_1'],
    event_method: 'POST',
    ncco: [
      {
        "action": "connect",
        "eventUrl": ["https://" + hostName + "/event_2"],
        "eventMethod": "POST",  
        "timeout": "45",
        "from": servicePhoneNumber,
        "endpoint": [
          {
            "type": "phone",
            "number": pstnCalleeNumber2
          }
        ],
        "advanced_machine_detection": {
          "behavior": "continue",
          "mode": "default"  // use this value for the latest AMD implementation
          // "beepTimeout": 10
        }
      }
    ]
    })
    .then(res => console.log(">>> PSTN create status:", res))
    .catch(err => console.error(">>> PSTN create status:", err));

});

//--------------------

app.post('/event_1', async(req, res) => {

  res.status(200).send('Ok');

});

//--------------------  

app.post('/event_2', (req, res) => {

  let nccoResponse = [{}];

  //-- You may uncomment this section
  // //-- AMD returns status machine 
  // if (req.body.status == "machine" && req.body.sub_state == undefined) {
  //   console.log('>>> /event1 status: "machine"');
  //   nccoResponse = [
  //     {
  //       "action": "talk",
  //       "text": "Status machine has been detected. Generally, in real deployment, no new message would be played on this event.",
  //       "language": "en-US",
  //       "style": 0
  //     }
  //   ];
  // };

  //-- You may uncomment this section
  // //-- AMD returns status human
  // if (req.body.status == "human") {
  //   console.log('>>> /event1 status: "human"');
  //   nccoResponse = [
  //     {
  //       "action": "talk",
  //       "text": "Status human has been detected. Generally, in real deployment, no new message would be played on this event.",
  //       "language": "en-US",
  //       "style": 0
  //     }
  //   ];
  // };

  //-- Beep detected
  if (req.body.status == "machine" && req.body.sub_state == "beep_start") {
    console.log('>>> /event1 status: "machine", sub_state: "beep_start"');
    nccoResponse = [
      {
        "action": "talk",
        "text": "This is the voice message for the recipient",
        "language": "en-US",
        "style": 0
      }
    ];
  }

  //-- You may uncomment this section
  // //-- No beep detected after timeout to detect beep has expired
  // if (req.body.status == "machine" && req.body.sub_state == "beep_timeout") {
  //   console.log('>>> /event1 status: "machine", sub_state: "beep_timeout"');
  //   nccoResponse = [
  //     {
  //       "action": "talk",
  //       "text": "No beep has been detected. Generally, in real deployment, no new message would be played on this event.",
  //       "language": "en-US",
  //       "style": 0
  //     }
  //   ];
  // };
  
  res.status(200).json(nccoResponse);

});

//=========================================

const port = process.env.VCR_PORT || process.env.PORT || 8000;

app.listen(port, () => console.log(`Voice API application listening on port ${port}!`));

//------------
