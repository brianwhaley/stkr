console.log('Loading function');
var AWS = require("aws-sdk");
const s3 = new AWS.S3();


exports.handler = async function(event, context) {
    console.log('Received event:', JSON.stringify(event, null, 2));
    console.log('Received context:', JSON.stringify(context, null, 2));
    let result;
    if(event.team_domain == undefined) event.team_domain = 'pixelated-tech'; 
    if(event.text.startsWith("#")){
        if(event.text.includes("list")){
            // ===== LIST =====
            result = getList(event);
        } else {
            // ===== ERROR =====
            result = {
                response_type: 'ephemeral',
                text: 'Stkr: Unknown Command - ' + event.text 
            };
        }
    } else {
        // ===== IMAGE =====
        result = getImageURL(event);
    }
    return(result);
};


async function getList(event){
    var params = { Bucket: "stkr-bucket", Prefix: event.team_domain + "/" };
    let data;
    let images = '';
    let result;
    try {
        data = await s3.listObjectsV2(params).promise();
        for (let index = 1; index < data.Contents.length; index++) {
            var key = data.Contents[index].Key;
            images += key.replace(params.Prefix, '') + " \n";        
        }
        result = {
            response_type: 'ephemeral',
            text: images
        };
    } catch(err) {
        console.log(err);
        result = {
            response_type: 'ephemeral',
            text: err
        };
    }
    return(result);
}


async function getImageURL(event){
    var params = { Bucket: "stkr-bucket", Key: event.text };
    if(await isS3Object(event)===true){
        var url = 'https://' + params.Bucket + '.s3.amazonaws.com/' + event.team_domain + "/" + params.Key ;
        /* s3.getSignedUrl('putObject', params, function (err, url) {
            console.log('The URL is', url);
        }); */
        var result = {
            //delete_original: true,
            //replace_original: true,
            response_type: 'in_channel',
            text: '',
            attachments: [{
                text: event.text,
                image_url: url
            }],
        };
    } else {
        result = {
            response_type: 'ephemeral',
            text: "Stkr: Unknown Image - " + event.text
        };
    }
    return(result);
}


async function isS3Object(event){
    try {
        const params = { Bucket: "stkr-bucket", Key: event.team_domain + "/" + event.text };
        const result = await s3.headObject(params).promise();
        return true;
    } catch(err) {
         //if (err.code === 'NotFound') {
            return false;
         //}
    }
}


function getImageStream(){
    /* try {
        const params = { Bucket: "stkr-bucket", Key: event.text };
        result = await s3.getObject(params).promise();
        result = result.Body.toString('utf-8');
        console.log(result);
        return {
            statusCode: 200,
            body: result,
            isBase64Encoded: true,
        }
    } catch(err) {
        console.log(err, err.stack);
        return(err);
    } */
}