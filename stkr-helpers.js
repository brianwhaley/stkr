console.log('Loading stkr-helpers');

var awstools = require("./tools-aws");
var slacktools = require("./tools-slack");

const maxImages = 50;
const maxFileSize = 200;
const email = "stkr@pixelated.tech" ;
const log = true;




// ==========================================
//         PROCESS SLASH COMMANDS
// ==========================================




exports.processSlashCommand = processSlashCommand;
async function processSlashCommand(event, data){
    if(log) console.log("PROCESS SLASH COMMAND - Event : ", event);
    if(log) console.log("PROCESS SLASH COMMAND - Text : ", event.text);
    if(log) console.log("PROCESS SLASH COMMAND - Data : ", data);
    var result ;
    switch (event.text) {
        case "help": 
            if(log) console.log("PROCESS SLASH COMMAND - Help");
            result = helpMessage(event);
            break;
        case "bug": 
            if(log) console.log("PROCESS SLASH COMMAND - Bug");
            result = "If you want to report a bug, email " + email + " or " +
            "join the bug channel on the pixelated-tech.slack.com workspace.";
            break;
        case "support": 
            if(log) console.log("PROCESS SLASH COMMAND - Support");
            result = "If you need some support, email " + email + " or " +
                "join the support channel on the pixelated-tech.slack.com workspace.";
            break;
        case "settings": 
            if(log) console.log("PROCESS SLASH COMMAND - Settings");
            result = await setSettings(event, data);
            break;
        case "list": 
            if(log) console.log("PROCESS SLASH COMMAND - List");
            switch(data.image_storage){
                case "URL": 
                    result = await getURLList(event, data);
                    break;
                case "S3": // "catalog": 
                    result = await getS3List(event, data);
                    break;
            }
            break;
        case "share": 
            if(log) console.log("PROCESS SLASH COMMAND - Share");
            switch(data.image_storage){
                case "URL": 
                    result = await shareURLImage(event, data);
                    break;
                case "S3": // "post": 
                    const img_count = await awstools.getS3ItemCount({ 
                        bucket: awstools.stkrS3Bucket,
                        team_id : data.team_id 
                    });
                    if(img_count == 0){
                        result = await noS3ListMessage(event, data);
                    } else {
                        const list = await awstools.getS3ItemList({ 
                            bucket: awstools.stkrS3Bucket,
                            team_id : data.team_id 
                        });
                        result = await shareS3ListMessage(event, data, list);
                    }
                    break;
            }
            break;
        case "add": 
            if(log) console.log("PROCESS SLASH COMMAND - Add");
            switch(data.image_storage){
                case "URL":
                    result = await addNewURLImage(event, data);
                    break;
                case "S3": // "upload": 
                    result = "If you would like to upload a new image, " + 
                    "drag and drop it into a channel or direct message with Stkr.";
                    break;
            }
            break;
        case "delete": 
            if(log) console.log("PROCESS SLASH COMMAND - Delete");
            switch(data.image_storage){
                case "URL": 
                    result = await deleteURLImage(event, data);
                    break;
                case "S3": // "remove": 
                    result = await deleteS3Image(event, data);
                    break;
            }
            break;         
        default: 
            if(log) console.log("PROCESS SLASH COMMAND - Default");
            result = "Stkr: Unknown Image or Command - " + event.text;
    }
        
    if ( typeof(result) === "object" ){
        return result ;
    } else if ( typeof(result) === "string" ) {
        return {
            response_type: 'ephemeral',
            text: result
        };
    }
}






// ==========================================
//         HELP
// ==========================================




exports.helpMessage = helpMessage;
function helpMessage(event){
    var cmd = event.command ;
    return (`
STKR COMMANDS :
* Type '${cmd}' in any channel to share an image.  This is the same as typing '${cmd} share'.
* Type '${cmd} help' in any channel to get basic help information.
* Type '${cmd} bug' in any channel to get information on reporting bugs to the development team.
* Type '${cmd} support' to get basic support information, including a support email address.
* Type '${cmd} settings' (for Admins only) to change Stkr settings forthe workspace, including how images are stored.
* Type '${cmd} list' to see a full list of all images that are available to your workspace.
* Type '${cmd} share' to share an image with your teammates.
* Type '${cmd} add' to add a new image for sharing.
* Type '${cmd} delete' to get a list of images to delete if you upload too many.
* There is a maximum of ${maxImages} images that can be added per workspace.
* There is a limit of ${maxFileSize} KB file size for uploaded images.
    `);
}



// ==========================================
//         CLEAN UNINSTALL FUNCTIONS
// ==========================================




exports.cleanUninstall = cleanUninstall;
async function cleanUninstall(data){
    if(log) console.log("CLEAN UNINSTALL - Data : ", data);
    
    // ==#####== GET ALL URL IMAGES ==#####==
	const images = await awstools.readFromDynamo({
        tablename: awstools.stkrImageDB,
        indexname: "team_id-index",
        key_cond_expr: "team_id = :teamid",
        attrib_vals: { ":teamid": data.team_id },
        proj_expr: "stkr_id" 
    });
    if(log) console.log("CLEAN UNINSTALL - App Uninstalled - Images", images);
    
    if(images.Items.length > 0){
        // ==#####== DELETE URL IMAGES ==#####==
        var itemsArray = [];
        images.Items.forEach(async function(image) {
    		var newitem = {
        		DeleteRequest : {
            		Key : { team_id: data.team_id, stkr_id: image.stkr_id }
        		}
    		};
    		itemsArray.push(newitem);
    	});
        if(log) console.log("CLEAN UNINSTALL - App Uninstalled - Items", JSON.stringify(itemsArray));
    	var params = {
        	RequestItems : { [awstools.stkrImageDB] : itemsArray }
    	};
        if(log) console.log("CLEAN UNINSTALL - App Uninstalled - Params", JSON.stringify(params));
        const deimaged = await awstools.batchDeleteFromDynamo({
        	params: params
        });
    }
    
    // ==#####== DELETE S3 IMAGES ==#####==
    const emptied = await awstools.emptyS3Directory({ 
        bucket: awstools.stkrS3Bucket,
        team_id: data.team_id 
    });
    
    // ==#####== DELETE TOKEN ==#####==
    const detokened = await awstools.deleteFromDynamo( {
        tablename: awstools.stkrTokenDB,
        key: { "team_id" : data.team_id }
    });
    
    if(log) console.log("CLEAN UNINSTALL - Complete");
    
    return null;
}




