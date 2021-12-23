var testStart = false;

/**Instructions rendered on the canvas */
var instructions = "Select test type and wait. There will be a delay before a change is visible. DO NOT click button twice.";

//Groups of elements
/**Objectives represented by passengers of a self-driving car service */
var passengers = [];
/**All cells in environment */
var grid = [[]];
/**All cells able to be traveled through */
var roads = [];
/**Agents whose paths are being plotted: autonomous vehicles transporting passengers:
 *  Index in this array will be used to indentify individual cars
 */
var cars = [];

//Environment settings
/**
 * The length and width of the environment including border cells.
 * Must be an odd integer >= 5.
 */
var gridSize = 33;
/**The number of blocks/obstacles to place on roads*/
var obstCt = 200;
/**The number of cars/agent to create */
var carCt = 40;
/**Then number of passengers that must be delivered */
var passCt = 80;

//Runtime variables
/**The number of passengers that have been delivered*/
var deliveryCt = 0;
/**The length of a cell */
var cellSize;
/**How many frames per timestep */
var stepSize = 10;
/**Timesteps elapsed during execution time*/
var timestep = 0;
/**Total timestep cost of all agents paths/actions */
var totalCost = 0;

/**An autonomous vehicle agent
 * @typedef {Object} Car
 * @property {number} x The x coordinate of this car
 * @property {number} y The y coordinate of this car
 * @property {number} id The index of this car in cars, used to identify this car
 * @property {number} passenger The id of the passenger this car is assigned to, -1 if unassigned
 * @property {Object[]} que The cells with cost i that this car is considering for paths
 * @property {Object} [sprite] The p5 sprite used to represent this car in graphic tests 
*/
class Car{
  /** Makes a new car
   * @param {number} x The initial x coordinate of this car
   * @param {number} y The initial y coordinate of this car
   * @param {number} id The index of this car in cars, used to identify this car
   * @param {boolean} inDraw Whether or not the car is being made in the draw loop, creates a sprite for this car if so
   */
  constructor(x, y, id, inDraw){
    this.x = x
    this.y = y;
    this.id = id;
    this.status = -1;
    this.passenger = null;
    this.que = [];
    this.path = [];
    if(inDraw){
      this.sprite = createSprite(cellSize*x+cellSize/2, cellSize*y+cellSize/2);
      this.sprite.draw = function(){
        noStroke();
        fill("white");
        rect(0, cellSize/4, cellSize/2, cellSize/4);
      }
    }
    else{
      this.countSteps = true;
    }
  }

  pathfind(){
    var dest;
    switch(this.passenger.status){
      case 1: 
        dest = {x: this.passenger.homeX, y: this.passenger.homeY};
        break;
      case 2:
        dest = {x: this.passenger.destX, y: this.passenger.destY};
    }
    this.que = [{x: dest.x, y: dest.y, i: 0}]
    var i = 0;
    var found = false;
    while(!found){
      i++;
      this.que.forEach(function(cell){
        var cells = adjacent(cell.x, cell.y);
        cells.forEach(function(res){
          var next = {x: res.x, y: res.y, i: i};
          if(grid[next.x][next.y].open && !this.que.some(p => {return p.x === next.x && p.y === next.y})){
            this.que.push(next);
          }
          if(next.x === this.x && next.y === this.y){
            found = true;
            return;
          }
        }, this);
        if(found){
          return;
        }
      }, this);
    }
    this.path = [this.que.find(cell => {if(cell.x === this.x && cell.y === this.y) return cell})];
    for(var ii = i-1; ii >= 0; ii--){
      var cell = this.que.find(nextCell => {if(nextCell.i === ii && adjacent(nextCell.x, nextCell.y).some(adj => {return adj.x === this.path[-ii+i-1].x && adj.y === this.path[-ii+i-1].y})) return nextCell});
      this.path.push(cell);      
    }
    if(this.sprite){
      this.sprite.pointTo(this.path[1].x*cellSize+cellSize/2, this.path[1].y*cellSize+cellSize/2);
    }
    this.status = -1;
  }
}

