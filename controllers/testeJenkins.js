

module.exports = function(app) {

  var http = require('http');

  var options = {
    host: 'pagseguro.jenkins.srv.intranet',
    path: '/job/TestesSeleniumCheckout/api/json'
  };

  var optionsBuild = {
    host: 'pagseguro.jenkins.srv.intranet',
    path: '/job/TestesSeleniumCheckout/{job}/testReport/api/json'
  };

  var buscarBuild = function(options, res){
    http.get(options, function(response) {
      var str = '';

      response.on('data', function (chunk) {
       str += chunk;
      });

      response.on('end', function () {
        var objProduct = new Object();
        str = JSON.parse(str);        
                
      	var length = str.builds.length;
      	var itemId = str.builds[1].number;
        console.log('buscando build', itemId);
        console.log('buscando build', str.builds[length-2].number);
        console.log('buscando build', str.builds[length-3].number);

        buscarDetalheBuild(res, itemId);
      });
    }).end();  
  }; 

  var buscarDetalheBuild = function(res, itemId){
    optionsBuild.path = optionsBuild.path.replace('{job}', itemId);
    http.get(optionsBuild, function(response) {

      var str = '';

      response.on('data', function (chunk) {
       str += chunk;
      });

      response.on('end', function () {                
        str = JSON.parse(str);
        var testsWithError = new Array();
        for (var j = str.suites.length - 1; j >= 0; j--) {              
          for (var i = str.suites[j].cases.length - 1; i >= 0; i--) {
            console.log('status', str.suites[j].cases[i].status);
            if(str.suites[j].cases[i].status == 'FAILED'){
              var jenkinsJob = new Object();
              jenkinsJob.age = str.suites[j].cases[i].age;
              jenkinsJob.className = str.suites[j].cases[i].className;
              jenkinsJob.name = str.suites[j].cases[i].name;
              jenkinsJob.status = str.suites[j].cases[i].status;
              jenkinsJob.assign = 'unassign';
              jenkinsJob.status_local = str.suites[j].cases[i].status;
              jenkinsJob.status_integracao = str.suites[j].cases[i].status;
              testsWithError.push(jenkinsJob);
            } 
          };
        };
        res.send(testsWithError);
      });

    }).end();  
    
  };

  var teste = function(req, res){
    buscarBuild(options, res);
  };

  

  var TesteController = {
    createSheet : function(req, res) {
      teste(req, res);
    }
  }
  return TesteController;

};