// ========================================
//              GLOBAL SETTINGS 
// ========================================



exports.setSettings = setSettings;
async function setSettings(event, data){
    if(log) console.log("SET SETTINGS - Event : ", event);
    if(log) console.log("SET SETTINGS - Data : ", data);
    var msg = {
        token: data.b_token,
        user: event.user_id
    };
    if(log) console.log("SET SETTINGS - Msg : ", msg);
    var msgdata = {
        api_method: "users.info"
    };
    if(log) console.log("SET SETTINGS - Msg Data : ", msgdata);
    var userinfo = await slacktools.slackApiGet( msg, msgdata );
    if(log) console.log("SET SETTINGS - User Info : ", userinfo);
    var isAdmin = userinfo.user.is_admin ;
    if(log) console.log("SET SETTINGS - Is Admin : ", isAdmin);
    var settingsMsg;
    if(isAdmin){
        settingsMsg = await setSettingsMessage(event, data);
    } else {
        settingsMsg = await setSettingsNotAdmin(event, data);
    }
    return null;
}





exports.setSettingsMessage = setSettingsMessage;
async function setSettingsMessage(event, data){
    if(log) console.log("SET SETTINGS MESSAGE - Event : ", event);
    if(log) console.log("SET SETTINGS MESSAGE - Data : ", data);
    let _view = {
    	"type": "modal",
    	"callback_id": "settings-submit",
        "private_metadata": JSON.stringify({channel_id: event.channel_id}),
        "clear_on_close": true,
        "notify_on_close": false,
    	"title": {
    		"type": "plain_text",
    		"text": "Stkr - Global Settings"
    	},
    	"submit": {
    		"type": "plain_text",
    		"text": "Submit"
    	},
    	"close": {
    		"type": "plain_text",
    		"text": "Cancel"
    	},
    	"blocks": [
    		{
    			"type": "input",
    			"block_id": "settings_view_image_types",
    			"label": {
    				"type": "plain_text",
    				"text": "Image Storage Method"
    			},
    			"element": {
    				"type": "radio_buttons",
                    "action_id": "settings_image_type",
    				"initial_option": {
    					"text": {
							"type": "plain_text",
							"text": "S3 Image Storage"
						},
						"value": "S3",
						"description": {
							"type": "plain_text",
							"text": "Use S3 Image Storage to have images uploaded to Slack stored in a file system bucket."
						}
    				},
    				"options": [
    					{
    						"text": {
    							"type": "plain_text",
    							"text": "S3 Image Storage"
    						},
    						"value": "S3",
    						"description": {
    							"type": "plain_text",
    							"text": "Use S3 Image Storage to have images uploaded to Slack stored in a file system bucket."
    						}
    					},
    					{
    						"text": {
    							"type": "plain_text",
    							"text": "URL Image Storage"
    						},
    						"value": "URL",
    						"description": {
    							"type": "plain_text",
    							"text": "Use URL Image Storage to save URLs of your images that are stored wherever you like."
    						}
    					}
    				]
    			},
    			"hint": {
    				"type": "plain_text",
    				"text": "."
    			}
    		}
    	]
    };
    if(log) console.log("SET SETTINGS MESSAGE - Set Value : ", data.image_storage);
    if(data.image_storage == "URL"){
        _view.blocks[0].element.initial_option = _view.blocks[0].element.options[1];
    }
    if(log) console.log("SET SETTINGS MESSAGE - View : ", _view);
    let message = {
        token: data.b_token,
        trigger_id: event.trigger_id ,
        view: _view ,
        b_token: data.b_token ,
        api_method: "views.open"
    };
    if(log) console.log("SET SETTINGS MESSAGE - Result : ", message);
    let result = await slacktools.processApiMsg(message);
    
    return null;
}




exports.setSettingsNotAdmin = setSettingsNotAdmin;
async function setSettingsNotAdmin(event, data, image_list){
    if(log) console.log("SET SETTINGS NOT ADMIN MESSAGE - Event : ", event);
    if(log) console.log("SET SETTINGS NOT ADMIN MESSAGE - Data : ", data);
    if(log) console.log("SET SETTINGS NOT ADMIN MESSAGE - Image List : ", image_list);
    let blocks = [
		{
			"type": "section",
			"block_id": "setsettings_noadmin_message",
			"text": {
				"type": "mrkdwn",
				"text": "Unfortunately, you are not a worspace admin. \n" + 
				"Only worspace admins can change Stkr Global Settings."
			}
		}
    ];
    let message = {
        token: data.b_token,
        replace_original: true,
        channel: event.channel_id, 
        response_type: 'ephemeral' ,
        blocks: blocks,
        b_token: data.b_token ,
        api_method: "chat.postMessage" ,
        response_url: event.response_url
    };
    if(log) console.log("SET SETTINGS NOT ADMIN MESSAGE - Result : ", message);
    let result = await slacktools.processApiMsg(message);
    return null;
}





exports.setSettingsSubmit = setSettingsSubmit;
async function setSettingsSubmit(event, data){
	if(log) console.log("SET SETTINGS SUBMIT - Event : ", JSON.stringify(event));
    var image_storage = event.view.state.values.settings_view_image_types.settings_image_type.selected_option.value ;
    let res = await awstools.updateToDynamo({
        tablename: awstools.stkrTokenDB,
        key: { team_id : data.team_id } ,
        update_expr: "set image_storage = :imagestorage",
        attrib_vals: { ":imagestorage": image_storage }
    });
	if(log) console.log("SET SETTINGS SUBMIT - Submitted ");
	return null;
}





