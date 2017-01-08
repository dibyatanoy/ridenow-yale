'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const async = require('async')
const app = express()
const fbToken = process.env.RIDE_NOW_FB_TOKEN
const gmapToken = process.env.RIDENOW_GMAPS_GEOCODING_TOKEN
const translocKey = process.env.RIDENOW_TRANSLOC_API_KEY
const mapquestKey = process.env.RIDE_NOW_MAPQUEST_KEY
const yaleAgencyId = '128'
const walkTimeTolerance = 60 // in seconds
const geoFilter = '41.3125884,-72.92496140000002|1500'
// predetermined: 4097030, 4097062 (both-way!), 4097074, 4128602, 4132142, 4097070, 4143990, 4144014, 4161262
const upstreamStops = ['4096830', '4096834', '4096838', '4096842', '4096846', '4096850', '4096854', '4096906', '4096926', '4096942', '4096946', '4096966', '4096970', '4096978', '4096982', '4097002', '4097014', '4097030', '4097062', '4097074', '4128602', '4132142', '4143990', '4161262', '']
const downstreamStops = ['4096870', '4096878', '4096882', '4096886', '4096890', '4096898', '4096902', '4096910', '4096914', '4096922', '4096930', '4096934', '4096938', '4096958', '4096962', '4096974', '4096986', '4096990', '4096994', '4096998', '4097062', '4097070', '4144014', '']
var moment = require('moment')

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
            console.log("text received")
            //geoCode(text + ", New Haven, CT")
            //getRoutes('yale')
            //downloadRoutesAndContinue('yale', {lat: 41.309669, lng: -72.929869}, {lat: 41.315753, lng: -72.923775})
            routesAndClosestStopsWithArrivals = []
            routesAndClosestStops = []
            walkDistances = {}
            stopDescs = []
            stopDistancesSrc = {}
            stopDistancesDest = {}
            stopNames = {}

            downloadRoutesAndContinue(sender, 'yale', {lat: 41.3102168, lng: -72.93068079999999}, {lat: 41.3125884, lng: -72.92496140000002})
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

function sendTextMessage(sender, text, suggestions) {
    let messageData = { text:text }
    if (suggestions){

        var elements = []

        suggestions.forEach(function(suggestion){
            var element = {"title": null, "subtitle": null, "image_url": null}

            var img_center = ((stopNames[suggestion.closestToSrc].lat + stopNames[suggestion.closestToDest].lat) / 2).toString() + "," + ((stopNames[suggestion.closestToSrc].lng + stopNames[suggestion.closestToDest].lng) / 2).toString();
            var marker1 = stopNames[suggestion.closestToSrc].lat.toString() + "," + stopNames[suggestion.closestToSrc].lng.toString()
            var marker2 = stopNames[suggestion.closestToDest].lat.toString() + "," + stopNames[suggestion.closestToDest].lng.toString()

            element.image_url = "http://maps.google.com/maps/api/staticmap?center="+img_center+"&zoom=15&size=512x512&markers=color:blue|label:S|"+marker1
            console.log(element.image_url)
            element.title = suggestion.routeName
            var utcOffset = moment.parseZone(suggestion.srcArrivalTime.actual).utcOffset();
            element.subtitle = "Board at " + suggestion.closestToSrcName + " at " + moment.utc(suggestion.srcArrivalTime.actual).utcOffset(utcOffset).format("HH:mm") + " and get off at " + suggestion.closestToDestName
            elements.push(element)
        })

        let messageData = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "generic",
                    "elements": elements,
                },
            },
        }

        request({
            url: 'https://graph.facebook.com/v2.6/me/messages',
            qs: {access_token:fbToken},
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

    }else{
        request({
            url: 'https://graph.facebook.com/v2.6/me/messages',
            qs: {access_token:fbToken},
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
            console.log('lat: %f, long: %f', JSON.parse(body).results[0].geometry.location.lat, JSON.parse(body).results[0].geometry.location.lng)
            //console.log(body)
            //console.log(response.body)
        }
    })
}