class Passenger{
  constructor(homeX, homeY, destX, destY, id){
    this.homeX = homeX;
    this.homeY = homeY;
    this.destX = destX;
    this.destY = destY;
    this.id = id;
    this.status = 0;
    this.car = null;
  }
}

function preload(){
}

function setup(){
  createCanvas(smallDim(), smallDim());
  orientButtons();
  camera.on();
  camera.position.x = 500;
  camera.position.y = 500;
}

function draw(){
  background("green");
  if(testStart){
    generatePassengers();
    doDrive();
  }
  else{
    renderInstructions();
  }
  renderGrid();
  camera.zoom = smallDim()/1000;
  drawSprites();
}

function test1(){
  document.getElementById("test1").style.display = "none";
  document.getElementById("test2").style.display = "none";
  setupGrid();
  generateCars(true);
  testStart = true;
}

function test2(){
  instructions = "Tests Complete: Open Console For Results";
  console.log(new Date());
  doTests();
}

function doTests(){
  obstCt = 50;
  for(gridSize = 17; gridSize <= 33; gridSize += 16){
    for(carCt = 20; carCt <= 40; carCt += 20){
      for(passCt = 60; passCt <= 80; passCt += 20){
        timestepArr = [];
        totalCostArr = [];
        for(var test = 0; test < 10; test++){
          setupGrid();
          generateCars(false);
          deliveryCt = 0;
          timestep = 0;
          totalCost = 0;
          //logGrid();
          while(deliveryCt < passCt){
            timestep++;
            generatePassengers();
            //TODO merge with doDrive() and add checks for draw loop actions
            var passengersDelivered = [];
            passengers.forEach(function(passenger){
              if(!passenger.car){
                dispatch(passenger);
              }
              var car = passenger.car
              if(!car.path.length){
                car.pathfind();
              }
              car.status++;
              if(car.countSteps){
                totalCost++;
              }
              var wait = false;
              if(car.path.length - car.status > 1){
                var nextCell;
                var thisCell = car.path[car.status+1];
                var conflict = cars.find(nextCar => {
                  if(!nextCar){
                    return false;
                  }
                  if(nextCar.passenger && nextCar.passenger.id < passenger.id && nextCar.path.length - nextCar.status > 1){
                    nextCell = nextCar.path[nextCar.status+1];
                  }
                  else{
                    return false;
                  }
                  if(thisCell.x === nextCell.x && thisCell.y === nextCell.y) return nextCar;
                });
                if(conflict){
                  var thisPrev = car.path[car.status];
                  var nextPrev = conflict.path[conflict.status];
                  var thisdx = thisCell.x - thisPrev.x;
                  var thisdy = thisCell.y - thisPrev.y;
                  var nextdx;
                  var nextdy;
                  if(nextPrev){
                    nextdx = nextCell.x - nextPrev.x;
                    nextdy = nextCell.y - nextPrev.y;
                  }
                  if(!(nextPrev && ((nextPrev.x === thisCell.x+thisdx && nextPrev.y === thisCell.y+thisdy) && (thisPrev.x === nextCell.x+nextdx && thisPrev.y === nextCell.y+nextdy)))){
                    wait = true;
                    car.status--;
                  }
                }
                var next = car.path[car.status+1];
                var current = car.path[car.status];
                if(!wait){
                  //resolveNewConflicts(car);
                  car.x = next.x;
                  car.y = next.y;
                }
              }
              else{
                if(passenger.status === 1){
                  passenger.status = 2;
                }
                else{
                  deliveryCt++;
                  passengersDelivered.push(passenger.id);
                  if(deliveryCt + passengers.length >= passCt){
                    car.countSteps = false;
                  }
                  car.passenger = null;
                }
                car.que = [];
                car.path = [];
              }
            });
            passengersDelivered.forEach(function(passID){
              passengers.splice(passengers.findIndex(pass => {return pass.id === passID}), 1);
            });
          }
          console.log(new Date() + ": test "+test);
          timestepArr.push(timestep);
          totalCostArr.push(totalCost);
        }
        console.log(`Set Complete:
  No. of Agents: ${carCt}
  No. of Passengers: ${passCt}
  Grid Side Length: ${gridSize-1}`);
        console.table({"Overall Solution Efficiency": timestepArr, "Total Individual Solution Efficiency": totalCostArr});
      }
      console.log("2 sets complete");
    }
    console.log("4 sets complete");
    obstCt = 200;
  }
  console.log("all sets complete");
  passengers = [];
  grid = [[]];
  roads = [];
  cars = [];
}


