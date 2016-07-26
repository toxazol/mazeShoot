//-----------------------------------------------------------------------------------------------------vars & constructors init
const pi = Math.PI;
let canvas = document.getElementById("c");
let ctx = canvas.getContext("2d"); // dynamic

let canvas2 = document.getElementById("c2");
let ctx2 = canvas2.getContext("2d"); // static
//colors
canvas.style.backgroundColor = "#000"; //around maze fill
const floorCol = "#555";
const shadowCol = "#111"

let w = canvas.width = canvas2.width = window.innerWidth;
let winH = window.innerHeight;
let h = canvas.height = canvas2.height = 2*winH;
let l = ctx2.lineWidth = 10;
let PAUSE = false;
const tab = 90; 
const scale = tab/128;
const ws = scale; //wall scale
const vision = 500; //sight radius
const shadR = 10; //zombie shadow circle radius
const sqVision = vision*vision;
let segments = []; // for shadow casting
let shield = []; // no eyes on players back
let field = []; // for vfield generator

let width = ~~((w-tab*2)/tab); // maze size params
let height = ~~((h-tab*2)/tab);

let temp;
let s = {x:tab,y:tab}; // startPoint

let player = {
    i: 0,
    j: 0,
    x: s.x+tab/2,
    y: s.y+tab/2,
    step: 4,
    life: 2,
    shoots: false,
    HIT: null,
    hit(){
        let self = this;
        for(let i in bots){
            let target = Math.atan2(bots[i].y-self.y,bots[i].x-self.x);
            if(mod360(mod360(target)-mod360(dir.angle)) < pi/16 || mod360(mod360(dir.angle)-mod360(target)) < pi/16){
                let intersects = [];
                let ray = {a: self, b: cursor};
                for (let seg of segments){
                    let dot = segRay(seg,ray);
                    if(dot) intersects.push({dot:dot,seg:seg});
                }
                if(intersects.length){
                    intersects.sort(function(a,b){return sqdist(a.dot,self)-sqdist(b.dot,self);});
                    if(sqdist(intersects[0].dot,self) > sqdist(bots[i],self)){
                        self.HIT = i; 
                        return;
                    }
                }
               
            }
        }
        self.HIT = null;
    },
    gotHit(){
        for(let bot of bots){
            if(bot.attacks()) return true;
        }
        return false;
    },
    moves(){
        if(KEY.key87 || go.Rt<tab || go.Lt<tab || go.Dn<tab || go.Up<tab)
            return true;
        return false;
    },
};
function bot(i,j,x,y,dir=0,step=3){// default dir & step
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
        return field[self.i][self.j].dist == 1;
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
let bot1 = new bot(0, width-1, s.x+(width-1)*tab+tab/2, s.y+tab/2);
let bot2 = new bot(height-1, 0, s.x+tab/2, s.y+(height-1)*tab+tab/2);
let bot3 = new bot(height-1, width-1, s.x+(width-1)*tab+tab/2, s.y+(height-1)*tab+tab/2);
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
    that.width = sptiteSheet.width/n;
    that.height = sptiteSheet.height;
    that.w = that.width*scale*scaler;
    that.h = that.height*scale*scaler;
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
            that.h);
        that.j += speed;
        that.i = ~~that.j;
    };
    return that;
};
//sprite mechanism initializing
let walk, idle, zombWalk = [], zombHit = [], shot, gotHit, zombDeath = [];
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
        zombWalk[i] = sprite(temp4, 20);
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
let floor = new Image();
floor.src = "sprites/floor.jpg";
let floorPat; 
floor.onload = function(){floorPat = ctx.createPattern(floor, 'repeat');};
let rw = new Image(); 
rw.src = "sprites/right_wall.jpg";
let lw = new Image();
lw.src = "sprites/lower_wall.jpg";

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
        sqmod(this) > walk.h*walk.h/4 && (this.angle = Math.atan2(this.y,this.x));
        
        if(this.angle < pi/4 && this.angle > -pi/4)
            this.right = true;
        else if(this.angle < 3*pi/4 && this.angle > pi/4)
            this.down = true;
        else if(this.angle < -pi/4 && this.angle > -3*pi/4)
            this.up = true;
        else if(this.angle < -3*pi/4 || this.angle > 3*pi/4)
            this.left = true;
    }
};

