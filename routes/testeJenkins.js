module.exports = function(app) {

  var testeJenkins = app.controllers.testeJenkins;

  app.get('/jenkins', testeJenkins.createSheet);

};