function renderInstructions(){
  textSize(50);
  textAlign(CENTER, CENTER);
  text(instructions, 50, 50, 900, 400);
}

function renderGrid(){
  cellSize = 1000/gridSize
  noStroke();
  grid.forEach(function(column, x){
    column.forEach(function(cell, y){
      if(cell.open){
        fill("grey");
        rect(cellSize*x, cellSize*y, cellSize);
        var passHome = passAt(x, y, true);
        if(passHome && passHome.status < 2){
          fill("lime");
          if(passHome.car){
            fill("blue")
          }
          ellipse(cellSize*x+cellSize/2, cellSize*y+cellSize/2, cellSize/2);
        }
        var passDest = passAt(x, y, false);
        if(passDest){
          fill("red");
          //triangle
          beginShape();
          vertex(cellSize*x+cellSize/2, cellSize*y+cellSize*0.75);
          vertex(cellSize*x+cellSize*0.75, cellSize*y+cellSize/4);
          vertex(cellSize*x+cellSize/4, cellSize*y+cellSize/4);
          endShape();
        }
      }
    });
  });
}

function doDrive(){
  if(frameCount % stepSize === 0){
    var passengersDelivered = [];
    passengers.forEach(function(passenger){
      if(!passenger.car){
        dispatch(passenger);
      }
      var car = passenger.car
      if(!car.path.length){
        car.pathfind();
      }
      car.status++;
      //TODO give priority to car in front instead of first checked
      var wait = false;
      if(car.path.length - car.status > 1){
        var nextCell;
        var thisCell = car.path[car.status+1];
        var conflict = cars.find(nextCar => {
          if(!nextCar){
            return false;
          }
          if(nextCar.passenger && nextCar.passenger.id < passenger.id && nextCar.path.length - nextCar.status > 1){
            nextCell = nextCar.path[nextCar.status+1];
          }
          else{
            return false;
          }
          if(thisCell.x === nextCell.x && thisCell.y === nextCell.y) return nextCar;
        });
        if(conflict){
          //console.log(car.status, car.path, conflict.path);
          var thisPrev = car.path[car.status];
          var nextPrev = conflict.path[conflict.status];
          var thisdx = thisCell.x - thisPrev.x;
          var thisdy = thisCell.y - thisPrev.y;
          var nextdx;
          var nextdy;
          if(nextPrev){
            nextdx = nextCell.x - nextPrev.x;
            nextdy = nextCell.y - nextPrev.y;
          }
          if(!(nextPrev && ((nextPrev.x === thisCell.x+thisdx && nextPrev.y === thisCell.y+thisdy) && (thisPrev.x === nextCell.x+nextdx && thisPrev.y === nextCell.y+nextdy)))){
            wait = true;
            car.status--;
          }
        }
        var next2 = car.path[car.status+2];
        var next = car.path[car.status+1];
        var current = car.path[car.status];
        if(wait){
          car.sprite.setVelocity(0, 0);
          car.sprite.pointTo(next2.x*cellSize + cellSize/2, next2.y*cellSize + cellSize/2);
          //resolveNewConflicts(car);
        }
        else{
          car.x = next.x;
          car.y = next.y;
          car.sprite.setVelocity((next.x - current.x)*cellSize/stepSize, (next.y - current.y)*cellSize/stepSize);
          car.sprite.pointTo(next.x*cellSize + cellSize/2, next.y*cellSize + cellSize/2);
        }
      }
      else{
        car.sprite.setVelocity(0, 0);
        if(passenger.status === 1){
          passenger.status = 2;
          //car.x = car.path[car.path.length-1].x;
          //car.y = car.path[car.path.length-1].y;
          car.que = [];
          car.path = [];
          car.sprite.draw = function(){
            noStroke();
            fill("white");
            rect(0, cellSize/4, cellSize/2, cellSize/4);
            fill("blue");
            ellipse(0, cellSize/4, cellSize/4);
          }
        }
        else{
          deliveryCt++;
          passengersDelivered.push(passenger.id);
          car.passenger = null;
          if(deliveryCt + passengers.length >= passCt){
            car.sprite.remove();
          }
          else{
            car.que = [];
            car.path = [];
            car.sprite.draw = function(){
              noStroke();
              fill("white");
              rect(0, cellSize/4, cellSize/2, cellSize/4);
            }
          }
        }
      }
    });
    passengersDelivered.forEach(function(passID){
      passengers.splice(passengers.findIndex(pass => {return pass.id === passID}), 1);
    });
  }
  if(frameCount % (stepSize*10) === 0 && deliveryCt === passCt){
    grid = [[]];
    testStart = false;
    document.getElementById("test1").style.display = "block";
    document.getElementById("test2").style.display = "block";
  }  
}