exports.setSettingsThankYou = setSettingsThankYou;
async function setSettingsThankYou(event, data){
    if(log) console.log("SET SETTINGS SUBMIT THANK YOU - Event : ", JSON.stringify(event));
    if(log) console.log("SET SETTINGS THANK YOU - Data : ", data);
    var prvmeta = JSON.parse(event.view.private_metadata);
    if(log) console.log("SET SETTINGS THANK YOU - Private Metadata : ", prvmeta);
    // ==#####== CREATE THANK YOU MESSAGE ==#####==
    var blocks = [
		{
			"type": "section",
			"block_id": "setsettings_ty_message",
			"text": {
				"type": "mrkdwn",
				"text": "Thank you for updating Stkr Global Settings for your workspace! \n" 
			}
		}
    ];
    var message = {
        token: data.b_token,
        channel: prvmeta.channel_id, 
        response_type: 'ephemeral' ,
        blocks: blocks,
        b_token: data.b_token ,
        api_method: "chat.postMessage" ,
        trigger_id: event.trigger_id ,
        response_url: event.response_url
    };
    if(log) console.log("SET SETTINGS SUBMIT THANK YOU - Message : ", message);
    var result = await slacktools.processApiMsg(message);
    return null;
}




// ========================================
//              LIST URL IMAGES
// ========================================



exports.getURLImageCount = getURLImageCount;
async function getURLImageCount(event, data){
    var qryCount = await awstools.readFromDynamo({
        tablename: awstools.stkrImageDB ,
        indexname: "team_id-index",
        key_cond_expr: "team_id = :teamid",
        attrib_vals: { ":teamid": data.team_id },
        select: 'COUNT'
    });
    if(log) console.log("GET URL IMAGE COUNT - Count : ", qryCount.Count);
    return qryCount.Count ;
}




exports.getURLList = getURLList;
async function getURLList(event, data){
    if(log) console.log("GET URL LIST - Event : ", event);
    if(log) console.log("GET URL LIST - Data : ", data);
    // ==#####== QUERY IMAGE DB ==#####==
    let images = await awstools.readFromDynamo({
        tablename: awstools.stkrImageDB ,
        indexname: "team_id-index",
        key_cond_expr: "team_id = :teamid",
        attrib_vals: { ":teamid": data.team_id }
    });
    if(log) console.log("GET URL LIST - Images : ", images);
    // ==#####== GENERATE LIST ==#####==
    var image_list = images.Items.map(item => { 
        return "* " + item.image_name ;
    }).sort();
    if(log) console.log("GET URL LIST - Images List : ", image_list);
    // ==#####== PACKAGE THE MESSAGE ==#####==
    if(image_list.length < 1) {
        var msg = await noURLListMessage(event, data, image_list);
    } else {
        var msg = await shareURLListMessage(event, data, image_list);
    }
    // ==#####== SEND THE MESSAGE ==#####==
    return null;
}




exports.noURLListMessage = noURLListMessage;
async function noURLListMessage(event, data){
    if(log) console.log("NO URL LIST MESSAGE - Event : ", event);
    if(log) console.log("NO URL LIST MESSAGE - Data : ", data);
    let blocks = [
		{
			"type": "section",
			"block_id": "stkr-share-none",
			"text": {
				"type": "mrkdwn",
				"text": "No images have been added to Stkr to share with your teammates. \n" + 
                    "Type '" + event.command + " add' to add images that can be shared. \n" + 
                    "There is a limit of " + maxImages + " images that can be added and shared."
			}
		}
    ];
    let message = {
        token: data.b_token,
        replace_original: true,
        channel: event.channel_id, 
        response_type: 'ephemeral' ,
        blocks: blocks,
        b_token: data.b_token ,
        api_method: "chat.postMessage" ,
        response_url: event.response_url
    };
    if(log) console.log("NO URL LIST MESSAGE - Result : ", message);
    let result = await slacktools.processApiMsg(message);
    return null;
}




exports.shareURLListMessage = shareURLListMessage;
async function shareURLListMessage(event, data, image_list){
    if(log) console.log("SHARE URL LIST MESSAGE - Event : ", event);
    if(log) console.log("SHARE URL LIST MESSAGE - Data : ", data);
    if(log) console.log("SHARE URL LIST MESSAGE - Image List : ", image_list);
    var msgText ;
    var imgCount = image_list.length ;
    msgText = "List of URL images to share : " + "(" + imgCount + " of " + maxImages + ") \n" ;
    msgText += image_list.join(" \n ") ;
    let blocks = [
		{
			"type": "section",
			"block_id": "shareimage_message",
			"text": {
				"type": "mrkdwn",
				"text": msgText
			}
		}
    ];
    let message = {
        token: data.b_token,
        replace_original: true,
        channel: event.channel_id, 
        response_type: 'ephemeral' ,
        blocks: blocks,
        b_token: data.b_token ,
        api_method: "chat.postMessage" ,
        response_url: event.response_url
    };
    if(log) console.log("SHARE URL LIST MESSAGE - Result : ", message);
    let result = await slacktools.processApiMsg(message);
    return null;
}




// ========================================
//              ADD NEW URL IMAGE 
// ========================================





exports.addNewURLImage = addNewURLImage;
async function addNewURLImage(event, data){
    if(log) console.log("ADD NEW URL IMAGE - Data : ", data);
    let msg = await addNewURLImageMessage(event, data);
    if(log) console.log("ADD NEW URL IMAGE - Message : ", msg);
    let postData = {
        api_method: "views.open",
        b_token: data.b_token
    };
    if(log) console.log("ADD NEW URL IMAGE - Post Data : ", postData);
    let res = await slacktools.slackApiPost(msg, postData);
    if(log) console.log("ADD NEW URL IMAGE - Response : ", res);
    return null;
}




