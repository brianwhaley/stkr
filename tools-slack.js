console.log('Loading tools-slack');

var awstools = require("./tools-aws");

const HTTP = require('http');
const HTTPS = require('https');
const URL = require('url');
const QS = require('querystring');
const log = true;





exports.querystringToJSON = querystringToJSON;
function querystringToJSON(qs) {  
    var pairs = qs.split('&');
    var result = {};
    pairs.forEach(function(pair) {
        pair = pair.split('=');
        result[pair[0]] = decodeURIComponent(pair[1] || '');
    });
    return JSON.parse(JSON.stringify(result));
}




exports.getRandomInt = getRandomInt;
function getRandomInt(min, max) {
    // min and max are inclusive
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}




exports.urlExists = urlExists;
async function urlExists(url) {
    if(log) console.log("URL EXISTS ");
    if(log) console.log("URL EXISTS - URL : ", url);
    const request = (opts = {}, cb) => {
        const requester = opts.protocol === 'https:' ? HTTPS : HTTP;
        return requester.request(opts, cb);
    };
    var options = {
        method: 'HEAD',
        port: URL.parse(url).port,
        protocol: URL.parse(url).protocol,
        host: URL.parse(url).host,
        path: URL.parse(url).pathname,
    };
    return new Promise(function(resolve, reject) {
        var req = request(options, function(res) {
            if(log) console.log("URL EXISTS - Results ", res);
            if(log) console.log("URL EXISTS - Status Code : ", res.statusCode);
            if(log) console.log("URL EXISTS - Headers : ", JSON.stringify(res.headers));
            if(log) console.log("URL EXISTS - Content Type : ", res.headers['content-type']);
            /* 
            if(res.statusCode == 200){
                resolve(true);
            } else {
                resolve(false);
            }
            */
            resolve(res);
        });
        req.on("error", function (error) { 
            if(log) console.log("URL EXISTS - ERROR : ", JSON.stringify(error));
            if(log) console.log("URL EXISTS - ERROR Code : ", JSON.stringify(error.code));
            if(log) console.log("URL EXISTS - ERROR Message : ", JSON.stringify(error.message));
            if(log) console.log("URL EXISTS - ERROR Stack : ", JSON.stringify(error.stack));
            reject(false);
        });
        req.end();
    });
}




exports.getTeamId = getTeamId;
function getTeamId(event, env){
    var team_id ;
    if (event.team_id) { team_id = event.team_id ;
    } else if(event.team.id) {  team_id = event.team.id ; }
    return (env != "PROD") ? team_id + "-" + env : team_id ;
}




exports.urlVerify = urlVerify;
function urlVerify(e_challenge, e_token, v_token) {
    var result;
    // ==#####== CHALLENGE ==#####==
    if (e_token === v_token) {
        result = { challenge: e_challenge };
    } else {
        result = "Stkr: Verification Failed";   
    }
    if(log) console.log("VERIFICATION - Results : ", result);
    return {
        statusCode: 200,
        isBase64Encoded: false,
        headers: {"content-type": "application/x-www-form-urlencoded"},
        body: JSON.stringify(result)
    };
}




exports.oAuthVerify = oAuthVerify;
async function oAuthVerify(event, data) {
    if(log) console.log("OAUTH VERIFY - OAuth - App Install ");
    if(log) console.log("OAUTH VERIFY - OAuth - Event : ", event);
    if(log) console.log("OAUTH VERIFY - OAuth - Data : ", data);
    const oaMsg = {
        client_id: data.client_id,
        client_secret: data.client_secret,
        code: event.code ,
    };
    const oaData = {
        api_method: "oauth.v2.access"
    };
    if(log) console.log("OAUTH VERIFY - OAuth oaMsg : ", oaMsg );
    if(log) console.log("OAUTH VERIFY - OAuth oaData : ", oaData);
    var oauthaccess = await slackApiGet(oaMsg, oaData);
    if(log) console.log("OAUTH VERIFY - OAuth - Verify : ", oauthaccess);
    var team_id = getTeamId(oauthaccess, data.env) ;
    const storeAuth = await awstools.writeToDynamo({
        tablename: awstools.stkrTokenDB,
        item: {
            team_id : team_id ,
            access_token : oauthaccess.access_token ,
            response : JSON.stringify(oauthaccess) ,
            put_date : new Date().toISOString() 
        }
    });
    if(log) console.log("OAUTH VERIFY - OAuth - Key Store : ", storeAuth);
    const email_res = await awstools.sendEmail({
        subject: "New Stkr App Install!"
    });
    if(log) console.log("OAUTH VERIFY - OAuth - Email Sent : ", email_res);
    // ==#####== LOG EVENT ==#####==
    const logged = await logEvent(event, { team_id: team_id });
    return {
        statusCode: 302,
        headers: {
            "Location": "https://pixelated.tech/stkr.html"
        },
        body: null
    };
}





