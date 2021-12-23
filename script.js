/**Whether the graphic test has started */
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
var gridSize = 11;
/**The number of blocks/obstacles to place on roads*/
var obstCt = 20;
/**The number of cars/agent to create */
var carCt = 4;
/**Then number of passengers that must be delivered */
var passCt = 80;

//Runtime variables
/**The number of passengers that have been delivered*/
var deliveryCt = 0;
/**The length of a cell */
var cellSize;
/**How many frames per timestep */
var stepSize = 20;
/**Timesteps elapsed during execution time*/
var timestep = 0;
/**Total timestep cost of all agents paths/actions */
var totalCost = 0;

/**An autonomous vehicle agent
 * @typedef {Object} Car
 * @property {number} x The x coordinate of this car
 * @property {number} y The y coordinate of this car
 * @property {number} id The index of this car in cars, used to identify this car
 * @property {Passenger} passenger The passenger this car is assigned to
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

  /**Finds the shortest path using the cells explored on dispatch, or explores new cells and finds the shortest path*/
  pathfind(){
    //if passenger has been received
    console.log("started pathfinding");
    /**The destination of the path*/
    var dest = (this.passenger.status === 1 ? {x: this.passenger.homeX, y: this.passenger.homeY} : {x: this.passenger.destX, y: this.passenger.destY});
    //add current position to que
    this.que = [{x: this.x, y: this.y, i: 0, direction: {x: 0, y: 0}}];
    /**Number of timesteps from now*/
    var i = 0;
    /**Whether a path to the destination has been found */
    var found = this.x === dest.x && this.y === dest.y;
    while(!found){
      i++;
      //iterate over all cells from the last timestep checked
      var filtered = this.que.filter(filterCell => {return filterCell.i === i-1});
      filtered.forEach(function(cell){
        var cells = adjacent(cell.x, cell.y);
        //iterate over adjacent cells
        cells.forEach(function(res){
          /**Next cell to be checked*/
          var next = {x: res.x, y: res.y, i: i, direction: {x: res.x-cell.x, y: res.y-cell.y}};
          //if open and unexplored
          if(grid[next.x][next.y].open && !this.que.some(p => {return p.x === next.x && p.y === next.y})){
            var statusOffset;
            /**Agents planned to be at same location as this at same timestep */
            var conflict = cars.find(nextCar => {
              //agents that have already been processed this timestep will have already set their positions to their next planned positions, but to find the next position of one that hasn't been processed, the index to search must be incremented
              statusOffset = (nextCar.passenger && nextCar.passenger.id > this.passenger.id ? 1 : 0);
              if(nextCar.id !== this.id && nextCar.path.some(nextCell => {
                var nextI = nextCell.i - nextCar.status + statusOffset;
                //same position, AND same timestep OR (timestep difference 1 AND final timestep): final timstep in path means that next timestep the car will be parked to let a passenger on or off
                return nextCell.x === next.x && nextCell.y === next.y && (nextI === next.i || (nextI+1 === next.i && nextI === nextCar.path.length-1));
              })) return nextCar
            });
            //if there is a conflict
            if(conflict){
              /**Direction the conflicting agent is traveling at the time of conflict*/
              var conflictDirection = conflict.path.find(nextCell => {
                var nextI = nextCell.i - conflict.status + statusOffset;
                if(nextCell.x === next.x && nextCell.y === next.y && (nextI === next.i || (nextI+1 === next.i && nextI === conflict.path.length-1))) return nextCell;
              }).direction;
              //if one vector is a nonzero opposite and the other is zero
              if(!((conflictDirection.x && conflictDirection.x === -next.direction.x && !conflictDirection.y) || (conflictDirection.y && conflictDirection.y === -next.direction.y && !conflictDirection.x))){
                console.log("conflict found");
                //console.table(conflict.path);
                //console.log(conflict.status, next);
                //add last cell to que again
                console.log(cell)
                this.que.push({x: cell.x, y: cell.y, i: i, direction: cell.direction});
              }
              else if(!found){
                this.que.push(next);
                console.log(next);
                //checks if this car has been found yet
                found = next.x === dest.x && next.y === dest.y;
              }
            }
            else if(!found){
              this.que.push(next);
              console.log(next);
              found = next.x === dest.x && next.y === dest.y;
            }
          }
          if(found){
            return;
          }
        }, this);
        if(found){
          return;
        }
      }, this);
    }
    //console.table(this.que);
    //start path with last element of que (the position of this car)
    this.path = [this.que.find(cell => {if(cell.x === dest.x && cell.y === dest.y) return cell})];
    var i = this.path[0].i;
    //iterate backwards through cells in que
    for(var ii = i-1; ii >= 0; ii--){
      var lastCell = this.path[-ii+i-1];
      //find the cell at the specified timestep that is adjacent to or in the same spot as the last cell
      var cell = this.que.find(nextCell => {if(nextCell.i === ii && (adjacent(nextCell.x, nextCell.y).find(adj => {if(adj.x === lastCell.x && adj.y === lastCell.y) return adj}) || (nextCell.x === lastCell.x && nextCell.y === lastCell.y))) return nextCell});
      this.path.push(cell);
    }
    this.path.reverse();
    if(this.sprite){
      var firstCell = this.path.find(cell => {if(!(cell.x === this.x && cell.y === this.y)) return cell});
      if(firstCell){
        this.sprite.pointTo(firstCell.x*cellSize+cellSize/2, firstCell.y*cellSize+cellSize/2);
      }
    }
    this.status = -1;
    //console.table(this.path);
    //console.log("path found");
  }
}