exports.addNewURLImageMessage = addNewURLImageMessage;
async function addNewURLImageMessage(event, data){
    if(log) console.log("ADD NEW URL IMAGE MESSAGE ");
    let _view = {
    	"type": "modal",
    	"callback_id": "newimage-submit",
        "private_metadata": JSON.stringify({channel_id: event.channel_id}),
        "clear_on_close": true,
        "notify_on_close": false,
    	"title": {
    		"type": "plain_text",
    		"text": "Stkr - Add Image"
    	},
    	"submit": {
    		"type": "plain_text",
    		"text": "Submit"
    	},
    	"close": {
    		"type": "plain_text",
    		"text": "Cancel"
    	},
    	"blocks": [
    		{
    			"type": "section",
    			"block_id": "newimage_view_title",
    			"text": {
    				"type": "plain_text",
    				"text": "Please paste your image URL here and submit."
    			}
    		},
    		{
    			"type": "input",
    			"block_id": "newimage_name_block",
    			"element": {
    				"type": "plain_text_input",
                    "action_id": "newimage_name",
    				"placeholder": {
    					"type": "plain_text",
    					"text": "Type in image name..."
    				}
    			},
    			"label": {
    				"type": "plain_text",
    				"text": "Image Name: (no spaces)"
    			}
    		},
    		{
    			"type": "input",
    			"block_id": "newimage_url_block",
    			"element": {
    				"type": "plain_text_input",
                    "action_id": "newimage_url",
    				"placeholder": {
    					"type": "plain_text",
    					"text": "Type in image URL..."
    				}
    			},
    			"label": {
    				"type": "plain_text",
    				"text": "Image URL:"
    			}
    		}
    	]
    };
    if(log) console.log("ADD NEW URL IMAGE MESSAGE - View : ", _view);
    let message = {
        trigger_id: event.trigger_id,
        view: _view
    };
    if(log) console.log("ADD NEW URL IMAGE MESSAGE - Message : ", message);
    return(message);
}





exports.addNewURLImageSubmit = addNewURLImageSubmit;
async function addNewURLImageSubmit(event, data){
	if(log) console.log("ADD NEW URL IMAGE SUBMIT - Event : ", JSON.stringify(event));
    // ==#####== NEW IMAGE SUBMITTED ==#####==
    if(log) console.log("STKR - New Image Submitted");
    var urlExists = await slacktools.urlExists(event.view.state.values.newimage_url_block.newimage_url.value) ;
    if (urlExists.statusCode == 200){
        if(log) console.log("STKR - New Image Exists");
        var mimes = ["image/jpeg", "image/jpg", "image/png"];
        if(mimes.includes(urlExists.headers['content-type'])){
            // ==#####== NEW IMAGE SUBMITTED - ITS AN IMAGE ==#####==
            let res = await awstools.writeToDynamo({
                tablename: awstools.stkrImageDB,
                item: {
                    team_id : data.team_id ,
                    stkr_id : Date.now().valueOf().toString() ,
                    image_name : event.view.state.values.newimage_name_block.newimage_name.value.replace(/\+/g, '-') ,
                    image_url : event.view.state.values.newimage_url_block.newimage_url.value ,
                    put_date : new Date().toISOString() 
                }
            });
            if(log) console.log("ADD NEW URL IMAGE SUBMIT - Saved ");
            const ty = await addNewURLImageThankYou(event, data);
            // ==#####== LOG EVENT ==#####==
            const logged = await slacktools.logEvent(event, data);
        } else {
    	    if(log) console.log("ADD NEW URL NOT IMAGE SUBMIT - Not Image ");
            const res = await addNewURLNotImage(event, data);
        }
    } else {
	    if(log) console.log("ADD NEW URL IMAGE SUBMIT - Error ");
        const res = await addNewURLImageError(event, data);
    }
	return null;
}





exports.addNewURLImageThankYou = addNewURLImageThankYou;
async function addNewURLImageThankYou(event, data){
    if(log) console.log("ADD NEW URL IMAGE SUBMIT THANK YOU - Event : ", JSON.stringify(event));
    if(log) console.log("ADD NEW URL IMAGE SUBMIT THANK YOU - Data : ", data);
    // ==#####== GET URL IMAGE NAME AND URL IMAGE COUNT ==#####==
    var image_name = event.view.state.values.newimage_name_block.newimage_name.value.replace(/\+/g, '-');
    var prvmeta = JSON.parse(event.view.private_metadata);
    var qryCount = await getURLImageCount(event, data);
    if(log) console.log("ADD NEW URL IMAGE SUBMIT THANK YOU - Count : ", qryCount);
    // ==#####== CREATE THANK YOU MESSAGE ==#####==
    var blocks = [
		{
			"type": "section",
			"block_id": "shareimage_message",
			"text": {
				"type": "mrkdwn",
				"text": "Thank you for adding " + image_name + " to Stkr! \n" + 
				"This is image " + qryCount + " of " + maxImages.toString()
			}
		}
    ];
    var message = {
        token: data.b_token,
        channel: prvmeta.channel_id, 
        response_type: 'in_channel' ,
        blocks: blocks,
        b_token: data.b_token ,
        api_method: "chat.postMessage" ,
        trigger_id: event.trigger_id ,
        response_url: event.response_url
    };
    if(log) console.log("ADD NEW URL IMAGE SUBMIT THANK YOU - Message : ", message);
    var result = await slacktools.processApiMsg(message);
    return null;
}





exports.addNewURLImageError = addNewURLImageError;
async function addNewURLImageError(event, data){
    if(log) console.log("ADD NEW URL IMAGE SUBMIT ERROR - Event : ", JSON.stringify(event));
    if(log) console.log("ADD NEW URL IMAGE SUBMIT ERROR - Data : ", data);
    var prvmeta = JSON.parse(event.view.private_metadata);
    // ==#####== CREATE THANK YOU MESSAGE ==#####==
    var blocks = [
		{
			"type": "section",
			"block_id": "addimage_errormessage",
			"text": {
				"type": "mrkdwn",
				"text": "There was an error with your image.  Please try again."
			}
		}
    ];
    var message = {
        token: data.b_token,
        channel: prvmeta.channel_id, 
        response_type: 'in_channel' ,
        blocks: blocks,
        b_token: data.b_token ,
        api_method: "chat.postMessage" ,
        trigger_id: event.trigger_id ,
        response_url: event.response_url
    };
    if(log) console.log("ADD NEW URL IMAGE SUBMIT ERROR - Message : ", message);
    var result = await slacktools.processApiMsg(message);
    return null;
}





