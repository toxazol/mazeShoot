//-----------------------------------------------------------------------------------------------------vars & constructors init
const pi = Math.PI;
const halfPi = pi/2;
const quarterPi = pi/4;
let canvas = document.getElementById("c");
let ctx = canvas.getContext("2d"); // dynamic

let canvas2 = document.getElementById("c2");
let ctx2 = canvas2.getContext("2d"); // static

let canvas3 = document.getElementById("c3");
let ctx3 = canvas3.getContext("2d"); // for debugging

//colors
canvas.style.backgroundColor = "#000"; //around maze fill
const floorCol = "#555";
const shadowCol = "#000"

let w = canvas.width = canvas2.width = canvas3.width = window.innerWidth;
let winHalfH = window.innerHeight/2;
let h = canvas.height = canvas2.height = canvas3.height = 2*window.innerHeight;

let PAUSE = false;
const tab = 90;
const eps = tab/18;
const halfTab = tab/2; 
const scale = tab/128;
const ws = scale; // wall scale
const vision = 300; // sight radius
const shadR = 10; // zombie shadow circle radius
const sqVision = vision*vision;
let segments = []; // for shadow casting
let shield = []; // no eyes on players back
let field = []; // for vfield generator

let width = ~~((w-tab*2)/tab); // maze size params
let height = ~~((h-tab*2)/tab);
let eye1,eye2;

let temp;
let s = {x:tab,y:tab}; // startPoint

let player = {
    i: 0,
    j: 0,
    x: s.x+halfTab,
    y: s.y+halfTab,
    step: 4,
    life: 3,
    shoots: false,
    HIT: null,
    hit(){
        let self = this;
        self.HIT = null;
        let minDist = Infinity;
        for(let i in bots){
            let target = Math.atan2(bots[i].y-self.y,bots[i].x-self.x);
            if(mod360(mod360(target)-mod360(dir.angle)) < pi/16 || mod360(mod360(dir.angle)-mod360(target)) < pi/16){
                let intersects = [];
                let ray = new dot(cursor.x-self.x, cursor.y-self.y);
                for (let seg of segments){
                    let dot = newSegRay(seg,ray,self);
                    if(dot) intersects.push({dot:dot,seg:seg});
                }
                if(intersects.length){
                    intersects.sort(function(a,b){return sqdist(a.dot,self)-sqdist(b.dot,self);});
                    let botDist = sqdist(bots[i],self);
                    if(sqdist(intersects[0].dot,self) > botDist && botDist < minDist){
                        self.HIT = i; 
                        minDist = botDist;
                    }
                }
            }
        }
    },
    gotHit(){
    	let self = this;
        for(let z of zombHit){
            if(z.j+z.speed >= z.mid && z.j <= z.mid){
            	self.life--;
            	return true; // punch frame (10th)
            } 
        }
        return false;
    },
    moves(){
        if(KEY.key87 || go.Rt<tab || go.Lt<tab || go.Dn<tab || go.Up<tab)
            return true;
        return false;
    },
};
function bot(i,j,x,y,dir=0,step=4){// default dir & step
    this.i = i;
    this.j = j;
    this.x = x;
    this.y = y;
    this.step = step;
    this.dir = dir;
    this.steps = [];
    this.angle = 0;
    this.dead = false;
    this.attacks = function (){
        let self = this;
        return field[self.i][self.j].dist <= 1;
    };
    this.rotSteps = function(){
        let self = this;
        let n = 10; // frames for rotation
        if(mod360(self.angle-dirToArc(self.dir))>1 && !self.steps.length){
            self.steps = [];
            let start = self.angle;
            let stop = dirToArc(self.dir);
            self.angle = stop;
            let inner = mod360(stop-start), outer = mod360(start-stop)
            if(inner < outer)
                for(let i=0; i<n; i++){
                    self.steps.push(start += inner/n)
                }
            else
                for(let i=0; i<n; i++){
                    self.steps.push(start -= outer/n)
                }
        }
    };
};
function tile(dist,dir){ // vector field units
    this.dist = dist;
    this.dir = dir;
};
let bot1 = new bot(0, width-1, s.x+(width-1)*tab+halfTab, s.y+halfTab);
let bot2 = new bot(height-1, 0, s.x+halfTab, s.y+(height-1)*tab+halfTab);
let bot3 = new bot(height-1, width-1, s.x+(width-1)*tab+halfTab, s.y+(height-1)*tab+halfTab);
let bots = [bot1,bot2,bot3];

