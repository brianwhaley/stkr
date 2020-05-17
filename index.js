console.log('Loading stkr');

const QS = require('querystring');
var stkrhelpers = require("./stkr-helpers");
var awstools = require("./tools-aws");
var slacktools = require("./tools-slack");
const maxImages = 50;
let env;
const log = true;




exports.handler = async function(data, context) {
    // ==#####== STKR APP SETUP ==#####==
    if(log) console.log('STKR - Received DATA:', JSON.stringify(data));
    const stageVars = data.stageVariables;
    if(log) console.log('STKR - Received Stage Variables:', JSON.stringify(stageVars));
    // const a_token = stageVars.ACCESS_TOKEN;
    let b_token ; // = stageVars.BOT_TOKEN;
    const v_token = (stageVars) ? stageVars.VERIFICATION_TOKEN : undefined ;
    const c_id = (stageVars) ? stageVars.CLIENT_ID : undefined ;
    const c_secret = (stageVars) ? stageVars.CLIENT_SECRET : undefined ;
    env = (stageVars) ? stageVars.ENV : "PROD" ;
    if(log) console.log('STKR - Received Context:', JSON.stringify(context));
    let event ;
    let result ;
    let team_id ;
    let image_storage;
    if (data.httpMethod == "POST"){
        if(log) console.log("STKR - RECEIVED POST");
        if(data.headers['Content-Type'] == "application/json"){
        if(log) console.log("STKR - RECEIVED POST - JSON");
            event = JSON.parse(data.body);
        } else if(data.headers['Content-Type'] == 'application/x-www-form-urlencoded' ){
            if(log) console.log("STKR - RECEIVED POST - URLENCODED");
            event = slacktools.querystringToJSON(data.body);
            if(event.payload) {
                if(log) console.log("STKR - RECEIVED PAYLOAD : ", JSON.stringify(event));
                event = JSON.parse(event.payload);
            }
        }
    } else if (data.httpMethod == "GET"){
        if(log) console.log("STKR - RECEIVED GET");
        if(data.queryStringParameters){
            // ==#####== OAUTH ==#####==
            event = data.queryStringParameters;
            if (log) console.log("STKR - Event Code : ", event.code);
        } else if(data.body == null && data.queryStringParameters == null) {
            // ==#####== DIRECT INSTALL FROM APP DIRECTORY ==#####
            if(log) console.log("STKR - DIRECT INSTALL FROM APP DIRECTORY ");
            var url = "https://slack.com/oauth/v2/authorize" ;
            var qs = "client_id=" + c_id  + "&scope=chat:write,commands,files:read,im:write,users:read" ; 
            var msg = {
                statusCode: 302,
                headers: { "Location": url + "?" + qs },
                body: null
            };
            if(log) console.log("STKR - DIRECT INSTALL FROM APP DIRECTORY - Message", msg);
            return msg;
        }
    }
    if(log) console.log('STKR - Received Event:', JSON.stringify(event));
    
    

    if (event.code) {
        // ==#####== OAUTH REQUEST - APP INSTALL ==#####==
        // ==#####== THIS IS A WEB BASED REQUEST ==#####==
        result = await slacktools.oAuthVerify(event, {
            client_id: c_id,
            client_secret: c_secret,
            env: env
        });
        return result;
    } else if (event.hasOwnProperty("team_id") || event.hasOwnProperty("team")) {
        // ==#####== GET AUTH TOKEN ==#####==
        team_id = slacktools.getTeamId(event, env) ;
        if(log) console.log("STKR - Team ID : ", team_id);
        const getAuth = await awstools.readFromDynamo({
            tablename: awstools.stkrTokenDB ,
            key_cond_expr: "team_id = :teamid",
            attrib_vals: { ":teamid": team_id }
        });
        if(log) console.log("STKR - GetAuth : ", await getAuth);
        if (getAuth.Items.length > 0){
            if(log) console.log("STKR - Access Token : ", await getAuth.Items[0].access_token);
            image_storage = (await getAuth.Items[0].image_storage) ? await getAuth.Items[0].image_storage : "S3" ;
            if(log) console.log("STKR - Image Storage : ", image_storage);
            b_token = await getAuth.Items[0].access_token;
        }
    }
    
    
    if (event.hasOwnProperty("type") || event.hasOwnProperty("event")) {
        let event_type;
        if(event.hasOwnProperty("event")) { event_type = event.event.type; } else if (event.hasOwnProperty("type")) { event_type = event.type; }
        if(log) console.log("STKR - Event Type: " , event_type);
        switch (event_type) {
            case "url_verification": 
                // ==#####== VERIFY EVENT CALLBACK URL ==#####==
                if(log) console.log("STKR - URL Verification");
                result = slacktools.urlVerify(event.challenge, event.token, v_token); 
                break;
            case "app_uninstalled": 
                // ==#####== APP UNINSTALLED - DELETE ALL DATA FOR THAT WORKSPACE ==#####==
                if(log) console.log("STKR - App Uninstalled");
                team_id = slacktools.getTeamId(event, env);
                // ==#####== APP UNINSTALLED - CLEAN UNINSTALL ==#####==
                const cleaned = await stkrhelpers.cleanUninstall({ team_id: team_id });
                // ==#####== LOG EVENT ==@@@@@==
                var logged = await slacktools.logEvent(event, { team_id: team_id });
                break;
            case "file_shared":
                // ==#####== FILE SHARED ==#####==
                // ==#####== MUST CREATE NEW CONVERSATION - NONE EXISTS YET ==#####==
                if(log) console.log("STKR - Event Callback");
                if(image_storage && image_storage == "S3"){
                    const convo = await slacktools.processApiMsg({
                        token: b_token,
                        users: event.event.user_id, 
                        b_token: b_token,
                        api_method: "conversations.open"
                    });
                    if(log) console.log("STKR - Event Callback - Convo - ", convo);
                    if(log) console.log("STKR - Event Callback - channel - ", convo.channel);
                    if(log) console.log("STKR - Event Callback - id - ", convo.channel.id);
                    // ==#####== CHECK MAX IMAGES ==#####==
                    team_id =  slacktools.getTeamId(event, env) ;
                    const img_count = await awstools.getS3ItemCount({ 
                        bucket: awstools.stkrS3Bucket,
                        team_id : team_id, 
                    });
                    // ==#####== TOO MANY IMAGES ==#####==
                    if(img_count >= maxImages){
                        const maxImgMessage = await slacktools.processApiMsg({
                            token: b_token,
                            channel: convo.channel.id,
                            text: "Stkr has already uploaded the maximum number of images (" + maxImages + "). \n" + 
                                "You can make more room by deleting images with '" + event.command + " delete' .",
                            b_token: b_token,
                            api_method: "chat.postMessage"
                        });
                        break;
                    }
                    // ==#####== VERIFY UPLOAD YES OR NO ==#####==
                    const toUploadMsg = await stkrhelpers.verifyS3UploadMessage({
                        file_id: event.event.file_id,
                        channel: convo.channel.id,
                        token: b_token
                    });
                    const toUploadData = {
                        b_token: b_token,
                        api_method: "chat.postMessage"
                    };
                    const toUploadPostMsg = await slacktools.slackApiPost(toUploadMsg, toUploadData);
                } else {
                    if(log) console.log("STKR - Event Callback - Not S3 Image Storage - ", image_storage);
                }
                break;
            case "block_actions":
                // ==#####== PROCESS IMAGE CONFIRMATION ==#####==
                team_id = slacktools.getTeamId(event, env);
                var action_id = event.actions[0].action_id ;
                if(log) console.log("STKR - Block Actions : Action ID : ", action_id);
                const uploadData = {
                    team_id: team_id,
                    b_token: b_token,
                    v_token: v_token
                };
                switch (action_id) {
                    case "shareimage_select":
                        // ==#####== PROCESS URL IMAGE SHARE CONFIRMATION ==#####==
                        result = await stkrhelpers.shareURLImageProcess(event, uploadData);
                        var logged = await slacktools.logEvent(event, { team_id: team_id });
                        break;
                    case "deleteimage_select":
                        // ==#####== PROCESS URL IMAGE SHARE CONFIRMATION ==#####==
                        result = await stkrhelpers.deleteURLImageProcess(event, uploadData); 
                        var logged = await slacktools.logEvent(event, { team_id: team_id });
                        break;
                    case "sharelist_select":
                        // ==#####== PROCESS S3 IMAGE SHARE LIST CHOSEN ==#####==
                        const imgShareData = {
                            filename: event.actions[0].selected_option.value,
                            username: event.user.name,
                            team_id: team_id,
                            b_token: b_token
                        };
                        result = await stkrhelpers.shareS3ImageMessage(event, imgShareData);
                        var logged = await slacktools.logEvent(event, { team_id: team_id });
                        break;
                    case "deletelist_select":
                        // ==#####== STKR DELETE LIST CHOSEN ==#####==
                        const imgDeleteData = {
                            bucket: awstools.stkrS3Bucket,
                            filename: event.actions[0].selected_option.value,
                            username: event.user.name,
                            team_id: team_id,
                            b_token: b_token
                        };
                        const deleteTxt = await awstools.deleteImgFromS3(imgDeleteData);
                        result = await stkrhelpers.deleteS3ImageComplete(event, imgDeleteData);
                        var logged = await slacktools.logEvent(event, { team_id: team_id });
                        break;
                    case "upload-confirm-yes":
                        // ==#####== PROCESS IMAGE UPLOAD CONFIRMATION ==#####==
                        result = await stkrhelpers.processUploadApproved(event, uploadData); 
                        var logged = await slacktools.logEvent(event, { team_id: team_id });
                        break;
                    case "upload-confirm-no":
                        // ==#####== PROCESS IMAGE UPLOAD DECLINE ==#####==
                        result = await stkrhelpers.processUploadDeclined(event, uploadData); 
                        break;
                    case "block_cancel":
                        // ==#####== BLOCK CANCELLED ==#####==
                        const message = {
                            delete_original: true,
                            b_token: b_token ,
                            response_url: event.response_url
                        };
                        var ret = await slacktools.processApiMsg(message);
                        result = null;
                        break;
                }
                break;
            case "view_submission":
                // ==#####== MODAL DIALOG BOX SUBMITTED ==#####==
                team_id = slacktools.getTeamId(event, env) ;
                var viewdata = { 
                    team_id: team_id,
                    b_token: b_token
                }
                if(log) console.log("STKR - View Submission");
                if(event.view.callback_id == 'newimage-submit'){
                    const submit = await stkrhelpers.addNewURLImageSubmit(event, viewdata);
                }else if (event.view.callback_id == "settings-submit") {
                    // ==#####== SETTINGS SUBMITTED ==#####==
	                if(log) console.log("STKR - Settings Submitted");
                    const submit = await stkrhelpers.setSettingsSubmit(event, viewdata);
                    const ty = await stkrhelpers.setSettingsThankYou(event, viewdata);
                    // ==#####== LOG EVENT ==#####==
                    var logged = await slacktools.logEvent(event, viewdata);
                }
                break;
            case "view_closed":
                // ==#####== DIALOG BOX CLOSED ==#####==
                if(log) console.log("STKR - View Closed");
                break;
            case "interactive_message":
                team_id = slacktools.getTeamId(event, env) ;
                if(log) console.log("STKR - Interactive Message");
                // ==#####== INTERACTIVE MESSAGES ==#####==
                // INTERACTIVE MESSAGES REPLACED WITH BLOCK MESSAGES
                break;
            default: 
                // result = "STKR - Event Type Error";
        }
    }
    
    
    
    // ==#####== SLASH COMMANDS ==#####== 
    if(event.command) {
        team_id = slacktools.getTeamId(event, env);
        if((event.command == "/stkr") || (event.command == "/stkrz")){
            if (event.text.length == 0) {
                // ==#####== IF NO SLASH COMMAND TEXT, DEFAULT TO SHARE ==#####==
                event.text = "share" ;
            }
            // ==#####== SLASH COMMAND WITH TEXT ==#####==
            const slashData = {
                b_token: b_token,
                team_id : team_id,
                env: env, 
                image_storage: image_storage
            };
            result = await stkrhelpers.processSlashCommand(event, slashData);
            // ==#####== LOG EVENT ==#####==
            var logged = await slacktools.logEvent(event, { team_id: team_id });
        } 
    }
    
    
    if(log) console.log('STKR END - Response Results:', result);
    let finalMsg = {
        isBase64Encoded: false,
        statusCode: 200,
        headers: {
            "Content-type": "application/json; charset=utf-8",
            "Authorization": "Bearer " + b_token
        }
    };
    if(result == null){
    } else if(typeof result === "object") {
        finalMsg.body = JSON.stringify( result );
    } else if( (result) && (result.length > 0) ){
        finalMsg.body = JSON.stringify({
            response_type: 'in_channel',
            replace_original: true, 
            text: result
        });
    }
    
    
    if(log) console.log('STKR END - Final Message :', finalMsg);
    return finalMsg;
};