var Client = require('node-rest-client').Client;
var bytes = require('bytes');
var mkdirp = require('mkdirp');
var fs = require('fs');
var getDirName = require('path').dirname;

var client = new Client();

var asus_api_endpoint_products = "https://www.asus.com/support/api/product.asmx/GetPDLevel?website=global&type=2&typeid=1156,0&productflag=1"
var asus_api_endpoint_mainboards = "https://www.asus.com/support/api/product.asmx/GetPDBIOS?website=global&pdhashedid="
 
var download_folder = "download";

var downloadSize = 0;
var download_file = "download_list.sh";

function main(){
    fs.writeFileSync(download_file,"#!/bin/bash\n");
    requestJSON(asus_api_endpoint_products, parseAllProducts);
}

var requestJSON = function(endpoint, cb){
    client.get(endpoint,
    function (data, response) {
        cb(data.toString(), response);
    });
 
}

function writeFile(path, contents, cb) {
    mkdirp(getDirName(path), function (err) {
      if (err) return cb(err);
  
      fs.writeFile(path, contents, cb);
    });
}
  
var parseAllProducts = function(data, err){
    var json = JSON.parse(data);
    if(json.Result.Product !== null){
        console.log("{products_known: "+json.Result.Product.length+"}");
        to_process = json.Result.Product.length;
        json.Result.Product.forEach(element => {
            requestMainboardJSON(element.PDId, element.PDHashedId, element.PDName);
        });
    } else {
        console.log("could not fetch Product list");
        console.log(err);
    }
}      

var requestMainboardJSON = function(id, hash, name){
    var mainboard_folder = download_folder+"/"+name.replace(/\//g, "-").replace(/ /g, "_");

    var downloadMainboard = function(data){
        var json = JSON.parse(data);
        if(json.Status === 'SUCCESS'){

            json.Result.Obj.forEach(element => {
                //console.log(element.Name); E: {BIOS, FIRMWARE}
                element.Files.forEach(file => {
                    //console.log(file); //E: Metadata
                    var fileFolder = mainboard_folder + "/"+element.Name+"/"+file.Title.replace(/\//g, "-").replace(/ /g, "_").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
                    var filePath = fileFolder+"/description.json";
                    console.log("writing "+filePath);
                    writeFile(filePath, JSON.stringify(file));
        
                    downloadSize += bytes(file.FileSize.replace("Bytes","B"));
                    //TODO test if 'China' has different binaries than 'Global'?

                    console.log("Queing "+file.DownloadUrl.Global+" for download");
                    var download = {
                        remote: file.DownloadUrl.Global,
                        local: fileFolder+"/"+file.Id.replace(/\//g, "-").replace(/ /g, "_").replace(/\(/g, "\(").replace(/\)/g, "\)")
                    }
                    var curl_command = "wget -c --verbose \""+download.remote+"\" -O \""+download.local+"\"";
                    fs.appendFile(download_file,curl_command+"\n", function (err) {
                        if (err) throw err;
                    });
                });
            });
           console.log("Queued "+bytes(downloadSize, {unitSeparator: ' '})+ " of firmware so far");
        } else {
            console.log("could not fetch download list. Maybe no downloads exists");
        }
    }

    //console.log("Found product: {id: "+id+", hash: "+hash+", name: "+name+"}" );
    requestJSON(asus_api_endpoint_mainboards+hash, downloadMainboard);
}

main();