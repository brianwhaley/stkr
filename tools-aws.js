console.log('Loading tools-aws');
const AWS = require("aws-sdk");
AWS.config.update({region: 'us-east-2'});
const S3 = new AWS.S3();
const DDB = new AWS.DynamoDB({apiVersion: '2012-08-10'});
const DDBCLIENT = new AWS.DynamoDB.DocumentClient();
const stkrBucket = "stkr-bucket";
const stkrDB = "stkr-tokens";
const log = true;





exports.isS3Object = isS3Object;
async function isS3Object(data){
    if(log) console.log("ISS3OBJECT - Data : ", data);
    try {
        const params = { Bucket: stkrBucket, Key: data.team_id + "/" + data.filename };
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
    // ==#####== REPLACE SPACES WITH DASHES ==#####==
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





exports.emptyS3Directory = emptyS3Directory;
async function emptyS3Directory(data) {
    const listParams = {
        Bucket: stkrBucket,
        Prefix: data.team_id + "/"
    };
    const listedObjects = await S3.listObjectsV2(listParams).promise();
    if (listedObjects.Contents.length === 0) return null;
    const deleteParams = {
        Bucket: stkrBucket,
        Delete: { Objects: [] }
    };
    listedObjects.Contents.forEach(({ Key }) => {
        deleteParams.Delete.Objects.push({ Key });
    });
    await S3.deleteObjects(deleteParams).promise();
    if (listedObjects.IsTruncated) await emptyS3Directory(data);
}




exports.getCount = getCount;
async function getCount(data){
    if(log) console.log("GETCOUNT - Event : ", data);
    var params = { Bucket: stkrBucket, Prefix: data.team_id + "/" };
    let retdata;
    let images = 0;
    retdata = await S3.listObjectsV2(params).promise();
    images = retdata.Contents.length ;
    if(log) console.log("GETCOUNT - Image Count : ", images);
    return(images);
}





exports.getList = getList;
async function getList(data){
    if(log) console.log("GETLIST - Event : ", data);
    var params = { Bucket: stkrBucket, Prefix: data.team_id + "/" };
    let retdata;
    let images = [];
    retdata = await S3.listObjectsV2(params).promise();
    for (let index = 0; index < retdata.Contents.length; index++) {
        var key = retdata.Contents[index].Key;
        // images += key.replace(params.Prefix, '') + " \n"; 
        var image = { text: key.replace(params.Prefix, "") , value: key.replace(params.Prefix, "") };
        images.push(image);
    }
    if(log) console.log("GETLIST - Data : ", JSON.stringify(images));
    return(images);
}




exports.writeToDynamo = writeToDynamo;
async function writeToDynamo(data){
    if(log) console.log("WRITETODYNAMO - Data", data);
    var params = {
        TableName: stkrDB,
        Item: {
            team_id : {S: data.team_id},
            access_token : {S: data.access_token},
            response : {S: JSON.stringify(data.response)}
        }
    };
    return new Promise((resolve, reject) => {
        DDB.putItem(params, (error) => {
            if (error) {
                if(log) console.log("WRITETODYNAMO - Error", error);
                reject(error);
            } else {
                if(log) console.log("WRITETODYNAMO - Success");
                resolve("Data written to dynamo succesfully.");
            }
        });
    });
}







exports.readFromDynamo = readFromDynamo;
async function readFromDynamo(data){
    if(log) console.log("READFROMDYNAMO - Data", data);
    try {
        var params = {
            TableName: stkrDB ,
            Key: { "team_id" : {S: data.team_id } } 
        };
        var result = await DDB.getItem(params).promise();
        if(log) console.log("READFROMDYNAMO - Success");
        console.log(result);
        return result;
    } catch (error) {
        if(log) console.log("READFROMDYNAMO - Error", error);
    }
}





exports.deleteFromDynamo = deleteFromDynamo;
async function deleteFromDynamo(data){
    if(log) console.log("DELETEFROMDYNAMO - Data", data);
    var params = {
        TableName: stkrDB,
        Key: { "team_id" : {S: data.team_id } } 
    };
    return new Promise((resolve, reject) => {
        DDB.deleteItem(params, (error, deldata) => {
            if (error) {
                if(log) console.log("DELETEFROMDYNAMO - Error", error);
                reject(error);
            } else {
                if(log) console.log("DELETEFROMDYNAMO - Success");
                if(log) console.log("DELETEFROMDYNAMO - Delete Data", deldata)
                resolve(deldata);
            }
        });
    });
}