//-----------------------------------------------------------------------------------------------------functions initialization
function rectangle(a,b,c,d){ // use with spread ...
    let temp = [];
    temp.push(new segment(a,b));
    temp.push(new segment(b,c));
    temp.push(new segment(c,d));
    temp.push(new segment(a,d));
    return temp;
}
function consistsIn(arr,seg){
    for(i of arr){
        if(i==seg) return true;
    }
    return false;
}
let visibles = [];
function getVisibles(segments,player){
    visibles = []; // if not in visible when add
    let intersects = [];
    for(let v=0;v<Math.PI*2;v+=0.01){ // try different angle increment
        intersects = [];
        ray = {a:player, b:{x:Math.cos(v)*10+player.x,y:Math.sin(v)*10+player.y,},};
        for(seg of segments){
            let dot = segRay(seg,ray);
            if(dot) intersects.push({dot:dot,seg:seg});
        }
        if(intersects.length){
            intersects.sort(function(a,b){return sqdist(a.dot,player)-sqdist(b.dot,player);});
            if(!consistsIn(visibles,intersects[0].seg))visibles.push(intersects[0].seg);
        }
    }
}
function vecAngle(vec){
    return Math.atan2(vec.y,vec.x);
}
function getLineX(y,seg){
    return (seg.b.x-seg.a.x)*((y-seg.a.y)/(seg.b.y-seg.a.y))+seg.a.x;
}
function getLineY(x,seg){
    return (seg.b.y-seg.a.y)*((x-seg.a.x)/(seg.b.x-seg.a.x))+seg.a.y;
}
function between(a,x,b){
    if(x>a&&x<b || x>b&&x<a)return true;
    return false;
}
function segRay(seg,ray){ 
    if(seg.a.x == seg.b.x){
        let y = getLineY(seg.a.x,ray);
        if(between(seg.a.y,y,seg.b.y)){
            let rayVec = {x:ray.b.x-ray.a.x, y: ray.b.y-ray.a.y};
            let segVec = {x:seg.b.x-ray.a.x, y: y-ray.a.y};
            if(Math.abs(vecAngle(rayVec)-vecAngle(segVec)) < 1)
                return {x:seg.a.x, y:y};
        }
    }
    else{
        let x = getLineX(seg.a.y,ray);
        if(between(seg.a.x,x,seg.b.x)){
            let rayVec = {x:ray.b.x-ray.a.x, y: ray.b.y-ray.a.y};
            let segVec = {x:x-ray.a.x, y: seg.b.y-ray.a.y};
            if(Math.abs(vecAngle(rayVec)-vecAngle(segVec)) < 1)
                return {x:x, y:seg.a.y};
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
            return 3*pi/2;
        case 0:
        case 3:
            return 0;
        case 4:
            return pi/2;
    }
}
function sqdist(a,b){
	return Math.pow(a.x-b.x, 2) + Math.pow(a.y-b.y, 2);
}
function sqmod(a){
    return a.x*a.x + a.y*a.y;
}
function shadow(a,b,l=vision,col=shadowCol){ 
    let a1 = {x: a.x-b.x, y: a.y-b.y};
	let len = Math.sqrt(sqmod(a1));
	let aNew = {x: a.x+a1.x/len, y:a.y+a1.y/len};
	let bNew = {x: b.x-a1.x/len, y:b.y-a1.y/len};
	a=aNew;b=bNew;
    let l1=Math.sqrt(sqdist(a,player));
	let l2=Math.sqrt(sqdist(b,player));
    
    let v1 = {x:(a.x-player.x)*(l/l1),y:(a.y-player.y)*(l/l1)}
	let v2 = {x:(b.x-player.x)*(l/l2),y:(b.y-player.y)*(l/l2)}
    
    ctx.fillStyle = col;
	ctx.strokeStyle = col;
	ctx.beginPath();
	ctx.moveTo(a.x,a.y);
	
    ctx.lineTo(a.x+v1.x,a.y+v1.y);//ctx.stroke();
	ctx.lineTo(b.x+v2.x,b.y+v2.y);//ctx.stroke();
    
	ctx.lineTo(b.x,b.y);//ctx.stroke();
	ctx.lineTo(a.x,a.y);//ctx.stroke();
	ctx.fill();
	ctx.closePath();
}

function generateShield(){
    shield = [];
    let arc = 3*Math.PI/2;
    let start = dir.angle + pi/4;
    let n = 3;
    let prev = new dot(player.x + Math.cos(start)*10, player.y + Math.sin(start)*10);
    for(let i=start+arc/n, j=0; j<n; i+=arc/n,j++){
        let cur = new dot(player.x + Math.cos(i)*10, player.y + Math.sin(i)*10);
        shield.push(new segment(prev,cur));
        prev = cur;
    }
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
document.addEventListener("mousemove",function(e){cursor.x=e.pageX;cursor.y=e.pageY;});
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
                    segments.push(...rectangle(new dot(x,y), new dot(x+rw_w,y),new dot(x,y+rw_h*3), new dot(x+rw_w,y+rw_h*3)));
                }
                if(maze[i][j].l==1&&n==0){
                    let x = s.x+j*tab;
                    let y = s.y+(i+1)*tab-lw_h/2;
                    ctx2.drawImage(lw, x, y, lw_w, lw_h);
                    ctx2.drawImage(lw, x+lw_w, y, lw_w, lw_h);
                    segments.push(...rectangle(new dot(x,y), new dot(x+lw_w*2,y),new dot(x,y+lw_h), new dot(x+lw_w*2,y+lw_h)));
                }
            }
        }
}
//store maze as wall segments
/* for(let i=0;i<height;i++){
    for(let j=0;j<width;j++){
        if(maze[i][j].r==1) segments.push(new segment(new dot(s.x+(j+1)*tab, s.y+i*tab), new dot(s.x+(j+1)*tab, s.y+(i+1)*tab)));
        if(maze[i][j].l==1) segments.push(new segment(new dot(s.x+j*tab, s.y+(i+1)*tab), new dot(s.x+(j+1)*tab, s.y+(i+1)*tab)));
    }
} */
//----------------------------------------------------------------------------------------------------------------------------------game loop
function draw(dT){
    if(!lasTdT) lasTdT = dT;
    if(dT-lasTdT > 32 && !PAUSE){
    	window.scrollTo(0, player.y-winH/2);
        Vfield();
        //floor fill
        ctx.clearRect(0,0,w,h);
        ctx.fillStyle = floorPat;//floorCol;
        ctx.beginPath();
        ctx.rect(s.x,s.y,width*tab,height*tab);
        ctx.fill()
        ctx.closePath();
        ctx.clip(); // check performance!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        
       
        lasTdT = dT;
    //-------------------------------------------------------------------------draw bots
        
        //bots shadows
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
                    shadow(j.a,j.b,vision*2,'rgba(0,0,0,0.2)');
                }
            }
                
        }
        
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
            
            
            if(player.HIT == i || zombDeath[i].inProgress()){
                bots[i].dead = true;
                ctx.translate(-zombDeath[i].w/2,-zombDeath[i].h/2);
                zombDeath[i].render();
                player.HIT = null;
            }
            else if(bots[i].attacks()){
                ctx.translate(-zombHit[i].w/2,-zombHit[i].h/2);
                zombHit[i].render();
            }
            else{
                ctx.translate(-zombWalk[i].w/2,-zombWalk[i].h/2);
                zombWalk[i].render();
            }
            if(zombDeath[i].terminated()){ // respawn if dead
                bots[i] = new bot(0, width-1, s.x+(width-1)*tab+tab/2, s.y+tab/2);
                zombDeath[i].terminate();
            }
            ctx.restore();
        }
    //-----------------------------------------------------------------------move player & bots
        if(KEY.key87 &&  dir.right && maze[player.i][player.j].r!=1 && go.Rt>=tab && go.Dn>=tab && go.Up>=tab) go.Rt-=tab;
        if(KEY.key87 &&  dir.up && player.i>0 && maze[player.i-1][player.j].l!=1 && go.Up>=tab && go.Rt>=tab && go.Lt>=tab) go.Up-=tab;
        if(KEY.key87 &&  dir.down && maze[player.i][player.j].l!=1 && go.Dn>=tab && go.Rt>=tab && go.Lt>=tab) go.Dn-=tab;
        if(KEY.key87 &&  dir.left && player.j>0 && maze[player.i][player.j-1].r!=1 && go.Lt>=tab && go.Dn>=tab && go.Up>=tab) go.Lt-=tab;
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
            if(!bot.dead && !bot.attacks()){
                if(field[bot.i][bot.j].dir==1 ){ bot.dir=1; } 
                    
                else if(field[bot.i][bot.j].dir==2){ bot.dir=2; } 
                    
                else if(field[bot.i][bot.j].dir==3){ bot.dir=3; } 
                    
                else if(field[bot.i][bot.j].dir==4){ bot.dir=4;} 
                    
                if(bot.dir==1){
                   bot.x-=bot.step;
                    if(tab/2+s.x+(bot.j)*tab - bot.x>=tab){ bot.j--; }
                }
                else if(bot.dir==2){
                    bot.y-=bot.step;
                    if(tab/2+s.y+(bot.i)*tab - bot.y>=tab){ bot.i--; }
                }
                else if(bot.dir==3){
                    bot.x+=bot.step;
                    if(bot.x - s.x-bot.j*tab-tab/2>=tab){bot.j++; }
                }
                else if(bot.dir==4){
                    bot.y+=bot.step;
                    if(bot.y - s.x-bot.i*tab-tab/2>=tab) { bot.i++; }
                }
            }
        }
        //--------------------------------------------------------------------draw player
        
        //cast shadows underneath player
        
        /* getVisibles(segments,player); */
        generateShield();// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
        for (let i of shield){
            shadow(i.a,i.b,vision*2);
        }
        for (let i of segments){
            let dist = Math.min(sqdist(player,i.a),sqdist(player,i.b));
            if(dist < sqVision)
                shadow(i.a,i.b,vision*2);
        }
        
        
        // draw vision area
        ctx.beginPath();
        ctx.arc(player.x,player.y,vision,0,pi*2);
        ctx.rect(s.x+width*tab,s.y,-width*tab,height*tab);
        ctx.fillStyle = shadowCol;
        ctx.fill();
        ctx.closePath();
        
        ctx.save();
        ctx.translate(player.x,player.y);
        ctx.rotate(dir.angle);
        
        if(player.moves()){ctx.translate(-walk.w/2,-walk.h/2); walk.render();gotHit.terminate();}
        else if(player.shoots){ctx.translate(-shot.w/2,-shot.h/2);shot.render();gotHit.terminate();}
        else if (player.gotHit() || gotHit.inProgress()){ctx.translate(-gotHit.w/2,-gotHit.h/2);gotHit.render();}
        else {ctx.translate(-idle.w/2,-idle.h/2); idle.render();gotHit.terminate();} 
        if(shot.terminated()){ player.shoots=false; shot.terminate();}
        ctx.restore();
        dir.update();
       
    }
    requestAnimationFrame(draw);
}
requestAnimationFrame(draw);