let maze = []; // for storing rows
let row = [];  // for storing cells
let sets = new Array(width); //each set has 1 initial cell
function cell(lower, right, set){ // cell structure
	this.l = lower;  // right and lower walls
	this.r = right; // boolean parameters standing for 
	this.s = set; // number of set cell belongs to
};
function sprite (sptiteSheet, n, speed=1, scaler=1){
    let that = {};
    
    that.img = sptiteSheet;
    that.mid = ~~(n/2);
    that.speed = speed;
    that.width = sptiteSheet.width/n;
    that.height = sptiteSheet.height;
    that.w = that.width*scale*scaler;
    that.h = that.height*scale*scaler;
    that.halfW = that.w/2;
    that.halfH = that.h/2;
    that.i = 0;
    that.j = 0;
    that.inProgress = function(){
        return that.j > 0 && that.i < n;
    };
    that.terminated = function(){
        return that.i == n;
    };
    that.terminate = function(){
        that.i = 0;
        that.j = 0;
    };
    
    that.render = function (){
    	that.i %= n;
        ctx.drawImage(
            that.img,
            that.i*that.width,
            0,
            that.width,
            that.height,
            0,
            0,
            that.w,
            that.h
        );
        that.j += speed;
        that.i = ~~that.j;
        that.j %= n;
    };
    return that;
};
//sprite mechanism initializing
let walk, idle, shot, gotHit, death, zombWalk = [], zombIdle = [], zombHit = [], zombDeath = [];
let temp1 = new Image();
temp1.src = "sprites/player_walk.png";
temp1.onload = function(){walk = sprite(temp1, 12, 0.6);}
let temp3 = new Image();
temp3.src = "sprites/player_idle.png";
temp3.onload = function(){idle = sprite(temp3, 20, 0.7);}
let temp4 = new Image();
temp4.src = "sprites/zombie1_walk.png";
temp4.onload = function(){
    for(let i=0;i<3;i++)
        zombWalk[i] = sprite(temp4, 20,1.2);
}
let temp5 = new Image();
temp5.src = "sprites/zombie1_hit.png";
temp5.onload = function(){
    for(let i=0;i<3;i++)
        zombHit[i] = sprite(temp5, 20, 0.8);
}
let temp6 = new Image();
temp6.src = "sprites/player_shot.png";
temp6.onload = function(){shot = sprite(temp6, 20, 0.7);}
let temp7 = new Image();
temp7.src = "sprites/player_gotHit.png";
temp7.onload = function(){gotHit = sprite(temp7, 9, 0.5);}
let temp8 = new Image();
temp8.src = "sprites/zombie_death1.png";
temp8.onload = function(){
    for(let i=0;i<3;i++)
        zombDeath[i] = sprite(temp8, 19, 0.4);
}
let temp9 = new Image();
temp9.src = "sprites/player_death.png";
temp9.onload = function(){death = sprite(temp9, 27, 0.5);}
temp10 = new Image();
temp10.src = "sprites/zombie1_idle.png";
temp10.onload = function(){
    for(let i=0;i<3;i++)
        zombIdle[i] = sprite(temp10, 36, 0.8);
}
let floor = new Image();
floor.src = "sprites/floor.jpg";
let floorPat; 
floor.onload = function(){floorPat = ctx.createPattern(floor, 'repeat');};
let rw = new Image(); 
rw.src = "sprites/right_wall.jpg";
let lw = new Image();
lw.src = "sprites/lower_wall.jpg";
let heart = new Image();
heart.src = "sprites/heart.png";

let lasTdT = null;
let cursor={
  x: player.x,
  y: player.y,
};
function dot(x,y){
    this.x = x;
    this.y = y;
}
function segment(a,b){
    this.a = a;
    this.b = b;
    this.concat = function(seg){
    	let self = this;
    	self.b = seg.b;
    };
    this.prolongs = function(s){
    	let self = this;
    	if(epsEq(s.b.y, self.a.y) && epsEq(s.b.x, self.a.x)){
			if(epsEq(s.a.x, s.b.x))
				if(epsEq(self.a.x, self.b.x))
						return true;
			if(epsEq(s.a.y, s.b.y))
				if(epsEq(self.a.y, self.b.y))
						return true;	
		}
		return false;
	}
}
let go = {
    Dn : tab,
    Rt : tab,
    Lt : tab,
    Up : tab,
};
let dir = {
    update() {
        for (i in this){
            if(typeof(this[i])!='function')
                this[i] = null;
        }
        this.y = cursor.y - player.y;
        this.x = cursor.x - player.x;
        this.angle = Math.atan2(this.y,this.x);
        
        if(this.angle < quarterPi && this.angle > -quarterPi)
            this.right = true;
        else if(this.angle < 3*quarterPi && this.angle > quarterPi)
            this.down = true;
        else if(this.angle < -quarterPi && this.angle > -3*quarterPi)
            this.up = true;
        else if(this.angle < -3*quarterPi || this.angle > 3*quarterPi)
            this.left = true;
    }
};