exports.addNewURLNotImage = addNewURLNotImage;
async function addNewURLNotImage(event, data){
    if(log) console.log("ADD NEW URL NOT IMAGE - Event : ", JSON.stringify(event));
    if(log) console.log("ADD NEW URL NOT IMAGE - Data : ", data);
    var prvmeta = JSON.parse(event.view.private_metadata);
    // ==#####== CREATE THANK YOU MESSAGE ==#####==
    var blocks = [
		{
			"type": "section",
			"block_id": "addimage_notimage",
			"text": {
				"type": "mrkdwn",
				"text": "You have tried to add an unsupported file type to Stkr. \n" + 
                "Please upload a JPG or PNG file to Stkr.  Thanks!",
			}
		}
    ];
    var message = {
        token: data.b_token,
        channel: prvmeta.channel_id, 
        response_type: 'ephemeral' ,
        blocks: blocks,
        b_token: data.b_token ,
        api_method: "chat.postMessage" ,
        trigger_id: event.trigger_id ,
        response_url: event.response_url
    };
    if(log) console.log("ADD NEW URL NOT IMAGE - Message : ", message);
    var result = await slacktools.processApiMsg(message);
    return null;
}





// ========================================
//            SHARE URL IMAGE
// ========================================




exports.shareURLImage = shareURLImage;
async function shareURLImage(event, data){
    if(log) console.log("SHARE URL IMAGE - Event : ", event);
    if(log) console.log("SHARE URL IMAGE - Data : ", data);
    // ==#####== QUERY IMAGE DB ==#####==
    let images = await awstools.readFromDynamo({
        tablename: awstools.stkrImageDB ,
        indexname: "team_id-index",
        key_cond_expr: "team_id = :teamid",
        attrib_vals: { ":teamid": data.team_id }
    });
    // ==#####== SORT IMAGES ==#####==
    images.Items.sort(slacktools.sortByProperty("image_name"));
    if(log) console.log("SHARE URL IMAGE - Images : ", images);
    if(log) console.log("SHARE URL IMAGE - Images Items Length : ", images.Items.length);
    if(images.Items.length == 0){
        let result = await noURLListMessage(event, data);
    } else {
        // ==#####== GENERATE LIST ==#####==
        var image_list = images.Items.map(item => { 
            return { "text": { "type": "plain_text", "text": item.image_name } , value: item.stkr_id } ;
        });
        if(log) console.log("SHARE URL IMAGE - Images List : ", image_list);
        //package the message
        let message = await shareURLImageMessage(event, data, image_list);
        if(log) console.log("SHARE URL IMAGE - Message : ", message);
        let result = await slacktools.processApiMsg(message);
    }
    return null;
}





exports.shareURLImageMessage = shareURLImageMessage;
async function shareURLImageMessage(event, data, image_list){
    if(log) console.log("SHARE URL IMAGE MESSAGE - Event : ", event);
    if(log) console.log("SHARE URL IMAGE MESSAGE - Data : ", data);
    if(log) console.log("SHARE URL IMAGE MESSAGE - Image List : ", image_list);
    let blocks = [
		{
			"type": "section",
			"block_id": "shareimage_message",
			"text": {
				"type": "mrkdwn",
				"text": "Please select a sticker image to share"
			}
		},
		{
			"type": "actions",
			"elements": [
				{
					"type": "static_select",
					// "block_id": "shareimage_select_block",
					"action_id": "shareimage_select",
					"placeholder": {
						"type": "plain_text",
						"text": "Select an image..."
					},
					"options": image_list
				},
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Cancel"
					},
					"style": "danger",
					"value": "shareimage_cancel",
                    "action_id": "block_cancel"
				}
			]
		}
    ];
    let message = {
        token: data.b_token,
        channel: event.channel_id, 
        response_type: 'ephemeral', 
        replace_original: true,
        b_token: data.b_token,
        api_method: "chat.postMessage",
        response_url: event.response_url,
        blocks: blocks
    };
    if(log) console.log("SHARE URL IMAGE MESSAGE - Result : ", message);
    return(message);
}





exports.shareURLImageProcess = shareURLImageProcess;
async function shareURLImageProcess(event, data){
    if(log) console.log("SHARE URL IMAGE PROCESS - Event : ", event);
    if(log) console.log("SHARE URL IMAGE PROCESS - Data : ", data);
    // ==#####== GET IMAGE DATA FROM EVENT ==#####== 
    var stkr_id = event.actions[0].selected_option.value ;
    // ==#####== QUERY DYNAMO FOR URL ==#####==
    let getImg = await awstools.readFromDynamo({
        tablename: awstools.stkrImageDB ,
        key_cond_expr: "team_id = :teamid AND stkr_id = :stkrid",
        attrib_vals: { ":teamid": data.team_id, ":stkrid": stkr_id }
    });
    if(log) console.log("SHARE URL IMAGE PROCESS - Get Img : ", getImg);
    var blocks = [
		{
			"type": "image",
			"title": {
				"type": "plain_text",
				"text": event.user.name + " shared " + getImg.Items[0].image_name
			},
			"image_url": getImg.Items[0].image_url,
			"alt_text": getImg.Items[0].image_name
		}
	];
    let message = {
        token: data.b_token,
        delete_original: true,
        replace_original: true,
        response_type: 'in_channel' ,
        channel: event.channel.id, 
        blocks: blocks,
        b_token: data.b_token ,
        api_method: "chat.postMessage" ,
        response_url: event.response_url
    };
    let result = await slacktools.processApiMsg(message);
    // ==#####== END ==#####==
    return null;
}





// ========================================
//            DELETE URL IMAGE 
// ========================================





