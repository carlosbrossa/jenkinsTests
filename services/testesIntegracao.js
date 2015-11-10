module.exports = function(app) {

  var http = require('http');
  var events = require('events');
  var eventEmitter = new events.EventEmitter();

  var host = 'pagseguro.jenkins.srv.intranet';

  var optionsTestesIntegracao = {
    host: host,
    path: '/view/Testes%20de%20Integra%C3%A7%C3%A3o/api/json'
  };

  eventEmitter.on('buscarTestesIntegracao', function(res){     
     buscarTestesIntegracao(res);
  });

  var buscarTestesIntegracao = function(res){
      http.get(optionsTestesIntegracao, function(response){
        var str = '';
          response.on('data', function (chunk) {
           str += chunk;
          });  
          response.on('end', function () {
            str = JSON.parse(str);
            var testesIntegracao = new Array();
            var testes = str.jobs;
            for(var i=0; i < testes.length; i++){
              testesIntegracao.push(testes[i].name);    
            }              
            //findLastBuild(testesIntegracao, res);
            eventEmitter.emit('findLastBuild', res, testesIntegracao);          
          });


      }).end();
  };



};