//-----------------------------------------------------------------------------------------------------functions initialization
let obj = JSON.stringify;
function noBot(i,j){
	for(let bot of bots){
		if(bot.i==i && bot.j==j) return false;
	}
	return true;
}
function epsEq(a,b){
	return Math.abs(a-b) < eps;
}
function rectangle(a,b,c,d){ // use with spread ...
    let temp = [];
    temp.push(new segment(a,b));
    temp.push(new segment(b,c));
    temp.push(new segment(d,c));
    temp.push(new segment(a,d));
    return temp;
}
function notConsistsIn(arr,seg){ // works faster than array.some()
    for(i of arr){
        if(i.a==seg.a&&i.b==seg.b) return false;
    }
    return true;
}
let visibles = [];
function getVisibles(segments,player){
    visibles = [];
    let intersects = [];
    let start = dir.angle-quarterPi;
    let finish = dir.angle+quarterPi;
    for(let v=start;v<finish;v+=0.01){ // try different angle increment
        intersects = [];
        ray = new dot(Math.cos(v), Math.sin(v));
        for(seg of segments){
            let dot = newSegRay(seg,ray,player);
            if(dot) intersects.push({dot:dot,seg:seg});
        }
        if(intersects.length){
            intersects.sort((a,b)=>sqdist(a.dot,player)-sqdist(b.dot,player));
            //if(!visibles.some(o=>obj(o)==obj(intersects[0].seg)))
            if(notConsistsIn(visibles,intersects[0].seg))
            	visibles.push(intersects[0].seg);
        }
    }
}
function vecAngle(vec){
    return Math.atan2(vec.y,vec.x);
}
function between(a,x,b){
    if(x>a&&x<b || x>b&&x<a)return true;
    return false;
}
function newSegRay(seg,ray,s){
	if(epsEq(seg.a.x, seg.b.x)){
		let t = (seg.a.x-s.x)/ray.x;
		if(t > 0){
			let y = s.y+ray.y*t;
			if(between(seg.a.y,y,seg.b.y)){
	    		return {x:seg.a.x, y:y};
	    	}
		}
	}
	else{
	    let t = (seg.a.y-s.y)/ray.y;
		if(t > 0){
			let x = s.x+ray.x*t;
			if(between(seg.a.x,x,seg.b.x)){
	    		return {x:x, y:seg.a.y};
	    	}
		}
	}
	return null;
}
function mod360(x){
    if(x<0) return x+=pi*2;
    return x;
}
function dirToArc(dir){
    switch(dir){
        case 1:
            return pi;
        case 2 :
            return 3*halfPi;
        case 0:
        case 3:
            return 0;
        case 4:
            return halfPi;
    }
}
function sqdist(a,b){
	return Math.pow(a.x-b.x, 2) + Math.pow(a.y-b.y, 2);
}
function sqmod(a){
    return a.x*a.x + a.y*a.y;
}
function shadow(a,b,col=shadowCol,source=player){ 
	/*let a1 = {x: a.x-b.x, y: a.y-b.y};
	let len = Math.sqrt(sqmod(a1));
	let aNew = {x: a.x+a1.x/len, y:a.y+a1.y/len};
	let bNew = {x: b.x-a1.x/len, y:b.y-a1.y/len};
	a=aNew;b=bNew;*/
	let l1=Math.sqrt(sqdist(a,source));
	let l2=Math.sqrt(sqdist(b,source));
	let newL1 = Math.abs(l1-vision);
	let newL2 = Math.abs(l2-vision);

	let v1 = {x:(a.x-source.x)*(newL1/l1),y:(a.y-source.y)*(newL1/l1)};
	let v2 = {x:(b.x-source.x)*(newL2/l2),y:(b.y-source.y)*(newL2/l2)};

	let vx=0,vy=0;
	if(epsEq(a.x,b.x)){
		vx = Math.sign(v1.x)*vision;
	}
	else
		vy = Math.sign(v1.y)*vision;

	ctx.fillStyle = col;
	ctx.strokeStyle = col;
	ctx.beginPath();
	ctx.moveTo(a.x,a.y);
	ctx.lineTo(a.x+v1.x,a.y+v1.y);

	ctx.lineTo(a.x+v1.x+vx,a.y+v1.y+vy);
	ctx.lineTo(b.x+v2.x+vx,b.y+v2.y+vy);

	ctx.lineTo(b.x+v2.x,b.y+v2.y)
	ctx.lineTo(b.x,b.y);
	ctx.lineTo(a.x,a.y);
	ctx.stroke();
	ctx.fill();
	ctx.closePath();
}

