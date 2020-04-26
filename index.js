console.log('Loading stkr');
var slackhelpers = require("./slack-helpers");
var awstools = require("./tools-aws");
var slacktools = require("./tools-slack");
const maxImages = 50;
let a_token;
let b_token;
let v_token;
let c_id;
let c_secret;
let env;
const log = true;




exports.handler = async function(data, context) {
    // ==#####== STKR APP SETUP ==#####==
    if(log) console.log('STKR - Received DATA:', JSON.stringify(data));
    let stageVars = data.stageVariables;
    if(log) console.log('STKR - Received Stage Variables:', JSON.stringify(stageVars));
    a_token = stageVars.ACCESS_TOKEN;
    b_token = stageVars.BOT_TOKEN;
    v_token = stageVars.VERIFICATION_TOKEN;
    c_id = stageVars.CLIENT_ID;
    c_secret = stageVars.CLIENT_SECRET;
    env = stageVars.ENV;
    if(log) console.log('STKR - Received Context:', JSON.stringify(context));
    let event ;
    let result ;
    let team_id ;
    if(data.headers['Content-Type'] == "application/json"){
        // ==#####== POST ==#####==
        event = JSON.parse(data.body);
    } else if(data.headers['Content-Type'] == 'application/x-www-form-urlencoded' ){
        // ==#####== GET ==#####==
        event = slacktools.querystringToJSON(data.body);
        if(event.payload) {
            if(log) console.log("STKR - Received Payload : ", JSON.stringify(event));
            event = JSON.parse(event.payload);
        } 
    } else {
        // ==#####== OAUTH ==#####==
        if(data.queryStringParameters){
            event = data.queryStringParameters;
            if (log) console.log("STKR - Event Code : ", event.code);
        }
    }
    if(log) console.log('STKR - Received Event:', JSON.stringify(event));
    
    

    if (event.code) {
        // ==#####== OAUTH REQUEST - APP INSTALL ==#####==
        // ==#####== THIS IS A WEB BASED REQUEST ==#####==
        let oaMsg = {
            client_id: c_id,
            client_secret: c_secret,
            code: event.code ,
            //redirect_uri: null
        };
        let oaData = {
            b_token: b_token,
            api_method: "oauth.v2.access"
        };
        let oauthaccess = await slacktools.slackApiGet(oaMsg, oaData);
        team_id = slacktools.getTeamId(oauthaccess.team.id, env) ;
        let storeAuth = await awstools.writeToDynamo({
            team_id: team_id ,
            access_token: oauthaccess.access_token,
            response: JSON.stringify(oauthaccess)
        });
        // result = oauthaccess;
        return {
            statusCode: 302,
            headers: {
                "Location": "https://pixelated.tech/stkr.html"
            },
            body: null
        };
    } else if (event.hasOwnProperty("team_id") || event.hasOwnProperty("team")) {
        // ==#####== GET AUTH TOKEN ==#####==
        if (event.team_id) { 
            team_id = slacktools.getTeamId(event.team_id, env) ;
        } else if(event.team.id) { 
            team_id = slacktools.getTeamId(event.team.id, env) ;
        }
        console.log("STKR - Team ID : ", team_id);
        let getAuth = await awstools.readFromDynamo({
            team_id: team_id
        });
        console.log("STKR - Access Token : ", await getAuth.Item.access_token.S);
        b_token = await getAuth.Item.access_token.S;
    }
    
    
    if (event.hasOwnProperty("type") || event.hasOwnProperty("event")) {
        let event_type;
        if(event.hasOwnProperty("event")) { event_type = event.event.type; } else if (event.hasOwnProperty("type")) { event_type = event.type; }
        if(log) console.log("STKR - Event Type: " , event_type);
        switch (event_type) {
            case "url_verification": 
                // ==#####== VERIFY EVENT CALLBACK URL ==#####==
                if(log) console.log("STKR - URL Verification");
                result = slackhelpers.verify(event.challenge, event.token, v_token); 
                break;
            case "app_uninstalled": 
                // ==#####== APP UNINSTALLED _ DELETE ALL DATA FOR THAT WORKSPACE ==#####==
                if(log) console.log("STKR - App Uninstalled");
                team_id = slacktools.getTeamId(event.team_id, env);
                const emptied = await awstools.emptyS3Directory({team_id: team_id});
                const detokened = await awstools.deleteFromDynamo({team_id: team_id});
                break;
            case "file_shared":
                //"event_callback":
                // ==#####== FILE SHARED ==#####==
                // ==#####== MUST CREATE NEW CONVERSATION - NONE EXISTS YET ==#####==
                if(log) console.log("STKR - Event Callback");
                let convo = await slackhelpers.processApiMsg({
                    token: b_token,
                    users: event.event.user_id, // + "," + stkrAppUser.user_id,
                    b_token: b_token,
                    api_method: "conversations.open"
                });
                // ==#####== CHECK MAX IMAGES ==#####==
                team_id = slacktools.getTeamId(event.team_id, env) ;
                let img_count = await awstools.getCount({
                    team_id : team_id,
                });
                // ==#####== TOO MANY IMAGES ==#####==
                if(img_count >= maxImages){
                    let maxImgMessage = await slackhelpers.processApiMsg({
                        token: b_token,
                        channel: convo.channel.id,
                        text: "Stkr has already uploaded the maximum number of images (" + maxImages + "). \n" + 
                            "You can make more room by deleting images with /stkrdelete .",
                        b_token: b_token,
                        api_method: "chat.postMessage"
                    });
                    break;
                }
                // ==#####== VERIFY UPLOAD YES OR NO ==#####==
                let toUploadMsg = await slackhelpers.verifyUploadMessage({
                    file_id: event.event.file_id,
                    // team_id: event.team_id,
                    channel: convo.channel.id,
                    token: b_token
                });
                let toUploadData = {
                    b_token: b_token,
                    api_method: "chat.postMessage"
                };
                let toUploadPostMsg = await slacktools.slackApiPost(toUploadMsg, toUploadData);
                break;
            case "block_actions":
                // ==#####== PROCESS IMAGE CONFIRMATION ==#####==
                team_id =slacktools.getTeamId(event.team.id, env);
                if(log) console.log("STKR - Block Actions ; ", event.actions[0].action_id);
                let uploadData = {
                    file_id: event.actions[0].value,
                    user_id: event.user.id,
                    team_id: team_id,
                    response_url: event.response_url,
                    b_token: b_token,
                    v_token: v_token
                };
                if(event.actions[0].action_id == "upload-confirm-yes" ){
                    result = await slackhelpers.processUploadApproved(uploadData); 
                } else if(event.actions[0].action_id == "upload-confirm-no" ){
                    result = await slackhelpers.processUploadDeclined(uploadData); 
                }
                break;
            case "interactive_message":
                team_id = slacktools.getTeamId(event.team.id, env) ;
                if(log) console.log("STKR - Interactive Message");
                // ==#####== INTERACTIVE MENU ITEM ==#####==
                if(event.actions[0].value == "stkr-share-cancel"){
                    // ==#####== STKR SHARE CANCELLED ==#####==
                    result = {
                        delete_original: true,
                    };
                } else if (event.actions[0].value == "stkr-delete-cancel") {
                    // ==#####== STKR DELETE CANCELLED ==#####==
                    result = {
                        delete_original: true,
                    };
                } else if (event.actions[0].name == "image_share_list"){
                    // ==#####== IMAGE SHARE LIST CHOSEN ==#####==
                    var imgShareData = {
                        filename: event.actions[0].selected_options[0].value,
                        team_id: team_id,
                        username: event.user.name
                    };
                    result = await slackhelpers.shareImageMessage(imgShareData);
                } else if (event.actions[0].name == "image_delete_list"){
                    // ==#####== STKR DELETE LIST CHOSEN ==#####==
                    var imgDeleteData = {
                        filename: event.actions[0].selected_options[0].value,
                        team_id: team_id,
                    };
                    let deleteTxt = await awstools.deleteImgFromS3(imgDeleteData);
                    result = await slackhelpers.returnDeleteComplete(deleteTxt);
                }
                break;
            default: 
                // result = "STKR - Event Type Error";
        }
    }
    
    
    
    // ==#####== SLASH COMMANDS ==#####== 
    if(event.command) {
        team_id = slacktools.getTeamId(event.team_id, env);
        if((event.command == "/stkr") || (event.command == "/stkrdev")){
            if(event.text) {
                // ==#####== SHARE IMAGE BY TEXT ==#####==
                // ==#####== SLASH COMMAND WITH TEXT ==#####==
                // result = await slackhelpers.getImageURL(event);
                const slashData = {
                    env: env
                };
                result = await slackhelpers.processSlashCommand(event, slashData);
            } else if (event.text.length == 0) {
                // ==#####== SHARE IMAGE BY LIST ==#####==
                let img_count = await awstools.getCount({
                    team_id : team_id,
                });
                if(img_count == 0){
                    result = await slackhelpers.returnNoList();
                } else {
                    data = await awstools.getList({
                        team_id : team_id,
                    });
                    result = await slackhelpers.returnShareList(data);
                }
            }
        } else if ((event.command == "/stkrdelete") || (event.command == "/stkrdevdelete")){
            if(event.text) {
                // ==#####== DELETE IMAGE BY TEXT ==#####==
                // result = await getImageURL(event);
                const slashData = {
                    env: env
                };
                result = await slackhelpers.processSlashCommand(event, slashData);
            } else if (event.text.length == 0) {
                // ==#####== DELETE IMAGE BY LIST ==#####==
                data = await awstools.getList({
                    team_id : team_id,
                });
                result = await slackhelpers.returnDeleteList(data);
            }
        }
    }
    
    
    
    if(log) console.log('STKR END - Response Results:', result);
    let finalMsg = {
        isBase64Encoded: false,
        statusCode: 200,
        headers: {},
        body: JSON.stringify(result)
    };
    if(log) console.log('STKR END - Final Message :', finalMsg);
    return finalMsg;
};