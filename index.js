'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const app = express()
const fbToken = process.env.RIDE_NOW_FB_TOKEN
const gmapToken = process.env.RIDENOW_GMAPS_GEOCODING_TOKEN
const translocKey = process.env.RIDENOW_TRANSLOC_API_KEY

app.set('port', (process.env.PORT || 5000))

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// Process application/json
app.use(bodyParser.json())

// Index route
app.get('/', function (req, res) {
    res.send('Hello world, I am a chat bot')
})

// for Facebook verification
app.get('/webhook/', function (req, res) {
    if (req.query['hub.verify_token'] === 'my_voice_is_my_password_verify_me') {
        res.send(req.query['hub.challenge'])
    }
    res.send('Error, wrong token')
})

app.post('/webhook/', function (req, res) {
    let messaging_events = req.body.entry[0].messaging
    for (let i = 0; i < messaging_events.length; i++) {
        let event = req.body.entry[0].messaging[i]
        let sender = event.sender.id
        if (event.message && event.message.text) {
            let text = event.message.text
            //sendTextMessage(sender, "Text received, echo: " + text.substring(0, 200))
            geoCode(text + ", New Haven, CT")
        }else if (event.message && event.message.attachments){

            if(event.message.attachments[0].payload.coordinates){
                var latitude = event.message.attachments[0].payload.coordinates.lat
                var longitude = event.message.attachments[0].payload.coordinates.long

                // do something with this...
            }else{
                console.log("Attachment with no coordinates received.")
            }
        }
    }
    res.sendStatus(200)
})

function sendTextMessage(sender, text) {
    let messageData = { text:text }
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token:token},
        method: 'POST',
        json: {
            recipient: {id:sender},
            message: messageData,
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }
    })
}

// Spin up the server
app.listen(app.get('port'), function() {
    console.log('running on port', app.get('port'))
})

function geoCode(place){

    request({
        url: 'https://maps.googleapis.com/maps/api/geocode/json',
        qs: {
            address: place,
            key: gmapToken,
        },
        method: 'GET',
    }, function(error, response, body){
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }else{
            console.log('lat: %f, long: %f', body.results.geometry.location.lat, body.results.geometry.location.long)
        }
    })
}


// getting static map images eg: http://maps.googleapis.com/maps/api/staticmap?size=764x400&center=41.3084858,-72.92825460000002&zoom=17&markers=41.3084858,-72.92825460000002