//generates vector field (dynamic matrix for bots' moves)
function Vfield(){
    field = [];
	for(let i=0;i<height;i++)
		field.push(new Array());
	i = player.i;
	j = player.j;
	let stack=["last"]; // stop item
	field[i][j]= new tile(0,0);
	
	do{
	    if(maze[i][j].r!=1 && (!field[i][j+1] || j+1<width&&field[i][j+1] && field[i][j+1].dist > field[i][j].dist+1)){
	        field[i][j+1] = new tile(field[i][j].dist+1, 1);
	        stack.push({a:i,b:j});
	        j=j+1;
	    }
	    else if(maze[i][j].l!=1 && (!field[i+1][j] || i+1<height&&field[i+1][j] && field[i+1][j].dist > field[i][j].dist+1)){
	        field[i+1][j] = new tile(field[i][j].dist+1, 2);
	        stack.push({a:i,b:j});
	        i=i+1;
	    }
	    else if(j>0&&maze[i][j-1].r!=1 && (!field[i][j-1] || j>0&&field[i][j-1] && field[i][j-1].dist > field[i][j].dist+1)){
	        field[i][j-1] = new tile(field[i][j].dist+1, 3);
	        stack.push({a:i,b:j});
	        j=j-1;
	    }
	    else if(i>0&&maze[i-1][j].l!=1 && (!field[i-1][j] || i>0&&field[i-1][j] && field[i-1][j].dist > field[i][j].dist+1)){
	        field[i-1][j]=new tile(field[i][j].dist+1, 4);
	        stack.push({a:i,b:j});
	        i=i-1;
	    }
	    else if(stack.length){
	        temp = stack.pop();
	        i=temp.a; j=temp.b;
	    }
	}while(stack.length > 0);
}

function merge(set1,set2,row){
	for(let s of sets[set1]){
		row[s].s = set2;
		sets[set2].push(s);
	}
	sets[set1] = []; //delete set1
};
//----------------------------------------------------------------------------------------------------------------------maze generation
for(let j=0; j<width; j++){
	row.push(new cell(0,0,j)); //initialize cells to different sets
	set = [j]; // init sets with initial cells
	sets[j] = JSON.parse(JSON.stringify(set)); // because js... 

}
for(let i=0; i<height; i++){

	for(let j=0; j<width; j++){ // need to edit previous row to use it as a new one
		row[j].r=0;
		if(row[j].l){
			let index = sets[row[j].s].indexOf(j);
			sets[row[j].s].splice(index,1); // delete cell from set
			row[j].s = -1; // delete cells that have lower walls
		}
		row[j].l=0;
	}

	for(let j=0; j<width; j++)
		if(row[j].s == -1){		// assign unique # to cells 
			row[j].s = 0; 		// that belong to no sets						
			
			for(let k=0; k<width; k++)
				if(k!=j && row[k].s==row[j].s){ 
					row[j].s++;
					k=-1;
				}
			sets[row[j].s].push(j);
		}								
	
	/* create right walls */
	for(let j=0; j<width-1; j++){ 
		if(Math.round(Math.random())) row[j].r = 1; // random wall
		else if(row[j+1].s!=row[j].s) merge(row[j+1].s,row[j].s,row);
	}
	row[width-1].r = 1;
	/* create lower walls */
	exits = new Array(width).fill(0);
	for(let j=0; j<width; j++) exits[row[j].s]++; // yet each sell has no lower wall
	for(let j=0; j<width; j++){ 
		if(Math.round(Math.random())){ // if decided to create wall
			if(exits[row[j].s]>1){ // have to check for exit from set
				row[j].l = 1;
				exits[row[j].s]--;
			}
		}
	}
	if(i==height-1){
		for(let j=0; j<width; j++){ // last row
			row[j].l = 1; // lower walls to all
			if(j+1<width && row[j].s != row[j+1].s){ // unite cells from different sets
				row[j].r = 0;
				merge(row[j+1].s,row[j].s,row);
			}
		}
		row[width-1].r = 1;
	}
	maze.push(JSON.parse(JSON.stringify(row))); // because js
}

