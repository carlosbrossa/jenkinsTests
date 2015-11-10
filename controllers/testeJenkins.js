module.exports = function(app) {

  var http = require('http');
  var events = require('events');
  var eventEmitter = new events.EventEmitter();  

  //jira
  var usernameJira = "ccc";
  var passwordJira = "xxxx";
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
  
  eventEmitter.on('findLastBuildEvents', function(res, lastBuilds, testesIntegracao){    

     if(lastBuilds.length == testesIntegracao.length){        
        buscarDetalheBuild(res, lastBuilds);
     }
  });

    eventEmitter.on('buscarDetalheBuild', function(res, errosBuilds, lastBuilds){             
      //console.log('asasasasasasasaaaaaaaa', errosBuilds); 
     if(lastBuilds.length == errosBuilds.length){        
        console.log("chegou no total aeee - " + errosBuilds.length); 
        var jsondata = JSON.stringify(errosBuilds);
        //console.log("result - " + jsondata);        
        //res.send(errosBuilds);
        prepareJiras(res, errosBuilds, lastBuilds);
     }
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
            findLastBuild(testesIntegracao, res);
          });


      }).end();
  };

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
    //"accept-language" : "en-US,en;q=0.8",
    "accept" : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
  };

  var buscarDetalheBuild = function(res, lastBuilds){
    var errosBuilds = new Array();
    //console.log(lastBuilds);
    for (var k = 0; k < lastBuilds.length; k++) {        
        var optionsBuildCurrent = new Object();
        optionsBuildCurrent.host = host;
        optionsBuildCurrent.headers = headers;
        optionsBuildCurrent.path = optionsBuild.path.replace('{job}', lastBuilds[k].itemId).replace('{teste}', lastBuilds[k].displayName);                
        //console.log(optionsBuildCurrent.path);
        detailbuild(res, optionsBuildCurrent, lastBuilds, errosBuilds, k);
    }
  };

  var detailbuild = function(res, optionsBuildCurrent, lastBuilds, errosBuilds, k){    
    http.get(optionsBuildCurrent, function(response) {
          //console.log(optionsBuildCurrent.host + optionsBuildCurrent.path);
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
              console.log("Erro ao obter testes do job. Provalvelmente o job foi interrompido. nameJob=" + lastBuilds[k].displayName)
            }
            var errBuild = new Object();
            errBuild.displayName = lastBuilds[k].displayName;
            errBuild.testes = testsWithError;
            errosBuilds.push(errBuild);  
            //console.log('errosBuilds length - ' + errosBuilds.length);
            //console.log('k length - ' + k);
            eventEmitter.emit('buscarDetalheBuild', res, errosBuilds, lastBuilds);                          
          });

        }).end();  

  }
  //fim jenkins


    var criaJiras = function(jira, nameJira){
      console.log('jira', jira);
    if(jira){  
      var data = new Object;
      data.fields = {
          project : {key: 'HANOI'},
          issuetype : {id: '1'},
          summary : nameJira,
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

  var prepareJiras = function(res, errosBuilds, lastBuilds){    
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
    //console.log("ClassLit", classList);
    searchJiras(res, classList, listNameClass);
  };

  


  var searchJiras = function(response, classList, listNameClass){
    
    for(var i = 0; i < listNameClass.length; i++){
      var nameCurrentClass = listNameClass[1];
      var metodos = classList[nameCurrentClass];
      if(metodos){
        for(var x = 0; x < metodos.length; x++){         
          if(metodos[x]){
            var searchOptions = new optionsJiraSearchIssue(metodos[x].jiraQueryJson);

            var req = https.request(searchOptions, function(res) {
              console.log("search statusCode: ", res.statusCode);
              //console.log("headers: ", res.headers);      

              res.on('data', function(chunk) {
                process.stdout.write(chunk);
                //console.log('BODY: ' + chunk);
                var result = JSON.parse(chunk);
                console.log("find result", result);
                if(result.total > 1){
                  console.log('Foi encontrado mais de um result, nao foi possivel criar ou fazer update '  + metodos[x].nameClass + metodos[x].method);
                  //classList[i].jiraQueryJson[x] = undefined;
                  metodos = metodos.splice(x, 1);                
                }else if(result.total == 1 && result.issues[0].fields.status.id != 6){            
                  console.log("Update Jira is not implemented." + metodos[x].nameClass + metodos[x].method);
                  //classList[i].jiraQueryJson[x] = undefined;
                  metodos = metodos.splice(x, 1);                
                }else{
                  console.log('jira sera criado : ' + metodos[x] + metodos[x]);            
                  //TODO SAPORRA TA NULL
                }
              });
            });
            req.write(metodos[x].jiraQueryJson);
            req.end();

            req.on('error', function(e) {
              console.error(e);
            }); 
          }   
        }  
      }  
      classList[i] = metodos;
    }
    response.send(classList);
  }

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
  //buscaJiras();  
  //criaJiras();
  };

  

  var TesteController = {
    createSheet : function(req, res) {      
      teste(req, res);
    }
  }
  return TesteController;

};