exports.deleteURLImage = deleteURLImage;
async function deleteURLImage(event, data){
    if(log) console.log("DELETE URL IMAGE - Event : ", event);
    if(log) console.log("DELETE URL IMAGE - Data : ", data);
    // ==#####== QUERY IMAGE DB ==#####==
    let images = await awstools.readFromDynamo({
        tablename: awstools.stkrImageDB ,
        indexname: "team_id-index",
        key_cond_expr: "team_id = :teamid",
        attrib_vals: { ":teamid": data.team_id }
    });
    // ==#####== SORT IMAGES ==#####==
    images.Items.sort(slacktools.sortByProperty("image_name"));
    if(log) console.log("DELETE URL IMAGE - Images : ", images);
    if(log) console.log("DELETE URL IMAGE - Images Items Length : ", images.Items.length);
    if(images.Items.length == 0){
        let result = await noURLListMessage(event, data);
    } else {
        // ==#####== GENERATE LIST ==#####==
        if(log) console.log("DELETE URL IMAGE - Images : ", images);
        // ==#####== GENERATE LIST ==#####==
        var image_list = images.Items.map(item => { 
            return { "text": { "type": "plain_text", "text": item.image_name } , value: item.stkr_id } ;
        });
        if(log) console.log("DELETE URL IMAGE - Images List : ", image_list);
        // ==#####== package the message ==#####== 
        let msg = await deleteURLImageMessage(event, data, image_list);
        // ==#####== send the message ==#####== 
        msg.b_token = data.b_token ;
        msg.api_method = "chat.postMessage" ;
        msg.response_url = event.response_url ;
        let result = await slacktools.processApiMsg(msg);
    }
    return null;
}






exports.deleteURLImageMessage = deleteURLImageMessage;
async function deleteURLImageMessage(event, data, image_list){
    if(log) console.log("DELETE IMAGE MESSAGE - Event : ", event);
    if(log) console.log("DELETE IMAGE MESSAGE - Data : ", data);
    if(log) console.log("DELETE IMAGE MESSAGE - Image List : ", image_list);
    let blocks = [
		{
			"type": "section",
			"block_id": "deleteimage_message",
			"text": {
				"type": "mrkdwn",
				"text": "Please select a sticker image to delete"
			}
		},
		{
			"type": "actions",
			"elements": [
				{
					"type": "static_select",
					"action_id": "deleteimage_select",
					"placeholder": {
						"type": "plain_text",
						"text": "Select an image..."
					},
					"options": image_list
				},
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Cancel"
					},
					"style": "danger",
					"value": "deleteimage_cancel",
                    "action_id": "block_cancel"
				}
			]
		}
    ];
    let message = {
        token: data.b_token,
        replace_original: true,
        response_type: 'ephemeral', 
        channel: event.channel_id, 
        blocks: blocks
    };
    if(log) console.log("DELETE IMAGE MESSAGE - Result : ", message);
    return(message);
}






exports.deleteURLImageProcess = deleteURLImageProcess;
async function deleteURLImageProcess(event, data){
    if(log) console.log("DELETE URL IMAGE PROCESS - Event : ", JSON.stringify(event));
    if(log) console.log("DELETE URL IMAGE PROCESS - Data : ", data);
    // ==#####== GET IMAGE DATA FROM EVENT ==#####== 
    var stkr_id = event.actions[0].selected_option.value ;
    // ==#####== QUERY DYNAMO FOR URL ==#####==
    let delImg = await awstools.deleteFromDynamo({
        tablename: awstools.stkrImageDB ,
        key: { "team_id" : data.team_id, stkr_id: stkr_id }
        // key_cond_expr: "team_id = :teamid AND stkr_id = :stkrid",
        // attrib_vals: { ":teamid": event.team.id, ":stkrid": stkr_id }
    });
    if(log) console.log("DELETE URL IMAGE PROCESS - DelImg : ", delImg);
    var blocks = [
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": "The image " + event.actions[0].selected_option.text.text + " has been deleted. "
			}
		}
	];
    let message = {
        token: data.b_token,
        delete_original: true,
        replace_original: true,
        channel: event.channel.id, 
        response_type: 'in_channel' ,
        blocks: blocks,
        b_token: data.b_token ,
        api_method: "chat.postMessage",
        response_url: event.response_url
    };
    let result = await slacktools.processApiMsg(message);
    // ==#####== END ==#####==
    return null;
}






// ========================================
//              LIST S3 IMAGES
// ========================================






exports.getS3List = getS3List;
async function getS3List(event, data){
    if(log) console.log("GET S3 LIST - Event : ", event);
    if(log) console.log("GET S3 LIST - Data : ", data);
    // ==#####== QUERY S3 ==#####==
    var image_list = await awstools.getS3ItemList({ 
        bucket: awstools.stkrS3Bucket,
        team_id : data.team_id 
    });
    if(log) console.log("GET S3 LIST - List Data : ", image_list);
    // ==#####== SEND THE MESSAGE ==#####==
    if(image_list.length < 1) {
        var msg = await noS3ListMessage(event, data);
    } else {
        var msg = await listS3Message(event, data, image_list);
    }
    return null;
}




exports.listS3Message = listS3Message;
async function listS3Message(event, data, image_list){
    if(log) console.log("SHARE S3 LIST MESSAGE - Event : ", event);
    if(log) console.log("SHARE S3 LIST MESSAGE - Data : ", data);
    if(log) console.log("SHARE S3 LIST MESSAGE - Image List : ", image_list);
    const img_count = await awstools.getS3ItemCount({ 
        bucket: awstools.stkrS3Bucket,
        team_id : data.team_id 
    });
    var msgText = "List of uploaded images to share : " + "(" + img_count + " of " + maxImages + ") \n" ;
    var image_names = image_list.map(img => { 
        return "* " + img.text.text  ;
    });
    msgText += image_names.join(" \n ") ;
    if(log) console.log("SHARE S3 LIST MESSAGE - Message Text : ", msgText);
    let blocks = [
		{
			"type": "section",
			"block_id": "listimage_message",
			"text": {
				"type": "mrkdwn",
				"text": msgText
			}
		}
    ];
    let message = {
        token: data.b_token,
        replace_original: true,
        channel: event.channel_id, 
        response_type: 'ephemeral' ,
        blocks: blocks,
        b_token: data.b_token ,
        api_method: "chat.postMessage" ,
        response_url: event.response_url
    };
    if(log) console.log("SHARE S3 LIST MESSAGE - Result : ", message);
    let result = await slacktools.processApiMsg(message);
    return null;
}







