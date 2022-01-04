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
var gridSize = 17;
/**The number of blocks/obstacles to place on roads*/
var obstCt = 50;
/**The number of cars/agent to create */
var carCt = 30;
/**Then number of passengers that must be delivered */
var passCt = 60;

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
/**Current timestamp to be used to find elapsed time */
var time;

/**Which prototype to test: Control Test 0, Design 1, Design 2 */
var design = 1;

/**An autonomous vehicle agent
 * @typedef {Object} Car
 * @property {number} x The x coordinate of this car
 * @property {number} y The y coordinate of this car
 * @property {number} id The index of this car in cars, used to identify this car
 * @property {Passenger} passenger The passenger this car is assigned to
 * @property {Object[]} queue The cells with cost i that this car is considering for paths
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
    this.queue = [];
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

  /**Control - Finds the shortest path to a destination not accounting for conflicts */
  pathfind0(){
    /**The destination of the path: either the passenger or their destination depending on whether the passenger has been received*/
    var dest = (this.passenger.status === 1 ? {x: this.passenger.homeX, y: this.passenger.homeY} : {x: this.passenger.destX, y: this.passenger.destY});
    //add destination to queue
    this.queue = [{x: dest.x, y: dest.y, i: 0, direction: {x: 0, y: 0}}];
    /**Number of timesteps from now*/
    var i = 0;
    /**Whether a path has been found*/
    var found = this.x === dest.x && this.y === dest.y;
    while(!found){
      i++;
      //iterate over all cells from the last timestep checked
      var filtered = this.queue.filter(filterCell => {return filterCell.i === i-1});
      filtered.forEach(function(cell){
        var cells = adjacent(cell.x, cell.y);
        //iterate over adjacent cells
        cells.forEach(function(res){
          /**Next cell to be checked*/
          var next = {x: res.x, y: res.y, i: i, direction: {x: res.x-cell.x, y: res.y-cell.y}};
          //if open and unexplored
          if(grid[next.x][next.y].open && !this.queue.some(p => {return p.x === next.x && p.y === next.y}) && !found){
            this.queue.push(next);
            //check if this car has been found
            found = next.x === this.x && next.y === this.y;
          }
        }, this);
      }, this);
    }
    //start path with last element of queue (the position of this car)
    this.path = [this.queue.find(cell => {if(cell.x === this.x && cell.y === this.y) return cell})];
    //iterate backwards over queue
    for(var ii = i-1; ii >= 0; ii--){
      //cell at current step adjacent to cell from last step
      var cell = this.queue.find(nextCell => {if(nextCell.i === ii && adjacent(nextCell.x, nextCell.y).some(adj => {return adj.x === this.path[-ii+i-1].x && adj.y === this.path[-ii+i-1].y})) return nextCell});
      this.path.push(cell);      
    }
    if(this.sprite && this.path.length > 1){
      this.sprite.pointTo(this.path[1].x*cellSize+cellSize/2, this.path[1].y*cellSize+cellSize/2);
    }
    this.status = -1;
  }

  /**Designs 1 & 2 - Finds the shortest path to a destination accounting for conflicts*/
  pathfind1(){
    //console.log("started pathfinding");
    /**The destination of the path: either the passenger or their destination depending on whether the passenger has been received*/
    var dest = (this.passenger.status === 1 ? {x: this.passenger.homeX, y: this.passenger.homeY} : {x: this.passenger.destX, y: this.passenger.destY});
    //add current position to queue
    this.queue = [{x: this.x, y: this.y, i: 0, direction: {x: 0, y: 0}}];
    /**Number of timesteps from now*/
    var i = 0;
    /**Whether a path to the destination has been found */
    var found = this.x === dest.x && this.y === dest.y;
    while(!found){
      i++;
      //iterate over all cells from the last timestep checked
      var filtered = this.queue.filter(filterCell => {return filterCell.i === i-1});
      filtered.forEach(function(cell){
        var cells = adjacent(cell.x, cell.y);
        //iterate over adjacent cells
        cells.forEach(function(res){
          /**Next cell to be checked*/
          var next = {x: res.x, y: res.y, i: i, direction: {x: res.x-cell.x, y: res.y-cell.y}};
          //if open and unexplored
          if(grid[next.x][next.y].open && !this.queue.some(p => {return p.x === next.x && p.y === next.y})){
            var statusOffset;
            /**Agents planned to be at same location as this at same timestep */
            var conflict = cars.find(nextCar => {
              //agents that have already been processed this timestep will have already set their positions to their next planned positions, but to find the next position of one that hasn't been processed, the index to search must be incremented
              //The design check is because, for design 1, agents are processed in order by passenger, but in design 2 they are processed by agent
              statusOffset = (design === 1 ? (nextCar.passenger && nextCar.passenger.id > this.passenger.id ? 1 : 0) : (nextCar.id > this.id ? 1 : 0));
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
                //console.log("conflict found");
                //console.table(conflict.path);
                //console.log(conflict.status, next);
                //console.log(cell)
                //add last cell to queue again
                this.queue.push({x: cell.x, y: cell.y, i: i, direction: cell.direction});
              }
              else if(!found){
                this.queue.push(next);
                //console.log(next);
                //checks if the destination has been found yet
                found = next.x === dest.x && next.y === dest.y;
              }
            }
            else if(!found){
              this.queue.push(next);
              //console.log(next);
              found = next.x === dest.x && next.y === dest.y;
            }
          }
        }, this);
      }, this);
    }
    //console.table(this.queue);
    //start path with last element of queue (the destination)
    this.path = [this.queue.find(cell => {if(cell.x === dest.x && cell.y === dest.y) return cell})];
    var i = this.path[0].i;
    //iterate backwards through cells in queue
    for(var ii = i-1; ii >= 0; ii--){
      var lastCell = this.path[-ii+i-1];
      //find the cell at the specified timestep that is adjacent to or in the same spot as the last cell
      var cell = this.queue.find(nextCell => {if(nextCell.i === ii && (adjacent(nextCell.x, nextCell.y).find(adj => {if(adj.x === lastCell.x && adj.y === lastCell.y) return adj}) || (nextCell.x === lastCell.x && nextCell.y === lastCell.y))) return nextCell});
      this.path.push(cell);
    }
    //reverse path so index corresponds to status directly rather than inversely
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

//called before draw loop
function setup(){
  //set up canvas
  createCanvas(smallDim(), smallDim());
  orientButtons();
  camera.on();
  camera.position.x = 500;
  camera.position.y = 500;
}

//p5 draw loop: at default framerate called 30 times per second
function draw(){
  background("green");
  if(testStart){
    if(frameCount % stepSize === 0){
      generatePassengers();
      switch(design){
        case 0:
          doDrive0();
          break;
        case 1:
          doDrive1();
          break;
        case 2:
          doDrive2();
      }
      //short delay after test completion to allow other functions to completely resolve
      if(frameCount % (stepSize*10) === 0 && deliveryCt === passCt){
        grid = [[]];
        testStart = false;
        document.getElementById("test1").style.display = "block";
        document.getElementById("test2").style.display = "block";
      }
    }  
  }
  else{
    renderInstructions();
  }
  renderGrid();
  camera.zoom = smallDim()/1000;
  drawSprites();
}

/**Do single graphic test */
function test1(){
  document.getElementById("test1").style.display = "none";
  document.getElementById("test2").style.display = "none";
  setupGrid();
  generateCars(true);
  testStart = true;
}

/**Do multiple tests to collect quantitative data */
function test2(){
  instructions = "Tests Complete: Open Console For Results";
  time = new Date().getTime();
  doTests();
}

/**Loop to perform multiple tests in each combination of environment settings */
function doTests(){
  obstCt = 50;
  //loop by incrementing environment settings
  //use gridSize as a multiplier for other settings so that agent density remains relatively proportional
  for(var g = 1; g <= 2; g++){
    for(carCt = 20*g; carCt <= 40*g; carCt += 10*g){
      for(passCt = 60*g; passCt <= 80*g; passCt += 20*g){
        gridSize = g*16+1
        timestepArr = [];
        totalCostArr = [];
        for(var test = 0; test < 500; test++){
          setupGrid();
          generateCars(false);
          deliveryCt = 0;
          timestep = 0;
          totalCost = 0;
          //logGrid();
          while(deliveryCt < passCt){
            timestep++;
            generatePassengers();
            switch(design){
              case 0:
                doDrive0();
                break;
              case 1:
                doDrive1();
                break;
              case 2:
                doDrive2();
            }
          }
          //get the current time before using it to calculate the elapsed time
          var newTime = new Date().getTime();
          console.log(newTime-time + " ms: test "+test);
          timestepArr.push(timestep);
          totalCostArr.push(totalCost);
        }
        //after each combination of settings, log the data
        console.log(`Set Complete:
  No. of Agents: ${carCt}
  No. of Passengers: ${passCt}
  Grid Side Length: ${(gridSize-1)/2} vertices
  Time: ${newTime-time} ms`);
        time = newTime;
        console.log("Overall Solution Efficiency:");
        console.table(timestepArr);
        console.log("Total Individual Solution Efficiency");
        console.table(totalCostArr);
      }
      console.log("2 sets complete");
    }
    console.log("6 sets complete");
    obstCt = 200;
  }
  console.log("all sets complete");
  passengers = [];
  grid = [[]];
  roads = [];
  cars = [];
}

/**Display intstruction on the canvas */
function renderInstructions(){
  textSize(50);
  textAlign(CENTER, CENTER);
  text(instructions, 25, 50, 925, 400);
}

/**Display the grid using geometric shapes*/
function renderGrid(){
  //cellSize = actual side length of grid / side length of grid in cells
  cellSize = 1000/gridSize
  noStroke();
  //iterate over grid
  grid.forEach(function(column, x){
    column.forEach(function(cell, y){
      if(cell.open){
        fill("grey");
        rect(cellSize*x, cellSize*y, cellSize);
        //if there's a passenger waiting here
        var passHome = passAt(x, y, true).find(pass => {if(pass.status<2) return pass});
        if(passHome){
          //green = unassgined, blue = assigned to car
          fill("lime");
          if(passHome.car){
            fill("blue")
          }
          ellipse(cellSize*x+cellSize/2, cellSize*y+cellSize/2, cellSize/2);
        }
        //if there is a passenger's destination here
        var passDest = passAt(x, y, false);
        if(passDest.length){
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

/**Do control test */
function doDrive0(){
  /**The ID's of passengers that have been delivered, stored separately to avoid modifying the passengers array while iterating over it */
  var passengersDelivered = [];
  passengers.forEach(function(passenger){
    //Unless a car has already been dispatched to this passenger
    if(!passenger.car){
      dispatch(passenger);
    }
    var car = passenger.car;
    //if the car has not yet planned a path
    if(!car.path.length){
      car.pathfind0();
    }
    //set the next step in path to be processed
    car.status++;
    //if car is active and was not created in draw loop
    if(car.countSteps){
      //Increment the cost tracker
      totalCost++;
    }
    //if the end of the path has not been reached
    if(car.path.length - car.status > 1){
      /**Next cell in path of conflicting car */
      var nextCell;
      /**Next cell in path of car*/
      var thisCell = car.path[car.status+1];
      /**Conflicting agent */
      var conflict = cars.find(nextCar => {
        //if nextCar has a passenger AND its passenger was created before car's AND nextCar has not reached the end of its path
        if(nextCar.passenger && nextCar.passenger.id < passenger.id &&nextCar.path.length - nextCar.status > 1){
          nextCell = nextCar.path[nextCar.status+1];
        }
        //if the next cell exists and is in the same spot as thisCell
        if(nextCell && nextCell.x === thisCell.x && nextCell.y === thisCell.y){
          return nextCar;
        }
      });
      //if there is a conflict AND it is NOT traveling in the opposite direction
      if(conflict && !((thisCell.direction.x && thisCell.direction.x === -nextCell.direction.x && !thisCell.direction.y) || (thisCell.direction.y && thisCell.direction.y === -nextCell.direction.y && !thisCell.direction.x))){
        //go back a step
        car.status--;
        //stop sprite movement
        if(car.sprite){
          car.sprite.setVelocity(0, 0);
        }
        //would resolve new conflicts here
      }
      else{
        /**Next cell in path */
        var next = car.path[car.status+1];
        /**Current position */
        var current = car.path[car.status];
        car.x = next.x;
        car.y = next.y;
        if(car.sprite){
          car.sprite.setVelocity((next.x - current.x)*cellSize/stepSize, (next.y - current.y)*cellSize/stepSize);
          car.sprite.pointTo(next.x*cellSize + cellSize/2, next.y*cellSize + cellSize/2);
        }
      }
    }
    else{
      if(car.sprite){
        car.sprite.setVelocity(0, 0);
      }
      //if the passenger was just reached
      if(passenger.status === 1){
        //get ready to pathfind to passenger destination
        passenger.status = 2;
        car.queue = [];
        car.path = [];
        if(car.sprite){
          car.sprite.draw = function(){
            noStroke();
            fill("white");
            rect(0, cellSize/4, cellSize/2, cellSize/4);
            fill("blue");
            ellipse(0, cellSize/4, cellSize/4);
          }
        }
      }
      //if the passenger destination was just reached
      else{
        //deliver passenger
        deliveryCt++;
        passengersDelivered.push(passenger.id);
        car.passenger = null;
        //if there are no more passengers to deliver
        if(deliveryCt + passengers.length >= passCt){
          if(car.sprite){
            car.sprite.remove();
          }
          if(car.countSteps){
            car.countSteps = false;
          }
        }
        else{
          car.queue = [];
          car.path = [];
          if(car.sprite){
            car.sprite.draw = function(){
              noStroke();
              fill("white");
              rect(0, cellSize/4, cellSize/2, cellSize/4);
            }
          }
        }
      }
    }
  });
  //remove delivered passengers from array
  passengersDelivered.forEach(function(passID){
    passengers.splice(passengers.findIndex(pass => {return pass.id === passID}), 1);
  });
}

/**Test Design 1 */
function doDrive1(){
  /**The ID's of passengers that have been delivered, stored separately to avoid modifying the passengers array while iterating over it */
  var passengersDelivered = [];
  passengers.forEach(function(passenger){
    //Unless a car has already been dispatched to this passenger
    if(!passenger.car){
      //console.log("car needed")
      dispatch(passenger);
    }
    var car = passenger.car
    //If the car does not already have a planned path
    if(!car.path.length){
      car.pathfind1();
    }
    car.status++;
    //Won't execute if countSteps is false (car is no longer active) or otherwise falsy (undefined because function is being called in draw loop)
    if(car.countSteps){
      //Increment the cost tracker
      totalCost++;
    }
    //Unless the destination has been reached
    if(car.path.length - car.status > 1){
      /**Next cell in path */
      var next = car.path[car.status+1];
      /**Current position */
      var current = car.path[car.status];
      //go to next cell in path
      if(car.sprite){
        car.sprite.setVelocity((next.x - current.x)*cellSize/stepSize, (next.y - current.y)*cellSize/stepSize);
        if(!(car.x === next.x && car.y === next.y)){
          car.sprite.pointTo(next.x*cellSize + cellSize/2, next.y*cellSize + cellSize/2);
        }
      }
      car.x = next.x;
      car.y = next.y;
    }
    else{
      if(car.sprite){
        car.sprite.setVelocity(0, 0);
      }
      //if the passenger was just reached
      if(passenger.status === 1){
        //get ready to pathfind to passenger destination
        passenger.status = 2;
        car.queue = [];
        car.path = [];
        if(car.sprite){
          car.sprite.draw = function(){
            noStroke();
            fill("white");
            rect(0, cellSize/4, cellSize/2, cellSize/4);
            fill("blue");
            ellipse(0, cellSize/4, cellSize/4);
          }
        }
      }
      //if the passenger destination was just reached
      else{
        //deliver passenger
        deliveryCt++;
        passengersDelivered.push(passenger.id);
        car.passenger = null;
        //if there are no more passengers to deliver
        if(deliveryCt + passengers.length >= passCt){
          if(car.sprite){
            car.sprite.remove();
          }
          if(car.countSteps){
            car.countSteps = false;
          }
        }
        else{
          car.queue = [];
          car.path = [];
          if(car.sprite){
            car.sprite.draw = function(){
              noStroke();
              fill("white");
              rect(0, cellSize/4, cellSize/2, cellSize/4);
            }
          }
        }
      }
    }
  });
  //remove delivered passengers
  passengersDelivered.forEach(function(passID){
    passengers.splice(passengers.findIndex(pass => {return pass.id === passID}), 1);
  });
}

/**Test Design 2 */
function doDrive2(){
  //iterate over cars instead of passengers
  cars.forEach(function(car){
    //if car has not been assigned a passenger and there are still passengers that need assignment
    if(!car.passenger && deliveryCt + passengers.filter(pass => {return pass.car !== null}).length < passCt){
      dispatch2(car);
    }
    /**passenger that car was dispatched to*/
    var passenger = car.passenger;
    //if car was dispatched
    if(passenger){
      //if car does NOT have a path
      if(!car.path.length){
        car.pathfind1();
      }
      car.status++;
      //if car is active and was not created in draw loop
      if(car.countSteps){
        totalCost++;
      }
      //if car hasn't reached the end of its path
      if(car.path.length - car.status > 1){
        /**Next cell in path */
        var next = car.path[car.status+1];
        /**Current position */
        var current = car.path[car.status];
        if(car.sprite){
          car.sprite.setVelocity((next.x - current.x)*cellSize/stepSize, (next.y - current.y)*cellSize/stepSize);
          if(!(car.x === next.x && car.y === next.y)){
            car.sprite.pointTo(next.x*cellSize + cellSize/2, next.y*cellSize + cellSize/2);
          }
        }
        car.x = next.x
        car.y = next.y;
      }
      else{
        if(car.sprite){
          car.sprite.setVelocity(0, 0);
        }
        if(passenger.status === 1){
          //Pick up passenger
          passenger.status = 2;
          car.queue = [];
          car.path = [];
          if(car.sprite){
            car.sprite.draw = function(){
              noStroke();
              fill("white");
              rect(0, cellSize/4, cellSize/2, cellSize/4);
              fill("blue");
              ellipse(0, cellSize/4, cellSize/4);
            }
          }
        }
        else{
          //Deliver passenger
          //console.log("passenger delivered by agent "+car.id)
          deliveryCt++;
          passengers.splice(passengers.findIndex(pass => {return pass.id === passenger.id}), 1);
          car.passenger = null;
          if(deliveryCt + passengers.length >= passCt){
            if(car.sprite){
              car.sprite.remove();
              car.sprite = null;
            }
            if(car.countSteps){
              //console.log("deactivated agent "+car.id)
              car.countSteps = false;
            }
          }
          else{
            car.queue = [];
            car.path = [];
            if(car.sprite){
              car.sprite.draw = function(){
                noStroke();
                fill("white");
                rect(0, cellSize/4, cellSize/2, cellSize/4);
              }
            }
          }
        }
      }
    }
  });
}

/**Dispatches the closest unassigned car to the specified passenger
 * @param {Passenger} passenger The passenger that needs to be picked up
 */
function dispatch(passenger){
  var queue = [{x: passenger.homeX, y: passenger.homeY, i: 0}];
  var i = 0;
  var car = carAt(passenger.homeX, passenger.homeY).find(nextCar => {if(!nextCar.passenger) return nextCar});
  //console.log("started searching for car");
  //pathfind to closest car
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
          //check if there is an unassigned car here
          car = carAt(next.x, next.y).find(nextCar => {if(!nextCar.passenger) return nextCar});
        }
      });
    });
  }
  //console.log(car.x, car.y, passenger);
  //console.log(`dispatched car ${car.id} to passenger ${passenger.id}`);
  car.passenger = passenger;
  car.status = -1;
  passenger.car = car;
  passenger.status = 1;
}

/**Dispatches specified car to closest unassigned passenger
 * @param {Car} car The agent to dispatch
 */
function dispatch2(car){
  //console.log("started searching for car");
  var queue = [{x: car.x, y: car.y, i: 0}];
  var i = 0;
  var passenger = passAt(car.x, car.y, true).find(nextPass => {if(!nextPass.car) return nextPass});
  //pathfind to closest unassigned passenger
  while(!passenger){
    i++;
    var filtered = queue.filter(filterCell => {return filterCell.i === i-1});
    filtered.forEach(function(cell){
      var cells = adjacent(cell.x, cell.y);
      cells.forEach(function(res){
        var next = {x: res.x, y: res.y, i: i};
        if(grid[next.x][next.y].open && !queue.some(p => {return p.x === next.x && p.y === next.y}) && !passenger){
          queue.push(next);
          //check if there is an unassigned passenger here
          passenger = passAt(next.x, next.y, true).find(nextPass => {if(!nextPass.car) return nextPass});
        }
      });
    });
  }
  car.passenger = passenger;
  car.status = -1;
  passenger.car = car;
  passenger.status = 1;
  //console.log(`dispatched car ${car.id} to passenger ${passenger.id}`);
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
      //Ensures that block is placed on straight stretch of road (edge) rather than intersection (vertex) or grass
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
  /**First cell in roads */
  var home = roads[0];
  //check if each road cell is connected to home
  roads.forEach(function(roadCell){
    //if NOT connected
    if(!cellsConnected(roadCell.x, roadCell.y, home.x, home.y)){
      var d = 2*gridSize;
      var dx;
      var dy;
      var newCell;
      //find the closest obstacle and turn it into a road
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
        else if(passAt(x, y, true).length && passAt(x, y, false).length){
          row += "X."
        }
        else if(passAt(x, y, true).length){
          row += "P."
        }
        else if(passAt(x, y, false).length){
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
 * @returns {Passenger} An array of found passengers
*/
function passAt(x, y, home){
  return passengers.filter(passenger => {return (home && passenger.homeX === x && passenger.homeY === y) || (!home && passenger.destX === x && passenger.destY === y)});
}

/**Generates passengers as agents become available */
function generatePassengers(){
  /**The roads that are open for passengers*/
  var openForPass = roads;
  //console.log(openForPass.length);
  /**The roads that are open for passenger destinations */
  var openForDest = roads;
  while(passengers.length < carCt && passengers.length+deliveryCt < passCt){
    //console.log("generating passenger");
    var home;
    homePicker:
    while(true){
      home = openForPass[rand(0, openForPass.length)];
      var cars = carAt(home.x, home.y);
      if(cars.some(car => {return car.passenger !== null})){
        openForPass.splice(openForPass.findIndex(cell => {return cell.x === home.x && cell.y === home.y}), 1);
      }
      else{
        //console.log("home found");
        break homePicker;
      }
    }
    var dest;
    do{
      dest = roads[rand(0, roads.length)];
    }while(Math.abs(home.x - dest.x)+Math.abs(home.y - dest.y)<gridSize/3)
    passengers.push(new Passenger(home.x, home.y, dest.x, dest.y, passengers.length+deliveryCt));
    //console.log("passenger generated")
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
  //if boths cells are the same OR either is closed
  if((x1 === x2 && y1 === y2) || !(grid[x1][y1].open && grid[x2][y2].open)){
    return true;
  }
  var queue = [{x: x1, y: y1, i: 0}];
  var found = false;
  var i = 0;
  //continue pathfinding while new cells are still being explored
  do{
    i++;
    queue.forEach(function(cell){
      var cells = adjacent(cell.x, cell.y);
      cells.forEach(function(res){
        var next = {x: res.x, y: res.y, i: i}
        if(next.x === x2 && next.y === y2){
          found = true;
          return;
        }
        if(grid[next.x][next.y].open && !queue.some(p => {return p.x === next.x && p.y === next.y})){
          queue.push(next);
        }
      })
    })
    if(found){
      return true;
    }
  }while(queue.find(element => {if(element.i === i) return element}));
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