// server.js
// where your node app starts

// init project
var express = require('express');
var request = require('request');
var app = express();
var read = require('node-readability');
var dot = require('dot');
var fs = require('fs');
var cheerio = require('cheerio');

var readTemplate =  dot.template(fs.readFileSync(__dirname + '/views/page.html',"utf-8"));

app.use(express.static('public'));

app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

app.get("/read", function(req, res) {
  var url = req.query.url;
  console.log(url);
  read(url, function(err, article, meta) {
    // callback(article);
    if (err) {
      console.log("Error:-",err);
    }
    var ret = {};
    // Main Article
    ret.content = proxifyImages(article.content);

    // Title
    ret.title = (article.title);
    
    var output = readTemplate(ret);
    res.send(output);

    // Close article to clean up jsdom and prevent leaks
    article.close();
  });
});

app.get("/length", function(req, res) {
  var url = req.query.url;
  var wpm = req.query.wpm || 250;
  console.log(url);
  read(url, function(err, article, meta) {
    // callback(article);
    if (err) {
      console.log("Error:-",err);
    }
    var ret = {};

    let $ = cheerio.load(article.content);
    let text = $.text();
    let wordcount = text.trim().split(/\s+/).length;
    let mins = wordcount/wpm;
    ret.mins = mins;
    res.json(ret);

    // Close article to clean up jsdom and prevent leaks
    article.close();
  });
});

// Browsers wont load external images from non-https pages, 
// so convert image links to point to a local route (/im/) which acts as a image proxy
var proxifyImages = function(articleHtml) {
  let $ = cheerio.load(articleHtml);
  var img_elems = $('img');
  
  var cheerioedElem;
  for(var i=0; i < img_elems.length;i++){
    cheerioedElem = $(img_elems[i]);
    // proxify src
    var orig_url = cheerioedElem.attr('src');
    cheerioedElem.attr('src',getProxyImageUrl(orig_url));
    
    //proxify srcset
    var srcset = cheerioedElem.attr('srcset');
    if(srcset) {
      var srcsetArr = srcset.split(',');
      for(var j=0;j<srcsetArr.length;j++) {
        var elementArr = (srcsetArr[j].trim()).split(' ');
        var url = elementArr[0].trim();
        var width = elementArr[1].trim();
        var newUrl = getProxyImageUrl(url);
        srcsetArr[j] = newUrl + " " + width;
      }
      cheerioedElem.attr('srcset',srcsetArr.join(', '));
    }
  }
  return $.html();
}

var getProxyImageUrl = function(imageUrl) {
  return '/im/?url=' + (encodeURIComponent(imageUrl.trim())).trim();
}


var imageProxy = function(req,res) {
  var url = req.query.url;
  var magic = {
      jpg: 'ffd8ffe0',
      png: '89504e47',
      gif: '47494638'
  };
  var options = {
      method: 'GET',
      url: url,
      encoding: null // keeps the body as buffer
  };
  
  request(options, function (err, response, body) {
      if(!err && response.statusCode == 200){
          var magicNumberInBody = body.toString('hex',0,4);
          if (magicNumberInBody == magic.jpg || 
              magicNumberInBody == magic.png ||
              magicNumberInBody == magic.gif) {
              // Ensures this proxy is only used for jpg, png and gifs
              res.send(body);
  
          }
      }
  });
}

app.get("/im", imageProxy);

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});