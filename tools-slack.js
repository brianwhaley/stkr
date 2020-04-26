console.log('Loading tools-slack');
const HTTPS = require('https');
const QS = require('querystring');
const log = true;





exports.querystringToJSON = querystringToJSON
function querystringToJSON(qs) {  
    var pairs = qs.split('&');
    var result = {};
    pairs.forEach(function(pair) {
        pair = pair.split('=');
        result[pair[0]] = decodeURIComponent(pair[1] || '');
    });
    return JSON.parse(JSON.stringify(result));
}




exports.getFileInfo = getFileInfo;
async function getFileInfo(file_id, b_token){
    // ==#####== GET FILE INFO ==#####==
    if(log) console.log("FILEINFO - FILE ID : ", file_id);
    var message = { 
        token: b_token,
        file: file_id
    };
    if(log) console.log("FILEINFO - Request Message : ", message);
    var qstring = QS.stringify(message);
    if(log) console.log("FILEINFO - Request QString : ", qstring);
    var options = {
        method: "GET",
        port: 443,
        protocol: "https:",
        hostname: "slack.com",
        path: "/api/files.info?" + qstring,
    };
    if(log) console.log("FILEINFO - Request File Options : ", options);
    let retJSON = '';
    return new Promise(function(resolve, reject) {
        const request = HTTPS.request(options, function(res) {
            if(log) console.log('FILEINFO - Request Status Code:', res.statusCode);
            if(log) console.log('FILEINFO - Request Headers:', res.headers);
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
            if(log) console.log("ERROR : ", JSON.stringify(error));
            if(log) console.log("ERROR Code : ", JSON.stringify(error.code));
            if(log) console.log("ERROR Message : ", JSON.stringify(error.message));
            if(log) console.log("ERROR Stack : ", JSON.stringify(error.stack));
            reject(error);
        });
        request.end();
        if(log) console.log("FILEINFO - Request Results : ", request);
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
            if(log) console.log('FETCHIMAGE - Request Status Code:', res.statusCode);
            if(log) console.log('FETCHIMAGE - Request Headers:', res.headers);
            // res.setEncoding('base64');
            var retIMG = Buffer.alloc(0);
            res.on("data", function(chunk) { 
                retIMG = Buffer.concat([retIMG, chunk]);
            });
            res.on("end", function () {
                imgBuffer = retIMG;
                if(log) console.log("FETCHIMAGE - Response Results : ", imgBuffer.toString());
                if(log) console.log("FETCHIMAGE - Response Results : SUCCESS");
                resolve(imgBuffer);
            });
        });
        request.on("error", function (error) { 
            console.log("ERROR : ", JSON.stringify(error));
            console.log("ERROR Code : ", JSON.stringify(error.code));
            console.log("ERROR Message : ", JSON.stringify(error.message));
            console.log("ERROR Stack : ", JSON.stringify(error.stack));
            reject(error);
        });
        request.end();
        if(log) console.log("FETCHIMAGE - Request Results : ", request);
    });
}





exports.slackApiGet = slackApiGet;
async function slackApiGet(message, data){
    // ==#####== SLACK API GET ==#####==
    if(log) console.log("SLACKAPIGET - Message : ", message);
    if(log) console.log("SLACKAPIGET - Data : ", data);
    var qstring = QS.stringify(message);
    if(log) console.log("SLACKAPIGET - Request QString : ", qstring);
    var options = {
        method: "GET",
        port: 443,
        protocol: "https:",
        hostname: "slack.com",
        path: "/api/" + data.api_method + "?" + qstring
    };
    if(log) console.log("SLACKAPIGET - Request File Options : ", options);
    let retJSON = '';
    return new Promise(function(resolve, reject) {
        const request = HTTPS.request(options, function(res) {
            if(log) console.log('SLACKAPIGET - Request Status Code:', res.statusCode);
            if(log) console.log('SLACKAPIGET - Request Headers:', res.headers);
            res.setEncoding( 'utf8' );
            res.on("data", function(data) { 
                retJSON += data; 
            });
            res.on("end", function () {
                if(log) console.log("SLACKAPIGET - Response Results", retJSON.toString());
                resolve(JSON.parse(retJSON));
            });
        });
        request.on("error", function (error) { 
            if(log) console.log("SLACKAPIGET ERROR : ", JSON.stringify(error));
            if(log) console.log("SLACKAPIGET ERROR Code : ", JSON.stringify(error.code));
            if(log) console.log("SLACKAPIGET ERROR Message : ", JSON.stringify(error.message));
            if(log) console.log("SLACKAPIGET ERROR Stack : ", JSON.stringify(error.stack));
            reject(error);
        });
        request.end();
        if(log) console.log("SLACKAPIGET - Request Results : ", request);
    });
}





exports.slackApiPost = slackApiPost;
async function slackApiPost(message, data){
    // ==#####== SLACK API POST ==#####===
    if(log) console.log("SLACKAPIPOST - Message : ", message);
    if(log) console.log("SLACKAPIPOST - Data : ", data);
    var url;
    if((data.response_url) && (data.response_url.length > 0)){
        url = data.response_url;
    } else {
        url = "https://slack.com/api/" + data.api_method;
    }
    if(log) console.log("SLACKAPIPOST - URL : ", url);
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
    if(log) console.log("SLACKAPIPOST - Request Options : ", options);
    let retJSON = '';
    return new Promise(function(resolve, reject) {
        const request = HTTPS.request(url, options, function(res) {
            if(log) console.log('SLACKAPIPOST - Request Status Code:', res.statusCode);
            if(log) console.log('SLACKAPIPOST - Request Headers:', res.headers);
            res.setEncoding( 'utf8' );
            res.on("data", function(chunk) { retJSON += chunk; });
            res.on("end", function () {
                if(log) console.log("SLACKAPIPOST - Response Results", retJSON.toString());
                resolve(JSON.parse(retJSON));
            });
        });
        request.on("error", function (error) { 
            if(log) console.log("SLACKAPIPOST ERROR : ", JSON.stringify(error));
            if(log) console.log("SLACKAPIPOST ERROR Code : ", JSON.stringify(error.code));
            if(log) console.log("SLACKAPIPOST ERROR Message : ", JSON.stringify(error.message));
            if(log) console.log("SLACKAPIPOST ERROR Stack : ", JSON.stringify(error.stack));
            reject(error);
        });
        request.write(JSON.stringify(message));
        request.end();
        if(log) console.log("SLACKAPIPOST - Request Results : ", request);
    });
}