// ========================================
//              UPLOAD NEW S3 IMAGE 
// ========================================



exports.processUploadApproved = processUploadApproved;
async function processUploadApproved(event, data){
    // ==#####== GET FILE INFO ==#####==
    if(log) console.log("PROCESS UPLOAD APPROVED - Event : ", JSON.stringify(event));
    if(log) console.log("PROCESS UPLOAD APPROVED - DATA : ", data);
    if(log) console.log("PROCESS UPLOAD APPROVED - FILE ID : ", event.actions[0].value);
    var fileInfo = await slacktools.getFileInfo(event.actions[0].value, data.b_token);
    if(log) console.log("PROCESS UPLOAD APPROVED - URL_PRIVATE : ", fileInfo.file.url_private);
    // ==#####== IS IMAGE ==#####==
    if((fileInfo.file.filetype !== "jpg") && (fileInfo.file.filetype !== "png")) {
        if(log) console.log("PROCESS UPLOAD APPROVED - Unsupported file type: " + fileInfo.file.name);
        var fileTypeMessage = await slacktools.processApiMsg({
            token: data.b_token,
            replace_original: true,
            response_type: "ephemeral",
            response_url: event.response_url,
            text: "You have tried to upload an unsupported file type to Stkr - " + fileInfo.file.name + "\n" + 
                "Please upload a JPG or PNG file to Stkr.  Thanks!",
            b_token: data.b_token,
            api_method: "chat.postMessage"
        });
        return null;
    } 
    // ==#####== DOWNLOAD IMAGE TO BUFFER ==#####==
    var imgBuffer = await slacktools.fetchImage({
        url: fileInfo.file.url_private,
        b_token: data.b_token
    });
    // ==#####== FILE SIZE CHECK ==#####==
    var imgBufferKB = (imgBuffer.byteLength / 1024) ;
    console.log( "PROCESS UPLOAD APPROVED - Buffer Size : ", imgBufferKB, " KB" );
    if(imgBufferKB > maxFileSize) {
        if(log) console.log("PROCESS UPLOAD APPROVED - Buffer Size Too Large: ", imgBufferKB, " KB" );
        var fileSizeMessage = await slacktools.processApiMsg({
            token: data.b_token,
            replace_original: true,
            response_type: "ephemeral",
            response_url: event.response_url,
            text: "You have tried to upload a file that is too large for Stkr - " + fileInfo.file.name + " - " + imgBufferKB + " KB" + "\n" + 
                "Please upload a smaller JPG or PNG file to Stkr below " + maxFileSize + " KB.  Thanks!",
            b_token: data.b_token,
            api_method: "chat.postMessage"
        });  
        return null;
    }
    // ==#####== UPLOAD IMAGE TO S3 ==#####==
    var upStatus = await awstools.uploadImgToS3(imgBuffer, {
        bucket: awstools.stkrS3Bucket,
        team_id : data.team_id,
        filename: fileInfo.file.name
    });
    // ==#####== GET COUNT ==#####==
    var img_count = await awstools.getS3ItemCount({ 
        bucket: awstools.stkrS3Bucket,
        team_id : data.team_id 
    });
    // ==#####== RETURN MESSAGE ==#####==
    var tyMsg = {
        token: data.b_token,
        channel: fileInfo.file.user, 
        // filename: upStatus,  //fileInfo.file.name,
        text: "Thank you for uploading " + upStatus + " to Stkr! \n" + 
        "This is image " + img_count + " of " + maxImages
    };
    var tyData = {
        b_token: data.b_token,
        response_url: event.response_url,
        api_method: "chat.postMessage"
    };
    if(log) console.log("PROCESS UPLOAD APPROVED - TY MSG : ", tyMsg);
    if(log) console.log("PROCESS UPLOAD APPROVED - TY DATA : ", tyData);
    var tyPostMsg = await slacktools.slackApiPost(tyMsg, tyData);
    // ==#####== END ==#####==
    return null;
}




exports.processUploadDeclined = processUploadDeclined;
async function processUploadDeclined(event, data){
    if(log) console.log("PROCESS UPLOAD DECLINED - Data : ", data);
    let message = {
        token: data.b_token,
        channel: event.user.id, 
        text: "Thank you.  The image will not be uploaded to Stkr",
        delete_original: false,
        replace_original: true,
    };
    if(log) console.log("PROCESS UPLOAD DECLINED - Message : ", message);
    let msgData = {
        b_token: data.b_token,
        response_url: event.response_url,
        api_method: "chat.postMessage"
    };
    let declinePostMsg = await slacktools.slackApiPost(message, msgData);
    return null;
}




exports.verifyS3UploadMessage = verifyS3UploadMessage;
async function verifyS3UploadMessage(data){
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
        channel: data.channel, 
        delete_original: false,
        replace_original: true,
        blocks: JSON.stringify(blocks)
    };
    return(message);
}




// ========================================
//             SHARE S3 IMAGE 
// ========================================



exports.noS3ListMessage = noS3ListMessage;
async function noS3ListMessage(event, data){
    if(log) console.log("NO LIST MESSAGE - Event : ", event);
    if(log) console.log("NO LIST MESSAGE - Data : ", data);
    let blocks = [
		{
			"type": "section",
			"block_id": "stkr-share-none",
			"text": {
				"type": "mrkdwn",
				"text": "No images have been uploaded to Stkr to share with your teammates. \n" + 
                    "Drag and drop an image here or in the Stkr App channel to upload and share. \n" + 
                    "There is a limit of " + maxImages + " images that can be uploaded and shared."
			}
		}
    ];
    let message = {
        token: data.b_token,
        replace_original: true,
        channel: event.channel_id, 
        response_type: 'ephemeral' ,
        blocks: blocks,
        b_token: data.b_token ,
        api_method: "chat.postMessage" ,
        response_url: event.response_url
    };
    if(log) console.log("NO LIST MESSAGE - Result : ", message);
    let result = await slacktools.processApiMsg(message);
    return null;
}