//-------------------------------------------------------------------------------------------------------controls block
KEY={
	key38:false, // up
	key40:false, // down
	key39:false, // right
	key37:false, // left
    
    key87:false, // w
    key83:false, // s
    key68:false, // d
    key65:false, // a
};
/*function touch(e){
	if(e.changedTouches[0]){
        KEY["key87"]=true;
        cursor.x = e.changedTouches[0].pageX;
        cursor.y = e.changedTouches[0].pageY;
    }
    if(e.changedTouches[1]){player.shoots=true; player.hit();}//@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
	
};*/
document.addEventListener("mousedown",function(e){
    player.shoots=true; 
    player.hit();
    });
document.addEventListener("mousemove",function(e){
	let v = new dot(e.pageX-player.x, e.pageY-player.y);
	let l = sqmod(v);
	if(l < sqVision){
		l = Math.sqrt(l);
		cursor.x = player.x + v.x*(vision/l); 
		cursor.y = player.y + v.y*(vision/l);
	}
	else {
		cursor.x = e.pageX;
		cursor.y = e.pageY;
	}
});
document.addEventListener("keydown",function(e){
	KEY["key"+e.keyCode]=true;
	if(e.keyCode==118)
		PAUSE=!PAUSE;
});
document.addEventListener("keyup",function(e){KEY["key"+e.keyCode]=false;});
/*document.addEventListener("touchstart", touch);
document.addEventListener("touchmove",touch);
document.addEventListener("touchend",function(e){
	if(e.changedTouches[0])KEY["key87"]=false;
});*/