function resolveNewConflicts(car){
  var newConflicts = cars.filter(newCar => {
    return newCar.passenger && newCar.passenger.id < car.passenger.id && newCar.x === car.x && newCar.y === car.y
  });
  var newConflict = newConflicts[newConflicts.length-1];
  if(newConflict){
    var next2 = newConflict.path[newConflict.status+2];
    var next = newConflict.path[newConflict.status+1];
    var current = newConflict.path[newConflict.status];
    if(newConflict.sprite){
      newConflict.sprite.setVelocity(0, 0);
      newConflict.sprite.pointTo(next2.x*cellSize + cellSize/2, next2.y*cellSize + cellSize/2);
    }
    newConflict.x = current.x;
    newConflict.y = current.y;
    newConflict.status--;
    resolveNewConflicts(newConflict);
  }
}

function dispatch(passenger){
  var queue = [{x: passenger.homeX, y: passenger.homeY, i: 0}];
  var i = 0;
  var car = carAt(passenger.homeX, passenger.homeY).find(nextCar => {if(!nextCar.passenger) return nextCar});
  //console.log("started searching for car");
  while(!car){
    i++;
    var filtered = queue.filter(filterCell => {return filterCell.i === i-1});
    //console.log(queue, filtered);
    filtered.forEach(function(cell){
      var cells = adjacent(cell.x, cell.y);
      //console.log(cell, cells);
      cells.forEach(function(res){
        var next = {x: res.x, y: res.y, i: i};
        if(grid[next.x][next.y].open && !queue.some(p => {return p.x === next.x && p.y === next.y}) && !car){
          queue.push(next);
          //console.log(carAt(next.x, next.y), next.x, next.y);
          car = carAt(next.x, next.y).find(nextCar => {if(!nextCar.passenger) return nextCar});
        }
        if(car){
          return
        }
      });
      if(car){
        return;
      }
    });
  }
  //console.log(car.x, car.y, passenger);
  //console.log(`dispatched car ${car.id} to passenger ${passenger.id}`);
  car.passenger = passenger;
  car.status = -1;
  passenger.car = car;
  passenger.status = 1;
}

