console.log('Loading stkrdelete');
var AWS = require("aws-sdk");
var awstools = require("./tools-aws");
var slacktools = require("./tools-slack");
const S3 = new AWS.S3();
const stkrBucket = "stkr-bucket";
const maxImages = 50;
const log = true;






exports.processApiMsg = processApiMsg;
async function processApiMsg(data) {
    // ==#####== VERIFY TO UPLOAD ==#####==
    let message = {
        token: data.token ? data.token : null ,
        delete_original: data.delete_original ? data.delete_original : false,
        replace_original: data.replace_original ? data.replace_original : false,
        channel: data.channel ? data.channel : null , //fileInfo.file.user
        users: data.users ? data.users : null ,
        return_im: data.return_im ? data.return_im : false,
        response_type: data.response_type ? data.response_type : 'in_channel' ,// 'ephemeral'
        text: data.text ? data.text : ''
        };
    let msgData = {
        b_token: data.b_token ? data.b_token : null ,
        api_method: data.api_method ? data.api_method : null ,
        response_url: data.response_url ? data.response_url : null
    };
    let result = await slacktools.slackApiPost(message, msgData);
    return result;
}






exports.returnNoList = returnNoList;
async function returnNoList(){
    if(log) console.log("RETURNNOLIST ");
    let result = {
        text: "There are no images in Stkr yet.",
        response_type: "ephemeral",
        delete_original: false,
        replace_original: false,
        attachments: [{
            text: "No images have been uploaded to Stkr to share with your teammates. \n" + 
            "Drag and drop an image here or in the Stkr App channel to upload and share. \n" + 
            "There is a limit of " + maxImages + " images that can be uploaded and shared.",
            fallback: "There are no images in Stkr yet.",
            color: "#336699",
            attachment_type : "default",
            callback_id: "stkr-share-none",
        }]
    };
    if(log) console.log("RETURNNOLIST - Result : ", JSON.stringify(result));
    return(result);
}






exports.returnShareList = returnShareList;
async function returnShareList(images){
    if(log) console.log("RETURNSHARELIST - Images : ", images);
    let result = {
        text: "Please select an image to display:",
        response_type: "ephemeral",
        delete_original: false,
        replace_original: false,
        attachments: [{
            text: "Choose an image to display",
            fallback: "Choose a Stkr image to display",
            color: "#336699",
            attachment_type : "default",
            callback_id: "stkr-share-selection",
            actions: [{
                name: "image_share_list",
                text: "Pick an image to share...",
                type: "select",
                options: images 
            },{
                name: "Cancel",
                text: "Cancel",
                type: "button",
                value: "stkr-share-cancel"
            }]
        }]
    };
    if(log) console.log("RETURNSHARELIST - Result : ", JSON.stringify(result));
    return(result);
}





exports.shareImageMessage = shareImageMessage;
async function shareImageMessage(data){
    if(log) console.log("SHAREIMAGEMESSAGE - Data : ", data);
    if(await awstools.isS3Object(data)===true){
        var url = 'https://' + stkrBucket + '.s3.amazonaws.com/' + data.team_id + "/" + data.filename ;
        var result = {
            delete_original: true,
            replace_original: true,
            response_type: 'in_channel',
            text: data.username + " shared " + data.filename,
            attachments: [{
                text: '',
                image_url: url,
                color: "#336699"
            }],
        };
    } else {
        result = {
            response_type: 'ephemeral',
            text: "Stkr: Unknown Image - " + data.filename
        };
    }
    return(result);
}