exports.shareS3ListMessage = shareS3ListMessage;
async function shareS3ListMessage(event, data, image_list){
    if(log) console.log("SHARE LIST MESSAGE - Images : ", image_list);
    let blocks = [
		{
			"type": "section",
			"block_id": "sharelist_message",
			"text": {
				"type": "mrkdwn",
				"text": "Please select a sticker image to share"
			}
		},
		{
			"type": "actions",
			"elements": [
				{
					"type": "static_select",
					"action_id": "sharelist_select",
					"placeholder": {
						"type": "plain_text",
						"text": "Select an image..."
					},
					"options": image_list
				},
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Cancel"
					},
					"style": "danger",
					"value": "sharelist_cancel",
                    "action_id": "block_cancel"
				}
			]
		}
    ];
    let message = {
        token: data.b_token,
        replace_original: true,
        response_type: 'ephemeral' ,
        channel: event.channel_id, 
        api_method: "chat.postMessage" ,
        response_url: event.response_url ,
        b_token: data.b_token ,
        blocks: blocks,
    };
    if(log) console.log("SHARE LIST MESSAGE - Result : ", message);
    let result = await slacktools.processApiMsg(message);
    return null;
}




// ========================================
//              SHARE S3 IMAGE 
// ========================================





exports.shareS3ImageMessage = shareS3ImageMessage;
async function shareS3ImageMessage(event, data){
    if(log) console.log("SHARE IMAGE MESSAGE - Data : ", data);
    var url = 'https://' + awstools.stkrS3Bucket + '.s3.amazonaws.com/' + data.team_id + "/" + data.filename ;
    if(log) console.log("SHARE IMAGE MESSAGE - Url : ", url);
    var blocks = [
		{
			"type": "section",
		    "block_id": "shareimage_message",
			"text": {
				"type": "plain_text",
				"text": data.username + " shared " + data.filename 
			}
		},
		{
			"type": "image",
		    "block_id": "shareimage_image",
			/* "title": {
				"type": "plain_text",
				"text": data.username + " shared " + data.filename
			}, */
			"image_url": url,
			"alt_text": data.filename
		}
	];
    if(log) console.log("SHARE IMAGE MESSAGE - Blocks : ", blocks);
    let message = {
        token: data.b_token,
        delete_original: true,
        replace_original: true,
        response_type: 'in_channel',
        channel: event.channel_id, 
        api_method: "chat.postMessage" ,
        response_url: event.response_url ,
        b_token: data.b_token ,
        blocks: blocks
    };
    if(log) console.log("SHARE IMAGE MESSAGE - Result : ", message);
    let result = await slacktools.processApiMsg(message);
    return null;
}




// ========================================
//              DELETE S3 IMAGE 
// ========================================



exports.deleteS3Image = deleteS3Image;
async function deleteS3Image(event, data){
    if(log) console.log("DELETE S3 IMAGE - Event : ", event);
    if(log) console.log("DELETE S3 IMAGE - Data : ", data);
    // ==#####== QUERY S3 ==#####==
    var image_list = await awstools.getS3ItemList({ 
        bucket: awstools.stkrS3Bucket,
        team_id : data.team_id 
    });
    if(log) console.log("GET S3 LIST - List Data : ", image_list);
    // ==#####== SEND THE MESSAGE ==#####==
    if(image_list.length < 1) {
        var msg = await noS3ListMessage(event, data);
    } else {
        var msg = await deleteS3ListMessage(event, data, image_list);
    }
    return null;
}


exports.deleteS3ListMessage = deleteS3ListMessage;
async function deleteS3ListMessage(event, data, image_list){
    if(log) console.log("DELETE LIST MESSAGE - Images : ", image_list);
    let blocks = [
		{
			"type": "section",
			"block_id": "deletelist_message",
			"text": {
				"type": "mrkdwn",
				"text": "Please select a sticker image to delete"
			}
		},
		{
			"type": "actions",
			"elements": [
				{
					"type": "static_select",
					"action_id": "deletelist_select",
					"placeholder": {
						"type": "plain_text",
						"text": "Select an image..."
					},
					"options": image_list
				},
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Cancel"
					},
					"style": "danger",
					"value": "deletelist_cancel",
                    "action_id": "block_cancel"
				}
			]
		}
    ];
    let message = {
        token: data.b_token,
        replace_original: true,
        response_type: 'ephemeral' ,
        channel: event.channel_id, 
        api_method: "chat.postMessage" ,
        response_url: event.response_url ,
        b_token: data.b_token ,
        blocks: blocks,
    };
    if(log) console.log("DELETE LIST MESSAGE - Result : ", message);
    let result = await slacktools.processApiMsg(message);
    return null;
}




exports.deleteS3ImageComplete = deleteS3ImageComplete;
async function deleteS3ImageComplete(event, data){
    if(log) console.log("DELETE IMAGE COMPLETE - Event : ", event);
    if(log) console.log("DELETE IMAGE COMPLETE - Data : ", data);
    let blocks = [
		{
			"type": "section",
			"block_id": "deleteimage-complete",
			"text": {
				"type": "mrkdwn",
				"text": "File " + data.filename + " has been deleted from Stkr succesfully."
			}
		}
    ];
    let message = {
        token: data.b_token,
        delete_original: true,
        replace_original: true,
        channel: event.channel_id, 
        response_type: 'in_channel' ,
        blocks: blocks,
        b_token: data.b_token ,
        api_method: "chat.postMessage" ,
        response_url: event.response_url
    };
    if(log) console.log("DELETE IMAGE COMPLETE - Result : ", message);
    let result = await slacktools.processApiMsg(message);
    return null;
}