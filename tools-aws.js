console.log('Loading tools-aws');

const AWS = require("aws-sdk");
AWS.config.update({region: 'us-east-2'});
const S3 = new AWS.S3();
const DDB = new AWS.DynamoDB({apiVersion: '2012-08-10'});
const DDBCLIENT = new AWS.DynamoDB.DocumentClient();
const SES = new AWS.SES({region: 'us-east-1'});

const stkrS3Bucket = exports.stkrS3Bucket = "stkr-bucket";
const stkrTokenDB = exports.stkrTokenDB = "stkr-tokens";
const stkrImageDB = exports.stkrImageDB = "stkr-images";
const stkrLogDB = exports.stkrLogDB = "stkr-logs";
const jokesTokenDB = exports.jokesTokenDB = "nerdjokes-tokens";
const jokesDB = exports.jokesDB = "nerdjokes";
const jokesScheduleDB = exports.jokesScheduleDB = "nerdjokes-schedule";
const jokesLogDB = exports.jokesLogDB = "nerdjokes-logs";
const log = true;





// ========================================
//             S3 FUNCTIONS
// ========================================




exports.isS3Object = isS3Object;
async function isS3Object(data){
    if(log) console.log("ISS3OBJECT - Data : ", data);
    try {
        const params = { 
            Bucket: data.bucket, 
            Key: data.team_id + "/" + data.filename 
        };
        const result = await S3.headObject(params).promise();
        return true;
    } catch(error) {
        console.log("IS S3 OBJECT - Error", JSON.stringify(error));
        console.log("IS S3 OBJECT - ERROR Code : ", JSON.stringify(error.code));
        console.log("IS S3 OBJECT - ERROR Message : ", JSON.stringify(error.message));
        console.log("IS S3 OBJECT - ERROR Stack : ", JSON.stringify(error.stack));
         //if (error.code === 'NotFound') {
            return false;
         //}
    }
}





