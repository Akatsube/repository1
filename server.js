var path = require("path") // Find the path of our folders
var http = require("http") // Start online server

// npm install <libraryname>
var express = require("express") // Send and receive info (has to be downloaded)
var socketIO = require("socket.io") // Send and receive info (has to be downloaded)
var Victor = require("victor")
const { type } = require("os")

var publicPath = path.join(__dirname, '../client') // find our 'client' folder from 'server.js' file
var port = process.env.PORT || 2000 // Port of our server is using on a computers
var app = express() // Initialize express library
var server = http.createServer(app) // Create the server
var io = socketIO(server) // Connect socket.io library to our servers
app.use(express.static(publicPath)) // Specify the client folder we send to client who connect 

var players = []
var foodObjects = []


// Defining classes

class Player{
    constructor(id,name,x,y){
        this.id = id
        this.name = name
        this.x = x
        this.y = y
        this.speedX = 0
        this.speedY = 0
        this.angle = 0
        this.mouseX = 0;
        this.mouseY = 0;
        this.windowWidth = 0;
        this.windowHeight = 0;
        this.mass = 10
        this.radius = 0
        this.speedFactor = 1
    }

    
    update(){
        // Get angle between mouse and center of screen (in radian)
        this.relativeX = this.mouseX - this.windowWidth/2
        this.relativeY = this.mouseY - this.windowHeight/2
        this.relativeDist = Math.sqrt(this.relativeX**2 + this.relativeY**2)
        this.angle = Math.atan2(this.relativeY, this.relativeX) 


        // Calculate radius based on mass
        let roh = 10**(-3)/Math.PI
        this.radius = Math.sqrt(this.mass/(Math.PI*roh))

        // Calculate speed based on mass
        this.speedFactor = this.mass/Math.pow(this.mass,1.44)*10    / 10

        // Set speed based on mouse and angle
        if (this.relativeDist > 50){
            this.speedX = Math.cos(this.angle) * 5 * this.speedFactor
            this.speedY = Math.sin(this.angle) * 5 * this.speedFactor
        }
        else{
            this.speedX = 0
            this.speedY = 0
        }
        
        // Move player object
        this.x += this.speedX
        this.y += this.speedY

        
    }


    getInitPack() {
        return {
            id: this.id,
            name: this.name,
            x: this.x,
            y: this.y
        }
    }

    getUpdatePack(){
        return {
            id: this.id,
            x: this.x,
            y: this.y,
            angle: this.angle,
            mass: this.mass,
            radius: this.radius
        }
    }

    
}

class Food{
    constructor(value, x, y){
        this.id = Math.random()*10000
        this.value = value
        this.x = x
        this.y = y
    }

    draw(){
        push()
        translate(this.x, this.y) // Center the next drawing on the player coordinates
        rectMode(CENTER) // Set the rect to always be centered
        circle(0,0,50) // rect(x,y,radius)
        pop()
    }
}



function generateFood(){
    let x = Math.random()*1000-500
    let y = Math.random()*1000-500
    let food = new Food(1,x,y)
    foodObjects.push(food)
}


// Initializing food on the map
for(let i = 0; i<10; i++){
    generateFood()
}


// Run the server
server.listen(port, function(){
    console.log("Server successfully runned on port " + port)
})

// When a new client connects to our server, info are stored in socket ('connection' cannot be named otherwise)
io.on('connection', function(socket){
    var player // Represent the player connected

    // Listening to new player
    socket.on("imReady", (data) => {
        player = new Player(socket.id, data.name, Math.random() * 500, Math.random() * 500);
        players.push(player);

        socket.emit("yourId", {id: player.id}); // Send back the new ID to the new players
        socket.broadcast.emit('newPlayer', player.getInitPack()); // 

        socket.emit("initPack", {initPack: getAllPlayersInitPack()});


        // Receive data from player
        socket.on("inputData", (data) => {
            player.mouseX = data.mouseX || 0;
            player.mouseY = data.mouseY || 0;
            player.angle = data.angle || 0;
            player.windowWidth = data.windowWidth;
            player.windowHeight = data.windowHeight;
        })


        // Disconnect a player
        socket.on("disconnect", () => {
            io.emit('someoneLeft', {id: socket.id});
        
            players = players.filter((element) => element.id !== socket.id);
        });
    });


})



function displayPlayers(){
    console.log("---")
    console.log("Current list of players")
    players.forEach(e=>{
        console.log("[ID] "+e.id+", [Name] "+e.name)
    })
}


function displayPlayersInfo(){
    console.log("---")
    console.log("Current list of players info")
    players.forEach(e=>{
        console.log("[ID] "+e.id+", [Name] "+e.name+", [x] "+e.x+", [y] "+e.y)
    })
}


function getAllPlayersInitPack() {
    var initPack = [];
    for(var i in players) {
        initPack.push(players[i].getInitPack());
    }
    return initPack;
}




//////////////////////////////////////////////////////////////// SET INTERVAL //////////////////////////////////////////////////////////////////////////

setInterval(() => {

    // Calculate interactions between objects
    players.forEach( p => {
        foodObjects.forEach( o => {
            let distPlayerObject = Math.sqrt((p.x-o.x)**2+(p.y-o.y)**2)
            if (distPlayerObject<p.radius){
                foodObjects = foodObjects.filter(food => food.id !== o.id); // Delete an food object
                p.mass += o.value // Increase player mass
                generateFood() // Generate a new food after deleting one
            }
        })

        players.forEach( q => {
            let distPlayerObject = Math.sqrt((p.x-q.x)**2+(p.y-q.y)**2)
            if (distPlayerObject<p.radius && p!==q && p.mass>q.mass){
                players = players.filter(player => player.id !== q.id); // Delete a player object
                p.mass += q.mass // Increase player mass
                console.log("Player " + p.name + " has eaten " + q.name)
                io.emit('someoneLeft', {id: q.id});
            }
        })

    });


    // Send positions of players to all players
    var updatePack = [];
    for(var i in players) {
        players[i].update();
        updatePack.push(players[i].getUpdatePack());
    }
    io.emit("updatePack", {updatePack}); // Send updated basic data for client to draw all players

    // Send positions of objects to all players
    io.emit("updateObject", {foodObjects}); // Update objects like food


}, 1000/35)