function setupGrid(){
  //reset environment
  passengers = [];
  grid = [[]];
  roads = [];
  cars = [];
  deliveryCt = 0;
  //Iterate through grid coordinates
  for(var x = 0; x < gridSize; x++){
    for(var y = 0; y < gridSize; y++){
      //add to x dimension if necessary
      if(grid.length < x+1){
        grid.push([]);
      }
      //identify borders and inner grass
      if(!x || x == gridSize-1 || !y || y == gridSize-1 || !(x % 2 || y % 2)){
        grid[x].push({open: false, type: "grass"});
      }
      //otherwise mark cell as road
      else{
        grid[x].push({open: true, type: "road"});
        roads.push({x: x, y: y});
      }
    }
  }
  //places obstacles
  for(var i = 0; i < obstCt; i++){
    var cell, obstX, obstY;
    do{
      //Ensures that block is placed on straight stretch of road rather than intersection or grass
      if(rand(0, 2)){
        obstX = rand(2, gridSize/2)*2-1;
        obstY = rand(2, gridSize/2)*2;
      }
      else{
        obstX = rand(2, gridSize/2)*2;
        obstY = rand(2, gridSize/2)*2-1;
      }
    }while(!grid[obstX][obstY].open)//prevents multiple blocks being placed on the same spot
    grid[obstX][obstY] = {open: false, type: "block"};
    //array search methods failed, possilby due to size of roads
    roads.splice(roads.findIndex((cell, index) => {if(cell.x === obstX && cell.y === obstY) return index}), 1);
  }
  
  var home = roads[0];
  roads.forEach(function(roadCell){
    if(!cellsConnected(roadCell.x, roadCell.y, home.x, home.y)){
      var d = 2*gridSize;
      var dx;
      var dy;
      var newCell;
      grid.forEach(function(column, x){
        column.forEach(function(cell, y){
          dx = roadCell.x-x;
          dy = roadCell.y-y;
          if(cell.type === "block" && Math.abs(dx)+Math.abs(dy) < d){
            d=Math.abs(dx)+Math.abs(dy);
            newCell = {x: x, y: y};
          }
        });
      });
      grid[newCell.x][newCell.y] = {open: true, type: "road"};
      roads.push(newCell);
    }
  });
}

function windowResized(){
  resizeCanvas(smallDim(), smallDim());
  orientButtons();
}

/**
 * finds the small dimension of the window
 * @returns 99% of the lesser dimension (reduced to remove scroll bar)
 */
function smallDim(){
  if(window.innerHeight < window.innerWidth){
    return window.innerHeight*0.99;
  }
  else{
    return window.innerWidth*0.99;
  }
}

/**Resizes and centers test buttons based on window size */
function orientButtons(){
  var button1 = document.getElementById("test1");
  var button2 = document.getElementById("test2");
  button1.style.width = smallDim()/3.75;
  button1.style.height = smallDim()/10;
  button1.style.position = "absolute";
  button1.style.left = window.innerWidth/2;
  button1.style.top = "45%";
  button1.style.fontSize = smallDim()/20+'px';
  button2.style.width = smallDim()/2;
  button2.style.height = smallDim()/10;
  button2.style.position = "absolute";
  button2.style.left = window.innerWidth/2;
  button2.style.top = "55%";
  button2.style.fontSize = smallDim()/20+'px';
}

/**
 * Generates random number from max to min
 * @param {number} min The minimum number in the range of possible return values (inclusive)
 * @param {number} max The maximum number in the range of possible return values (not inclusive)
 * @returns A random interger between max and min
 */
function rand(min, max){
  return Math.floor(Math.random() * (max-min) +min);
}

/**
 * Checks if cell at (x, y) is open for a car at the moment
 * @param x {number} The x coordinate of the cell to check
 * @param y {number} The y coordinate of the cell to check
 * @returns Whether a car can be placed on or move through the specified cell
 */
function gridCellOpen(x, y){
  
}

/**Prints grid to the console:
 *  "--"=car, "X."=passenger+destination, "P."=passenger, "D."=destination, "[]"=obstacle, "  "=open cell
 */
function logGrid(){
  for(var y = 0; y < gridSize; y++){
    var row = "";
    for(var x = 0; x < gridSize; x++){
      if(grid[x][y].open){
        if(carAt(x, y).length){
          row += "--"
        }
        else if(passAt(x, y, true) && passAt(x, y, false)){
          row += "X."
        }
        else if(passAt(x, y, true)){
          row += "P."
        }
        else if(passAt(x, y, false)){
          row += "D."
        }
        else{
          row += "  ";
        }
      }
      else{
        row += "[]";
      }
    }
    console.log(row);
  }
}