function getRoutes(agency){

    request({
        headers:{
            'X-Mashape-Key': translocKey,
            'Accept': 'application/json',
        },
        url: 'https://transloc-api-1-2.p.mashape.com/routes.json',
        qs: {
            agencies: agency,
        },
        method: 'GET',
    }, function(error, response, body){
        if (error) {
            console.log('Error getting routes: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }else{
            //console.log('lat: %f, long: %f', JSON.parse(body).results[0].geometry.location.lat, JSON.parse(body).results[0].geometry.location.lng)
            console.log(body)
            //console.log(response.body)
        }
    })
}

var routesAndClosestStopsWithArrivals = []
var routesAndClosestStops = []
var walkDistances = {}
var stopDescs = []
var stopDistancesSrc = {}
var stopDistancesDest = {}
var stopNames = {}

function calcWalkDistanceToStop(routeid, stopid, src, dest, mcb){

    var numStops = stopDescs.length

    for(var i = 0; i < numStops; i++){
        var stopDesc = stopDescs[i]

        if(stopDesc.stop_id == stopid){
            var stopLoc = stopDesc.location

            request({
                url: 'https://maps.googleapis.com/maps/api/distancematrix/json',
                qs:{
                    origins: src.lat.toString() + ',' + src.lng.toString(),
                    destinations: stopLoc.lat.toString() + ',' + stopLoc.lng.toString(),
                    key: gmapToken,
                    mode: 'walking',
                },
                method: 'GET',
            }, function(error, response, body){
                if (error) {
                    console.log('Error getting distance matrix: ', error)
                } else if (response.body.error) {
                    console.log('Error: ', response.body.error)
                }else{
                    //console.log(body)
                    var walkTimeSrc = JSON.parse(body).rows[0].elements[0].duration.value
                    //walkDistances[routeid].push({stopid: stopid, walkTime: walkTimeSrc})

                    request({
                        url: 'https://maps.googleapis.com/maps/api/distancematrix/json',
                        qs:{
                            destinations: dest.lat.toString() + ',' + dest.lng.toString(),
                            origins: stopLoc.lat.toString() + ',' + stopLoc.lng.toString(),
                            key: gmapToken,
                            mode: 'walking',
                        },
                        method: 'GET',
                    }, function(error, response, body){
                        if (error) {
                            console.log('Error getting distance matrix: ', error)
                        } else if (response.body.error) {
                            console.log('Error: ', response.body.error)
                        }else{
                            var walkTimeDest = JSON.parse(body).rows[0].elements[0].duration.value
                            walkDistances[routeid].push({stopid: stopid, walkTimeSrc: walkTimeSrc, walkTimeDest: walkTimeDest})

                            mcb()
                        }
                    })
                    //mcb()
                }
            })

            break
        }
    }

    return
}

function getBestStops(route, src, dest, mcb){

    var asyncTasksStops = []

    var routeId = route.route_id
    var stops = route.stops
    walkDistances[routeId] = []

    var closestStopInfo = {routeId: routeId, routeName: route.long_name, closestToSrc: null, closestToDest: null, 
                minDistSrc: null, minDistDest: null}

    var numStopsOnRoute = stops.length
    var closestToSrc = null, closestToDest = null
    var closestToSrcIdx = -1
    var minDistSrc = 1000000
    var minDistDest = 1000000

    for(var i = 0; i < numStopsOnRoute; i++){

        if(stops[i] in stopDistancesSrc && stopDistancesSrc[stops[i]] < minDistSrc){
            minDistSrc = stopDistancesSrc[stops[i]]
            closestToSrc = stops[i]
            closestToSrcIdx = i
        }
    }

    for(var i = 0; i < numStopsOnRoute; i++){

        if(stops[i] in stopDistancesDest && stopDistancesDest[stops[i]] < minDistDest && i != closestToSrcIdx){
            minDistDest = stopDistancesDest[stops[i]]
            closestToDest = stops[i]
        }
    }

    closestStopInfo.closestToSrc = closestToSrc
    closestStopInfo.closestToDest = closestToDest
    closestStopInfo.minDistSrc = minDistSrc
    closestStopInfo.minDistDest = minDistDest

    routesAndClosestStops.push(closestStopInfo)

    mcb()

    // stops.forEach(function(stopid){
    //     asyncTasksStops.push(function(callback){
    //         //business logic
    //         calcWalkDistanceToStop(routeId, stopid, src, dest, function(){
    //             callback()
    //         })
    //     })
    // })

    // async.parallel(asyncTasksStops, function(){

    //     // walkDistances[routeId] has been populated, find minimum to source and destination
    //     if (!routeId in walkDistances){
    //         console.log("Error: routeId not in walkDistances")
    //     }else{

    //         var closestStopInfo = {routeId: routeId, routeName: route.long_name, closestToSrc: null, closestToDest: null, 
    //             minDistSrc: null, minDistDest: null}

    //         var numStopsOnRoute = walkDistances[routeId].length
    //         var closestToSrc = null, closestToDest = null
    //         var closestToSrcIdx = -1
    //         var minDistSrc = 1000000
    //         var minDistDest = 1000000

    //         for(var i = 0; i < numStopsOnRoute; i++){
    //             if (walkDistances[routeId][i].walkTimeSrc < minDistSrc){
    //                 minDistSrc = walkDistances[routeId][i].walkTimeSrc
    //                 closestToSrc = walkDistances[routeId][i].stopid
    //                 closestToSrcIdx = i
    //             }
    //         }

    //         for(var i = 0; i < numStopsOnRoute; i++){
    //             if(walkDistances[routeId][i].walkTimeDest < minDistDest && i != closestToSrcIdx){
    //                 minDistDest = walkDistances[routeId][i].walkTimeDest
    //                 closestToDest = walkDistances[routeId][i].stopid
    //             }
    //         }

    //         closestStopInfo.closestToSrc = closestToSrc
    //         closestStopInfo.closestToDest = closestToDest
    //         closestStopInfo.minDistSrc = minDistSrc
    //         closestStopInfo.minDistDest = minDistDest

    //         routesAndClosestStops.push(closestStopInfo)

    //     }

    //     mcb()
    // })
}

function getClosestStopsAllRoutes(sender, routes, src, dest){

    var asyncTasksRoutes = []

    routes.forEach(function(route){
        asyncTasksRoutes.push(function(callback){
            //asyncCall for stops
            getBestStops(route, src, dest, function(){
                callback()
            })
        })
    })

    async.parallel(asyncTasksRoutes, function(){
        //do something with closest stops for each route
        console.log('Downloaded closest stops for each route')
        console.log(routesAndClosestStops)
        getStopArrivalTimes(sender, src, dest)
    })
}

function downloadRoutesAndContinue(sender, agency, src, dest){

    request({
        headers: {
            'X-Mashape-Key': translocKey,
            'Accept': 'application/json',
        },
        url: 'https://transloc-api-1-2.p.mashape.com/routes.json',
        qs: {
            agencies: agency,
        },
        method: 'GET',
    }, function(error, response, body){
        if (error) {
            console.log('Error getting stop descriptions: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }else{
            //console.log('lat: %f, long: %f', JSON.parse(body).results[0].geometry.location.lat, JSON.parse(body).results[0].geometry.location.lng)
            var routes = JSON.parse(body).data[yaleAgencyId]
            console.log("Downloaded route information")
            downloadStopDescsAndContinue(sender, agency, routes, src, dest)
        }
    })
}

function downloadStopDescsAndContinue(sender, agency, routes, src, dest){

    //save .data part to stopDescs

    request({
        headers: {
            'X-Mashape-Key': translocKey,
            'Accept': 'application/json',
        },
        url: 'https://transloc-api-1-2.p.mashape.com/stops.json',
        qs: {
            agencies: agency,
            geo_area: geoFilter,
        },
        method: 'GET',
    }, function(error, response, body){
        if (error) {
            console.log('Error getting stop descriptions: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }else{
            //console.log('lat: %f, long: %f', JSON.parse(body).results[0].geometry.location.lat, JSON.parse(body).results[0].geometry.location.lng)
            stopDescs = JSON.parse(body).data
            //console.log(response.body)
            console.log("Downloaded stop information")
            console.log(stopDescs.length)

            stopDescs.forEach(function(stop){
                stopNames[stop.stop_id] = {name: stop.name, lat: stop.location.lat, lng: stop.location.lng}
            })

            cacheStopDistancesAndContinue(sender, routes, src, dest)
            //getClosestStopsAllRoutes(routes, src, dest)
        }
    })
}

//var stopDistancesSrc = {}
//var stopDistancesDest = {}

function cacheStopDistancesAndContinue(sender, routes, src, dest){

    var numStops = stopDescs.length
    var srcStopList = []
    var destStopList = []
    srcStopList.push(src.lat.toString() + ',' + src.lng.toString())
    destStopList.push(dest.lat.toString() + ',' + dest.lng.toString())

    for (var i = 0; i < numStops; i++){
        var currLoc = stopDescs[i].location
        srcStopList.push(currLoc.lat.toString() + ',' + currLoc.lng.toString())
        destStopList.push(currLoc.lat.toString() + ',' + currLoc.lng.toString())
    }

    request({
        url: 'http://www.mapquestapi.com/directions/v2/routematrix',
        qs:{
            key: mapquestKey,
        },
        method: 'POST',
        json: {
            locations: srcStopList,
        },
    }, function(error, response, body){
        if (error) {
            console.log('Error getting distances: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }else{

            var srcWalkTimes = body.time
            for (var i = 0; i < numStops; i++){
                stopDistancesSrc[stopDescs[i].stop_id] = srcWalkTimes[i+1]
            }

            console.log('completed caching source to stop distances')
            console.log(stopDistancesSrc)

            request({
                url: 'http://www.mapquestapi.com/directions/v2/routematrix',
                qs:{
                    key: mapquestKey,
                },
                method: 'POST',
                json: {
                    locations: destStopList,
                },
            }, function(error, response, body){
                if (error) {
                    console.log('Error getting distances: ', error)
                } else if (response.body.error) {
                    console.log('Error: ', response.body.error)
                }else{

                    var destWalkTimes = body.time
                    for (var i = 0; i < numStops; i++){
                        stopDistancesDest[stopDescs[i].stop_id] = destWalkTimes[i+1]
                    }
                    console.log('completed caching destination to stop distances')
                    getClosestStopsAllRoutes(sender, routes, src, dest)
                    
                }
            })

        }
    })
}

function getArrivals(routeAndStops, src, dest, mcb){

    request({
        headers: {
            'X-Mashape-Key': translocKey,
            'Accept': 'application/json',
        },
        url: 'https://transloc-api-1-2.p.mashape.com/arrival-estimates.json',
        qs: {
            routes: routeAndStops.routeId
        },
        method: 'GET',
    }, function(error, response, body){
        if (error) {
            console.log('Error getting distance matrix: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }else{
            var arrivalList = JSON.parse(body).data
            var numStopsWithArrivals = arrivalList.length

            for(var i = 0 ; i < numStopsWithArrivals; i++){
                if (arrivalList[i].stop_id == routeAndStops.closestToSrc){
                    // look at list "arrivals" for this stop
                    // check if arrival time - current time < walking distance time
                    // if yes, add new option to list
                    // containing all the information together with the arrival time

                    var arrivals = arrivalList[i].arrivals

                    arrivals.forEach(function(arrival){
                        i = i
                    })
                }
            }
        }
    })
}

function getStopArrivalTimes(sender, src, dest){

    // download arrivals for all the stops we need with one request,
    // then cache and use as necessary

    var stopArrivalLists = {}   // stopArrivalLists[stop_id][route_id] = [..., ...]
    var stopIdString = ""

    routesAndClosestStops.forEach(function(routeAndStops){
        if (routeAndStops.closestToSrc != null){
            if(stopIdString != "") stopIdString += ','
            stopIdString += routeAndStops.closestToSrc
        }
        if (routeAndStops.closestToDest != null){
            if(stopIdString != "") stopIdString += ','
            stopIdString += routeAndStops.closestToDest
        }
    })

    request({
        headers: {
            'X-Mashape-Key': translocKey,
            'Accept': 'application/json',
        },
        url: 'https://transloc-api-1-2.p.mashape.com/arrival-estimates.json',
        qs: {
            agencies: 'yale',
            stops: stopIdString,
        },
        method: 'GET',
    }, function(error, response, body){
        if (error) {
            console.log('Error getting distance matrix: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }else{

            var stopsWithArrivals = JSON.parse(body).data
            var numStopsWithArrivals = stopsWithArrivals.length

            for (var i = 0; i < numStopsWithArrivals; i++){
                stopArrivalLists[stopsWithArrivals[i].stop_id] = {}
                var currStop = stopsWithArrivals[i].stop_id
                
                stopsWithArrivals[i].arrivals.forEach(function(arrival){
                    if (!(arrival.route_id in stopArrivalLists[currStop]))
                        stopArrivalLists[currStop][arrival.route_id] = []

                    var millisecTime = new Date(arrival.arrival_at).getTime()
                    stopArrivalLists[currStop][arrival.route_id].push({msec: millisecTime, actual: arrival.arrival_at}) // need to sort
                    stopArrivalLists[currStop][arrival.route_id].sort(function(a,b){
                        if(a.msec < b.msec) return -1;
                        if(b.msec < a.msec) return 1;
                        return 0;
                    })
                })

            }
            console.log('completed caching arrival times')

            var validStops = upstreamStops
            if ((dest.lat - src.lat) < 0.0){
                validStops = downstreamStops
            }

            routesAndClosestStops.forEach(function(routeAndStops){

                var currDir

                if (validStops.indexOf(routeAndStops.closestToSrc) != -1){
                    currDir = 0
                }else{
                    currDir = 1
                }

                var newEntry = {
                    routeId: routeAndStops.routeId,
                    routeName: routeAndStops.routeName,
                    closestToSrc: routeAndStops.closestToSrc,
                    closestToDest: routeAndStops.closestToDest,
                    minDistSrc: routeAndStops.minDistSrc,
                    minDistDest: routeAndStops.minDistDest,
                    // same direction as src -> dest: 0, else 1
                    direction: currDir,
                    //direction: (((stopNames[routeAndStops.closestToDest].lat - stopNames[routeAndStops.closestToSrc].lat) * direction) > 0) ? 0 : 1 
                }
                // possible edge case: last bus of the day, not going round fully
                if ((newEntry.closestToSrc in stopArrivalLists)
                    && (newEntry.routeId in stopArrivalLists[newEntry.closestToSrc])
                    && (newEntry.closestToDest in stopArrivalLists)
                    && (newEntry.routeId in stopArrivalLists[newEntry.closestToDest])
                    && stopArrivalLists[newEntry.closestToSrc][newEntry.routeId].length > 0
                    && stopArrivalLists[newEntry.closestToDest][newEntry.routeId].length > 0){

                    // take best 2 (if available) for each route
                    newEntry.srcArrivalTime = stopArrivalLists[newEntry.closestToSrc][newEntry.routeId][0]
                    routesAndClosestStopsWithArrivals.push(newEntry)

                    if (stopArrivalLists[newEntry.closestToSrc][newEntry.routeId].length > 1){

                        var newEntry2 = {
                            routeId: routeAndStops.routeId,
                            routeName: routeAndStops.routeName,
                            closestToSrc: routeAndStops.closestToSrc,
                            closestToDest: routeAndStops.closestToDest,
                            minDistSrc: routeAndStops.minDistSrc,
                            minDistDest: routeAndStops.minDistDest,
                            direction: currDir,
                        }

                        newEntry2.srcArrivalTime = stopArrivalLists[newEntry.closestToSrc][newEntry.routeId][1]
                        routesAndClosestStopsWithArrivals.push(newEntry2)
                    }

                    routesAndClosestStopsWithArrivals.sort(function(a, b){

                        // if one is in the correct direction and the other isn't, take the first
                        if (a.direction != b.direction){
                            if (a.direction == 0) 
                                return -1
                            else
                                return 1
                        }
                        //if stops within 20s of each other, sort by arrival times
                        if (Math.abs(a.minDistSrc + a.minDistDest - b.minDistSrc - b.minDistDest) < 20){
                            return (a.srcArrivalTime.msec - b.srcArrivalTime.msec)
                        }
                        return (a.minDistSrc + a.minDistDest - b.minDistSrc - b.minDistDest)
                    })

                    console.log('Completed')
                    routesAndClosestStopsWithArrivals.forEach(function(suggestion){

                        suggestion.closestToSrcName = stopNames[suggestion.closestToSrc].name
                        suggestion.closestToDestName = stopNames[suggestion.closestToDest].name
                    })

                    sendTextMessage(sender, "This is what I found: ", routesAndClosestStopsWithArrivals)
                    //console.log(routesAndClosestStopsWithArrivals)
                }
            })
            
        }
    })

    // for each route, we have two stops
    // for the srcStops only, find the arrival times
    // if no arrival time, don't add to array
    // at the end, 

    // var asyncTasksArrivals = []

    // routesAndClosestStops.forEach(function(routeAndStops){
    //     asyncTasksArrivals.push(function(callback){

    //         getArrivals(routeAndStops, src, dest, function(){
    //             callback()
    //         })
    //     })
    // })

    // async.parallel(asyncTasksArrivals, function(){
    //     // do something next
    // })
}

function getRouteArrivalTimes(routeId){

}

function getWalkingDistance(src, dest){

}


// getting static map images eg: http://maps.googleapis.com/maps/api/staticmap?size=764x400&center=41.3084858,-72.92825460000002&zoom=17&markers=41.3084858,-72.92825460000002