module.exports = function(app) {

  var http = require('http');
  var events = require('events');
  var eventEmitter = new events.EventEmitter();

  var host = 'pagseguro.jenkins.srv.intranet';
  var optionsLastBuild = {    
    path: '/job/{teste}/api/json'
  };

  eventEmitter.on('findLastBuild', function(res, testesIntegracao){     
     findLastBuild(res, testesIntegracao);
  });


  var findLastBuild = function(res, testesIntegracao){
    var lastBuilds = new Array();
    for(var i = 0; i < testesIntegracao.length; i++){
      var optionsLastBuildN = new Object();
      optionsLastBuildN.host = host;
      optionsLastBuildN.path = optionsLastBuild.path.replace('{teste}', testesIntegracao[i]);      

      http.get(optionsLastBuildN, function(response) {
        var str = '';

        response.on('data', function (chunk) {
         str += chunk;
        });

        response.on('end', function () {                  
          str = JSON.parse(str);                              
          var itemId = str.builds[0].number;
          var testeBuild = new Object();
          testeBuild.itemId=itemId;
          testeBuild.displayName=str.displayName;
          lastBuilds.push(testeBuild);        
          eventEmitter.emit('findLastBuildEvents', res, lastBuilds, testesIntegracao);          
        });
      }).end();  
    }    
  }; 

}
