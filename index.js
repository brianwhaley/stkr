console.log('Loading stkr');
var slackhelpers = require("./slack-helpers");
var awstools = require("./tools-aws");
var slacktools = require("./tools-slack");
const maxImages = 50;
let a_token;
let b_token;
let v_token;
const log = true;




exports.handler = async function(data, context) {
    // ===== STKR APP SETUP =====
    if(log) console.log('STKR - Received DATA:', JSON.stringify(data));
    a_token = data.stageVariables.ACCESS_TOKEN;
    b_token = data.stageVariables.BOT_TOKEN;
    v_token = data.stageVariables.VERIFICATION_TOKEN;
    if(log) console.log('STKR - Received Context:', JSON.stringify(context));
    var event ;
    if(data.headers['Content-Type'] == "application/json"){
        event = JSON.parse(data.body);
        if(log) console.log('STKR - Received Event:', JSON.stringify(event));
    } else {
        // 'Content-Type': 'application/x-www-form-urlencoded',
        event = slacktools.querystringToJSON(data.body);
        if(event.payload) {
            if(log) console.log("STKR - Received Payload : ", JSON.stringify(event));
            event = JSON.parse(event.payload);
        }
        if(log) console.log('STKR - Received Event:', JSON.stringify(event));
    }
    
    let result;
    if(log) console.log("STKR - Event Type: " , event.type);
    switch (event.type) {
        case "url_verification": 
            // ===== VERIFY EVENT CALLBACK URL =====
            if(log) console.log("STKR - URL Verification");
            result = slackhelpers.verify(event.challenge, event.token, v_token); 
            break;
        case "event_callback":
            // ===== CREATE NEW CONVERSATION =====
            if(log) console.log("STKR - Event Callback");
            let convo = await slackhelpers.processApiMsg({
                token: b_token,
                users: event.event.user_id,
                b_token: b_token,
                api_method: "conversations.open"
            });
            // ===== CHECK MAX IMAGES =====
            let img_count = await awstools.getCount({
                team_id : event.team_id,
            });
            // ===== TOO MANY IMAGES =====
            if(img_count >= maxImages){
                let maxImgMessage = await slackhelpers.processApiMsg({
                    token:b_token,
                    channel: convo.channel.id,
                    text: "Stkr has already uploaded the maximum number of images (" + maxImages + "). \n" + 
                        "You can make more room by deleting images with /stkrdelete .",
                    b_token: b_token,
                    api_method: "chat.postMessage"
                });
                break;
            }
            // ===== VERIFY UPLOAD YES OR NO =====
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
            // ===== PROCESS IMAGE CONFIRMATION =====
            if(log) console.log("STKR - Block Actions ; ", event.actions[0].action_id);
            let uploadData = {
                file_id: event.actions[0].value,
                user_id: event.user.id,
                team_id: event.team.id,
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
            if(log) console.log("STKR - Interactive Message");
            // ===== INTERACTIVE MENU ITEM =====
            if(event.actions[0].value == "stkr-share-cancel"){
                // ===== STKR SHARE CANCELLED =====
                result = {
                    delete_original: true,
                };
            } else if (event.actions[0].value == "stkr-delete-cancel") {
                // ===== STKR DELETE CANCELLED =====
                result = {
                    delete_original: true,
                };
            } else if (event.actions[0].name == "image_share_list"){
                // ===== IMAGE SHARE LIST CHOSEN =====
                var imgShareData = {
                    filename: event.actions[0].selected_options[0].value,
                    team_id: event.team.id,
                    username: event.user.name
                };
                result = await slackhelpers.shareImageMessage(imgShareData);
            } else if (event.actions[0].name == "image_delete_list"){
                // ===== STKR DELETE LIST CHOSEN =====
                var imgDeleteData = {
                    filename: event.actions[0].selected_options[0].value,
                    team_id: event.team.id,
                };
                let deleteTxt = await awstools.deleteImgFromS3(imgDeleteData);
                result = await slackhelpers.returnDeleteComplete(deleteTxt);
            }
            break;
        default: 
            result = "STKR - Event Type Error";
    }
    
    if(event.command) {
        if(event.command == "/stkr"){
            if(event.text) {
                // ===== SHARE IMAGE BY TEXT =====
                result = await slackhelpers.getImageURL(event);
            } else if (event.text.length == 0) {
                // ===== SHARE IMAGE BY LIST =====
                data = await awstools.getList(event);
                result = await slackhelpers.returnShareList(data);
            }
        } else if (event.command == "/stkrdelete"){
            if(event.text) {
                // ===== DELETE IMAGE BY TEXT =====
                // result = await getImageURL(event);
            } else if (event.text.length == 0) {
                // ===== DELETE IMAGE BY LIST =====
                data = await awstools.getList(event);
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