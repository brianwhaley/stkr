console.log('Loading tools-aws');
var AWS = require("aws-sdk");
const S3 = new AWS.S3();
const stkrBucket = "stkr-bucket";
const log = true;





exports.isS3Object = isS3Object;
async function isS3Object(data){
    if(log) console.log("ISS3OBJECT - Data : ", data);
    try {
        const params = { Bucket: "stkr-bucket", Key: data.team_id + "/" + data.filename };
        const result = await S3.headObject(params).promise();
        return true;
    } catch(err) {
         //if (err.code === 'NotFound') {
            return false;
         //}
    }
}





exports.uploadImgToS3 = uploadImgToS3;
async function uploadImgToS3(buffer, data){
    // ===== REPLACE SPACES WITH DASHES =====
    var filename = data.filename.replace(/\s+/g, '-');
    const params = {
        Bucket: stkrBucket,
        Key: data.team_id + "/" + filename, //data.filename, 
        Body: buffer,
        ContentType: "image",
        ACL: 'public-read-write'
    };
    return new Promise((resolve, reject) => {
        S3.putObject(params, (error) => {
            if (error) {
                reject(error);
            } else {
                if(log) console.log("UPLOADIMGTOS3 - " + filename + " uploaded to " + params.Bucket + " succesfully.");
                resolve(filename);
            }
        });
    });
  
}






exports.deleteImgFromS3 = deleteImgFromS3;
async function deleteImgFromS3(data){
    const params = {
        Bucket: stkrBucket,
        Key: data.team_id + "/" + data.filename
    };
    return new Promise((resolve, reject) => {
        S3.deleteObject(params, (error) => {
            if (error) {
                reject(error);
            } else {
                if(log) console.log("DELETEIMGFROMS3 - " + data.filename + " deleted ");
                resolve("File " + data.filename + " has been deleted from Stkr succesfully.");
            }
        });
    });
  
}



exports.getCount = getCount;
async function getCount(event){
    if(log) console.log("GETCOUNT - Event : ", event);
    var params = { Bucket: "stkr-bucket", Prefix: event.team_id + "/" };
    let data;
    let images = 0;
    data = await S3.listObjectsV2(params).promise();
    images = data.Contents.length ;
    if(log) console.log("GETCOUNT - Image Count : ", images);
    return(images);
}





exports.getList = getList;
async function getList(event){
    if(log) console.log("GETLIST - Event : ", event);
    var params = { Bucket: "stkr-bucket", Prefix: event.team_id + "/" };
    let data;
    let images = [];
    data = await S3.listObjectsV2(params).promise();
    for (let index = 0; index < data.Contents.length; index++) {
        var key = data.Contents[index].Key;
        // images += key.replace(params.Prefix, '') + " \n"; 
        var image = { text: key.replace(params.Prefix, "") , value: key.replace(params.Prefix, "") };
        images.push(image);
    }
    if(log) console.log("GETLIST - Data : ", JSON.stringify(images));
    return(images);
}