exports.uploadImgToS3 = uploadImgToS3;
async function uploadImgToS3(buffer, data){
    // ==#####== REPLACE SPACES WITH DASHES ==#####==
    var filename = data.filename.replace(/\s+/g, '-');
    const params = {
        Bucket: data.bucket,
        Key: data.team_id + "/" + filename, //data.filename, 
        Body: buffer,
        ContentType: "image",
        ACL: 'public-read-write'
    };
    return new Promise((resolve, reject) => {
        S3.putObject(params, (error) => {
            if (error) {
                console.log("UPLOAD TO S3 - Error", JSON.stringify(error));
                console.log("UPLOAD TO S3 - ERROR Code : ", JSON.stringify(error.code));
                console.log("UPLOAD TO S3 - ERROR Message : ", JSON.stringify(error.message));
                console.log("UPLOAD TO S3 - ERROR Stack : ", JSON.stringify(error.stack));
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
        Bucket: data.bucket,
        Key: data.team_id + "/" + data.filename
    };
    return new Promise((resolve, reject) => {
        S3.deleteObject(params, (error) => {
            if (error) {
                console.log("DELETE FROM S3 - Error", JSON.stringify(error));
                console.log("DELETE FROM S3 - ERROR Code : ", JSON.stringify(error.code));
                console.log("DELETE FROM S3 - ERROR Message : ", JSON.stringify(error.message));
                console.log("DELETE FROM S3 - ERROR Stack : ", JSON.stringify(error.stack));
                reject(error);
            } else {
                if(log) console.log("DELETE FROM S3 - Successful - Deleted - " + data.filename );
                resolve(data.filename);
            }
        });
    });
  
}




exports.emptyS3Directory = emptyS3Directory;
async function emptyS3Directory(data) {
    const listParams = {
        Bucket: data.bucket,
        Prefix: data.team_id + "/"
    };
    const listedObjects = await S3.listObjectsV2(listParams).promise();
    if (listedObjects.Contents.length === 0) return null;
    const deleteParams = {
        Bucket: data.bucket,
        Delete: { Objects: [] }
    };
    listedObjects.Contents.forEach(({ Key }) => {
        deleteParams.Delete.Objects.push({ Key });
    });
    await S3.deleteObjects(deleteParams).promise();
    if (listedObjects.IsTruncated) await emptyS3Directory(data);
}




exports.getS3ItemCount = getS3ItemCount;
async function getS3ItemCount(data){
    if(log) console.log("GET S3 ITEM COUNT - Event : ", data);
    var params = { 
        Bucket: data.bucket, 
        Prefix: data.team_id + "/" 
    };
    let retdata;
    let items = 0;
    retdata = await S3.listObjectsV2(params).promise();
    items = retdata.Contents.length ;
    if(log) console.log("GET S3 ITEM COUNT - Image Count : ", items);
    return(items);
}





exports.getS3ItemList = getS3ItemList;
async function getS3ItemList(data){
    if(log) console.log("GET S3 ITEM LIST - Event : ", data);
    var params = { 
        Bucket: data.bucket, 
        Prefix: data.team_id + "/" 
    };
    let retdata;
    let images = [];
    return new Promise((resolve, reject) => {
        S3.listObjectsV2(params, (error, retdata) => {
            if (error) {
                console.log("GET S3 ITEM LIST - Error", JSON.stringify(error));
                console.log("GET S3 ITEM LIST - ERROR Code : ", JSON.stringify(error.code));
                console.log("GET S3 ITEM LIST - ERROR Message : ", JSON.stringify(error.message));
                console.log("GET S3 ITEM LIST - ERROR Stack : ", JSON.stringify(error.stack));
                reject(error);
            } else {
                if(log) console.log("GET S3 ITEM LIST - Success");
                for (let index = 0; index < retdata.Contents.length; index++) {
                    var key = retdata.Contents[index].Key;
                    var item =  { "text": { "type": "plain_text", "text": key.replace(params.Prefix, "") } , value: key.replace(params.Prefix, "") } ;
                    images.push(item);
                }
                if(log) console.log("GET S3 ITEM LIST - Data : ", JSON.stringify(images));
                resolve(images);
            }
        });
    });
}





// ========================================
//          DYNAMODB FUNCTIONS
// ========================================




exports.readFromDynamo = readFromDynamo;
async function readFromDynamo(data){
    if(log) console.log("READ FROM DYNAMO - Data : ", data);
    var params = { TableName: data.tablename };
    if(data.key) params.Key = data.key;
    if(data.indexname) params.IndexName = data.indexname ;
    if(data.key_cond_expr) params.KeyConditionExpression = data.key_cond_expr ;
    if(data.cond_expr) params.ConditionExpression = data.cond_expr ;
    if(data.filter_expr) params.FilterExpression = data.filter_expr ;
    if(data.attrib_vals) params.ExpressionAttributeValues = data.attrib_vals ;
    if(data.proj_expr) params.ProjectionExpression = data.proj_expr ;
    if(data.select) params.Select = data.select ;
    if(data.limit) params.Limit = data.limit ;
    if(log) console.log("READ FROM DYNAMO - Params : ", params);
    return new Promise((resolve, reject) => {
        DDBCLIENT.query(params, (error, itemData) => {
            if (error) {
                console.log("READ FROM DYNAMO - Error", JSON.stringify(error));
                console.log("READ FROM DYNAMO - ERROR Code : ", JSON.stringify(error.code));
                console.log("READ FROM DYNAMO - ERROR Message : ", JSON.stringify(error.message));
                console.log("READ FROM DYNAMO - ERROR Stack : ", JSON.stringify(error.stack));
                reject(error);
            } else {
                if(log) console.log("READ FROM DYNAMO - Success");
                resolve(itemData);
            }
        });
    });
}





exports.writeToDynamo = writeToDynamo;
async function writeToDynamo(data){
    if(log) console.log("WRITE TO DYNAMO - Data", data);
    var params = {
        TableName: data.tablename,
        Item: data.item
    };
    if(log) console.log("WRITE TO DYNAMO - Params", params);
    return new Promise((resolve, reject) => {
        DDBCLIENT.put(params, (error) => {
            if (error) {
                console.log("WRITE TO DYNAMO - Error", JSON.stringify(error));
                console.log("WRITE TO DYNAMO - ERROR Code : ", JSON.stringify(error.code));
                console.log("WRITE TO DYNAMO - ERROR Message : ", JSON.stringify(error.message));
                console.log("WRITE TO DYNAMO - ERROR Stack : ", JSON.stringify(error.stack));
                reject(error);
            } else {
                if(log) console.log("WRITE TO DYNAMO - Success");
                resolve("Data written to dynamo succesfully.");
            }
        });
    });
}




exports.createDynamoSet = createDynamoSet;
async function createDynamoSet(data){
    if(log) console.log("CREATE DYNAMO SET");
    if(log) console.log("CREATE DYNAMO SET - Data", data);
    return DDBCLIENT.createSet(data) ;
}





exports.updateToDynamo = updateToDynamo;
async function updateToDynamo(data){
    if(log) console.log("UPDATE TO DYNAMO - Data", data);
    var params = { TableName: data.tablename };
    if(data.key) params.Key = data.key;
    if(data.update_expr) params.UpdateExpression = data.update_expr ;
    if(data.attrib_vals) params.ExpressionAttributeValues = data.attrib_vals ;
    if(data.return_vals) params.ReturnValues = data.return_vals ;
    if(log) console.log("UPDATE TO DYNAMO - Params", params);
    return new Promise((resolve, reject) => {
        DDBCLIENT.update(params, (error) => {
            if (error) {
                console.log("UPDATE TO DYNAMO - Error", JSON.stringify(error));
                console.log("UPDATE TO DYNAMO - ERROR Code : ", JSON.stringify(error.code));
                console.log("UPDATE TO DYNAMO - ERROR Message : ", JSON.stringify(error.message));
                console.log("UPDATE TO DYNAMO - ERROR Stack : ", JSON.stringify(error.stack));
                reject(error);
            } else {
                if(log) console.log("UPDATE TO DYNAMO - Success");
                resolve("Data updated to dynamo succesfully.");
            }
        });
    });
}






exports.deleteFromDynamo = deleteFromDynamo;
async function deleteFromDynamo(data){
    if(log) console.log("DELETE FROM DYNAMO - Data : ", data);
    var params = { TableName: data.tablename };
    if(data.key) params.Key = data.key;
    if(data.indexname) params.IndexName = data.indexname ;
    if(data.key_cond_expr) params.KeyConditionExpression = data.key_cond_expr ;
    if(data.cond_expr) params.ConditionExpression = data.cond_expr ;
    if(data.filter_expr) params.FilterExpression = data.filter_expr ;
    if(data.attrib_vals) params.ExpressionAttributeValues = data.attrib_vals ;
    if(data.proj_expr) params.ProjectionExpression = data.proj_expr ;
    if(log) console.log("DELETE FROM DYNAMO - Params : ", params);
    return new Promise((resolve, reject) => {
        DDBCLIENT.delete(params, (error, itemData) => {
            if (error) {
                console.log("DELETE FROM DYNAMO - Error", JSON.stringify(error));
                console.log("DELETE FROM DYNAMO - ERROR Code : ", JSON.stringify(error.code));
                console.log("DELETE FROM DYNAMO - ERROR Message : ", JSON.stringify(error.message));
                console.log("DELETE FROM DYNAMO - ERROR Stack : ", JSON.stringify(error.stack));
                reject(error);
            } else {
                if(log) console.log("DELETE FROM DYNAMO - Success");
                if(log) console.log("DELETE FROM DYNAMO - Delete Data", itemData);
                resolve(itemData);
            }
        });
    });
}





exports.batchDeleteFromDynamo = batchDeleteFromDynamo;
async function batchDeleteFromDynamo(data){
    if(log) console.log("BATCH DELETE FROM DYNAMO - Data : ", JSON.stringify(data));
    var params = data.params ;
    if(log) console.log("BATCH DELETE FROM DYNAMO - Params : ", JSON.stringify(params));
    return new Promise((resolve, reject) => {
        DDBCLIENT.batchWrite(params, (error, itemData) => {
            if (error) {
                console.log("BATCH DELETE FROM DYNAMO - Error", JSON.stringify(error));
                console.log("BATCH DELETE FROM DYNAMO - ERROR Code : ", JSON.stringify(error.code));
                console.log("BATCH DELETE FROM DYNAMO - ERROR Message : ", JSON.stringify(error.message));
                console.log("BATCH DELETE FROM DYNAMO - ERROR Stack : ", JSON.stringify(error.stack));
                reject(error);
            } else {
                if(log) console.log("BATCH DELETE FROM DYNAMO - Success");
                if(log) console.log("BATCH DELETE FROM DYNAMO - Delete Data", itemData);
                resolve(itemData);
            }
        });
    });
}





// ========================================
//             SES FUNCTIONS
// ========================================




exports.sendEmail = sendEmail;
async function sendEmail(data){
    var params = {
        Destination: {
            ToAddresses: [ data.to ]
        },
        Message: {
            Body: { Text: { Data: data.subject } },
            Subject: { Data: data.subject }
        },
        Source: data.from
    };
    return new Promise((resolve, reject) => {
        SES.sendEmail(params, function (error, emaildata) {
            if (error) {
                console.log("SEND EMAIL - ERROR", JSON.stringify(error));
                console.log("SEND EMAIL - ERROR Code : ", JSON.stringify(error.code));
                console.log("SEND EMAIL - ERROR Message : ", JSON.stringify(error.message));
                console.log("SEND EMAIL - ERROR Stack : ", JSON.stringify(error.stack));
                reject(error);
            } else {
                if(log) console.log("SEND EMAIL - Success");
                if(log) console.log("SEND EMAIL - Success Data", emaildata);
                resolve(emaildata);
            }
        });
    });
}