exports.logEvent = logEvent;
async function logEvent(event, data){
    if(log) console.log("LOG EVENT  - Event : ", event);
    if(log) console.log("LOG EVENT  - Data : ", data);
    
    var eventType = null;
    if(event.command && event.text) { eventType = event.command + " " + event.text ; }
    else if (event.event) { eventType = event.event.type ; }
    else if (event.view) { eventType = event.view.callback_id ; }
    else if (event.actions){ eventType = event.actions[0].action_id ; }
    else if (event.code) { eventType = "app_installed" ; }
    if(log) console.log("LOG EVENT  - eventType : ", eventType);
    
    var userId = null;
    if (event.user_id) { userId = event.user_id; }
    else if (event.user) { userId = event.user.id ; }
    else if(event.authed_user) { userId = event.authed_user.id ; }
    else { userId = "." ; }
    if(log) console.log("LOG EVENT  - userId : ", userId);
    
    var channelId = null ;
    if (event.channel_id){ channelId = event.channel_id; } 
    else if (event.channel){ channelId = event.channel.id ; } 
    else if (event.view && event.viewprivate_metadata) { channelId = JSON.parse(event.view.private_metadata).channel_id ; }
    else { channelId = "." ; }
    
    var logged = await awstools.writeToDynamo({
        tablename: awstools.stkrLogDB,
        item: {
            team_id : data.team_id ,
            log_id: Date.now().valueOf().toString() ,
            channel_id : channelId ,
            event_type : eventType , 
            user_id : userId
        }
    });
    if(log) console.log("LOG EVENT  - Logged : ", logged);
    
    return null;
}





exports.getFileInfo = getFileInfo;
async function getFileInfo(file_id, b_token){
    // ==#####== GET FILE INFO ==#####==
    if(log) console.log("FILE INFO - FILE ID : ", file_id);
    var message = { 
        token: b_token,
        file: file_id
    };
    if(log) console.log("FILE INFO - Request Message : ", message);
    var qstring = QS.stringify(message);
    if(log) console.log("FILE INFO - Request QString : ", qstring);
    var options = {
        method: "GET",
        port: 443,
        protocol: "https:",
        hostname: "slack.com",
        path: "/api/files.info?" + qstring,
    };
    if(log) console.log("FILE INFO - Request File Options : ", options);
    let retJSON = '';
    return new Promise(function(resolve, reject) {
        const request = HTTPS.request(options, function(res) {
            if(log) console.log('FILE INFO - Request Status Code:', res.statusCode);
            if(log) console.log('FILE INFO - Request Headers:', res.headers);
            res.setEncoding( 'utf8' );
            res.on("data", function(data) { 
                retJSON += data; 
            });
            res.on("end", function () {
                if(log) console.log("FILEINFO - Response Results", retJSON.toString());
                resolve(JSON.parse(retJSON));
            });
        });
        request.on("error", function (error) { 
            if(log) console.log("FILE INFO - ERROR : ", JSON.stringify(error));
            if(log) console.log("FILE INFO - ERROR Code : ", JSON.stringify(error.code));
            if(log) console.log("FILE INFO - ERROR Message : ", JSON.stringify(error.message));
            if(log) console.log("FILE INFO - ERROR Stack : ", JSON.stringify(error.stack));
            reject(error);
        });
        request.end();
        if(log) console.log("FILE INFO - Request Results : ", request);
    });
}





exports.fetchImage = fetchImage;
async function fetchImage(data){
    var imgBuffer;
    var options = {
        headers: {
            "Authorization": "Bearer " + data.b_token
        }
    };
    return new Promise(function(resolve, reject) {
        const request = HTTPS.get(data.url, options, function(res) {
            if(log) console.log('FETCH IMAGE - Request Status Code:', res.statusCode);
            if(log) console.log('FETCH IMAGE - Request Headers:', res.headers);
            // res.setEncoding('base64');
            var retIMG = Buffer.alloc(0);
            res.on("data", function(chunk) { 
                retIMG = Buffer.concat([retIMG, chunk]);
            });
            res.on("end", function () {
                imgBuffer = retIMG;
                // if(log) console.log("FETCH IMAGE - Response Results : ", imgBuffer.toString());
                if(log) console.log("FETCH IMAGE - Response Results : SUCCESS");
                resolve(imgBuffer);
            });
        });
        request.on("error", function (error) { 
            console.log("FETCH IMAGE - ERROR : ", JSON.stringify(error));
            console.log("FETCH IMAGE - ERROR Code : ", JSON.stringify(error.code));
            console.log("FETCH IMAGE - ERROR Message : ", JSON.stringify(error.message));
            console.log("FETCH IMAGE - ERROR Stack : ", JSON.stringify(error.stack));
            reject(error);
        });
        request.end();
        if(log) console.log("FETCH IMAGE - Request Results : ", request);
    });
}





