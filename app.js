//==============================================================================================================================
var express = require('express');
var app = express();
var serv = require('http').Server(app);
var path = require('path');

app.get('/', function(req, res){
  res.sendFile(__dirname + '/client/index.html');

});
app.use('/client', express.static(__dirname + '/client'));

serv.listen(2000);
console.log("Server started on port 2000.");

var io = require('socket.io')(serv, {});
//==============================================================================================================================

var SOCKET_LIST = {};

var Entity = function(){
  var self = {
    x: 413,
    y: 260,
    spdX: 0,
    spdY: 0,
    id: "",
  }
  self.update = function(){
    self.updatePosition();
  }
  self.updatePosition = function(){
    self.x += self.spdX;
    self.y += self.spdY;
  }
  self.getDistance = function(pt){
    return Math.sqrt(Math.pow(self.x-pt.x, 2) + Math.pow(self.y-pt.y, 2));
  }
  return self;
}

var Enemy = function(){
  var self = Entity();
  self.id = Math.random();
  self.x = 200;
  self.y = 160;
  self.hp = 30;
  self.maxHp = 30;
  self.maxSpd = 15;

  var super_update = self.update;
  self.update = function(){

    super_update();

    for( var i in Bullet.list){
        var b = Bullet.list[i];
        if( self.getDistance(b) < 32){
            self.hp = self.hp - .5;
          if( self.hp <= 0){
            self.hp = self.maxHp;
            self.x = Math.random() * 500;
            self.y = Math.random() * 500;
          }
          b.toRemove = true;
        }
    }
    for( var i in Player.list){
        var p = Player.list[i];
        if( self.getDistance(p) < 32){
            p.hp = p.hp - 1;
            if( p.hp <= 0){
              p.hp = p.hpMax;
              p.x = 413;
              p.y = 260;
            }
        }
    }
  }
  Enemy.list[self.id] = self;
  self.getInitPack = function(){
    return {
      id: self.id,
      x: self.x,
      y: self.y,
      hp: self.hp,
      maxHp: self.maxHp,
    }
  }
  self.getUpdatePack = function(){
    return {
      id: self.id,
      x: self.x,
      y: self.y,
      hp: self.hp,
    }
  }

  initPack.enemy.push(self.getInitPack());

}
Enemy.list = {};

Enemy.update = function(){
  var pack = [];
  for(var i in Enemy.list){
    var enemy = Enemy.list[i];
    enemy.update();
    pack.push(enemy.getUpdatePack());
  }
  return pack;
}

var Player = function(id){
    var self = Entity();
    self.id = id;
    self.number = "" + Math.floor(1000 * Math.random());
    self.pressingRight = false;
    self.pressingLeft = false;
    self.pressingDown = false;
    self.pressingUp = false;
    self.pressingAttack = false;
    self.mouseAngle = 0;
    self.maxSpd = 10;
    self.hp = 10;
    self.hpMax = 10;

  var super_update = self.update;
  self.update = function(){
    self.updateSpeed();
    self.checkBound();
    super_update();

    if( self.pressingAttack ){
      self.shootBullet( self.mouseAngle );
    }
  }

  self.shootBullet = function(angle){
    var b = Bullet(self.id, angle);
    b.x = self.x;
    b.y = self.y;
  }

  self.updateSpeed = function(){
    if(self.pressingRight){
      self.spdX = self.maxSpd;
    }
    else if(self.pressingLeft){
      self.spdX = -self.maxSpd;
    }
    else{
      self.spdX = 0;
    }

    if( self.pressingUp ){
      self.spdY = -self.maxSpd;
    }
    else if(self.pressingDown ){
      self.spdY = self.maxSpd;
    }
    else{
      self.spdY = 0;
    }
  }

  self.checkBound = function(){
    // don't let player leaves the world's boundary
    if(this.x - 21/2 < 0){
        this.x = 21/2;
    }
    if(this.y - 21/2 < 0){
        this.y = 21/2;
    }
    if(this.x + 21/2 > 894){
        this.x = 894 - 21/2;
    }
    if(this.y + 21/2 > 864){
        this.y = 864 - 21/2;
    }
  }


  self.getInitPack = function(){
    return {
      id: self.id,
      x: self.x,
      y: self.y,
      number: self.number,
      hp: self.hp,
      hpMax: self.hpMax,
    }
  }

  self.getUpdatePack = function(){
    return {
      id: self.id,
      x: self.x,
      y: self.y,
      hp: self.hp,
    }
  }

  Player.list[id] = self;
  initPack.player.push(self.getInitPack());
  return self;
}
Player.list = {};

