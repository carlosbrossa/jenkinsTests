module.exports = function(app) {

  var http = require('http');
  var events = require('events');
  var eventEmitter = new events.EventEmitter();  

  //jira
  var usernameJira = "peo_cbrossa";
  var passwordJira = "xxx";
  var auth = "Basic " + new Buffer(usernameJira + ":" + passwordJira).toString("base64");
  var https = require('https');
  var optionsJiraDefault = {
    hostname: 'jira.intranet.uol.com.br',
    port: 443,
    path: '/jira/rest/api/2/issue/HANOI-267',    
    headers: {
      'Authorization': 'Basic ' + new Buffer(usernameJira + ':' + passwordJira).toString('base64')
    } 
  };
  //fim jira

  //jenkins
  var host = 'pagseguro.jenkins.srv.intranet';

  var optionsTestesIntegracao = {
    host: host,
    path: '/view/Testes%20de%20Integra%C3%A7%C3%A3o/api/json'
  };
  var optionsLastBuild = {    
    path: '/job/{teste}/api/json'
  };

  var optionsBuild = {    
    path: '/job/{teste}/{job}/testReport/api/json'
  };  

  //event listener para prosseguir com a busca de detalhes de todos testes que estao quebrados
  eventEmitter.on('findLastBuildEvents', function(res, lastBuilds, testesIntegracao){    
     if(lastBuilds.length == testesIntegracao.length){        
        buscarDetalheBuild(res, lastBuilds);
     }
  });

  //event listener para prosseguir com as buscas no jira e criacao
  eventEmitter.on('buscarDetalheBuild', function(res, errosBuilds, lastBuilds, buildsWithError){                   
     if(lastBuilds.length == errosBuilds.length){                
        var jsondata = JSON.stringify(errosBuilds);          
        prepareJiras(res, errosBuilds, lastBuilds, buildsWithError);
     }
  });
  
  //busca todos os testes de integracao existentes no jenkins  
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
            findLastBuild(testesIntegracao, res);
          });


      }).end();
  };

  //procura ultimo build que foi executado de cada teste
  var findLastBuild = function(testesIntegracao, res){
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

  var headers = {
    "accept-charset" : "ISO-8859-1,utf-8;q=0.7,*;q=0.3",    
    "accept" : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
  };

  //prepara para busca no jenkins todos os testes quebrados de cada teste
  var buscarDetalheBuild = function(res, lastBuilds){
    var errosBuilds = new Array();
    //console.log(lastBuilds);
    var buildsWithError = new Array();  
    for (var k = 0; k < lastBuilds.length; k++) {        
        var optionsBuildCurrent = new Object();
        optionsBuildCurrent.host = host;
        optionsBuildCurrent.headers = headers;
        optionsBuildCurrent.path = optionsBuild.path.replace('{job}', lastBuilds[k].itemId).replace('{teste}', lastBuilds[k].displayName);                
        //console.log(optionsBuildCurrent.path);
        detailbuild(res, optionsBuildCurrent, lastBuilds, errosBuilds, k, buildsWithError);
    }
  };

  //busca no jenkins todos os testes quebrados de cada teste
  var detailbuild = function(res, optionsBuildCurrent, lastBuilds, errosBuilds, k, buildsWithError){    
    http.get(optionsBuildCurrent, function(response) {          
          var str = '';

          response.on('data', function (chunk) {
           str += chunk;
          });

          response.on('end', function () {   
            try{              
              str = JSON.parse(str);              
              var testsWithError = new Array();
              for (var j = str.suites.length - 1; j >= 0; j--) {              
                for (var i = str.suites[j].cases.length - 1; i >= 0; i--) {                  
                  if(str.suites[j].cases[i].status == 'FAILED'){
                    var jenkinsJob = new Object();
                    jenkinsJob.age = str.suites[j].cases[i].age;
                    jenkinsJob.className = str.suites[j].cases[i].className;
                    jenkinsJob.name = str.suites[j].cases[i].name;
                    jenkinsJob.status = str.suites[j].cases[i].status;
                    jenkinsJob.assign = 'unassign';
                    jenkinsJob.status_local = str.suites[j].cases[i].status;
                    jenkinsJob.status_integracao = str.suites[j].cases[i].status;
                    jenkinsJob.errorDetails = str.suites[j].cases[i].errorDetails;
                    testsWithError.push(jenkinsJob);
                  } 
                };
              };
            }catch(error){
              buildsWithError.push(lastBuilds[k].displayName);
              console.log("Erro ao obter testes do job. Provalvelmente o job foi interrompido. nameJob=" + lastBuilds[k].displayName)
            }
            var errBuild = new Object();
            errBuild.displayName = lastBuilds[k].displayName;
            errBuild.testes = testsWithError;
            errosBuilds.push(errBuild);  
            //console.log('errosBuilds length - ' + errosBuilds.length);
            //console.log('k length - ' + k);
            eventEmitter.emit('buscarDetalheBuild', res, errosBuilds, lastBuilds, buildsWithError);                          
          });

        }).end();  

  }
  //fim jenkins



  //separando testes quebrados do jenkins por classe para poder criar no jira como subtasks
  var prepareJiras = function(res, errosBuilds, lastBuilds, buildsWithError){    
    var classList = new Object();
    var listNameClass = new Array();
    //console.log("errosBuilds", errosBuilds);
    for(var i = 0; i < errosBuilds.length; i++){
      if(errosBuilds[i].testes){
        for(var b = 0; b < errosBuilds[i].testes.length; b++){        
          var testeAtual = errosBuilds[i].testes[b];                  
          if(testeAtual != undefined){      

            var nameClass = testeAtual.className;
            if(!classList[nameClass]) classList[nameClass] = new Array();   

            var method = testeAtual.name;
            var jiraName = nameClass + "." + method;          
            var jiraQuery = new jiraJql(jiraName);
            var searchParams = new jiraSearchParams(jiraQuery.jql);
            var jsondata = JSON.stringify(searchParams);
            var jiraClass = new jiraClassObj(method, nameClass, jiraName, jsondata);

            classList[nameClass].push(jiraClass);
            if(listNameClass.indexOf(nameClass) == -1) listNameClass.push(nameClass);
          }          
        }
      }    
    }    
    searchJiras(res, classList, listNameClass, errosBuilds, buildsWithError);
  };

  
  var searchJiras = function(response, classList, listNameClass, errosBuilds, buildsWithError){
    
    var totalTestesComErro = 0;
    for(var i = 0; i < listNameClass.length; i++){
      var nameCurrentClass = listNameClass[i];
      var metodos = classList[nameCurrentClass];
      if(metodos){
        totalTestesComErro = totalTestesComErro + metodos.length;
        searchJiraCallParent(metodos); 
        /*for(var x = 0; x < metodos.length; x++){         
          if(metodos[x] != null){
            totalTestesComErro++;       
            //console.log('busca esse: ' + metodos[x].nameClass +'.'+metodos[x].method);     
            searchJiraCall(metodos[x], metodos); 
          }   
        }*/  
      }  
      //classList[i] = metodos;
    }

    var objResponse = new Object();
    objResponse.totalErros = totalTestesComErro;
    objResponse.buildsWithError = buildsWithError;
    response.send(objResponse);
  }
  
  function searchJiraCallParent(metodos){
    var metodo = metodos[0];
    function searchCallBack(res) {
      //console.log("search statusCode: ", res.statusCode);
      //console.log("headers: ", res);      

      res.on('data', function(chunk) {
        process.stdout.write(chunk);
        //console.log('BODY: ' + chunk);
        var result = JSON.parse(chunk);
        //console.log("find result", result);
        if(result.total > 1){
          console.log('Foi encontrado mais de um result, nao foi possivel criar ou fazer update '  + metodo.jiraName);
          //classList[i].jiraQueryJson[x] = undefined;
          //metodos = metodos.splice(x, 1);                
        }else if(result.total == 1 && result.issues[0].fields.status.id != 6){            
          console.log("Update Jira is not implemented." + metodo.jiraName);
          verificaFilhos(metodos, result.issues[0].id);
          //classList[i].jiraQueryJson[x] = undefined;
          //metodos = metodos.splice(x, 1);                
        }else{
          console.log('jira sera criado : '+ metodo.jiraName);
          criaJira(metodos);
        }
      });
    }

    var searchOptions = new optionsJiraSearchIssue(metodo.jiraQueryJson);            

    var req = https.request(searchOptions, searchCallBack);
    req.write(metodo.jiraQueryJson);
    req.end();

    req.on('error', function(e) {
      console.error(e);
    }); 

  };

    function searchJiraCallParent(metodos){
    var metodo = metodos[0];
    function searchCallBack(res) {
      //console.log("search statusCode: ", res.statusCode);
      //console.log("headers: ", res);      

      res.on('data', function(chunk) {
        process.stdout.write(chunk);
        //console.log('BODY: ' + chunk);
        var result = JSON.parse(chunk);
        //console.log("find result", result);
        if(result.total > 1){
          console.log('Foi encontrado mais de um result, nao foi possivel criar ou fazer update '  + metodo.jiraName);
          //classList[i].jiraQueryJson[x] = undefined;
          //metodos = metodos.splice(x, 1);                
        }else if(result.total == 1 && result.issues[0].fields.status.id != 6){            
          console.log("Update Jira is not implemented." + metodo.jiraName);
          verificaFilhos(metodos, result.issues[0].id);
          //classList[i].jiraQueryJson[x] = undefined;
          //metodos = metodos.splice(x, 1);                
        }else{
          console.log('jira sera criado : '+ metodo.jiraName);
          criaJira(metodos);
        }
      });
    }

    var searchOptions = new optionsJiraSearchIssue(metodo.jiraQueryJson);            

    var req = https.request(searchOptions, searchCallBack);
    req.write(metodo.jiraQueryJson);
    req.end();

    req.on('error', function(e) {
      console.error(e);
    }); 

  };


  var criaJira = function(jira){

    console.log('jira', jira);

    if(jira){  
      var data = new Object;
      data.fields = {
          project : {key: 'HANOI'},
          issuetype : {id: '1'},
          summary : jira.jiraName,
          labels: ["jenkins_test"],
          description: jira.errorDetails
      };

      var jsondata = JSON.stringify(data);
      console.log('criando jira', jsondata);
      var optionsCria = new optionsJiraCreateIssue(jsondata);


      var req = https.request(optionsCria, function(res) {
        console.log("create statusCode: ", res.statusCode);
        console.log("headers: ", res.headers);      

        res.on('data', function(d) {
          process.stdout.write(d);
        });
      });
      req.write(jsondata);
      req.end();

      req.on('error', function(e) {
        console.error(e);
      });
    }
  };

  function jiraClassObj(method, nameClass, jiraName, jiraQueryJson){
    this.method = method;
    this.nameClass = nameClass;
    this.jiraName = jiraName;
    this.jiraQueryJson = jiraQueryJson;
  };



  function optionsJiraCreateIssue(data){
      this.hostname = optionsJiraDefault.hostname;
      this.port = optionsJiraDefault.port;
      this.path = '/jira/rest/api/2/issue';      
      this.method = 'POST';      
      this.headers = {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Authorization': 'Basic ' + new Buffer(usernameJira + ':' + passwordJira).toString('base64')        
      }
  };

  function optionsJiraSearchIssue(data){
      this.hostname = optionsJiraDefault.hostname;
      this.port = optionsJiraDefault.port;
      this.path = '/jira/rest/api/2/search';      
      this.method = 'POST';      
      this.headers = {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Authorization': 'Basic ' + new Buffer(usernameJira + ':' + passwordJira).toString('base64')        
      }
  };  

  function jiraSearchParams(jql){
      this.jql = jql;
      this.fields = ["summary", "status", "assignee"];
  };

  function jiraJql(jiraName){      
      this.jql = "project = HANOI AND Summary ~ \"" + jiraName + "\"";
  };


  var teste = function(req, res){
    buscarTestesIntegracao(res);
  };

  

  var TesteController = {
    createSheet : function(req, res) {      
      teste(req, res);
    }
  }
  return TesteController;

};

