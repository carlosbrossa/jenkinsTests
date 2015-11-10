
/**
 * Module dependencies.
 */
var express = require('express')
   , load = require('express-load')
   , bodyParser = require('body-parser')
   , methodOverride = require('method-override')
   , routes = require('./routes');

var app = express();

// Configuration
app.use(bodyParser.json());
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";


// Routes
load('models')
.then('controllers')
.then('routes')
.then('services')
.into(app);


app.listen(process.env.PORT || 5600, function(){  
  console.log("Rodando testesJenkins.");
  console.log("Express server listening on port %d in %s mode", app, app.settings.env);
});