/**A passenger objective
 * @typedef Passenger
 * @property {number} homeX The x coordinate of this passenger's starting position
 * @property {number} homeY The y coordinate of this passenger's starting position
 * @property {number} destX The x coordinate of this passenger's final destination
 * @property {number} destY The y coordinate of this passenger's final destination
 * @property {number} id An identification number
 * @property {number} status What stage of transit the passenger is in: 0 = waiting for a car to be dispatched, 1 = waiting for car to arrive, 2 = traveling
 * @property {Car} car The car assigned to this passenger
 */
class Passenger{
  /**Makes a new passenger
   * @param {number} homeX The x coordinate of this passenger's initial position
   * @param {number} homeY The y coordinate of this passenger's initial position
   * @param {number} destX The x coordinate of this passenger's final destination
   * @param {number} destY The y coordinate of this passenger's final destination
   * @param {number} id The identification number of this passenger: the first passenger created has an id of 0, the second created has an id of 1, the third is 2, etc. 
   */
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
    if(frameCount % stepSize === 0){
      generatePassengers();
      doDrive();
    }
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
              if(car.path.length - car.status > 1){
                var next = car.path[car.status+1];
                var current = car.path[car.status];
                car.x = next.x;
                car.y = next.y;
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
  text(instructions, 25, 50, 925, 400);
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
  var passengersDelivered = [];
  passengers.forEach(function(passenger){
    if(!passenger.car){
      //console.log("car needed")
      dispatch(passenger);
    }
    var car = passenger.car
    if(!car.path.length){
      car.pathfind();
    }
    car.status++;
    //TODO give priority to car in front instead of first checked
    if(car.path.length - car.status > 1){
      var next = car.path[car.status+1];
      var current = car.path[car.status];
      car.sprite.setVelocity((next.x - current.x)*cellSize/stepSize, (next.y - current.y)*cellSize/stepSize);
      if(!(car.x === next.x && car.y === next.y)){
        car.sprite.pointTo(next.x*cellSize + cellSize/2, next.y*cellSize + cellSize/2);
        car.x = next.x;
        car.y = next.y;
      }
    }
    else{
      car.sprite.setVelocity(0, 0);
      if(passenger.status === 1){
        passenger.status = 2;
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
  if(frameCount % (stepSize*10) === 0 && deliveryCt === passCt){
    grid = [[]];
    testStart = false;
    document.getElementById("test1").style.display = "block";
    document.getElementById("test2").style.display = "block";
  }  
}

function dispatch(passenger){
  var que = [{x: passenger.homeX, y: passenger.homeY, i: 0}];
  var i = 0;
  var car = carAt(passenger.homeX, passenger.homeY).find(nextCar => {if(!nextCar.passenger) return nextCar});
  console.log("started searching for car");
  while(!car){
    i++;
    var filtered = que.filter(filterCell => {return filterCell.i === i-1});
    //console.log(que, filtered);
    filtered.forEach(function(cell){
      var cells = adjacent(cell.x, cell.y);
      //console.log(cell, cells);
      cells.forEach(function(res){
        var next = {x: res.x, y: res.y, i: i};
        if(grid[next.x][next.y].open && !que.some(p => {return p.x === next.x && p.y === next.y}) && !car){
          que.push(next);
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
  console.log(`dispatched car ${car.id} to passenger ${passenger.id}`);
  car.passenger = passenger;
  car.status = -1;
  passenger.car = car;
  passenger.status = 1;
}

/**Generates environment grid*/
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

//event that triggers when the window is resized
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

/**Generates passengers as agents become available */
function generatePassengers(){
  /**The roads that are open for passengers*/
  var openForPass = roads;
  //console.log(openForPass.length);
  /**The roads that are open for passenger destinations */
  var openForDest = roads;
  while(passengers.length < carCt && passengers.length+deliveryCt < passCt){
    console.log("generating passenger");
    var home;
    homePicker:
    while(true){
      home = openForPass[rand(0, openForPass.length)];
      var cars = carAt(home.x, home.y);
      if(cars.some(car => {return car.passenger !== null})){
        openForPass.splice(openForPass.findIndex(cell => {return cell.x === home.x && cell.y === home.y}), 1);
      }
      else{
        console.log("home found");
        break homePicker;
      }
    }
    var dest;
    do{
      dest = roads[rand(0, roads.length)];
    }while(Math.abs(home.x - dest.x)+Math.abs(home.y - dest.y)<5)
    passengers.push(new Passenger(home.x, home.y, dest.x, dest.y, passengers.length+deliveryCt));
    console.log("passenger generated")
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