var initPack = {player: [], bullet: [], enemy: []};
var removePack = {player: [], bullet: [], enemy: []};
var monster = new Enemy();


Player.onConnect = function(socket){
  var player = Player(socket.id);
  socket.on("keyPress", function(data){
    if( data.id === "right"){
      player.pressingRight = data.state;
    }
    else if( data.id === "left"){
      player.pressingLeft = data.state;
    }
    else if( data.id === "up"){
      player.pressingUp = data.state;
    }
    else if( data.id === "down"){
      player.pressingDown = data.state;
    }
    else if( data.id === "attack"){
      player.pressingAttack = data.state;
    }
    else if( data.id === "mouseAngle"){
      player.mouseAngle = data.state;
    }
  });

  var players = [];
  for( var i in Player.list){
    players.push(Player.list[i].getInitPack());
  }
  var bullets = [];
  for( var i in Bullet.list){
    bullets.push(Bullet.list[i].getInitPack());
  }
  var enemies = [];
  for( var i in Enemy.list){
    enemies.push(Enemy.list[i].getInitPack());
  }


  socket.emit("init", {
    selfId: socket.id,
    player: players,
    bullet: bullets,
    enemy: enemies,
  });

}

Player.onDisconnect = function(socket){
    delete Player.list[socket.id];
    removePack.player.push(socket.id);
}

Player.update = function(){
  var pack = [];
  for(var i in Player.list){
    var player = Player.list[i];
    player.update();
    pack.push(player.getUpdatePack());
  }
  return pack;
}

var Bullet = function(parent, angle){
  var self = Entity();
  self.id = Math.random();
  self.spdX = Math.cos(angle/180*Math.PI) * 10;
  self.spdY = Math.sin(angle/180*Math.PI) * 10;
  self.parent = parent;

  self.timer = 0;
  self.toRemove = false;
  var super_update = self.update;
  self.update = function(){
    if( self.timer++ > 100){ //after 100 frames, flag bullet for removal
        self.toRemove = true;
    }
    super_update();

    for( var i in Player.list){
        var p = Player.list[i];
        if( self.getDistance(p) < 32 && self.parent !== p.id){
          p.hp = p.hp - .5;
          if( p.hp <= 0){
            p.hp = p.hpMax;
            p.x = 413;
            p.y = 260;
          }
          self.toRemove = true;
        }
    }
  }
  Bullet.list[self.id] = self; //add bullet to active list
  self.getInitPack = function(){
    return {
      id: self.id,
      x: self.x,
      y: self.y,
    }
  }
  self.getUpdatePack = function(){
    return {
      id: self.id,
      x: self.x,
      y: self.y,
    }
  }

  initPack.bullet.push(self.getInitPack());

  return self;
}
Bullet.list = {};

Bullet.update = function(){
  var pack = [];
  for( var i in Bullet.list){
    var bullet = Bullet.list[i];
    bullet.update();
    if( bullet.toRemove){
      delete Bullet.list[i];
      removePack.bullet.push(bullet.id);
    }
    else{
      pack.push(bullet.getUpdatePack());
    }
  }
  return pack;
}


io.sockets.on("connection", function(socket){

  socket.id = Math.random();
  SOCKET_LIST[socket.id] = socket;

  Player.onConnect(socket);

  socket.on('disconnect', function(){
    delete SOCKET_LIST[socket.id];
    Player.onDisconnect(socket);
    for(var i in SOCKET_LIST){
      SOCKET_LIST[i].emit("lobbylist", Player.list);
    }
  });

  socket.on("sendMessageToServer", function(data){
    var name = Player.list[socket.id].number;
    for( var i in SOCKET_LIST){
      SOCKET_LIST[i].emit("addToChat", { player: name, message: data });
    }
  });

  socket.on("evalServer", function(data){
    try {
      var res = eval(data);
    } catch (e) {
      res = e.message;
    }
    socket.emit("evalAnsw", res);
  });

  for(var i in SOCKET_LIST){
    SOCKET_LIST[i].emit("lobbylist", Player.list);
  }

});



setInterval(function(){
  var pack = {
    player: Player.update(),
    bullet: Bullet.update(),
    enemy: Enemy.update(),
  }

  for( var i in SOCKET_LIST){
    var socket = SOCKET_LIST[i];
    socket.emit('init', initPack);
    socket.emit('update', pack);
    socket.emit('remove', removePack);
  }

  initPack.player = [];
  initPack.bullet = [];
  removePack.player = [];
  removePack.bullet = [];
  removePack.enemy = [];
  initPack.enemy = [];

},1000/25); //sends every frame