/**Places cars
 * @param {boolean} inDraw Whether or not the function is being called in the draw loop
 */
function generateCars(inDraw){
  var openRoads = roads;
  for(var i = 0; i < carCt; i++){
    var cell;
    do{
      cell = openRoads[rand(0, openRoads.length)];
      openRoads.splice(cell, 1);
    }while(!grid[cell.x][cell.y].open)
    var car = new Car(cell.x, cell.y, i, inDraw);
    cars.push(car);
  }
}

/**Checks which car if any is at the specified coordinates
 * @param {number} x The x coordinate to check
 * @param {number} y The y coordinate to check
 * @returns {number} The index of the found car in the cars array, or -1 if no car is found
 */
function carAt(x, y){
  return cars.filter(car => {return car.x === x && car.y === y});
}

/**Finds the passenger with a home or destination located at the specified coordinates
 * @param {number} x The x coordinate to check
 * @param {number} y The y coordinate to check
 * @param {boolean} home Whether the coordinates are the passenger's home: if false they are the passenger's destination
 * @returns {number|object} The found passenger, or if none are found, -1
*/
function passAt(x, y, home){
  return passengers.find(passenger => {if((home && passenger.homeX === x && passenger.homeY === y) || (!home && passenger.destX === x && passenger.destY === y)) return passenger});
}

/** */
function generatePassengers(){
  /**The roads that are open for passengers*/
  var openForPass = roads;
  /**The roads that are open for passenger destinations */
  var openForDest = roads;
  while(passengers.length < carCt && passengers.length+deliveryCt < passCt){
    var home;
    homePicker:
    while(true){
      home = openForPass[rand(0, openForPass.length)];
      var cars = carAt(home.x, home.y);
      if(cars.some(car => {return car.passenger !== null})){
        openForPass.splice(openForPass.findIndex(cell => {return cell.x === home.x && cell.y === home.y}), 1);
      }
      else{
        break homePicker;
      }
    }
    var dest;
    do{
      dest = roads[rand(0, roads.length)];
    }while(Math.abs(home.x - dest.x)+Math.abs(home.y - dest.y)<5)
    passengers.push(new Passenger(home.x, home.y, dest.x, dest.y, passengers.length+deliveryCt));
  }
}

/**Checks if one cell is reachable from another
 * @param {number} x1 The x coordinate of the first cell
 * @param {number} y1 The y coordinate of the first cell
 * @param {number} x2 The x coordinate of the second cell
 * @param {number} y2 The y coordinate of the second cell
 * @returns {boolean} Whether the specified cells are connected
 */
function cellsConnected(x1, y1, x2, y2){
  if((x1 === x2 && y1 === y2) || !(grid[x1][y1].open && grid[x2][y2].open)){
    return true;
  }
  var que = [{x: x1, y: y1, i: 0}];
  var found = false;
  var i = 0;
  do{
    i++;
    que.forEach(function(cell){
      var cells = adjacent(cell.x, cell.y);
      cells.forEach(function(res){
        var next = {x: res.x, y: res.y, i: i}
        if(next.x === x2 && next.y === y2){
          found = true;
          return;
        }
        if(grid[next.x][next.y].open && !que.some(p => {return p.x === next.x && p.y === next.y})){
          que.push(next);
        }
      })
    })
    if(found){
      return true;
    }
  }while(que.find(element => {if(element.i === i) return element}));
  return false;
}

/**Finds the coordinates of the 4 cells adjacent to the cell at the specified coordinates
 * @param {number} x The x coordinate to check
 * @param {number} y The y coordinate to check
 * @returns {array} An array of the surrounding cells as {x: x, y: y}
*/
function adjacent(x, y){
  return [{x:x+1, y:y}, {x:x, y:y+1}, {x:x-1, y:y}, {x:x, y:y-1}];
}