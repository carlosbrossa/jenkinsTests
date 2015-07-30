module.exports = function(app) {

  var testeJenkins = app.controllers.testeJenkins;

  app.get('/sheet', testeJenkins.createSheet);

};

