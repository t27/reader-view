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

// http://expressjs.com/en/starter/basic-routing.html
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

var proxifyImages = function(articleHtml) {
  let $ = cheerio.load(articleHtml);
  var img_elems = $('img');
  

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
        var elementArr = srcsetArr[j].split(' ');
        var url = elementArr[0];
        var width = elementArr[1];
        var newUrl = getProxyImageUrl(url);
        srcsetArr[j] = newUrl + " " + width;
      }
      cheerioedElem.attr('srcset',srcsetArr.join(', '));
    }
  }
  console.log("Images===", img_elems.length);
  console.log("srcset1=",$(img_elems[0]).attr('srcset'));
  return $.html();
}

var getProxyImageUrl = function(imageUrl) {
  return '/im/?url=' + encodeURIComponent(imageUrl.trim());
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
          var magigNumberInBody = body.toString('hex',0,4);
          if (magigNumberInBody == magic.jpg || 
              magigNumberInBody == magic.png ||
              magigNumberInBody == magic.gif) {
  
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