exports.verify = verify;
function verify(e_challenge, e_token, v_token) {
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






exports.processUploadApproved = processUploadApproved;
async function processUploadApproved(data){
    
    // ==#####== GET FILE INFO ==#####==
    if(log) console.log("PROCESS UPLOAD APPROVED - DATA : ", data);
    if(log) console.log("PROCESS UPLOAD APPROVED - FILE ID : ", data.file_id);
    let fileInfo = await slacktools.getFileInfo(data.file_id, data.b_token);
    if(log) console.log("PROCESS UPLOAD APPROVED - URL_PRIVATE : ", fileInfo.file.url_private);

    // ==#####== IS IMAGE ==#####==
    var isImage = false;
    if((fileInfo.file.filetype !== "jpg") && (fileInfo.file.filetype !== "png")) {
        if(log) console.log("UPLOADIMGTOS3 - Unsupported file type: " + fileInfo.file.name);
        
        let fileTypeMessage = await processApiMsg({
            token: data.b_token,
            response_url: data.response_url,
            text: "You have tried to upload an unsupported file type to Stkr - " + fileInfo.file.name + "\n" + 
                "Please upload a JPG or PNG file to Stkr.  Thanks!",
            b_token: data.b_token,
            api_method: "chat.postMessage"
        });
                
        return null;
    } else {
        isImage = true;
    }
    
    // ==#####== UPLOAD IMAGE ==#####==
    let imgBuffer = await slacktools.fetchImage({
        url: fileInfo.file.url_private,
        b_token: data.b_token
    });
    let upStatus = await awstools.uploadImgToS3(imgBuffer, {
        team_id : data.team_id,
        filename: fileInfo.file.name
    });

    // ==#####== GET COUNT ==#####==
    let img_count = await awstools.getCount({
        team_id : data.team_id,
    });
    
    // ==#####== RETURN MESSAGE ==#####==
    let tyMsg = {
        token: data.b_token,
        channel: fileInfo.file.user, 
        // filename: upStatus,  //fileInfo.file.name,
        text: "Thank you for uploading " + upStatus + " to Stkr! \n" + 
        "This is image " + img_count + " of " + maxImages
    };
    let tyData = {
        b_token: data.b_token,
        response_url: data.response_url,
        api_method: "chat.postMessage"
    };
    if(log) console.log("PROCESS UPLOAD APPROVED - TY MSG : ", tyMsg);
    if(log) console.log("PROCESS UPLOAD APPROVED - TY DATA : ", tyData);
    let tyPostMsg = await slacktools.slackApiPost(tyMsg, tyData);

    // ==#####== END ==#####==
    return null;
}




exports.processUploadDeclined = processUploadDeclined;
async function processUploadDeclined(data){
    if(log) console.log("PROCESS UPLOAD DECLINED - Data : ", data);
    let message = {
        token: data.b_token,
        channel: data.user_id, //fileInfo.file.user
        text: "Thank you.  File " + data.file_id + " will not be uploaded to Stkr",
        // response_type: "ephemeral",
        delete_original: false,
        replace_original: true,
    };
    if(log) console.log("PROCESS UPLOAD DECLINED - Message : ", message);
    let msgData = {
        b_token: data.b_token,
        response_url: data.response_url,
        api_method: "chat.postMessage"
    };
    let declinePostMsg = await slacktools.slackApiPost(message, msgData);
    return null;
}




exports.verifyUploadMessage = verifyUploadMessage;
async function verifyUploadMessage(data){
	let blocks =  [{
        type: "section",
        text: {
            type: "mrkdwn",
            text: "Are you sure you want to upload " + data.file_id + " to Stkr?"
        }
	},{
		type: "actions",
		elements: [{
    		type: "button",
    		text: {
    			type: "plain_text",
    			text: "Yes"
    		},
    		value: data.file_id,
    		action_id: "upload-confirm-yes"
    	},{
    		type: "button",
    		text: {
    			type: "plain_text",
    			text: "No"
    		},
    		value: "no",
    		action_id: "upload-confirm-no"
    	}]
	}];

    let message = {
        token: data.token,
        channel: data.channel, //fileInfo.file.user
        delete_original: false,
        replace_original: true,
        blocks: JSON.stringify(blocks)
    };
    return(message);
}







exports.returnDeleteList = returnDeleteList;
async function returnDeleteList(images){
    if(log) console.log("RETURNDELETELIST - Images : ", images);
    let result = {
        text: "Please select an image to delete:",
        // response_type: "ephemeral",
        delete_original: false,
        replace_original: false,
        attachments: [{
            text: "Choose a Stkr image to delete",
            fallback: "Choose a Stkr image to delete",
            color: "#336699",
            attachment_type : "default",
            callback_id: "stkr-delete-selection",
            actions: [{
                name: "image_delete_list",
                text: "Pick an image to delete...",
                type: "select",
                options: images 
            },{
                name: "Cancel",
                text: "Cancel",
                type: "button",
                value: "stkr-delete-cancel"
            }]
        }]
    };
    if(log) console.log("RETURNDELETELIST - Result : ", JSON.stringify(result));
    return(result);
}





exports.returnDeleteComplete = returnDeleteComplete;
async function returnDeleteComplete(text){
    if(log) console.log("RETURNDELETECOMPLETE : ", text);
    let blocks =  [{
        type: "section",
        text: {
            type: "mrkdwn",
            text: text
        }
	}];
    let result = {
        text: text,
        // response_type: "in_channel",
        delete_original: false,
        replace_original: true,
        blocks: JSON.stringify(blocks)
    };
    if(log) console.log("RETURNDELETELIST - Result : ", JSON.stringify(result));
    return(result);
}