//---------------------------------------------------------------------------------------draw maze
lw.onload = function(){
    let lw_w = lw.width*ws, lw_h = lw.height*ws;
    let rw_w = rw.width*ws, rw_h = rw.height*ws;
    let pad1 = 0, pad2 = 0, pad3 = 0, pad4 = 0;
    let pad5 = 0, pad6 = 0, pad7 = 0, pad8 = 0;
    for(let n=0;n<2;n++)
        for(let i=0;i<height;i++){
            for(let j=0;j<width;j++){
                if(i==0&&n==0){
                    let x = s.x+j*tab;
                    let y = s.y-lw_h/2;
                    ctx2.drawImage(lw, x, y, lw_w, lw_h);
                    ctx2.drawImage(lw, x+lw_w, y, lw_w, lw_h);
                }
                if(j==0&&n==1){
                    let x = s.x-rw_w/2;
                    let y = s.y+i*tab-rw_h/2;
                    ctx2.drawImage(rw, x, y, rw_w, rw_h);
                    ctx2.drawImage(rw, x, y+rw_h, rw_w, rw_h);
                    ctx2.drawImage(lw, x, y+rw_h*2, lw_w, lw_h);
                }
                if(maze[i][j].r==1&&n==1){
                    let x = s.x+(j+1)*tab-rw_w/2;
                    let y = s.y+i*tab-rw_h/2;
                    ctx2.drawImage(rw, x, y, rw_w, rw_h);
                    ctx2.drawImage(rw,x, y+rw_h, rw_w, rw_h);
                    ctx2.drawImage(lw, x, y+rw_h*2, lw_w, lw_h);
                    if(j<width-1){
                    	pad3 = pad4 = pad5 = pad6 = pad7 = pad8 = 0;
                    	if(i==0||maze[i-1][j].r==1){
                    		pad3 = lw_h;
                    	}
                    	if(i==height-1){
                    		pad4 = lw_h;
                    	}
                    	if(!pad3&&i>0&&maze[i-1][j].l){
                    		pad5 = lw_h;
                    	}
                    	if(i+1<height&&maze[i][j].l){
                    		pad6 = lw_h;
                    	}
                    	if(!pad3&&i>0&&maze[i-1][j+1].l){
                    		pad7 = lw_h;
                    	}
                    	if(i+1<height&&maze[i][j+1].l){
                    		pad8 = lw_h;
                    	} 
                    	segments.push(new segment(new dot(x,y+pad3+pad5), new dot(x,y+rw_h*3-pad4-pad6)));
                    	segments.push(new segment(new dot(x+rw_w,y+pad3+pad7), new dot(x+rw_w,y+rw_h*3-pad4-pad8)));
                    	if(i>0&&!maze[i-1][j].r){
                    		segments.push(new segment(new dot(x,y), new dot(x+rw_w,y)));
                    	}
                    	if(i+1<height&&!maze[i+1][j].r){
                    		segments.push(new segment(new dot(x,y+rw_h*3), new dot(x+rw_w,y+rw_h*3)));
                    	}
                    }
                }
                if(maze[i][j].l==1&&n==0){
                    let x = s.x+j*tab;
                    let y = s.y+(i+1)*tab-lw_h/2;
                    ctx2.drawImage(lw, x, y, lw_w, lw_h);
                    ctx2.drawImage(lw, x+lw_w, y, lw_w, lw_h);
                    if(i<height-1){
                    	pad1 = pad2 = 0;
	                    if(maze[i][j].r==1||i+1<height&&maze[i+1][j].r==1){
	                    	pad1 = rw_w/2;
	                    } 
	                    if(j==0||(maze[i][j-1].r==1||i+1<height&&maze[i+1][j-1].r==1)){
	                    	pad2 = rw_w/2;
	                    } 
	                    segments.push(new segment(new dot(x+pad2,y), new dot(x-pad1+lw_w*2,y)));
	                    segments.push(new segment(new dot(x+pad2,y+lw_h), new dot(x-pad1+lw_w*2,y+lw_h)));
	                    if(!pad1&&j+1<width&&!maze[i][j+1].l)
	                    	segments.push(new segment(new dot(x+lw_w*2,y), new dot(x+lw_w*2,y+lw_h)))
	                    if(!pad2&&j>0&&!maze[i][j-1].l)
	                    	segments.push(new segment(new dot(x,y), new dot(x,y+lw_h)))
	                }
                }
            }
        }

   for(let i=0; i<segments.length; i++){
    	if(segments[i]){
	    	for(let j=0; j<segments.length; j++){
	    		if(segments[j] && segments[j].prolongs(segments[i])){
	    			segments[i].concat(segments[j]);
	    			segments[j] = null;
	    			j = -1;
	    		}
	    	}
	    }
    }
    segments = segments.filter(I => I);
    
    // eventually proper visual debugging
    /*ctx2.strokeStyle = '#f00';
    ctx2.fillStyle = '#0f0';
    ctx2.lineWidth = 2;
    segments.map(I => {
    		ctx2.beginPath();
    		ctx2.moveTo(I.a.x,I.a.y);
    		ctx2.lineTo(I.b.x,I.b.y);
    		ctx2.stroke();
    		ctx2.closePath();
    	}
	);
	segments.map(I => {
    		ctx2.beginPath();
    		ctx2.arc(I.a.x,I.a.y,2,0,pi*2);
    		ctx2.fill();
    		ctx2.closePath();
    		ctx2.beginPath();
    		ctx2.arc(I.b.x,I.b.y,2,0,pi*2);
    		ctx2.fill();
    		ctx2.closePath();
    	}
	);
	for(let y=s.y-rw_h/2;y<s.y-rw_h/2+height*rw_h*3;y+=rw_h){
		ctx2.fillText(y+'',0,y)
	}	*/
}
//----------------------------------------------------------------------------------------------------------------------------------game loop
function draw(dT){
    if(!lasTdT) lasTdT = dT;
    if(dT-lasTdT > 32 && !PAUSE){
    	lasTdT = dT;

    	window.scrollTo(0, player.y-winHalfH);
        Vfield();
		//floor fill
        ctx.fillStyle = floorPat;//floorCol;
        ctx.beginPath();
        ctx.rect(s.x,s.y,width*tab,height*tab);
        ctx.fill();
        ctx.closePath();
    //-------------------------------------------------------------------------draw bots
        
        //bots shadows
        /*if(!death.terminated()){
	        for (let i in bots){
	            if(sqdist(player,bots[i]) < sqVision){
	                ctx.beginPath();
	                ctx.arc(bots[i].x,bots[i].y,shadR*1.3,0,pi*2);
	                ctx.fillStyle = 'rgba(0,0,0,0.2)';
	                ctx.fill();
	                ctx.closePath();
	                let a = new dot(bots[i].x-shadR,bots[i].y-shadR);
	                let b = new dot(bots[i].x+shadR,bots[i].y-shadR);
	                let c = new dot(bots[i].x+shadR,bots[i].y+shadR);
	                let d = new dot(bots[i].x-shadR,bots[i].y+shadR);
	                let temp = rectangle(a,b,c,d);
	                for (let j of temp){
	                    shadow(j.a,j.b,'rgba(0,0,0,0.2)');
	                }
	            }
	        }
  		}*/
        
        for(let i in bots){
            ctx.save();
            ctx.translate(bots[i].x,bots[i].y);
            bots[i].rotSteps();
            
            if(bots[i].steps.length){
                ctx.rotate(bots[i].steps.shift());
            }
            else{
                ctx.rotate(dirToArc(bots[i].dir));
            }
            
            if(!death.inProgress() && !death.terminated()){
	            if(player.HIT == i || zombDeath[i].inProgress()){
	                bots[i].dead = true;
	                ctx.translate(-zombDeath[i].halfW,-zombDeath[i].halfH);
	                zombDeath[i].render();
	                player.HIT = null;
	            }
	            else if(bots[i].attacks()){
	                ctx.translate(-zombHit[i].halfW,-zombHit[i].halfH);
	                zombHit[i].render();
	            }
	            else{
	                ctx.translate(-zombWalk[i].halfW,-zombWalk[i].halfH);
	                zombWalk[i].render();
	            }
	            if(zombDeath[i].terminated()){ // respawn if dead
	                bots[i] = new bot(0, width-1, s.x+(width-1)*tab+halfTab, s.y+halfTab);
	                zombDeath[i].terminate();
	            }
	        }
	        else{
	        	ctx.translate(-zombIdle[i].halfW,-zombIdle[i].halfH);
	            zombIdle[i].render();
	        }
            ctx.restore();
        }
    //---------------------------------------------------------------------------------------------------------------------move player & bots
        if(!death.inProgress() && !death.terminated()){
	        if(KEY.key87 &&  dir.right && noBot(player.i,player.j+1) 
	        	&& maze[player.i][player.j].r!=1 && go.Rt>=tab && go.Dn>=tab && go.Up>=tab) go.Rt-=tab;
	        if(KEY.key87 &&  dir.up && player.i>0 && noBot(player.i-1,player.j) 
	        	&& maze[player.i-1][player.j].l!=1 && go.Up>=tab && go.Rt>=tab && go.Lt>=tab) go.Up-=tab;
	        if(KEY.key87 &&  dir.down && noBot(player.i+1,player.j) 
	        	&& maze[player.i][player.j].l!=1 && go.Dn>=tab && go.Rt>=tab && go.Lt>=tab) go.Dn-=tab;
	        if(KEY.key87 &&  dir.left && player.j>0 && noBot(player.i,player.j-1) 
	        	&& maze[player.i][player.j-1].r!=1 && go.Lt>=tab && go.Dn>=tab && go.Up>=tab) go.Lt-=tab;
	        if(go.Rt < tab){
	            player.x+=player.step;
	            go.Rt+=player.step;
	            if(go.Rt >= tab ) player.j++;
	        }
	        if(go.Lt < tab){
	            player.x-=player.step;
	            go.Lt+=player.step;
	            if(go.Lt >= tab) player.j--;
	        }
	        if(go.Up < tab){
	            player.y-=player.step;
	            go.Up+=player.step;
	            if(go.Up >= tab) player.i--;
	        }
	         if(go.Dn < tab){
	            player.y+=player.step;
	            go.Dn+=player.step;
	            if(go.Dn >= tab) player.i++;
	        }
	        for (let bot of bots){
				if(field[bot.i][bot.j].dir==1 ){ bot.dir=1; } 
	            else if(field[bot.i][bot.j].dir==2){ bot.dir=2; } 
	            else if(field[bot.i][bot.j].dir==3){ bot.dir=3; } 
	            else if(field[bot.i][bot.j].dir==4){ bot.dir=4;} 
				if(!bot.dead && !bot.attacks()){                    
	                if(bot.dir==1){
	                   bot.x-=bot.step;
	                    if(halfTab+s.x+(bot.j)*tab - bot.x>=tab){ bot.j--; }
	                }
	                else if(bot.dir==2){
	                    bot.y-=bot.step;
	                    if(halfTab+s.y+(bot.i)*tab - bot.y>=tab){ bot.i--; }
	                }
	                else if(bot.dir==3){
	                    bot.x+=bot.step;
	                    if(bot.x - s.x-bot.j*tab-halfTab>=tab){bot.j++; }
	                }
	                else if(bot.dir==4){
	                    bot.y+=bot.step;
	                    if(bot.y - s.x-bot.i*tab-halfTab>=tab) { bot.i++; }
	                }
	            }
	        }
	    }
        //--------------------------------------------------------------------draw player

        // cast shadows underneath player
        if(!death.terminated()){
	    	getVisibles(segments,player);
	    	eye1 = new dot(player.x+Math.cos(dir.angle-quarterPi)*tab/9,player.y+Math.sin(dir.angle-quarterPi)*tab/9);
	    	eye2 = new dot(player.x+Math.cos(dir.angle+quarterPi)*tab/9,player.y+Math.sin(dir.angle+quarterPi)*tab/9);
			for (let i of visibles){
	 			shadow(i.a,i.b);
	        }
	        
	        for (let i of visibles){
	 			shadow(i.a,i.b,'rgba(0,0,0,0.5)',eye1);
	        }
	        for (let i of visibles){
	 			shadow(i.a,i.b,'rgba(0,0,0,0.5)',eye2);
	        }
	        // draw vision circle
	        ctx.beginPath();
	        ctx.arc(player.x,player.y,vision,0,pi*2);
	        ctx.rect(s.x+width*tab,s.y,-width*tab,height*tab);
	        ctx.fillStyle = shadowCol;
	        ctx.fill();
	        ctx.closePath();
	        
	        ctx.save();
	        ctx.translate(player.x,player.y);
	        // 90 degrees sight
	        if(!death.terminated()){
		        ctx.rotate(dir.angle-quarterPi);
		        ctx.beginPath();
		        ctx.rect(-vision,-vision,vision*2,vision*2);
		        ctx.rect(vision,0,-vision,vision);
		        ctx.fill();
		        ctx.closePath();
		        ctx.rotate(quarterPi);
		    }
	    }
        
        if(player.life <= 0){
        	if(!death.terminated()){
	        	ctx.translate(-death.halfW,-death.halfH);
	        	death.render();
	        }
        	else
        		setTimeout(function(){window.location.reload(false);},3000);
        } 
        else if (player.gotHit() || gotHit.inProgress()){ctx.translate(-gotHit.halfW,-gotHit.halfH);gotHit.render();}
        else if(player.moves()){ctx.translate(-walk.halfW,-walk.halfH); walk.render();gotHit.terminate();}
        else if(player.shoots){ctx.translate(-shot.halfW,-shot.halfH);shot.render();gotHit.terminate();}
        else {ctx.translate(-idle.halfW,-idle.halfH);idle.render();gotHit.terminate();} 
        if(shot.terminated()){ player.shoots=false; shot.terminate();}
        ctx.restore();
        dir.update();

        // draw hearts
		ctx.clearRect(0,window.scrollY,halfTab,tab*3)
        for(let i=0;i<player.life;i++)
        	ctx.drawImage(heart,0,window.scrollY+i*halfTab,halfTab,halfTab);

        //debugging segments in sight
        /*ctx3.clearRect(0,0,w,h);
        ctx3.lineWidth = 4;
		ctx3.strokeStyle = '#00f';
		visibles.map(I => {
	    		ctx3.beginPath();
	    		ctx3.moveTo(I.a.x,I.a.y);
	    		ctx3.lineTo(I.b.x,I.b.y);
	    		ctx3.stroke();
	    		ctx3.closePath();
	    	}
		);*/
		/*ctx3.clearRect(0,0,w,h);
		ctx3.beginPath();
        ctx3.arc(eye1.x,eye1.y,3,0,pi*2);
    	ctx3.fillStyle = 'blue';
        ctx3.fill();
        ctx3.closePath();
        ctx3.beginPath();
        ctx3.arc(eye2.x,eye2.y,3,0,pi*2);
    	ctx3.fillStyle = 'blue';
        ctx3.fill();
        ctx3.closePath();

        ctx3.beginPath();
        ctx3.arc(player.x+dir.x,player.y+dir.y,4,0,pi*2);
    	ctx3.fillStyle = 'cyan';
        ctx3.fill();
        ctx3.closePath();*/
       
    }
    requestAnimationFrame(draw);
}
setTimeout(draw,1000);