exports.slackApiGet = slackApiGet;
async function slackApiGet(message, data){
    // ==#####== SLACK API GET ==#####==
    if(log) console.log("SLACK API GET - Message : ", message);
    if(log) console.log("SLACK API GET - Data : ", data);
    var qstring = QS.stringify(message);
    if(log) console.log("SLACK API GET - Request QString : ", qstring);
    var options = {
        method: "GET",
        port: 443,
        protocol: "https:",
        hostname: "slack.com",
        path: "/api/" + data.api_method + "?" + qstring
    };
    if(log) console.log("SLACK API GET - Request File Options : ", options);
    let retJSON = '';
    return new Promise(function(resolve, reject) {
        const request = HTTPS.request(options, function(res) {
            if(log) console.log('SLACK API GET - Request Status Code:', res.statusCode);
            if(log) console.log('SLACK API GET - Request Headers:', res.headers);
            res.setEncoding( 'utf8' );
            res.on("data", function(data) { 
                retJSON += data; 
            });
            res.on("end", function () {
                if(log) console.log("SLACK API GET - Response Results", retJSON.toString());
                resolve(JSON.parse(retJSON));
            });
        });
        request.on("error", function (error) { 
            if(log) console.log("SLACK API GET ERROR : ", JSON.stringify(error));
            if(log) console.log("SLACK API GET ERROR Code : ", JSON.stringify(error.code));
            if(log) console.log("SLACK API GET ERROR Message : ", JSON.stringify(error.message));
            if(log) console.log("SLACK API GET ERROR Stack : ", JSON.stringify(error.stack));
            reject(error);
        });
        request.end();
        if(log) console.log("SLACK API GET - Request Results : ", request);
    });
}




exports.processApiMsg = processApiMsg;
async function processApiMsg(data) {
    // ==#####== VERIFY TO UPLOAD ==#####==
    if(log) console.log("PROCESS API MESSAGE - Data : ", data);
    let message = {};
    (data.token) ? message.token = data.token : null ;
    (data.delete_original) ? message.delete_original = data.delete_original : message.delete_original = false ;
    (data.replace_original) ? message.replace_original = data.replace_original : message.replace_original = false ;
    (data.response_type) ? message.response_type = data.response_type : message.response_type = 'in_channel' ; 
    (data.return_im) ? message.return_im = data.return_im : message.return_im = false ;
    (data.channel) ? message.channel = data.channel : null ;
    (data.users) ? message.users = data.users : null ;
    (data.trigger_id) ? message.trigger_id = data.trigger_id : null ;
    (data.text) ? message.text = data.text : null ; 
    (data.blocks) ? message.blocks = data.blocks : null ;
    (data.view) ? message.view = data.view : null ;
    if(log) console.log("PROCESS API MESSAGE - Message : ", message);
    
    let msgData = {};
    (data.b_token) ? msgData.b_token = data.b_token : null ;
    (data.api_method) ? msgData.api_method = data.api_method : null ;
    (data.response_url) ? msgData.response_url = data.response_url : null ;
    (data.trigger_id) ? msgData.trigger_id = data.trigger_id : null ;
    if(log) console.log("PROCESS API MESSAGE - Message Data: ", msgData);
    
    let result = await slackApiPost(message, msgData);
    return result;
}





exports.slackApiPost = slackApiPost;
async function slackApiPost(message, data){
    // ==#####== SLACK API POST ==#####===
    if(log) console.log("SLACK API POST - Message : ", JSON.stringify(message));
    if(log) console.log("SLACK API POST - Data : ", data);
    var url;
    if((data.response_url) && (data.response_url.length > 0)){
        url = data.response_url;
    } else {
        url = "https://slack.com/api/" + data.api_method;
    }
    if(log) console.log("SLACK API POST - URL : ", url);
    var options = {
        method: "POST",
        port: 443,
        /* protocol: "https:",
        hostname: "slack.com",
        path: "/api/chat.postMessage",  */
        headers: {
            "Authorization": "Bearer " + data.b_token,
            "Content-Type": "application/json; charset=utf-8", 
            "Content-Length": JSON.stringify(message).length
        }
    };
    if(log) console.log("SLACK API POST - Request Options : ", options);
    let retJSON = '';
    return new Promise(function(resolve, reject) {
        const request = HTTPS.request(url, options, function(res) {
            if(log) console.log('SLACK API POST - Request Status Code:', res.statusCode);
            if(log) console.log('SLACK API POST - Request Headers:', res.headers);
            res.setEncoding( 'utf8' );
            res.on("data", function(chunk) { retJSON += chunk; });
            res.on("end", function () {
                if(log) console.log("SLACK API POST - Response Results", retJSON.toString());
                if (typeof(retJSON) === "string") {
                    try {
                        resolve(JSON.parse(retJSON)) ;
                    } catch(err) {
                        resolve(retJSON) ;
                    }
                } else  { 
                    resolve(retJSON) ;
                }
            });
        });
        request.on("error", function (error) { 
            if(log) console.log("SLACK API POST ERROR : ", JSON.stringify(error));
            if(log) console.log("SLACK API POST ERROR Code : ", JSON.stringify(error.code));
            if(log) console.log("SLACK API POST ERROR Message : ", JSON.stringify(error.message));
            if(log) console.log("SLACK API POST ERROR Stack : ", JSON.stringify(error.stack));
            reject(error);
        });
        request.write(JSON.stringify(message));
        request.end();
        if(log) console.log("SLACK API POST - Request Results : ", request);
    });
}