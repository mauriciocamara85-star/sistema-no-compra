var yi={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},Mi={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},su=0,Mc=1,ru=2;var Br=1,Ao=2,Ns=3,Si=0,Zt=1,yn=2,Nt=0,Us=1,zr=2,Sc=3,bc=4,Co=5;var An=100,au=101,ou=102,lu=103,cu=104,Gi=200,hu=201,uu=202,du=203,Ec=204,Tc=205,Vr=206,fu=207,kr=208,pu=209,mu=210,gu=211,_u=212,xu=213,vu=214,qa=0,Ya=1,ja=2,vs=3,Za=4,Ja=5,Ka=6,$a=7,Ro=0,yu=1,Mu=2,Fn=0,Hr=1,Gr=2,Wr=3,Wi=4,Xr=5,qr=6,Yr=7;var wc=300,bi=301,Xi=302,Po=303,Io=304,jr=306,qt=1e3,kn=1001,Qa=1002,Dt=1003,Su=1004;var Zr=1005;var jt=1006,Do=1007;var Ei=1008;var tn=1009,Ac=1010,Cc=1011,Fs=1012,Lo=1013,On=1014,Cn=1015,Vt=1016,No=1017,Uo=1018,Ti=1020,Rc=35902,Pc=35899,Ic=1021,Dc=1022,un=1023,Hn=1026,qn=1027,Fo=1028,Oo=1029,wi=1030,Bo=1031;var zo=1033,Jr=33776,Kr=33777,$r=33778,Qr=33779,Vo=35840,ko=35841,Ho=35842,Go=35843,Wo=36196,Xo=37492,qo=37496,Yo=37488,jo=37489,ea=37490,Zo=37491,Jo=37808,Ko=37809,$o=37810,Qo=37811,el=37812,tl=37813,nl=37814,il=37815,sl=37816,rl=37817,al=37818,ol=37819,ll=37820,cl=37821,hl=36492,ul=36494,dl=36495,fl=36283,pl=36284,ta=36285,ml=36286;var or=2300,eo=2301,Ga=2302,oc=2303,lc=2400,cc=2401,hc=2402;var bu=3200;var Os=0,Eu=1,Bn="",Yt="srgb",lr="srgb-linear",cr="linear",pt="srgb";var Wa=7680;var Tu=519,wu=512,Au=513,Cu=514,gl=515,Ru=516,Pu=517,_l=518,Iu=519,Du=35044;var Lc="300 es",Nn=2e3,ys=2001;function Hd(i){for(let e=i.length-1;e>=0;--e)if(i[e]>=65535)return!0;return!1}function Gd(i){return ArrayBuffer.isView(i)&&!(i instanceof DataView)}function Ms(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function Lu(){let i=Ms("canvas");return i.style.display="block",i}var Th={},Ss=null;function Nc(...i){let e="THREE."+i.shift();Ss?Ss("log",e,...i):console.log(e,...i)}function Nu(i){let e=i[0];if(typeof e=="string"&&e.startsWith("TSL:")){let t=i[1];t&&t.isStackTrace?i[0]+=" "+t.getLocation():i[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return i}function je(...i){i=Nu(i);let e="THREE."+i.shift();if(Ss)Ss("warn",e,...i);else{let t=i[0];t&&t.isStackTrace?console.warn(t.getError(e)):console.warn(e,...i)}}function Je(...i){i=Nu(i);let e="THREE."+i.shift();if(Ss)Ss("error",e,...i);else{let t=i[0];t&&t.isStackTrace?console.error(t.getError(e)):console.error(e,...i)}}function Ui(...i){let e=i.join(" ");e in Th||(Th[e]=!0,je(...i))}function Uu(i,e,t){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(e,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,t);break;default:n()}}setTimeout(r,t)})}var Fu={[qa]:Ya,[ja]:Ka,[Za]:$a,[vs]:Ja,[Ya]:qa,[Ka]:ja,[$a]:Za,[Ja]:vs},Un=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){let n=this._listeners;return n===void 0?!1:n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){let n=this._listeners;if(n===void 0)return;let s=n[e];if(s!==void 0){let r=s.indexOf(t);r!==-1&&s.splice(r,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let n=t[e.type];if(n!==void 0){e.target=this;let s=n.slice(0);for(let r=0,a=s.length;r<a;r++)s[r].call(this,e);e.target=null}}},$t=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],wh=1234567,ir=Math.PI/180,Fi=180/Math.PI;function qi(){let i=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return($t[i&255]+$t[i>>8&255]+$t[i>>16&255]+$t[i>>24&255]+"-"+$t[e&255]+$t[e>>8&255]+"-"+$t[e>>16&15|64]+$t[e>>24&255]+"-"+$t[t&63|128]+$t[t>>8&255]+"-"+$t[t>>16&255]+$t[t>>24&255]+$t[n&255]+$t[n>>8&255]+$t[n>>16&255]+$t[n>>24&255]).toLowerCase()}function at(i,e,t){return Math.max(e,Math.min(t,i))}function Uc(i,e){return(i%e+e)%e}function Wd(i,e,t,n,s){return n+(i-e)*(s-n)/(t-e)}function Xd(i,e,t){return i!==e?(t-i)/(e-i):0}function sr(i,e,t){return(1-t)*i+t*e}function qd(i,e,t,n){return sr(i,e,1-Math.exp(-t*n))}function Yd(i,e=1){return e-Math.abs(Uc(i,e*2)-e)}function jd(i,e,t){return i<=e?0:i>=t?1:(i=(i-e)/(t-e),i*i*(3-2*i))}function Zd(i,e,t){return i<=e?0:i>=t?1:(i=(i-e)/(t-e),i*i*i*(i*(i*6-15)+10))}function Jd(i,e){return i+Math.floor(Math.random()*(e-i+1))}function Kd(i,e){return i+Math.random()*(e-i)}function $d(i){return i*(.5-Math.random())}function Qd(i){i!==void 0&&(wh=i);let e=wh+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function ef(i){return i*ir}function tf(i){return i*Fi}function nf(i){return i>0&&Number.isInteger(i)&&2**Math.round(Math.log2(i))===i}function sf(i){return Math.pow(2,Math.ceil(Math.log(i)/Math.LN2))}function rf(i){return Math.pow(2,Math.floor(Math.log(i)/Math.LN2))}function af(i,e,t,n,s){let r=Math.cos,a=Math.sin,o=r(t/2),c=a(t/2),l=r((e+n)/2),h=a((e+n)/2),u=r((e-n)/2),d=a((e-n)/2),f=r((n-e)/2),p=a((n-e)/2);switch(s){case"XYX":i.set(o*h,c*u,c*d,o*l);break;case"YZY":i.set(c*d,o*h,c*u,o*l);break;case"ZXZ":i.set(c*u,c*d,o*h,o*l);break;case"XZX":i.set(o*h,c*p,c*f,o*l);break;case"YXY":i.set(c*f,o*h,c*p,o*l);break;case"ZYZ":i.set(c*p,c*f,o*h,o*l);break;default:je("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+s)}}function _s(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:case Uint8ClampedArray:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function an(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:case Uint8ClampedArray:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var Bs={DEG2RAD:ir,RAD2DEG:Fi,generateUUID:qi,clamp:at,euclideanModulo:Uc,mapLinear:Wd,inverseLerp:Xd,lerp:sr,damp:qd,pingpong:Yd,smoothstep:jd,smootherstep:Zd,randInt:Jd,randFloat:Kd,randFloatSpread:$d,seededRandom:Qd,degToRad:ef,radToDeg:tf,isPowerOfTwo:nf,ceilPowerOfTwo:sf,floorPowerOfTwo:rf,setQuaternionFromProperEuler:af,normalize:an,denormalize:_s},kc=class kc{constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,n=this.y,s=e.elements;return this.x=s[0]*t+s[3]*n+s[6],this.y=s[1]*t+s[4]*n+s[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=at(this.x,e.x,t.x),this.y=at(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=at(this.x,e,t),this.y=at(this.y,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(at(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(at(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let n=Math.cos(t),s=Math.sin(t),r=this.x-e.x,a=this.y-e.y;return this.x=r*n-a*s+e.x,this.y=r*s+a*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}};kc.prototype.isVector2=!0;var pe=kc,Bt=class{constructor(e=0,t=0,n=0,s=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=s}static slerpFlat(e,t,n,s,r,a,o){let c=n[s+0],l=n[s+1],h=n[s+2],u=n[s+3],d=r[a+0],f=r[a+1],p=r[a+2],_=r[a+3];if(u!==_||c!==d||l!==f||h!==p){let m=c*d+l*f+h*p+u*_;m<0&&(d=-d,f=-f,p=-p,_=-_,m=-m);let g=1-o;if(m<.9995){let S=Math.acos(m),A=Math.sin(S);g=Math.sin(g*S)/A,o=Math.sin(o*S)/A,c=c*g+d*o,l=l*g+f*o,h=h*g+p*o,u=u*g+_*o}else{c=c*g+d*o,l=l*g+f*o,h=h*g+p*o,u=u*g+_*o;let S=1/Math.sqrt(c*c+l*l+h*h+u*u);c*=S,l*=S,h*=S,u*=S}}e[t]=c,e[t+1]=l,e[t+2]=h,e[t+3]=u}static multiplyQuaternionsFlat(e,t,n,s,r,a){let o=n[s],c=n[s+1],l=n[s+2],h=n[s+3],u=r[a],d=r[a+1],f=r[a+2],p=r[a+3];return e[t]=o*p+h*u+c*f-l*d,e[t+1]=c*p+h*d+l*u-o*f,e[t+2]=l*p+h*f+o*d-c*u,e[t+3]=h*p-o*u-c*d-l*f,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,s){return this._x=e,this._y=t,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let n=e._x,s=e._y,r=e._z,a=e._order,o=Math.cos,c=Math.sin,l=o(n/2),h=o(s/2),u=o(r/2),d=c(n/2),f=c(s/2),p=c(r/2);switch(a){case"XYZ":this._x=d*h*u+l*f*p,this._y=l*f*u-d*h*p,this._z=l*h*p+d*f*u,this._w=l*h*u-d*f*p;break;case"YXZ":this._x=d*h*u+l*f*p,this._y=l*f*u-d*h*p,this._z=l*h*p-d*f*u,this._w=l*h*u+d*f*p;break;case"ZXY":this._x=d*h*u-l*f*p,this._y=l*f*u+d*h*p,this._z=l*h*p+d*f*u,this._w=l*h*u-d*f*p;break;case"ZYX":this._x=d*h*u-l*f*p,this._y=l*f*u+d*h*p,this._z=l*h*p-d*f*u,this._w=l*h*u+d*f*p;break;case"YZX":this._x=d*h*u+l*f*p,this._y=l*f*u+d*h*p,this._z=l*h*p-d*f*u,this._w=l*h*u-d*f*p;break;case"XZY":this._x=d*h*u-l*f*p,this._y=l*f*u-d*h*p,this._z=l*h*p+d*f*u,this._w=l*h*u+d*f*p;break;default:je("Quaternion: .setFromEuler() encountered an unknown order: "+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let n=t/2,s=Math.sin(n);return this._x=e.x*s,this._y=e.y*s,this._z=e.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,n=t[0],s=t[4],r=t[8],a=t[1],o=t[5],c=t[9],l=t[2],h=t[6],u=t[10],d=n+o+u;if(d>0){let f=.5/Math.sqrt(d+1);this._w=.25/f,this._x=(h-c)*f,this._y=(r-l)*f,this._z=(a-s)*f}else if(n>o&&n>u){let f=2*Math.sqrt(1+n-o-u);this._w=(h-c)/f,this._x=.25*f,this._y=(s+a)/f,this._z=(r+l)/f}else if(o>u){let f=2*Math.sqrt(1+o-n-u);this._w=(r-l)/f,this._x=(s+a)/f,this._y=.25*f,this._z=(c+h)/f}else{let f=2*Math.sqrt(1+u-n-o);this._w=(a-s)/f,this._x=(r+l)/f,this._y=(c+h)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(at(this.dot(e),-1,1)))}rotateTowards(e,t){let n=this.angleTo(e);if(n===0)return this;let s=Math.min(1,t/n);return this.slerp(e,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let n=e._x,s=e._y,r=e._z,a=e._w,o=t._x,c=t._y,l=t._z,h=t._w;return this._x=n*h+a*o+s*l-r*c,this._y=s*h+a*c+r*o-n*l,this._z=r*h+a*l+n*c-s*o,this._w=a*h-n*o-s*c-r*l,this._onChangeCallback(),this}slerp(e,t){let n=e._x,s=e._y,r=e._z,a=e._w,o=this.dot(e);o<0&&(n=-n,s=-s,r=-r,a=-a,o=-o);let c=1-t;if(o<.9995){let l=Math.acos(o),h=Math.sin(l);c=Math.sin(c*l)/h,t=Math.sin(t*l)/h,this._x=this._x*c+n*t,this._y=this._y*c+s*t,this._z=this._z*c+r*t,this._w=this._w*c+a*t,this._onChangeCallback()}else this._x=this._x*c+n*t,this._y=this._y*c+s*t,this._z=this._z*c+r*t,this._w=this._w*c+a*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(e),s*Math.cos(e),r*Math.sin(t),r*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},Hc=class Hc{constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Ah.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Ah.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,n=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6]*s,this.y=r[1]*t+r[4]*n+r[7]*s,this.z=r[2]*t+r[5]*n+r[8]*s,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,n=this.y,s=this.z,r=e.elements,a=1/(r[3]*t+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*t+r[4]*n+r[8]*s+r[12])*a,this.y=(r[1]*t+r[5]*n+r[9]*s+r[13])*a,this.z=(r[2]*t+r[6]*n+r[10]*s+r[14])*a,this}applyQuaternion(e){let t=this.x,n=this.y,s=this.z,r=e.x,a=e.y,o=e.z,c=e.w,l=2*(a*s-o*n),h=2*(o*t-r*s),u=2*(r*n-a*t);return this.x=t+c*l+a*u-o*h,this.y=n+c*h+o*l-r*u,this.z=s+c*u+r*h-a*l,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,n=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[4]*n+r[8]*s,this.y=r[1]*t+r[5]*n+r[9]*s,this.z=r[2]*t+r[6]*n+r[10]*s,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=at(this.x,e.x,t.x),this.y=at(this.y,e.y,t.y),this.z=at(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=at(this.x,e,t),this.y=at(this.y,e,t),this.z=at(this.z,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(at(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let n=e.x,s=e.y,r=e.z,a=t.x,o=t.y,c=t.z;return this.x=s*c-r*o,this.y=r*a-n*c,this.z=n*o-s*a,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return Ol.copy(this).projectOnVector(e),this.sub(Ol)}reflect(e){return this.sub(Ol.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(at(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y,s=this.z-e.z;return t*t+n*n+s*s}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){let s=Math.sin(t)*e;return this.x=s*Math.sin(n),this.y=Math.cos(t)*e,this.z=s*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),s=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=s,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}};Hc.prototype.isVector3=!0;var D=Hc,Ol=new D,Ah=new Bt,Gc=class Gc{constructor(e,t,n,s,r,a,o,c,l){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,s,r,a,o,c,l)}set(e,t,n,s,r,a,o,c,l){let h=this.elements;return h[0]=e,h[1]=s,h[2]=o,h[3]=t,h[4]=r,h[5]=c,h[6]=n,h[7]=a,h[8]=l,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,s=t.elements,r=this.elements,a=n[0],o=n[3],c=n[6],l=n[1],h=n[4],u=n[7],d=n[2],f=n[5],p=n[8],_=s[0],m=s[3],g=s[6],S=s[1],A=s[4],M=s[7],E=s[2],v=s[5],b=s[8];return r[0]=a*_+o*S+c*E,r[3]=a*m+o*A+c*v,r[6]=a*g+o*M+c*b,r[1]=l*_+h*S+u*E,r[4]=l*m+h*A+u*v,r[7]=l*g+h*M+u*b,r[2]=d*_+f*S+p*E,r[5]=d*m+f*A+p*v,r[8]=d*g+f*M+p*b,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],c=e[6],l=e[7],h=e[8];return t*a*h-t*o*l-n*r*h+n*o*c+s*r*l-s*a*c}invert(){let e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],c=e[6],l=e[7],h=e[8],u=h*a-o*l,d=o*c-h*r,f=l*r-a*c,p=t*u+n*d+s*f;if(p===0)return this.set(0,0,0,0,0,0,0,0,0);let _=1/p;return e[0]=u*_,e[1]=(s*l-h*n)*_,e[2]=(o*n-s*a)*_,e[3]=d*_,e[4]=(h*t-s*c)*_,e[5]=(s*r-o*t)*_,e[6]=f*_,e[7]=(n*c-l*t)*_,e[8]=(a*t-n*r)*_,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,s,r,a,o){let c=Math.cos(r),l=Math.sin(r);return this.set(n*c,n*l,-n*(c*a+l*o)+a+e,-s*l,s*c,-s*(-l*a+c*o)+o+t,0,0,1),this}scale(e,t){return Ui("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(Bl.makeScale(e,t)),this}rotate(e){return Ui("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(Bl.makeRotation(-e)),this}translate(e,t){return Ui("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(Bl.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,n=e.elements;for(let s=0;s<9;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}};Gc.prototype.isMatrix3=!0;var st=Gc,Bl=new st,Ch=new st().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Rh=new st().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function of(){let i={enabled:!0,workingColorSpace:lr,spaces:{},convert:function(s,r,a){return this.enabled===!1||r===a||!r||!a||(this.spaces[r].transfer===pt&&(s.r=ii(s.r),s.g=ii(s.g),s.b=ii(s.b)),this.spaces[r].primaries!==this.spaces[a].primaries&&(s.applyMatrix3(this.spaces[r].toXYZ),s.applyMatrix3(this.spaces[a].fromXYZ)),this.spaces[a].transfer===pt&&(s.r=xs(s.r),s.g=xs(s.g),s.b=xs(s.b))),s},workingToColorSpace:function(s,r){return this.convert(s,this.workingColorSpace,r)},colorSpaceToWorking:function(s,r){return this.convert(s,r,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===Bn?cr:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,r=this.workingColorSpace){return s.fromArray(this.spaces[r].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,r,a){return s.copy(this.spaces[r].toXYZ).multiply(this.spaces[a].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(s,r){return Ui("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),i.workingToColorSpace(s,r)},toWorkingColorSpace:function(s,r){return Ui("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),i.colorSpaceToWorking(s,r)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],n=[.3127,.329];return i.define({[lr]:{primaries:e,whitePoint:n,transfer:cr,toXYZ:Ch,fromXYZ:Rh,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:Yt},outputColorSpaceConfig:{drawingBufferColorSpace:Yt}},[Yt]:{primaries:e,whitePoint:n,transfer:pt,toXYZ:Ch,fromXYZ:Rh,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:Yt}}}),i}var ct=of();function ii(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function xs(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}var ns,to=class{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement=="undefined")return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{ns===void 0&&(ns=Ms("canvas")),ns.width=e.width,ns.height=e.height;let s=ns.getContext("2d");e instanceof ImageData?s.putImageData(e,0,0):s.drawImage(e,0,0,e.width,e.height),n=ns}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement!="undefined"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement!="undefined"&&e instanceof HTMLCanvasElement||typeof ImageBitmap!="undefined"&&e instanceof ImageBitmap){let t=Ms("canvas");t.width=e.width,t.height=e.height;let n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);let s=n.getImageData(0,0,e.width,e.height),r=s.data;for(let a=0;a<r.length;a++)r[a]=ii(r[a]/255)*255;return n.putImageData(s,0,0),t}else if(e.data){let t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(ii(t[n]/255)*255):t[n]=ii(t[n]);return{data:t,width:e.width,height:e.height}}else return je("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}},lf=0,bs=class{constructor(e=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:lf++}),this.uuid=qi(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;return typeof HTMLVideoElement!="undefined"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame!="undefined"&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let a=0,o=s.length;a<o;a++)s[a].isDataTexture?r.push(zl(s[a].image)):r.push(zl(s[a]))}else r=zl(s);n.url=r}return t||(e.images[this.uuid]=n),n}};function zl(i){return typeof HTMLImageElement!="undefined"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement!="undefined"&&i instanceof HTMLCanvasElement||typeof ImageBitmap!="undefined"&&i instanceof ImageBitmap?to.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(je("Texture: Unable to serialize Texture."),{})}var cf=0,Vl=new D,en=class i extends Un{constructor(e=i.DEFAULT_IMAGE,t=i.DEFAULT_MAPPING,n=kn,s=kn,r=jt,a=Ei,o=un,c=tn,l=i.DEFAULT_ANISOTROPY,h=Bn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:cf++}),this.uuid=qi(),this.name="",this.source=new bs(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=a,this.anisotropy=l,this.format=o,this.internalFormat=null,this.type=c,this.offset=new pe(0,0),this.repeat=new pe(1,1),this.center=new pe(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new st,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(Vl).x}get height(){return this.source.getSize(Vl).y}get depth(){return this.source.getSize(Vl).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let n=e[t];if(n===void 0){je(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let s=this[t];if(s===void 0){je(`Texture.setValues(): property '${t}' does not exist.`);continue}s&&n&&s.isVector2&&n.isVector2||s&&n&&s.isVector3&&n.isVector3||s&&n&&s.isMatrix3&&n.isMatrix3?s.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==wc)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case qt:e.x=e.x-Math.floor(e.x);break;case kn:e.x=e.x<0?0:1;break;case Qa:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case qt:e.y=e.y-Math.floor(e.y);break;case kn:e.y=e.y<0?0:1;break;case Qa:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};en.DEFAULT_IMAGE=null;en.DEFAULT_MAPPING=wc;en.DEFAULT_ANISOTROPY=1;var Wc=class Wc{constructor(e=0,t=0,n=0,s=1){this.x=e,this.y=t,this.z=n,this.w=s}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,s){return this.x=e,this.y=t,this.z=n,this.w=s,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,n=this.y,s=this.z,r=this.w,a=e.elements;return this.x=a[0]*t+a[4]*n+a[8]*s+a[12]*r,this.y=a[1]*t+a[5]*n+a[9]*s+a[13]*r,this.z=a[2]*t+a[6]*n+a[10]*s+a[14]*r,this.w=a[3]*t+a[7]*n+a[11]*s+a[15]*r,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,s,r,c=e.elements,l=c[0],h=c[4],u=c[8],d=c[1],f=c[5],p=c[9],_=c[2],m=c[6],g=c[10];if(Math.abs(h-d)<.01&&Math.abs(u-_)<.01&&Math.abs(p-m)<.01){if(Math.abs(h+d)<.1&&Math.abs(u+_)<.1&&Math.abs(p+m)<.1&&Math.abs(l+f+g-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;let A=(l+1)/2,M=(f+1)/2,E=(g+1)/2,v=(h+d)/4,b=(u+_)/4,x=(p+m)/4;return A>M&&A>E?A<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(A),s=v/n,r=b/n):M>E?M<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(M),n=v/s,r=x/s):E<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(E),n=b/r,s=x/r),this.set(n,s,r,t),this}let S=Math.sqrt((m-p)*(m-p)+(u-_)*(u-_)+(d-h)*(d-h));return Math.abs(S)<.001&&(S=1),this.x=(m-p)/S,this.y=(u-_)/S,this.z=(d-h)/S,this.w=Math.acos((l+f+g-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=at(this.x,e.x,t.x),this.y=at(this.y,e.y,t.y),this.z=at(this.z,e.z,t.z),this.w=at(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=at(this.x,e,t),this.y=at(this.y,e,t),this.z=at(this.z,e,t),this.w=at(this.w,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(at(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}};Wc.prototype.isVector4=!0;var Et=Wc,no=class extends Un{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:jt,depthBuffer:!0,stencilBuffer:!1,resolveColorBuffer:!0,resolveDepthBuffer:!0,resolveStencilBuffer:!0,storeMultisampledColorBuffer:!0,storeMultisampledDepthBuffer:!0,storeMultisampledStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new Et(0,0,e,t),this.scissorTest=!1,this.viewport=new Et(0,0,e,t),this.textures=[];let s={width:e,height:t,depth:n.depth},r=new en(s),a=n.count;for(let o=0;o<a;o++)this.textures[o]=r.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveColorBuffer=n.resolveColorBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.storeMultisampledColorBuffer=n.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=n.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=n.storeMultisampledStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(e={}){let t={minFilter:jt,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&this._depthTexture.renderTarget===this&&(this._depthTexture.renderTarget=null),e!==null&&e.renderTarget===null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=e,this.textures[s].image.height=t,this.textures[s].image.depth=n,this.textures[s].isData3DTexture!==!0&&(this.textures[s].isArrayTexture=this.textures[s].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let s=Object.assign({},e.textures[t].image);this.textures[t].source=new bs(s)}if(this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveColorBuffer=e.resolveColorBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,this.storeMultisampledColorBuffer=e.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=e.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=e.storeMultisampledStencilBuffer,e.depthTexture!==null)if(e.depthTexture.renderTarget===e){let t=e.depthTexture.clone();t.renderTarget=null,this.depthTexture=t}else this.depthTexture=e.depthTexture;return this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},Ct=class extends no{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}},hr=class extends en{constructor(e=null,t=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=Dt,this.minFilter=Dt,this.wrapR=kn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}};var io=class extends en{constructor(e=null,t=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=Dt,this.minFilter=Dt,this.wrapR=kn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}};var wo=class wo{constructor(e,t,n,s,r,a,o,c,l,h,u,d,f,p,_,m){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,s,r,a,o,c,l,h,u,d,f,p,_,m)}set(e,t,n,s,r,a,o,c,l,h,u,d,f,p,_,m){let g=this.elements;return g[0]=e,g[4]=t,g[8]=n,g[12]=s,g[1]=r,g[5]=a,g[9]=o,g[13]=c,g[2]=l,g[6]=h,g[10]=u,g[14]=d,g[3]=f,g[7]=p,g[11]=_,g[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new wo().fromArray(this.elements)}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){let t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();let t=this.elements,n=e.elements,s=1/is.setFromMatrixColumn(e,0).length(),r=1/is.setFromMatrixColumn(e,1).length(),a=1/is.setFromMatrixColumn(e,2).length();return t[0]=n[0]*s,t[1]=n[1]*s,t[2]=n[2]*s,t[3]=0,t[4]=n[4]*r,t[5]=n[5]*r,t[6]=n[6]*r,t[7]=0,t[8]=n[8]*a,t[9]=n[9]*a,t[10]=n[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,n=e.x,s=e.y,r=e.z,a=Math.cos(n),o=Math.sin(n),c=Math.cos(s),l=Math.sin(s),h=Math.cos(r),u=Math.sin(r);if(e.order==="XYZ"){let d=a*h,f=a*u,p=o*h,_=o*u;t[0]=c*h,t[4]=-c*u,t[8]=l,t[1]=f+p*l,t[5]=d-_*l,t[9]=-o*c,t[2]=_-d*l,t[6]=p+f*l,t[10]=a*c}else if(e.order==="YXZ"){let d=c*h,f=c*u,p=l*h,_=l*u;t[0]=d+_*o,t[4]=p*o-f,t[8]=a*l,t[1]=a*u,t[5]=a*h,t[9]=-o,t[2]=f*o-p,t[6]=_+d*o,t[10]=a*c}else if(e.order==="ZXY"){let d=c*h,f=c*u,p=l*h,_=l*u;t[0]=d-_*o,t[4]=-a*u,t[8]=p+f*o,t[1]=f+p*o,t[5]=a*h,t[9]=_-d*o,t[2]=-a*l,t[6]=o,t[10]=a*c}else if(e.order==="ZYX"){let d=a*h,f=a*u,p=o*h,_=o*u;t[0]=c*h,t[4]=p*l-f,t[8]=d*l+_,t[1]=c*u,t[5]=_*l+d,t[9]=f*l-p,t[2]=-l,t[6]=o*c,t[10]=a*c}else if(e.order==="YZX"){let d=a*c,f=a*l,p=o*c,_=o*l;t[0]=c*h,t[4]=_-d*u,t[8]=p*u+f,t[1]=u,t[5]=a*h,t[9]=-o*h,t[2]=-l*h,t[6]=f*u+p,t[10]=d-_*u}else if(e.order==="XZY"){let d=a*c,f=a*l,p=o*c,_=o*l;t[0]=c*h,t[4]=-u,t[8]=l*h,t[1]=d*u+_,t[5]=a*h,t[9]=f*u-p,t[2]=p*u-f,t[6]=o*h,t[10]=_*u+d}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(hf,e,uf)}lookAt(e,t,n){let s=this.elements;return pn.subVectors(e,t),pn.lengthSq()===0&&(pn.z=1),pn.normalize(),hi.crossVectors(n,pn),hi.lengthSq()===0&&(Math.abs(n.z)===1?pn.x+=1e-4:pn.z+=1e-4,pn.normalize(),hi.crossVectors(n,pn)),hi.normalize(),Ma.crossVectors(pn,hi),s[0]=hi.x,s[4]=Ma.x,s[8]=pn.x,s[1]=hi.y,s[5]=Ma.y,s[9]=pn.y,s[2]=hi.z,s[6]=Ma.z,s[10]=pn.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,s=t.elements,r=this.elements,a=n[0],o=n[4],c=n[8],l=n[12],h=n[1],u=n[5],d=n[9],f=n[13],p=n[2],_=n[6],m=n[10],g=n[14],S=n[3],A=n[7],M=n[11],E=n[15],v=s[0],b=s[4],x=s[8],w=s[12],C=s[1],I=s[5],U=s[9],z=s[13],O=s[2],k=s[6],j=s[10],R=s[14],F=s[3],G=s[7],q=s[11],X=s[15];return r[0]=a*v+o*C+c*O+l*F,r[4]=a*b+o*I+c*k+l*G,r[8]=a*x+o*U+c*j+l*q,r[12]=a*w+o*z+c*R+l*X,r[1]=h*v+u*C+d*O+f*F,r[5]=h*b+u*I+d*k+f*G,r[9]=h*x+u*U+d*j+f*q,r[13]=h*w+u*z+d*R+f*X,r[2]=p*v+_*C+m*O+g*F,r[6]=p*b+_*I+m*k+g*G,r[10]=p*x+_*U+m*j+g*q,r[14]=p*w+_*z+m*R+g*X,r[3]=S*v+A*C+M*O+E*F,r[7]=S*b+A*I+M*k+E*G,r[11]=S*x+A*U+M*j+E*q,r[15]=S*w+A*z+M*R+E*X,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[4],s=e[8],r=e[12],a=e[1],o=e[5],c=e[9],l=e[13],h=e[2],u=e[6],d=e[10],f=e[14],p=e[3],_=e[7],m=e[11],g=e[15],S=c*f-l*d,A=o*f-l*u,M=o*d-c*u,E=a*f-l*h,v=a*d-c*h,b=a*u-o*h;return t*(_*S-m*A+g*M)-n*(p*S-m*E+g*v)+s*(p*A-_*E+g*b)-r*(p*M-_*v+m*b)}determinantAffine(){let e=this.elements,t=e[0],n=e[4],s=e[8],r=e[1],a=e[5],o=e[9],c=e[2],l=e[6],h=e[10];return t*(a*h-o*l)-n*(r*h-o*c)+s*(r*l-a*c)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){let s=this.elements;return e.isVector3?(s[12]=e.x,s[13]=e.y,s[14]=e.z):(s[12]=e,s[13]=t,s[14]=n),this}invert(){let e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],c=e[6],l=e[7],h=e[8],u=e[9],d=e[10],f=e[11],p=e[12],_=e[13],m=e[14],g=e[15],S=t*o-n*a,A=t*c-s*a,M=t*l-r*a,E=n*c-s*o,v=n*l-r*o,b=s*l-r*c,x=h*_-u*p,w=h*m-d*p,C=h*g-f*p,I=u*m-d*_,U=u*g-f*_,z=d*g-f*m,O=S*z-A*U+M*I+E*C-v*w+b*x;if(O===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let k=1/O;return e[0]=(o*z-c*U+l*I)*k,e[1]=(s*U-n*z-r*I)*k,e[2]=(_*b-m*v+g*E)*k,e[3]=(d*v-u*b-f*E)*k,e[4]=(c*C-a*z-l*w)*k,e[5]=(t*z-s*C+r*w)*k,e[6]=(m*M-p*b-g*A)*k,e[7]=(h*b-d*M+f*A)*k,e[8]=(a*U-o*C+l*x)*k,e[9]=(n*C-t*U-r*x)*k,e[10]=(p*v-_*M+g*S)*k,e[11]=(u*M-h*v-f*S)*k,e[12]=(o*w-a*I-c*x)*k,e[13]=(t*I-n*w+s*x)*k,e[14]=(_*A-p*E-m*S)*k,e[15]=(h*E-u*A+d*S)*k,this}scale(e){let t=this.elements,n=e.x,s=e.y,r=e.z;return t[0]*=n,t[4]*=s,t[8]*=r,t[1]*=n,t[5]*=s,t[9]*=r,t[2]*=n,t[6]*=s,t[10]*=r,t[3]*=n,t[7]*=s,t[11]*=r,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],s=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,s))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let n=Math.cos(t),s=Math.sin(t),r=1-n,a=e.x,o=e.y,c=e.z,l=r*a,h=r*o;return this.set(l*a+n,l*o-s*c,l*c+s*o,0,l*o+s*c,h*o+n,h*c-s*a,0,l*c-s*o,h*c+s*a,r*c*c+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,s,r,a){return this.set(1,n,r,0,e,1,a,0,t,s,1,0,0,0,0,1),this}compose(e,t,n){let s=this.elements,r=t._x,a=t._y,o=t._z,c=t._w,l=r+r,h=a+a,u=o+o,d=r*l,f=r*h,p=r*u,_=a*h,m=a*u,g=o*u,S=c*l,A=c*h,M=c*u,E=n.x,v=n.y,b=n.z;return s[0]=(1-(_+g))*E,s[1]=(f+M)*E,s[2]=(p-A)*E,s[3]=0,s[4]=(f-M)*v,s[5]=(1-(d+g))*v,s[6]=(m+S)*v,s[7]=0,s[8]=(p+A)*b,s[9]=(m-S)*b,s[10]=(1-(d+_))*b,s[11]=0,s[12]=e.x,s[13]=e.y,s[14]=e.z,s[15]=1,this}decompose(e,t,n){let s=this.elements;e.x=s[12],e.y=s[13],e.z=s[14];let r=this.determinantAffine();if(r===0)return n.set(1,1,1),t.identity(),this;let a=is.set(s[0],s[1],s[2]).length(),o=is.set(s[4],s[5],s[6]).length(),c=is.set(s[8],s[9],s[10]).length();r<0&&(a=-a),In.copy(this);let l=1/a,h=1/o,u=1/c;return In.elements[0]*=l,In.elements[1]*=l,In.elements[2]*=l,In.elements[4]*=h,In.elements[5]*=h,In.elements[6]*=h,In.elements[8]*=u,In.elements[9]*=u,In.elements[10]*=u,t.setFromRotationMatrix(In),n.x=a,n.y=o,n.z=c,this}makePerspective(e,t,n,s,r,a,o=Nn,c=!1){let l=this.elements,h=2*r/(t-e),u=2*r/(n-s),d=(t+e)/(t-e),f=(n+s)/(n-s),p,_;if(c)p=r/(a-r),_=a*r/(a-r);else if(o===Nn)p=-(a+r)/(a-r),_=-2*a*r/(a-r);else if(o===ys)p=-a/(a-r),_=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return l[0]=h,l[4]=0,l[8]=d,l[12]=0,l[1]=0,l[5]=u,l[9]=f,l[13]=0,l[2]=0,l[6]=0,l[10]=p,l[14]=_,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(e,t,n,s,r,a,o=Nn,c=!1){let l=this.elements,h=2/(t-e),u=2/(n-s),d=-(t+e)/(t-e),f=-(n+s)/(n-s),p,_;if(c)p=1/(a-r),_=a/(a-r);else if(o===Nn)p=-2/(a-r),_=-(a+r)/(a-r);else if(o===ys)p=-1/(a-r),_=-r/(a-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return l[0]=h,l[4]=0,l[8]=0,l[12]=d,l[1]=0,l[5]=u,l[9]=0,l[13]=f,l[2]=0,l[6]=0,l[10]=p,l[14]=_,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(e){let t=this.elements,n=e.elements;for(let s=0;s<16;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}};wo.prototype.isMatrix4=!0;var Ne=wo,is=new D,In=new Ne,hf=new D(0,0,0),uf=new D(1,1,1),hi=new D,Ma=new D,pn=new D,Ph=new Ne,Ih=new Bt,gn=class i{constructor(e=0,t=0,n=0,s=i.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=s}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,s=this._order){return this._x=e,this._y=t,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){let s=e.elements,r=s[0],a=s[4],o=s[8],c=s[1],l=s[5],h=s[9],u=s[2],d=s[6],f=s[10];switch(t){case"XYZ":this._y=Math.asin(at(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,f),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(d,l),this._z=0);break;case"YXZ":this._x=Math.asin(-at(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,f),this._z=Math.atan2(c,l)):(this._y=Math.atan2(-u,r),this._z=0);break;case"ZXY":this._x=Math.asin(at(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,f),this._z=Math.atan2(-a,l)):(this._y=0,this._z=Math.atan2(c,r));break;case"ZYX":this._y=Math.asin(-at(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,f),this._z=Math.atan2(c,r)):(this._x=0,this._z=Math.atan2(-a,l));break;case"YZX":this._z=Math.asin(at(c,-1,1)),Math.abs(c)<.9999999?(this._x=Math.atan2(-h,l),this._y=Math.atan2(-u,r)):(this._x=0,this._y=Math.atan2(o,f));break;case"XZY":this._z=Math.asin(-at(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,l),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-h,f),this._y=0);break;default:je("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return Ph.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Ph,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return Ih.setFromEuler(this),this.setFromQuaternion(Ih,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};gn.DEFAULT_ORDER="XYZ";var Es=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}},df=0,Dh=new D,ss=new Bt,$n=new Ne,Sa=new D,Js=new D,ff=new D,pf=new Bt,Lh=new D(1,0,0),Nh=new D(0,1,0),Uh=new D(0,0,1),Fh={type:"added"},mf={type:"removed"},rs={type:"childadded",child:null},kl={type:"childremoved",child:null},Rt=class i extends Un{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:df++}),this.uuid=qi(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=i.DEFAULT_UP.clone();let e=new D,t=new gn,n=new Bt,s=new D(1,1,1);function r(){n.setFromEuler(t,!1)}function a(){t.setFromQuaternion(n,void 0,!1)}t._onChange(r),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new Ne},normalMatrix:{value:new st}}),this.matrix=new Ne,this.matrixWorld=new Ne,this.matrixAutoUpdate=i.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=i.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Es,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return ss.setFromAxisAngle(e,t),this.quaternion.multiply(ss),this}rotateOnWorldAxis(e,t){return ss.setFromAxisAngle(e,t),this.quaternion.premultiply(ss),this}rotateX(e){return this.rotateOnAxis(Lh,e)}rotateY(e){return this.rotateOnAxis(Nh,e)}rotateZ(e){return this.rotateOnAxis(Uh,e)}translateOnAxis(e,t){return Dh.copy(e).applyQuaternion(this.quaternion),this.position.add(Dh.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(Lh,e)}translateY(e){return this.translateOnAxis(Nh,e)}translateZ(e){return this.translateOnAxis(Uh,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4($n.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?Sa.copy(e):Sa.set(e,t,n);let s=this.parent;this.updateWorldMatrix(!0,!1),Js.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?$n.lookAt(Js,Sa,this.up):$n.lookAt(Sa,Js,this.up),this.quaternion.setFromRotationMatrix($n),s&&($n.extractRotation(s.matrixWorld),ss.setFromRotationMatrix($n),this.quaternion.premultiply(ss.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(Je("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(Fh),rs.child=e,this.dispatchEvent(rs),rs.child=null):Je("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(mf),kl.child=e,this.dispatchEvent(kl),kl.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),$n.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),$n.multiply(e.parent.matrixWorld)),e.applyMatrix4($n),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(Fh),rs.child=e,this.dispatchEvent(rs),rs.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,s=this.children.length;n<s;n++){let a=this.children[n].getObjectByProperty(e,t);if(a!==void 0)return a}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);let s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Js,e,ff),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Js,pf,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}intersectsFrustum(){}traverse(e){e(this);let t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let t=e.x,n=e.y,s=e.z,r=this.matrix.elements;r[12]+=t-r[0]*t-r[4]*n-r[8]*s,r[13]+=n-r[1]*t-r[5]*n-r[9]*s,r[14]+=s-r[2]*t-r[6]*n-r[10]*s}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t,n=!1){let s=this.parent;if(e===!0&&s!==null&&s.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),t===!0){let r=this.children;for(let a=0,o=r.length;a<o;a++)r[a].updateWorldMatrix(!1,!0,n)}}toJSON(e){let t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let s={};s.uuid=this.uuid,s.type=this.type,s.name=this.name,s.castShadow=this.castShadow,s.receiveShadow=this.receiveShadow,s.visible=this.visible,s.frustumCulled=this.frustumCulled,s.renderOrder=this.renderOrder,s.static=this.static,s.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.pivot!==null&&(s.pivot=this.pivot.toArray()),this.morphTargetDictionary!==void 0&&(s.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(s.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(o=>({...o})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(e),s.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function r(o,c){return o[c.uuid]===void 0&&(o[c.uuid]=c.toJSON(e)),c.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(e.geometries,this.geometry);let o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){let c=o.shapes;if(Array.isArray(c))for(let l=0,h=c.length;l<h;l++){let u=c[l];r(e.shapes,u)}else r(e.shapes,c)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(e.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let o=[];for(let c=0,l=this.material.length;c<l;c++)o.push(r(e.materials,this.material[c]));s.material=o}else s.material=r(e.materials,this.material);if(this.children.length>0){s.children=[];for(let o=0;o<this.children.length;o++)s.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){s.animations=[];for(let o=0;o<this.animations.length;o++){let c=this.animations[o];s.animations.push(r(e.animations,c))}}if(t){let o=a(e.geometries),c=a(e.materials),l=a(e.textures),h=a(e.images),u=a(e.shapes),d=a(e.skeletons),f=a(e.animations),p=a(e.nodes);o.length>0&&(n.geometries=o),c.length>0&&(n.materials=c),l.length>0&&(n.textures=l),h.length>0&&(n.images=h),u.length>0&&(n.shapes=u),d.length>0&&(n.skeletons=d),f.length>0&&(n.animations=f),p.length>0&&(n.nodes=p)}return n.object=s,n;function a(o){let c=[];for(let l in o){let h=o[l];delete h.metadata,c.push(h)}return c}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){let s=e.children[n];this.add(s.clone())}return this}dispose(){this.dispatchEvent({type:"dispose"})}};Rt.DEFAULT_UP=new D(0,1,0);Rt.DEFAULT_MATRIX_AUTO_UPDATE=!0;Rt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var Tn=class extends Rt{constructor(){super(),this.isGroup=!0,this.type="Group"}},gf={type:"move"},Ts=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Tn,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Tn,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new D,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new D),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Tn,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new D,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new D,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let s=null,r=null,a=null,o=this._targetRay,c=this._grip,l=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(l&&e.hand){a=!0;for(let _ of e.hand.values()){let m=t.getJointPose(_,n),g=this._getHandJoint(l,_);m!==null&&(g.matrix.fromArray(m.transform.matrix),g.matrix.decompose(g.position,g.rotation,g.scale),g.matrixWorldNeedsUpdate=!0,g.jointRadius=m.radius),g.visible=m!==null}let h=l.joints["index-finger-tip"],u=l.joints["thumb-tip"],d=h.position.distanceTo(u.position),f=.02,p=.005;l.inputState.pinching&&d>f+p?(l.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!l.inputState.pinching&&d<=f-p&&(l.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else c!==null&&e.gripSpace&&(r=t.getPose(e.gripSpace,n),r!==null&&(c.matrix.fromArray(r.transform.matrix),c.matrix.decompose(c.position,c.rotation,c.scale),c.matrixWorldNeedsUpdate=!0,r.linearVelocity?(c.hasLinearVelocity=!0,c.linearVelocity.copy(r.linearVelocity)):c.hasLinearVelocity=!1,r.angularVelocity?(c.hasAngularVelocity=!0,c.angularVelocity.copy(r.angularVelocity)):c.hasAngularVelocity=!1,c.eventsEnabled&&c.dispatchEvent({type:"gripUpdated",data:e,target:this})));o!==null&&(s=t.getPose(e.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(o.matrix.fromArray(s.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,s.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(s.linearVelocity)):o.hasLinearVelocity=!1,s.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(s.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(gf)))}return o!==null&&(o.visible=s!==null),c!==null&&(c.visible=r!==null),l!==null&&(l.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let n=new Tn;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}},Ou={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},ui={h:0,s:0,l:0},ba={h:0,s:0,l:0};function Hl(i,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?i+(e-i)*6*t:t<1/2?e:t<2/3?i+(e-i)*6*(2/3-t):i}var tt=class{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){let s=e;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Yt){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,ct.colorSpaceToWorking(this,t),this}setRGB(e,t,n,s=ct.workingColorSpace){return this.r=e,this.g=t,this.b=n,ct.colorSpaceToWorking(this,s),this}setHSL(e,t,n,s=ct.workingColorSpace){if(e=Uc(e,1),t=at(t,0,1),n=at(n,0,1),t===0)this.r=this.g=this.b=n;else{let r=n<=.5?n*(1+t):n+t-n*t,a=2*n-r;this.r=Hl(a,r,e+1/3),this.g=Hl(a,r,e),this.b=Hl(a,r,e-1/3)}return ct.colorSpaceToWorking(this,s),this}setStyle(e,t=Yt){function n(r){r!==void 0&&parseFloat(r)<1&&je("Color: Alpha component of "+e+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(e)){let r,a=s[1],o=s[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,t);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:je("Color: Unknown color model "+e)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(e)){let r=s[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);if(a===6)return this.setHex(parseInt(r,16),t);je("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Yt){let n=Ou[e.toLowerCase()];return n!==void 0?this.setHex(n,t):je("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=ii(e.r),this.g=ii(e.g),this.b=ii(e.b),this}copyLinearToSRGB(e){return this.r=xs(e.r),this.g=xs(e.g),this.b=xs(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Yt){return ct.workingToColorSpace(Qt.copy(this),e),Math.round(at(Qt.r*255,0,255))*65536+Math.round(at(Qt.g*255,0,255))*256+Math.round(at(Qt.b*255,0,255))}getHexString(e=Yt){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=ct.workingColorSpace){ct.workingToColorSpace(Qt.copy(this),t);let n=Qt.r,s=Qt.g,r=Qt.b,a=Math.max(n,s,r),o=Math.min(n,s,r),c,l,h=(o+a)/2;if(o===a)c=0,l=0;else{let u=a-o;switch(l=h<=.5?u/(a+o):u/(2-a-o),a){case n:c=(s-r)/u+(s<r?6:0);break;case s:c=(r-n)/u+2;break;case r:c=(n-s)/u+4;break}c/=6}return e.h=c,e.s=l,e.l=h,e}getRGB(e,t=ct.workingColorSpace){return ct.workingToColorSpace(Qt.copy(this),t),e.r=Qt.r,e.g=Qt.g,e.b=Qt.b,e}getStyle(e=Yt){ct.workingToColorSpace(Qt.copy(this),e);let t=Qt.r,n=Qt.g,s=Qt.b;return e!==Yt?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(e,t,n){return this.getHSL(ui),this.setHSL(ui.h+e,ui.s+t,ui.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(ui),e.getHSL(ba);let n=sr(ui.h,ba.h,t),s=sr(ui.s,ba.s,t),r=sr(ui.l,ba.l,t);return this.setHSL(n,s,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,n=this.g,s=this.b,r=e.elements;return this.r=r[0]*t+r[3]*n+r[6]*s,this.g=r[1]*t+r[4]*n+r[7]*s,this.b=r[2]*t+r[5]*n+r[8]*s,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Qt=new tt;tt.NAMES=Ou;var Oi=class extends Rt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new gn,this.environmentIntensity=1,this.environmentRotation=new gn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__!="undefined"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),t.object.backgroundBlurriness=this.backgroundBlurriness,t.object.backgroundIntensity=this.backgroundIntensity,t.object.backgroundRotation=this.backgroundRotation.toArray(),t.object.environmentIntensity=this.environmentIntensity,t.object.environmentRotation=this.environmentRotation.toArray(),t}},Dn=new D,Qn=new D,Gl=new D,ei=new D,as=new D,os=new D,Oh=new D,Wl=new D,Xl=new D,ql=new D,Yl=new Et,jl=new Et,Zl=new Et,mi=class i{constructor(e=new D,t=new D,n=new D){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,s){s.subVectors(n,t),Dn.subVectors(e,t),s.cross(Dn);let r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(e,t,n,s,r){Dn.subVectors(s,t),Qn.subVectors(n,t),Gl.subVectors(e,t);let a=Dn.dot(Dn),o=Dn.dot(Qn),c=Dn.dot(Gl),l=Qn.dot(Qn),h=Qn.dot(Gl),u=a*l-o*o;if(u===0)return r.set(0,0,0),null;let d=1/u,f=(l*c-o*h)*d,p=(a*h-o*c)*d;return r.set(1-f-p,p,f)}static containsPoint(e,t,n,s){return this.getBarycoord(e,t,n,s,ei)===null?!1:ei.x>=0&&ei.y>=0&&ei.x+ei.y<=1}static getInterpolation(e,t,n,s,r,a,o,c){return this.getBarycoord(e,t,n,s,ei)===null?(c.x=0,c.y=0,"z"in c&&(c.z=0),"w"in c&&(c.w=0),null):(c.setScalar(0),c.addScaledVector(r,ei.x),c.addScaledVector(a,ei.y),c.addScaledVector(o,ei.z),c)}static getInterpolatedAttribute(e,t,n,s,r,a){return Yl.setScalar(0),jl.setScalar(0),Zl.setScalar(0),Yl.fromBufferAttribute(e,t),jl.fromBufferAttribute(e,n),Zl.fromBufferAttribute(e,s),a.setScalar(0),a.addScaledVector(Yl,r.x),a.addScaledVector(jl,r.y),a.addScaledVector(Zl,r.z),a}static isFrontFacing(e,t,n,s){return Dn.subVectors(n,t),Qn.subVectors(e,t),Dn.cross(Qn).dot(s)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,s){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[s]),this}setFromAttributeAndIndices(e,t,n,s){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,s),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return Dn.subVectors(this.c,this.b),Qn.subVectors(this.a,this.b),Dn.cross(Qn).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return i.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return i.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,s,r){return i.getInterpolation(e,this.a,this.b,this.c,t,n,s,r)}containsPoint(e){return i.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return i.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let n=this.a,s=this.b,r=this.c,a,o;as.subVectors(s,n),os.subVectors(r,n),Wl.subVectors(e,n);let c=as.dot(Wl),l=os.dot(Wl);if(c<=0&&l<=0)return t.copy(n);Xl.subVectors(e,s);let h=as.dot(Xl),u=os.dot(Xl);if(h>=0&&u<=h)return t.copy(s);let d=c*u-h*l;if(d<=0&&c>=0&&h<=0)return a=c/(c-h),t.copy(n).addScaledVector(as,a);ql.subVectors(e,r);let f=as.dot(ql),p=os.dot(ql);if(p>=0&&f<=p)return t.copy(r);let _=f*l-c*p;if(_<=0&&l>=0&&p<=0)return o=l/(l-p),t.copy(n).addScaledVector(os,o);let m=h*p-f*u;if(m<=0&&u-h>=0&&f-p>=0)return Oh.subVectors(r,s),o=(u-h)/(u-h+(f-p)),t.copy(s).addScaledVector(Oh,o);let g=1/(m+_+d);return a=_*g,o=d*g,t.copy(n).addScaledVector(as,a).addScaledVector(os,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},wn=class{constructor(e=new D(1/0,1/0,1/0),t=new D(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(Ln.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(Ln.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=Ln.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let n=e.geometry;if(n!==void 0){let r=n.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)e.isMesh===!0?e.getVertexPosition(a,Ln):Ln.fromBufferAttribute(r,a),Ln.applyMatrix4(e.matrixWorld),this.expandByPoint(Ln);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),Ea.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),Ea.copy(n.boundingBox)),Ea.applyMatrix4(e.matrixWorld),this.union(Ea)}let s=e.children;for(let r=0,a=s.length;r<a;r++)this.expandByObject(s[r],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,Ln),Ln.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Ks),Ta.subVectors(this.max,Ks),ls.subVectors(e.a,Ks),cs.subVectors(e.b,Ks),hs.subVectors(e.c,Ks),di.subVectors(cs,ls),fi.subVectors(hs,cs),Pi.subVectors(ls,hs);let t=[0,-di.z,di.y,0,-fi.z,fi.y,0,-Pi.z,Pi.y,di.z,0,-di.x,fi.z,0,-fi.x,Pi.z,0,-Pi.x,-di.y,di.x,0,-fi.y,fi.x,0,-Pi.y,Pi.x,0];return!Jl(t,ls,cs,hs,Ta)||(t=[1,0,0,0,1,0,0,0,1],!Jl(t,ls,cs,hs,Ta))?!1:(wa.crossVectors(di,fi),t=[wa.x,wa.y,wa.z],Jl(t,ls,cs,hs,Ta))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,Ln).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(Ln).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(ti[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),ti[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),ti[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),ti[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),ti[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),ti[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),ti[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),ti[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(ti),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}},ti=[new D,new D,new D,new D,new D,new D,new D,new D],Ln=new D,Ea=new wn,ls=new D,cs=new D,hs=new D,di=new D,fi=new D,Pi=new D,Ks=new D,Ta=new D,wa=new D,Ii=new D;function Jl(i,e,t,n,s){for(let r=0,a=i.length-3;r<=a;r+=3){Ii.fromArray(i,r);let o=s.x*Math.abs(Ii.x)+s.y*Math.abs(Ii.y)+s.z*Math.abs(Ii.z),c=e.dot(Ii),l=t.dot(Ii),h=n.dot(Ii);if(Math.max(-Math.max(c,l,h),Math.min(c,l,h))>o)return!1}return!0}var Ft=new D,Aa=new pe,_f=0,ln=class extends Un{constructor(e,t,n=!1){if(super(),Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:_f++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=Du,this.updateRanges=[],this.gpuType=Cn,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[e+s]=t.array[n+s];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)Aa.fromBufferAttribute(this,t),Aa.applyMatrix3(e),this.setXY(t,Aa.x,Aa.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)Ft.fromBufferAttribute(this,t),Ft.applyMatrix3(e),this.setXYZ(t,Ft.x,Ft.y,Ft.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)Ft.fromBufferAttribute(this,t),Ft.applyMatrix4(e),this.setXYZ(t,Ft.x,Ft.y,Ft.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Ft.fromBufferAttribute(this,t),Ft.applyNormalMatrix(e),this.setXYZ(t,Ft.x,Ft.y,Ft.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Ft.fromBufferAttribute(this,t),Ft.transformDirection(e),this.setXYZ(t,Ft.x,Ft.y,Ft.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=_s(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=an(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=_s(t,this.array)),t}setX(e,t){return this.normalized&&(t=an(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=_s(t,this.array)),t}setY(e,t){return this.normalized&&(t=an(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=_s(t,this.array)),t}setZ(e,t){return this.normalized&&(t=an(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=_s(t,this.array)),t}setW(e,t){return this.normalized&&(t=an(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=an(t,this.array),n=an(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,s){return e*=this.itemSize,this.normalized&&(t=an(t,this.array),n=an(n,this.array),s=an(s,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this}setXYZW(e,t,n,s,r){return e*=this.itemSize,this.normalized&&(t=an(t,this.array),n=an(n,this.array),s=an(s,this.array),r=an(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return e.name=this.name,e.usage=this.usage,e.gpuType=this.gpuType,e}dispose(){this.dispatchEvent({type:"dispose"})}};var ur=class extends ln{constructor(e,t,n){super(new Uint16Array(e),t,n)}};var dr=class extends ln{constructor(e,t,n){super(new Uint32Array(e),t,n)}};var gt=class extends ln{constructor(e,t,n){super(new Float32Array(e),t,n)}},xf=new wn,$s=new D,Kl=new D,gi=class{constructor(e=new D,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let n=this.center;t!==void 0?n.copy(t):xf.setFromPoints(e).getCenter(n);let s=0;for(let r=0,a=e.length;r<a;r++)s=Math.max(s,n.distanceToSquared(e[r]));return this.radius=Math.sqrt(s),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;$s.subVectors(e,this.center);let t=$s.lengthSq();if(t>this.radius*this.radius){let n=Math.sqrt(t),s=(n-this.radius)*.5;this.center.addScaledVector($s,s/n),this.radius+=s}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(Kl.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint($s.copy(e.center).add(Kl)),this.expandByPoint($s.copy(e.center).sub(Kl))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}},vf=0,En=new Ne,$l=new Rt,us=new D,mn=new wn,Qs=new wn,Wt=new D,zt=class i extends Un{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:vf++}),this.uuid=qi(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Hd(e)?dr:ur)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let r=new st().getNormalMatrix(e);n.applyNormalMatrix(r),n.needsUpdate=!0}let s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(e),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return En.makeRotationFromQuaternion(e),this.applyMatrix4(En),this}rotateX(e){return En.makeRotationX(e),this.applyMatrix4(En),this}rotateY(e){return En.makeRotationY(e),this.applyMatrix4(En),this}rotateZ(e){return En.makeRotationZ(e),this.applyMatrix4(En),this}translate(e,t,n){return En.makeTranslation(e,t,n),this.applyMatrix4(En),this}scale(e,t,n){return En.makeScale(e,t,n),this.applyMatrix4(En),this}lookAt(e){return $l.lookAt(e),$l.updateMatrix(),this.applyMatrix4($l.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(us).negate(),this.translate(us.x,us.y,us.z),this}setFromPoints(e){let t=this.getAttribute("position");if(t===void 0){let n=[];for(let s=0,r=e.length;s<r;s++){let a=e[s];n.push(a.x,a.y,a.z||0)}this.setAttribute("position",new gt(n,3))}else{let n=Math.min(e.length,t.count);for(let s=0;s<n;s++){let r=e[s];t.setXYZ(s,r.x,r.y,r.z||0)}e.length>t.count&&je("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new wn);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Je("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new D(-1/0,-1/0,-1/0),new D(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,s=t.length;n<s;n++){let r=t[n];mn.setFromBufferAttribute(r),this.morphTargetsRelative?(Wt.addVectors(this.boundingBox.min,mn.min),this.boundingBox.expandByPoint(Wt),Wt.addVectors(this.boundingBox.max,mn.max),this.boundingBox.expandByPoint(Wt)):(this.boundingBox.expandByPoint(mn.min),this.boundingBox.expandByPoint(mn.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Je('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new gi);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Je("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new D,1/0);return}if(e){let n=this.boundingSphere.center;if(mn.setFromBufferAttribute(e),t)for(let r=0,a=t.length;r<a;r++){let o=t[r];Qs.setFromBufferAttribute(o),this.morphTargetsRelative?(Wt.addVectors(mn.min,Qs.min),mn.expandByPoint(Wt),Wt.addVectors(mn.max,Qs.max),mn.expandByPoint(Wt)):(mn.expandByPoint(Qs.min),mn.expandByPoint(Qs.max))}mn.getCenter(n);let s=0;for(let r=0,a=e.count;r<a;r++)Wt.fromBufferAttribute(e,r),s=Math.max(s,n.distanceToSquared(Wt));if(t)for(let r=0,a=t.length;r<a;r++){let o=t[r],c=this.morphTargetsRelative;for(let l=0,h=o.count;l<h;l++)Wt.fromBufferAttribute(o,l),c&&(us.fromBufferAttribute(e,l),Wt.add(us)),s=Math.max(s,n.distanceToSquared(Wt))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&Je('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){Je("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let n=t.position,s=t.normal,r=t.uv,a=this.getAttribute("tangent");(a===void 0||a.count!==n.count)&&(a=new ln(new Float32Array(4*n.count),4),this.setAttribute("tangent",a));let o=[],c=[];for(let x=0;x<n.count;x++)o[x]=new D,c[x]=new D;let l=new D,h=new D,u=new D,d=new pe,f=new pe,p=new pe,_=new D,m=new D;function g(x,w,C){l.fromBufferAttribute(n,x),h.fromBufferAttribute(n,w),u.fromBufferAttribute(n,C),d.fromBufferAttribute(r,x),f.fromBufferAttribute(r,w),p.fromBufferAttribute(r,C),h.sub(l),u.sub(l),f.sub(d),p.sub(d);let I=1/(f.x*p.y-p.x*f.y);isFinite(I)&&(_.copy(h).multiplyScalar(p.y).addScaledVector(u,-f.y).multiplyScalar(I),m.copy(u).multiplyScalar(f.x).addScaledVector(h,-p.x).multiplyScalar(I),o[x].add(_),o[w].add(_),o[C].add(_),c[x].add(m),c[w].add(m),c[C].add(m))}let S=this.groups;S.length===0&&(S=[{start:0,count:e.count}]);for(let x=0,w=S.length;x<w;++x){let C=S[x],I=C.start,U=C.count;for(let z=I,O=I+U;z<O;z+=3)g(e.getX(z+0),e.getX(z+1),e.getX(z+2))}let A=new D,M=new D,E=new D,v=new D;function b(x){E.fromBufferAttribute(s,x),v.copy(E);let w=o[x];A.copy(w),A.sub(E.multiplyScalar(E.dot(w))).normalize(),M.crossVectors(v,w);let I=M.dot(c[x])<0?-1:1;a.setXYZW(x,A.x,A.y,A.z,I)}for(let x=0,w=S.length;x<w;++x){let C=S[x],I=C.start,U=C.count;for(let z=I,O=I+U;z<O;z+=3)b(e.getX(z+0)),b(e.getX(z+1)),b(e.getX(z+2))}this._transformed=!0}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0||n.count!==t.count)n=new ln(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let d=0,f=n.count;d<f;d++)n.setXYZ(d,0,0,0);let s=new D,r=new D,a=new D,o=new D,c=new D,l=new D,h=new D,u=new D;if(e)for(let d=0,f=e.count;d<f;d+=3){let p=e.getX(d+0),_=e.getX(d+1),m=e.getX(d+2);s.fromBufferAttribute(t,p),r.fromBufferAttribute(t,_),a.fromBufferAttribute(t,m),h.subVectors(a,r),u.subVectors(s,r),h.cross(u),o.fromBufferAttribute(n,p),c.fromBufferAttribute(n,_),l.fromBufferAttribute(n,m),o.add(h),c.add(h),l.add(h),n.setXYZ(p,o.x,o.y,o.z),n.setXYZ(_,c.x,c.y,c.z),n.setXYZ(m,l.x,l.y,l.z)}else for(let d=0,f=t.count;d<f;d+=3)s.fromBufferAttribute(t,d+0),r.fromBufferAttribute(t,d+1),a.fromBufferAttribute(t,d+2),h.subVectors(a,r),u.subVectors(s,r),h.cross(u),n.setXYZ(d+0,h.x,h.y,h.z),n.setXYZ(d+1,h.x,h.y,h.z),n.setXYZ(d+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)Wt.fromBufferAttribute(e,t),Wt.normalize(),e.setXYZ(t,Wt.x,Wt.y,Wt.z)}toNonIndexed(){function e(o,c){let l=o.array,h=o.itemSize,u=o.normalized,d=new l.constructor(c.length*h),f=0,p=0;for(let _=0,m=c.length;_<m;_++){o.isInterleavedBufferAttribute?f=c[_]*o.data.stride+o.offset:f=c[_]*h;for(let g=0;g<h;g++)d[p++]=l[f++]}return new ln(d,h,u)}if(this.index===null)return je("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new i,n=this.index.array,s=this.attributes;for(let o in s){let c=s[o],l=e(c,n);t.setAttribute(o,l)}let r=this.morphAttributes;for(let o in r){let c=[],l=r[o];for(let h=0,u=l.length;h<u;h++){let d=l[h],f=e(d,n);c.push(f)}t.morphAttributes[o]=c}t.morphTargetsRelative=this.morphTargetsRelative;let a=this.groups;for(let o=0,c=a.length;o<c;o++){let l=a[o];t.addGroup(l.start,l.count,l.materialIndex)}return t}toJSON(){let e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,e.name=this.name,Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let c=this.parameters;for(let l in c)c[l]!==void 0&&(e[l]=c[l]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let n=this.attributes;for(let c in n){let l=n[c];e.data.attributes[c]=l.toJSON(e.data)}let s={},r=!1;for(let c in this.morphAttributes){let l=this.morphAttributes[c],h=[];for(let u=0,d=l.length;u<d;u++){let f=l[u];h.push(f.toJSON(e.data))}h.length>0&&(s[c]=h,r=!0)}r&&(e.data.morphAttributes=s,e.data.morphTargetsRelative=this.morphTargetsRelative);let a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));let o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let n=e.index;n!==null&&this.setIndex(n.clone());let s=e.attributes;for(let l in s){let h=s[l];this.setAttribute(l,h.clone(t))}let r=e.morphAttributes;for(let l in r){let h=[],u=r[l];for(let d=0,f=u.length;d<f;d++)h.push(u[d].clone(t));this.morphAttributes[l]=h}this.morphTargetsRelative=e.morphTargetsRelative;let a=e.groups;for(let l=0,h=a.length;l<h;l++){let u=a[l];this.addGroup(u.start,u.count,u.materialIndex)}let o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());let c=e.boundingSphere;return c!==null&&(this.boundingSphere=c.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}};var Ql=new D,yf=new D,Mf=new st,on=class{constructor(e=new D(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,s){return this.normal.set(e,t,n),this.constant=s,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){let s=Ql.subVectors(n,t).cross(yf.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(s,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,n=!0){let s=e.delta(Ql),r=this.normal.dot(s);if(r===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let a=-(e.start.dot(this.normal)+this.constant)/r;return n===!0&&(a<0||a>1)?null:t.copy(e.start).addScaledVector(s,a)}intersectsLine(e){let t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let n=t||Mf.getNormalMatrix(e),s=this.coplanarPoint(Ql).applyMatrix4(e),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(e){return this.normal.fromArray(e.normal),this.constant=e.constant,this}},Sf=0,Gn=class extends Un{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Sf++}),this.uuid=qi(),this.name="",this.type="Material",this.blending=Us,this.side=Si,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Ec,this.blendDst=Tc,this.blendEquation=An,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new tt(0,0,0),this.blendAlpha=0,this.depthFunc=vs,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Tu,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Wa,this.stencilZFail=Wa,this.stencilZPass=Wa,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let n=e[t];if(n===void 0){je(`Material: parameter '${t}' has value of undefined.`);continue}let s=this[t];if(s===void 0){je(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector2&&n&&n.isVector2||s&&s.isEuler&&n&&n.isEuler||s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});let n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,n.blending=this.blending,n.side=this.side,n.shadowSide=this.shadowSide,n.vertexColors=this.vertexColors,n.opacity=this.opacity,n.transparent=this.transparent,n.blendSrc=this.blendSrc,n.blendDst=this.blendDst,n.blendEquation=this.blendEquation,n.blendSrcAlpha=this.blendSrcAlpha,n.blendDstAlpha=this.blendDstAlpha,n.blendEquationAlpha=this.blendEquationAlpha,n.blendColor=this.blendColor.getHex(),n.blendAlpha=this.blendAlpha,n.depthFunc=this.depthFunc,n.depthTest=this.depthTest,n.depthWrite=this.depthWrite,n.colorWrite=this.colorWrite,n.clipIntersection=this.clipIntersection,n.clipShadows=this.clipShadows,n.stencilWriteMask=this.stencilWriteMask,n.stencilFunc=this.stencilFunc,n.stencilRef=this.stencilRef,n.stencilFuncMask=this.stencilFuncMask,n.stencilFail=this.stencilFail,n.stencilZFail=this.stencilZFail,n.stencilZPass=this.stencilZPass,n.stencilWrite=this.stencilWrite,n.polygonOffset=this.polygonOffset,n.polygonOffsetFactor=this.polygonOffsetFactor,n.polygonOffsetUnits=this.polygonOffsetUnits,n.dithering=this.dithering,n.alphaTest=this.alphaTest,n.alphaHash=this.alphaHash,n.alphaToCoverage=this.alphaToCoverage,n.premultipliedAlpha=this.premultipliedAlpha,n.forceSinglePass=this.forceSinglePass,n.allowOverride=this.allowOverride,n.visible=this.visible,n.toneMapped=this.toneMapped,n.name=this.name,this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.retroreflectivity!==void 0&&(n.retroreflectivity=this.retroreflectivity),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0&&(n.clippingPlanes=this.clippingPlanes.map(r=>r.toJSON())),this.rotation!==void 0&&(n.rotation=this.rotation),this.depthPacking!==void 0&&(n.depthPacking=this.depthPacking),this.linewidth!==void 0&&(n.linewidth=this.linewidth),this.linecap!==void 0&&(n.linecap=this.linecap),this.linejoin!==void 0&&(n.linejoin=this.linejoin),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.wireframe!==void 0&&(n.wireframe=this.wireframe),this.wireframeLinewidth!==void 0&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==void 0&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==void 0&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading!==void 0&&(n.flatShading=this.flatShading),this.fog!==void 0&&(n.fog=this.fog),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){let a=[];for(let o in r){let c=r[o];delete c.metadata,a.push(c)}return a}if(t){let r=s(e.textures),a=s(e.images);r.length>0&&(n.textures=r),a.length>0&&(n.images=a)}return n}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new tt().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.retroreflectivity!==void 0&&(this.retroreflectivity=e.retroreflectivity),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.clippingPlanes!==void 0&&(this.clippingPlanes=e.clippingPlanes.map(n=>new on().fromJSON(n))),e.clipIntersection!==void 0&&(this.clipIntersection=e.clipIntersection),e.clipShadows!==void 0&&(this.clipShadows=e.clipShadows),e.depthPacking!==void 0&&(this.depthPacking=e.depthPacking),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.linecap!==void 0&&(this.linecap=e.linecap),e.linejoin!==void 0&&(this.linejoin=e.linejoin),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?this.vertexColors=e.vertexColors>0:this.vertexColors=e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let n=e.normalScale;Array.isArray(n)===!1&&(n=[n,n]),this.normalScale=new pe().fromArray(n)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new pe().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,n=null;if(t!==null){let s=t.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}};var ni=new D,ec=new D,Ca=new D,Ra=new D,Bi=class{constructor(e=new D,t=new D(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,ni)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=ni.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(ni.copy(this.origin).addScaledVector(this.direction,t),ni.distanceToSquared(e))}distanceSqToSegment(e,t,n,s){ec.copy(e).add(t).multiplyScalar(.5),Ca.copy(t).sub(e).normalize(),Ra.copy(this.origin).sub(ec);let r=e.distanceTo(t)*.5,a=-this.direction.dot(Ca),o=Ra.dot(this.direction),c=-Ra.dot(Ca),l=Ra.lengthSq(),h=Math.abs(1-a*a),u,d,f,p;if(h>0)if(u=a*c-o,d=a*o-c,p=r*h,u>=0)if(d>=-p)if(d<=p){let _=1/h;u*=_,d*=_,f=u*(u+a*d+2*o)+d*(a*u+d+2*c)+l}else d=r,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*c)+l;else d=-r,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*c)+l;else d<=-p?(u=Math.max(0,-(-a*r+o)),d=u>0?-r:Math.min(Math.max(-r,-c),r),f=-u*u+d*(d+2*c)+l):d<=p?(u=0,d=Math.min(Math.max(-r,-c),r),f=d*(d+2*c)+l):(u=Math.max(0,-(a*r+o)),d=u>0?r:Math.min(Math.max(-r,-c),r),f=-u*u+d*(d+2*c)+l);else d=a>0?-r:r,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*c)+l;return n&&n.copy(this.origin).addScaledVector(this.direction,u),s&&s.copy(ec).addScaledVector(Ca,d),f}intersectSphere(e,t){if(e.radius<0)return null;ni.subVectors(e.center,this.origin);let n=ni.dot(this.direction),s=ni.dot(ni)-n*n,r=e.radius*e.radius;if(s>r)return null;let a=Math.sqrt(r-s),o=n-a,c=n+a;return c<0?null:o<0?this.at(c,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){let n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,s,r,a,o,c,l=1/this.direction.x,h=1/this.direction.y,u=1/this.direction.z,d=this.origin;return l>=0?(n=(e.min.x-d.x)*l,s=(e.max.x-d.x)*l):(n=(e.max.x-d.x)*l,s=(e.min.x-d.x)*l),h>=0?(r=(e.min.y-d.y)*h,a=(e.max.y-d.y)*h):(r=(e.max.y-d.y)*h,a=(e.min.y-d.y)*h),n>a||r>s||((r>n||isNaN(n))&&(n=r),(a<s||isNaN(s))&&(s=a),u>=0?(o=(e.min.z-d.z)*u,c=(e.max.z-d.z)*u):(o=(e.max.z-d.z)*u,c=(e.min.z-d.z)*u),n>c||o>s)||((o>n||n!==n)&&(n=o),(c<s||s!==s)&&(s=c),s<0)?null:this.at(n>=0?n:s,t)}intersectsBox(e){return this.intersectBox(e,ni)!==null}intersectTriangle(e,t,n,s,r){let a=this.origin,o=this.direction,c=o.x,l=o.y,h=o.z,u=e.x-a.x,d=e.y-a.y,f=e.z-a.z,p=t.x-a.x,_=t.y-a.y,m=t.z-a.z,g=n.x-a.x,S=n.y-a.y,A=n.z-a.z,M=Math.abs(c),E=Math.abs(l),v=Math.abs(h),b,x,w,C,I,U,z,O,k,j,R,F;if(M>=E&&M>=v?(w=c,U=u,k=p,F=g,c>=0?(b=l,x=h,C=d,I=f,z=_,O=m,j=S,R=A):(b=h,x=l,C=f,I=d,z=m,O=_,j=A,R=S)):E>=v?(w=l,U=d,k=_,F=S,l>=0?(b=h,x=c,C=f,I=u,z=m,O=p,j=A,R=g):(b=c,x=h,C=u,I=f,z=p,O=m,j=g,R=A)):(w=h,U=f,k=m,F=A,h>=0?(b=c,x=l,C=u,I=d,z=p,O=_,j=g,R=S):(b=l,x=c,C=d,I=u,z=_,O=p,j=S,R=g)),w===0)return null;let G=b/w,q=x/w,X=1/w,he=C-G*U,ge=I-q*U,Fe=z-G*k,Te=O-q*k,Ve=j-G*F,ee=R-q*F,ie=Ve*Te-ee*Fe,fe=he*ee-ge*Ve,Pe=Fe*ge-Te*he;if(s){if(ie<0||fe<0||Pe<0)return null}else if((ie<0||fe<0||Pe<0)&&(ie>0||fe>0||Pe>0))return null;let ye=ie+fe+Pe;if(ye===0)return null;let Oe=X*(ie*U+fe*k+Pe*F);return(ye>0?Oe<0:Oe>0)?null:this.at(Oe/ye,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},_n=class extends Gn{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new tt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new gn,this.combine=Ro,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},Bh=new Ne,Di=new Bi,Pa=new gi,zh=new D,Ia=new D,Da=new D,La=new D,tc=new D,Na=new D,Vh=new D,Ua=new D,ut=class extends Rt{constructor(e=new zt,t=new _n){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){let o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(e,t){let n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,a=n.morphTargetsRelative;t.fromBufferAttribute(s,e);let o=this.morphTargetInfluences;if(r&&o){Na.set(0,0,0);for(let c=0,l=r.length;c<l;c++){let h=o[c],u=r[c];h!==0&&(tc.fromBufferAttribute(u,e),a?Na.addScaledVector(tc,h):Na.addScaledVector(tc.sub(t),h))}t.add(Na)}return t}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),Pa.copy(n.boundingSphere),Pa.applyMatrix4(r),Di.copy(e.ray).recast(e.near),!(Pa.containsPoint(Di.origin)===!1&&(Di.intersectSphere(Pa,zh)===null||Di.origin.distanceToSquared(zh)>(e.far-e.near)**2))&&(Bh.copy(r).invert(),Di.copy(e.ray).applyMatrix4(Bh),!(n.boundingBox!==null&&Di.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,Di)))}_computeIntersections(e,t,n){let s,r=this.geometry,a=this.material,o=r.index,c=r.attributes.position,l=r.attributes.uv,h=r.attributes.uv1,u=r.attributes.normal,d=r.groups,f=r.drawRange;if(o!==null)if(Array.isArray(a))for(let p=0,_=d.length;p<_;p++){let m=d[p],g=a[m.materialIndex],S=Math.max(m.start,f.start),A=Math.min(o.count,Math.min(m.start+m.count,f.start+f.count));for(let M=S,E=A;M<E;M+=3){let v=o.getX(M),b=o.getX(M+1),x=o.getX(M+2);s=Fa(this,g,e,n,l,h,u,v,b,x),s&&(s.faceIndex=Math.floor(M/3),s.face.materialIndex=m.materialIndex,t.push(s))}}else{let p=Math.max(0,f.start),_=Math.min(o.count,f.start+f.count);for(let m=p,g=_;m<g;m+=3){let S=o.getX(m),A=o.getX(m+1),M=o.getX(m+2);s=Fa(this,a,e,n,l,h,u,S,A,M),s&&(s.faceIndex=Math.floor(m/3),t.push(s))}}else if(c!==void 0)if(Array.isArray(a))for(let p=0,_=d.length;p<_;p++){let m=d[p],g=a[m.materialIndex],S=Math.max(m.start,f.start),A=Math.min(c.count,Math.min(m.start+m.count,f.start+f.count));for(let M=S,E=A;M<E;M+=3){let v=M,b=M+1,x=M+2;s=Fa(this,g,e,n,l,h,u,v,b,x),s&&(s.faceIndex=Math.floor(M/3),s.face.materialIndex=m.materialIndex,t.push(s))}}else{let p=Math.max(0,f.start),_=Math.min(c.count,f.start+f.count);for(let m=p,g=_;m<g;m+=3){let S=m,A=m+1,M=m+2;s=Fa(this,a,e,n,l,h,u,S,A,M),s&&(s.faceIndex=Math.floor(m/3),t.push(s))}}}};function bf(i,e,t,n,s,r,a,o){let c;if(e.side===Zt?c=n.intersectTriangle(a,r,s,!0,o):c=n.intersectTriangle(s,r,a,e.side===Si,o),c===null)return null;Ua.copy(o),Ua.applyMatrix4(i.matrixWorld);let l=t.ray.origin.distanceTo(Ua);return l<t.near||l>t.far?null:{distance:l,point:Ua.clone(),object:i}}function Fa(i,e,t,n,s,r,a,o,c,l){i.getVertexPosition(o,Ia),i.getVertexPosition(c,Da),i.getVertexPosition(l,La);let h=bf(i,e,t,n,Ia,Da,La,Vh);if(h){let u=new D;mi.getBarycoord(Vh,Ia,Da,La,u),s&&(h.uv=mi.getInterpolatedAttribute(s,o,c,l,u,new pe)),r&&(h.uv1=mi.getInterpolatedAttribute(r,o,c,l,u,new pe)),a&&(h.normal=mi.getInterpolatedAttribute(a,o,c,l,u,new D),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));let d={a:o,b:c,c:l,normal:new D,materialIndex:0};mi.getNormal(Ia,Da,La,d.normal),h.face=d,h.barycoord=u}return h}var si=class extends en{constructor(e=null,t=1,n=1,s,r,a,o,c,l=Dt,h=Dt,u,d){super(null,a,o,c,l,h,s,r,u,d),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var ws=class extends ln{constructor(e,t,n,s=1){super(e,t,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=s}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){let e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}},ds=new Ne,kh=new Ne,Oa=[],Hh=new wn,Ef=new Ne,er=new ut,tr=new gi,zi=class extends ut{constructor(e,t,n){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new ws(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let s=0;s<n;s++)this.setMatrixAt(s,Ef)}computeBoundingBox(){let e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new wn),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,ds),Hh.copy(e.boundingBox).applyMatrix4(ds),this.boundingBox.union(Hh)}computeBoundingSphere(){let e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new gi),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,ds),tr.copy(e.boundingSphere).applyMatrix4(ds),this.boundingSphere.union(tr)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){return this.instanceColor===null?t.setRGB(1,1,1):t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){return t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){let n=t.morphTargetInfluences,s=this.morphTexture.source.data.data,r=n.length+1,a=e*r+1;for(let o=0;o<n.length;o++)n[o]=s[a+o]}raycast(e,t){let n=this.matrixWorld,s=this.count;if(er.geometry=this.geometry,er.material=this.material,er.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),tr.copy(this.boundingSphere),tr.applyMatrix4(n),e.ray.intersectsSphere(tr)!==!1))for(let r=0;r<s;r++){this.getMatrixAt(r,ds),kh.multiplyMatrices(n,ds),er.matrixWorld=kh,er.raycast(e,Oa);for(let a=0,o=Oa.length;a<o;a++){let c=Oa[a];c.instanceId=r,c.object=this,t.push(c)}Oa.length=0}}setColorAt(e,t){return this.instanceColor===null&&(this.instanceColor=new ws(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3),this}setMatrixAt(e,t){return t.toArray(this.instanceMatrix.array,e*16),this}setMorphAt(e,t){let n=t.morphTargetInfluences,s=n.length+1;this.morphTexture===null&&(this.morphTexture=new si(new Float32Array(s*this.count),s,this.count,Fo,Cn));let r=this.morphTexture.source.data.data,a=0;for(let l=0;l<n.length;l++)a+=n[l];let o=this.geometry.morphTargetsRelative?1:1-a,c=s*e;return r[c]=o,r.set(n,c+1),this}updateMorphTargets(){}dispose(){super.dispose(),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}},Li=new gi,Tf=new pe(.5,.5),Ba=new D,As=class{constructor(e=new on,t=new on,n=new on,s=new on,r=new on,a=new on){this.planes=[e,t,n,s,r,a]}set(e,t,n,s,r,a){let o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(s),o[4].copy(r),o[5].copy(a),this}copy(e){let t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=Nn,n=!1){let s=this.planes,r=e.elements,a=r[0],o=r[1],c=r[2],l=r[3],h=r[4],u=r[5],d=r[6],f=r[7],p=r[8],_=r[9],m=r[10],g=r[11],S=r[12],A=r[13],M=r[14],E=r[15];if(s[0].setComponents(l-a,f-h,g-p,E-S).normalize(),s[1].setComponents(l+a,f+h,g+p,E+S).normalize(),s[2].setComponents(l+o,f+u,g+_,E+A).normalize(),s[3].setComponents(l-o,f-u,g-_,E-A).normalize(),n)s[4].setComponents(c,d,m,M).normalize(),s[5].setComponents(l-c,f-d,g-m,E-M).normalize();else if(s[4].setComponents(l-c,f-d,g-m,E-M).normalize(),t===Nn)s[5].setComponents(l+c,f+d,g+m,E+M).normalize();else if(t===ys)s[5].setComponents(c,d,m,M).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),Li.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),Li.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(Li)}intersectsSprite(e){Li.center.set(0,0,0);let t=Tf.distanceTo(e.center);return Li.radius=.7071067811865476+t,Li.applyMatrix4(e.matrixWorld),this.intersectsSphere(Li)}intersectsSphere(e){let t=this.planes,n=e.center,s=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(e){let t=this.planes;for(let n=0;n<6;n++){let s=t[n];if(Ba.x=s.normal.x>0?e.max.x:e.min.x,Ba.y=s.normal.y>0?e.max.y:e.min.y,Ba.z=s.normal.z>0?e.max.z:e.min.z,s.distanceToPoint(Ba)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};var fr=class extends en{constructor(e=[],t=bi,n,s,r,a,o,c,l,h){super(e,t,n,s,r,a,o,c,l,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}},pr=class extends en{constructor(e,t,n,s,r,a,o,c,l){super(e,t,n,s,r,a,o,c,l),this.isCanvasTexture=!0,this.needsUpdate=!0}};var Wn=class extends en{constructor(e,t,n=On,s,r,a,o=Dt,c=Dt,l,h=Hn,u=1){if(h!==Hn&&h!==qn)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let d={width:e,height:t,depth:u};super(d,s,r,a,o,c,h,n,l),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new bs(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return t.compareFunction=this.compareFunction,t}},so=class extends Wn{constructor(e,t=On,n=bi,s,r,a=Dt,o=Dt,c,l=Hn){let h={width:e,height:e,depth:1},u=[h,h,h,h,h,h];super(e,e,t,n,s,r,a,o,c,l),this.image=u,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}},mr=class extends en{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}},Lt=class i extends zt{constructor(e=1,t=1,n=1,s=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:s,heightSegments:r,depthSegments:a};let o=this;s=Math.floor(s),r=Math.floor(r),a=Math.floor(a);let c=[],l=[],h=[],u=[],d=0,f=0;p("z","y","x",-1,-1,n,t,e,a,r,0),p("z","y","x",1,-1,n,t,-e,a,r,1),p("x","z","y",1,1,e,n,t,s,a,2),p("x","z","y",1,-1,e,n,-t,s,a,3),p("x","y","z",1,-1,e,t,n,s,r,4),p("x","y","z",-1,-1,e,t,-n,s,r,5),this.setIndex(c),this.setAttribute("position",new gt(l,3)),this.setAttribute("normal",new gt(h,3)),this.setAttribute("uv",new gt(u,2));function p(_,m,g,S,A,M,E,v,b,x,w){let C=M/b,I=E/x,U=M/2,z=E/2,O=v/2,k=b+1,j=x+1,R=0,F=0,G=new D;for(let q=0;q<j;q++){let X=q*I-z;for(let he=0;he<k;he++){let ge=he*C-U;G[_]=ge*S,G[m]=X*A,G[g]=O,l.push(G.x,G.y,G.z),G[_]=0,G[m]=0,G[g]=v>0?1:-1,h.push(G.x,G.y,G.z),u.push(he/b),u.push(1-q/x),R+=1}}for(let q=0;q<x;q++)for(let X=0;X<b;X++){let he=d+X+k*q,ge=d+X+k*(q+1),Fe=d+(X+1)+k*(q+1),Te=d+(X+1)+k*q;c.push(he,ge,Te),c.push(ge,Fe,Te),F+=6}o.addGroup(f,F,w),f+=F,d+=R}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}};var cn=class i extends zt{constructor(e=1,t=1,n=1,s=32,r=1,a=!1,o=0,c=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:s,heightSegments:r,openEnded:a,thetaStart:o,thetaLength:c};let l=this;s=Math.floor(s),r=Math.floor(r);let h=[],u=[],d=[],f=[],p=0,_=[],m=n/2,g=0;S(),a===!1&&(e>0&&A(!0),t>0&&A(!1)),this.setIndex(h),this.setAttribute("position",new gt(u,3)),this.setAttribute("normal",new gt(d,3)),this.setAttribute("uv",new gt(f,2));function S(){let M=new D,E=new D,v=0,b=(t-e)/n;for(let x=0;x<=r;x++){let w=[],C=x/r,I=C*(t-e)+e;for(let U=0;U<=s;U++){let z=U/s,O=z*c+o,k=Math.sin(O),j=Math.cos(O);E.x=I*k,E.y=-C*n+m,E.z=I*j,u.push(E.x,E.y,E.z),M.set(k,b,j).normalize(),d.push(M.x,M.y,M.z),f.push(z,1-C),w.push(p++)}_.push(w)}for(let x=0;x<s;x++)for(let w=0;w<r;w++){let C=_[w][x],I=_[w+1][x],U=_[w+1][x+1],z=_[w][x+1];(e>0||w!==0)&&(h.push(C,I,z),v+=3),(t>0||w!==r-1)&&(h.push(I,U,z),v+=3)}l.addGroup(g,v,0),g+=v}function A(M){let E=p,v=new pe,b=new D,x=0,w=M===!0?e:t,C=M===!0?1:-1;for(let U=1;U<=s;U++)u.push(0,m*C,0),d.push(0,C,0),f.push(.5,.5),p++;let I=p;for(let U=0;U<=s;U++){let O=U/s*c+o,k=Math.cos(O),j=Math.sin(O);b.x=w*j,b.y=m*C,b.z=w*k,u.push(b.x,b.y,b.z),d.push(0,C,0),v.x=k*.5+.5,v.y=j*.5*C+.5,f.push(v.x,v.y),p++}for(let U=0;U<s;U++){let z=E+U,O=I+U;M===!0?h.push(O,O+1,z):h.push(O+1,O,z),x+=3}l.addGroup(g,x,M===!0?1:2),g+=x}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}};var xn=class{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){je("Curve: .getPoint() not implemented.")}getPointAt(e,t){let n=this.getUtoTmapping(e);return this.getPoint(n,t)}getPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return t}getSpacedPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPointAt(n/e));return t}getLength(){let e=this.getLengths();return e[e.length-1]}getLengths(e=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===e+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let t=[],n,s=this.getPoint(0),r=0;t.push(0);for(let a=1;a<=e;a++)n=this.getPoint(a/e),r+=n.distanceTo(s),t.push(r),s=n;return this.cacheArcLengths=t,t}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(e,t=null){let n=this.getLengths(),s=0,r=n.length,a;t?a=t:a=e*n[r-1];let o=0,c=r-1,l;for(;o<=c;)if(s=Math.floor(o+(c-o)/2),l=n[s]-a,l<0)o=s+1;else if(l>0)c=s-1;else{c=s;break}if(s=c,n[s]===a)return s/(r-1);let h=n[s],d=n[s+1]-h,f=(a-h)/d;return(s+f)/(r-1)}getTangent(e,t){let s=e-1e-4,r=e+1e-4;s<0&&(s=0),r>1&&(r=1);let a=this.getPoint(s),o=this.getPoint(r),c=t||(a.isVector2?new pe:new D);return c.copy(o).sub(a).normalize(),c}getTangentAt(e,t){let n=this.getUtoTmapping(e);return this.getTangent(n,t)}computeFrenetFrames(e,t=!1){let n=new D,s=[],r=[],a=[],o=new D,c=new Ne;for(let f=0;f<=e;f++){let p=f/e;s[f]=this.getTangentAt(p,new D)}r[0]=new D,a[0]=new D;let l=Number.MAX_VALUE,h=Math.abs(s[0].x),u=Math.abs(s[0].y),d=Math.abs(s[0].z);h<=l&&(l=h,n.set(1,0,0)),u<=l&&(l=u,n.set(0,1,0)),d<=l&&n.set(0,0,1),o.crossVectors(s[0],n).normalize(),r[0].crossVectors(s[0],o),a[0].crossVectors(s[0],r[0]);for(let f=1;f<=e;f++){if(r[f]=r[f-1].clone(),a[f]=a[f-1].clone(),o.crossVectors(s[f-1],s[f]),o.length()>Number.EPSILON){o.normalize();let p=Math.acos(at(s[f-1].dot(s[f]),-1,1));r[f].applyMatrix4(c.makeRotationAxis(o,p))}a[f].crossVectors(s[f],r[f])}if(t===!0){let f=Math.acos(at(r[0].dot(r[e]),-1,1));f/=e,s[0].dot(o.crossVectors(r[0],r[e]))>0&&(f=-f);for(let p=1;p<=e;p++)r[p].applyMatrix4(c.makeRotationAxis(s[p],f*p)),a[p].crossVectors(s[p],r[p])}return{tangents:s,normals:r,binormals:a}}clone(){return new this.constructor().copy(this)}copy(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}toJSON(){let e={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return e.arcLengthDivisions=this.arcLengthDivisions,e.type=this.type,e}fromJSON(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}},Cs=class extends xn{constructor(e=0,t=0,n=1,s=1,r=0,a=Math.PI*2,o=!1,c=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=e,this.aY=t,this.xRadius=n,this.yRadius=s,this.aStartAngle=r,this.aEndAngle=a,this.aClockwise=o,this.aRotation=c}getPoint(e,t=new pe){let n=t,s=Math.PI*2,r=this.aEndAngle-this.aStartAngle,a=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=s;for(;r>s;)r-=s;r<Number.EPSILON&&(a?r=0:r=s),this.aClockwise===!0&&!a&&(r===s?r=-s:r=r-s);let o=this.aStartAngle+e*r,c=this.aX+this.xRadius*Math.cos(o),l=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){let h=Math.cos(this.aRotation),u=Math.sin(this.aRotation),d=c-this.aX,f=l-this.aY;c=d*h-f*u+this.aX,l=d*u+f*h+this.aY}return n.set(c,l)}copy(e){return super.copy(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}toJSON(){let e=super.toJSON();return e.aX=this.aX,e.aY=this.aY,e.xRadius=this.xRadius,e.yRadius=this.yRadius,e.aStartAngle=this.aStartAngle,e.aEndAngle=this.aEndAngle,e.aClockwise=this.aClockwise,e.aRotation=this.aRotation,e}fromJSON(e){return super.fromJSON(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}},ro=class extends Cs{constructor(e,t,n,s,r,a){super(e,t,n,n,s,r,a),this.isArcCurve=!0,this.type="ArcCurve"}};function Fc(){let i=0,e=0,t=0,n=0;function s(r,a,o,c){i=r,e=o,t=-3*r+3*a-2*o-c,n=2*r-2*a+o+c}return{initCatmullRom:function(r,a,o,c,l){s(a,o,l*(o-r),l*(c-a))},initNonuniformCatmullRom:function(r,a,o,c,l,h,u){let d=(a-r)/l-(o-r)/(l+h)+(o-a)/h,f=(o-a)/h-(c-a)/(h+u)+(c-o)/u;d*=h,f*=h,s(a,o,d,f)},calc:function(r){let a=r*r,o=a*r;return i+e*r+t*a+n*o}}}var Gh=new D,Wh=new D,nc=new Fc,ic=new Fc,sc=new Fc,ao=class extends xn{constructor(e=[],t=!1,n="centripetal",s=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=e,this.closed=t,this.curveType=n,this.tension=s}getPoint(e,t=new D){let n=t,s=this.points,r=s.length,a=(r-(this.closed?0:1))*e,o=Math.floor(a),c=a-o;this.closed?o+=o>0?0:(Math.floor(Math.abs(o)/r)+1)*r:c===0&&o===r-1&&(o=r-2,c=1);let l,h;this.closed||o>0?l=s[(o-1)%r]:(Wh.subVectors(s[0],s[1]).add(s[0]),l=Wh);let u=s[o%r],d=s[(o+1)%r];if(this.closed||o+2<r?h=s[(o+2)%r]:(Gh.subVectors(s[r-1],s[r-2]).add(s[r-1]),h=Gh),this.curveType==="centripetal"||this.curveType==="chordal"){let f=this.curveType==="chordal"?.5:.25,p=Math.pow(l.distanceToSquared(u),f),_=Math.pow(u.distanceToSquared(d),f),m=Math.pow(d.distanceToSquared(h),f);_<1e-4&&(_=1),p<1e-4&&(p=_),m<1e-4&&(m=_),nc.initNonuniformCatmullRom(l.x,u.x,d.x,h.x,p,_,m),ic.initNonuniformCatmullRom(l.y,u.y,d.y,h.y,p,_,m),sc.initNonuniformCatmullRom(l.z,u.z,d.z,h.z,p,_,m)}else this.curveType==="catmullrom"&&(nc.initCatmullRom(l.x,u.x,d.x,h.x,this.tension),ic.initCatmullRom(l.y,u.y,d.y,h.y,this.tension),sc.initCatmullRom(l.z,u.z,d.z,h.z,this.tension));return n.set(nc.calc(c),ic.calc(c),sc.calc(c)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let s=e.points[t];this.points.push(s.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let s=this.points[t];e.points.push(s.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let s=e.points[t];this.points.push(new D().fromArray(s))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}};function Xh(i,e,t,n,s){let r=(n-e)*.5,a=(s-t)*.5,o=i*i,c=i*o;return(2*t-2*n+r+a)*c+(-3*t+3*n-2*r-a)*o+r*i+t}function wf(i,e){let t=1-i;return t*t*e}function Af(i,e){return 2*(1-i)*i*e}function Cf(i,e){return i*i*e}function rr(i,e,t,n){return wf(i,e)+Af(i,t)+Cf(i,n)}function Rf(i,e){let t=1-i;return t*t*t*e}function Pf(i,e){let t=1-i;return 3*t*t*i*e}function If(i,e){return 3*(1-i)*i*i*e}function Df(i,e){return i*i*i*e}function ar(i,e,t,n,s){return Rf(i,e)+Pf(i,t)+If(i,n)+Df(i,s)}var gr=class extends xn{constructor(e=new pe,t=new pe,n=new pe,s=new pe){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=e,this.v1=t,this.v2=n,this.v3=s}getPoint(e,t=new pe){let n=t,s=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(ar(e,s.x,r.x,a.x,o.x),ar(e,s.y,r.y,a.y,o.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},oo=class extends xn{constructor(e=new D,t=new D,n=new D,s=new D){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=e,this.v1=t,this.v2=n,this.v3=s}getPoint(e,t=new D){let n=t,s=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(ar(e,s.x,r.x,a.x,o.x),ar(e,s.y,r.y,a.y,o.y),ar(e,s.z,r.z,a.z,o.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},_r=class extends xn{constructor(e=new pe,t=new pe){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=e,this.v2=t}getPoint(e,t=new pe){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new pe){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},lo=class extends xn{constructor(e=new D,t=new D){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=e,this.v2=t}getPoint(e,t=new D){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new D){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},xr=class extends xn{constructor(e=new pe,t=new pe,n=new pe){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new pe){let n=t,s=this.v0,r=this.v1,a=this.v2;return n.set(rr(e,s.x,r.x,a.x),rr(e,s.y,r.y,a.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},co=class extends xn{constructor(e=new D,t=new D,n=new D){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new D){let n=t,s=this.v0,r=this.v1,a=this.v2;return n.set(rr(e,s.x,r.x,a.x),rr(e,s.y,r.y,a.y),rr(e,s.z,r.z,a.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},vr=class extends xn{constructor(e=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=e}getPoint(e,t=new pe){let n=t,s=this.points,r=(s.length-1)*e,a=Math.floor(r),o=r-a,c=s[a===0?a:a-1],l=s[a],h=s[a>s.length-2?s.length-1:a+1],u=s[a>s.length-3?s.length-1:a+2];return n.set(Xh(o,c.x,l.x,h.x,u.x),Xh(o,c.y,l.y,h.y,u.y)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let s=e.points[t];this.points.push(s.clone())}return this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let s=this.points[t];e.points.push(s.toArray())}return e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let s=e.points[t];this.points.push(new pe().fromArray(s))}return this}},uc=Object.freeze({__proto__:null,ArcCurve:ro,CatmullRomCurve3:ao,CubicBezierCurve:gr,CubicBezierCurve3:oo,EllipseCurve:Cs,LineCurve:_r,LineCurve3:lo,QuadraticBezierCurve:xr,QuadraticBezierCurve3:co,SplineCurve:vr}),ho=class extends xn{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(e){this.curves.push(e)}closePath(){let e=this.curves[0].getPoint(0),t=this.curves[this.curves.length-1].getPoint(1);if(!e.equals(t)){let n=e.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new uc[n](t,e))}return this}getPoint(e,t){let n=e*this.getLength(),s=this.getCurveLengths(),r=0;for(;r<s.length;){if(s[r]>=n){let a=s[r]-n,o=this.curves[r],c=o.getLength(),l=c===0?0:1-a/c;return o.getPointAt(l,t)}r++}return null}getLength(){let e=this.getCurveLengths();return e[e.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;let e=[],t=0;for(let n=0,s=this.curves.length;n<s;n++)t+=this.curves[n].getLength(),e.push(t);return this.cacheLengths=e,e}getSpacedPoints(e=40){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return this.autoClose&&t.push(t[0]),t}getPoints(e=12){let t=[],n;for(let s=0,r=this.curves;s<r.length;s++){let a=r[s],o=a.isEllipseCurve?e*2:a.isLineCurve||a.isLineCurve3?1:a.isSplineCurve?e*a.points.length:e,c=a.getPoints(o);for(let l=0;l<c.length;l++){let h=c[l];n&&n.equals(h)||(t.push(h),n=h)}}return this.autoClose&&t.length>1&&!t[t.length-1].equals(t[0])&&t.push(t[0]),t}copy(e){super.copy(e),this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){let s=e.curves[t];this.curves.push(s.clone())}return this.autoClose=e.autoClose,this}toJSON(){let e=super.toJSON();e.autoClose=this.autoClose,e.curves=[];for(let t=0,n=this.curves.length;t<n;t++){let s=this.curves[t];e.curves.push(s.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.autoClose=e.autoClose,this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){let s=e.curves[t];this.curves.push(new uc[s.type]().fromJSON(s))}return this}},yr=class extends ho{constructor(e){super(),this.type="Path",this.currentPoint=new pe,e&&this.setFromPoints(e)}setFromPoints(e){this.moveTo(e[0].x,e[0].y);for(let t=1,n=e.length;t<n;t++)this.lineTo(e[t].x,e[t].y);return this}moveTo(e,t){return this.currentPoint.set(e,t),this}lineTo(e,t){let n=new _r(this.currentPoint.clone(),new pe(e,t));return this.curves.push(n),this.currentPoint.set(e,t),this}quadraticCurveTo(e,t,n,s){let r=new xr(this.currentPoint.clone(),new pe(e,t),new pe(n,s));return this.curves.push(r),this.currentPoint.set(n,s),this}bezierCurveTo(e,t,n,s,r,a){let o=new gr(this.currentPoint.clone(),new pe(e,t),new pe(n,s),new pe(r,a));return this.curves.push(o),this.currentPoint.set(r,a),this}splineThru(e){let t=[this.currentPoint.clone()].concat(e),n=new vr(t);return this.curves.push(n),this.currentPoint.copy(e[e.length-1]),this}arc(e,t,n,s,r,a){let o=this.currentPoint.x,c=this.currentPoint.y;return this.absarc(e+o,t+c,n,s,r,a),this}absarc(e,t,n,s,r,a){return this.absellipse(e,t,n,n,s,r,a),this}ellipse(e,t,n,s,r,a,o,c){let l=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(e+l,t+h,n,s,r,a,o,c),this}absellipse(e,t,n,s,r,a,o,c){let l=new Cs(e,t,n,s,r,a,o,c);if(this.curves.length>0){let u=l.getPoint(0);u.equals(this.currentPoint)||this.lineTo(u.x,u.y)}this.curves.push(l);let h=l.getPoint(1);return this.currentPoint.copy(h),this}copy(e){return super.copy(e),this.currentPoint.copy(e.currentPoint),this}toJSON(){let e=super.toJSON();return e.currentPoint=this.currentPoint.toArray(),e}fromJSON(e){return super.fromJSON(e),this.currentPoint.fromArray(e.currentPoint),this}},ri=class extends yr{constructor(e){super(e),this.uuid=qi(),this.type="Shape",this.holes=[]}getPointsHoles(e){let t=[];for(let n=0,s=this.holes.length;n<s;n++)t[n]=this.holes[n].getPoints(e);return t}extractPoints(e){return{shape:this.getPoints(e),holes:this.getPointsHoles(e)}}copy(e){super.copy(e),this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){let s=e.holes[t];this.holes.push(s.clone())}return this}toJSON(){let e=super.toJSON();e.uuid=this.uuid,e.holes=[];for(let t=0,n=this.holes.length;t<n;t++){let s=this.holes[t];e.holes.push(s.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.uuid=e.uuid,this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){let s=e.holes[t];this.holes.push(new yr().fromJSON(s))}return this}};function Lf(i,e,t=2){let n=e&&e.length,s=n?e[0]*t:i.length,r=Bu(i,0,s,t,!0),a=[];if(!r||r.next===r.prev)return a;let o,c,l;if(n&&(r=Bf(i,e,r,t)),i.length>80*t){o=i[0],c=i[1];let h=o,u=c;for(let d=t;d<s;d+=t){let f=i[d],p=i[d+1];f<o&&(o=f),p<c&&(c=p),f>h&&(h=f),p>u&&(u=p)}l=Math.max(h-o,u-c),l=l!==0?32767/l:0}return Mr(r,a,t,o,c,l,0),a}function Bu(i,e,t,n,s){let r;if(s===Zf(i,e,t,n)>0)for(let a=e;a<t;a+=n)r=qh(a/n|0,i[a],i[a+1],r);else for(let a=t-n;a>=e;a-=n)r=qh(a/n|0,i[a],i[a+1],r);return r&&Rs(r,r.next)&&(br(r),r=r.next),r}function Vi(i,e){if(!i)return i;e||(e=i);let t=i,n;do if(n=!1,!t.steiner&&(Rs(t,t.next)||wt(t.prev,t,t.next)===0)){if(br(t),t=e=t.prev,t===t.next)break;n=!0}else t=t.next;while(n||t!==e);return e}function Mr(i,e,t,n,s,r,a){if(!i)return;!a&&r&&Gf(i,n,s,r);let o=i;for(;i.prev!==i.next;){let c=i.prev,l=i.next;if(r?Uf(i,n,s,r):Nf(i)){e.push(c.i,i.i,l.i),br(i),i=l.next,o=l.next;continue}if(i=l,i===o){a?a===1?(i=Ff(Vi(i),e),Mr(i,e,t,n,s,r,2)):a===2&&Of(i,e,t,n,s,r):Mr(Vi(i),e,t,n,s,r,1);break}}}function Nf(i){let e=i.prev,t=i,n=i.next;if(wt(e,t,n)>=0)return!1;let s=e.x,r=t.x,a=n.x,o=e.y,c=t.y,l=n.y,h=Math.min(s,r,a),u=Math.min(o,c,l),d=Math.max(s,r,a),f=Math.max(o,c,l),p=n.next;for(;p!==e;){if(p.x>=h&&p.x<=d&&p.y>=u&&p.y<=f&&nr(s,o,r,c,a,l,p.x,p.y)&&wt(p.prev,p,p.next)>=0)return!1;p=p.next}return!0}function Uf(i,e,t,n){let s=i.prev,r=i,a=i.next;if(wt(s,r,a)>=0)return!1;let o=s.x,c=r.x,l=a.x,h=s.y,u=r.y,d=a.y,f=Math.min(o,c,l),p=Math.min(h,u,d),_=Math.max(o,c,l),m=Math.max(h,u,d),g=dc(f,p,e,t,n),S=dc(_,m,e,t,n),A=i.prevZ,M=i.nextZ;for(;A&&A.z>=g&&M&&M.z<=S;){if(A.x>=f&&A.x<=_&&A.y>=p&&A.y<=m&&A!==s&&A!==a&&nr(o,h,c,u,l,d,A.x,A.y)&&wt(A.prev,A,A.next)>=0||(A=A.prevZ,M.x>=f&&M.x<=_&&M.y>=p&&M.y<=m&&M!==s&&M!==a&&nr(o,h,c,u,l,d,M.x,M.y)&&wt(M.prev,M,M.next)>=0))return!1;M=M.nextZ}for(;A&&A.z>=g;){if(A.x>=f&&A.x<=_&&A.y>=p&&A.y<=m&&A!==s&&A!==a&&nr(o,h,c,u,l,d,A.x,A.y)&&wt(A.prev,A,A.next)>=0)return!1;A=A.prevZ}for(;M&&M.z<=S;){if(M.x>=f&&M.x<=_&&M.y>=p&&M.y<=m&&M!==s&&M!==a&&nr(o,h,c,u,l,d,M.x,M.y)&&wt(M.prev,M,M.next)>=0)return!1;M=M.nextZ}return!0}function Ff(i,e){let t=i;do{let n=t.prev,s=t.next.next;!Rs(n,s)&&Vu(n,t,t.next,s)&&Sr(n,s)&&Sr(s,n)&&(e.push(n.i,t.i,s.i),br(t),br(t.next),t=i=s),t=t.next}while(t!==i);return Vi(t)}function Of(i,e,t,n,s,r){let a=i;do{let o=a.next.next;for(;o!==a.prev;){if(a.i!==o.i&&qf(a,o)){let c=ku(a,o);a=Vi(a,a.next),c=Vi(c,c.next),Mr(a,e,t,n,s,r,0),Mr(c,e,t,n,s,r,0);return}o=o.next}a=a.next}while(a!==i)}function Bf(i,e,t,n){let s=[];for(let r=0,a=e.length;r<a;r++){let o=e[r]*n,c=r<a-1?e[r+1]*n:i.length,l=Bu(i,o,c,n,!1);l===l.next&&(l.steiner=!0),s.push(Xf(l))}s.sort(zf);for(let r=0;r<s.length;r++)t=Vf(s[r],t);return t}function zf(i,e){let t=i.x-e.x;if(t===0&&(t=i.y-e.y,t===0)){let n=(i.next.y-i.y)/(i.next.x-i.x),s=(e.next.y-e.y)/(e.next.x-e.x);t=n-s}return t}function Vf(i,e){let t=kf(i,e);if(!t)return e;let n=ku(t,i);return Vi(n,n.next),Vi(t,t.next)}function kf(i,e){let t=e,n=i.x,s=i.y,r=-1/0,a;if(Rs(i,t))return t;do{if(Rs(i,t.next))return t.next;if(s<=t.y&&s>=t.next.y&&t.next.y!==t.y){let u=t.x+(s-t.y)*(t.next.x-t.x)/(t.next.y-t.y);if(u<=n&&u>r&&(r=u,a=t.x<t.next.x?t:t.next,u===n))return a}t=t.next}while(t!==e);if(!a)return null;let o=a,c=a.x,l=a.y,h=1/0;t=a;do{if(n>=t.x&&t.x>=c&&n!==t.x&&zu(s<l?n:r,s,c,l,s<l?r:n,s,t.x,t.y)){let u=Math.abs(s-t.y)/(n-t.x);Sr(t,i)&&(u<h||u===h&&(t.x>a.x||t.x===a.x&&Hf(a,t)))&&(a=t,h=u)}t=t.next}while(t!==o);return a}function Hf(i,e){return wt(i.prev,i,e.prev)<0&&wt(e.next,i,i.next)<0}function Gf(i,e,t,n){let s=i;do s.z===0&&(s.z=dc(s.x,s.y,e,t,n)),s.prevZ=s.prev,s.nextZ=s.next,s=s.next;while(s!==i);s.prevZ.nextZ=null,s.prevZ=null,Wf(s)}function Wf(i){let e,t=1;do{let n=i,s;i=null;let r=null;for(e=0;n;){e++;let a=n,o=0;for(let l=0;l<t&&(o++,a=a.nextZ,!!a);l++);let c=t;for(;o>0||c>0&&a;)o!==0&&(c===0||!a||n.z<=a.z)?(s=n,n=n.nextZ,o--):(s=a,a=a.nextZ,c--),r?r.nextZ=s:i=s,s.prevZ=r,r=s;n=a}r.nextZ=null,t*=2}while(e>1);return i}function dc(i,e,t,n,s){return i=(i-t)*s|0,e=(e-n)*s|0,i=(i|i<<8)&16711935,i=(i|i<<4)&252645135,i=(i|i<<2)&858993459,i=(i|i<<1)&1431655765,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,i|e<<1}function Xf(i){let e=i,t=i;do(e.x<t.x||e.x===t.x&&e.y<t.y)&&(t=e),e=e.next;while(e!==i);return t}function zu(i,e,t,n,s,r,a,o){return(s-a)*(e-o)>=(i-a)*(r-o)&&(i-a)*(n-o)>=(t-a)*(e-o)&&(t-a)*(r-o)>=(s-a)*(n-o)}function nr(i,e,t,n,s,r,a,o){return!(i===a&&e===o)&&zu(i,e,t,n,s,r,a,o)}function qf(i,e){return i.next.i!==e.i&&i.prev.i!==e.i&&!Yf(i,e)&&(Sr(i,e)&&Sr(e,i)&&jf(i,e)&&(wt(i.prev,i,e.prev)||wt(i,e.prev,e))||Rs(i,e)&&wt(i.prev,i,i.next)>0&&wt(e.prev,e,e.next)>0)}function wt(i,e,t){return(e.y-i.y)*(t.x-e.x)-(e.x-i.x)*(t.y-e.y)}function Rs(i,e){return i.x===e.x&&i.y===e.y}function Vu(i,e,t,n){let s=Va(wt(i,e,t)),r=Va(wt(i,e,n)),a=Va(wt(t,n,i)),o=Va(wt(t,n,e));return!!(s!==r&&a!==o||s===0&&za(i,t,e)||r===0&&za(i,n,e)||a===0&&za(t,i,n)||o===0&&za(t,e,n))}function za(i,e,t){return e.x<=Math.max(i.x,t.x)&&e.x>=Math.min(i.x,t.x)&&e.y<=Math.max(i.y,t.y)&&e.y>=Math.min(i.y,t.y)}function Va(i){return i>0?1:i<0?-1:0}function Yf(i,e){let t=i;do{if(t.i!==i.i&&t.next.i!==i.i&&t.i!==e.i&&t.next.i!==e.i&&Vu(t,t.next,i,e))return!0;t=t.next}while(t!==i);return!1}function Sr(i,e){return wt(i.prev,i,i.next)<0?wt(i,e,i.next)>=0&&wt(i,i.prev,e)>=0:wt(i,e,i.prev)<0||wt(i,i.next,e)<0}function jf(i,e){let t=i,n=!1,s=(i.x+e.x)/2,r=(i.y+e.y)/2;do t.y>r!=t.next.y>r&&t.next.y!==t.y&&s<(t.next.x-t.x)*(r-t.y)/(t.next.y-t.y)+t.x&&(n=!n),t=t.next;while(t!==i);return n}function ku(i,e){let t=fc(i.i,i.x,i.y),n=fc(e.i,e.x,e.y),s=i.next,r=e.prev;return i.next=e,e.prev=i,t.next=s,s.prev=t,n.next=t,t.prev=n,r.next=n,n.prev=r,n}function qh(i,e,t,n){let s=fc(i,e,t);return n?(s.next=n.next,s.prev=n,n.next.prev=s,n.next=s):(s.prev=s,s.next=s),s}function br(i){i.next.prev=i.prev,i.prev.next=i.next,i.prevZ&&(i.prevZ.nextZ=i.nextZ),i.nextZ&&(i.nextZ.prevZ=i.prevZ)}function fc(i,e,t){return{i,x:e,y:t,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function Zf(i,e,t,n){let s=0;for(let r=e,a=t-n;r<t;r+=n)s+=(i[a]-i[r])*(i[r+1]+i[a+1]),a=r;return s}var pc=class{static triangulate(e,t,n=2){return Lf(e,t,n)}},Ni=class i{static area(e){let t=e.length,n=0;for(let s=t-1,r=0;r<t;s=r++)n+=e[s].x*e[r].y-e[r].x*e[s].y;return n*.5}static isClockWise(e){return i.area(e)<0}static triangulateShape(e,t){let n=[],s=[],r=[];Yh(e),jh(n,e);let a=e.length;t.forEach(Yh);for(let c=0;c<t.length;c++)s.push(a),a+=t[c].length,jh(n,t[c]);let o=pc.triangulate(n,s);for(let c=0;c<o.length;c+=3)r.push(o.slice(c,c+3));return r}};function Yh(i){let e=i.length;e>2&&i[e-1].equals(i[0])&&i.pop()}function jh(i,e){for(let t=0;t<e.length;t++)i.push(e[t].x),i.push(e[t].y)}var Er=class i extends zt{constructor(e=new ri([new pe(.5,.5),new pe(-.5,.5),new pe(-.5,-.5),new pe(.5,-.5)]),t={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:e,options:t},e=Array.isArray(e)?e:[e];let n=this,s=[],r=[];for(let o=0,c=e.length;o<c;o++){let l=e[o];a(l)}this.setAttribute("position",new gt(s,3)),this.setAttribute("uv",new gt(r,2)),this.computeVertexNormals();function a(o){let c=[],l=t.curveSegments!==void 0?t.curveSegments:12,h=t.steps!==void 0?t.steps:1,u=t.depth!==void 0?t.depth:1,d=t.bevelEnabled!==void 0?t.bevelEnabled:!0,f=t.bevelThickness!==void 0?t.bevelThickness:.2,p=t.bevelSize!==void 0?t.bevelSize:f-.1,_=t.bevelOffset!==void 0?t.bevelOffset:0,m=t.bevelSegments!==void 0?t.bevelSegments:3,g=t.extrudePath,S=t.UVGenerator!==void 0?t.UVGenerator:Jf,A,M=!1,E,v,b,x;if(g){A=g.getSpacedPoints(h),M=!0,d=!1;let ae=g.isCatmullRomCurve3?g.closed:!1;E=g.computeFrenetFrames(h,ae),v=new D,b=new D,x=new D}d||(m=0,f=0,p=0,_=0);let w=o.extractPoints(l),C=w.shape,I=w.holes;if(!Ni.isClockWise(C)){C=C.reverse();for(let ae=0,ue=I.length;ae<ue;ae++){let se=I[ae];Ni.isClockWise(se)&&(I[ae]=se.reverse())}}function z(ae){let se=10000000000000001e-36,oe=ae[0];for(let de=1;de<=ae.length;de++){let xe=de%ae.length,Me=ae[xe],Q=Me.x-oe.x,qe=Me.y-oe.y,B=Q*Q+qe*qe,rt=Math.max(Math.abs(Me.x),Math.abs(Me.y),Math.abs(oe.x),Math.abs(oe.y)),nt=se*rt*rt;if(B<=nt){ae.splice(xe,1),de--;continue}oe=Me}}z(C),I.forEach(z);let O=I.length,k=C;for(let ae=0;ae<O;ae++){let ue=I[ae];C=C.concat(ue)}function j(ae,ue,se){return ue||Je("ExtrudeGeometry: vec does not exist"),ae.clone().addScaledVector(ue,se)}let R=C.length;function F(ae,ue,se){let oe,de,xe,Me=ae.x-ue.x,Q=ae.y-ue.y,qe=se.x-ae.x,B=se.y-ae.y,rt=Me*Me+Q*Q,nt=Me*B-Q*qe;if(Math.abs(nt)>Number.EPSILON){let P=Math.sqrt(rt),y=Math.sqrt(qe*qe+B*B),W=ue.x-Q/P,Y=ue.y+Me/P,te=se.x-B/y,me=se.y+qe/y,ve=((te-W)*B-(me-Y)*qe)/(Me*B-Q*qe);oe=W+Me*ve-ae.x,de=Y+Q*ve-ae.y;let re=oe*oe+de*de;if(re<=2)return new pe(oe,de);xe=Math.sqrt(re/2)}else{let P=!1;Me>Number.EPSILON?qe>Number.EPSILON&&(P=!0):Me<-Number.EPSILON?qe<-Number.EPSILON&&(P=!0):Math.sign(Q)===Math.sign(B)&&(P=!0),P?(oe=-Q,de=Me,xe=Math.sqrt(rt)):(oe=Me,de=Q,xe=Math.sqrt(rt/2))}return new pe(oe/xe,de/xe)}let G=[];for(let ae=0,ue=k.length,se=ue-1,oe=ae+1;ae<ue;ae++,se++,oe++)se===ue&&(se=0),oe===ue&&(oe=0),G[ae]=F(k[ae],k[se],k[oe]);let q=[],X,he=G.concat();for(let ae=0,ue=O;ae<ue;ae++){let se=I[ae];X=[];for(let oe=0,de=se.length,xe=de-1,Me=oe+1;oe<de;oe++,xe++,Me++)xe===de&&(xe=0),Me===de&&(Me=0),X[oe]=F(se[oe],se[xe],se[Me]);q.push(X),he=he.concat(X)}let ge;if(m===0)ge=Ni.triangulateShape(k,I);else{let ae=[],ue=[];for(let se=0;se<m;se++){let oe=se/m,de=f*Math.cos(oe*Math.PI/2),xe=p*Math.sin(oe*Math.PI/2)+_;for(let Me=0,Q=k.length;Me<Q;Me++){let qe=j(k[Me],G[Me],xe);fe(qe.x,qe.y,-de),oe===0&&ae.push(qe)}for(let Me=0,Q=O;Me<Q;Me++){let qe=I[Me];X=q[Me];let B=[];for(let rt=0,nt=qe.length;rt<nt;rt++){let P=j(qe[rt],X[rt],xe);fe(P.x,P.y,-de),oe===0&&B.push(P)}oe===0&&ue.push(B)}}ge=Ni.triangulateShape(ae,ue)}let Fe=ge.length,Te=p+_;for(let ae=0;ae<R;ae++){let ue=d?j(C[ae],he[ae],Te):C[ae];M?(b.copy(E.normals[0]).multiplyScalar(ue.x),v.copy(E.binormals[0]).multiplyScalar(ue.y),x.copy(A[0]).add(b).add(v),fe(x.x,x.y,x.z)):fe(ue.x,ue.y,0)}for(let ae=1;ae<=h;ae++)for(let ue=0;ue<R;ue++){let se=d?j(C[ue],he[ue],Te):C[ue];M?(b.copy(E.normals[ae]).multiplyScalar(se.x),v.copy(E.binormals[ae]).multiplyScalar(se.y),x.copy(A[ae]).add(b).add(v),fe(x.x,x.y,x.z)):fe(se.x,se.y,u/h*ae)}for(let ae=m-1;ae>=0;ae--){let ue=ae/m,se=f*Math.cos(ue*Math.PI/2),oe=p*Math.sin(ue*Math.PI/2)+_;for(let de=0,xe=k.length;de<xe;de++){let Me=j(k[de],G[de],oe);fe(Me.x,Me.y,u+se)}for(let de=0,xe=I.length;de<xe;de++){let Me=I[de];X=q[de];for(let Q=0,qe=Me.length;Q<qe;Q++){let B=j(Me[Q],X[Q],oe);M?fe(B.x,B.y+A[h-1].y,A[h-1].x+se):fe(B.x,B.y,u+se)}}}Ve(),ee();function Ve(){let ae=s.length/3;if(d){let ue=0,se=R*ue;for(let oe=0;oe<Fe;oe++){let de=ge[oe];Pe(de[2]+se,de[1]+se,de[0]+se)}ue=h+m*2,se=R*ue;for(let oe=0;oe<Fe;oe++){let de=ge[oe];Pe(de[0]+se,de[1]+se,de[2]+se)}}else{for(let ue=0;ue<Fe;ue++){let se=ge[ue];Pe(se[2],se[1],se[0])}for(let ue=0;ue<Fe;ue++){let se=ge[ue];Pe(se[0]+R*h,se[1]+R*h,se[2]+R*h)}}n.addGroup(ae,s.length/3-ae,0)}function ee(){let ae=s.length/3,ue=0;ie(k,ue),ue+=k.length;for(let se=0,oe=I.length;se<oe;se++){let de=I[se];ie(de,ue),ue+=de.length}n.addGroup(ae,s.length/3-ae,1)}function ie(ae,ue){let se=ae.length;for(;--se>=0;){let oe=se,de=se-1;de<0&&(de=ae.length-1);for(let xe=0,Me=h+m*2;xe<Me;xe++){let Q=R*xe,qe=R*(xe+1),B=ue+oe+Q,rt=ue+de+Q,nt=ue+de+qe,P=ue+oe+qe;ye(B,rt,nt,P)}}}function fe(ae,ue,se){c.push(ae),c.push(ue),c.push(se)}function Pe(ae,ue,se){Oe(ae),Oe(ue),Oe(se);let oe=s.length/3,de=S.generateTopUV(n,s,oe-3,oe-2,oe-1);Qe(de[0]),Qe(de[1]),Qe(de[2])}function ye(ae,ue,se,oe){Oe(ae),Oe(ue),Oe(oe),Oe(ue),Oe(se),Oe(oe);let de=s.length/3,xe=S.generateSideWallUV(n,s,de-6,de-3,de-2,de-1);Qe(xe[0]),Qe(xe[1]),Qe(xe[3]),Qe(xe[1]),Qe(xe[2]),Qe(xe[3])}function Oe(ae){s.push(c[ae*3+0]),s.push(c[ae*3+1]),s.push(c[ae*3+2])}function Qe(ae){r.push(ae.x),r.push(ae.y)}}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){let e=super.toJSON(),t=this.parameters.shapes,n=this.parameters.options;return Kf(t,n,e)}static fromJSON(e,t){let n=[];for(let r=0,a=e.shapes.length;r<a;r++){let o=t[e.shapes[r]];n.push(o)}let s=e.options.extrudePath;return s!==void 0&&(e.options.extrudePath=new uc[s.type]().fromJSON(s)),new i(n,e.options)}},Jf={generateTopUV:function(i,e,t,n,s){let r=e[t*3],a=e[t*3+1],o=e[n*3],c=e[n*3+1],l=e[s*3],h=e[s*3+1];return[new pe(r,a),new pe(o,c),new pe(l,h)]},generateSideWallUV:function(i,e,t,n,s,r){let a=e[t*3],o=e[t*3+1],c=e[t*3+2],l=e[n*3],h=e[n*3+1],u=e[n*3+2],d=e[s*3],f=e[s*3+1],p=e[s*3+2],_=e[r*3],m=e[r*3+1],g=e[r*3+2];return Math.abs(o-h)<Math.abs(a-l)?[new pe(a,1-c),new pe(l,1-u),new pe(d,1-p),new pe(_,1-g)]:[new pe(o,1-c),new pe(h,1-u),new pe(f,1-p),new pe(m,1-g)]}};function Kf(i,e,t){if(t.shapes=[],Array.isArray(i))for(let n=0,s=i.length;n<s;n++){let r=i[n];t.shapes.push(r.uuid)}else t.shapes.push(i.uuid);return t.options=Object.assign({},e),e.extrudePath!==void 0&&(t.options.extrudePath=e.extrudePath.toJSON()),t}var Tr=class i extends zt{constructor(e=[new pe(0,-.5),new pe(.5,0),new pe(0,.5)],t=12,n=0,s=Math.PI*2){super(),this.type="LatheGeometry",this.parameters={points:e,segments:t,phiStart:n,phiLength:s},t=Math.floor(t),s=at(s,0,Math.PI*2);let r=[],a=[],o=[],c=[],l=[],h=1/t,u=new D,d=new pe,f=new D,p=new D,_=new D,m=0,g=0;for(let S=0;S<=e.length-1;S++)switch(S){case 0:m=e[S+1].x-e[S].x,g=e[S+1].y-e[S].y,f.x=g*1,f.y=-m,f.z=g*0,_.copy(f),f.normalize(),c.push(f.x,f.y,f.z);break;case e.length-1:c.push(_.x,_.y,_.z);break;default:m=e[S+1].x-e[S].x,g=e[S+1].y-e[S].y,f.x=g*1,f.y=-m,f.z=g*0,p.copy(f),f.x+=_.x,f.y+=_.y,f.z+=_.z,f.normalize(),c.push(f.x,f.y,f.z),_.copy(p)}for(let S=0;S<=t;S++){let A=n+S*h*s,M=Math.sin(A),E=Math.cos(A);for(let v=0;v<=e.length-1;v++){u.x=e[v].x*M,u.y=e[v].y,u.z=e[v].x*E,a.push(u.x,u.y,u.z),d.x=S/t,d.y=v/(e.length-1),o.push(d.x,d.y);let b=c[3*v+0]*M,x=c[3*v+1],w=c[3*v+0]*E;l.push(b,x,w)}}for(let S=0;S<t;S++)for(let A=0;A<e.length-1;A++){let M=A+S*e.length,E=M,v=M+e.length,b=M+e.length+1,x=M+1;r.push(E,v,x),r.push(b,x,v)}this.setIndex(r),this.setAttribute("position",new gt(a,3)),this.setAttribute("uv",new gt(o,2)),this.setAttribute("normal",new gt(l,3))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.points,e.segments,e.phiStart,e.phiLength)}};var hn=class i extends zt{constructor(e=1,t=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:s};let r=e/2,a=t/2,o=Math.floor(n),c=Math.floor(s),l=o+1,h=c+1,u=e/o,d=t/c,f=[],p=[],_=[],m=[];for(let g=0;g<h;g++){let S=g*d-a;for(let A=0;A<l;A++){let M=A*u-r;p.push(M,-S,0),_.push(0,0,1),m.push(A/o),m.push(1-g/c)}}for(let g=0;g<c;g++)for(let S=0;S<o;S++){let A=S+l*g,M=S+l*(g+1),E=S+1+l*(g+1),v=S+1+l*g;f.push(A,M,v),f.push(M,E,v)}this.setIndex(f),this.setAttribute("position",new gt(p,3)),this.setAttribute("normal",new gt(_,3)),this.setAttribute("uv",new gt(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.width,e.height,e.widthSegments,e.heightSegments)}};var ai=class i extends zt{constructor(e=1,t=32,n=16,s=0,r=Math.PI*2,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:n,phiStart:s,phiLength:r,thetaStart:a,thetaLength:o},t=Math.max(3,Math.floor(t)),n=Math.max(2,Math.floor(n));let c=Math.min(a+o,Math.PI),l=0,h=[],u=new D,d=new D,f=[],p=[],_=[],m=[];for(let g=0;g<=n;g++){let S=[],A=g/n,M=a+A*o,E=e*Math.cos(M),v=Math.sqrt(e*e-E*E),b=0;g===0&&a===0?b=.5/t:g===n&&c===Math.PI&&(b=-.5/t);for(let x=0;x<=t;x++){let w=x/t,C=s+w*r;u.x=-v*Math.cos(C),u.y=E,u.z=v*Math.sin(C),p.push(u.x,u.y,u.z),d.copy(u).normalize(),_.push(d.x,d.y,d.z),m.push(w+b,1-A),S.push(l++)}h.push(S)}for(let g=0;g<n;g++)for(let S=0;S<t;S++){let A=h[g][S+1],M=h[g][S],E=h[g+1][S],v=h[g+1][S+1];(g!==0||a>0)&&f.push(A,M,v),(g!==n-1||c<Math.PI)&&f.push(M,E,v)}this.setIndex(f),this.setAttribute("position",new gt(p,3)),this.setAttribute("normal",new gt(_,3)),this.setAttribute("uv",new gt(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}};var wr=class i extends zt{constructor(e=1,t=.4,n=12,s=48,r=Math.PI*2,a=0,o=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:e,tube:t,radialSegments:n,tubularSegments:s,arc:r,thetaStart:a,thetaLength:o},n=Math.floor(n),s=Math.floor(s);let c=[],l=[],h=[],u=[],d=new D,f=new D,p=new D;for(let _=0;_<=n;_++){let m=a+_/n*o;for(let g=0;g<=s;g++){let S=g/s*r;f.x=(e+t*Math.cos(m))*Math.cos(S),f.y=(e+t*Math.cos(m))*Math.sin(S),f.z=t*Math.sin(m),l.push(f.x,f.y,f.z),d.x=e*Math.cos(S),d.y=e*Math.sin(S),p.subVectors(f,d).normalize(),h.push(p.x,p.y,p.z),u.push(g/s),u.push(_/n)}}for(let _=1;_<=n;_++)for(let m=1;m<=s;m++){let g=(s+1)*_+m-1,S=(s+1)*(_-1)+m-1,A=(s+1)*(_-1)+m,M=(s+1)*_+m;c.push(g,S,M),c.push(S,A,M)}this.setIndex(c),this.setAttribute("position",new gt(l,3)),this.setAttribute("normal",new gt(h,3)),this.setAttribute("uv",new gt(u,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.radius,e.tube,e.radialSegments,e.tubularSegments,e.arc,e.thetaStart,e.thetaLength)}};function Yi(i){let e={};for(let t in i){e[t]={};for(let n in i[t]){let s=i[t][n];if(Zh(s))s.isRenderTargetTexture?(je("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=s.clone();else if(Array.isArray(s))if(Zh(s[0])){let r=[];for(let a=0,o=s.length;a<o;a++)r[a]=s[a].clone();e[t][n]=r}else e[t][n]=s.slice();else e[t][n]=s}}return e}function nn(i){let e={};for(let t=0;t<i.length;t++){let n=Yi(i[t]);for(let s in n)e[s]=n[s]}return e}function Zh(i){return i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)}function $f(i){let e=[];for(let t=0;t<i.length;t++)e.push(i[t].clone());return e}function Oc(i){let e=i.getRenderTarget();return e===null?i.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:ct.workingColorSpace}var Rn={clone:Yi,merge:nn},Qf=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,ep=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,Pt=class extends Gn{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Qf,this.fragmentShader=ep,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Yi(e.uniforms),this.uniformsGroups=$f(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let s in this.uniforms){let a=this.uniforms[s].value;a&&a.isTexture?t.uniforms[s]={type:"t",value:a.toJSON(e).uuid}:a&&a.isColor?t.uniforms[s]={type:"c",value:a.getHex()}:a&&a.isVector2?t.uniforms[s]={type:"v2",value:a.toArray()}:a&&a.isVector3?t.uniforms[s]={type:"v3",value:a.toArray()}:a&&a.isVector4?t.uniforms[s]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?t.uniforms[s]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?t.uniforms[s]={type:"m4",value:a.toArray()}:t.uniforms[s]={value:a}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let n={};for(let s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(let n in e.uniforms){let s=e.uniforms[n];switch(this.uniforms[n]={},s.type){case"t":this.uniforms[n].value=t[s.value]||null;break;case"c":this.uniforms[n].value=new tt().setHex(s.value);break;case"v2":this.uniforms[n].value=new pe().fromArray(s.value);break;case"v3":this.uniforms[n].value=new D().fromArray(s.value);break;case"v4":this.uniforms[n].value=new Et().fromArray(s.value);break;case"m3":this.uniforms[n].value=new st().fromArray(s.value);break;case"m4":this.uniforms[n].value=new Ne().fromArray(s.value);break;default:this.uniforms[n].value=s.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(let n in e.extensions)this.extensions[n]=e.extensions[n];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}},Ps=class extends Pt{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}},Ye=class extends Gn{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new tt(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new tt(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Os,this.normalScale=new pe(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new gn,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}};var Ar=class extends Gn{constructor(e){super(),this.isMeshNormalMaterial=!0,this.type="MeshNormalMaterial",this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Os,this.normalScale=new pe(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.flatShading=!1,this.setValues(e)}copy(e){return super.copy(e),this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.flatShading=e.flatShading,this}},Cr=class extends Gn{constructor(e){super(),this.isMeshLambertMaterial=!0,this.type="MeshLambertMaterial",this.color=new tt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new tt(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Os,this.normalScale=new pe(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new gn,this.combine=Ro,this.reflectivity=1,this.envMapIntensity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.envMapIntensity=e.envMapIntensity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},uo=class extends Gn{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=bu,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},fo=class extends Gn{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};function fs(i,e){return!i||i.constructor===e?i:typeof e.BYTES_PER_ELEMENT=="number"?new e(i):Array.prototype.slice.call(i)}function rc(i){return i!==void 0&&i.inTangents!==void 0&&i.outTangents!==void 0}var _i=class{constructor(e,t,n,s){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=s!==void 0?s:new t.constructor(n),this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,n=this._cachedIndex,s=t[n],r=t[n-1];n:{e:{let a;t:{i:if(!(e<s)){for(let o=n+2;;){if(s===void 0){if(e<r)break i;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===o)break;if(r=s,s=t[++n],e<s)break e}a=t.length;break t}if(!(e>=r)){let o=t[1];e<o&&(n=2,r=o);for(let c=n-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===c)break;if(s=r,r=t[--n-1],e>=r)break e}a=n,n=0;break t}break n}for(;n<a;){let o=n+a>>>1;e<t[o]?a=o:n=o+1}if(s=t[n],r=t[n-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(s===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,r,s)}return this.interpolate_(n,r,e,s)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,s=this.valueSize,r=e*s;for(let a=0;a!==s;++a)t[a]=n[r+a];return t}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},po=class extends _i{constructor(e,t,n,s){super(e,t,n,s),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:lc,endingEnd:lc}}intervalChanged_(e,t,n){let s=this.parameterPositions,r=e-2,a=e+1,o=s[r],c=s[a];if(o===void 0)switch(this.getSettings_().endingStart){case cc:r=e,o=2*t-n;break;case hc:r=s.length-2,o=t+s[r]-s[r+1];break;default:r=e,o=n}if(c===void 0)switch(this.getSettings_().endingEnd){case cc:a=e,c=2*n-t;break;case hc:a=1,c=n+s[1]-s[0];break;default:a=e-1,c=t}let l=(n-t)*.5,h=this.valueSize;this._weightPrev=l/(t-o),this._weightNext=l/(c-n),this._offsetPrev=r*h,this._offsetNext=a*h}interpolate_(e,t,n,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,c=e*o,l=c-o,h=this._offsetPrev,u=this._offsetNext,d=this._weightPrev,f=this._weightNext,p=(n-t)/(s-t),_=p*p,m=_*p,g=-d*m+2*d*_-d*p,S=(1+d)*m+(-1.5-2*d)*_+(-.5+d)*p+1,A=(-1-f)*m+(1.5+f)*_+.5*p,M=f*m-f*_;for(let E=0;E!==o;++E)r[E]=g*a[h+E]+S*a[l+E]+A*a[c+E]+M*a[u+E];return r}},mo=class extends _i{constructor(e,t,n,s){super(e,t,n,s)}interpolate_(e,t,n,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,c=e*o,l=c-o,h=(n-t)/(s-t),u=1-h;for(let d=0;d!==o;++d)r[d]=a[l+d]*u+a[c+d]*h;return r}},go=class extends _i{constructor(e,t,n,s){super(e,t,n,s)}interpolate_(e){return this.copySampleValue_(e-1)}},_o=class extends _i{interpolate_(e,t,n,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,c=e*o,l=c-o,h=this.inTangents,u=this.outTangents;if(!h||!u){let p=(n-t)/(s-t),_=1-p;for(let m=0;m!==o;++m)r[m]=a[l+m]*_+a[c+m]*p;return r}let d=o*2,f=e-1;for(let p=0;p!==o;++p){let _=a[l+p],m=a[c+p],g=f*d+p*2,S=u[g],A=u[g+1],M=e*d+p*2,E=h[M],v=h[M+1],b=np(n,t,S,E,s);r[p]=Hu(b,_,A,v,m)}return r}};function Hu(i,e,t,n,s){let r=1-i;return r*r*r*e+3*r*r*i*t+3*r*i*i*n+i*i*i*s}function tp(i,e,t,n,s){let r=1-i;return 3*r*r*(t-e)+6*r*i*(n-t)+3*i*i*(s-n)}function np(i,e,t,n,s){let r=(i-e)/(s-e);for(let a=0;a<8;a++){let o=Hu(r,e,t,n,s)-i;if(Math.abs(o)<1e-10)break;let c=tp(r,e,t,n,s);if(Math.abs(c)<1e-10)break;r=Math.max(0,Math.min(1,r-o/c))}return r}var vn=class{constructor(e,t,n,s){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=fs(t,this.TimeBufferType),this.values=fs(n,this.ValueBufferType),this.setInterpolation(s||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:fs(e.times,Array),values:fs(e.values,Array)};let s=e.getInterpolation();s!==e.DefaultInterpolation&&(n.interpolation=s),rc(e.settings)&&(n.settings={inTangents:fs(e.settings.inTangents,Array),outTangents:fs(e.settings.outTangents,Array)})}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new go(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new mo(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new po(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new _o(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.inTangents=this.settings.inTangents,t.outTangents=this.settings.outTangents),t}setInterpolation(e){let t;switch(e){case or:t=this.InterpolantFactoryMethodDiscrete;break;case eo:t=this.InterpolantFactoryMethodLinear;break;case Ga:t=this.InterpolantFactoryMethodSmooth;break;case oc:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return je("KeyframeTrack:",n),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return or;case this.InterpolantFactoryMethodLinear:return eo;case this.InterpolantFactoryMethodSmooth:return Ga;case this.InterpolantFactoryMethodBezier:return oc}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let n=0,s=t.length;n!==s;++n)t[n]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let n=0,s=t.length;n!==s;++n)t[n]*=e;rc(this.settings)&&(Jh(this.settings.inTangents,e),Jh(this.settings.outTangents,e))}return this}trim(e,t){let n=this.times,s=n.length,r=0,a=s-1;for(;r!==s&&n[r]<e;)++r;for(;a!==-1&&n[a]>t;)--a;if(++a,r!==0||a!==s){r>=a&&(a=Math.max(a,1),r=a-1);let o=this.getValueSize();this.times=n.slice(r,a),this.values=this.values.slice(r*o,a*o)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(Je("KeyframeTrack: Invalid value size in track.",this),e=!1);let n=this.times,s=this.values,r=n.length;r===0&&(Je("KeyframeTrack: Track is empty.",this),e=!1);let a=null;for(let o=0;o!==r;o++){let c=n[o];if(typeof c=="number"&&isNaN(c)){Je("KeyframeTrack: Time is not a valid number.",this,o,c),e=!1;break}if(a!==null&&a>c){Je("KeyframeTrack: Out of order keys.",this,o,c,a),e=!1;break}a=c}if(s!==void 0&&Gd(s))for(let o=0,c=s.length;o!==c;++o){let l=s[o];if(isNaN(l)){Je("KeyframeTrack: Value is not a valid number.",this,o,l),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),s=this.getInterpolation()===Ga,r=e.length-1,a=1;for(let o=1;o<r;++o){let c=!1,l=e[o],h=e[o+1];if(l!==h&&(o!==1||l!==e[0]))if(s)c=!0;else{let u=o*n,d=u-n,f=u+n;for(let p=0;p!==n;++p){let _=t[u+p];if(_!==t[d+p]||_!==t[f+p]){c=!0;break}}}if(c){if(o!==a){e[a]=e[o];let u=o*n,d=a*n;for(let f=0;f!==n;++f)t[d+f]=t[u+f]}++a}}if(r>0){e[a]=e[r];for(let o=r*n,c=a*n,l=0;l!==n;++l)t[c+l]=t[o+l];++a}return a!==e.length?(this.times=e.slice(0,a),this.values=t.slice(0,a*n)):(this.times=e,this.values=t),this}clone(){let e=this.times.slice(),t=this.values.slice(),n=this.constructor,s=new n(this.name,e,t);return s.createInterpolant=this.createInterpolant,rc(this.settings)&&(s.settings={inTangents:this.settings.inTangents.slice(),outTangents:this.settings.outTangents.slice()}),s}};function Jh(i,e){for(let t=0,n=i.length;t!==n;t+=2)i[t]*=e}vn.prototype.ValueTypeName="";vn.prototype.TimeBufferType=Float32Array;vn.prototype.ValueBufferType=Float32Array;vn.prototype.DefaultInterpolation=eo;var xi=class extends vn{constructor(e,t,n){super(e,t,n)}};xi.prototype.ValueTypeName="bool";xi.prototype.ValueBufferType=Array;xi.prototype.DefaultInterpolation=or;xi.prototype.InterpolantFactoryMethodLinear=void 0;xi.prototype.InterpolantFactoryMethodSmooth=void 0;var xo=class extends vn{constructor(e,t,n,s){super(e,t,n,s)}};xo.prototype.ValueTypeName="color";var vo=class extends vn{constructor(e,t,n,s){super(e,t,n,s)}};vo.prototype.ValueTypeName="number";var yo=class extends _i{constructor(e,t,n,s){super(e,t,n,s)}interpolate_(e,t,n,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,c=(n-t)/(s-t),l=e*o;for(let h=l+o;l!==h;l+=4)Bt.slerpFlat(r,0,a,l-o,a,l,c);return r}},Rr=class extends vn{constructor(e,t,n,s){super(e,t,n,s)}InterpolantFactoryMethodLinear(e){return new yo(this.times,this.values,this.getValueSize(),e)}};Rr.prototype.ValueTypeName="quaternion";Rr.prototype.InterpolantFactoryMethodSmooth=void 0;var vi=class extends vn{constructor(e,t,n){super(e,t,n)}};vi.prototype.ValueTypeName="string";vi.prototype.ValueBufferType=Array;vi.prototype.DefaultInterpolation=or;vi.prototype.InterpolantFactoryMethodLinear=void 0;vi.prototype.InterpolantFactoryMethodSmooth=void 0;var Mo=class extends vn{constructor(e,t,n,s){super(e,t,n,s)}};Mo.prototype.ValueTypeName="vector";var Xa={enabled:!1,files:{},add:function(i,e){this.enabled!==!1&&(Kh(i)||(this.files[i]=e))},get:function(i){if(this.enabled!==!1&&!Kh(i))return this.files[i]},remove:function(i){delete this.files[i]},clear:function(){this.files={}}};function Kh(i){try{let e=i.slice(i.indexOf(":")+1);return new URL(e).protocol==="blob:"}catch{return!1}}var So=class{constructor(e,t,n){let s=this,r=!1,a=0,o=0,c,l=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this._abortController=null,this.itemStart=function(h){o++,r===!1&&s.onStart!==void 0&&s.onStart(h,a,o),r=!0},this.itemEnd=function(h){a++,s.onProgress!==void 0&&s.onProgress(h,a,o),a===o&&(r=!1,s.onLoad!==void 0&&s.onLoad())},this.itemError=function(h){s.onError!==void 0&&s.onError(h)},this.resolveURL=function(h){return h=h.normalize("NFC"),c?c(h):h},this.setURLModifier=function(h){return c=h,this},this.addHandler=function(h,u){return l.push(h,u),this},this.removeHandler=function(h){let u=l.indexOf(h);return u!==-1&&l.splice(u,2),this},this.getHandler=function(h){for(let u=0,d=l.length;u<d;u+=2){let f=l[u],p=l[u+1];if(f.global&&(f.lastIndex=0),f.test(h))return p}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},Gu=new So,Is=class{constructor(e){this.manager=e!==void 0?e:Gu,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__!="undefined"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(e,t){let n=this;return new Promise(function(s,r){n.load(e,s,t,r)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}};Is.DEFAULT_MATERIAL_NAME="__DEFAULT";var ps=new WeakMap,bo=class extends Is{constructor(e){super(e)}load(e,t,n,s){this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let r=this,a=Xa.get(`image:${e}`);if(a!==void 0){if(a.complete===!0)r.manager.itemStart(e),setTimeout(function(){t&&t(a),r.manager.itemEnd(e)},0);else{let u=ps.get(a);u===void 0&&(u=[],ps.set(a,u)),u.push({onLoad:t,onError:s})}return a}let o=Ms("img");function c(){h(),t&&t(this);let u=ps.get(this)||[];for(let d=0;d<u.length;d++){let f=u[d];f.onLoad&&f.onLoad(this)}ps.delete(this),r.manager.itemEnd(e)}function l(u){h(),s&&s(u),Xa.remove(`image:${e}`);let d=ps.get(this)||[];for(let f=0;f<d.length;f++){let p=d[f];p.onError&&p.onError(u)}ps.delete(this),r.manager.itemError(e),r.manager.itemEnd(e)}function h(){o.removeEventListener("load",c,!1),o.removeEventListener("error",l,!1)}return o.addEventListener("load",c,!1),o.addEventListener("error",l,!1),e.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(o.crossOrigin=this.crossOrigin),Xa.add(`image:${e}`,o),r.manager.itemStart(e),o.src=e,o}};var Pr=class extends Is{constructor(e){super(e)}load(e,t,n,s){let r=new en,a=new bo(this.manager);return a.setCrossOrigin(this.crossOrigin),a.setPath(this.path),a.load(e,function(o){r.image=o,r.needsUpdate=!0,t!==void 0&&t(r)},n,s),r}},ki=class extends Rt{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new tt(e),this.intensity=t}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}},Ir=class extends ki{constructor(e,t,n){super(e,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Rt.DEFAULT_UP),this.updateMatrix(),this.groundColor=new tt(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}toJSON(e){let t=super.toJSON(e);return t.object.groundColor=this.groundColor.getHex(),t}},ac=new Ne,$h=new D,Qh=new D,Ds=class{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new pe(512,512),this.mapType=tn,this.map=null,this.mapPass=null,this.matrix=new Ne,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new As,this._frameExtents=new pe(1,1),this._viewportCount=1,this._viewports=[new Et(0,0,1,1)]}getViewportCount(){return this._viewportCount}getCamera(){return this.camera}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera;$h.setFromMatrixPosition(e.matrixWorld),t.position.copy($h),Qh.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(Qh),t.updateMatrixWorld(),this._updateMatrix(t,this.matrix,this._frustum)}_updateMatrix(e,t,n,s){ac.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),n.setFromProjectionMatrix(ac,e.coordinateSystem,e.reversedDepth);let r=this._frameExtents,a=s?s.z/r.x:1,o=s?s.w/r.y:1,c=s?s.x/r.x:0,l=s?s.y/r.y:0;e.coordinateSystem===ys||e.reversedDepth?t.set(.5*a,0,0,.5*a+c,0,.5*o,0,.5*o+l,0,0,1,0,0,0,0,1):t.set(.5*a,0,0,.5*a+c,0,.5*o,0,.5*o+l,0,0,.5,.5,0,0,0,1),t.multiply(ac)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return e.intensity=this.intensity,e.bias=this.bias,e.normalBias=this.normalBias,e.radius=this.radius,e.blurSamples=this.blurSamples,e.mapSize=this.mapSize.toArray(),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}},ka=new D,Ha=new Bt,Vn=new D,Dr=class extends Rt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Ne,this.projectionMatrix=new Ne,this.projectionMatrixInverse=new Ne,this.coordinateSystem=Nn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(ka,Ha,Vn),Vn.x===1&&Vn.y===1&&Vn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(ka,Ha,Vn.set(1,1,1)).invert()}updateWorldMatrix(e,t,n=!1){super.updateWorldMatrix(e,t,n),this.matrixWorld.decompose(ka,Ha,Vn),Vn.x===1&&Vn.y===1&&Vn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(ka,Ha,Vn.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},pi=new D,eu=new pe,tu=new pe,Xt=class extends Dr{constructor(e=50,t=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=Fi*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(ir*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Fi*2*Math.atan(Math.tan(ir*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){pi.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(pi.x,pi.y).multiplyScalar(-e/pi.z),pi.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(pi.x,pi.y).multiplyScalar(-e/pi.z)}getViewSize(e,t){return this.getViewBounds(e,eu,tu),t.subVectors(tu,eu)}setViewOffset(e,t,n,s,r,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(ir*.5*this.fov)/this.zoom,n=2*t,s=this.aspect*n,r=-.5*s,a=this.view;if(this.view!==null&&this.view.enabled){let c=a.fullWidth,l=a.fullHeight;r+=a.offsetX*s/c,t-=a.offsetY*n/l,s*=a.width/c,n*=a.height/l}let o=this.filmOffset;o!==0&&(r+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}},mc=class extends Ds{constructor(){super(new Xt(50,1,.5,500)),this.isSpotLightShadow=!0,this.focus=1,this.aspect=1}updateMatrices(e){let t=this.camera,n=Fi*2*e.angle*this.focus,s=this.mapSize.width/this.mapSize.height*this.aspect,r=e.distance||t.far;(n!==t.fov||s!==t.aspect||r!==t.far)&&(t.fov=n,t.aspect=s,t.far=r,t.updateProjectionMatrix()),super.updateMatrices(e)}copy(e){return super.copy(e),this.focus=e.focus,this.aspect=e.aspect,this}toJSON(){let e=super.toJSON();return e.focus=this.focus,e.aspect=this.aspect,e}},Lr=class extends ki{constructor(e,t,n=0,s=Math.PI/3,r=0,a=2){super(e,t),this.isSpotLight=!0,this.type="SpotLight",this.position.copy(Rt.DEFAULT_UP),this.updateMatrix(),this.target=new Rt,this.distance=n,this.angle=s,this.penumbra=r,this.decay=a,this.map=null,this.shadow=new mc}get power(){return this.intensity*Math.PI}set power(e){this.intensity=e/Math.PI}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.angle=e.angle,this.penumbra=e.penumbra,this.decay=e.decay,this.target=e.target.clone(),this.map=e.map,this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.distance=this.distance,t.object.angle=this.angle,t.object.decay=this.decay,t.object.penumbra=this.penumbra,t.object.target=this.target.uuid,this.map&&this.map.isTexture&&(t.object.map=this.map.toJSON(e).uuid),t.object.shadow=this.shadow.toJSON(),t}},gc=class extends Ds{constructor(){super(new Xt(90,1,.5,500)),this.isPointLightShadow=!0}},Hi=class extends ki{constructor(e,t,n=0,s=2){super(e,t),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=s,this.shadow=new gc}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.distance=this.distance,t.object.decay=this.decay,t.object.shadow=this.shadow.toJSON(),t}},Xn=class extends Dr{constructor(e=-1,t=1,n=1,s=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=s,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,s,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2,r=n-e,a=n+e,o=s+t,c=s-t;if(this.view!==null&&this.view.enabled){let l=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=l*this.view.offsetX,a=r+l*this.view.width,o-=h*this.view.offsetY,c=o-h*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,c,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},_c=class extends Ds{constructor(){super(new Xn(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},Nr=class extends ki{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Rt.DEFAULT_UP),this.updateMatrix(),this.target=new Rt,this.shadow=new _c}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}};var ms=-90,gs=1,Eo=class extends Rt{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let s=new Xt(ms,gs,e,t);s.layers=this.layers,this.add(s);let r=new Xt(ms,gs,e,t);r.layers=this.layers,this.add(r);let a=new Xt(ms,gs,e,t);a.layers=this.layers,this.add(a);let o=new Xt(ms,gs,e,t);o.layers=this.layers,this.add(o);let c=new Xt(ms,gs,e,t);c.layers=this.layers,this.add(c);let l=new Xt(ms,gs,e,t);l.layers=this.layers,this.add(l)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[n,s,r,a,o,c]=t;for(let l of t)this.remove(l);if(e===Nn)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),c.up.set(0,1,0),c.lookAt(0,0,-1);else if(e===ys)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),c.up.set(0,-1,0),c.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(let l of t)this.add(l),l.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[r,a,o,c,l,h]=this.children,u=e.getRenderTarget(),d=e.getActiveCubeFace(),f=e.getActiveMipmapLevel(),p=e.xr.enabled;e.xr.enabled=!1;let _=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let m=!1;e.isWebGLRenderer===!0?m=e.state.buffers.depth.getReversed():m=e.reversedDepthBuffer,e.setRenderTarget(n,0,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,r),e.setRenderTarget(n,1,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(n,2,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(n,3,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),e.setRenderTarget(n,4,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),n.texture.generateMipmaps=_,e.setRenderTarget(n,5,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,h),e.setRenderTarget(u,d,f),e.xr.enabled=p,n.texture.needsPMREMUpdate=!0}},To=class extends Xt{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}},Ur=class{constructor(){this._previousTime=0,this._currentTime=0,this._startTime=performance.now(),this._delta=0,this._elapsed=0,this._timescale=1,this._document=null,this._pageVisibilityHandler=null}connect(e){this._document=e,e.hidden!==void 0&&(this._pageVisibilityHandler=ip.bind(this),e.addEventListener("visibilitychange",this._pageVisibilityHandler,!1))}disconnect(){this._pageVisibilityHandler!==null&&(this._document.removeEventListener("visibilitychange",this._pageVisibilityHandler),this._pageVisibilityHandler=null),this._document=null}getDelta(){return this._delta/1e3}getElapsed(){return this._elapsed/1e3}getTimescale(){return this._timescale}setTimescale(e){return this._timescale=e,this}reset(){return this._currentTime=performance.now()-this._startTime,this}dispose(){this.disconnect()}update(e){return this._pageVisibilityHandler!==null&&this._document.hidden===!0?this._delta=0:(this._previousTime=this._currentTime,this._currentTime=(e!==void 0?e:performance.now())-this._startTime,this._delta=(this._currentTime-this._previousTime)*this._timescale,this._elapsed+=this._delta),this}};function ip(){this._document.hidden===!1&&this.reset()}var Bc="\\[\\]\\.:\\/",sp=new RegExp("["+Bc+"]","g"),zc="[^"+Bc+"]",rp="[^"+Bc.replace("\\.","")+"]",ap=/((?:WC+[\/:])*)/.source.replace("WC",zc),op=/(WCOD+)?/.source.replace("WCOD",rp),lp=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",zc),cp=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",zc),hp=new RegExp("^"+ap+op+lp+cp+"$"),up=["material","materials","bones","map"],xc=class{constructor(e,t,n){let s=n||bt.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,s)}getValue(e,t){this.bind();let n=this._targetGroup.nCachedObjects_,s=this._bindings[n];s!==void 0&&s.getValue(e,t)}setValue(e,t){let n=this._bindings;for(let s=this._targetGroup.nCachedObjects_,r=n.length;s!==r;++s)n[s].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}},bt=class i{constructor(e,t,n){this.path=t,this.parsedPath=n||i.parseTrackName(t),this.node=i.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,n){return e&&e.isAnimationObjectGroup?new i.Composite(e,t,n):new i(e,t,n)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(sp,"")}static parseTrackName(e){let t=hp.exec(e);if(t===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+e);let n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},s=n.nodeName&&n.nodeName.lastIndexOf(".");if(s!==void 0&&s!==-1){let r=n.nodeName.substring(s+1);up.indexOf(r)!==-1&&(n.nodeName=n.nodeName.substring(0,s),n.objectName=r)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+e);return n}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){let n=function(r){for(let a=0;a<r.length;a++){let o=r[a];if(o.name===t||o.uuid===t)return o;let c=n(o.children);if(c)return c}return null},s=n(e.children);if(s)return s}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)e[t++]=n[s]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,n=t.objectName,s=t.propertyName,r=t.propertyIndex;if(e||(e=i.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){je("PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let l=t.objectIndex;switch(n){case"materials":if(!e.material){Je("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){Je("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){Je("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let h=0;h<e.length;h++)if(e[h].name===l){l=h;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){Je("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){Je("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[n]===void 0){Je("PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[n]}if(l!==void 0){if(e[l]===void 0){Je("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[l]}}let a=e[s];if(a===void 0){let l=t.nodeName;Je("PropertyBinding: Trying to update property for track: "+l+"."+s+" but it wasn't found.",e);return}let o=this.Versioning.None;this.targetObject=e,e.isMaterial===!0?o=this.Versioning.NeedsUpdate:e.isObject3D===!0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let c=this.BindingType.Direct;if(r!==void 0){if(s==="morphTargetInfluences"){if(!e.geometry){Je("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){Je("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[r]!==void 0&&(r=e.morphTargetDictionary[r])}c=this.BindingType.ArrayElement,this.resolvedProperty=a,this.propertyIndex=r}else a.fromArray!==void 0&&a.toArray!==void 0?(c=this.BindingType.HasFromToArray,this.resolvedProperty=a):Array.isArray(a)?(c=this.BindingType.EntireArray,this.resolvedProperty=a):this.propertyName=s;this.getValue=this.GetterByBindingType[c],this.setValue=this.SetterByBindingTypeAndVersioning[c][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};bt.Composite=xc;bt.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};bt.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};bt.prototype.GetterByBindingType=[bt.prototype._getValue_direct,bt.prototype._getValue_array,bt.prototype._getValue_arrayElement,bt.prototype._getValue_toArray];bt.prototype.SetterByBindingTypeAndVersioning=[[bt.prototype._setValue_direct,bt.prototype._setValue_direct_setNeedsUpdate,bt.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[bt.prototype._setValue_array,bt.prototype._setValue_array_setNeedsUpdate,bt.prototype._setValue_array_setMatrixWorldNeedsUpdate],[bt.prototype._setValue_arrayElement,bt.prototype._setValue_arrayElement_setNeedsUpdate,bt.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[bt.prototype._setValue_fromArray,bt.prototype._setValue_fromArray_setNeedsUpdate,bt.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var pv=new Float32Array(1);var nu=new Ne,Fr=class{constructor(e,t,n=0,s=1/0){this.ray=new Bi(e,t),this.near=n,this.far=s,this.camera=null,this.layers=new Es,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,t.projectionMatrix.elements[14]).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t):Je("Raycaster: Unsupported camera type: "+t.type)}setFromXRController(e){return nu.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(nu),this}intersectObject(e,t=!0,n=[]){return vc(e,this,n,t),n.sort(iu),n}intersectObjects(e,t=!0,n=[]){for(let s=0,r=e.length;s<r;s++)vc(e[s],this,n,t);return n.sort(iu),n}};function iu(i,e){return i.distance-e.distance}function vc(i,e,t,n){let s=!0;if(i.layers.test(e.layers)&&i.raycast(e,t)===!1&&(s=!1),s===!0&&n===!0){let r=i.children;for(let a=0,o=r.length;a<o;a++)vc(r[a],e,t,!0)}}var Ls=class{constructor(e=1,t=0,n=0){this.radius=e,this.phi=t,this.theta=n}set(e,t,n){return this.radius=e,this.phi=t,this.theta=n,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){return this.phi=at(this.phi,1e-6,Math.PI-1e-6),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,n){return this.radius=Math.sqrt(e*e+t*t+n*n),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(e,n),this.phi=Math.acos(at(t/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}};var Xc=class Xc{constructor(e,t,n,s){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,n,s)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,s){let r=this.elements;return r[0]=e,r[2]=t,r[1]=n,r[3]=s,this}};Xc.prototype.isMatrix2=!0;var yc=Xc;var Or=class extends Un{constructor(e,t=null){super(),this.object=e,this.domElement=t,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(e){this.domElement!==null&&this.disconnect(),this.domElement=e}disconnect(){}dispose(){}update(){}};function Vc(i,e,t,n){let s=dp(n);switch(t){case Ic:return i*e;case Fo:return i*e/s.components*s.byteLength;case Oo:return i*e/s.components*s.byteLength;case wi:return i*e*2/s.components*s.byteLength;case Bo:return i*e*2/s.components*s.byteLength;case Dc:return i*e*3/s.components*s.byteLength;case un:return i*e*4/s.components*s.byteLength;case zo:return i*e*4/s.components*s.byteLength;case Jr:case Kr:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case $r:case Qr:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case ko:case Go:return Math.max(i,16)*Math.max(e,8)/4;case Vo:case Ho:return Math.max(i,8)*Math.max(e,8)/2;case Wo:case Xo:case Yo:case jo:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case qo:case ea:case Zo:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case Jo:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case Ko:return Math.floor((i+4)/5)*Math.floor((e+3)/4)*16;case $o:return Math.floor((i+4)/5)*Math.floor((e+4)/5)*16;case Qo:return Math.floor((i+5)/6)*Math.floor((e+4)/5)*16;case el:return Math.floor((i+5)/6)*Math.floor((e+5)/6)*16;case tl:return Math.floor((i+7)/8)*Math.floor((e+4)/5)*16;case nl:return Math.floor((i+7)/8)*Math.floor((e+5)/6)*16;case il:return Math.floor((i+7)/8)*Math.floor((e+7)/8)*16;case sl:return Math.floor((i+9)/10)*Math.floor((e+4)/5)*16;case rl:return Math.floor((i+9)/10)*Math.floor((e+5)/6)*16;case al:return Math.floor((i+9)/10)*Math.floor((e+7)/8)*16;case ol:return Math.floor((i+9)/10)*Math.floor((e+9)/10)*16;case ll:return Math.floor((i+11)/12)*Math.floor((e+9)/10)*16;case cl:return Math.floor((i+11)/12)*Math.floor((e+11)/12)*16;case hl:case ul:case dl:return Math.ceil(i/4)*Math.ceil(e/4)*16;case fl:case pl:return Math.ceil(i/4)*Math.ceil(e/4)*8;case ta:case ml:return Math.ceil(i/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function dp(i){switch(i){case tn:case Ac:return{byteLength:1,components:1};case Fs:case Cc:case Vt:return{byteLength:2,components:1};case No:case Uo:return{byteLength:2,components:4};case On:case Lo:case Cn:return{byteLength:4,components:1};case Rc:case Pc:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${i}.`)}typeof __THREE_DEVTOOLS__!="undefined"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"186"}}));typeof window!="undefined"&&(window.__THREE__?je("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="186");function ud(){let i=null,e=!1,t=null,n=null;function s(r,a){n=i.requestAnimationFrame(s),t(r,a)}return{start:function(){e!==!0&&t!==null&&i!==null&&(n=i.requestAnimationFrame(s),e=!0)},stop:function(){i!==null&&i.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(r){t=r},setContext:function(r){i=r}}}function vp(i){let e=new WeakMap;function t(o,c){let l=o.array,h=o.usage,u=l.byteLength,d=i.createBuffer();i.bindBuffer(c,d),i.bufferData(c,l,h),o.onUploadCallback();let f;if(l instanceof Float32Array)f=i.FLOAT;else if(typeof Float16Array!="undefined"&&l instanceof Float16Array)f=i.HALF_FLOAT;else if(l instanceof Uint16Array)o.isFloat16BufferAttribute?f=i.HALF_FLOAT:f=i.UNSIGNED_SHORT;else if(l instanceof Int16Array)f=i.SHORT;else if(l instanceof Uint32Array)f=i.UNSIGNED_INT;else if(l instanceof Int32Array)f=i.INT;else if(l instanceof Int8Array)f=i.BYTE;else if(l instanceof Uint8Array)f=i.UNSIGNED_BYTE;else if(l instanceof Uint8ClampedArray)f=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+l);return{buffer:d,type:f,bytesPerElement:l.BYTES_PER_ELEMENT,version:o.version,size:u}}function n(o,c,l){let h=c.array,u=c.updateRanges;if(i.bindBuffer(l,o),u.length===0)i.bufferSubData(l,0,h);else{u.sort((f,p)=>f.start-p.start);let d=0;for(let f=1;f<u.length;f++){let p=u[d],_=u[f];_.start<=p.start+p.count+1?p.count=Math.max(p.count,_.start+_.count-p.start):(++d,u[d]=_)}u.length=d+1;for(let f=0,p=u.length;f<p;f++){let _=u[f];i.bufferSubData(l,_.start*h.BYTES_PER_ELEMENT,h,_.start,_.count)}c.clearUpdateRanges()}c.onUploadCallback()}function s(o){return o.isInterleavedBufferAttribute&&(o=o.data),e.get(o)}function r(o){o.isInterleavedBufferAttribute&&(o=o.data);let c=e.get(o);c&&(i.deleteBuffer(c.buffer),e.delete(o))}function a(o,c){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){let h=e.get(o);(!h||h.version<o.version)&&e.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}let l=e.get(o);if(l===void 0)e.set(o,t(o,c));else if(l.version<o.version){if(l.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(l.buffer,o,c),l.version=o.version}}return{get:s,remove:r,update:a}}var yp=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Mp=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,Sp=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,bp=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Ep=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Tp=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,wp=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Ap=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Cp=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,Rp=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Pp=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Ip=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Dp=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Lp=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Np=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Up=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,Fp=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Op=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Bp=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,zp=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Vp=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,kp=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Hp=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,Gp=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Wp=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Xp=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,qp=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Yp=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,jp=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Zp=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Jp="gl_FragColor = linearToOutputTexel( gl_FragColor );",Kp=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,$p=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,Qp=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,em=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,tm=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,nm=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,im=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,sm=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,rm=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,am=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,om=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,lm=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,cm=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,hm=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,um=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_SUN_LIGHTS > 0
	struct SunLight {
		vec3 direction;
		vec3 color;
	};
	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];
	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;
	}
#endif
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,dm=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_RETROREFLECTION
		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );
				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );
				vec4 envMapColor = textureCubeUV( envMap, envMapRotation * retroVec, roughness );
				return envMapColor.rgb * envMapIntensity;
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
		#ifdef USE_RETROREFLECTION
			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
				#ifdef ENVMAP_TYPE_CUBE_UV
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
					return getIBLRetroRadiance( viewDir, bentNormal, roughness );
				#else
					return vec3( 0.0 );
				#endif
			}
		#endif
	#endif
#endif`,fm=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,pm=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,mm=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,gm=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,_m=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_RETROREFLECTION
	material.retroreflectivity = retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,xm=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;
	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#ifdef USE_RETROREFLECTION
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );
		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	#ifdef USE_RETROREFLECTION
		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );
		F = mix( F, retroF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	#endif
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,vm=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );
	}
#endif
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )
	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
		sunLight = sunLights[ i ];
		getSunLightInfo( sunLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,ym=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_RETROREFLECTION
		#ifdef USE_ANISOTROPY
			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
		#else
			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );
		#endif
		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );
	#endif
	radiance += iblRadiance;
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,Mm=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Sm=`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,bm=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Em=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Tm=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,wm=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Am=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Cm=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Rm=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Pm=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Im=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Dm=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Lm=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Nm=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Um=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Fm=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,Om=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Bm=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,zm=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Vm=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,km=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Hm=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,Gm=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Wm=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Xm=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,qm=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Ym=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,jm=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Zm=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,Jm=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Km=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,$m=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Qm=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,e0=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,t0=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,n0=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		#define SUN_LIGHT_CASCADES 2
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#else
			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#endif
		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_SUN_LIGHT_SHADOWS > 0
		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {
			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;
			float shadow = 1.0;
			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {
				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];
				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {
					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);
					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );
				}
			}
			return shadow;
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,i0=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,s0=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_SUN_LIGHT_SHADOWS > 0
		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,r0=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {
		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,a0=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,o0=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,l0=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,c0=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,h0=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,u0=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,d0=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,f0=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,p0=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,m0=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,g0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,_0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,x0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,v0=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,y0=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,M0=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,S0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,b0=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,E0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,T0=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,w0=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,A0=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,C0=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,R0=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,P0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,I0=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,D0=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,L0=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,N0=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,U0=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,F0=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,O0=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,B0=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,z0=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,V0=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,k0=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,H0=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,G0=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,W0=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,X0=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,q0=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Y0=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,j0=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,Z0=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,J0=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,K0=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,$0=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Q0=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,lt={alphahash_fragment:yp,alphahash_pars_fragment:Mp,alphamap_fragment:Sp,alphamap_pars_fragment:bp,alphatest_fragment:Ep,alphatest_pars_fragment:Tp,aomap_fragment:wp,aomap_pars_fragment:Ap,batching_pars_vertex:Cp,batching_vertex:Rp,begin_vertex:Pp,beginnormal_vertex:Ip,bsdfs:Dp,iridescence_fragment:Lp,bumpmap_pars_fragment:Np,clipping_planes_fragment:Up,clipping_planes_pars_fragment:Fp,clipping_planes_pars_vertex:Op,clipping_planes_vertex:Bp,color_fragment:zp,color_pars_fragment:Vp,color_pars_vertex:kp,color_vertex:Hp,common:Gp,cube_uv_reflection_fragment:Wp,defaultnormal_vertex:Xp,displacementmap_pars_vertex:qp,displacementmap_vertex:Yp,emissivemap_fragment:jp,emissivemap_pars_fragment:Zp,colorspace_fragment:Jp,colorspace_pars_fragment:Kp,envmap_fragment:$p,envmap_common_pars_fragment:Qp,envmap_pars_fragment:em,envmap_pars_vertex:tm,envmap_physical_pars_fragment:dm,envmap_vertex:nm,fog_vertex:im,fog_pars_vertex:sm,fog_fragment:rm,fog_pars_fragment:am,gradientmap_pars_fragment:om,lightmap_pars_fragment:lm,lights_lambert_fragment:cm,lights_lambert_pars_fragment:hm,lights_pars_begin:um,lights_toon_fragment:fm,lights_toon_pars_fragment:pm,lights_phong_fragment:mm,lights_phong_pars_fragment:gm,lights_physical_fragment:_m,lights_physical_pars_fragment:xm,lights_fragment_begin:vm,lights_fragment_maps:ym,lights_fragment_end:Mm,lightprobes_pars_fragment:Sm,logdepthbuf_fragment:bm,logdepthbuf_pars_fragment:Em,logdepthbuf_pars_vertex:Tm,logdepthbuf_vertex:wm,map_fragment:Am,map_pars_fragment:Cm,map_particle_fragment:Rm,map_particle_pars_fragment:Pm,metalnessmap_fragment:Im,metalnessmap_pars_fragment:Dm,morphinstance_vertex:Lm,morphcolor_vertex:Nm,morphnormal_vertex:Um,morphtarget_pars_vertex:Fm,morphtarget_vertex:Om,normal_fragment_begin:Bm,normal_fragment_maps:zm,normal_pars_fragment:Vm,normal_pars_vertex:km,normal_vertex:Hm,normalmap_pars_fragment:Gm,clearcoat_normal_fragment_begin:Wm,clearcoat_normal_fragment_maps:Xm,clearcoat_pars_fragment:qm,iridescence_pars_fragment:Ym,opaque_fragment:jm,packing:Zm,premultiplied_alpha_fragment:Jm,project_vertex:Km,dithering_fragment:$m,dithering_pars_fragment:Qm,roughnessmap_fragment:e0,roughnessmap_pars_fragment:t0,shadowmap_pars_fragment:n0,shadowmap_pars_vertex:i0,shadowmap_vertex:s0,shadowmask_pars_fragment:r0,skinbase_vertex:a0,skinning_pars_vertex:o0,skinning_vertex:l0,skinnormal_vertex:c0,specularmap_fragment:h0,specularmap_pars_fragment:u0,tonemapping_fragment:d0,tonemapping_pars_fragment:f0,transmission_fragment:p0,transmission_pars_fragment:m0,uv_pars_fragment:g0,uv_pars_vertex:_0,uv_vertex:x0,worldpos_vertex:v0,background_vert:y0,background_frag:M0,backgroundCube_vert:S0,backgroundCube_frag:b0,cube_vert:E0,cube_frag:T0,depth_vert:w0,depth_frag:A0,distance_vert:C0,distance_frag:R0,equirect_vert:P0,equirect_frag:I0,linedashed_vert:D0,linedashed_frag:L0,meshbasic_vert:N0,meshbasic_frag:U0,meshlambert_vert:F0,meshlambert_frag:O0,meshmatcap_vert:B0,meshmatcap_frag:z0,meshnormal_vert:V0,meshnormal_frag:k0,meshphong_vert:H0,meshphong_frag:G0,meshphysical_vert:W0,meshphysical_frag:X0,meshtoon_vert:q0,meshtoon_frag:Y0,points_vert:j0,points_frag:Z0,shadow_vert:J0,shadow_frag:K0,sprite_vert:$0,sprite_frag:Q0},Ce={common:{diffuse:{value:new tt(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new st},alphaMap:{value:null},alphaMapTransform:{value:new st},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new st}},envmap:{envMap:{value:null},envMapRotation:{value:new st},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new st}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new st}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new st},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new st},normalScale:{value:new pe(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new st},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new st}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new st}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new st}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new tt(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new D},probesMax:{value:new D},probesResolution:{value:new D}},points:{diffuse:{value:new tt(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new st},alphaTest:{value:0},uvTransform:{value:new st}},sprite:{diffuse:{value:new tt(16777215)},opacity:{value:1},center:{value:new pe(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new st},alphaMap:{value:null},alphaMapTransform:{value:new st},alphaTest:{value:0}}},jn={basic:{uniforms:nn([Ce.common,Ce.specularmap,Ce.envmap,Ce.aomap,Ce.lightmap,Ce.fog]),vertexShader:lt.meshbasic_vert,fragmentShader:lt.meshbasic_frag},lambert:{uniforms:nn([Ce.common,Ce.specularmap,Ce.envmap,Ce.aomap,Ce.lightmap,Ce.emissivemap,Ce.bumpmap,Ce.normalmap,Ce.displacementmap,Ce.fog,Ce.lights,{emissive:{value:new tt(0)},envMapIntensity:{value:1}}]),vertexShader:lt.meshlambert_vert,fragmentShader:lt.meshlambert_frag},phong:{uniforms:nn([Ce.common,Ce.specularmap,Ce.envmap,Ce.aomap,Ce.lightmap,Ce.emissivemap,Ce.bumpmap,Ce.normalmap,Ce.displacementmap,Ce.fog,Ce.lights,{emissive:{value:new tt(0)},specular:{value:new tt(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:lt.meshphong_vert,fragmentShader:lt.meshphong_frag},standard:{uniforms:nn([Ce.common,Ce.envmap,Ce.aomap,Ce.lightmap,Ce.emissivemap,Ce.bumpmap,Ce.normalmap,Ce.displacementmap,Ce.roughnessmap,Ce.metalnessmap,Ce.fog,Ce.lights,{emissive:{value:new tt(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:lt.meshphysical_vert,fragmentShader:lt.meshphysical_frag},toon:{uniforms:nn([Ce.common,Ce.aomap,Ce.lightmap,Ce.emissivemap,Ce.bumpmap,Ce.normalmap,Ce.displacementmap,Ce.gradientmap,Ce.fog,Ce.lights,{emissive:{value:new tt(0)}}]),vertexShader:lt.meshtoon_vert,fragmentShader:lt.meshtoon_frag},matcap:{uniforms:nn([Ce.common,Ce.bumpmap,Ce.normalmap,Ce.displacementmap,Ce.fog,{matcap:{value:null}}]),vertexShader:lt.meshmatcap_vert,fragmentShader:lt.meshmatcap_frag},points:{uniforms:nn([Ce.points,Ce.fog]),vertexShader:lt.points_vert,fragmentShader:lt.points_frag},dashed:{uniforms:nn([Ce.common,Ce.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:lt.linedashed_vert,fragmentShader:lt.linedashed_frag},depth:{uniforms:nn([Ce.common,Ce.displacementmap]),vertexShader:lt.depth_vert,fragmentShader:lt.depth_frag},normal:{uniforms:nn([Ce.common,Ce.bumpmap,Ce.normalmap,Ce.displacementmap,{opacity:{value:1}}]),vertexShader:lt.meshnormal_vert,fragmentShader:lt.meshnormal_frag},sprite:{uniforms:nn([Ce.sprite,Ce.fog]),vertexShader:lt.sprite_vert,fragmentShader:lt.sprite_frag},background:{uniforms:{uvTransform:{value:new st},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:lt.background_vert,fragmentShader:lt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new st}},vertexShader:lt.backgroundCube_vert,fragmentShader:lt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:lt.cube_vert,fragmentShader:lt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:lt.equirect_vert,fragmentShader:lt.equirect_frag},distance:{uniforms:nn([Ce.common,Ce.displacementmap,{referencePosition:{value:new D},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:lt.distance_vert,fragmentShader:lt.distance_frag},shadow:{uniforms:nn([Ce.lights,Ce.fog,{color:{value:new tt(0)},opacity:{value:1}}]),vertexShader:lt.shadow_vert,fragmentShader:lt.shadow_frag}};jn.physical={uniforms:nn([jn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new st},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new st},clearcoatNormalScale:{value:new pe(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new st},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new st},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new st},sheen:{value:0},sheenColor:{value:new tt(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new st},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new st},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new st},transmissionSamplerSize:{value:new pe},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new st},attenuationDistance:{value:0},attenuationColor:{value:new tt(0)},specularColor:{value:new tt(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new st},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new st},anisotropyVector:{value:new pe},anisotropyMap:{value:null},anisotropyMapTransform:{value:new st}}]),vertexShader:lt.meshphysical_vert,fragmentShader:lt.meshphysical_frag};var xl={r:0,b:0,g:0},eg=new Ne,dd=new st;dd.set(-1,0,0,0,1,0,0,0,1);function tg(i,e,t,n,s,r){let a=new tt(0),o=s===!0?0:1,c,l,h=null,u=0,d=null;function f(S){let A=S.isScene===!0?S.background:null;if(A&&A.isTexture){let M=S.backgroundBlurriness>0;A=e.get(A,M)}return A}function p(S){let A=!1,M=f(S);M===null?m(a,o):M&&M.isColor&&(m(M,1),A=!0);let E=i.xr.getEnvironmentBlendMode();E==="additive"?t.buffers.color.setClear(0,0,0,1,r):E==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,r),(i.autoClear||A)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function _(S,A){let M=f(A);M&&(M.isCubeTexture||M.mapping===jr)?(l===void 0&&(l=new ut(new Lt(1,1,1),new Pt({name:"BackgroundCubeMaterial",uniforms:Yi(jn.backgroundCube.uniforms),vertexShader:jn.backgroundCube.vertexShader,fragmentShader:jn.backgroundCube.fragmentShader,side:Zt,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),l.geometry.deleteAttribute("uv"),l.onBeforeRender=function(E,v,b){this.matrixWorld.copyPosition(b.matrixWorld)},Object.defineProperty(l.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),n.update(l)),l.material.uniforms.envMap.value=M,l.material.uniforms.backgroundBlurriness.value=A.backgroundBlurriness,l.material.uniforms.backgroundIntensity.value=A.backgroundIntensity,l.material.uniforms.backgroundRotation.value.setFromMatrix4(eg.makeRotationFromEuler(A.backgroundRotation)).transpose(),M.isCubeTexture&&M.isRenderTargetTexture===!1&&l.material.uniforms.backgroundRotation.value.premultiply(dd),l.material.toneMapped=ct.getTransfer(M.colorSpace)!==pt,(h!==M||u!==M.version||d!==i.toneMapping)&&(l.material.needsUpdate=!0,h=M,u=M.version,d=i.toneMapping),l.layers.enableAll(),S.unshift(l,l.geometry,l.material,0,0,null)):M&&M.isTexture&&(c===void 0&&(c=new ut(new hn(2,2),new Pt({name:"BackgroundMaterial",uniforms:Yi(jn.background.uniforms),vertexShader:jn.background.vertexShader,fragmentShader:jn.background.fragmentShader,side:Si,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),n.update(c)),c.material.uniforms.t2D.value=M,c.material.uniforms.backgroundIntensity.value=A.backgroundIntensity,c.material.toneMapped=ct.getTransfer(M.colorSpace)!==pt,M.matrixAutoUpdate===!0&&M.updateMatrix(),c.material.uniforms.uvTransform.value.copy(M.matrix),(h!==M||u!==M.version||d!==i.toneMapping)&&(c.material.needsUpdate=!0,h=M,u=M.version,d=i.toneMapping),c.layers.enableAll(),S.unshift(c,c.geometry,c.material,0,0,null))}function m(S,A){S.getRGB(xl,Oc(i)),t.buffers.color.setClear(xl.r,xl.g,xl.b,A,r)}function g(){l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}return{getClearColor:function(){return a},setClearColor:function(S,A=1){a.set(S),o=A,m(a,o)},getClearAlpha:function(){return o},setClearAlpha:function(S){o=S,m(a,o)},render:p,addToRenderList:_,dispose:g}}function ng(i,e){let t=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=d(null),r=s,a=!1;function o(I,U,z,O,k){let j=!1,R=u(I,O,z,U);r!==R&&(r=R,l(r.object)),j=f(I,O,z,k),j&&p(I,O,z,k),k!==null&&e.update(k,i.ELEMENT_ARRAY_BUFFER),(j||a)&&(a=!1,M(I,U,z,O),k!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,e.get(k).buffer))}function c(){return i.createVertexArray()}function l(I){return i.bindVertexArray(I)}function h(I){return i.deleteVertexArray(I)}function u(I,U,z,O){let k=O.wireframe===!0,j=n[U.id];j===void 0&&(j={},n[U.id]=j);let R=I.isInstancedMesh===!0?I.id:0,F=j[R];F===void 0&&(F={},j[R]=F);let G=F[z.id];G===void 0&&(G={},F[z.id]=G);let q=G[k];return q===void 0&&(q=d(c()),G[k]=q),q}function d(I){let U=[],z=[],O=[];for(let k=0;k<t;k++)U[k]=0,z[k]=0,O[k]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:U,enabledAttributes:z,attributeDivisors:O,object:I,attributes:{},index:null}}function f(I,U,z,O){let k=r.attributes,j=U.attributes,R=0,F=z.getAttributes();for(let G in F)if(F[G].location>=0){let X=k[G],he=j[G];if(he===void 0&&(G==="instanceMatrix"&&I.instanceMatrix&&(he=I.instanceMatrix),G==="instanceColor"&&I.instanceColor&&(he=I.instanceColor)),X===void 0||X.attribute!==he||he&&X.data!==he.data)return!0;R++}return r.attributesNum!==R||r.index!==O}function p(I,U,z,O){let k={},j=U.attributes,R=0,F=z.getAttributes();for(let G in F)if(F[G].location>=0){let X=j[G];X===void 0&&(G==="instanceMatrix"&&I.instanceMatrix&&(X=I.instanceMatrix),G==="instanceColor"&&I.instanceColor&&(X=I.instanceColor));let he={};he.attribute=X,X&&X.data&&(he.data=X.data),k[G]=he,R++}r.attributes=k,r.attributesNum=R,r.index=O}function _(){let I=r.newAttributes;for(let U=0,z=I.length;U<z;U++)I[U]=0}function m(I){g(I,0)}function g(I,U){let z=r.newAttributes,O=r.enabledAttributes,k=r.attributeDivisors;z[I]=1,O[I]===0&&(i.enableVertexAttribArray(I),O[I]=1),k[I]!==U&&(i.vertexAttribDivisor(I,U),k[I]=U)}function S(){let I=r.newAttributes,U=r.enabledAttributes;for(let z=0,O=U.length;z<O;z++)U[z]!==I[z]&&(i.disableVertexAttribArray(z),U[z]=0)}function A(I,U,z,O,k,j,R){R===!0?i.vertexAttribIPointer(I,U,z,k,j):i.vertexAttribPointer(I,U,z,O,k,j)}function M(I,U,z,O){_();let k=O.attributes,j=z.getAttributes(),R=U.defaultAttributeValues;for(let F in j){let G=j[F];if(G.location>=0){let q=k[F];if(q===void 0&&(F==="instanceMatrix"&&I.instanceMatrix&&(q=I.instanceMatrix),F==="instanceColor"&&I.instanceColor&&(q=I.instanceColor)),q!==void 0){let X=q.normalized,he=q.itemSize,ge=e.get(q);if(ge===void 0)continue;let Fe=ge.buffer,Te=ge.type,Ve=ge.bytesPerElement,ee=Te===i.INT||Te===i.UNSIGNED_INT||q.gpuType===Lo;if(q.isInterleavedBufferAttribute){let ie=q.data,fe=ie.stride,Pe=q.offset;if(ie.isInstancedInterleavedBuffer){for(let ye=0;ye<G.locationSize;ye++)g(G.location+ye,ie.meshPerAttribute);I.isInstancedMesh!==!0&&O._maxInstanceCount===void 0&&(O._maxInstanceCount=ie.meshPerAttribute*ie.count)}else for(let ye=0;ye<G.locationSize;ye++)m(G.location+ye);i.bindBuffer(i.ARRAY_BUFFER,Fe);for(let ye=0;ye<G.locationSize;ye++)A(G.location+ye,he/G.locationSize,Te,X,fe*Ve,(Pe+he/G.locationSize*ye)*Ve,ee)}else{if(q.isInstancedBufferAttribute){for(let ie=0;ie<G.locationSize;ie++)g(G.location+ie,q.meshPerAttribute);I.isInstancedMesh!==!0&&O._maxInstanceCount===void 0&&(O._maxInstanceCount=q.meshPerAttribute*q.count)}else for(let ie=0;ie<G.locationSize;ie++)m(G.location+ie);i.bindBuffer(i.ARRAY_BUFFER,Fe);for(let ie=0;ie<G.locationSize;ie++)A(G.location+ie,he/G.locationSize,Te,X,he*Ve,he/G.locationSize*ie*Ve,ee)}}else if(R!==void 0){let X=R[F];if(X!==void 0)switch(X.length){case 2:i.vertexAttrib2fv(G.location,X);break;case 3:i.vertexAttrib3fv(G.location,X);break;case 4:i.vertexAttrib4fv(G.location,X);break;default:i.vertexAttrib1fv(G.location,X)}}}}S()}function E(){w();for(let I in n){let U=n[I];for(let z in U){let O=U[z];for(let k in O){let j=O[k];for(let R in j)h(j[R].object),delete j[R];delete O[k]}}delete n[I]}}function v(I){if(n[I.id]===void 0)return;let U=n[I.id];for(let z in U){let O=U[z];for(let k in O){let j=O[k];for(let R in j)h(j[R].object),delete j[R];delete O[k]}}delete n[I.id]}function b(I){for(let U in n){let z=n[U];for(let O in z){let k=z[O];if(k[I.id]===void 0)continue;let j=k[I.id];for(let R in j)h(j[R].object),delete j[R];delete k[I.id]}}}function x(I){for(let U in n){let z=n[U],O=I.isInstancedMesh===!0?I.id:0,k=z[O];if(k!==void 0){for(let j in k){let R=k[j];for(let F in R)h(R[F].object),delete R[F];delete k[j]}delete z[O],Object.keys(z).length===0&&delete n[U]}}}function w(){C(),a=!0,r!==s&&(r=s,l(r.object))}function C(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:o,reset:w,resetDefaultState:C,dispose:E,releaseStatesOfGeometry:v,releaseStatesOfObject:x,releaseStatesOfProgram:b,initAttributes:_,enableAttribute:m,disableUnusedAttributes:S}}function ig(i,e,t){let n;function s(c){n=c}function r(c,l){i.drawArrays(n,c,l),t.update(l,n,1)}function a(c,l,h){h!==0&&(i.drawArraysInstanced(n,c,l,h),t.update(l,n,h))}function o(c,l,h){if(h===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,c,0,l,0,h);let d=0;for(let f=0;f<h;f++)d+=l[f];t.update(d,n,1)}this.setMode=s,this.render=r,this.renderInstances=a,this.renderMultiDraw=o}function sg(i,e,t,n){let s;function r(){if(s!==void 0)return s;if(e.has("EXT_texture_filter_anisotropic")===!0){let b=e.get("EXT_texture_filter_anisotropic");s=i.getParameter(b.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function a(b){return!(b!==un&&n.convert(b)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(b){let x=b===Vt&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(b!==tn&&b!==Cn&&!x&&n.convert(b)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE))}function c(b){if(b==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";b="mediump"}return b==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let l=t.precision!==void 0?t.precision:"highp",h=c(l);h!==l&&(je("WebGLRenderer:",l,"not supported, using",h,"instead."),l=h);let u=t.logarithmicDepthBuffer===!0,d=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control");t.reversedDepthBuffer===!0&&d===!1&&je("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let f=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),p=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),_=i.getParameter(i.MAX_TEXTURE_SIZE),m=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),g=i.getParameter(i.MAX_VERTEX_ATTRIBS),S=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),A=i.getParameter(i.MAX_VARYING_VECTORS),M=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),E=i.getParameter(i.MAX_SAMPLES),v=i.getParameter(i.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:c,textureFormatReadable:a,textureTypeReadable:o,precision:l,logarithmicDepthBuffer:u,reversedDepthBuffer:d,maxTextures:f,maxVertexTextures:p,maxTextureSize:_,maxCubemapSize:m,maxAttributes:g,maxVertexUniforms:S,maxVaryings:A,maxFragmentUniforms:M,maxSamples:E,samples:v}}function rg(i){let e=this,t=null,n=0,s=!1,r=!1,a=new on,o=new st,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(u,d){let f=u.length!==0||d||n!==0||s;return s=d,n=u.length,f},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(u,d){t=h(u,d,0)},this.setState=function(u,d,f){let p=u.clippingPlanes,_=u.clipIntersection,m=u.clipShadows,g=i.get(u);if(!s||p===null||p.length===0||r&&!m)r?h(null):l();else{let S=r?0:n,A=S*4,M=g.clippingState||null;c.value=M,M=h(p,d,A,f);for(let E=0;E!==A;++E)M[E]=t[E];g.clippingState=M,this.numIntersection=_?this.numPlanes:0,this.numPlanes+=S}};function l(){c.value!==t&&(c.value=t,c.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function h(u,d,f,p){let _=u!==null?u.length:0,m=null;if(_!==0){if(m=c.value,p!==!0||m===null){let g=f+_*4,S=d.matrixWorldInverse;o.getNormalMatrix(S),(m===null||m.length<g)&&(m=new Float32Array(g));for(let A=0,M=f;A!==_;++A,M+=4)a.copy(u[A]).applyMatrix4(S,o),a.normal.toArray(m,M),m[M+3]=a.constant}c.value=m,c.needsUpdate=!0}return e.numPlanes=_,e.numIntersection=0,m}}var Vs=4,ag=6,og=20,lg=256,na=new Xn,Wu=new tt,qc=null,Yc=0,jc=0,Zc=!1,cg=new D,ji=new D,Hs=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=.1,s=100,r={}){let{size:a=256,position:o=cg}=r;qc=this._renderer.getRenderTarget(),Yc=this._renderer.getActiveCubeFace(),jc=this._renderer.getActiveMipmapLevel(),Zc=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);let c=this._allocateTargets();return c.depthBuffer=!0,this._sceneToCubeUV(e,n,s,c,o),t>0&&this._blur(c,0,0,t),this._applyPMREM(c),this._cleanup(c),c}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Yu(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=qu(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(qc,Yc,jc),this._renderer.xr.enabled=Zc,e.scissorTest=!1,zs(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===bi||e.mapping===Xi?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),qc=this._renderer.getRenderTarget(),Yc=this._renderer.getActiveCubeFace(),jc=this._renderer.getActiveMipmapLevel(),Zc=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:jt,minFilter:jt,generateMipmaps:!1,type:Vt,format:un,colorSpace:lr,depthBuffer:!1},s=Xu(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Xu(e,t,n);let{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods}=hg(r)),this._blurMaterial=dg(r,e,t),this._ggxMaterial=ug(r,e,t)}return s}_compileMaterial(e){let t=new ut(new zt,e);this._renderer.compile(t,na)}_sceneToCubeUV(e,t,n,s,r){let c=new Xt(90,1,t,n),l=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],u=this._renderer,d=u.autoClear,f=u.toneMapping;u.getClearColor(Wu),u.toneMapping=Fn,u.autoClear=!1,u.state.buffers.depth.getReversed()&&(u.setRenderTarget(s),u.clearDepth(),u.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new ut(new Lt,new _n({name:"PMREM.Background",side:Zt,depthWrite:!1,depthTest:!1})));let _=this._backgroundBox,m=_.material,g=!1,S=e.background;S?S.isColor&&(m.color.copy(S),e.background=null,g=!0):(m.color.copy(Wu),g=!0);for(let A=0;A<6;A++){let M=A%3;M===0?(c.up.set(0,l[A],0),c.position.set(r.x,r.y,r.z),c.lookAt(r.x+h[A],r.y,r.z)):M===1?(c.up.set(0,0,l[A]),c.position.set(r.x,r.y,r.z),c.lookAt(r.x,r.y+h[A],r.z)):(c.up.set(0,l[A],0),c.position.set(r.x,r.y,r.z),c.lookAt(r.x,r.y,r.z+h[A]));let E=this._cubeSize;zs(s,M*E,A>2?E:0,E,E),u.setRenderTarget(s),g&&u.render(_,c),u.render(e,c)}u.toneMapping=f,u.autoClear=d,e.background=S}_textureToCubeUV(e,t){let n=this._renderer,s=e.mapping===bi||e.mapping===Xi;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=Yu()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=qu());let r=s?this._cubemapMaterial:this._equirectMaterial,a=this._lodMeshes[0];a.material=r;let o=r.uniforms;o.envMap.value=e;let c=this._cubeSize;zs(t,0,0,3*c,2*c),n.setRenderTarget(t),n.render(a,na)}_applyPMREM(e){let t=this._renderer,n=t.autoClear;t.autoClear=!1;let s=this._lodMeshes.length;for(let r=1;r<s;r++)this._applyGGXFilter(e,r-1,r);t.autoClear=n}_applyGGXFilter(e,t,n){let s=this._renderer,r=this._pingPongRenderTarget,a=this._ggxMaterial,o=this._lodMeshes[n];o.material=a;let c=a.uniforms,l=n/(this._lodMeshes.length-1),h=t/(this._lodMeshes.length-1),u=Math.sqrt(l*l-h*h),d=l*1.25,f=u*d,{_lodMax:p}=this,_=this._sizeLods[n],m=3*_*(n>p-Vs?n-p+Vs:0),g=4*(this._cubeSize-_);c.envMap.value=e.texture,c.roughness.value=f,c.mipInt.value=p-t,zs(r,m,g,3*_,2*_),s.setRenderTarget(r),s.render(o,na),c.envMap.value=r.texture,c.roughness.value=0,c.mipInt.value=p-n,zs(e,m,g,3*_,2*_),s.setRenderTarget(e),s.render(o,na)}_blur(e,t,n,s){let r=this._pingPongRenderTarget,a=Math.min(s,Math.PI)/Math.SQRT2;this._blurPass(e,r,t,n,a),this._blurPass(r,e,n,n,a)}_blurPass(e,t,n,s,r){let a=this._renderer,o=this._blurMaterial,c=this._lodMeshes[s];c.material=o;let l=o.uniforms;l.envMap.value=e.texture,l.sigma.value=r,l.mipInt.value=this._lodMax-n;let h=this._sizeLods[s],u=3*h*(s>this._lodMax-Vs?s-this._lodMax+Vs:0),d=4*(this._cubeSize-h);zs(t,u,d,3*h,2*h),a.setRenderTarget(t),a.render(c,na)}};function hg(i){let e=[],t=[],n=i,s=i-Vs+1+ag;for(let r=0;r<s;r++){let a=Math.pow(2,n);e.push(a);let o=1/(a-2),c=-o,l=1+o,h=[c,c,l,c,l,l,c,c,l,l,c,l],u=6,d=6,f=3,p=new Float32Array(f*d*u),_=new Float32Array(f*d*u);for(let g=0;g<u;g++){let S=g%3*2/3-1,A=g>2?0:-1,M=[S,A,0,S+2/3,A,0,S+2/3,A+1,0,S,A,0,S+2/3,A+1,0,S,A+1,0];p.set(M,f*d*g);for(let E=0;E<d;E++){let v=h[E*2]*2-1,b=h[E*2+1]*2-1;g===0?ji.set(1,b,v):g===1?ji.set(-v,1,-b):g===2?ji.set(-v,b,1):g===3?ji.set(-1,b,-v):g===4?ji.set(-v,-1,b):ji.set(v,b,-1),ji.toArray(_,(g*d+E)*f)}}let m=new zt;m.setAttribute("position",new ln(p,f)),m.setAttribute("outputDirection",new ln(_,f)),t.push(new ut(m,null)),n>Vs&&n--}return{lodMeshes:t,sizeLods:e}}function Xu(i,e,t){let n=new Ct(i,e,t);return n.texture.mapping=jr,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function zs(i,e,t,n,s){i.viewport.set(e,t,n,s),i.scissor.set(e,t,n,s)}function ug(i,e,t){return new Pt({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:lg,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:Sl(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:Nt,depthTest:!1,depthWrite:!1})}function dg(i,e,t){return new Pt({name:"SphericalGaussianBlur",defines:{SAMPLES:og,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},sigma:{value:0},mipInt:{value:0}},vertexShader:Sl(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float sigma;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359
			#define GOLDEN_ANGLE 2.39996322973

			void main() {

				if ( sigma == 0.0 ) {

					gl_FragColor = vec4( bilinearCubeUV( envMap, vOutputDirection, mipInt ), 1.0 );
					return;

				}

				vec3 outputDirection = normalize( vOutputDirection );

				vec3 up = abs( outputDirection.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
				vec3 tangent = normalize( cross( up, outputDirection ) );
				vec3 bitangent = cross( outputDirection, tangent );

				// Truncate the kernel at three standard deviations or at the antipode.
				float thetaMax = min( 3.0 * sigma, PI );
				float truncation = 1.0 - exp( - 0.5 * thetaMax * thetaMax / ( sigma * sigma ) );

				vec3 accumColor = vec3( 0.0 );
				float accumWeight = 0.0;

				for ( int i = 0; i < SAMPLES; i ++ ) {

					// Stratified inverse-CDF sampling of the Gaussian, placed on a golden-angle spiral.
					float stratum = ( float( i ) + 0.5 ) / float( SAMPLES );
					float theta = sigma * sqrt( - 2.0 * log( 1.0 - stratum * truncation ) );
					float phi = float( i ) * GOLDEN_ANGLE;

					vec3 offset = cos( phi ) * tangent + sin( phi ) * bitangent;
					vec3 sampleDirection = cos( theta ) * outputDirection + sin( theta ) * offset;

					// Correct the planar sample density to solid angle.
					float weight = sin( theta ) / theta;

					accumColor += weight * bilinearCubeUV( envMap, sampleDirection, mipInt );
					accumWeight += weight;

				}

				gl_FragColor = vec4( accumColor / accumWeight, 1.0 );

			}
		`,blending:Nt,depthTest:!1,depthWrite:!1})}function qu(){return new Pt({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Sl(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Nt,depthTest:!1,depthWrite:!1})}function Yu(){return new Pt({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Sl(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Nt,depthTest:!1,depthWrite:!1})}function Sl(){return`

		precision mediump float;
		precision mediump int;

		attribute vec3 outputDirection;

		varying vec3 vOutputDirection;

		void main() {

			vOutputDirection = outputDirection;
			gl_Position = vec4( position, 1.0 );

		}
	`}var yl=class extends Ct{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},s=[n,n,n,n,n,n];this.texture=new fr(s),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},s=new Lt(5,5,5),r=new Pt({name:"CubemapFromEquirect",uniforms:Yi(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Zt,blending:Nt});r.uniforms.tEquirect.value=t;let a=new ut(s,r),o=t.minFilter;return t.minFilter===Ei&&(t.minFilter=jt),new Eo(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,n=!0,s=!0){let r=e.getRenderTarget();for(let a=0;a<6;a++)e.setRenderTarget(this,a),e.clear(t,n,s);e.setRenderTarget(r)}};function fg(i){let e=new WeakMap,t=new WeakMap,n=null;function s(d,f=!1){return d==null?null:f?a(d):r(d)}function r(d){if(d&&d.isTexture){let f=d.mapping;if(f===Po||f===Io)if(e.has(d)){let p=e.get(d).texture;return o(p,d.mapping)}else{let p=d.image;if(p&&p.height>0){let _=new yl(p.height);return _.fromEquirectangularTexture(i,d),e.set(d,_),d.addEventListener("dispose",l),o(_.texture,d.mapping)}else return null}}return d}function a(d){if(d&&d.isTexture){let f=d.mapping,p=f===Po||f===Io,_=f===bi||f===Xi;if(p||_){let m=t.get(d),g=m!==void 0?m.texture.pmremVersion:0;if(d.isRenderTargetTexture&&d.pmremVersion!==g)return n===null&&(n=new Hs(i)),m=p?n.fromEquirectangular(d,m):n.fromCubemap(d,m),m.texture.pmremVersion=d.pmremVersion,t.set(d,m),m.texture;if(m!==void 0)return m.texture;{let S=d.image;return p&&S&&S.height>0||_&&S&&c(S)?(n===null&&(n=new Hs(i)),m=p?n.fromEquirectangular(d):n.fromCubemap(d),m.texture.pmremVersion=d.pmremVersion,t.set(d,m),d.addEventListener("dispose",h),m.texture):null}}}return d}function o(d,f){return f===Po?d.mapping=bi:f===Io&&(d.mapping=Xi),d}function c(d){let f=0,p=6;for(let _=0;_<p;_++)d[_]!==void 0&&f++;return f===p}function l(d){let f=d.target;f.removeEventListener("dispose",l);let p=e.get(f);p!==void 0&&(e.delete(f),p.dispose())}function h(d){let f=d.target;f.removeEventListener("dispose",h);let p=t.get(f);p!==void 0&&(t.delete(f),p.dispose())}function u(){e=new WeakMap,t=new WeakMap,n!==null&&(n.dispose(),n=null)}return{get:s,dispose:u}}function pg(i){let e={};function t(n){if(e[n]!==void 0)return e[n];let s=i.getExtension(n);return e[n]=s,s}return{has:function(n){return t(n)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(n){let s=t(n);return s===null&&Ui("WebGLRenderer: "+n+" extension not supported."),s}}}function mg(i,e,t,n){let s={},r=new WeakMap;function a(u){let d=u.target;d.index!==null&&e.remove(d.index);for(let p in d.attributes)e.remove(d.attributes[p]);d.removeEventListener("dispose",a),delete s[d.id];let f=r.get(d);f&&(e.remove(f),r.delete(d)),n.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,t.memory.geometries--}function o(u,d){return s[d.id]===!0||(d.addEventListener("dispose",a),s[d.id]=!0,t.memory.geometries++),d}function c(u){let d=u.attributes;for(let f in d)e.update(d[f],i.ARRAY_BUFFER)}function l(u){let d=[],f=u.index,p=u.attributes.position,_=0;if(p===void 0)return;if(f!==null){let S=f.array;_=f.version;for(let A=0,M=S.length;A<M;A+=3){let E=S[A+0],v=S[A+1],b=S[A+2];d.push(E,v,v,b,b,E)}}else{let S=p.array;_=p.version;for(let A=0,M=S.length/3-1;A<M;A+=3){let E=A+0,v=A+1,b=A+2;d.push(E,v,v,b,b,E)}}let m=new(p.count>=65535?dr:ur)(d,1);m.version=_;let g=r.get(u);g&&e.remove(g),r.set(u,m)}function h(u){let d=r.get(u);if(d){let f=u.index;f!==null&&d.version<f.version&&l(u)}else l(u);return r.get(u)}return{get:o,update:c,getWireframeAttribute:h}}function gg(i,e,t){let n;function s(u){n=u}let r,a;function o(u){r=u.type,a=u.bytesPerElement}function c(u,d){i.drawElements(n,d,r,u*a),t.update(d,n,1)}function l(u,d,f){f!==0&&(i.drawElementsInstanced(n,d,r,u*a,f),t.update(d,n,f))}function h(u,d,f){if(f===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,d,0,r,u,0,f);let _=0;for(let m=0;m<f;m++)_+=d[m];t.update(_,n,1)}this.setMode=s,this.setIndex=o,this.render=c,this.renderInstances=l,this.renderMultiDraw=h}function _g(i){let e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,a,o){switch(t.calls++,a){case i.TRIANGLES:t.triangles+=o*(r/3);break;case i.LINES:t.lines+=o*(r/2);break;case i.LINE_STRIP:t.lines+=o*(r-1);break;case i.LINE_LOOP:t.lines+=o*r;break;case i.POINTS:t.points+=o*r;break;default:Je("WebGLInfo: Unknown draw mode:",a);break}}function s(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:s,update:n}}function xg(i,e,t){let n=new WeakMap,s=new Et;function r(a,o,c){let l=a.morphTargetInfluences,h=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,u=h!==void 0?h.length:0,d=n.get(o);if(d===void 0||d.count!==u){let w=function(){b.dispose(),n.delete(o),o.removeEventListener("dispose",w)};d!==void 0&&d.texture.dispose();let f=o.morphAttributes.position!==void 0,p=o.morphAttributes.normal!==void 0,_=o.morphAttributes.color!==void 0,m=o.morphAttributes.position||[],g=o.morphAttributes.normal||[],S=o.morphAttributes.color||[],A=0;f===!0&&(A=1),p===!0&&(A=2),_===!0&&(A=3);let M=o.attributes.position.count*A,E=1;M>e.maxTextureSize&&(E=Math.ceil(M/e.maxTextureSize),M=e.maxTextureSize);let v=new Float32Array(M*E*4*u),b=new hr(v,M,E,u);b.type=Cn,b.needsUpdate=!0;let x=A*4;for(let C=0;C<u;C++){let I=m[C],U=g[C],z=S[C],O=M*E*4*C;for(let k=0;k<I.count;k++){let j=k*x;f===!0&&(s.fromBufferAttribute(I,k),v[O+j+0]=s.x,v[O+j+1]=s.y,v[O+j+2]=s.z,v[O+j+3]=0),p===!0&&(s.fromBufferAttribute(U,k),v[O+j+4]=s.x,v[O+j+5]=s.y,v[O+j+6]=s.z,v[O+j+7]=0),_===!0&&(s.fromBufferAttribute(z,k),v[O+j+8]=s.x,v[O+j+9]=s.y,v[O+j+10]=s.z,v[O+j+11]=z.itemSize===4?s.w:1)}}d={count:u,texture:b,size:new pe(M,E)},n.set(o,d),o.addEventListener("dispose",w)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)c.getUniforms().setValue(i,"morphTexture",a.morphTexture,t);else{let f=0;for(let _=0;_<l.length;_++)f+=l[_];let p=o.morphTargetsRelative?1:1-f;c.getUniforms().setValue(i,"morphTargetBaseInfluence",p),c.getUniforms().setValue(i,"morphTargetInfluences",l)}c.getUniforms().setValue(i,"morphTargetsTexture",d.texture,t),c.getUniforms().setValue(i,"morphTargetsTextureSize",d.size)}return{update:r}}function vg(i,e,t,n,s){let r=new WeakMap;function a(l){let h=s.render.frame,u=l.geometry,d=e.get(l,u);if(r.get(d)!==h&&(e.update(d),r.set(d,h)),l.isInstancedMesh&&(l.hasEventListener("dispose",c)===!1&&l.addEventListener("dispose",c),r.get(l)!==h&&(t.update(l.instanceMatrix,i.ARRAY_BUFFER),l.instanceColor!==null&&t.update(l.instanceColor,i.ARRAY_BUFFER),r.set(l,h))),l.isSkinnedMesh){let f=l.skeleton;r.get(f)!==h&&(f.update(),r.set(f,h))}return d}function o(){r=new WeakMap}function c(l){let h=l.target;h.removeEventListener("dispose",c),n.releaseStatesOfObject(h),t.remove(h.instanceMatrix),h.instanceColor!==null&&t.remove(h.instanceColor)}return{update:a,dispose:o}}var yg={[Hr]:"LINEAR_TONE_MAPPING",[Gr]:"REINHARD_TONE_MAPPING",[Wr]:"CINEON_TONE_MAPPING",[Wi]:"ACES_FILMIC_TONE_MAPPING",[qr]:"AGX_TONE_MAPPING",[Yr]:"NEUTRAL_TONE_MAPPING",[Xr]:"CUSTOM_TONE_MAPPING"};function Mg(i,e,t,n,s,r){let a=new Ct(e,t,{type:i,depthBuffer:s,stencilBuffer:r,samples:n?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1}),o=null,c=null,l=new zt;l.setAttribute("position",new gt([-1,3,0,-1,-1,0,3,-1,0],3)),l.setAttribute("uv",new gt([0,2,0,0,2,0],2));let h=new Ps({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),u=new ut(l,h),d=new Xn(-1,1,1,-1,0,1),f=null,p=null,_=!1,m,g=null,S=[],A=!1;this.setSize=function(M,E){a.setSize(M,E),o!==null&&o.setSize(M,E),c!==null&&c.setSize(M,E);for(let v=0;v<S.length;v++){let b=S[v];b.setSize&&b.setSize(M,E)}},this.setEffects=function(M){S=M,A=S.length>0&&S[0].isRenderPass===!0;let E=a.width,v=a.height;S.length>0&&o===null&&(o=new Ct(E,v,{type:Vt,depthBuffer:!1,stencilBuffer:!1}),c=new Ct(E,v,{type:Vt,depthBuffer:!1,stencilBuffer:!1}));for(let b=0;b<S.length;b++){let x=S[b];x.setSize&&x.setSize(E,v)}},this.begin=function(M,E){if(_||M.toneMapping===Fn&&S.length===0)return!1;if(g=E,E!==null){let v=E.width,b=E.height;(a.width!==v||a.height!==b)&&this.setSize(v,b)}return A===!1&&M.setRenderTarget(a),m=M.toneMapping,M.toneMapping=Fn,!0},this.hasRenderPass=function(){return A},this.end=function(M,E){M.toneMapping=m,_=!0;let v=a,b=o;for(let x=0;x<S.length;x++){let w=S[x];w.enabled!==!1&&(w.render(M,b,v,E),w.needsSwap!==!1&&(v=b,b=b===o?c:o))}if(f!==M.outputColorSpace||p!==M.toneMapping){f=M.outputColorSpace,p=M.toneMapping,h.defines={},ct.getTransfer(f)===pt&&(h.defines.SRGB_TRANSFER="");let x=yg[p];x&&(h.defines[x]=""),h.needsUpdate=!0}h.uniforms.tDiffuse.value=v.texture,M.setRenderTarget(g),M.render(u,d),g=null,_=!1},this.isCompositing=function(){return _},this.dispose=function(){a.dispose(),o!==null&&o.dispose(),c!==null&&c.dispose(),l.dispose(),h.dispose()}}var fd=new en,$c=new Wn(1,1),pd=new hr,md=new io,gd=new fr,ju=[],Zu=[],Ju=new Float32Array(16),Ku=new Float32Array(9),$u=new Float32Array(4);function Gs(i,e,t){let n=i[0];if(n<=0||n>0)return i;let s=e*t,r=ju[s];if(r===void 0&&(r=new Float32Array(s),ju[s]=r),e!==0){n.toArray(r,0);for(let a=1,o=0;a!==e;++a)o+=t,i[a].toArray(r,o)}return r}function kt(i,e){if(i.length!==e.length)return!1;for(let t=0,n=i.length;t<n;t++)if(i[t]!==e[t])return!1;return!0}function Ht(i,e){for(let t=0,n=e.length;t<n;t++)i[t]=e[t]}function bl(i,e){let t=Zu[e];t===void 0&&(t=new Int32Array(e),Zu[e]=t);for(let n=0;n!==e;++n)t[n]=i.allocateTextureUnit();return t}function Sg(i,e){let t=this.cache;t[0]!==e&&(i.uniform1f(this.addr,e),t[0]=e)}function bg(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(kt(t,e))return;i.uniform2fv(this.addr,e),Ht(t,e)}}function Eg(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(i.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(kt(t,e))return;i.uniform3fv(this.addr,e),Ht(t,e)}}function Tg(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(kt(t,e))return;i.uniform4fv(this.addr,e),Ht(t,e)}}function wg(i,e){let t=this.cache,n=e.elements;if(n===void 0){if(kt(t,e))return;i.uniformMatrix2fv(this.addr,!1,e),Ht(t,e)}else{if(kt(t,n))return;$u.set(n),i.uniformMatrix2fv(this.addr,!1,$u),Ht(t,n)}}function Ag(i,e){let t=this.cache,n=e.elements;if(n===void 0){if(kt(t,e))return;i.uniformMatrix3fv(this.addr,!1,e),Ht(t,e)}else{if(kt(t,n))return;Ku.set(n),i.uniformMatrix3fv(this.addr,!1,Ku),Ht(t,n)}}function Cg(i,e){let t=this.cache,n=e.elements;if(n===void 0){if(kt(t,e))return;i.uniformMatrix4fv(this.addr,!1,e),Ht(t,e)}else{if(kt(t,n))return;Ju.set(n),i.uniformMatrix4fv(this.addr,!1,Ju),Ht(t,n)}}function Rg(i,e){let t=this.cache;t[0]!==e&&(i.uniform1i(this.addr,e),t[0]=e)}function Pg(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(kt(t,e))return;i.uniform2iv(this.addr,e),Ht(t,e)}}function Ig(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(kt(t,e))return;i.uniform3iv(this.addr,e),Ht(t,e)}}function Dg(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(kt(t,e))return;i.uniform4iv(this.addr,e),Ht(t,e)}}function Lg(i,e){let t=this.cache;t[0]!==e&&(i.uniform1ui(this.addr,e),t[0]=e)}function Ng(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(kt(t,e))return;i.uniform2uiv(this.addr,e),Ht(t,e)}}function Ug(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(kt(t,e))return;i.uniform3uiv(this.addr,e),Ht(t,e)}}function Fg(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(kt(t,e))return;i.uniform4uiv(this.addr,e),Ht(t,e)}}function Og(i,e,t){let n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?($c.compareFunction=t.isReversedDepthBuffer()?_l:gl,r=$c):r=fd,t.setTexture2D(e||r,s)}function Bg(i,e,t){let n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture3D(e||md,s)}function zg(i,e,t){let n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTextureCube(e||gd,s)}function Vg(i,e,t){let n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture2DArray(e||pd,s)}function kg(i){switch(i){case 5126:return Sg;case 35664:return bg;case 35665:return Eg;case 35666:return Tg;case 35674:return wg;case 35675:return Ag;case 35676:return Cg;case 5124:case 35670:return Rg;case 35667:case 35671:return Pg;case 35668:case 35672:return Ig;case 35669:case 35673:return Dg;case 5125:return Lg;case 36294:return Ng;case 36295:return Ug;case 36296:return Fg;case 35678:case 36198:case 36298:case 36306:case 35682:return Og;case 35679:case 36299:case 36307:return Bg;case 35680:case 36300:case 36308:case 36293:return zg;case 36289:case 36303:case 36311:case 36292:return Vg}}function Hg(i,e){i.uniform1fv(this.addr,e)}function Gg(i,e){let t=Gs(e,this.size,2);i.uniform2fv(this.addr,t)}function Wg(i,e){let t=Gs(e,this.size,3);i.uniform3fv(this.addr,t)}function Xg(i,e){let t=Gs(e,this.size,4);i.uniform4fv(this.addr,t)}function qg(i,e){let t=Gs(e,this.size,4);i.uniformMatrix2fv(this.addr,!1,t)}function Yg(i,e){let t=Gs(e,this.size,9);i.uniformMatrix3fv(this.addr,!1,t)}function jg(i,e){let t=Gs(e,this.size,16);i.uniformMatrix4fv(this.addr,!1,t)}function Zg(i,e){i.uniform1iv(this.addr,e)}function Jg(i,e){i.uniform2iv(this.addr,e)}function Kg(i,e){i.uniform3iv(this.addr,e)}function $g(i,e){i.uniform4iv(this.addr,e)}function Qg(i,e){i.uniform1uiv(this.addr,e)}function e_(i,e){i.uniform2uiv(this.addr,e)}function t_(i,e){i.uniform3uiv(this.addr,e)}function n_(i,e){i.uniform4uiv(this.addr,e)}function i_(i,e,t){let n=this.cache,s=e.length,r=bl(t,s);kt(n,r)||(i.uniform1iv(this.addr,r),Ht(n,r));let a;this.type===i.SAMPLER_2D_SHADOW?a=$c:a=fd;for(let o=0;o!==s;++o)t.setTexture2D(e[o]||a,r[o])}function s_(i,e,t){let n=this.cache,s=e.length,r=bl(t,s);kt(n,r)||(i.uniform1iv(this.addr,r),Ht(n,r));for(let a=0;a!==s;++a)t.setTexture3D(e[a]||md,r[a])}function r_(i,e,t){let n=this.cache,s=e.length,r=bl(t,s);kt(n,r)||(i.uniform1iv(this.addr,r),Ht(n,r));for(let a=0;a!==s;++a)t.setTextureCube(e[a]||gd,r[a])}function a_(i,e,t){let n=this.cache,s=e.length,r=bl(t,s);kt(n,r)||(i.uniform1iv(this.addr,r),Ht(n,r));for(let a=0;a!==s;++a)t.setTexture2DArray(e[a]||pd,r[a])}function o_(i){switch(i){case 5126:return Hg;case 35664:return Gg;case 35665:return Wg;case 35666:return Xg;case 35674:return qg;case 35675:return Yg;case 35676:return jg;case 5124:case 35670:return Zg;case 35667:case 35671:return Jg;case 35668:case 35672:return Kg;case 35669:case 35673:return $g;case 5125:return Qg;case 36294:return e_;case 36295:return t_;case 36296:return n_;case 35678:case 36198:case 36298:case 36306:case 35682:return i_;case 35679:case 36299:case 36307:return s_;case 35680:case 36300:case 36308:case 36293:return r_;case 36289:case 36303:case 36311:case 36292:return a_}}var Qc=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=kg(t.type)}},eh=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=o_(t.type)}},th=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let s=this.seq;for(let r=0,a=s.length;r!==a;++r){let o=s[r];o.setValue(e,t[o.id],n)}}},Jc=/(\w+)(\])?(\[|\.)?/g;function Qu(i,e){i.seq.push(e),i.map[e.id]=e}function l_(i,e,t){let n=i.name,s=n.length;for(Jc.lastIndex=0;;){let r=Jc.exec(n),a=Jc.lastIndex,o=r[1],c=r[2]==="]",l=r[3];if(c&&(o=o|0),l===void 0||l==="["&&a+2===s){Qu(t,l===void 0?new Qc(o,i,e):new eh(o,i,e));break}else{let u=t.map[o];u===void 0&&(u=new th(o),Qu(t,u)),t=u}}}var ks=class{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let a=0;a<n;++a){let o=e.getActiveUniform(t,a),c=e.getUniformLocation(t,o.name);l_(o,c,this)}let s=[],r=[];for(let a of this.seq)a.type===e.SAMPLER_2D_SHADOW||a.type===e.SAMPLER_CUBE_SHADOW||a.type===e.SAMPLER_2D_ARRAY_SHADOW?s.push(a):r.push(a);s.length>0&&(this.seq=s.concat(r))}setValue(e,t,n,s){let r=this.map[t];r!==void 0&&r.setValue(e,n,s)}setOptional(e,t,n){let s=t[n];s!==void 0&&this.setValue(e,n,s)}static upload(e,t,n,s){for(let r=0,a=t.length;r!==a;++r){let o=t[r],c=n[o.id];c.needsUpdate!==!1&&o.setValue(e,c.value,s)}}static seqWithValue(e,t){let n=[];for(let s=0,r=e.length;s!==r;++s){let a=e[s];a.id in t&&n.push(a)}return n}};function ed(i,e,t){let n=i.createShader(e);return i.shaderSource(n,t),i.compileShader(n),n}var c_=37297,h_=0;function u_(i,e){let t=i.split(`
`),n=[],s=Math.max(e-6,0),r=Math.min(e+6,t.length);for(let a=s;a<r;a++){let o=a+1;n.push(`${o===e?">":" "} ${o}: ${t[a]}`)}return n.join(`
`)}var td=new st;function d_(i){ct._getMatrix(td,ct.workingColorSpace,i);let e=`mat3( ${td.elements.map(t=>t.toFixed(4))} )`;switch(ct.getTransfer(i)){case cr:return[e,"LinearTransferOETF"];case pt:return[e,"sRGBTransferOETF"];default:return je("WebGLProgram: Unsupported color space: ",i),[e,"LinearTransferOETF"]}}function nd(i,e,t){let n=i.getShaderParameter(e,i.COMPILE_STATUS),r=(i.getShaderInfoLog(e)||"").trim();if(n&&r==="")return"";let a=/ERROR: 0:(\d+)/.exec(r);if(a){let o=parseInt(a[1]);return t.toUpperCase()+`

`+r+`

`+u_(i.getShaderSource(e),o)}else return r}function f_(i,e){let t=d_(e);return[`vec4 ${i}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}var p_={[Hr]:"Linear",[Gr]:"Reinhard",[Wr]:"Cineon",[Wi]:"ACESFilmic",[qr]:"AgX",[Yr]:"Neutral",[Xr]:"Custom"};function m_(i,e){let t=p_[e];return t===void 0?(je("WebGLProgram: Unsupported toneMapping:",e),"vec3 "+i+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+i+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}var vl=new D;function g_(){ct.getLuminanceCoefficients(vl);let i=vl.x.toFixed(4),e=vl.y.toFixed(4),t=vl.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function __(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(sa).join(`
`)}function x_(i){let e=[];for(let t in i){let n=i[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function v_(i,e){let t={},n=i.getProgramParameter(e,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){let r=i.getActiveAttrib(e,s),a=r.name,o=1;r.type===i.FLOAT_MAT2&&(o=2),r.type===i.FLOAT_MAT3&&(o=3),r.type===i.FLOAT_MAT4&&(o=4),t[a]={type:r.type,location:i.getAttribLocation(e,a),locationSize:o}}return t}function sa(i){return i!==""}function id(i,e){let t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return i.replace(/NUM_SUN_LIGHTS/g,e.numSunLights).replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,e.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function sd(i,e){return i.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}var y_=/^[ \t]*#include +<([\w\d./]+)>/gm;function nh(i){return i.replace(y_,S_)}var M_=new Map;function S_(i,e){let t=lt[e];if(t===void 0){let n=M_.get(e);if(n!==void 0)t=lt[n],je('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+e+">")}return nh(t)}var b_=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function rd(i){return i.replace(b_,E_)}function E_(i,e,t,n){let s="";for(let r=parseInt(e);r<parseInt(t);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function ad(i){let e=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?e+=`
#define HIGH_PRECISION`:i.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}var T_={[Br]:"SHADOWMAP_TYPE_PCF",[Ns]:"SHADOWMAP_TYPE_VSM"};function w_(i){return T_[i.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var A_={[bi]:"ENVMAP_TYPE_CUBE",[Xi]:"ENVMAP_TYPE_CUBE",[jr]:"ENVMAP_TYPE_CUBE_UV"};function C_(i){return i.envMap===!1?"ENVMAP_TYPE_CUBE":A_[i.envMapMode]||"ENVMAP_TYPE_CUBE"}var R_={[Xi]:"ENVMAP_MODE_REFRACTION"};function P_(i){return i.envMap===!1?"ENVMAP_MODE_REFLECTION":R_[i.envMapMode]||"ENVMAP_MODE_REFLECTION"}var I_={[Ro]:"ENVMAP_BLENDING_MULTIPLY",[yu]:"ENVMAP_BLENDING_MIX",[Mu]:"ENVMAP_BLENDING_ADD"};function D_(i){return i.envMap===!1?"ENVMAP_BLENDING_NONE":I_[i.combine]||"ENVMAP_BLENDING_NONE"}function L_(i){let e=i.envMapCubeUVHeight;if(e===null)return null;let t=Math.log2(e)-2,n=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:n,maxMip:t}}function N_(i,e,t,n){let s=i.getContext(),r=t.defines,a=t.vertexShader,o=t.fragmentShader,c=w_(t),l=C_(t),h=P_(t),u=D_(t),d=L_(t),f=__(t),p=x_(r),_=s.createProgram(),m,g,S=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,p].filter(sa).join(`
`),m.length>0&&(m+=`
`),g=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,p].filter(sa).join(`
`),g.length>0&&(g+=`
`)):(m=[ad(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,p,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexNormals?"#define HAS_NORMAL":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+c:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(sa).join(`
`),g=[ad(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,p,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+l:"",t.envMap?"#define "+h:"",t.envMap?"#define "+u:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.retroreflection?"#define USE_RETROREFLECTION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+c:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==Fn?"#define TONE_MAPPING":"",t.toneMapping!==Fn?lt.tonemapping_pars_fragment:"",t.toneMapping!==Fn?m_("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",lt.colorspace_pars_fragment,f_("linearToOutputTexel",t.outputColorSpace),g_(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(sa).join(`
`)),a=nh(a),a=id(a,t),a=sd(a,t),o=nh(o),o=id(o,t),o=sd(o,t),a=rd(a),o=rd(o),t.isRawShaderMaterial!==!0&&(S=`#version 300 es
`,m=[f,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,g=["#define varying in",t.glslVersion===Lc?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===Lc?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+g);let A=S+m+a,M=S+g+o,E=ed(s,s.VERTEX_SHADER,A),v=ed(s,s.FRAGMENT_SHADER,M);s.attachShader(_,E),s.attachShader(_,v),t.index0AttributeName!==void 0?s.bindAttribLocation(_,0,t.index0AttributeName):t.hasPositionAttribute===!0&&s.bindAttribLocation(_,0,"position"),s.linkProgram(_);function b(I){if(i.debug.checkShaderErrors){let U=s.getProgramInfoLog(_)||"",z=s.getShaderInfoLog(E)||"",O=s.getShaderInfoLog(v)||"",k=U.trim(),j=z.trim(),R=O.trim(),F=!0,G=!0;if(s.getProgramParameter(_,s.LINK_STATUS)===!1)if(F=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,_,E,v);else{let q=nd(s,E,"vertex"),X=nd(s,v,"fragment");Je("WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(_,s.VALIDATE_STATUS)+`

Material Name: `+I.name+`
Material Type: `+I.type+`

Program Info Log: `+k+`
`+q+`
`+X)}else k!==""?je("WebGLProgram: Program Info Log:",k):(j===""||R==="")&&(G=!1);G&&(I.diagnostics={runnable:F,programLog:k,vertexShader:{log:j,prefix:m},fragmentShader:{log:R,prefix:g}})}s.deleteShader(E),s.deleteShader(v),x=new ks(s,_),w=v_(s,_)}let x;this.getUniforms=function(){return x===void 0&&b(this),x};let w;this.getAttributes=function(){return w===void 0&&b(this),w};let C=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return C===!1&&(C=s.getProgramParameter(_,c_)),C},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(_),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=h_++,this.cacheKey=e,this.usedTimes=1,this.program=_,this.vertexShader=E,this.fragmentShader=v,this}var U_=0,ih=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,n){let s=this._getShaderCacheForMaterial(e);return s.has(t)===!1&&(s.add(t),t.usedTimes++),s.has(n)===!1&&(s.add(n),n.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);return n===void 0&&(n=new sh(e),t.set(e,n)),n}},sh=class{constructor(e){this.id=U_++,this.code=e,this.usedTimes=0}};function F_(i){return i===wi||i===ea||i===ta}function O_(i,e,t,n,s,r){let a=new Es,o=new ih,c=new Set,l=[],h=new Map,u=n.logarithmicDepthBuffer,d=n.precision,f={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function p(x){return c.add(x),x===0?"uv":`uv${x}`}function _(x,w,C,I,U,z){let O=I.fog,k=U.geometry,j=x.isMeshStandardMaterial||x.isMeshLambertMaterial||x.isMeshPhongMaterial?I.environment:null,R=x.isMeshStandardMaterial||x.isMeshLambertMaterial&&!x.envMap||x.isMeshPhongMaterial&&!x.envMap,F=e.get(x.envMap||j,R),G=F&&F.mapping===jr?F.image.height:null,q=f[x.type];x.precision!==null&&(d=n.getMaxPrecision(x.precision),d!==x.precision&&je("WebGLProgram.getParameters:",x.precision,"not supported, using",d,"instead."));let X=k.morphAttributes.position||k.morphAttributes.normal||k.morphAttributes.color,he=X!==void 0?X.length:0,ge=0;k.morphAttributes.position!==void 0&&(ge=1),k.morphAttributes.normal!==void 0&&(ge=2),k.morphAttributes.color!==void 0&&(ge=3);let Fe,Te,Ve,ee;if(q){let Se=jn[q];Fe=Se.vertexShader,Te=Se.fragmentShader}else{Fe=x.vertexShader,Te=x.fragmentShader;let Se=o.getVertexShaderStage(x),Le=o.getFragmentShaderStage(x);o.update(x,Se,Le),Ve=Se.id,ee=Le.id}let ie=i.getRenderTarget(),fe=i.state.buffers.depth.getReversed(),Pe=U.isInstancedMesh===!0,ye=U.isBatchedMesh===!0,Oe=!!x.map,Qe=!!x.matcap,ae=!!F,ue=!!x.aoMap,se=!!x.lightMap,oe=!!x.bumpMap&&x.wireframe===!1,de=!!x.normalMap,xe=!!x.displacementMap,Me=!!x.emissiveMap,Q=!!x.metalnessMap,qe=!!x.roughnessMap,B=x.anisotropy>0,rt=x.clearcoat>0,nt=x.dispersion>0,P=x.retroreflectivity>0,y=x.iridescence>0,W=x.sheen>0,Y=x.transmission>0,te=B&&!!x.anisotropyMap,me=rt&&!!x.clearcoatMap,ve=rt&&!!x.clearcoatNormalMap,re=rt&&!!x.clearcoatRoughnessMap,le=y&&!!x.iridescenceMap,Ee=y&&!!x.iridescenceThicknessMap,ke=W&&!!x.sheenColorMap,be=W&&!!x.sheenRoughnessMap,_e=!!x.specularMap,ze=!!x.specularColorMap,Xe=!!x.specularIntensityMap,Ke=Y&&!!x.transmissionMap,H=Y&&!!x.thicknessMap,we=!!x.gradientMap,ce=!!x.alphaMap,Ae=x.alphaTest>0,De=!!x.alphaHash,N=!!x.extensions,Z=Fn;x.toneMapped&&(ie===null||ie.isXRRenderTarget===!0)&&(Z=i.toneMapping);let $={shaderID:q,shaderType:x.type,shaderName:x.name,vertexShader:Fe,fragmentShader:Te,defines:x.defines,customVertexShaderID:Ve,customFragmentShaderID:ee,isRawShaderMaterial:x.isRawShaderMaterial===!0,glslVersion:x.glslVersion,precision:d,batching:ye,batchingColor:ye&&U._colorsTexture!==null,instancing:Pe,instancingColor:Pe&&U.instanceColor!==null,instancingMorph:Pe&&U.morphTexture!==null,outputColorSpace:ie===null?i.outputColorSpace:ie.isXRRenderTarget===!0?ie.texture.colorSpace:ct.workingColorSpace,alphaToCoverage:!!x.alphaToCoverage,map:Oe,matcap:Qe,envMap:ae,envMapMode:ae&&F.mapping,envMapCubeUVHeight:G,aoMap:ue,lightMap:se,bumpMap:oe,normalMap:de,displacementMap:xe,emissiveMap:Me,normalMapObjectSpace:de&&x.normalMapType===Eu,normalMapTangentSpace:de&&x.normalMapType===Os,packedNormalMap:de&&x.normalMapType===Os&&F_(x.normalMap.format),metalnessMap:Q,roughnessMap:qe,anisotropy:B,anisotropyMap:te,clearcoat:rt,clearcoatMap:me,clearcoatNormalMap:ve,clearcoatRoughnessMap:re,dispersion:nt,retroreflection:P,iridescence:y,iridescenceMap:le,iridescenceThicknessMap:Ee,sheen:W,sheenColorMap:ke,sheenRoughnessMap:be,specularMap:_e,specularColorMap:ze,specularIntensityMap:Xe,transmission:Y,transmissionMap:Ke,thicknessMap:H,gradientMap:we,opaque:x.transparent===!1&&x.blending===Us&&x.alphaToCoverage===!1,alphaMap:ce,alphaTest:Ae,alphaHash:De,combine:x.combine,mapUv:Oe&&p(x.map.channel),aoMapUv:ue&&p(x.aoMap.channel),lightMapUv:se&&p(x.lightMap.channel),bumpMapUv:oe&&p(x.bumpMap.channel),normalMapUv:de&&p(x.normalMap.channel),displacementMapUv:xe&&p(x.displacementMap.channel),emissiveMapUv:Me&&p(x.emissiveMap.channel),metalnessMapUv:Q&&p(x.metalnessMap.channel),roughnessMapUv:qe&&p(x.roughnessMap.channel),anisotropyMapUv:te&&p(x.anisotropyMap.channel),clearcoatMapUv:me&&p(x.clearcoatMap.channel),clearcoatNormalMapUv:ve&&p(x.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:re&&p(x.clearcoatRoughnessMap.channel),iridescenceMapUv:le&&p(x.iridescenceMap.channel),iridescenceThicknessMapUv:Ee&&p(x.iridescenceThicknessMap.channel),sheenColorMapUv:ke&&p(x.sheenColorMap.channel),sheenRoughnessMapUv:be&&p(x.sheenRoughnessMap.channel),specularMapUv:_e&&p(x.specularMap.channel),specularColorMapUv:ze&&p(x.specularColorMap.channel),specularIntensityMapUv:Xe&&p(x.specularIntensityMap.channel),transmissionMapUv:Ke&&p(x.transmissionMap.channel),thicknessMapUv:H&&p(x.thicknessMap.channel),alphaMapUv:ce&&p(x.alphaMap.channel),vertexTangents:!!k.attributes.tangent&&(de||B),vertexNormals:!!k.attributes.normal,vertexColors:x.vertexColors,vertexAlphas:x.vertexColors===!0&&!!k.attributes.color&&k.attributes.color.itemSize===4,pointsUvs:U.isPoints===!0&&!!k.attributes.uv&&(Oe||ce),fog:!!O,useFog:x.fog===!0,fogExp2:!!O&&O.isFogExp2,flatShading:x.wireframe===!1&&(x.flatShading===!0||k.attributes.normal===void 0&&de===!1&&(x.isMeshLambertMaterial||x.isMeshPhongMaterial||x.isMeshStandardMaterial||x.isMeshPhysicalMaterial)),sizeAttenuation:x.sizeAttenuation===!0,logarithmicDepthBuffer:u,reversedDepthBuffer:fe,skinning:U.isSkinnedMesh===!0,hasPositionAttribute:k.attributes.position!==void 0,morphTargets:k.morphAttributes.position!==void 0,morphNormals:k.morphAttributes.normal!==void 0,morphColors:k.morphAttributes.color!==void 0,morphTargetsCount:he,morphTextureStride:ge,numSunLights:w.sun.length,numDirLights:w.directional.length,numPointLights:w.point.length,numSpotLights:w.spot.length,numSpotLightMaps:w.spotLightMap.length,numRectAreaLights:w.rectArea.length,numHemiLights:w.hemi.length,numSunLightShadows:w.sunShadowMap.length,numDirLightShadows:w.directionalShadowMap.length,numPointLightShadows:w.pointShadowMap.length,numSpotLightShadows:w.spotShadowMap.length,numSpotLightShadowsWithMaps:w.numSpotLightShadowsWithMaps,numLightProbes:w.numLightProbes,numLightProbeGrids:z.length,numClippingPlanes:r.numPlanes,numClipIntersection:r.numIntersection,dithering:x.dithering,shadowMapEnabled:i.shadowMap.enabled&&C.length>0,shadowMapType:i.shadowMap.type,toneMapping:Z,decodeVideoTexture:Oe&&x.map.isVideoTexture===!0&&ct.getTransfer(x.map.colorSpace)===pt,decodeVideoTextureEmissive:Me&&x.emissiveMap.isVideoTexture===!0&&ct.getTransfer(x.emissiveMap.colorSpace)===pt,premultipliedAlpha:x.premultipliedAlpha,doubleSided:x.side===yn,flipSided:x.side===Zt,useDepthPacking:x.depthPacking>=0,depthPacking:x.depthPacking||0,index0AttributeName:x.index0AttributeName,extensionClipCullDistance:N&&x.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(N&&x.extensions.multiDraw===!0||ye)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:x.customProgramCacheKey()};return $.vertexUv1s=c.has(1),$.vertexUv2s=c.has(2),$.vertexUv3s=c.has(3),c.clear(),$}function m(x){let w=[];if(x.shaderID?w.push(x.shaderID):(w.push(x.customVertexShaderID),w.push(x.customFragmentShaderID)),x.defines!==void 0)for(let C in x.defines)w.push(C),w.push(x.defines[C]);return x.isRawShaderMaterial===!1&&(g(w,x),S(w,x),w.push(i.outputColorSpace)),w.push(x.customProgramCacheKey),w.join()}function g(x,w){x.push(w.precision),x.push(w.outputColorSpace),x.push(w.envMapMode),x.push(w.envMapCubeUVHeight),x.push(w.mapUv),x.push(w.alphaMapUv),x.push(w.lightMapUv),x.push(w.aoMapUv),x.push(w.bumpMapUv),x.push(w.normalMapUv),x.push(w.displacementMapUv),x.push(w.emissiveMapUv),x.push(w.metalnessMapUv),x.push(w.roughnessMapUv),x.push(w.anisotropyMapUv),x.push(w.clearcoatMapUv),x.push(w.clearcoatNormalMapUv),x.push(w.clearcoatRoughnessMapUv),x.push(w.iridescenceMapUv),x.push(w.iridescenceThicknessMapUv),x.push(w.sheenColorMapUv),x.push(w.sheenRoughnessMapUv),x.push(w.specularMapUv),x.push(w.specularColorMapUv),x.push(w.specularIntensityMapUv),x.push(w.transmissionMapUv),x.push(w.thicknessMapUv),x.push(w.combine),x.push(w.fogExp2),x.push(w.sizeAttenuation),x.push(w.morphTargetsCount),x.push(w.morphAttributeCount),x.push(w.numSunLights),x.push(w.numDirLights),x.push(w.numPointLights),x.push(w.numSpotLights),x.push(w.numSpotLightMaps),x.push(w.numHemiLights),x.push(w.numRectAreaLights),x.push(w.numSunLightShadows),x.push(w.numDirLightShadows),x.push(w.numPointLightShadows),x.push(w.numSpotLightShadows),x.push(w.numSpotLightShadowsWithMaps),x.push(w.numLightProbes),x.push(w.shadowMapType),x.push(w.toneMapping),x.push(w.numClippingPlanes),x.push(w.numClipIntersection),x.push(w.depthPacking)}function S(x,w){a.disableAll(),w.instancing&&a.enable(0),w.instancingColor&&a.enable(1),w.instancingMorph&&a.enable(2),w.matcap&&a.enable(3),w.envMap&&a.enable(4),w.normalMapObjectSpace&&a.enable(5),w.normalMapTangentSpace&&a.enable(6),w.clearcoat&&a.enable(7),w.iridescence&&a.enable(8),w.alphaTest&&a.enable(9),w.vertexColors&&a.enable(10),w.vertexAlphas&&a.enable(11),w.vertexUv1s&&a.enable(12),w.vertexUv2s&&a.enable(13),w.vertexUv3s&&a.enable(14),w.vertexTangents&&a.enable(15),w.anisotropy&&a.enable(16),w.alphaHash&&a.enable(17),w.batching&&a.enable(18),w.dispersion&&a.enable(19),w.retroreflection&&a.enable(24),w.batchingColor&&a.enable(20),w.gradientMap&&a.enable(21),w.packedNormalMap&&a.enable(22),w.vertexNormals&&a.enable(23),x.push(a.mask),a.disableAll(),w.fog&&a.enable(0),w.useFog&&a.enable(1),w.flatShading&&a.enable(2),w.logarithmicDepthBuffer&&a.enable(3),w.reversedDepthBuffer&&a.enable(4),w.skinning&&a.enable(5),w.morphTargets&&a.enable(6),w.morphNormals&&a.enable(7),w.morphColors&&a.enable(8),w.premultipliedAlpha&&a.enable(9),w.shadowMapEnabled&&a.enable(10),w.doubleSided&&a.enable(11),w.flipSided&&a.enable(12),w.useDepthPacking&&a.enable(13),w.dithering&&a.enable(14),w.transmission&&a.enable(15),w.sheen&&a.enable(16),w.opaque&&a.enable(17),w.pointsUvs&&a.enable(18),w.decodeVideoTexture&&a.enable(19),w.decodeVideoTextureEmissive&&a.enable(20),w.alphaToCoverage&&a.enable(21),w.numLightProbeGrids>0&&a.enable(22),w.hasPositionAttribute&&a.enable(23),x.push(a.mask)}function A(x){let w=f[x.type],C;if(w){let I=jn[w];C=Rn.clone(I.uniforms)}else C=x.uniforms;return C}function M(x,w){let C=h.get(w);return C!==void 0?++C.usedTimes:(C=new N_(i,w,x,s),l.push(C),h.set(w,C)),C}function E(x){if(--x.usedTimes===0){let w=l.indexOf(x);l[w]=l[l.length-1],l.pop(),h.delete(x.cacheKey),x.destroy()}}function v(x){o.remove(x)}function b(){o.dispose()}return{getParameters:_,getProgramCacheKey:m,getUniforms:A,acquireProgram:M,releaseProgram:E,releaseShaderCache:v,programs:l,dispose:b}}function B_(){let i=new WeakMap;function e(a){return i.has(a)}function t(a){let o=i.get(a);return o===void 0&&(o={},i.set(a,o)),o}function n(a){i.delete(a)}function s(a,o,c){i.get(a)[o]=c}function r(){i=new WeakMap}return{has:e,get:t,remove:n,update:s,dispose:r}}function z_(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.material.id!==e.material.id?i.material.id-e.material.id:i.materialVariant!==e.materialVariant?i.materialVariant-e.materialVariant:i.z!==e.z?i.z-e.z:i.id-e.id}function od(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.z!==e.z?e.z-i.z:i.id-e.id}function ld(){let i=[],e=0,t=[],n=[],s=[];function r(){e=0,t.length=0,n.length=0,s.length=0}function a(d){let f=0;return d.isInstancedMesh&&(f+=2),d.isSkinnedMesh&&(f+=1),f}function o(d,f,p,_,m,g){let S=i[e];return S===void 0?(S={id:d.id,object:d,geometry:f,material:p,materialVariant:a(d),groupOrder:_,renderOrder:d.renderOrder,z:m,group:g},i[e]=S):(S.id=d.id,S.object=d,S.geometry=f,S.material=p,S.materialVariant=a(d),S.groupOrder=_,S.renderOrder=d.renderOrder,S.z=m,S.group=g),e++,S}function c(d,f,p,_,m,g,S){S.reversedDepth===!0&&(m=-m);let A=o(d,f,p,_,m,g);p.transmission>0?n.push(A):p.transparent===!0?s.push(A):t.push(A)}function l(d,f,p,_,m,g){let S=o(d,f,p,_,m,g);p.transmission>0?n.unshift(S):p.transparent===!0?s.unshift(S):t.unshift(S)}function h(d,f){t.length>1&&t.sort(d||z_),n.length>1&&n.sort(f||od),s.length>1&&s.sort(f||od)}function u(){for(let d=e,f=i.length;d<f;d++){let p=i[d];if(p.id===null)break;p.id=null,p.object=null,p.geometry=null,p.material=null,p.group=null}}return{opaque:t,transmissive:n,transparent:s,init:r,push:c,unshift:l,finish:u,sort:h}}function V_(){let i=new WeakMap;function e(n,s){let r=i.get(n),a;return r===void 0?(a=new ld,i.set(n,[a])):s>=r.length?(a=new ld,r.push(a)):a=r[s],a}function t(){i=new WeakMap}return{get:e,dispose:t}}function k_(){let i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"SunLight":case"DirectionalLight":t={direction:new D,color:new tt};break;case"SpotLight":t={position:new D,direction:new D,color:new tt,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new D,color:new tt,distance:0,decay:0};break;case"HemisphereLight":t={direction:new D,skyColor:new tt,groundColor:new tt};break;case"RectAreaLight":t={color:new tt,position:new D,halfWidth:new D,halfHeight:new D};break}return i[e.id]=t,t}}}function H_(){let i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"SunLight":case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new pe};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new pe};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new pe,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[e.id]=t,t}}}var G_=0;function W_(i,e){return(e.castShadow?2:0)-(i.castShadow?2:0)+(e.map?1:0)-(i.map?1:0)}function X_(i){let e=new k_,t=H_(),n={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let l=0;l<9;l++)n.probe.push(new D);let s=new D,r=new Ne,a=new Ne;function o(l){let h=0,u=0,d=0;for(let U=0;U<9;U++)n.probe[U].set(0,0,0);let f=0,p=0,_=0,m=0,g=0,S=0,A=0,M=0,E=0,v=0,b=0,x=0,w=0,C=0;l.sort(W_);for(let U=0,z=l.length;U<z;U++){let O=l[U],k=O.color,j=O.intensity,R=O.distance,F=null;if(O.shadow&&O.shadow.map&&(O.shadow.map.texture.format===wi?F=O.shadow.map.texture:F=O.shadow.map.depthTexture||O.shadow.map.texture),O.isAmbientLight)h+=k.r*j,u+=k.g*j,d+=k.b*j;else if(O.isLightProbe){for(let G=0;G<9;G++)n.probe[G].addScaledVector(O.sh.coefficients[G],j);C++}else if(O.isSunLight){let G=e.get(O);if(G.color.copy(O.color).multiplyScalar(O.intensity),O.castShadow){let q=O.shadow,X=t.get(O);X.shadowIntensity=q.intensity,X.shadowBias=q.bias,X.shadowNormalBias=q.normalBias,X.shadowRadius=q.radius,X.shadowMapSize.copy(q.mapSize).multiply(q.getFrameExtents()),n.sunShadow[p]=X,n.sunShadowMap[p]=F;let he=q.getViewportCount();for(let ge=0;ge<he;ge++)n.sunShadowMatrix[_+ge]=q.getMatrix(ge),n.sunShadowCascade[_+ge]=q._cascadeData[ge];_+=he,p++}n.sun[f]=G,f++}else if(O.isDirectionalLight){let G=e.get(O);if(G.color.copy(O.color).multiplyScalar(O.intensity),O.castShadow){let q=O.shadow,X=t.get(O);X.shadowIntensity=q.intensity,X.shadowBias=q.bias,X.shadowNormalBias=q.normalBias,X.shadowRadius=q.radius,X.shadowMapSize=q.mapSize,n.directionalShadow[m]=X,n.directionalShadowMap[m]=F,n.directionalShadowMatrix[m]=O.shadow.matrix,E++}n.directional[m]=G,m++}else if(O.isSpotLight){let G=e.get(O);G.position.setFromMatrixPosition(O.matrixWorld),G.color.copy(k).multiplyScalar(j),G.distance=R,G.coneCos=Math.cos(O.angle),G.penumbraCos=Math.cos(O.angle*(1-O.penumbra)),G.decay=O.decay,n.spot[S]=G;let q=O.shadow;if(O.map&&(n.spotLightMap[x]=O.map,x++,q.updateMatrices(O),O.castShadow&&w++),n.spotLightMatrix[S]=q.matrix,O.castShadow){let X=t.get(O);X.shadowIntensity=q.intensity,X.shadowBias=q.bias,X.shadowNormalBias=q.normalBias,X.shadowRadius=q.radius,X.shadowMapSize=q.mapSize,n.spotShadow[S]=X,n.spotShadowMap[S]=F,b++}S++}else if(O.isRectAreaLight){let G=e.get(O);G.color.copy(k).multiplyScalar(j),G.halfWidth.set(O.width*.5,0,0),G.halfHeight.set(0,O.height*.5,0),n.rectArea[A]=G,A++}else if(O.isPointLight){let G=e.get(O);if(G.color.copy(O.color).multiplyScalar(O.intensity),G.distance=O.distance,G.decay=O.decay,O.castShadow){let q=O.shadow,X=t.get(O);X.shadowIntensity=q.intensity,X.shadowBias=q.bias,X.shadowNormalBias=q.normalBias,X.shadowRadius=q.radius,X.shadowMapSize=q.mapSize,X.shadowCameraNear=q.camera.near,X.shadowCameraFar=q.camera.far,n.pointShadow[g]=X,n.pointShadowMap[g]=F,n.pointShadowMatrix[g]=O.shadow.matrix,v++}n.point[g]=G,g++}else if(O.isHemisphereLight){let G=e.get(O);G.skyColor.copy(O.color).multiplyScalar(j),G.groundColor.copy(O.groundColor).multiplyScalar(j),n.hemi[M]=G,M++}}A>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=Ce.LTC_FLOAT_1,n.rectAreaLTC2=Ce.LTC_FLOAT_2):(n.rectAreaLTC1=Ce.LTC_HALF_1,n.rectAreaLTC2=Ce.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=u,n.ambient[2]=d;let I=n.hash;(I.sunLength!==f||I.directionalLength!==m||I.pointLength!==g||I.spotLength!==S||I.rectAreaLength!==A||I.hemiLength!==M||I.numSunShadows!==p||I.numDirectionalShadows!==E||I.numPointShadows!==v||I.numSpotShadows!==b||I.numSpotMaps!==x||I.numLightProbes!==C)&&(n.sun.length=f,n.directional.length=m,n.spot.length=S,n.rectArea.length=A,n.point.length=g,n.hemi.length=M,n.sunShadow.length=p,n.sunShadowMap.length=p,n.sunShadowMatrix.length=_,n.sunShadowCascade.length=_,n.directionalShadow.length=E,n.directionalShadowMap.length=E,n.directionalShadowMatrix.length=E,n.pointShadow.length=v,n.pointShadowMap.length=v,n.pointShadowMatrix.length=v,n.spotShadow.length=b,n.spotShadowMap.length=b,n.spotLightMatrix.length=b+x-w,n.spotLightMap.length=x,n.numSpotLightShadowsWithMaps=w,n.numLightProbes=C,I.sunLength=f,I.directionalLength=m,I.pointLength=g,I.spotLength=S,I.rectAreaLength=A,I.hemiLength=M,I.numSunShadows=p,I.numDirectionalShadows=E,I.numPointShadows=v,I.numSpotShadows=b,I.numSpotMaps=x,I.numLightProbes=C,n.version=G_++)}function c(l,h){let u=0,d=0,f=0,p=0,_=0,m=0,g=h.matrixWorldInverse;for(let S=0,A=l.length;S<A;S++){let M=l[S];if(M.isSunLight){let E=n.sun[u];E.direction.setFromMatrixPosition(M.matrixWorld),E.direction.transformDirection(g),u++}else if(M.isDirectionalLight){let E=n.directional[d];E.direction.setFromMatrixPosition(M.matrixWorld),s.setFromMatrixPosition(M.target.matrixWorld),E.direction.sub(s),E.direction.transformDirection(g),d++}else if(M.isSpotLight){let E=n.spot[p];E.position.setFromMatrixPosition(M.matrixWorld),E.position.applyMatrix4(g),E.direction.setFromMatrixPosition(M.matrixWorld),s.setFromMatrixPosition(M.target.matrixWorld),E.direction.sub(s),E.direction.transformDirection(g),p++}else if(M.isRectAreaLight){let E=n.rectArea[_];E.position.setFromMatrixPosition(M.matrixWorld),E.position.applyMatrix4(g),a.identity(),r.copy(M.matrixWorld),r.premultiply(g),a.extractRotation(r),E.halfWidth.set(M.width*.5,0,0),E.halfHeight.set(0,M.height*.5,0),E.halfWidth.applyMatrix4(a),E.halfHeight.applyMatrix4(a),_++}else if(M.isPointLight){let E=n.point[f];E.position.setFromMatrixPosition(M.matrixWorld),E.position.applyMatrix4(g),f++}else if(M.isHemisphereLight){let E=n.hemi[m];E.direction.setFromMatrixPosition(M.matrixWorld),E.direction.transformDirection(g),m++}}}return{setup:o,setupView:c,state:n}}function cd(i){let e=new X_(i),t=[],n=[],s=[];function r(d){u.camera=d,t.length=0,n.length=0,s.length=0}function a(d){t.push(d)}function o(d){n.push(d)}function c(d){s.push(d)}function l(){e.setup(t)}function h(d){e.setupView(t,d)}let u={lightsArray:t,shadowsArray:n,lightProbeGridArray:s,camera:null,lights:e,transmissionRenderTarget:{},textureUnits:0};return{init:r,state:u,setupLights:l,setupLightsView:h,pushLight:a,pushShadow:o,pushLightProbeGrid:c}}function q_(i){let e=new WeakMap;function t(s,r=0){let a=e.get(s),o;return a===void 0?(o=new cd(i),e.set(s,[o])):r>=a.length?(o=new cd(i),a.push(o)):o=a[r],o}function n(){e=new WeakMap}return{get:t,dispose:n}}var Y_=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,j_=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,Z_=[new D(1,0,0),new D(-1,0,0),new D(0,1,0),new D(0,-1,0),new D(0,0,1),new D(0,0,-1)],J_=[new D(0,-1,0),new D(0,-1,0),new D(0,0,1),new D(0,0,-1),new D(0,-1,0),new D(0,-1,0)],hd=new Ne,ia=new D,Kc=new D;function K_(i,e,t){let n=new As,s=new pe,r=new pe,a=new Et,o=new uo,c=new fo,l={},h=t.maxTextureSize,u={[Si]:Zt,[Zt]:Si,[yn]:yn},d=new Pt({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new pe},radius:{value:4}},vertexShader:Y_,fragmentShader:j_}),f=d.clone();f.defines.HORIZONTAL_PASS=1;let p=new zt;p.setAttribute("position",new ln(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let _=new ut(p,d),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Br;let g=this.type;this.render=function(v,b,x){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||v.length===0)return;this.type===Ao&&(je("WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead."),this.type=Br);let w=i.getRenderTarget(),C=i.getActiveCubeFace(),I=i.getActiveMipmapLevel(),U=i.state;U.setBlending(Nt),U.buffers.depth.getReversed()===!0?U.buffers.color.setClear(0,0,0,0):U.buffers.color.setClear(1,1,1,1),U.buffers.depth.setTest(!0),U.setScissorTest(!1);let z=g!==this.type;z&&b.traverse(function(O){O.material&&(Array.isArray(O.material)?O.material.forEach(k=>k.needsUpdate=!0):O.material.needsUpdate=!0)});for(let O=0,k=v.length;O<k;O++){let j=v[O],R=j.shadow;if(R===void 0){je("WebGLShadowMap:",j,"has no shadow.");continue}if(R.autoUpdate===!1&&R.needsUpdate===!1)continue;s.copy(R.mapSize);let F=R.getFrameExtents();s.multiply(F),r.copy(R.mapSize),(s.x>h||s.y>h)&&(s.x>h&&(r.x=Math.floor(h/F.x),s.x=r.x*F.x,R.mapSize.x=r.x),s.y>h&&(r.y=Math.floor(h/F.y),s.y=r.y*F.y,R.mapSize.y=r.y));let G=i.state.buffers.depth.getReversed();if(R.camera._reversedDepth=G,R.map===null||z===!0){if(R.map!==null&&(R.map.depthTexture!==null&&(R.map.depthTexture.dispose(),R.map.depthTexture=null),R.map.dispose()),this.type===Ns){if(j.isPointLight){je("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}R.map=new Ct(s.x,s.y,{format:wi,type:Vt,minFilter:jt,magFilter:jt,generateMipmaps:!1}),R.map.texture.name=j.name+".shadowMap",R.map.depthTexture=new Wn(s.x,s.y,Cn),R.map.depthTexture.name=j.name+".shadowMapDepth",R.map.depthTexture.format=Hn,R.map.depthTexture.compareFunction=null,R.map.depthTexture.minFilter=Dt,R.map.depthTexture.magFilter=Dt}else j.isPointLight?(R.map=new yl(s.x),R.map.depthTexture=new so(s.x,On)):(R.map=new Ct(s.x,s.y),R.map.depthTexture=new Wn(s.x,s.y,On)),R.map.depthTexture.name=j.name+".shadowMap",R.map.depthTexture.format=Hn,this.type===Br?(R.map.depthTexture.compareFunction=G?_l:gl,R.map.depthTexture.minFilter=jt,R.map.depthTexture.magFilter=jt):(R.map.depthTexture.compareFunction=null,R.map.depthTexture.minFilter=Dt,R.map.depthTexture.magFilter=Dt);R.camera.updateProjectionMatrix()}R.map.isWebGLCubeRenderTarget!==!0&&(R.map.width!==s.x||R.map.height!==s.y)&&R.map.setSize(s.x,s.y);let q=R.map.isWebGLCubeRenderTarget?6:R.getViewportCount();j.isPointLight!==!0&&R.updateMatrices(j,x);for(let X=0;X<q;X++){let he=R.getCamera(X);if(j.isPointLight){let ge=R.camera,Fe=R.matrix,Te=j.distance||ge.far;Te!==ge.far&&(ge.far=Te,ge.updateProjectionMatrix()),ia.setFromMatrixPosition(j.matrixWorld),ge.position.copy(ia),Kc.copy(ge.position),Kc.add(Z_[X]),ge.up.copy(J_[X]),ge.lookAt(Kc),ge.updateMatrixWorld(),Fe.makeTranslation(-ia.x,-ia.y,-ia.z),hd.multiplyMatrices(ge.projectionMatrix,ge.matrixWorldInverse),R._frustum.setFromProjectionMatrix(hd,ge.coordinateSystem,ge.reversedDepth)}if(R.map.isWebGLCubeRenderTarget)i.setRenderTarget(R.map,X),i.clear();else{X===0&&(i.setRenderTarget(R.map),i.clear());let ge=R.getViewport(X);a.set(r.x*ge.x,r.y*ge.y,r.x*ge.z,r.y*ge.w),U.viewport(a)}n=R.getFrustum(X),M(b,x,he,j,this.type)}R.isPointLightShadow!==!0&&this.type===Ns&&S(R,x),R.needsUpdate=!1}g=this.type,m.needsUpdate=!1,i.setRenderTarget(w,C,I)};function S(v,b){let x=e.update(_);d.defines.VSM_SAMPLES!==v.blurSamples&&(d.defines.VSM_SAMPLES=v.blurSamples,f.defines.VSM_SAMPLES=v.blurSamples,d.needsUpdate=!0,f.needsUpdate=!0),v.mapPass===null?v.mapPass=new Ct(s.x,s.y,{format:wi,type:Vt}):(v.mapPass.width!==v.map.width||v.mapPass.height!==v.map.height)&&v.mapPass.setSize(v.map.width,v.map.height),d.uniforms.shadow_pass.value=v.map.depthTexture,d.uniforms.resolution.value.set(v.map.width,v.map.height),d.uniforms.radius.value=v.radius,i.setRenderTarget(v.mapPass),i.clear(),i.renderBufferDirect(b,null,x,d,_,null),f.uniforms.shadow_pass.value=v.mapPass.texture,f.uniforms.resolution.value.set(v.map.width,v.map.height),f.uniforms.radius.value=v.radius,i.setRenderTarget(v.map),i.clear(),i.renderBufferDirect(b,null,x,f,_,null)}function A(v,b,x,w){let C=null,I=x.isPointLight===!0?v.customDistanceMaterial:v.customDepthMaterial;if(I!==void 0)C=I;else if(C=x.isPointLight===!0?c:o,i.localClippingEnabled&&b.clipShadows===!0&&Array.isArray(b.clippingPlanes)&&b.clippingPlanes.length!==0||b.displacementMap&&b.displacementScale!==0||b.alphaMap&&b.alphaTest>0||b.map&&b.alphaTest>0||b.alphaToCoverage===!0){let U=C.uuid,z=b.uuid,O=l[U];O===void 0&&(O={},l[U]=O);let k=O[z];k===void 0&&(k=C.clone(),O[z]=k,b.addEventListener("dispose",E)),C=k}if(C.visible=b.visible,C.wireframe=b.wireframe,w===Ns?C.side=b.shadowSide!==null?b.shadowSide:b.side:C.side=b.shadowSide!==null?b.shadowSide:u[b.side],C.alphaMap=b.alphaMap,C.alphaTest=b.alphaToCoverage===!0?.5:b.alphaTest,C.map=b.map,C.clipShadows=b.clipShadows,C.clippingPlanes=b.clippingPlanes,C.clipIntersection=b.clipIntersection,C.displacementMap=b.displacementMap,C.displacementScale=b.displacementScale,C.displacementBias=b.displacementBias,C.wireframeLinewidth=b.wireframeLinewidth,C.linewidth=b.linewidth,x.isPointLight===!0&&C.isMeshDistanceMaterial===!0){let U=i.properties.get(C);U.light=x}return C}function M(v,b,x,w,C){if(v.visible===!1)return;if(v.layers.test(b.layers)&&(v.isMesh||v.isLine||v.isPoints)&&(v.castShadow||v.receiveShadow&&C===Ns)&&(!v.frustumCulled||v.intersectsFrustum(n))){v.modelViewMatrix.multiplyMatrices(x.matrixWorldInverse,v.matrixWorld);let z=e.update(v),O=v.material;if(Array.isArray(O)){let k=z.groups;for(let j=0,R=k.length;j<R;j++){let F=k[j],G=O[F.materialIndex];if(G&&G.visible){let q=A(v,G,w,C);v.onBeforeShadow(i,v,b,x,z,q,F),i.renderBufferDirect(x,null,z,q,v,F),v.onAfterShadow(i,v,b,x,z,q,F)}}}else if(O.visible){let k=A(v,O,w,C);v.onBeforeShadow(i,v,b,x,z,k,null),i.renderBufferDirect(x,null,z,k,v,null),v.onAfterShadow(i,v,b,x,z,k,null)}}let U=v.children;for(let z=0,O=U.length;z<O;z++)M(U[z],b,x,w,C)}function E(v){v.target.removeEventListener("dispose",E);for(let x in l){let w=l[x],C=v.target.uuid;C in w&&(w[C].dispose(),delete w[C])}}}function $_(i,e){function t(){let H=!1,we=new Et,ce=null,Ae=new Et(0,0,0,0);return{setMask:function(De){ce!==De&&!H&&(i.colorMask(De,De,De,De),ce=De)},setLocked:function(De){H=De},setClear:function(De,N,Z,$,Se){Se===!0&&(De*=$,N*=$,Z*=$),we.set(De,N,Z,$),Ae.equals(we)===!1&&(i.clearColor(De,N,Z,$),Ae.copy(we))},reset:function(){H=!1,ce=null,Ae.set(-1,0,0,0)}}}function n(){let H=!1,we=!1,ce=null,Ae=null,De=null;return{setReversed:function(N){if(we!==N){let Z=e.get("EXT_clip_control");N?Z.clipControlEXT(Z.LOWER_LEFT_EXT,Z.ZERO_TO_ONE_EXT):Z.clipControlEXT(Z.LOWER_LEFT_EXT,Z.NEGATIVE_ONE_TO_ONE_EXT),we=N;let $=De;De=null,this.setClear($)}},getReversed:function(){return we},setTest:function(N){N?ie(i.DEPTH_TEST):fe(i.DEPTH_TEST)},setMask:function(N){ce!==N&&!H&&(i.depthMask(N),ce=N)},setFunc:function(N){if(we&&(N=Fu[N]),Ae!==N){switch(N){case qa:i.depthFunc(i.NEVER);break;case Ya:i.depthFunc(i.ALWAYS);break;case ja:i.depthFunc(i.LESS);break;case vs:i.depthFunc(i.LEQUAL);break;case Za:i.depthFunc(i.EQUAL);break;case Ja:i.depthFunc(i.GEQUAL);break;case Ka:i.depthFunc(i.GREATER);break;case $a:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}Ae=N}},setLocked:function(N){H=N},setClear:function(N){De!==N&&(De=N,we&&(N=1-N),i.clearDepth(N))},reset:function(){H=!1,ce=null,Ae=null,De=null,we=!1}}}function s(){let H=!1,we=null,ce=null,Ae=null,De=null,N=null,Z=null,$=null,Se=null;return{setTest:function(Le){H||(Le?ie(i.STENCIL_TEST):fe(i.STENCIL_TEST))},setMask:function(Le){we!==Le&&!H&&(i.stencilMask(Le),we=Le)},setFunc:function(Le,Ze,$e){(ce!==Le||Ae!==Ze||De!==$e)&&(i.stencilFunc(Le,Ze,$e),ce=Le,Ae=Ze,De=$e)},setOp:function(Le,Ze,$e){(N!==Le||Z!==Ze||$!==$e)&&(i.stencilOp(Le,Ze,$e),N=Le,Z=Ze,$=$e)},setLocked:function(Le){H=Le},setClear:function(Le){Se!==Le&&(i.clearStencil(Le),Se=Le)},reset:function(){H=!1,we=null,ce=null,Ae=null,De=null,N=null,Z=null,$=null,Se=null}}}let r=new t,a=new n,o=new s,c=new WeakMap,l=new WeakMap,h={},u={},d={},f=new WeakMap,p=[],_=null,m=!1,g=null,S=null,A=null,M=null,E=null,v=null,b=null,x=new tt(0,0,0),w=0,C=!1,I=null,U=null,z=null,O=null,k=null,j=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS),R=!1,F=0,G=i.getParameter(i.VERSION);G.indexOf("WebGL")!==-1?(F=parseFloat(/^WebGL (\d)/.exec(G)[1]),R=F>=1):G.indexOf("OpenGL ES")!==-1&&(F=parseFloat(/^OpenGL ES (\d)/.exec(G)[1]),R=F>=2);let q=null,X={},he=i.getParameter(i.SCISSOR_BOX),ge=i.getParameter(i.VIEWPORT),Fe=new Et().fromArray(he),Te=new Et().fromArray(ge);function Ve(H,we,ce,Ae){let De=new Uint8Array(4),N=i.createTexture();i.bindTexture(H,N),i.texParameteri(H,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(H,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let Z=0;Z<ce;Z++)H===i.TEXTURE_3D||H===i.TEXTURE_2D_ARRAY?i.texImage3D(we,0,i.RGBA,1,1,Ae,0,i.RGBA,i.UNSIGNED_BYTE,De):i.texImage2D(we+Z,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,De);return N}let ee={};ee[i.TEXTURE_2D]=Ve(i.TEXTURE_2D,i.TEXTURE_2D,1),ee[i.TEXTURE_CUBE_MAP]=Ve(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),ee[i.TEXTURE_2D_ARRAY]=Ve(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),ee[i.TEXTURE_3D]=Ve(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),a.setClear(1),o.setClear(0),ie(i.DEPTH_TEST),a.setFunc(vs),oe(!1),de(Mc),ie(i.CULL_FACE),ue(Nt);function ie(H){h[H]!==!0&&(i.enable(H),h[H]=!0)}function fe(H){h[H]!==!1&&(i.disable(H),h[H]=!1)}function Pe(H,we){return d[H]!==we?(i.bindFramebuffer(H,we),d[H]=we,H===i.DRAW_FRAMEBUFFER&&(d[i.FRAMEBUFFER]=we),H===i.FRAMEBUFFER&&(d[i.DRAW_FRAMEBUFFER]=we),!0):!1}function ye(H,we){let ce=p,Ae=!1;if(H){ce=f.get(we),ce===void 0&&(ce=[],f.set(we,ce));let De=H.textures;if(ce.length!==De.length||ce[0]!==i.COLOR_ATTACHMENT0){for(let N=0,Z=De.length;N<Z;N++)ce[N]=i.COLOR_ATTACHMENT0+N;ce.length=De.length,Ae=!0}}else ce[0]!==i.BACK&&(ce[0]=i.BACK,Ae=!0);Ae&&i.drawBuffers(ce)}function Oe(H){return _!==H?(i.useProgram(H),_=H,!0):!1}let Qe={[An]:i.FUNC_ADD,[au]:i.FUNC_SUBTRACT,[ou]:i.FUNC_REVERSE_SUBTRACT};Qe[lu]=i.MIN,Qe[cu]=i.MAX;let ae={[Gi]:i.ZERO,[hu]:i.ONE,[uu]:i.SRC_COLOR,[Ec]:i.SRC_ALPHA,[mu]:i.SRC_ALPHA_SATURATE,[kr]:i.DST_COLOR,[Vr]:i.DST_ALPHA,[du]:i.ONE_MINUS_SRC_COLOR,[Tc]:i.ONE_MINUS_SRC_ALPHA,[pu]:i.ONE_MINUS_DST_COLOR,[fu]:i.ONE_MINUS_DST_ALPHA,[gu]:i.CONSTANT_COLOR,[_u]:i.ONE_MINUS_CONSTANT_COLOR,[xu]:i.CONSTANT_ALPHA,[vu]:i.ONE_MINUS_CONSTANT_ALPHA};function ue(H,we,ce,Ae,De,N,Z,$,Se,Le){if(H===Nt){m===!0&&(fe(i.BLEND),m=!1);return}if(m===!1&&(ie(i.BLEND),m=!0),H!==Co){if(H!==g||Le!==C){if((S!==An||E!==An)&&(i.blendEquation(i.FUNC_ADD),S=An,E=An),Le)switch(H){case Us:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case zr:i.blendFunc(i.ONE,i.ONE);break;case Sc:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case bc:i.blendFuncSeparate(i.DST_COLOR,i.ONE_MINUS_SRC_ALPHA,i.ZERO,i.ONE);break;default:Je("WebGLState: Invalid blending: ",H);break}else switch(H){case Us:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case zr:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE,i.ONE,i.ONE);break;case Sc:Je("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case bc:Je("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Je("WebGLState: Invalid blending: ",H);break}A=null,M=null,v=null,b=null,x.set(0,0,0),w=0,g=H,C=Le}return}De=De||we,N=N||ce,Z=Z||Ae,(we!==S||De!==E)&&(i.blendEquationSeparate(Qe[we],Qe[De]),S=we,E=De),(ce!==A||Ae!==M||N!==v||Z!==b)&&(i.blendFuncSeparate(ae[ce],ae[Ae],ae[N],ae[Z]),A=ce,M=Ae,v=N,b=Z),($.equals(x)===!1||Se!==w)&&(i.blendColor($.r,$.g,$.b,Se),x.copy($),w=Se),g=H,C=!1}function se(H,we){H.side===yn?fe(i.CULL_FACE):ie(i.CULL_FACE);let ce=H.side===Zt;we&&(ce=!ce),oe(ce),H.blending===Us&&H.transparent===!1?ue(Nt):ue(H.blending,H.blendEquation,H.blendSrc,H.blendDst,H.blendEquationAlpha,H.blendSrcAlpha,H.blendDstAlpha,H.blendColor,H.blendAlpha,H.premultipliedAlpha),a.setFunc(H.depthFunc),a.setTest(H.depthTest),a.setMask(H.depthWrite),r.setMask(H.colorWrite);let Ae=H.stencilWrite;o.setTest(Ae),Ae&&(o.setMask(H.stencilWriteMask),o.setFunc(H.stencilFunc,H.stencilRef,H.stencilFuncMask),o.setOp(H.stencilFail,H.stencilZFail,H.stencilZPass)),Me(H.polygonOffset,H.polygonOffsetFactor,H.polygonOffsetUnits),H.alphaToCoverage===!0?ie(i.SAMPLE_ALPHA_TO_COVERAGE):fe(i.SAMPLE_ALPHA_TO_COVERAGE)}function oe(H){I!==H&&(H?i.frontFace(i.CW):i.frontFace(i.CCW),I=H)}function de(H){H!==su?(ie(i.CULL_FACE),H!==U&&(H===Mc?i.cullFace(i.BACK):H===ru?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):fe(i.CULL_FACE),U=H}function xe(H){H!==z&&(R&&i.lineWidth(H),z=H)}function Me(H,we,ce){H?(ie(i.POLYGON_OFFSET_FILL),(O!==we||k!==ce)&&(O=we,k=ce,a.getReversed()&&(we=-we),i.polygonOffset(we,ce))):fe(i.POLYGON_OFFSET_FILL)}function Q(H){H?ie(i.SCISSOR_TEST):fe(i.SCISSOR_TEST)}function qe(H){H===void 0&&(H=i.TEXTURE0+j-1),q!==H&&(i.activeTexture(H),q=H)}function B(H,we,ce){ce===void 0&&(q===null?ce=i.TEXTURE0+j-1:ce=q);let Ae=X[ce];Ae===void 0&&(Ae={type:void 0,texture:void 0},X[ce]=Ae),(Ae.type!==H||Ae.texture!==we)&&(q!==ce&&(i.activeTexture(ce),q=ce),i.bindTexture(H,we||ee[H]),Ae.type=H,Ae.texture=we)}function rt(){let H=X[q];H!==void 0&&H.type!==void 0&&(i.bindTexture(H.type,null),H.type=void 0,H.texture=void 0)}function nt(){try{i.compressedTexImage2D(...arguments)}catch(H){Je("WebGLState:",H)}}function P(){try{i.compressedTexImage3D(...arguments)}catch(H){Je("WebGLState:",H)}}function y(){try{i.texSubImage2D(...arguments)}catch(H){Je("WebGLState:",H)}}function W(){try{i.texSubImage3D(...arguments)}catch(H){Je("WebGLState:",H)}}function Y(){try{i.compressedTexSubImage2D(...arguments)}catch(H){Je("WebGLState:",H)}}function te(){try{i.compressedTexSubImage3D(...arguments)}catch(H){Je("WebGLState:",H)}}function me(){try{i.texStorage2D(...arguments)}catch(H){Je("WebGLState:",H)}}function ve(){try{i.texStorage3D(...arguments)}catch(H){Je("WebGLState:",H)}}function re(){try{i.texImage2D(...arguments)}catch(H){Je("WebGLState:",H)}}function le(){try{i.texImage3D(...arguments)}catch(H){Je("WebGLState:",H)}}function Ee(H){return u[H]!==void 0?u[H]:i.getParameter(H)}function ke(H,we){u[H]!==we&&(i.pixelStorei(H,we),u[H]=we)}function be(H){Fe.equals(H)===!1&&(i.scissor(H.x,H.y,H.z,H.w),Fe.copy(H))}function _e(H){Te.equals(H)===!1&&(i.viewport(H.x,H.y,H.z,H.w),Te.copy(H))}function ze(H,we){let ce=l.get(we);ce===void 0&&(ce=new WeakMap,l.set(we,ce));let Ae=ce.get(H);Ae===void 0&&(Ae=i.getUniformBlockIndex(we,H.name),ce.set(H,Ae))}function Xe(H,we){let Ae=l.get(we).get(H);c.get(we)!==Ae&&(i.uniformBlockBinding(we,Ae,H.__bindingPointIndex),c.set(we,Ae))}function Ke(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),a.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),i.pixelStorei(i.PACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,!1),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,i.BROWSER_DEFAULT_WEBGL),i.pixelStorei(i.PACK_ROW_LENGTH,0),i.pixelStorei(i.PACK_SKIP_PIXELS,0),i.pixelStorei(i.PACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_ROW_LENGTH,0),i.pixelStorei(i.UNPACK_IMAGE_HEIGHT,0),i.pixelStorei(i.UNPACK_SKIP_PIXELS,0),i.pixelStorei(i.UNPACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_SKIP_IMAGES,0),h={},u={},q=null,X={},d={},f=new WeakMap,p=[],_=null,m=!1,g=null,S=null,A=null,M=null,E=null,v=null,b=null,x=new tt(0,0,0),w=0,C=!1,I=null,U=null,z=null,O=null,k=null,Fe.set(0,0,i.canvas.width,i.canvas.height),Te.set(0,0,i.canvas.width,i.canvas.height),r.reset(),a.reset(),o.reset()}return{buffers:{color:r,depth:a,stencil:o},enable:ie,disable:fe,bindFramebuffer:Pe,drawBuffers:ye,useProgram:Oe,setBlending:ue,setMaterial:se,setFlipSided:oe,setCullFace:de,setLineWidth:xe,setPolygonOffset:Me,setScissorTest:Q,activeTexture:qe,bindTexture:B,unbindTexture:rt,compressedTexImage2D:nt,compressedTexImage3D:P,texImage2D:re,texImage3D:le,pixelStorei:ke,getParameter:Ee,updateUBOMapping:ze,uniformBlockBinding:Xe,texStorage2D:me,texStorage3D:ve,texSubImage2D:y,texSubImage3D:W,compressedTexSubImage2D:Y,compressedTexSubImage3D:te,scissor:be,viewport:_e,reset:Ke}}function Q_(i,e,t,n,s,r,a){let o=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,c=typeof navigator=="undefined"?!1:/OculusBrowser/g.test(navigator.userAgent),l=new pe,h=new WeakMap,u=new Set,d,f=new WeakMap,p=!1;try{p=typeof OffscreenCanvas!="undefined"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function _(P,y){return p?new OffscreenCanvas(P,y):Ms("canvas")}function m(P,y,W){let Y=1,te=nt(P);if((te.width>W||te.height>W)&&(Y=W/Math.max(te.width,te.height)),Y<1)if(typeof HTMLImageElement!="undefined"&&P instanceof HTMLImageElement||typeof HTMLCanvasElement!="undefined"&&P instanceof HTMLCanvasElement||typeof ImageBitmap!="undefined"&&P instanceof ImageBitmap||typeof VideoFrame!="undefined"&&P instanceof VideoFrame){let me=Math.floor(Y*te.width),ve=Math.floor(Y*te.height);d===void 0&&(d=_(me,ve));let re=y?_(me,ve):d;return re.width=me,re.height=ve,re.getContext("2d").drawImage(P,0,0,me,ve),je("WebGLRenderer: Texture has been resized from ("+te.width+"x"+te.height+") to ("+me+"x"+ve+")."),re}else return"data"in P&&je("WebGLRenderer: Image in DataTexture is too big ("+te.width+"x"+te.height+")."),P;return P}function g(P){return P.generateMipmaps}function S(P){i.generateMipmap(P)}function A(P){return P.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:P.isWebGL3DRenderTarget?i.TEXTURE_3D:P.isWebGLArrayRenderTarget||P.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function M(P,y,W,Y,te,me=!1){if(P!==null){if(i[P]!==void 0)return i[P];je("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+P+"'")}let ve;Y&&(ve=e.get("EXT_texture_norm16"),ve||je("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let re=y;if(y===i.RED&&(W===i.FLOAT&&(re=i.R32F),W===i.HALF_FLOAT&&(re=i.R16F),W===i.UNSIGNED_BYTE&&(re=i.R8),W===i.UNSIGNED_SHORT&&ve&&(re=ve.R16_EXT),W===i.SHORT&&ve&&(re=ve.R16_SNORM_EXT)),y===i.RED_INTEGER&&(W===i.UNSIGNED_BYTE&&(re=i.R8UI),W===i.UNSIGNED_SHORT&&(re=i.R16UI),W===i.UNSIGNED_INT&&(re=i.R32UI),W===i.BYTE&&(re=i.R8I),W===i.SHORT&&(re=i.R16I),W===i.INT&&(re=i.R32I)),y===i.RG&&(W===i.FLOAT&&(re=i.RG32F),W===i.HALF_FLOAT&&(re=i.RG16F),W===i.UNSIGNED_BYTE&&(re=i.RG8),W===i.UNSIGNED_SHORT&&ve&&(re=ve.RG16_EXT),W===i.SHORT&&ve&&(re=ve.RG16_SNORM_EXT)),y===i.RG_INTEGER&&(W===i.UNSIGNED_BYTE&&(re=i.RG8UI),W===i.UNSIGNED_SHORT&&(re=i.RG16UI),W===i.UNSIGNED_INT&&(re=i.RG32UI),W===i.BYTE&&(re=i.RG8I),W===i.SHORT&&(re=i.RG16I),W===i.INT&&(re=i.RG32I)),y===i.RGB_INTEGER&&(W===i.UNSIGNED_BYTE&&(re=i.RGB8UI),W===i.UNSIGNED_SHORT&&(re=i.RGB16UI),W===i.UNSIGNED_INT&&(re=i.RGB32UI),W===i.BYTE&&(re=i.RGB8I),W===i.SHORT&&(re=i.RGB16I),W===i.INT&&(re=i.RGB32I)),y===i.RGBA_INTEGER&&(W===i.UNSIGNED_BYTE&&(re=i.RGBA8UI),W===i.UNSIGNED_SHORT&&(re=i.RGBA16UI),W===i.UNSIGNED_INT&&(re=i.RGBA32UI),W===i.BYTE&&(re=i.RGBA8I),W===i.SHORT&&(re=i.RGBA16I),W===i.INT&&(re=i.RGBA32I)),y===i.RGB&&(W===i.UNSIGNED_SHORT&&ve&&(re=ve.RGB16_EXT),W===i.SHORT&&ve&&(re=ve.RGB16_SNORM_EXT),W===i.UNSIGNED_INT_5_9_9_9_REV&&(re=i.RGB9_E5),W===i.UNSIGNED_INT_10F_11F_11F_REV&&(re=i.R11F_G11F_B10F)),y===i.RGBA){let le=me?cr:ct.getTransfer(te);W===i.FLOAT&&(re=i.RGBA32F),W===i.HALF_FLOAT&&(re=i.RGBA16F),W===i.UNSIGNED_BYTE&&(re=le===pt?i.SRGB8_ALPHA8:i.RGBA8),W===i.UNSIGNED_SHORT&&ve&&(re=ve.RGBA16_EXT),W===i.SHORT&&ve&&(re=ve.RGBA16_SNORM_EXT),W===i.UNSIGNED_SHORT_4_4_4_4&&(re=i.RGBA4),W===i.UNSIGNED_SHORT_5_5_5_1&&(re=i.RGB5_A1)}return(re===i.R16F||re===i.R32F||re===i.RG16F||re===i.RG32F||re===i.RGBA16F||re===i.RGBA32F)&&e.get("EXT_color_buffer_float"),re}function E(P,y){let W;return P?y===null||y===On||y===Ti?W=i.DEPTH24_STENCIL8:y===Cn?W=i.DEPTH32F_STENCIL8:y===Fs&&(W=i.DEPTH24_STENCIL8,je("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):y===null||y===On||y===Ti?W=i.DEPTH_COMPONENT24:y===Cn?W=i.DEPTH_COMPONENT32F:y===Fs&&(W=i.DEPTH_COMPONENT16),W}function v(P,y){return g(P)===!0||P.isFramebufferTexture&&P.minFilter!==Dt&&P.minFilter!==jt?Math.log2(Math.max(y.width,y.height))+1:P.mipmaps!==void 0&&P.mipmaps.length>0?P.mipmaps.length:P.isCompressedTexture&&Array.isArray(P.image)?y.mipmaps.length:1}function b(P){let y=P.target;y.removeEventListener("dispose",b),w(y),y.isVideoTexture&&h.delete(y),y.isHTMLTexture&&u.delete(y)}function x(P){let y=P.target;y.removeEventListener("dispose",x),I(y)}function w(P){let y=n.get(P);if(y.__webglInit===void 0)return;let W=P.source,Y=f.get(W);if(Y){let te=Y[y.__cacheKey];te.usedTimes--,te.usedTimes===0&&C(P),Object.keys(Y).length===0&&f.delete(W)}n.remove(P)}function C(P){let y=n.get(P);i.deleteTexture(y.__webglTexture);let W=P.source,Y=f.get(W);delete Y[y.__cacheKey],a.memory.textures--}function I(P){let y=n.get(P);if(P.depthTexture&&(P.depthTexture.dispose(),n.remove(P.depthTexture)),P.isWebGLCubeRenderTarget)for(let Y=0;Y<6;Y++){if(Array.isArray(y.__webglFramebuffer[Y]))for(let te=0;te<y.__webglFramebuffer[Y].length;te++)i.deleteFramebuffer(y.__webglFramebuffer[Y][te]);else i.deleteFramebuffer(y.__webglFramebuffer[Y]);y.__webglDepthbuffer&&i.deleteRenderbuffer(y.__webglDepthbuffer[Y])}else{if(Array.isArray(y.__webglFramebuffer))for(let Y=0;Y<y.__webglFramebuffer.length;Y++)i.deleteFramebuffer(y.__webglFramebuffer[Y]);else i.deleteFramebuffer(y.__webglFramebuffer);if(y.__webglDepthbuffer&&i.deleteRenderbuffer(y.__webglDepthbuffer),y.__webglMultisampledFramebuffer&&i.deleteFramebuffer(y.__webglMultisampledFramebuffer),y.__webglColorRenderbuffer)for(let Y=0;Y<y.__webglColorRenderbuffer.length;Y++)y.__webglColorRenderbuffer[Y]&&i.deleteRenderbuffer(y.__webglColorRenderbuffer[Y]);y.__webglDepthRenderbuffer&&i.deleteRenderbuffer(y.__webglDepthRenderbuffer)}let W=P.textures;for(let Y=0,te=W.length;Y<te;Y++){let me=n.get(W[Y]);me.__webglTexture&&(i.deleteTexture(me.__webglTexture),a.memory.textures--),n.remove(W[Y])}n.remove(P)}let U=0;function z(){U=0}function O(){return U}function k(P){U=P}function j(){let P=U;return P>=s.maxTextures&&je("WebGLTextures: Trying to use "+(P+1)+" texture units while this GPU supports only "+s.maxTextures),U+=1,P}function R(P){let y=[];return y.push(P.wrapS),y.push(P.wrapT),y.push(P.wrapR||0),y.push(P.magFilter),y.push(P.minFilter),y.push(P.anisotropy),y.push(P.internalFormat),y.push(P.format),y.push(P.type),y.push(P.generateMipmaps),y.push(P.premultiplyAlpha),y.push(P.flipY),y.push(P.unpackAlignment),y.push(P.colorSpace),y.join()}function F(P,y){let W=n.get(P);if(P.isVideoTexture&&B(P),P.isRenderTargetTexture===!1&&P.isExternalTexture!==!0&&P.version>0&&W.__version!==P.version){let Y=P.image;if(Y===null)je("WebGLRenderer: Texture marked for update but no image data found.");else if(Y.complete===!1)je("WebGLRenderer: Texture marked for update but image is incomplete");else{fe(W,P,y);return}}else P.isExternalTexture&&(W.__webglTexture=P.sourceTexture?P.sourceTexture:null);t.bindTexture(i.TEXTURE_2D,W.__webglTexture,i.TEXTURE0+y)}function G(P,y){let W=n.get(P);if(P.isRenderTargetTexture===!1&&P.version>0&&W.__version!==P.version){fe(W,P,y);return}else P.isExternalTexture&&(W.__webglTexture=P.sourceTexture?P.sourceTexture:null);t.bindTexture(i.TEXTURE_2D_ARRAY,W.__webglTexture,i.TEXTURE0+y)}function q(P,y){let W=n.get(P);if(P.isRenderTargetTexture===!1&&P.version>0&&W.__version!==P.version){fe(W,P,y);return}t.bindTexture(i.TEXTURE_3D,W.__webglTexture,i.TEXTURE0+y)}function X(P,y){let W=n.get(P);if(P.isCubeDepthTexture!==!0&&P.version>0&&W.__version!==P.version){Pe(W,P,y);return}t.bindTexture(i.TEXTURE_CUBE_MAP,W.__webglTexture,i.TEXTURE0+y)}let he={[qt]:i.REPEAT,[kn]:i.CLAMP_TO_EDGE,[Qa]:i.MIRRORED_REPEAT},ge={[Dt]:i.NEAREST,[Su]:i.NEAREST_MIPMAP_NEAREST,[Zr]:i.NEAREST_MIPMAP_LINEAR,[jt]:i.LINEAR,[Do]:i.LINEAR_MIPMAP_NEAREST,[Ei]:i.LINEAR_MIPMAP_LINEAR},Fe={[wu]:i.NEVER,[Iu]:i.ALWAYS,[Au]:i.LESS,[gl]:i.LEQUAL,[Cu]:i.EQUAL,[_l]:i.GEQUAL,[Ru]:i.GREATER,[Pu]:i.NOTEQUAL};function Te(P,y){if(y.type===Cn&&e.has("OES_texture_float_linear")===!1&&(y.magFilter===jt||y.magFilter===Do||y.magFilter===Zr||y.magFilter===Ei||y.minFilter===jt||y.minFilter===Do||y.minFilter===Zr||y.minFilter===Ei)&&je("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(P,i.TEXTURE_WRAP_S,he[y.wrapS]),i.texParameteri(P,i.TEXTURE_WRAP_T,he[y.wrapT]),(P===i.TEXTURE_3D||P===i.TEXTURE_2D_ARRAY)&&i.texParameteri(P,i.TEXTURE_WRAP_R,he[y.wrapR]),i.texParameteri(P,i.TEXTURE_MAG_FILTER,ge[y.magFilter]),i.texParameteri(P,i.TEXTURE_MIN_FILTER,ge[y.minFilter]),y.compareFunction&&(i.texParameteri(P,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(P,i.TEXTURE_COMPARE_FUNC,Fe[y.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(y.magFilter===Dt||y.minFilter!==Zr&&y.minFilter!==Ei||y.type===Cn&&e.has("OES_texture_float_linear")===!1)return;if(y.anisotropy>1||n.get(y).__currentAnisotropy){let W=e.get("EXT_texture_filter_anisotropic");i.texParameterf(P,W.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(y.anisotropy,s.getMaxAnisotropy())),n.get(y).__currentAnisotropy=y.anisotropy}}}function Ve(P,y){let W=!1;P.__webglInit===void 0&&(P.__webglInit=!0,y.addEventListener("dispose",b));let Y=y.source,te=f.get(Y);te===void 0&&(te={},f.set(Y,te));let me=R(y);if(me!==P.__cacheKey){te[me]===void 0&&(te[me]={texture:i.createTexture(),usedTimes:0},a.memory.textures++,W=!0),te[me].usedTimes++;let ve=te[P.__cacheKey];ve!==void 0&&(te[P.__cacheKey].usedTimes--,ve.usedTimes===0&&C(y)),P.__cacheKey=me,P.__webglTexture=te[me].texture}return W}function ee(P,y,W){return Math.floor(Math.floor(P/W)/y)}function ie(P,y,W,Y){let me=P.updateRanges;if(me.length===0)t.texSubImage2D(i.TEXTURE_2D,0,0,0,y.width,y.height,W,Y,y.data);else{me.sort((ke,be)=>ke.start-be.start);let ve=0;for(let ke=1;ke<me.length;ke++){let be=me[ve],_e=me[ke],ze=be.start+be.count,Xe=ee(_e.start,y.width,4),Ke=ee(be.start,y.width,4);_e.start<=ze+1&&Xe===Ke&&ee(_e.start+_e.count-1,y.width,4)===Xe?be.count=Math.max(be.count,_e.start+_e.count-be.start):(++ve,me[ve]=_e)}me.length=ve+1;let re=t.getParameter(i.UNPACK_ROW_LENGTH),le=t.getParameter(i.UNPACK_SKIP_PIXELS),Ee=t.getParameter(i.UNPACK_SKIP_ROWS);t.pixelStorei(i.UNPACK_ROW_LENGTH,y.width);for(let ke=0,be=me.length;ke<be;ke++){let _e=me[ke],ze=Math.floor(_e.start/4),Xe=Math.ceil(_e.count/4),Ke=ze%y.width,H=Math.floor(ze/y.width),we=Xe,ce=1;t.pixelStorei(i.UNPACK_SKIP_PIXELS,Ke),t.pixelStorei(i.UNPACK_SKIP_ROWS,H),t.texSubImage2D(i.TEXTURE_2D,0,Ke,H,we,ce,W,Y,y.data)}P.clearUpdateRanges(),t.pixelStorei(i.UNPACK_ROW_LENGTH,re),t.pixelStorei(i.UNPACK_SKIP_PIXELS,le),t.pixelStorei(i.UNPACK_SKIP_ROWS,Ee)}}function fe(P,y,W){let Y=i.TEXTURE_2D;(y.isDataArrayTexture||y.isCompressedArrayTexture)&&(Y=i.TEXTURE_2D_ARRAY),y.isData3DTexture&&(Y=i.TEXTURE_3D);let te=Ve(P,y),me=y.source;t.bindTexture(Y,P.__webglTexture,i.TEXTURE0+W);let ve=n.get(me);if(me.version!==ve.__version||te===!0){if(t.activeTexture(i.TEXTURE0+W),(typeof ImageBitmap!="undefined"&&y.image instanceof ImageBitmap)===!1){let ce=ct.getPrimaries(ct.workingColorSpace),Ae=y.colorSpace===Bn?null:ct.getPrimaries(y.colorSpace),De=y.colorSpace===Bn||ce===Ae?i.NONE:i.BROWSER_DEFAULT_WEBGL;t.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,y.flipY),t.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,y.premultiplyAlpha),t.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,De)}t.pixelStorei(i.UNPACK_ALIGNMENT,y.unpackAlignment);let le=m(y.image,!1,s.maxTextureSize);le=rt(y,le);let Ee=r.convert(y.format,y.colorSpace),ke=r.convert(y.type),be=M(y.internalFormat,Ee,ke,y.normalized,y.colorSpace,y.isVideoTexture);Te(Y,y);let _e,ze=y.mipmaps,Xe=y.isVideoTexture!==!0,Ke=ve.__version===void 0||te===!0,H=me.dataReady,we=v(y,le);if(y.isDepthTexture)be=E(y.format===qn,y.type),Ke&&(Xe?t.texStorage2D(i.TEXTURE_2D,1,be,le.width,le.height):t.texImage2D(i.TEXTURE_2D,0,be,le.width,le.height,0,Ee,ke,null));else if(y.isDataTexture)if(ze.length>0){Xe&&Ke&&t.texStorage2D(i.TEXTURE_2D,we,be,ze[0].width,ze[0].height);for(let ce=0,Ae=ze.length;ce<Ae;ce++)_e=ze[ce],Xe?H&&t.texSubImage2D(i.TEXTURE_2D,ce,0,0,_e.width,_e.height,Ee,ke,_e.data):t.texImage2D(i.TEXTURE_2D,ce,be,_e.width,_e.height,0,Ee,ke,_e.data);y.generateMipmaps=!1}else Xe?(Ke&&t.texStorage2D(i.TEXTURE_2D,we,be,le.width,le.height),H&&ie(y,le,Ee,ke)):t.texImage2D(i.TEXTURE_2D,0,be,le.width,le.height,0,Ee,ke,le.data);else if(y.isCompressedTexture)if(y.isCompressedArrayTexture){Xe&&Ke&&t.texStorage3D(i.TEXTURE_2D_ARRAY,we,be,ze[0].width,ze[0].height,le.depth);for(let ce=0,Ae=ze.length;ce<Ae;ce++)if(_e=ze[ce],y.format!==un)if(Ee!==null)if(Xe){if(H)if(y.layerUpdates.size>0){let De=Vc(_e.width,_e.height,y.format,y.type);for(let N of y.layerUpdates){let Z=_e.data.subarray(N*De/_e.data.BYTES_PER_ELEMENT,(N+1)*De/_e.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,ce,0,0,N,_e.width,_e.height,1,Ee,Z)}}else t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,ce,0,0,0,_e.width,_e.height,le.depth,Ee,_e.data)}else t.compressedTexImage3D(i.TEXTURE_2D_ARRAY,ce,be,_e.width,_e.height,le.depth,0,_e.data,0,0);else je("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Xe?H&&t.texSubImage3D(i.TEXTURE_2D_ARRAY,ce,0,0,0,_e.width,_e.height,le.depth,Ee,ke,_e.data):t.texImage3D(i.TEXTURE_2D_ARRAY,ce,be,_e.width,_e.height,le.depth,0,Ee,ke,_e.data);y.layerUpdates.size>0&&y.clearLayerUpdates()}else{Xe&&Ke&&t.texStorage2D(i.TEXTURE_2D,we,be,ze[0].width,ze[0].height);for(let ce=0,Ae=ze.length;ce<Ae;ce++)_e=ze[ce],y.format!==un?Ee!==null?Xe?H&&t.compressedTexSubImage2D(i.TEXTURE_2D,ce,0,0,_e.width,_e.height,Ee,_e.data):t.compressedTexImage2D(i.TEXTURE_2D,ce,be,_e.width,_e.height,0,_e.data):je("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Xe?H&&t.texSubImage2D(i.TEXTURE_2D,ce,0,0,_e.width,_e.height,Ee,ke,_e.data):t.texImage2D(i.TEXTURE_2D,ce,be,_e.width,_e.height,0,Ee,ke,_e.data)}else if(y.isDataArrayTexture)if(Xe){if(Ke&&t.texStorage3D(i.TEXTURE_2D_ARRAY,we,be,le.width,le.height,le.depth),H)if(y.layerUpdates.size>0){let ce=Vc(le.width,le.height,y.format,y.type);for(let Ae of y.layerUpdates){let De=le.data.subarray(Ae*ce/le.data.BYTES_PER_ELEMENT,(Ae+1)*ce/le.data.BYTES_PER_ELEMENT);t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,Ae,le.width,le.height,1,Ee,ke,De)}y.clearLayerUpdates()}else t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,le.width,le.height,le.depth,Ee,ke,le.data)}else t.texImage3D(i.TEXTURE_2D_ARRAY,0,be,le.width,le.height,le.depth,0,Ee,ke,le.data);else if(y.isData3DTexture)Xe?(Ke&&t.texStorage3D(i.TEXTURE_3D,we,be,le.width,le.height,le.depth),H&&t.texSubImage3D(i.TEXTURE_3D,0,0,0,0,le.width,le.height,le.depth,Ee,ke,le.data)):t.texImage3D(i.TEXTURE_3D,0,be,le.width,le.height,le.depth,0,Ee,ke,le.data);else if(y.isFramebufferTexture){if(Ke)if(Xe)t.texStorage2D(i.TEXTURE_2D,we,be,le.width,le.height);else{let ce=le.width,Ae=le.height;for(let De=0;De<we;De++)t.texImage2D(i.TEXTURE_2D,De,be,ce,Ae,0,Ee,ke,null),ce>>=1,Ae>>=1}}else if(y.isHTMLTexture){if("texElementImage2D"in i){let ce=i.canvas;if(ce.hasAttribute("layoutsubtree")||ce.setAttribute("layoutsubtree","true"),le.parentNode!==ce){ce.appendChild(le),u.add(y),ce.onpaint=Ae=>{let De=Ae.changedElements;for(let N of u)De.includes(N.image)&&(N.needsUpdate=!0)},ce.requestPaint();return}if(i.texElementImage2D.length===3)i.texElementImage2D(i.TEXTURE_2D,i.RGBA8,le);else{let De=i.RGBA,N=i.RGBA,Z=i.UNSIGNED_BYTE;i.texElementImage2D(i.TEXTURE_2D,0,De,N,Z,le)}i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE)}}else if(ze.length>0){if(Xe&&Ke){let ce=nt(ze[0]);t.texStorage2D(i.TEXTURE_2D,we,be,ce.width,ce.height)}for(let ce=0,Ae=ze.length;ce<Ae;ce++)_e=ze[ce],Xe?H&&t.texSubImage2D(i.TEXTURE_2D,ce,0,0,Ee,ke,_e):t.texImage2D(i.TEXTURE_2D,ce,be,Ee,ke,_e);y.generateMipmaps=!1}else if(Xe){if(Ke){let ce=nt(le);t.texStorage2D(i.TEXTURE_2D,we,be,ce.width,ce.height)}H&&t.texSubImage2D(i.TEXTURE_2D,0,0,0,Ee,ke,le)}else t.texImage2D(i.TEXTURE_2D,0,be,Ee,ke,le);g(y)&&S(Y),ve.__version=me.version,y.onUpdate&&y.onUpdate(y)}P.__version=y.version}function Pe(P,y,W){if(y.image.length!==6)return;let Y=Ve(P,y),te=y.source;t.bindTexture(i.TEXTURE_CUBE_MAP,P.__webglTexture,i.TEXTURE0+W);let me=n.get(te);if(te.version!==me.__version||Y===!0){t.activeTexture(i.TEXTURE0+W);let ve=ct.getPrimaries(ct.workingColorSpace),re=y.colorSpace===Bn?null:ct.getPrimaries(y.colorSpace),le=y.colorSpace===Bn||ve===re?i.NONE:i.BROWSER_DEFAULT_WEBGL;t.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,y.flipY),t.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,y.premultiplyAlpha),t.pixelStorei(i.UNPACK_ALIGNMENT,y.unpackAlignment),t.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,le);let Ee=y.isCompressedTexture||y.image[0].isCompressedTexture,ke=y.image[0]&&y.image[0].isDataTexture,be=[];for(let N=0;N<6;N++)!Ee&&!ke?be[N]=m(y.image[N],!0,s.maxCubemapSize):be[N]=ke?y.image[N].image:y.image[N],be[N]=rt(y,be[N]);let _e=be[0],ze=r.convert(y.format,y.colorSpace),Xe=r.convert(y.type),Ke=M(y.internalFormat,ze,Xe,y.normalized,y.colorSpace),H=y.isVideoTexture!==!0,we=me.__version===void 0||Y===!0,ce=te.dataReady,Ae=v(y,_e);Te(i.TEXTURE_CUBE_MAP,y);let De;if(Ee){H&&we&&t.texStorage2D(i.TEXTURE_CUBE_MAP,Ae,Ke,_e.width,_e.height);for(let N=0;N<6;N++){De=be[N].mipmaps;for(let Z=0;Z<De.length;Z++){let $=De[Z];y.format!==un?ze!==null?H?ce&&t.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+N,Z,0,0,$.width,$.height,ze,$.data):t.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+N,Z,Ke,$.width,$.height,0,$.data):je("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):H?ce&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+N,Z,0,0,$.width,$.height,ze,Xe,$.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+N,Z,Ke,$.width,$.height,0,ze,Xe,$.data)}}}else{if(De=y.mipmaps,H&&we){De.length>0&&Ae++;let N=nt(be[0]);t.texStorage2D(i.TEXTURE_CUBE_MAP,Ae,Ke,N.width,N.height)}for(let N=0;N<6;N++)if(ke){H?ce&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+N,0,0,0,be[N].width,be[N].height,ze,Xe,be[N].data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+N,0,Ke,be[N].width,be[N].height,0,ze,Xe,be[N].data);for(let Z=0;Z<De.length;Z++){let Se=De[Z].image[N].image;H?ce&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+N,Z+1,0,0,Se.width,Se.height,ze,Xe,Se.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+N,Z+1,Ke,Se.width,Se.height,0,ze,Xe,Se.data)}}else{H?ce&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+N,0,0,0,ze,Xe,be[N]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+N,0,Ke,ze,Xe,be[N]);for(let Z=0;Z<De.length;Z++){let $=De[Z];H?ce&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+N,Z+1,0,0,ze,Xe,$.image[N]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+N,Z+1,Ke,ze,Xe,$.image[N])}}}g(y)&&S(i.TEXTURE_CUBE_MAP),me.__version=te.version,y.onUpdate&&y.onUpdate(y)}P.__version=y.version}function ye(P,y,W,Y,te,me){let ve=r.convert(W.format,W.colorSpace),re=r.convert(W.type),le=M(W.internalFormat,ve,re,W.normalized,W.colorSpace),Ee=n.get(y),ke=n.get(W);if(ke.__renderTarget=y,!Ee.__hasExternalTextures){let be=Math.max(1,y.width>>me),_e=Math.max(1,y.height>>me);te===i.TEXTURE_3D||te===i.TEXTURE_2D_ARRAY?t.texImage3D(te,me,le,be,_e,y.depth,0,ve,re,null):t.texImage2D(te,me,le,be,_e,0,ve,re,null)}t.bindFramebuffer(i.FRAMEBUFFER,P),qe(y)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,Y,te,ke.__webglTexture,0,Q(y)):(te===i.TEXTURE_2D||te>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&te<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,Y,te,ke.__webglTexture,me),t.bindFramebuffer(i.FRAMEBUFFER,null)}function Oe(P,y,W){if(i.bindRenderbuffer(i.RENDERBUFFER,P),y.depthBuffer){let Y=y.depthTexture,te=Y&&Y.isDepthTexture?Y.type:null,me=E(y.stencilBuffer,te),ve=y.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;qe(y)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,Q(y),me,y.width,y.height):W?i.renderbufferStorageMultisample(i.RENDERBUFFER,Q(y),me,y.width,y.height):i.renderbufferStorage(i.RENDERBUFFER,me,y.width,y.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,ve,i.RENDERBUFFER,P)}else{let Y=y.textures;for(let te=0;te<Y.length;te++){let me=Y[te],ve=r.convert(me.format,me.colorSpace),re=r.convert(me.type),le=M(me.internalFormat,ve,re,me.normalized,me.colorSpace);qe(y)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,Q(y),le,y.width,y.height):W?i.renderbufferStorageMultisample(i.RENDERBUFFER,Q(y),le,y.width,y.height):i.renderbufferStorage(i.RENDERBUFFER,le,y.width,y.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function Qe(P,y,W){let Y=y.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(i.FRAMEBUFFER,P),!(y.depthTexture&&y.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let te=n.get(y.depthTexture);if(te.__renderTarget=y,(!te.__webglTexture||y.depthTexture.image.width!==y.width||y.depthTexture.image.height!==y.height)&&(y.depthTexture.image.width=y.width,y.depthTexture.image.height=y.height,y.depthTexture.needsUpdate=!0),Y){if(te.__webglInit===void 0&&(te.__webglInit=!0,y.depthTexture.addEventListener("dispose",b)),te.__webglTexture===void 0){te.__webglTexture=i.createTexture(),t.bindTexture(i.TEXTURE_CUBE_MAP,te.__webglTexture),Te(i.TEXTURE_CUBE_MAP,y.depthTexture);let Ee=r.convert(y.depthTexture.format),ke=r.convert(y.depthTexture.type),be;y.depthTexture.format===Hn?be=i.DEPTH_COMPONENT24:y.depthTexture.format===qn&&(be=i.DEPTH24_STENCIL8);for(let _e=0;_e<6;_e++)i.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+_e,0,be,y.width,y.height,0,Ee,ke,null)}}else F(y.depthTexture,0);let me=te.__webglTexture,ve=Q(y),re=Y?i.TEXTURE_CUBE_MAP_POSITIVE_X+W:i.TEXTURE_2D,le=y.depthTexture.format===qn?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;if(y.depthTexture.format===Hn)qe(y)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,le,re,me,0,ve):i.framebufferTexture2D(i.FRAMEBUFFER,le,re,me,0);else if(y.depthTexture.format===qn)qe(y)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,le,re,me,0,ve):i.framebufferTexture2D(i.FRAMEBUFFER,le,re,me,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function ae(P){let y=n.get(P),W=P.isWebGLCubeRenderTarget===!0;if(y.__boundDepthTexture!==P.depthTexture){let Y=P.depthTexture;if(y.__depthDisposeCallback&&y.__depthDisposeCallback(),Y){let te=()=>{delete y.__boundDepthTexture,delete y.__depthDisposeCallback,Y.removeEventListener("dispose",te)};Y.addEventListener("dispose",te),y.__depthDisposeCallback=te}y.__boundDepthTexture=Y}if(P.depthTexture&&!y.__autoAllocateDepthBuffer)if(W)for(let Y=0;Y<6;Y++)Qe(y.__webglFramebuffer[Y],P,Y);else{let Y=P.texture.mipmaps;Y&&Y.length>0?Qe(y.__webglFramebuffer[0],P,0):Qe(y.__webglFramebuffer,P,0)}else if(W){y.__webglDepthbuffer=[];for(let Y=0;Y<6;Y++)if(t.bindFramebuffer(i.FRAMEBUFFER,y.__webglFramebuffer[Y]),y.__webglDepthbuffer[Y]===void 0)y.__webglDepthbuffer[Y]=i.createRenderbuffer(),Oe(y.__webglDepthbuffer[Y],P,!1);else{let te=P.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,me=y.__webglDepthbuffer[Y];i.bindRenderbuffer(i.RENDERBUFFER,me),i.framebufferRenderbuffer(i.FRAMEBUFFER,te,i.RENDERBUFFER,me)}}else{let Y=P.texture.mipmaps;if(Y&&Y.length>0?t.bindFramebuffer(i.FRAMEBUFFER,y.__webglFramebuffer[0]):t.bindFramebuffer(i.FRAMEBUFFER,y.__webglFramebuffer),y.__webglDepthbuffer===void 0)y.__webglDepthbuffer=i.createRenderbuffer(),Oe(y.__webglDepthbuffer,P,!1);else{let te=P.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,me=y.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,me),i.framebufferRenderbuffer(i.FRAMEBUFFER,te,i.RENDERBUFFER,me)}}t.bindFramebuffer(i.FRAMEBUFFER,null)}function ue(P,y,W){let Y=n.get(P);y!==void 0&&ye(Y.__webglFramebuffer,P,P.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),W!==void 0&&ae(P)}function se(P){let y=P.texture,W=n.get(P),Y=n.get(y);P.addEventListener("dispose",x);let te=P.textures,me=P.isWebGLCubeRenderTarget===!0,ve=te.length>1;if(ve||(Y.__webglTexture===void 0&&(Y.__webglTexture=i.createTexture()),Y.__version=y.version,a.memory.textures++),me){W.__webglFramebuffer=[];for(let re=0;re<6;re++)if(y.mipmaps&&y.mipmaps.length>0){W.__webglFramebuffer[re]=[];for(let le=0;le<y.mipmaps.length;le++)W.__webglFramebuffer[re][le]=i.createFramebuffer()}else W.__webglFramebuffer[re]=i.createFramebuffer()}else{if(y.mipmaps&&y.mipmaps.length>0){W.__webglFramebuffer=[];for(let re=0;re<y.mipmaps.length;re++)W.__webglFramebuffer[re]=i.createFramebuffer()}else W.__webglFramebuffer=i.createFramebuffer();if(ve)for(let re=0,le=te.length;re<le;re++){let Ee=n.get(te[re]);Ee.__webglTexture===void 0&&(Ee.__webglTexture=i.createTexture(),a.memory.textures++)}if(P.samples>0&&qe(P)===!1){W.__webglMultisampledFramebuffer=i.createFramebuffer(),W.__webglColorRenderbuffer=[],t.bindFramebuffer(i.FRAMEBUFFER,W.__webglMultisampledFramebuffer);for(let re=0;re<te.length;re++){let le=te[re];W.__webglColorRenderbuffer[re]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,W.__webglColorRenderbuffer[re]);let Ee=r.convert(le.format,le.colorSpace),ke=r.convert(le.type),be=M(le.internalFormat,Ee,ke,le.normalized,le.colorSpace,P.isXRRenderTarget===!0),_e=Q(P);i.renderbufferStorageMultisample(i.RENDERBUFFER,_e,be,P.width,P.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+re,i.RENDERBUFFER,W.__webglColorRenderbuffer[re])}i.bindRenderbuffer(i.RENDERBUFFER,null),P.depthBuffer&&(W.__webglDepthRenderbuffer=i.createRenderbuffer(),Oe(W.__webglDepthRenderbuffer,P,!0)),t.bindFramebuffer(i.FRAMEBUFFER,null)}}if(me){t.bindTexture(i.TEXTURE_CUBE_MAP,Y.__webglTexture),Te(i.TEXTURE_CUBE_MAP,y);for(let re=0;re<6;re++)if(y.mipmaps&&y.mipmaps.length>0)for(let le=0;le<y.mipmaps.length;le++)ye(W.__webglFramebuffer[re][le],P,y,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+re,le);else ye(W.__webglFramebuffer[re],P,y,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+re,0);g(y)&&S(i.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(ve){for(let re=0,le=te.length;re<le;re++){let Ee=te[re],ke=n.get(Ee),be=i.TEXTURE_2D;(P.isWebGL3DRenderTarget||P.isWebGLArrayRenderTarget)&&(be=P.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(be,ke.__webglTexture),Te(be,Ee),ye(W.__webglFramebuffer,P,Ee,i.COLOR_ATTACHMENT0+re,be,0),g(Ee)&&S(be)}t.unbindTexture()}else{let re=i.TEXTURE_2D;if((P.isWebGL3DRenderTarget||P.isWebGLArrayRenderTarget)&&(re=P.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(re,Y.__webglTexture),Te(re,y),y.mipmaps&&y.mipmaps.length>0)for(let le=0;le<y.mipmaps.length;le++)ye(W.__webglFramebuffer[le],P,y,i.COLOR_ATTACHMENT0,re,le);else ye(W.__webglFramebuffer,P,y,i.COLOR_ATTACHMENT0,re,0);g(y)&&S(re),t.unbindTexture()}P.depthBuffer&&ae(P)}function oe(P){let y=P.textures;for(let W=0,Y=y.length;W<Y;W++){let te=y[W];if(g(te)){let me=A(P),ve=n.get(te).__webglTexture;t.bindTexture(me,ve),S(me),t.unbindTexture()}}}let de=[],xe=[];function Me(P){if(P.samples>0){if(qe(P)===!1){let y=P.textures,W=P.width,Y=P.height,te=i.COLOR_BUFFER_BIT,me=P.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,ve=n.get(P),re=y.length>1;if(re)for(let Ee=0;Ee<y.length;Ee++)t.bindFramebuffer(i.FRAMEBUFFER,ve.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+Ee,i.RENDERBUFFER,null),t.bindFramebuffer(i.FRAMEBUFFER,ve.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+Ee,i.TEXTURE_2D,null,0);t.bindFramebuffer(i.READ_FRAMEBUFFER,ve.__webglMultisampledFramebuffer);let le=P.texture.mipmaps;le&&le.length>0?t.bindFramebuffer(i.DRAW_FRAMEBUFFER,ve.__webglFramebuffer[0]):t.bindFramebuffer(i.DRAW_FRAMEBUFFER,ve.__webglFramebuffer);for(let Ee=0;Ee<y.length;Ee++){if(P.resolveDepthBuffer&&(P.depthBuffer&&(te|=i.DEPTH_BUFFER_BIT),P.stencilBuffer&&P.resolveStencilBuffer&&(te|=i.STENCIL_BUFFER_BIT)),re){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,ve.__webglColorRenderbuffer[Ee]);let ke=n.get(y[Ee]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,ke,0)}i.blitFramebuffer(0,0,W,Y,0,0,W,Y,te,i.NEAREST),c===!0&&(de.length=0,xe.length=0,de.push(i.COLOR_ATTACHMENT0+Ee),P.depthBuffer&&P.storeMultisampledDepthBuffer===!1&&(de.push(me),xe.push(me),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,xe)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,de))}if(t.bindFramebuffer(i.READ_FRAMEBUFFER,null),t.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),re)for(let Ee=0;Ee<y.length;Ee++){t.bindFramebuffer(i.FRAMEBUFFER,ve.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+Ee,i.RENDERBUFFER,ve.__webglColorRenderbuffer[Ee]);let ke=n.get(y[Ee]).__webglTexture;t.bindFramebuffer(i.FRAMEBUFFER,ve.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+Ee,i.TEXTURE_2D,ke,0)}t.bindFramebuffer(i.DRAW_FRAMEBUFFER,ve.__webglMultisampledFramebuffer)}else if(P.depthBuffer&&P.storeMultisampledDepthBuffer===!1&&c){let y=P.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[y])}}}function Q(P){return Math.min(s.maxSamples,P.samples)}function qe(P){let y=n.get(P);return P.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&y.__useRenderToTexture!==!1}function B(P){let y=a.render.frame;h.get(P)!==y&&(h.set(P,y),P.update())}function rt(P,y){let W=P.colorSpace,Y=P.format,te=P.type;return P.isCompressedTexture===!0||P.isVideoTexture===!0||W!==lr&&W!==Bn&&(ct.getTransfer(W)===pt?(Y!==un||te!==tn)&&je("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Je("WebGLTextures: Unsupported texture color space:",W)),y}function nt(P){return typeof HTMLImageElement!="undefined"&&P instanceof HTMLImageElement?(l.width=P.naturalWidth||P.width,l.height=P.naturalHeight||P.height):typeof VideoFrame!="undefined"&&P instanceof VideoFrame?(l.width=P.displayWidth,l.height=P.displayHeight):(l.width=P.width,l.height=P.height),l}this.allocateTextureUnit=j,this.resetTextureUnits=z,this.getTextureUnits=O,this.setTextureUnits=k,this.setTexture2D=F,this.setTexture2DArray=G,this.setTexture3D=q,this.setTextureCube=X,this.rebindTextures=ue,this.setupRenderTarget=se,this.updateRenderTargetMipmap=oe,this.updateMultisampleRenderTarget=Me,this.setupDepthRenderbuffer=ae,this.setupFrameBufferTexture=ye,this.useMultisampledRTT=qe,this.isReversedDepthBuffer=function(){return t.buffers.depth.getReversed()}}function ex(i,e){function t(n,s=Bn){let r,a=ct.getTransfer(s);if(n===tn)return i.UNSIGNED_BYTE;if(n===No)return i.UNSIGNED_SHORT_4_4_4_4;if(n===Uo)return i.UNSIGNED_SHORT_5_5_5_1;if(n===Rc)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===Pc)return i.UNSIGNED_INT_10F_11F_11F_REV;if(n===Ac)return i.BYTE;if(n===Cc)return i.SHORT;if(n===Fs)return i.UNSIGNED_SHORT;if(n===Lo)return i.INT;if(n===On)return i.UNSIGNED_INT;if(n===Cn)return i.FLOAT;if(n===Vt)return i.HALF_FLOAT;if(n===Ic)return i.ALPHA;if(n===Dc)return i.RGB;if(n===un)return i.RGBA;if(n===Hn)return i.DEPTH_COMPONENT;if(n===qn)return i.DEPTH_STENCIL;if(n===Fo)return i.RED;if(n===Oo)return i.RED_INTEGER;if(n===wi)return i.RG;if(n===Bo)return i.RG_INTEGER;if(n===zo)return i.RGBA_INTEGER;if(n===Jr||n===Kr||n===$r||n===Qr)if(a===pt)if(r=e.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===Jr)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===Kr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===$r)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===Qr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=e.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===Jr)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===Kr)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===$r)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===Qr)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===Vo||n===ko||n===Ho||n===Go)if(r=e.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===Vo)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===ko)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===Ho)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===Go)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===Wo||n===Xo||n===qo||n===Yo||n===jo||n===ea||n===Zo)if(r=e.get("WEBGL_compressed_texture_etc"),r!==null){if(n===Wo||n===Xo)return a===pt?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===qo)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC;if(n===Yo)return r.COMPRESSED_R11_EAC;if(n===jo)return r.COMPRESSED_SIGNED_R11_EAC;if(n===ea)return r.COMPRESSED_RG11_EAC;if(n===Zo)return r.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===Jo||n===Ko||n===$o||n===Qo||n===el||n===tl||n===nl||n===il||n===sl||n===rl||n===al||n===ol||n===ll||n===cl)if(r=e.get("WEBGL_compressed_texture_astc"),r!==null){if(n===Jo)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===Ko)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===$o)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===Qo)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===el)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===tl)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===nl)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===il)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===sl)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===rl)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===al)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===ol)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===ll)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===cl)return a===pt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===hl||n===ul||n===dl)if(r=e.get("EXT_texture_compression_bptc"),r!==null){if(n===hl)return a===pt?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===ul)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===dl)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===fl||n===pl||n===ta||n===ml)if(r=e.get("EXT_texture_compression_rgtc"),r!==null){if(n===fl)return r.COMPRESSED_RED_RGTC1_EXT;if(n===pl)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===ta)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===ml)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===Ti?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:t}}var tx=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,nx=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,rh=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let n=new mr(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,n=new Pt({vertexShader:tx,fragmentShader:nx,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new ut(new hn(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},ah=class extends Un{constructor(e,t){super();let n=this,s=null,r=1,a=null,o="local-floor",c=1,l=null,h=null,u=null,d=null,f=null,p=null,_=typeof XRWebGLBinding!="undefined",m=new rh,g={},S=t.getContextAttributes(),A=null,M=null,E=[],v=[],b=new pe,x=null,w=null,C=new Xt;C.viewport=new Et;let I=new Xt;I.viewport=new Et;let U=[C,I],z=new To,O=null,k=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(ee){let ie=E[ee];return ie===void 0&&(ie=new Ts,E[ee]=ie),ie.getTargetRaySpace()},this.getControllerGrip=function(ee){let ie=E[ee];return ie===void 0&&(ie=new Ts,E[ee]=ie),ie.getGripSpace()},this.getHand=function(ee){let ie=E[ee];return ie===void 0&&(ie=new Ts,E[ee]=ie),ie.getHandSpace()};function j(ee){let ie=v.indexOf(ee.inputSource);if(ie===-1)return;let fe=E[ie];fe!==void 0&&(fe.update(ee.inputSource,ee.frame,l||a),fe.dispatchEvent({type:ee.type,data:ee.inputSource}))}function R(){s.removeEventListener("select",j),s.removeEventListener("selectstart",j),s.removeEventListener("selectend",j),s.removeEventListener("squeeze",j),s.removeEventListener("squeezestart",j),s.removeEventListener("squeezeend",j),s.removeEventListener("end",R),s.removeEventListener("inputsourceschange",F);for(let ee=0;ee<E.length;ee++){let ie=v[ee];ie!==null&&(v[ee]=null,E[ee].disconnect(ie))}O=null,k=null,m.reset();for(let ee in g)delete g[ee];if(e.setRenderTarget(A),f=null,d=null,u=null,s=null,M=null,Ve.stop(),n.isPresenting=!1,e.setPixelRatio(x),e.setSize(b.width,b.height,!1),w!==null){let ee=w.camera;ee.fov=w.fov,ee.zoom=w.zoom,ee.updateProjectionMatrix(),w=null}n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(ee){r=ee,n.isPresenting===!0&&je("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(ee){o=ee,n.isPresenting===!0&&je("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return l||a},this.setReferenceSpace=function(ee){l=ee},this.getBaseLayer=function(){return d!==null?d:f},this.getBinding=function(){return u===null&&_&&(u=new XRWebGLBinding(s,t)),u},this.getFrame=function(){return p},this.getSession=function(){return s},this.setSession=async function(ee){if(s=ee,s!==null){if(A=e.getRenderTarget(),s.addEventListener("select",j),s.addEventListener("selectstart",j),s.addEventListener("selectend",j),s.addEventListener("squeeze",j),s.addEventListener("squeezestart",j),s.addEventListener("squeezeend",j),s.addEventListener("end",R),s.addEventListener("inputsourceschange",F),S.xrCompatible!==!0&&await t.makeXRCompatible(),x=e.getPixelRatio(),e.getSize(b),_&&"createProjectionLayer"in XRWebGLBinding.prototype){let fe=null,Pe=null,ye=null;S.depth&&(ye=S.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,fe=S.stencil?qn:Hn,Pe=S.stencil?Ti:On);let Oe={colorFormat:t.RGBA8,depthFormat:ye,scaleFactor:r};u=this.getBinding(),d=u.createProjectionLayer(Oe),s.updateRenderState({layers:[d]}),e.setPixelRatio(1),e.setSize(d.textureWidth,d.textureHeight,!1),M=new Ct(d.textureWidth,d.textureHeight,{format:un,type:tn,depthTexture:new Wn(d.textureWidth,d.textureHeight,Pe,void 0,void 0,void 0,void 0,void 0,void 0,fe),stencilBuffer:S.stencil,colorSpace:e.outputColorSpace,samples:S.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1,storeMultisampledDepthBuffer:d.ignoreDepthValues===!1,storeMultisampledStencilBuffer:d.ignoreDepthValues===!1})}else{let fe={antialias:S.antialias,alpha:!0,depth:S.depth,stencil:S.stencil,framebufferScaleFactor:r};f=new XRWebGLLayer(s,t,fe),s.updateRenderState({baseLayer:f}),e.setPixelRatio(1),e.setSize(f.framebufferWidth,f.framebufferHeight,!1),M=new Ct(f.framebufferWidth,f.framebufferHeight,{format:un,type:tn,colorSpace:e.outputColorSpace,stencilBuffer:S.stencil,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1,storeMultisampledDepthBuffer:f.ignoreDepthValues===!1,storeMultisampledStencilBuffer:f.ignoreDepthValues===!1})}M.isXRRenderTarget=!0,this.setFoveation(c),l=null,a=await s.requestReferenceSpace(o),Ve.setContext(s),Ve.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return m.getDepthTexture()};function F(ee){for(let ie=0;ie<ee.removed.length;ie++){let fe=ee.removed[ie],Pe=v.indexOf(fe);Pe>=0&&(v[Pe]=null,E[Pe].disconnect(fe))}for(let ie=0;ie<ee.added.length;ie++){let fe=ee.added[ie],Pe=v.indexOf(fe);if(Pe===-1){for(let Oe=0;Oe<E.length;Oe++)if(Oe>=v.length){v.push(fe),Pe=Oe;break}else if(v[Oe]===null){v[Oe]=fe,Pe=Oe;break}if(Pe===-1)break}let ye=E[Pe];ye&&ye.connect(fe)}}let G=new D,q=new D;function X(ee,ie,fe){G.setFromMatrixPosition(ie.matrixWorld),q.setFromMatrixPosition(fe.matrixWorld);let Pe=G.distanceTo(q),ye=ie.projectionMatrix.elements,Oe=fe.projectionMatrix.elements,Qe=ye[14]/(ye[10]-1),ae=ye[14]/(ye[10]+1),ue=(ye[9]+1)/ye[5],se=(ye[9]-1)/ye[5],oe=(ye[8]-1)/ye[0],de=(Oe[8]+1)/Oe[0],xe=Qe*oe,Me=Qe*de,Q=Pe/(-oe+de),qe=Q*-oe;if(ie.matrixWorld.decompose(ee.position,ee.quaternion,ee.scale),ee.translateX(qe),ee.translateZ(Q),ee.matrixWorld.compose(ee.position,ee.quaternion,ee.scale),ee.matrixWorldInverse.copy(ee.matrixWorld).invert(),ye[10]===-1)ee.projectionMatrix.copy(ie.projectionMatrix),ee.projectionMatrixInverse.copy(ie.projectionMatrixInverse);else{let B=Qe+Q,rt=ae+Q,nt=xe-qe,P=Me+(Pe-qe),y=ue*ae/rt*B,W=se*ae/rt*B;ee.projectionMatrix.makePerspective(nt,P,y,W,B,rt),ee.projectionMatrixInverse.copy(ee.projectionMatrix).invert()}}function he(ee,ie){ie===null?ee.matrixWorld.copy(ee.matrix):ee.matrixWorld.multiplyMatrices(ie.matrixWorld,ee.matrix),ee.matrixWorldInverse.copy(ee.matrixWorld).invert()}this.updateCamera=function(ee){if(s===null)return;let ie=ee.near,fe=ee.far;m.texture!==null&&(m.depthNear>0&&(ie=m.depthNear),m.depthFar>0&&(fe=m.depthFar)),z.near=I.near=C.near=ie,z.far=I.far=C.far=fe,(O!==z.near||k!==z.far)&&(s.updateRenderState({depthNear:z.near,depthFar:z.far}),O=z.near,k=z.far),z.layers.mask=ee.layers.mask|6,C.layers.mask=z.layers.mask&-5,I.layers.mask=z.layers.mask&-3;let Pe=ee.parent,ye=z.cameras;he(z,Pe);for(let Oe=0;Oe<ye.length;Oe++)he(ye[Oe],Pe);ye.length===2?X(z,C,I):z.projectionMatrix.copy(C.projectionMatrix),w===null&&ee.isPerspectiveCamera&&(w={camera:ee,fov:ee.fov,zoom:ee.zoom}),ge(ee,z,Pe)};function ge(ee,ie,fe){fe===null?ee.matrix.copy(ie.matrixWorld):(ee.matrix.copy(fe.matrixWorld),ee.matrix.invert(),ee.matrix.multiply(ie.matrixWorld)),ee.matrix.decompose(ee.position,ee.quaternion,ee.scale),ee.updateMatrixWorld(!0),ee.projectionMatrix.copy(ie.projectionMatrix),ee.projectionMatrixInverse.copy(ie.projectionMatrixInverse),ee.isPerspectiveCamera&&(ee.fov=Fi*2*Math.atan(1/ee.projectionMatrix.elements[5]),ee.zoom=1)}this.getCamera=function(){return z},this.getFoveation=function(){if(!(d===null&&f===null))return c},this.setFoveation=function(ee){c=ee,d!==null&&(d.fixedFoveation=ee),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=ee)},this.hasDepthSensing=function(){return m.texture!==null},this.getDepthSensingMesh=function(){return m.getMesh(z)},this.getCameraTexture=function(ee){return g[ee]};let Fe=null;function Te(ee,ie){if(h=ie.getViewerPose(l||a),p=ie,h!==null){let fe=h.views;f!==null&&(e.setRenderTargetFramebuffer(M,f.framebuffer),e.setRenderTarget(M));let Pe=!1;fe.length!==z.cameras.length&&(z.cameras.length=0,Pe=!0);for(let ae=0;ae<fe.length;ae++){let ue=fe[ae],se=null;if(f!==null)se=f.getViewport(ue);else{let de=u.getViewSubImage(d,ue);se=de.viewport,ae===0&&(e.setRenderTargetTextures(M,de.colorTexture,de.depthStencilTexture),e.setRenderTarget(M))}let oe=U[ae];oe===void 0&&(oe=new Xt,oe.layers.enable(ae),oe.viewport=new Et,U[ae]=oe),oe.matrix.fromArray(ue.transform.matrix),oe.matrix.decompose(oe.position,oe.quaternion,oe.scale),oe.projectionMatrix.fromArray(ue.projectionMatrix),oe.projectionMatrixInverse.copy(oe.projectionMatrix).invert(),oe.viewport.set(se.x,se.y,se.width,se.height),ae===0&&(z.matrix.copy(oe.matrix),z.matrix.decompose(z.position,z.quaternion,z.scale)),Pe===!0&&z.cameras.push(oe)}let ye=s.enabledFeatures;if(ye&&ye.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&_){u=n.getBinding();let ae=u.getDepthInformation(fe[0]);ae&&ae.isValid&&ae.texture&&m.init(ae,s.renderState)}if(ye&&ye.includes("camera-access")&&_){e.state.unbindTexture(),u=n.getBinding();for(let ae=0;ae<fe.length;ae++){let ue=fe[ae].camera;if(ue){let se=g[ue];se||(se=new mr,g[ue]=se);let oe=u.getCameraImage(ue);se.sourceTexture=oe}}}}for(let fe=0;fe<E.length;fe++){let Pe=v[fe],ye=E[fe];Pe!==null&&ye!==void 0&&ye.update(Pe,ie,l||a)}Fe&&Fe(ee,ie),ie.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:ie}),p=null}let Ve=new ud;Ve.setAnimationLoop(Te),this.setAnimationLoop=function(ee){Fe=ee},this.dispose=function(){}}},ix=new Ne,_d=new st;_d.set(-1,0,0,0,1,0,0,0,1);function sx(i,e){function t(m,g){m.matrixAutoUpdate===!0&&m.updateMatrix(),g.value.copy(m.matrix)}function n(m,g){g.color.getRGB(m.fogColor.value,Oc(i)),g.isFog?(m.fogNear.value=g.near,m.fogFar.value=g.far):g.isFogExp2&&(m.fogDensity.value=g.density)}function s(m,g,S,A,M){g.isNodeMaterial?g.uniformsNeedUpdate=!1:g.isMeshBasicMaterial?r(m,g):g.isMeshLambertMaterial?(r(m,g),g.envMap&&(m.envMapIntensity.value=g.envMapIntensity)):g.isMeshToonMaterial?(r(m,g),u(m,g)):g.isMeshPhongMaterial?(r(m,g),h(m,g),g.envMap&&(m.envMapIntensity.value=g.envMapIntensity)):g.isMeshStandardMaterial?(r(m,g),d(m,g),g.isMeshPhysicalMaterial&&f(m,g,M)):g.isMeshMatcapMaterial?(r(m,g),p(m,g)):g.isMeshDepthMaterial?r(m,g):g.isMeshDistanceMaterial?(r(m,g),_(m,g)):g.isMeshNormalMaterial?r(m,g):g.isLineBasicMaterial?(a(m,g),g.isLineDashedMaterial&&o(m,g)):g.isPointsMaterial?c(m,g,S,A):g.isSpriteMaterial?l(m,g):g.isShadowMaterial?(m.color.value.copy(g.color),m.opacity.value=g.opacity):g.isShaderMaterial&&(g.uniformsNeedUpdate=!1)}function r(m,g){m.opacity.value=g.opacity,g.color&&m.diffuse.value.copy(g.color),g.emissive&&m.emissive.value.copy(g.emissive).multiplyScalar(g.emissiveIntensity),g.map&&(m.map.value=g.map,t(g.map,m.mapTransform)),g.alphaMap&&(m.alphaMap.value=g.alphaMap,t(g.alphaMap,m.alphaMapTransform)),g.bumpMap&&(m.bumpMap.value=g.bumpMap,t(g.bumpMap,m.bumpMapTransform),m.bumpScale.value=g.bumpScale,g.side===Zt&&(m.bumpScale.value*=-1)),g.normalMap&&(m.normalMap.value=g.normalMap,t(g.normalMap,m.normalMapTransform),m.normalScale.value.copy(g.normalScale),g.side===Zt&&m.normalScale.value.negate()),g.displacementMap&&(m.displacementMap.value=g.displacementMap,t(g.displacementMap,m.displacementMapTransform),m.displacementScale.value=g.displacementScale,m.displacementBias.value=g.displacementBias),g.emissiveMap&&(m.emissiveMap.value=g.emissiveMap,t(g.emissiveMap,m.emissiveMapTransform)),g.specularMap&&(m.specularMap.value=g.specularMap,t(g.specularMap,m.specularMapTransform)),g.alphaTest>0&&(m.alphaTest.value=g.alphaTest);let S=e.get(g),A=S.envMap,M=S.envMapRotation;A&&(m.envMap.value=A,m.envMapRotation.value.setFromMatrix4(ix.makeRotationFromEuler(M)).transpose(),A.isCubeTexture&&A.isRenderTargetTexture===!1&&m.envMapRotation.value.premultiply(_d),m.reflectivity.value=g.reflectivity,m.ior.value=g.ior,m.refractionRatio.value=g.refractionRatio),g.lightMap&&(m.lightMap.value=g.lightMap,m.lightMapIntensity.value=g.lightMapIntensity,t(g.lightMap,m.lightMapTransform)),g.aoMap&&(m.aoMap.value=g.aoMap,m.aoMapIntensity.value=g.aoMapIntensity,t(g.aoMap,m.aoMapTransform))}function a(m,g){m.diffuse.value.copy(g.color),m.opacity.value=g.opacity,g.map&&(m.map.value=g.map,t(g.map,m.mapTransform))}function o(m,g){m.dashSize.value=g.dashSize,m.totalSize.value=g.dashSize+g.gapSize,m.scale.value=g.scale}function c(m,g,S,A){m.diffuse.value.copy(g.color),m.opacity.value=g.opacity,m.size.value=g.size*S,m.scale.value=A*.5,g.map&&(m.map.value=g.map,t(g.map,m.uvTransform)),g.alphaMap&&(m.alphaMap.value=g.alphaMap,t(g.alphaMap,m.alphaMapTransform)),g.alphaTest>0&&(m.alphaTest.value=g.alphaTest)}function l(m,g){m.diffuse.value.copy(g.color),m.opacity.value=g.opacity,m.rotation.value=g.rotation,g.map&&(m.map.value=g.map,t(g.map,m.mapTransform)),g.alphaMap&&(m.alphaMap.value=g.alphaMap,t(g.alphaMap,m.alphaMapTransform)),g.alphaTest>0&&(m.alphaTest.value=g.alphaTest)}function h(m,g){m.specular.value.copy(g.specular),m.shininess.value=Math.max(g.shininess,1e-4)}function u(m,g){g.gradientMap&&(m.gradientMap.value=g.gradientMap)}function d(m,g){m.metalness.value=g.metalness,g.metalnessMap&&(m.metalnessMap.value=g.metalnessMap,t(g.metalnessMap,m.metalnessMapTransform)),m.roughness.value=g.roughness,g.roughnessMap&&(m.roughnessMap.value=g.roughnessMap,t(g.roughnessMap,m.roughnessMapTransform)),g.envMap&&(m.envMapIntensity.value=g.envMapIntensity)}function f(m,g,S){m.ior.value=g.ior,g.sheen>0&&(m.sheenColor.value.copy(g.sheenColor).multiplyScalar(g.sheen),m.sheenRoughness.value=g.sheenRoughness,g.sheenColorMap&&(m.sheenColorMap.value=g.sheenColorMap,t(g.sheenColorMap,m.sheenColorMapTransform)),g.sheenRoughnessMap&&(m.sheenRoughnessMap.value=g.sheenRoughnessMap,t(g.sheenRoughnessMap,m.sheenRoughnessMapTransform))),g.clearcoat>0&&(m.clearcoat.value=g.clearcoat,m.clearcoatRoughness.value=g.clearcoatRoughness,g.clearcoatMap&&(m.clearcoatMap.value=g.clearcoatMap,t(g.clearcoatMap,m.clearcoatMapTransform)),g.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=g.clearcoatRoughnessMap,t(g.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),g.clearcoatNormalMap&&(m.clearcoatNormalMap.value=g.clearcoatNormalMap,t(g.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(g.clearcoatNormalScale),g.side===Zt&&m.clearcoatNormalScale.value.negate())),g.dispersion>0&&(m.dispersion.value=g.dispersion),g.retroreflectivity>0&&(m.retroreflectivity.value=g.retroreflectivity),g.iridescence>0&&(m.iridescence.value=g.iridescence,m.iridescenceIOR.value=g.iridescenceIOR,m.iridescenceThicknessMinimum.value=g.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=g.iridescenceThicknessRange[1],g.iridescenceMap&&(m.iridescenceMap.value=g.iridescenceMap,t(g.iridescenceMap,m.iridescenceMapTransform)),g.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=g.iridescenceThicknessMap,t(g.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),g.transmission>0&&(m.transmission.value=g.transmission,m.transmissionSamplerMap.value=S.texture,m.transmissionSamplerSize.value.set(S.width,S.height),g.transmissionMap&&(m.transmissionMap.value=g.transmissionMap,t(g.transmissionMap,m.transmissionMapTransform)),m.thickness.value=g.thickness,g.thicknessMap&&(m.thicknessMap.value=g.thicknessMap,t(g.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=g.attenuationDistance,m.attenuationColor.value.copy(g.attenuationColor)),g.anisotropy>0&&(m.anisotropyVector.value.set(g.anisotropy*Math.cos(g.anisotropyRotation),g.anisotropy*Math.sin(g.anisotropyRotation)),g.anisotropyMap&&(m.anisotropyMap.value=g.anisotropyMap,t(g.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=g.specularIntensity,m.specularColor.value.copy(g.specularColor),g.specularColorMap&&(m.specularColorMap.value=g.specularColorMap,t(g.specularColorMap,m.specularColorMapTransform)),g.specularIntensityMap&&(m.specularIntensityMap.value=g.specularIntensityMap,t(g.specularIntensityMap,m.specularIntensityMapTransform))}function p(m,g){g.matcap&&(m.matcap.value=g.matcap)}function _(m,g){let S=e.get(g).light;m.referencePosition.value.setFromMatrixPosition(S.matrixWorld),m.nearDistance.value=S.shadow.camera.near,m.farDistance.value=S.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function rx(i,e,t,n){let s={},r={},a=[],o=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function c(M,E){let v=E.program;n.uniformBlockBinding(M,v)}function l(M,E){let v=s[M.id];v===void 0&&(m(M),v=h(M),s[M.id]=v,M.addEventListener("dispose",S));let b=E.program;n.updateUBOMapping(M,b);let x=e.render.frame;r[M.id]!==x&&(d(M),r[M.id]=x)}function h(M){let E=u();M.__bindingPointIndex=E;let v=i.createBuffer(),b=M.__size,x=M.usage;return i.bindBuffer(i.UNIFORM_BUFFER,v),i.bufferData(i.UNIFORM_BUFFER,b,x),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,E,v),v}function u(){for(let M=0;M<o;M++)if(a.indexOf(M)===-1)return a.push(M),M;return Je("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(M){let E=s[M.id],v=M.uniforms,b=M.__cache;i.bindBuffer(i.UNIFORM_BUFFER,E);for(let x=0,w=v.length;x<w;x++){let C=v[x];if(Array.isArray(C))for(let I=0,U=C.length;I<U;I++)f(C[I],x,I,b);else f(C,x,0,b)}i.bindBuffer(i.UNIFORM_BUFFER,null)}function f(M,E,v,b){if(_(M,E,v,b)===!0){let x=M.__offset,w=M.value;if(Array.isArray(w)){let C=0;for(let I=0;I<w.length;I++){let U=w[I],z=g(U);p(U,M.__data,C),typeof U!="number"&&typeof U!="boolean"&&!U.isMatrix3&&!ArrayBuffer.isView(U)&&(C+=z.storage/Float32Array.BYTES_PER_ELEMENT)}}else p(w,M.__data,0);i.bufferSubData(i.UNIFORM_BUFFER,x,M.__data)}}function p(M,E,v){typeof M=="number"||typeof M=="boolean"?E[0]=M:M.isMatrix3?(E[0]=M.elements[0],E[1]=M.elements[1],E[2]=M.elements[2],E[3]=0,E[4]=M.elements[3],E[5]=M.elements[4],E[6]=M.elements[5],E[7]=0,E[8]=M.elements[6],E[9]=M.elements[7],E[10]=M.elements[8],E[11]=0):ArrayBuffer.isView(M)?E.set(new M.constructor(M.buffer,M.byteOffset,E.length)):M.toArray(E,v)}function _(M,E,v,b){let x=M.value,w=E+"_"+v;if(b[w]===void 0)return typeof x=="number"||typeof x=="boolean"?b[w]=x:ArrayBuffer.isView(x)?b[w]=x.slice():b[w]=x.clone(),!0;{let C=b[w];if(typeof x=="number"||typeof x=="boolean"){if(C!==x)return b[w]=x,!0}else{if(ArrayBuffer.isView(x))return!0;if(C.equals(x)===!1)return C.copy(x),!0}}return!1}function m(M){let E=M.uniforms,v=0,b=16;for(let w=0,C=E.length;w<C;w++){let I=Array.isArray(E[w])?E[w]:[E[w]];for(let U=0,z=I.length;U<z;U++){let O=I[U],k=Array.isArray(O.value)?O.value:[O.value];for(let j=0,R=k.length;j<R;j++){let F=k[j],G=g(F),q=v%b,X=q%G.boundary,he=q+X;v+=X,he!==0&&b-he<G.storage&&(v+=b-he),O.__data=new Float32Array(G.storage/Float32Array.BYTES_PER_ELEMENT),O.__offset=v,v+=G.storage}}}let x=v%b;return x>0&&(v+=b-x),M.__size=v,M.__cache={},this}function g(M){let E={boundary:0,storage:0};return typeof M=="number"||typeof M=="boolean"?(E.boundary=4,E.storage=4):M.isVector2?(E.boundary=8,E.storage=8):M.isVector3||M.isColor?(E.boundary=16,E.storage=12):M.isVector4?(E.boundary=16,E.storage=16):M.isMatrix3?(E.boundary=48,E.storage=48):M.isMatrix4?(E.boundary=64,E.storage=64):M.isTexture?je("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(M)?(E.boundary=16,E.storage=M.byteLength):je("WebGLRenderer: Unsupported uniform value type.",M),E}function S(M){let E=M.target;E.removeEventListener("dispose",S);let v=a.indexOf(E.__bindingPointIndex);a.splice(v,1),i.deleteBuffer(s[E.id]),delete s[E.id],delete r[E.id]}function A(){for(let M in s)i.deleteBuffer(s[M]);a=[],s={},r={}}return{bind:c,update:l,dispose:A}}var ax=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),Yn=null;function ox(){return Yn===null&&(Yn=new si(ax,16,16,wi,Vt),Yn.name="DFG_LUT",Yn.minFilter=jt,Yn.magFilter=jt,Yn.wrapS=kn,Yn.wrapT=kn,Yn.generateMipmaps=!1,Yn.needsUpdate=!0),Yn}var Ml=class{constructor(e={}){let{canvas:t=Lu(),context:n=null,depth:s=!0,stencil:r=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:c=!0,preserveDrawingBuffer:l=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:u=!1,reversedDepthBuffer:d=!1,outputBufferType:f=tn}=e;this.isWebGLRenderer=!0;let p;if(n!==null){if(typeof WebGLRenderingContext!="undefined"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");p=n.getContextAttributes().alpha}else p=a;let _=f,m=new Set([zo,Bo,Oo]),g=new Set([tn,On,Fs,Ti,No,Uo]),S=new Uint32Array(4),A=new Int32Array(4),M=new D,E=null,v=null,b=[],x=[],w=null;this.domElement=t,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=Fn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let C=this,I=!1,U=null,z=null,O=null,k=null;this._outputColorSpace=Yt;let j=0,R=0,F=null,G=-1,q=null,X=new Et,he=new Et,ge=null,Fe=new tt(0),Te=0,Ve=t.width,ee=t.height,ie=1,fe=null,Pe=null,ye=new Et(0,0,Ve,ee),Oe=new Et(0,0,Ve,ee),Qe=!1,ae=new As,ue=!1,se=!1,oe=new Ne,de=new D,xe=new Et,Me={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},Q=!1;function qe(){return F===null?ie:1}let B=n;function rt(T,V){return t.getContext(T,V)}let nt,P,y,W,Y,te,me,ve,re,le,Ee,ke,be,_e,ze,Xe,Ke,H,we,ce,Ae,De,N;try{let T={alpha:!0,depth:s,stencil:r,antialias:o,premultipliedAlpha:c,preserveDrawingBuffer:l,powerPreference:h,failIfMajorPerformanceCaveat:u};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${"186"}`),t.addEventListener("webglcontextlost",Se,!1),t.addEventListener("webglcontextrestored",Le,!1),t.addEventListener("webglcontextcreationerror",Ze,!1),B===null){let V="webgl2";if(B=rt(V,T),B===null)throw rt(V)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}Z()}catch(T){throw t.removeEventListener("webglcontextlost",Se,!1),t.removeEventListener("webglcontextrestored",Le,!1),t.removeEventListener("webglcontextcreationerror",Ze,!1),Je("WebGLRenderer: "+T.message),T}function Z(){nt=new pg(B),nt.init(),Ae=new ex(B,nt),P=new sg(B,nt,e,Ae),y=new $_(B,nt),P.reversedDepthBuffer&&d&&y.buffers.depth.setReversed(!0),z=B.createFramebuffer(),O=B.createFramebuffer(),k=B.createFramebuffer(),W=new _g(B),Y=new B_,te=new Q_(B,nt,y,Y,P,Ae,W),me=new fg(C),ve=new vp(B),De=new ng(B,ve),re=new mg(B,ve,W,De),le=new vg(B,re,ve,De,W),H=new xg(B,P,te),ze=new rg(Y),Ee=new O_(C,me,nt,P,De,ze),ke=new sx(C,Y),be=new V_,_e=new q_(nt),Ke=new tg(C,me,y,le,p,c),Xe=new K_(C,le,P),N=new rx(B,W,P,y),we=new ig(B,nt,W),ce=new gg(B,nt,W),W.programs=Ee.programs,C.capabilities=P,C.extensions=nt,C.properties=Y,C.renderLists=be,C.shadowMap=Xe,C.state=y,C.info=W}_!==tn&&(w=new Mg(_,t.width,t.height,o,s,r));let $=new ah(C,B);this.xr=$,this.getContext=function(){return B},this.getContextAttributes=function(){return B.getContextAttributes()},this.forceContextLoss=function(){let T=nt.get("WEBGL_lose_context");T&&T.loseContext()},this.forceContextRestore=function(){let T=nt.get("WEBGL_lose_context");T&&T.restoreContext()},this.getPixelRatio=function(){return ie},this.setPixelRatio=function(T){T!==void 0&&(ie=T,this.setSize(Ve,ee,!1))},this.getSize=function(T){return T.set(Ve,ee)},this.setSize=function(T,V,ne=!0){if($.isPresenting){je("WebGLRenderer: Can't change size while VR device is presenting.");return}Ve=T,ee=V,t.width=Math.floor(T*ie),t.height=Math.floor(V*ie),ne===!0&&(t.style.width=T+"px",t.style.height=V+"px"),w!==null&&w.setSize(t.width,t.height),this.setViewport(0,0,T,V)},this.getDrawingBufferSize=function(T){return T.set(Ve*ie,ee*ie).floor()},this.setDrawingBufferSize=function(T,V,ne){Ve=T,ee=V,ie=ne,t.width=Math.floor(T*ne),t.height=Math.floor(V*ne),this.setViewport(0,0,T,V)},this.setEffects=function(T){if(_===tn){Je("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(T){for(let V=0;V<T.length;V++)if(T[V].isOutputPass===!0){je("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}w.setEffects(T||[])},this.getCurrentViewport=function(T){return T.copy(X)},this.getViewport=function(T){return T.copy(ye)},this.setViewport=function(T,V,ne,J){T.isVector4?ye.set(T.x,T.y,T.z,T.w):ye.set(T,V,ne,J),y.viewport(X.copy(ye).multiplyScalar(ie).round())},this.getScissor=function(T){return T.copy(Oe)},this.setScissor=function(T,V,ne,J){T.isVector4?Oe.set(T.x,T.y,T.z,T.w):Oe.set(T,V,ne,J),y.scissor(he.copy(Oe).multiplyScalar(ie).round())},this.getScissorTest=function(){return Qe},this.setScissorTest=function(T){y.setScissorTest(Qe=T)},this.setOpaqueSort=function(T){fe=T},this.setTransparentSort=function(T){Pe=T},this.getClearColor=function(T){return T.copy(Ke.getClearColor())},this.setClearColor=function(){Ke.setClearColor(...arguments)},this.getClearAlpha=function(){return Ke.getClearAlpha()},this.setClearAlpha=function(){Ke.setClearAlpha(...arguments)},this.clear=function(T=!0,V=!0,ne=!0){let J=0;if(T){let K=!1;if(F!==null){let Ie=F.texture.format;K=m.has(Ie)}if(K){let Ie=F.texture.type,Be=g.has(Ie),Re=Ke.getClearColor(),He=Ke.getClearAlpha(),We=Re.r,ot=Re.g,ht=Re.b;Be?(S[0]=We,S[1]=ot,S[2]=ht,S[3]=He,B.clearBufferuiv(B.COLOR,0,S)):(A[0]=We,A[1]=ot,A[2]=ht,A[3]=He,B.clearBufferiv(B.COLOR,0,A))}else J|=B.COLOR_BUFFER_BIT}V&&(J|=B.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),ne&&(J|=B.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),J!==0&&B.clear(J)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(T){T.setRenderer(this),U=T},this.dispose=function(){t.removeEventListener("webglcontextlost",Se,!1),t.removeEventListener("webglcontextrestored",Le,!1),t.removeEventListener("webglcontextcreationerror",Ze,!1),Ke.dispose(),be.dispose(),_e.dispose(),Y.dispose(),me.dispose(),le.dispose(),De.dispose(),N.dispose(),Ee.dispose(),$.dispose(),$.removeEventListener("sessionstart",ga),$.removeEventListener("sessionend",_a),Kn.stop()};function Se(T){T.preventDefault(),Nc("WebGLRenderer: Context Lost."),I=!0}function Le(){Nc("WebGLRenderer: Context Restored."),I=!1;let T=W.autoReset,V=Xe.enabled,ne=Xe.autoUpdate,J=Xe.needsUpdate,K=Xe.type;Z(),W.autoReset=T,Xe.enabled=V,Xe.autoUpdate=ne,Xe.needsUpdate=J,Xe.type=K}function Ze(T){Je("WebGLRenderer: A WebGL context could not be created. Reason: ",T.statusMessage)}function $e(T){let V=T.target;V.removeEventListener("dispose",$e),et(V)}function et(T){Tt(T),Y.remove(T)}function Tt(T){let V=Y.get(T).programs;V!==void 0&&(V.forEach(function(ne){Ee.releaseProgram(ne)}),T.isShaderMaterial&&Ee.releaseShaderCache(T))}this.renderBufferDirect=function(T,V,ne,J,K,Ie){V===null&&(V=Me);let Be=K.isMesh&&K.matrixWorld.determinantAffine()<0,Re=zd(T,V,ne,J,K);y.setMaterial(J,Be);let He=ne.index,We=1;if(J.wireframe===!0){if(He=re.getWireframeAttribute(ne),He===void 0)return;We=2}let ot=ne.drawRange,ht=ne.attributes.position,Ge=ot.start*We,mt=(ot.start+ot.count)*We;Ie!==null&&(Ge=Math.max(Ge,Ie.start*We),mt=Math.min(mt,(Ie.start+Ie.count)*We)),He!==null?(Ge=Math.max(Ge,0),mt=Math.min(mt,He.count)):ht!=null&&(Ge=Math.max(Ge,0),mt=Math.min(mt,ht.count));let Ut=mt-Ge;if(Ut<0||Ut===1/0)return;De.setup(K,J,Re,ne,He);let St,yt=we;if(He!==null&&(St=ve.get(He),yt=ce,yt.setIndex(St)),K.isMesh)J.wireframe===!0?(y.setLineWidth(J.wireframeLinewidth*qe()),yt.setMode(B.LINES)):yt.setMode(B.TRIANGLES);else if(K.isLine){let Kt=J.linewidth;Kt===void 0&&(Kt=1),y.setLineWidth(Kt*qe()),K.isLineSegments?yt.setMode(B.LINES):K.isLineLoop?yt.setMode(B.LINE_LOOP):yt.setMode(B.LINE_STRIP)}else K.isPoints?yt.setMode(B.POINTS):K.isSprite&&yt.setMode(B.TRIANGLES);if(K.isBatchedMesh)if(nt.get("WEBGL_multi_draw"))yt.renderMultiDraw(K._multiDrawStarts,K._multiDrawCounts,K._multiDrawCount);else{let Kt=K._multiDrawStarts,Ue=K._multiDrawCounts,rn=K._multiDrawCount,dt=He?ve.get(He).bytesPerElement:1,bn=Y.get(J).currentProgram.getUniforms();for(let zn=0;zn<rn;zn++)bn.setValue(B,"_gl_DrawID",zn),yt.render(Kt[zn]/dt,Ue[zn])}else if(K.isInstancedMesh)yt.renderInstances(Ge,Ut,K.count);else if(ne.isInstancedBufferGeometry){let Kt=ne._maxInstanceCount!==void 0?ne._maxInstanceCount:1/0,Ue=Math.min(ne.instanceCount,Kt);yt.renderInstances(Ge,Ut,Ue)}else yt.render(Ge,Ut)};function it(T,V,ne,J){U!==null&&T.isNodeMaterial&&U.setObject(J,T),ue===!0&&ze.setState(T,ne,!1),T.transparent===!0&&T.side===yn&&T.forceSinglePass===!1?(T.side=Zt,T.needsUpdate=!0,ya(T,V,J),T.side=Si,T.needsUpdate=!0,ya(T,V,J),T.side=yn):ya(T,V,J)}this.compile=function(T,V,ne=null){ne===null&&(ne=T),U!==null&&U.renderStart(T,V,ne),v=_e.get(ne),v.init(V),x.push(v),ne.traverseVisible(function(K){K.isLight&&K.layers.test(V.layers)&&(v.pushLight(K),K.castShadow&&v.pushShadow(K))}),T!==ne&&T.traverseVisible(function(K){K.isLight&&K.layers.test(V.layers)&&(v.pushLight(K),K.castShadow&&v.pushShadow(K))}),v.setupLights(),U!==null&&U.updateLights(v.state.lightsArray),se=this.localClippingEnabled,ue=ze.init(this.clippingPlanes,se),ue===!0&&ze.setGlobalState(this.clippingPlanes,V),U!==null&&Xe.render(v.state.shadowsArray,ne,V);let J=new Set;return T.traverse(function(K){if(!(K.isMesh||K.isPoints||K.isLine||K.isSprite))return;let Ie=K.material;if(Ie)if(Array.isArray(Ie))for(let Be=0;Be<Ie.length;Be++){let Re=Ie[Be];it(Re,ne,V,K),J.add(Re)}else it(Ie,ne,V,K),J.add(Ie)}),v=x.pop(),U!==null&&U.renderEnd(),J},this.compileAsync=function(T,V,ne=null){let J=this.compile(T,V,ne);return new Promise(K=>{function Ie(){if(J.forEach(function(Be){let He=Y.get(Be).currentProgram;(He===void 0||He.isReady())&&J.delete(Be)}),J.size===0){K(T);return}setTimeout(Ie,10)}nt.get("KHR_parallel_shader_compile")!==null?Ie():setTimeout(Ie,10)})};let sn=null;function Zs(T){sn&&sn(T)}function ga(){Kn.stop()}function _a(){Kn.start()}let Kn=new ud;Kn.setAnimationLoop(Zs),typeof self!="undefined"&&Kn.setContext(self),this.setAnimationLoop=function(T){sn=T,$.setAnimationLoop(T),T===null?Kn.stop():Kn.start()},$.addEventListener("sessionstart",ga),$.addEventListener("sessionend",_a),this.render=function(T,V){if(V!==void 0&&V.isCamera!==!0){Je("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(I===!0)return;U!==null&&U.renderStart(T,V);let ne=$.enabled===!0&&$.isPresenting===!0,J=w!==null&&(F===null||ne)&&w.begin(C,F);if(T.matrixWorldAutoUpdate===!0&&T.updateMatrixWorld(),V.parent===null&&V.matrixWorldAutoUpdate===!0&&V.updateMatrixWorld(),$.enabled===!0&&$.isPresenting===!0&&(w===null||w.isCompositing()===!1)&&($.cameraAutoUpdate===!0&&$.updateCamera(V),V=$.getCamera()),T.isScene===!0&&T.onBeforeRender(C,T,V,F),v=_e.get(T,x.length),v.init(V),v.state.textureUnits=te.getTextureUnits(),x.push(v),oe.multiplyMatrices(V.projectionMatrix,V.matrixWorldInverse),ae.setFromProjectionMatrix(oe,Nn,V.reversedDepth),se=this.localClippingEnabled,ue=ze.init(this.clippingPlanes,se),E=be.get(T,b.length),E.init(),b.push(E),$.enabled===!0&&$.isPresenting===!0){let Be=C.xr.getDepthSensingMesh();Be!==null&&Qi(Be,V,-1/0,C.sortObjects)}Qi(T,V,0,C.sortObjects),E.finish(),U!==null&&U.updateLights(v.state.lightsArray),C.sortObjects===!0&&E.sort(fe,Pe),Q=$.enabled===!1||$.isPresenting===!1||$.hasDepthSensing()===!1,Q&&Ke.addToRenderList(E,T),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),ue===!0&&ze.beginShadows();let K=v.state.shadowsArray;if(Xe.render(K,T,V),ue===!0&&ze.endShadows(),(J&&w.hasRenderPass())===!1){let Be=E.opaque,Re=E.transmissive;if(v.setupLights(),V.isArrayCamera){let He=V.cameras;if(Re.length>0)for(let We=0,ot=He.length;We<ot;We++){let ht=He[We];Ri(Be,Re,T,ht)}Q&&Ke.render(T);for(let We=0,ot=He.length;We<ot;We++){let ht=He[We];xa(E,T,ht,ht.viewport)}}else Re.length>0&&Ri(Be,Re,T,V),Q&&Ke.render(T),xa(E,T,V)}F!==null&&R===0&&(te.updateMultisampleRenderTarget(F),te.updateRenderTargetMipmap(F)),J&&w.end(C),T.isScene===!0&&T.onAfterRender(C,T,V),De.resetDefaultState(),G=-1,q=null,x.pop(),x.length>0?(v=x[x.length-1],te.setTextureUnits(v.state.textureUnits),ue===!0&&ze.setGlobalState(C.clippingPlanes,v.state.camera)):v=null,b.pop(),b.length>0?E=b[b.length-1]:E=null,U!==null&&U.renderEnd()};function Qi(T,V,ne,J){if(T.visible===!1)return;if(T.layers.test(V.layers)){if(T.isGroup)ne=T.renderOrder;else if(T.isLOD)T.autoUpdate===!0&&T.update(V);else if(T.isLightProbeGrid)v.pushLightProbeGrid(T);else if(T.isLight)v.pushLight(T),T.castShadow&&v.pushShadow(T);else if(T.isSprite){if(!T.frustumCulled||T.intersectsFrustum(ae)){J&&xe.setFromMatrixPosition(T.matrixWorld).applyMatrix4(oe);let Be=le.update(T),Re=T.material;Re.visible&&E.push(T,Be,Re,ne,xe.z,null,V)}}else if((T.isMesh||T.isLine||T.isPoints)&&(!T.frustumCulled||T.intersectsFrustum(ae))){let Be=le.update(T),Re=T.material;if(J&&(T.boundingSphere!==void 0?(T.boundingSphere===null&&T.computeBoundingSphere(),xe.copy(T.boundingSphere.center)):(Be.boundingSphere===null&&Be.computeBoundingSphere(),xe.copy(Be.boundingSphere.center)),xe.applyMatrix4(T.matrixWorld).applyMatrix4(oe)),Array.isArray(Re)){let He=Be.groups;for(let We=0,ot=He.length;We<ot;We++){let ht=He[We],Ge=Re[ht.materialIndex];Ge&&Ge.visible&&E.push(T,Be,Ge,ne,xe.z,ht,V)}}else Re.visible&&E.push(T,Be,Re,ne,xe.z,null,V)}}let Ie=T.children;for(let Be=0,Re=Ie.length;Be<Re;Be++)Qi(Ie[Be],V,ne,J)}function xa(T,V,ne,J){let{opaque:K,transmissive:Ie,transparent:Be}=T;v.setupLightsView(ne),ue===!0&&ze.setGlobalState(C.clippingPlanes,ne),J&&y.viewport(X.copy(J)),K.length>0&&va(K,V,ne),Ie.length>0&&va(Ie,V,ne),Be.length>0&&va(Be,V,ne),y.buffers.depth.setTest(!0),y.buffers.depth.setMask(!0),y.buffers.color.setMask(!0),y.setPolygonOffset(!1)}function Ri(T,V,ne,J){if((ne.isScene===!0?ne.overrideMaterial:null)!==null)return;if(v.state.transmissionRenderTarget[J.id]===void 0){let Ge=nt.has("EXT_color_buffer_half_float")||nt.has("EXT_color_buffer_float");v.state.transmissionRenderTarget[J.id]=new Ct(1,1,{generateMipmaps:!0,type:Ge?Vt:tn,minFilter:Ei,samples:Math.max(4,P.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:ct.workingColorSpace})}let Ie=v.state.transmissionRenderTarget[J.id],Be=J.viewport||X;Ie.setSize(Be.z*C.transmissionResolutionScale,Be.w*C.transmissionResolutionScale);let Re=C.getRenderTarget(),He=C.getActiveCubeFace(),We=C.getActiveMipmapLevel();C.setRenderTarget(Ie),C.getClearColor(Fe),Te=C.getClearAlpha(),Te<1&&C.setClearColor(16777215,.5),C.clear(),Q&&Ke.render(ne);let ot=C.toneMapping;C.toneMapping=Fn;let ht=J.viewport;if(J.viewport!==void 0&&(J.viewport=void 0),v.setupLightsView(J),ue===!0&&ze.setGlobalState(C.clippingPlanes,J),va(T,ne,J),te.updateMultisampleRenderTarget(Ie),te.updateRenderTargetMipmap(Ie),nt.has("WEBGL_multisampled_render_to_texture")===!1){let Ge=!1;for(let mt=0,Ut=V.length;mt<Ut;mt++){let St=V[mt],{object:yt,geometry:Kt,material:Ue,group:rn}=St;if(Ue.side===yn&&yt.layers.test(J.layers)){let dt=Ue.side;Ue.side=Zt,Ue.needsUpdate=!0,yh(yt,ne,J,Kt,Ue,rn),Ue.side=dt,Ue.needsUpdate=!0,Ge=!0}}Ge===!0&&(te.updateMultisampleRenderTarget(Ie),te.updateRenderTargetMipmap(Ie))}C.setRenderTarget(Re,He,We),C.setClearColor(Fe,Te),ht!==void 0&&(J.viewport=ht),C.toneMapping=ot}function va(T,V,ne){let J=V.isScene===!0?V.overrideMaterial:null;for(let K=0,Ie=T.length;K<Ie;K++){let Be=T[K],{object:Re,geometry:He,group:We}=Be,ot=Be.material;ot.allowOverride===!0&&J!==null&&(ot=J),Re.layers.test(ne.layers)&&yh(Re,V,ne,He,ot,We)}}function yh(T,V,ne,J,K,Ie){U!==null&&K.isNodeMaterial&&U.setObject(T,K),T.onBeforeRender(C,V,ne,J,K,Ie),T.modelViewMatrix.multiplyMatrices(ne.matrixWorldInverse,T.matrixWorld),T.normalMatrix.getNormalMatrix(T.modelViewMatrix),K.onBeforeRender(C,V,ne,J,T,Ie),K.transparent===!0&&K.side===yn&&K.forceSinglePass===!1?(K.side=Zt,K.needsUpdate=!0,C.renderBufferDirect(ne,V,J,K,T,Ie),K.side=Si,K.needsUpdate=!0,C.renderBufferDirect(ne,V,J,K,T,Ie),K.side=yn):C.renderBufferDirect(ne,V,J,K,T,Ie),T.onAfterRender(C,V,ne,J,K,Ie)}function ya(T,V,ne){V.isScene!==!0&&(V=Me);let J=Y.get(T),K=v.state.lights,Ie=v.state.shadowsArray,Be=K.state.version,Re=Ee.getParameters(T,K.state,Ie,V,ne,v.state.lightProbeGridArray),He=Ee.getProgramCacheKey(Re),We=J.programs;J.environment=T.isMeshStandardMaterial||T.isMeshLambertMaterial||T.isMeshPhongMaterial?V.environment:null,J.fog=V.fog;let ot=T.isMeshStandardMaterial||T.isMeshLambertMaterial&&!T.envMap||T.isMeshPhongMaterial&&!T.envMap;J.envMap=me.get(T.envMap||J.environment,ot),J.envMapRotation=J.environment!==null&&T.envMap===null?V.environmentRotation:T.envMapRotation,We===void 0&&(T.addEventListener("dispose",$e),We=new Map,J.programs=We);let ht=We.get(He);if(ht!==void 0){if(J.currentProgram===ht&&J.lightsStateVersion===Be)return Sh(T,Re),ht}else Re.uniforms=Ee.getUniforms(T),U!==null&&T.isNodeMaterial&&U.build(T,ne,Re),T.onBeforeCompile(Re,C),ht=Ee.acquireProgram(Re,He),We.set(He,ht),J.uniforms=Re.uniforms;let Ge=J.uniforms;return(!T.isShaderMaterial&&!T.isRawShaderMaterial||T.clipping===!0)&&(Ge.clippingPlanes=ze.uniform),Sh(T,Re),J.needsLights=kd(T),J.lightsStateVersion=Be,J.needsLights&&(Ge.ambientLightColor.value=K.state.ambient,Ge.lightProbe.value=K.state.probe,Ge.sunLights.value=K.state.sun,Ge.sunLightShadows.value=K.state.sunShadow,Ge.directionalLights.value=K.state.directional,Ge.directionalLightShadows.value=K.state.directionalShadow,Ge.spotLights.value=K.state.spot,Ge.spotLightShadows.value=K.state.spotShadow,Ge.rectAreaLights.value=K.state.rectArea,Ge.ltc_1.value=K.state.rectAreaLTC1,Ge.ltc_2.value=K.state.rectAreaLTC2,Ge.pointLights.value=K.state.point,Ge.pointLightShadows.value=K.state.pointShadow,Ge.hemisphereLights.value=K.state.hemi,Ge.sunShadowMatrix.value=K.state.sunShadowMatrix,Ge.sunShadowCascade.value=K.state.sunShadowCascade,Ge.directionalShadowMatrix.value=K.state.directionalShadowMatrix,Ge.spotLightMatrix.value=K.state.spotLightMatrix,Ge.spotLightMap.value=K.state.spotLightMap,Ge.pointShadowMatrix.value=K.state.pointShadowMatrix),J.lightProbeGrid=v.state.lightProbeGridArray.length>0,J.currentProgram=ht,J.uniformsList=null,ht}function Mh(T){if(T.uniformsList===null){let V=T.currentProgram.getUniforms();T.uniformsList=ks.seqWithValue(V.seq,T.uniforms)}return T.uniformsList}function Sh(T,V){let ne=Y.get(T);ne.outputColorSpace=V.outputColorSpace,ne.batching=V.batching,ne.batchingColor=V.batchingColor,ne.instancing=V.instancing,ne.instancingColor=V.instancingColor,ne.instancingMorph=V.instancingMorph,ne.skinning=V.skinning,ne.morphTargets=V.morphTargets,ne.morphNormals=V.morphNormals,ne.morphColors=V.morphColors,ne.morphTargetsCount=V.morphTargetsCount,ne.numClippingPlanes=V.numClippingPlanes,ne.numIntersection=V.numClipIntersection,ne.vertexAlphas=V.vertexAlphas,ne.vertexTangents=V.vertexTangents,ne.toneMapping=V.toneMapping}function Bd(T,V){if(T.length===0)return null;if(T.length===1)return T[0].texture!==null?T[0]:null;M.setFromMatrixPosition(V.matrixWorld);for(let ne=0,J=T.length;ne<J;ne++){let K=T[ne];if(K.texture!==null&&K.boundingBox.containsPoint(M))return K}return null}function zd(T,V,ne,J,K){V.isScene!==!0&&(V=Me),te.resetTextureUnits();let Ie=V.fog,Be=J.isMeshStandardMaterial||J.isMeshLambertMaterial||J.isMeshPhongMaterial?V.environment:null,Re=F===null?C.outputColorSpace:F.isXRRenderTarget===!0?F.texture.colorSpace:ct.workingColorSpace,He=J.isMeshStandardMaterial||J.isMeshLambertMaterial&&!J.envMap||J.isMeshPhongMaterial&&!J.envMap,We=me.get(J.envMap||Be,He),ot=J.vertexColors===!0&&!!ne.attributes.color&&ne.attributes.color.itemSize===4,ht=!!ne.attributes.tangent&&(!!J.normalMap||J.anisotropy>0),Ge=!!ne.morphAttributes.position,mt=!!ne.morphAttributes.normal,Ut=!!ne.morphAttributes.color,St=Fn;J.toneMapped&&(F===null||F.isXRRenderTarget===!0)&&(St=C.toneMapping);let yt=ne.morphAttributes.position||ne.morphAttributes.normal||ne.morphAttributes.color,Kt=yt!==void 0?yt.length:0,Ue=Y.get(J),rn=v.state.lights;if(ue===!0&&(se===!0||T!==q)){let Mt=T===q&&J.id===G;ze.setState(J,T,Mt)}let dt=!1;J.version===Ue.__version?(Ue.needsLights&&Ue.lightsStateVersion!==rn.state.version||Ue.outputColorSpace!==Re||K.isBatchedMesh&&Ue.batching===!1||!K.isBatchedMesh&&Ue.batching===!0||K.isBatchedMesh&&Ue.batchingColor===!0&&K._colorsTexture===null||K.isBatchedMesh&&Ue.batchingColor===!1&&K._colorsTexture!==null||K.isInstancedMesh&&Ue.instancing===!1||!K.isInstancedMesh&&Ue.instancing===!0||K.isSkinnedMesh&&Ue.skinning===!1||!K.isSkinnedMesh&&Ue.skinning===!0||K.isInstancedMesh&&Ue.instancingColor===!0&&K.instanceColor===null||K.isInstancedMesh&&Ue.instancingColor===!1&&K.instanceColor!==null||K.isInstancedMesh&&Ue.instancingMorph===!0&&K.morphTexture===null||K.isInstancedMesh&&Ue.instancingMorph===!1&&K.morphTexture!==null||Ue.envMap!==We||J.fog===!0&&Ue.fog!==Ie||Ue.numClippingPlanes!==void 0&&(Ue.numClippingPlanes!==ze.numPlanes||Ue.numIntersection!==ze.numIntersection)||Ue.vertexAlphas!==ot||Ue.vertexTangents!==ht||Ue.morphTargets!==Ge||Ue.morphNormals!==mt||Ue.morphColors!==Ut||Ue.toneMapping!==St||Ue.morphTargetsCount!==Kt||!!Ue.lightProbeGrid!=v.state.lightProbeGridArray.length>0)&&(dt=!0):(dt=!0,Ue.__version=J.version);let bn=Ue.currentProgram;dt===!0&&(bn=ya(J,V,K),U&&J.isNodeMaterial&&U.onUpdateProgram(J,bn,Ue));let zn=!1,oi=!1,es=!1,vt=bn.getUniforms(),It=Ue.uniforms;if(y.useProgram(bn.program)&&(zn=!0,oi=!0,es=!0),J.id!==G&&(G=J.id,oi=!0),Ue.needsLights){let Mt=Bd(v.state.lightProbeGridArray,K);Ue.lightProbeGrid!==Mt&&(Ue.lightProbeGrid=Mt,oi=!0)}if(zn||q!==T){y.buffers.depth.getReversed()&&T.reversedDepth!==!0&&(T._reversedDepth=!0,T.updateProjectionMatrix()),vt.setValue(B,"projectionMatrix",T.projectionMatrix),vt.setValue(B,"viewMatrix",T.matrixWorldInverse);let ci=vt.map.cameraPosition;ci!==void 0&&ci.setValue(B,de.setFromMatrixPosition(T.matrixWorld)),P.logarithmicDepthBuffer&&vt.setValue(B,"logDepthBufFC",2/(Math.log(T.far+1)/Math.LN2)),(J.isMeshPhongMaterial||J.isMeshToonMaterial||J.isMeshLambertMaterial||J.isMeshBasicMaterial||J.isMeshStandardMaterial||J.isShaderMaterial)&&vt.setValue(B,"isOrthographic",T.isOrthographicCamera===!0),q!==T&&(q=T,oi=!0,es=!0)}if(Ue.needsLights&&(rn.state.sunShadowMap.length>0&&vt.setValue(B,"sunShadowMap",rn.state.sunShadowMap,te),rn.state.directionalShadowMap.length>0&&vt.setValue(B,"directionalShadowMap",rn.state.directionalShadowMap,te),rn.state.spotShadowMap.length>0&&vt.setValue(B,"spotShadowMap",rn.state.spotShadowMap,te),rn.state.pointShadowMap.length>0&&vt.setValue(B,"pointShadowMap",rn.state.pointShadowMap,te)),K.isSkinnedMesh){vt.setOptional(B,K,"bindMatrix"),vt.setOptional(B,K,"bindMatrixInverse");let Mt=K.skeleton;Mt&&(Mt.boneTexture===null&&Mt.computeBoneTexture(),vt.setValue(B,"boneTexture",Mt.boneTexture,te))}K.isBatchedMesh&&(vt.setOptional(B,K,"batchingTexture"),vt.setValue(B,"batchingTexture",K._matricesTexture,te),vt.setOptional(B,K,"batchingIdTexture"),vt.setValue(B,"batchingIdTexture",K._indirectTexture,te),vt.setOptional(B,K,"batchingColorTexture"),K._colorsTexture!==null&&vt.setValue(B,"batchingColorTexture",K._colorsTexture,te));let li=ne.morphAttributes;if((li.position!==void 0||li.normal!==void 0||li.color!==void 0)&&H.update(K,ne,bn),(oi||Ue.receiveShadow!==K.receiveShadow)&&(Ue.receiveShadow=K.receiveShadow,vt.setValue(B,"receiveShadow",K.receiveShadow)),(J.isMeshStandardMaterial||J.isMeshLambertMaterial||J.isMeshPhongMaterial)&&J.envMap===null&&V.environment!==null&&(It.envMapIntensity.value=V.environmentIntensity),It.dfgLUT!==void 0&&(It.dfgLUT.value=ox()),oi){if(vt.setValue(B,"toneMappingExposure",C.toneMappingExposure),Ue.needsLights&&Vd(It,es),Ie&&J.fog===!0&&ke.refreshFogUniforms(It,Ie),ke.refreshMaterialUniforms(It,J,ie,ee,v.state.transmissionRenderTarget[T.id]),Ue.needsLights&&Ue.lightProbeGrid){let Mt=Ue.lightProbeGrid;It.probesSH.value=Mt.texture,It.probesMin.value.copy(Mt.boundingBox.min),It.probesMax.value.copy(Mt.boundingBox.max),It.probesResolution.value.copy(Mt.resolution)}ks.upload(B,Mh(Ue),It,te)}if(J.isShaderMaterial&&J.uniformsNeedUpdate===!0&&(ks.upload(B,Mh(Ue),It,te),J.uniformsNeedUpdate=!1),J.isSpriteMaterial&&vt.setValue(B,"center",K.center),vt.setValue(B,"modelViewMatrix",K.modelViewMatrix),vt.setValue(B,"normalMatrix",K.normalMatrix),vt.setValue(B,"modelMatrix",K.matrixWorld),J.uniformsGroups!==void 0){let Mt=J.uniformsGroups;for(let ci=0,ts=Mt.length;ci<ts;ci++){let Eh=Mt[ci];N.update(Eh,bn),N.bind(Eh,bn)}}return bn}function Vd(T,V){T.ambientLightColor.needsUpdate=V,T.lightProbe.needsUpdate=V,T.sunLights.needsUpdate=V,T.sunLightShadows.needsUpdate=V,T.directionalLights.needsUpdate=V,T.directionalLightShadows.needsUpdate=V,T.pointLights.needsUpdate=V,T.pointLightShadows.needsUpdate=V,T.spotLights.needsUpdate=V,T.spotLightShadows.needsUpdate=V,T.rectAreaLights.needsUpdate=V,T.hemisphereLights.needsUpdate=V}function kd(T){return T.isMeshLambertMaterial||T.isMeshToonMaterial||T.isMeshPhongMaterial||T.isMeshStandardMaterial||T.isShadowMaterial||T.isShaderMaterial&&T.lights===!0}this.getActiveCubeFace=function(){return j},this.getActiveMipmapLevel=function(){return R},this.getRenderTarget=function(){return F},this.setRenderTargetTextures=function(T,V,ne){let J=Y.get(T);J.__autoAllocateDepthBuffer=T.resolveDepthBuffer===!1,J.__autoAllocateDepthBuffer===!1&&(J.__useRenderToTexture=!1),Y.get(T.texture).__webglTexture=V,Y.get(T.depthTexture).__webglTexture=J.__autoAllocateDepthBuffer?void 0:ne,J.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(T,V){let ne=Y.get(T);ne.__webglFramebuffer=V,ne.__useDefaultFramebuffer=V===void 0},this.setRenderTarget=function(T,V=0,ne=0){F=T,j=V,R=ne;let J=null,K=!1,Ie=!1;if(T){let Re=Y.get(T);if(Re.__useDefaultFramebuffer!==void 0){y.bindFramebuffer(B.FRAMEBUFFER,Re.__webglFramebuffer),X.copy(T.viewport),he.copy(T.scissor),ge=T.scissorTest,y.viewport(X),y.scissor(he),y.setScissorTest(ge),G=-1;return}else if(Re.__webglFramebuffer===void 0)te.setupRenderTarget(T);else if(Re.__hasExternalTextures)te.rebindTextures(T,Y.get(T.texture).__webglTexture,Y.get(T.depthTexture).__webglTexture);else if(T.depthBuffer){let ot=T.depthTexture;if(Re.__boundDepthTexture!==ot){if(ot!==null&&Y.has(ot)&&(T.width!==ot.image.width||T.height!==ot.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");te.setupDepthRenderbuffer(T)}}let He=T.texture;(He.isData3DTexture||He.isDataArrayTexture||He.isCompressedArrayTexture)&&(Ie=!0);let We=Y.get(T).__webglFramebuffer;T.isWebGLCubeRenderTarget?(Array.isArray(We[V])?J=We[V][ne]:J=We[V],K=!0):T.samples>0&&te.useMultisampledRTT(T)===!1?J=Y.get(T).__webglMultisampledFramebuffer:Array.isArray(We)?J=We[ne]:J=We,X.copy(T.viewport),he.copy(T.scissor),ge=T.scissorTest}else X.copy(ye).multiplyScalar(ie).floor(),he.copy(Oe).multiplyScalar(ie).floor(),ge=Qe;if(ne!==0&&(J=z),y.bindFramebuffer(B.FRAMEBUFFER,J)&&y.drawBuffers(T,J),y.viewport(X),y.scissor(he),y.setScissorTest(ge),K){let Re=Y.get(T.texture);B.framebufferTexture2D(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_CUBE_MAP_POSITIVE_X+V,Re.__webglTexture,ne)}else if(Ie){let Re=V;for(let He=0;He<T.textures.length;He++){let We=Y.get(T.textures[He]);B.framebufferTextureLayer(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0+He,We.__webglTexture,ne,Re)}}else if(T!==null&&ne!==0){let Re=Y.get(T.texture);B.framebufferTexture2D(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_2D,Re.__webglTexture,ne)}G=-1};function bh(T){let V=Y.get(T);return(V.__readFormat!==T.format||V.__readType!==T.type)&&(V.__readFormat=T.format,V.__readType=T.type,V.__formatReadable=P.textureFormatReadable(T.format),V.__typeReadable=P.textureTypeReadable(T.type)),V}this.readRenderTargetPixels=function(T,V,ne,J,K,Ie,Be,Re=0){if(!(T&&T.isWebGLRenderTarget)){Je("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let He=Y.get(T).__webglFramebuffer;if(T.isWebGLCubeRenderTarget&&Be!==void 0&&(He=He[Be]),He){y.bindFramebuffer(B.FRAMEBUFFER,He);try{let We=T.textures[Re],ot=We.format,ht=We.type;T.textures.length>1&&B.readBuffer(B.COLOR_ATTACHMENT0+Re);let Ge=bh(We);if(Ge.__formatReadable===!1){Je("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(Ge.__typeReadable===!1){Je("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}V>=0&&V<=T.width-J&&ne>=0&&ne<=T.height-K&&B.readPixels(V,ne,J,K,Ae.convert(ot),Ae.convert(ht),Ie)}finally{let We=F!==null?Y.get(F).__webglFramebuffer:null;y.bindFramebuffer(B.FRAMEBUFFER,We)}}},this.readRenderTargetPixelsAsync=async function(T,V,ne,J,K,Ie,Be,Re=0){if(!(T&&T.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let He=Y.get(T).__webglFramebuffer;if(T.isWebGLCubeRenderTarget&&Be!==void 0&&(He=He[Be]),He)if(V>=0&&V<=T.width-J&&ne>=0&&ne<=T.height-K){y.bindFramebuffer(B.FRAMEBUFFER,He);let We=T.textures[Re],ot=We.format,ht=We.type;T.textures.length>1&&B.readBuffer(B.COLOR_ATTACHMENT0+Re);let Ge=bh(We);if(Ge.__formatReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(Ge.__typeReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let mt=B.createBuffer();B.bindBuffer(B.PIXEL_PACK_BUFFER,mt),B.bufferData(B.PIXEL_PACK_BUFFER,Ie.byteLength,B.STREAM_READ),B.readPixels(V,ne,J,K,Ae.convert(ot),Ae.convert(ht),0),B.bindBuffer(B.PIXEL_PACK_BUFFER,null);let Ut=F!==null?Y.get(F).__webglFramebuffer:null;y.bindFramebuffer(B.FRAMEBUFFER,Ut);let St=B.fenceSync(B.SYNC_GPU_COMMANDS_COMPLETE,0);return B.flush(),await Uu(B,St,4),B.bindBuffer(B.PIXEL_PACK_BUFFER,mt),B.getBufferSubData(B.PIXEL_PACK_BUFFER,0,Ie),B.bindBuffer(B.PIXEL_PACK_BUFFER,null),B.deleteBuffer(mt),B.deleteSync(St),Ie}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(T,V=null,ne=0){let J=Math.pow(2,-ne),K=Math.floor(T.image.width*J),Ie=Math.floor(T.image.height*J),Be=V!==null?V.x:0,Re=V!==null?V.y:0;te.setTexture2D(T,0),B.copyTexSubImage2D(B.TEXTURE_2D,ne,0,0,Be,Re,K,Ie),y.unbindTexture()},this.copyTextureToTexture=function(T,V,ne=null,J=null,K=0,Ie=0){let Be,Re,He,We,ot,ht,Ge,mt,Ut,St=T.isCompressedTexture?T.mipmaps[Ie]:T.image;if(ne!==null)Be=ne.max.x-ne.min.x,Re=ne.max.y-ne.min.y,He=ne.isBox3?ne.max.z-ne.min.z:1,We=ne.min.x,ot=ne.min.y,ht=ne.isBox3?ne.min.z:0;else{let It=Math.pow(2,-K);Be=Math.floor(St.width*It),Re=Math.floor(St.height*It),T.isDataArrayTexture?He=St.depth:T.isData3DTexture?He=Math.floor(St.depth*It):He=1,We=0,ot=0,ht=0}J!==null?(Ge=J.x,mt=J.y,Ut=J.z):(Ge=0,mt=0,Ut=0);let yt=Ae.convert(V.format),Kt=Ae.convert(V.type),Ue;V.isData3DTexture?(te.setTexture3D(V,0),Ue=B.TEXTURE_3D):V.isDataArrayTexture||V.isCompressedArrayTexture?(te.setTexture2DArray(V,0),Ue=B.TEXTURE_2D_ARRAY):(te.setTexture2D(V,0),Ue=B.TEXTURE_2D),y.activeTexture(B.TEXTURE0),y.pixelStorei(B.UNPACK_FLIP_Y_WEBGL,V.flipY),y.pixelStorei(B.UNPACK_PREMULTIPLY_ALPHA_WEBGL,V.premultiplyAlpha),y.pixelStorei(B.UNPACK_ALIGNMENT,V.unpackAlignment);let rn=y.getParameter(B.UNPACK_ROW_LENGTH),dt=y.getParameter(B.UNPACK_IMAGE_HEIGHT),bn=y.getParameter(B.UNPACK_SKIP_PIXELS),zn=y.getParameter(B.UNPACK_SKIP_ROWS),oi=y.getParameter(B.UNPACK_SKIP_IMAGES);y.pixelStorei(B.UNPACK_ROW_LENGTH,St.width),y.pixelStorei(B.UNPACK_IMAGE_HEIGHT,St.height),y.pixelStorei(B.UNPACK_SKIP_PIXELS,We),y.pixelStorei(B.UNPACK_SKIP_ROWS,ot),y.pixelStorei(B.UNPACK_SKIP_IMAGES,ht);let es=T.isDataArrayTexture||T.isData3DTexture,vt=V.isDataArrayTexture||V.isData3DTexture;if(T.isDepthTexture){let It=Y.get(T),li=Y.get(V),Mt=Y.get(It.__renderTarget),ci=Y.get(li.__renderTarget);y.bindFramebuffer(B.READ_FRAMEBUFFER,Mt.__webglFramebuffer),y.bindFramebuffer(B.DRAW_FRAMEBUFFER,ci.__webglFramebuffer);for(let ts=0;ts<He;ts++)es&&(B.framebufferTextureLayer(B.READ_FRAMEBUFFER,B.COLOR_ATTACHMENT0,Y.get(T).__webglTexture,K,ht+ts),B.framebufferTextureLayer(B.DRAW_FRAMEBUFFER,B.COLOR_ATTACHMENT0,Y.get(V).__webglTexture,Ie,Ut+ts)),B.blitFramebuffer(We,ot,Be,Re,Ge,mt,Be,Re,B.DEPTH_BUFFER_BIT,B.NEAREST);y.bindFramebuffer(B.READ_FRAMEBUFFER,null),y.bindFramebuffer(B.DRAW_FRAMEBUFFER,null)}else if(K!==0||T.isRenderTargetTexture||Y.has(T)){let It=Y.get(T),li=Y.get(V);y.bindFramebuffer(B.READ_FRAMEBUFFER,O),y.bindFramebuffer(B.DRAW_FRAMEBUFFER,k);for(let Mt=0;Mt<He;Mt++)es?B.framebufferTextureLayer(B.READ_FRAMEBUFFER,B.COLOR_ATTACHMENT0,It.__webglTexture,K,ht+Mt):B.framebufferTexture2D(B.READ_FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_2D,It.__webglTexture,K),vt?B.framebufferTextureLayer(B.DRAW_FRAMEBUFFER,B.COLOR_ATTACHMENT0,li.__webglTexture,Ie,Ut+Mt):B.framebufferTexture2D(B.DRAW_FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_2D,li.__webglTexture,Ie),K!==0?B.blitFramebuffer(We,ot,Be,Re,Ge,mt,Be,Re,B.COLOR_BUFFER_BIT,B.NEAREST):vt?B.copyTexSubImage3D(Ue,Ie,Ge,mt,Ut+Mt,We,ot,Be,Re):B.copyTexSubImage2D(Ue,Ie,Ge,mt,We,ot,Be,Re);y.bindFramebuffer(B.READ_FRAMEBUFFER,null),y.bindFramebuffer(B.DRAW_FRAMEBUFFER,null)}else vt?T.isDataTexture||T.isData3DTexture?B.texSubImage3D(Ue,Ie,Ge,mt,Ut,Be,Re,He,yt,Kt,St.data):V.isCompressedArrayTexture?B.compressedTexSubImage3D(Ue,Ie,Ge,mt,Ut,Be,Re,He,yt,St.data):B.texSubImage3D(Ue,Ie,Ge,mt,Ut,Be,Re,He,yt,Kt,St):T.isDataTexture?B.texSubImage2D(B.TEXTURE_2D,Ie,Ge,mt,Be,Re,yt,Kt,St.data):T.isCompressedTexture?B.compressedTexSubImage2D(B.TEXTURE_2D,Ie,Ge,mt,St.width,St.height,yt,St.data):B.texSubImage2D(B.TEXTURE_2D,Ie,Ge,mt,Be,Re,yt,Kt,St);y.pixelStorei(B.UNPACK_ROW_LENGTH,rn),y.pixelStorei(B.UNPACK_IMAGE_HEIGHT,dt),y.pixelStorei(B.UNPACK_SKIP_PIXELS,bn),y.pixelStorei(B.UNPACK_SKIP_ROWS,zn),y.pixelStorei(B.UNPACK_SKIP_IMAGES,oi),Ie===0&&V.generateMipmaps&&B.generateMipmap(Ue),y.unbindTexture()},this.initRenderTarget=function(T){Y.get(T).__webglFramebuffer===void 0&&te.setupRenderTarget(T)},this.initTexture=function(T){T.isCubeTexture?te.setTextureCube(T,0):T.isData3DTexture?te.setTexture3D(T,0):T.isDataArrayTexture||T.isCompressedArrayTexture?te.setTexture2DArray(T,0):te.setTexture2D(T,0),y.unbindTexture()},this.resetState=function(){j=0,R=0,F=null,y.reset(),De.reset()},typeof __THREE_DEVTOOLS__!="undefined"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Nn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=ct._getDrawingBufferColorSpace(e),t.unpackColorSpace=ct._getUnpackColorSpace()}};var xd={type:"change"},lh={type:"start"},yd={type:"end"},El=new Bi,vd=new on,cx=Math.cos(70*Bs.DEG2RAD),Gt=new D,dn=2*Math.PI,xt={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},oh=1e-6,Tl=class extends Or{constructor(e,t=null){super(e,t),this.state=xt.NONE,this.target=new D,this.cursor=new D,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:yi.ROTATE,MIDDLE:yi.DOLLY,RIGHT:yi.PAN},this.touches={ONE:Mi.ROTATE,TWO:Mi.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._cursorStyle="auto",this._domElementKeyEvents=null,this._lastPosition=new D,this._lastQuaternion=new Bt,this._lastTargetPosition=new D,this._quat=new Bt().setFromUnitVectors(e.up,new D(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new Ls,this._sphericalDelta=new Ls,this._scale=1,this._panOffset=new D,this._rotateStart=new pe,this._rotateEnd=new pe,this._rotateDelta=new pe,this._panStart=new pe,this._panEnd=new pe,this._panDelta=new pe,this._dollyStart=new pe,this._dollyEnd=new pe,this._dollyDelta=new pe,this._dollyDirection=new D,this._mouse=new pe,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=ux.bind(this),this._onPointerDown=hx.bind(this),this._onPointerUp=dx.bind(this),this._onContextMenu=vx.bind(this),this._onMouseWheel=mx.bind(this),this._onKeyDown=gx.bind(this),this._onTouchStart=_x.bind(this),this._onTouchMove=xx.bind(this),this._onMouseDown=fx.bind(this),this._onMouseMove=px.bind(this),this._interceptControlDown=yx.bind(this),this._interceptControlUp=Mx.bind(this),this.domElement!==null&&this.connect(this.domElement),this.update()}set cursorStyle(e){this._cursorStyle=e,e==="grab"?this.domElement.style.cursor="grab":this.domElement.style.cursor="auto"}get cursorStyle(){return this._cursorStyle}connect(e){super.connect(e),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.state=xt.NONE,this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents();let e=this.domElement.getRootNode();e.removeEventListener("keydown",this._interceptControlDown,{capture:!0}),e.removeEventListener("keyup",this._interceptControlUp,{capture:!0}),this._controlActive=!1,this._pointers.length=0,this._pointerPositions={},this.domElement.style.touchAction="",this.domElement.style.cursor="auto"}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(xd),this.update(),this.state=xt.NONE}pan(e,t){this._pan(e,t),this.update()}dollyIn(e){this._dollyIn(e),this.update()}dollyOut(e){this._dollyOut(e),this.update()}rotateLeft(e){this._rotateLeft(e),this.update()}rotateUp(e){this._rotateUp(e),this.update()}update(e=null){let t=this.object.position;Gt.copy(t).sub(this.target),Gt.applyQuaternion(this._quat),this._spherical.setFromVector3(Gt),this.autoRotate&&this.state===xt.NONE&&this._rotateLeft(this._getAutoRotationAngle(e)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let n=this.minAzimuthAngle,s=this.maxAzimuthAngle;isFinite(n)&&isFinite(s)&&(n<-Math.PI?n+=dn:n>Math.PI&&(n-=dn),s<-Math.PI?s+=dn:s>Math.PI&&(s-=dn),n<=s?this._spherical.theta=Math.max(n,Math.min(s,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(n+s)/2?Math.max(n,this._spherical.theta):Math.min(s,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let r=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{let a=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),r=a!=this._spherical.radius}if(Gt.setFromSpherical(this._spherical),Gt.applyQuaternion(this._quatInverse),t.copy(this.target).add(Gt),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let a=null;if(this.object.isPerspectiveCamera){let o=Gt.length();a=this._clampDistance(o*this._scale);let c=o-a;this.object.position.addScaledVector(this._dollyDirection,c),this.object.updateMatrixWorld(),r=!!c}else if(this.object.isOrthographicCamera){let o=new D(this._mouse.x,this._mouse.y,0);o.unproject(this.object);let c=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),r=c!==this.object.zoom;let l=new D(this._mouse.x,this._mouse.y,0);l.unproject(this.object),this.object.position.sub(l).add(o),this.object.updateMatrixWorld(),a=Gt.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;a!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(a).add(this.object.position):(El.origin.copy(this.object.position),El.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(El.direction))<cx?this.object.lookAt(this.target):(vd.setFromNormalAndCoplanarPoint(this.object.up,this.target),El.intersectPlane(vd,this.target))))}else if(this.object.isOrthographicCamera){let a=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),a!==this.object.zoom&&(this.object.updateProjectionMatrix(),r=!0)}return this._scale=1,this._performCursorZoom=!1,r||this._lastPosition.distanceToSquared(this.object.position)>oh||8*(1-this._lastQuaternion.dot(this.object.quaternion))>oh||this._lastTargetPosition.distanceToSquared(this.target)>oh?(this.dispatchEvent(xd),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(e){return e!==null?dn/60*this.autoRotateSpeed*e:dn/60/60*this.autoRotateSpeed}_getZoomScale(e){let t=Math.abs(e*.01);return Math.pow(.95,this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){Gt.setFromMatrixColumn(t,0),Gt.multiplyScalar(-e),this._panOffset.add(Gt)}_panUp(e,t){this.screenSpacePanning===!0?Gt.setFromMatrixColumn(t,1):(Gt.setFromMatrixColumn(t,0),Gt.crossVectors(this.object.up,Gt)),Gt.multiplyScalar(e),this._panOffset.add(Gt)}_pan(e,t){let n=this.domElement;if(this.object.isPerspectiveCamera){let s=this.object.position;Gt.copy(s).sub(this.target);let r=Gt.length();r*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*r/n.clientHeight,this.object.matrix),this._panUp(2*t*r/n.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/n.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/n.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}_dollyOut(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_dollyIn(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;let n=this.domElement.getBoundingClientRect(),s=e-n.left,r=t-n.top,a=n.width,o=n.height;this._mouse.x=s/a*2-1,this._mouse.y=-(r/o)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(dn*this._rotateDelta.x/t.clientHeight),this._rotateUp(dn*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0?this._dollyIn(this._getZoomScale(e.deltaY)):e.deltaY>0&&this._dollyOut(this._getZoomScale(e.deltaY)),this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(dn*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,this.keyPanSpeed),t=!0;break;case this.keys.BOTTOM:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(-dn*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,-this.keyPanSpeed),t=!0;break;case this.keys.LEFT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(dn*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(this.keyPanSpeed,0),t=!0;break;case this.keys.RIGHT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(-dn*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(-this.keyPanSpeed,0),t=!0;break}t&&(e.preventDefault(),this.update())}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),s=.5*(e.pageY+t.y);this._rotateStart.set(n,s)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),s=.5*(e.pageY+t.y);this._panStart.set(n,s)}}_handleTouchStartDolly(e){let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,s=e.pageY-t.y,r=Math.sqrt(n*n+s*s);this._dollyStart.set(0,r)}_handleTouchStartDollyPan(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enablePan&&this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enableRotate&&this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{let n=this._getSecondPointerPosition(e),s=.5*(e.pageX+n.x),r=.5*(e.pageY+n.y);this._rotateEnd.set(s,r)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(dn*this._rotateDelta.x/t.clientHeight),this._rotateUp(dn*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),s=.5*(e.pageY+t.y);this._panEnd.set(n,s)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,s=e.pageY-t.y,r=Math.sqrt(n*n+s*s);this._dollyEnd.set(0,r),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);let a=(e.pageX+t.x)*.5,o=(e.pageY+t.y)*.5;this._updateZoomParameters(a,o)}_handleTouchMoveDollyPan(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enablePan&&this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enableRotate&&this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];t===void 0&&(t=new pe,this._pointerPositions[e.pointerId]=t),t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){let t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){let t=e.deltaMode,n={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:n.deltaY*=16;break;case 2:n.deltaY*=100;break}return e.ctrlKey&&!this._controlActive&&(n.deltaY*=10),n}};function hx(i){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(i.pointerId),this.domElement.ownerDocument.addEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(i)&&(this._addPointer(i),i.pointerType==="touch"?this._onTouchStart(i):this._onMouseDown(i),this._cursorStyle==="grab"&&(this.domElement.style.cursor="grabbing")))}function ux(i){this.enabled!==!1&&(i.pointerType==="touch"?this._onTouchMove(i):this._onMouseMove(i))}function dx(i){switch(this._removePointer(i),this._pointers.length){case 0:this.domElement.releasePointerCapture(i.pointerId),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(yd),this.state=xt.NONE,this._cursorStyle==="grab"&&(this.domElement.style.cursor="grab");break;case 1:let e=this._pointers[0],t=this._pointerPositions[e];this._onTouchStart({pointerId:e,pageX:t.x,pageY:t.y});break}}function fx(i){let e;switch(i.button){case 0:e=this.mouseButtons.LEFT;break;case 1:e=this.mouseButtons.MIDDLE;break;case 2:e=this.mouseButtons.RIGHT;break;default:e=-1}switch(e){case yi.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(i),this.state=xt.DOLLY;break;case yi.ROTATE:if(i.ctrlKey||i.metaKey||i.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(i),this.state=xt.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(i),this.state=xt.ROTATE}break;case yi.PAN:if(i.ctrlKey||i.metaKey||i.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(i),this.state=xt.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(i),this.state=xt.PAN}break;default:this.state=xt.NONE}this.state!==xt.NONE&&this.dispatchEvent(lh)}function px(i){switch(this.state){case xt.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(i);break;case xt.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(i);break;case xt.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(i);break}}function mx(i){this.enabled===!1||this.enableZoom===!1||this.state!==xt.NONE||(i.preventDefault(),this.dispatchEvent(lh),this._handleMouseWheel(this._customWheelEvent(i)),this.dispatchEvent(yd))}function gx(i){this.enabled!==!1&&this._handleKeyDown(i)}function _x(i){switch(this._trackPointer(i),this._pointers.length){case 1:switch(this.touches.ONE){case Mi.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(i),this.state=xt.TOUCH_ROTATE;break;case Mi.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(i),this.state=xt.TOUCH_PAN;break;default:this.state=xt.NONE}break;case 2:switch(this.touches.TWO){case Mi.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(i),this.state=xt.TOUCH_DOLLY_PAN;break;case Mi.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(i),this.state=xt.TOUCH_DOLLY_ROTATE;break;default:this.state=xt.NONE}break;default:this.state=xt.NONE}this.state!==xt.NONE&&this.dispatchEvent(lh)}function xx(i){switch(this._trackPointer(i),this.state){case xt.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(i),this.update();break;case xt.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(i),this.update();break;case xt.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(i),this.update();break;case xt.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(i),this.update();break;default:this.state=xt.NONE}}function vx(i){this.enabled!==!1&&i.preventDefault()}function yx(i){i.key==="Control"&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function Mx(i){i.key==="Control"&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}var wl=class extends Oi{constructor(){super(),this.name="RoomEnvironment",this.position.y=-3.5;let e=new Lt;e.deleteAttribute("uv");let t=new Ye({side:Zt}),n=new Ye,s=new Hi(16777215,900,28,2);s.position.set(.418,16.199,.3),this.add(s);let r=new ut(e,t);r.position.set(-.757,13.219,.717),r.scale.set(31.713,28.305,28.591),this.add(r);let a=new zi(e,n,6),o=new Rt;o.position.set(-10.906,2.009,1.846),o.rotation.set(0,-.195,0),o.scale.set(2.328,7.905,4.651),o.updateMatrix(),a.setMatrixAt(0,o.matrix),o.position.set(-5.607,-.754,-.758),o.rotation.set(0,.994,0),o.scale.set(1.97,1.534,3.955),o.updateMatrix(),a.setMatrixAt(1,o.matrix),o.position.set(6.167,.857,7.803),o.rotation.set(0,.561,0),o.scale.set(3.927,6.285,3.687),o.updateMatrix(),a.setMatrixAt(2,o.matrix),o.position.set(-2.017,.018,6.124),o.rotation.set(0,.333,0),o.scale.set(2.002,4.566,2.064),o.updateMatrix(),a.setMatrixAt(3,o.matrix),o.position.set(2.291,-.756,-2.621),o.rotation.set(0,-.286,0),o.scale.set(1.546,1.552,1.496),o.updateMatrix(),a.setMatrixAt(4,o.matrix),o.position.set(-2.193,-.369,-5.547),o.rotation.set(0,.516,0),o.scale.set(3.875,3.487,2.986),o.updateMatrix(),a.setMatrixAt(5,o.matrix),this.add(a);let c=new ut(e,Ws(50));c.position.set(-16.116,14.37,8.208),c.scale.set(.1,2.428,2.739),this.add(c);let l=new ut(e,Ws(50));l.position.set(-16.109,18.021,-8.207),l.scale.set(.1,2.425,2.751),this.add(l);let h=new ut(e,Ws(17));h.position.set(14.904,12.198,-1.832),h.scale.set(.15,4.265,6.331),this.add(h);let u=new ut(e,Ws(43));u.position.set(-.462,8.89,14.52),u.scale.set(4.38,5.441,.088),this.add(u);let d=new ut(e,Ws(20));d.position.set(3.235,11.486,-12.541),d.scale.set(2.5,2,.1),this.add(d);let f=new ut(e,Ws(100));f.position.set(0,20,0),f.scale.set(1,.1,1),this.add(f)}dispose(){let e=new Set;this.traverse(t=>{t.isMesh&&(e.add(t.geometry),e.add(t.material))});for(let t of e)t.dispose()}};function Ws(i){return new Cr({color:0,emissive:16777215,emissiveIntensity:i})}var ra=new D;function Pn(i,e,t,n,s,r){let a=2*Math.PI*s/4,o=Math.max(r-2*s,0),c=Math.PI/4;ra.copy(e),ra[n]=0,ra.normalize();let l=.5*a/(a+o),h=1-ra.angleTo(i)/c;return Math.sign(ra[t])===1?h*l:o/(a+o)+l+l*(1-h)}var Zn=class i extends Lt{constructor(e=1,t=1,n=1,s=2,r=.1){let a=s*2+1;if(r=Math.min(e/2,t/2,n/2,r),super(1,1,1,a,a,a),this.type="RoundedBoxGeometry",this.parameters={width:e,height:t,depth:n,segments:s,radius:r},a===1)return;let o=this.toNonIndexed();this.index=null,this.attributes.position=o.attributes.position,this.attributes.normal=o.attributes.normal,this.attributes.uv=o.attributes.uv;let c=new D,l=new D,h=new D(e,t,n).divideScalar(2).subScalar(r),u=this.attributes.position.array,d=this.attributes.normal.array,f=this.attributes.uv.array,p=u.length/6,_=new D,m=.5/a;for(let g=0,S=0;g<u.length;g+=3,S+=2)switch(c.fromArray(u,g),l.copy(c),l.x-=Math.sign(l.x)*m,l.y-=Math.sign(l.y)*m,l.z-=Math.sign(l.z)*m,l.normalize(),u[g+0]=h.x*Math.sign(c.x)+l.x*r,u[g+1]=h.y*Math.sign(c.y)+l.y*r,u[g+2]=h.z*Math.sign(c.z)+l.z*r,d[g+0]=l.x,d[g+1]=l.y,d[g+2]=l.z,Math.floor(g/p)){case 0:_.set(1,0,0),f[S+0]=Pn(_,l,"z","y",r,n),f[S+1]=1-Pn(_,l,"y","z",r,t);break;case 1:_.set(-1,0,0),f[S+0]=1-Pn(_,l,"z","y",r,n),f[S+1]=1-Pn(_,l,"y","z",r,t);break;case 2:_.set(0,1,0),f[S+0]=1-Pn(_,l,"x","z",r,e),f[S+1]=Pn(_,l,"z","x",r,n);break;case 3:_.set(0,-1,0),f[S+0]=1-Pn(_,l,"x","z",r,e),f[S+1]=1-Pn(_,l,"z","x",r,n);break;case 4:_.set(0,0,1),f[S+0]=1-Pn(_,l,"x","y",r,e),f[S+1]=1-Pn(_,l,"y","x",r,t);break;case 5:_.set(0,0,-1),f[S+0]=Pn(_,l,"x","y",r,e),f[S+1]=1-Pn(_,l,"y","x",r,t);break}}static fromJSON(e){return new i(e.width,e.height,e.depth,e.segments,e.radius)}};function ch(i,e=!1){let t=i[0].index!==null,n=new Set(Object.keys(i[0].attributes)),s=new Set(Object.keys(i[0].morphAttributes)),r={},a={},o=i[0].morphTargetsRelative,c=new zt,l=0;for(let h=0;h<i.length;++h){let u=i[h],d=0;if(t!==(u.index!==null))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."),null;for(let f in u.attributes){if(!n.has(f))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+'. All geometries must have compatible attributes; make sure "'+f+'" attribute exists among all geometries, or in none of them.'),null;r[f]===void 0&&(r[f]=[]),r[f].push(u.attributes[f]),d++}if(d!==n.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". Make sure all geometries have the same number of attributes."),null;if(o!==u.morphTargetsRelative)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". .morphTargetsRelative must be consistent throughout all geometries."),null;for(let f in u.morphAttributes){if(!s.has(f))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+".  .morphAttributes must be consistent throughout all geometries."),null;a[f]===void 0&&(a[f]=[]),a[f].push(u.morphAttributes[f])}if(e){let f;if(t)f=u.index.count;else if(u.attributes.position!==void 0)f=u.attributes.position.count;else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". The geometry must have either an index or a position attribute"),null;c.addGroup(l,f,h),l+=f}}if(t){let h=0,u=[];for(let d=0;d<i.length;++d){let f=i[d].index;for(let p=0;p<f.count;++p)u.push(f.getX(p)+h);h+=i[d].attributes.position.count}c.setIndex(u)}for(let h in r){let u=Md(r[h]);if(!u)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" attribute."),null;c.setAttribute(h,u)}for(let h in a){let u=a[h][0].length;if(u!==0){c.morphAttributes=c.morphAttributes||{},c.morphAttributes[h]=[];for(let d=0;d<u;++d){let f=[];for(let _=0;_<a[h].length;++_)f.push(a[h][_][d]);let p=Md(f);if(!p)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" morphAttribute."),null;c.morphAttributes[h].push(p)}}}return c}function Md(i){let e,t,n,s=-1,r=0;for(let l=0;l<i.length;++l){let h=i[l];if(e===void 0&&(e=h.array.constructor),e!==h.array.constructor)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."),null;if(t===void 0&&(t=h.itemSize),t!==h.itemSize)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."),null;if(n===void 0&&(n=h.normalized),n!==h.normalized)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."),null;if(s===-1&&(s=h.gpuType),s!==h.gpuType)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."),null;r+=h.count*t}let a=new e(r),o=new ln(a,t,n),c=0;for(let l=0;l<i.length;++l){let h=i[l];if(h.isInterleavedBufferAttribute){let u=c/t;for(let d=0,f=h.count;d<f;d++)for(let p=0;p<t;p++){let _=h.getComponent(d,p);o.setComponent(d+u,p,_)}}else a.set(h.array,c);c+=h.count*t}return s!==void 0&&(o.gpuType=s),o}var Xs={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`};var Mn=class{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}},Sx=new Xn(-1,1,1,-1,0,1),hh=class extends zt{constructor(){super(),this.setAttribute("position",new gt([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new gt([0,2,0,0,2,0],2))}},bx=new hh,Ai=class{constructor(e){this._mesh=new ut(bx,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,Sx)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}};var Al=class extends Mn{constructor(e,t="tDiffuse"){super(),this.textureID=t,this.uniforms=null,this.material=null,e instanceof Pt?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=Rn.clone(e.uniforms),this.material=new Pt({name:e.name!==void 0?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this._fsQuad=new Ai(this.material)}render(e,t,n){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=n.texture),this._fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}};var aa=class extends Mn{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,n){let s=e.getContext(),r=e.state;r.buffers.color.setMask(!1),r.buffers.depth.setMask(!1),r.buffers.color.setLocked(!0),r.buffers.depth.setLocked(!0);let a,o;this.inverse?(a=0,o=1):(a=1,o=0),r.buffers.stencil.setTest(!0),r.buffers.stencil.setOp(s.REPLACE,s.REPLACE,s.REPLACE),r.buffers.stencil.setFunc(s.ALWAYS,a,4294967295),r.buffers.stencil.setClear(o),r.buffers.stencil.setLocked(!0),e.setRenderTarget(n),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),r.buffers.color.setLocked(!1),r.buffers.depth.setLocked(!1),r.buffers.color.setMask(!0),r.buffers.depth.setMask(!0),r.buffers.stencil.setLocked(!1),r.buffers.stencil.setFunc(s.EQUAL,1,4294967295),r.buffers.stencil.setOp(s.KEEP,s.KEEP,s.KEEP),r.buffers.stencil.setLocked(!0)}},Cl=class extends Mn{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}};var Rl=class{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){let n=e.getSize(new pe);this._width=n.width,this._height=n.height,t=new Ct(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:Vt}),t.texture.name="EffectComposer.rt1"}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new Al(Xs),this.copyPass.material.blending=Nt,this.timer=new Ur}swapBuffers(){let e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){let t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){this.timer.update(),e===void 0&&(e=this.timer.getDelta());let t=this.renderer.getRenderTarget(),n=!1;for(let s=0,r=this.passes.length;s<r;s++){let a=this.passes[s];if(a.enabled!==!1){if(a.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(s),a.render(this.renderer,this.writeBuffer,this.readBuffer,e,n),a.needsSwap){if(n){let o=this.renderer.getContext(),c=this.renderer.state.buffers.stencil;c.setFunc(o.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),c.setFunc(o.EQUAL,1,4294967295)}this.swapBuffers()}aa!==void 0&&(a instanceof aa?n=!0:a instanceof Cl&&(n=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){let t=this.renderer.getSize(new pe);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;let n=this._width*this._pixelRatio,s=this._height*this._pixelRatio;this.renderTarget1.setSize(n,s),this.renderTarget2.setSize(n,s);for(let r=0;r<this.passes.length;r++)this.passes[r].setSize(n,s)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}};var Pl=class extends Mn{constructor(e,t,n=null,s=null,r=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=n,this.clearColor=s,this.clearAlpha=r,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new tt}render(e,t,n){let s=e.autoClear;e.autoClear=!1;let r,a;this.overrideMaterial!==null&&(a=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(r=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:n),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(r),this.overrideMaterial!==null&&(this.scene.overrideMaterial=a),e.autoClear=s}};var oa={name:"GTAOShader",defines:{PERSPECTIVE_CAMERA:1,SAMPLES:16,NORMAL_VECTOR_TYPE:1,DEPTH_SWIZZLING:"x",SCREEN_SPACE_RADIUS:0,SCREEN_SPACE_RADIUS_SCALE:100,SCENE_CLIP_BOX:0},uniforms:{tNormal:{value:null},tDepth:{value:null},tNoise:{value:null},resolution:{value:new pe},cameraNear:{value:null},cameraFar:{value:null},cameraProjectionMatrix:{value:new Ne},cameraProjectionMatrixInverse:{value:new Ne},cameraWorldMatrix:{value:new Ne},radius:{value:.25},distanceExponent:{value:1},thickness:{value:1},distanceFallOff:{value:1},scale:{value:1},sceneBoxMin:{value:new D(-1,-1,-1)},sceneBoxMax:{value:new D(1,1,1)}},vertexShader:`

		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`
		varying vec2 vUv;
		uniform highp sampler2D tNormal;
		uniform highp sampler2D tDepth;
		uniform sampler2D tNoise;
		uniform vec2 resolution;
		uniform float cameraNear;
		uniform float cameraFar;
		uniform mat4 cameraProjectionMatrix;
		uniform mat4 cameraProjectionMatrixInverse;
		uniform mat4 cameraWorldMatrix;
		uniform float radius;
		uniform float distanceExponent;
		uniform float thickness;
		uniform float distanceFallOff;
		uniform float scale;
		#if SCENE_CLIP_BOX == 1
			uniform vec3 sceneBoxMin;
			uniform vec3 sceneBoxMax;
		#endif

		#include <common>
		#include <packing>

		#ifndef FRAGMENT_OUTPUT
		#define FRAGMENT_OUTPUT vec4(vec3(ao), 1.)
		#endif

		vec3 getViewPosition( const in vec2 screenPosition, const in float depth ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				vec4 clipSpacePosition = vec4( vec2( screenPosition ) * 2.0 - 1.0, depth, 1.0 );
			#else
				vec4 clipSpacePosition = vec4( vec3( screenPosition, depth ) * 2.0 - 1.0, 1.0 );
			#endif
			vec4 viewSpacePosition = cameraProjectionMatrixInverse * clipSpacePosition;
			return viewSpacePosition.xyz / viewSpacePosition.w;
		}

		float getDepth(const vec2 uv) {
			return textureLod(tDepth, uv.xy, 0.0).DEPTH_SWIZZLING;
		}

		float fetchDepth(const ivec2 uv) {
			return texelFetch(tDepth, uv.xy, 0).DEPTH_SWIZZLING;
		}

		float getViewZ(const in float depth) {
			#if PERSPECTIVE_CAMERA == 1
				return perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
			#else
				return orthographicDepthToViewZ(depth, cameraNear, cameraFar);
			#endif
		}

		vec3 computeNormalFromDepth(const vec2 uv) {
			vec2 size = vec2(textureSize(tDepth, 0));
			ivec2 p = ivec2(uv * size);
			float c0 = fetchDepth(p);
			float l2 = fetchDepth(p - ivec2(2, 0));
			float l1 = fetchDepth(p - ivec2(1, 0));
			float r1 = fetchDepth(p + ivec2(1, 0));
			float r2 = fetchDepth(p + ivec2(2, 0));
			float b2 = fetchDepth(p - ivec2(0, 2));
			float b1 = fetchDepth(p - ivec2(0, 1));
			float t1 = fetchDepth(p + ivec2(0, 1));
			float t2 = fetchDepth(p + ivec2(0, 2));
			float dl = abs((2.0 * l1 - l2) - c0);
			float dr = abs((2.0 * r1 - r2) - c0);
			float db = abs((2.0 * b1 - b2) - c0);
			float dt = abs((2.0 * t1 - t2) - c0);
			vec3 ce = getViewPosition(uv, c0).xyz;
			vec3 dpdx = (dl < dr) ? ce - getViewPosition((uv - vec2(1.0 / size.x, 0.0)), l1).xyz : -ce + getViewPosition((uv + vec2(1.0 / size.x, 0.0)), r1).xyz;
			vec3 dpdy = (db < dt) ? ce - getViewPosition((uv - vec2(0.0, 1.0 / size.y)), b1).xyz : -ce + getViewPosition((uv + vec2(0.0, 1.0 / size.y)), t1).xyz;
			return normalize(cross(dpdx, dpdy));
		}

		vec3 getViewNormal(const vec2 uv) {
			#if NORMAL_VECTOR_TYPE == 2
				return normalize(textureLod(tNormal, uv, 0.).rgb);
			#elif NORMAL_VECTOR_TYPE == 1
				return unpackRGBToNormal(textureLod(tNormal, uv, 0.).rgb);
			#else
				return computeNormalFromDepth(uv);
			#endif
		}

		vec3 getSceneUvAndDepth(vec3 sampleViewPos) {
			vec4 sampleClipPos = cameraProjectionMatrix * vec4(sampleViewPos, 1.);
			vec2 sampleUv = sampleClipPos.xy / sampleClipPos.w * 0.5 + 0.5;
			float sampleSceneDepth = getDepth(sampleUv);
			return vec3(sampleUv, sampleSceneDepth);
		}

		void main() {
			float depth = getDepth(vUv.xy);

			#ifdef USE_REVERSED_DEPTH_BUFFER
				if (depth <= 0.0) {
					discard;
					return;
				}
			#else
				if (depth >= 1.0) {
					discard;
					return;
				}
			#endif
			
			vec3 viewPos = getViewPosition(vUv, depth);
			vec3 viewNormal = getViewNormal(vUv);

			float radiusToUse = radius;
			float distanceFalloffToUse = thickness;
			#if SCREEN_SPACE_RADIUS == 1
				float radiusScale = getViewPosition(vec2(0.5 + float(SCREEN_SPACE_RADIUS_SCALE) / resolution.x, 0.0), depth).x;
				radiusToUse *= radiusScale;
				distanceFalloffToUse *= radiusScale;
			#endif

			#if SCENE_CLIP_BOX == 1
				vec3 worldPos = (cameraWorldMatrix * vec4(viewPos, 1.0)).xyz;
				float boxDistance = length(max(vec3(0.0), max(sceneBoxMin - worldPos, worldPos - sceneBoxMax)));
				if (boxDistance > radiusToUse) {
					discard;
					return;
				}
			#endif

			vec2 noiseResolution = vec2(textureSize(tNoise, 0));
			vec2 noiseUv = vUv * resolution / noiseResolution;
			vec4 noiseTexel = textureLod(tNoise, noiseUv, 0.0);
			vec3 randomVec = noiseTexel.xyz * 2.0 - 1.0;
			vec3 tangent = normalize(vec3(randomVec.xy, 0.));
			vec3 bitangent = vec3(-tangent.y, tangent.x, 0.);
			mat3 kernelMatrix = mat3(tangent, bitangent, vec3(0., 0., 1.));

			const int DIRECTIONS = SAMPLES < 30 ? 3 : 5;
			const int STEPS = (SAMPLES + DIRECTIONS - 1) / DIRECTIONS;
			float ao = 0.0;
			for (int i = 0; i < DIRECTIONS; ++i) {

				float angle = float(i) / float(DIRECTIONS) * PI;
				vec4 sampleDir = vec4(cos(angle), sin(angle), 0., 0.5 + 0.5 * noiseTexel.w);
				sampleDir.xyz = normalize(kernelMatrix * sampleDir.xyz);

				vec3 viewDir = normalize(-viewPos.xyz);
				vec3 sliceBitangent = normalize(cross(sampleDir.xyz, viewDir));
				vec3 sliceTangent = cross(sliceBitangent, viewDir);
				vec3 normalInSlice = normalize(viewNormal - sliceBitangent * dot(viewNormal, sliceBitangent));

				vec3 tangentToNormalInSlice = cross(normalInSlice, sliceBitangent);
				vec2 cosHorizons = vec2(dot(viewDir, tangentToNormalInSlice), dot(viewDir, -tangentToNormalInSlice));

				for (int j = 0; j < STEPS; ++j) {
					vec3 sampleViewOffset = sampleDir.xyz * radiusToUse * sampleDir.w * pow(float(j + 1) / float(STEPS), distanceExponent);

					vec3 sampleSceneUvDepth = getSceneUvAndDepth(viewPos + sampleViewOffset);
					vec3 sampleSceneViewPos = getViewPosition(sampleSceneUvDepth.xy, sampleSceneUvDepth.z);
					vec3 viewDelta = sampleSceneViewPos - viewPos;
					if (abs(viewDelta.z) < thickness) {
						float sampleCosHorizon = dot(viewDir, normalize(viewDelta));
						cosHorizons.x += max(0., (sampleCosHorizon - cosHorizons.x) * mix(1., 2. / float(j + 2), distanceFallOff));
					}

					sampleSceneUvDepth = getSceneUvAndDepth(viewPos - sampleViewOffset);
					sampleSceneViewPos = getViewPosition(sampleSceneUvDepth.xy, sampleSceneUvDepth.z);
					viewDelta = sampleSceneViewPos - viewPos;
					if (abs(viewDelta.z) < thickness) {
						float sampleCosHorizon = dot(viewDir, normalize(viewDelta));
						cosHorizons.y += max(0., (sampleCosHorizon - cosHorizons.y) * mix(1., 2. / float(j + 2), distanceFallOff));
					}
				}

				vec2 sinHorizons = sqrt(1. - cosHorizons * cosHorizons);
				float nx = dot(normalInSlice, sliceTangent);
				float ny = dot(normalInSlice, viewDir);
				float nxb = 1. / 2. * (acos(cosHorizons.y) - acos(cosHorizons.x) + sinHorizons.x * cosHorizons.x - sinHorizons.y * cosHorizons.y);
				float nyb = 1. / 2. * (2. - cosHorizons.x * cosHorizons.x - cosHorizons.y * cosHorizons.y);
				float occlusion = nx * nxb + ny * nyb;
				ao += occlusion;
			}

			ao = clamp(ao / float(DIRECTIONS), 0., 1.);
		#if SCENE_CLIP_BOX == 1
			ao = mix(ao, 1., smoothstep(0., radiusToUse, boxDistance));
		#endif
			ao = pow(ao, scale);

			gl_FragColor = FRAGMENT_OUTPUT;
		}`},la={name:"GTAODepthShader",defines:{PERSPECTIVE_CAMERA:1},uniforms:{tDepth:{value:null},cameraNear:{value:null},cameraFar:{value:null}},vertexShader:`
		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`
		uniform sampler2D tDepth;
		uniform float cameraNear;
		uniform float cameraFar;
		varying vec2 vUv;

		#include <packing>

		float getLinearDepth( const in vec2 screenPosition ) {
			#if PERSPECTIVE_CAMERA == 1
				float fragCoordZ = texture2D( tDepth, screenPosition ).x;
				float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
				return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );
			#else
				return texture2D( tDepth, screenPosition ).x;
			#endif
		}

		void main() {
			float depth = getLinearDepth( vUv );
			gl_FragColor = vec4( vec3( 1.0 - depth ), 1.0 );

		}`},Il={name:"GTAOBlendShader",uniforms:{tDiffuse:{value:null},intensity:{value:1}},vertexShader:`
		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`
		uniform float intensity;
		uniform sampler2D tDiffuse;
		varying vec2 vUv;

		void main() {
			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = vec4(mix(vec3(1.), texel.rgb, intensity), texel.a);
		}`};function Sd(i=5){let e=Math.floor(i)%2===0?Math.floor(i)+1:Math.floor(i),t=Ex(e),n=t.length,s=new Uint8Array(n*4);for(let a=0;a<n;++a){let o=t[a],c=2*Math.PI*o/n,l=new D(Math.cos(c),Math.sin(c),0).normalize();s[a*4]=(l.x*.5+.5)*255,s[a*4+1]=(l.y*.5+.5)*255,s[a*4+2]=127,s[a*4+3]=255}let r=new si(s,e,e);return r.wrapS=qt,r.wrapT=qt,r.needsUpdate=!0,r}function Ex(i){let e=Math.floor(i)%2===0?Math.floor(i)+1:Math.floor(i),t=e*e,n=Array(t).fill(0),s=Math.floor(e/2),r=e-1;for(let a=1;a<=t;){if(s===-1&&r===e?(r=e-2,s=0):(r===e&&(r=0),s<0&&(s=e-1)),n[s*e+r]!==0){r-=2,s++;continue}else n[s*e+r]=a++;r++,s--}return n}var ca={name:"PoissonDenoiseShader",defines:{SAMPLES:16,SAMPLE_VECTORS:uh(16,2,1),NORMAL_VECTOR_TYPE:1,DEPTH_VALUE_SOURCE:0},uniforms:{tDiffuse:{value:null},tNormal:{value:null},tDepth:{value:null},tNoise:{value:null},resolution:{value:new pe},cameraProjectionMatrixInverse:{value:new Ne},lumaPhi:{value:5},depthPhi:{value:5},normalPhi:{value:5},radius:{value:4},index:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`

		varying vec2 vUv;

		uniform sampler2D tDiffuse;
		uniform sampler2D tNormal;
		uniform sampler2D tDepth;
		uniform sampler2D tNoise;
		uniform vec2 resolution;
		uniform mat4 cameraProjectionMatrixInverse;
		uniform float lumaPhi;
		uniform float depthPhi;
		uniform float normalPhi;
		uniform float radius;
		uniform int index;

		#include <common>
		#include <packing>

		#ifndef SAMPLE_LUMINANCE
		#define SAMPLE_LUMINANCE dot(vec3(0.2125, 0.7154, 0.0721), a)
		#endif

		#ifndef FRAGMENT_OUTPUT
		#define FRAGMENT_OUTPUT vec4(denoised, 1.)
		#endif

		float getLuminance(const in vec3 a) {
			return SAMPLE_LUMINANCE;
		}

		const vec3 poissonDisk[SAMPLES] = SAMPLE_VECTORS;

		vec3 getViewPosition( const in vec2 screenPosition, const in float depth ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				vec4 clipSpacePosition = vec4( vec2( screenPosition ) * 2.0 - 1.0, depth, 1.0 );
			#else
				vec4 clipSpacePosition = vec4( vec3( screenPosition, depth ) * 2.0 - 1.0, 1.0 );
			#endif
			vec4 viewSpacePosition = cameraProjectionMatrixInverse * clipSpacePosition;
			return viewSpacePosition.xyz / viewSpacePosition.w;
		}

		float getDepth(const vec2 uv) {
		#if DEPTH_VALUE_SOURCE == 1
			return textureLod(tDepth, uv.xy, 0.0).a;
		#else
			return textureLod(tDepth, uv.xy, 0.0).r;
		#endif
		}

		float fetchDepth(const ivec2 uv) {
			#if DEPTH_VALUE_SOURCE == 1
				return texelFetch(tDepth, uv.xy, 0).a;
			#else
				return texelFetch(tDepth, uv.xy, 0).r;
			#endif
		}

		vec3 computeNormalFromDepth(const vec2 uv) {
			vec2 size = vec2(textureSize(tDepth, 0));
			ivec2 p = ivec2(uv * size);
			float c0 = fetchDepth(p);
			float l2 = fetchDepth(p - ivec2(2, 0));
			float l1 = fetchDepth(p - ivec2(1, 0));
			float r1 = fetchDepth(p + ivec2(1, 0));
			float r2 = fetchDepth(p + ivec2(2, 0));
			float b2 = fetchDepth(p - ivec2(0, 2));
			float b1 = fetchDepth(p - ivec2(0, 1));
			float t1 = fetchDepth(p + ivec2(0, 1));
			float t2 = fetchDepth(p + ivec2(0, 2));
			float dl = abs((2.0 * l1 - l2) - c0);
			float dr = abs((2.0 * r1 - r2) - c0);
			float db = abs((2.0 * b1 - b2) - c0);
			float dt = abs((2.0 * t1 - t2) - c0);
			vec3 ce = getViewPosition(uv, c0).xyz;
			vec3 dpdx = (dl < dr) ?  ce - getViewPosition((uv - vec2(1.0 / size.x, 0.0)), l1).xyz
									: -ce + getViewPosition((uv + vec2(1.0 / size.x, 0.0)), r1).xyz;
			vec3 dpdy = (db < dt) ?  ce - getViewPosition((uv - vec2(0.0, 1.0 / size.y)), b1).xyz
									: -ce + getViewPosition((uv + vec2(0.0, 1.0 / size.y)), t1).xyz;
			return normalize(cross(dpdx, dpdy));
		}

		vec3 getViewNormal(const vec2 uv) {
		#if NORMAL_VECTOR_TYPE == 2
			return normalize(textureLod(tNormal, uv, 0.).rgb);
		#elif NORMAL_VECTOR_TYPE == 1
			return unpackRGBToNormal(textureLod(tNormal, uv, 0.).rgb);
		#else
			return computeNormalFromDepth(uv);
		#endif
		}

		void denoiseSample(in vec3 center, in vec3 viewNormal, in vec3 viewPos, in vec2 sampleUv, inout vec3 denoised, inout float totalWeight) {
			vec4 sampleTexel = textureLod(tDiffuse, sampleUv, 0.0);
			float sampleDepth = getDepth(sampleUv);
			vec3 sampleNormal = getViewNormal(sampleUv);
			vec3 neighborColor = sampleTexel.rgb;
			vec3 viewPosSample = getViewPosition(sampleUv, sampleDepth);

			float normalDiff = dot(viewNormal, sampleNormal);
			float normalSimilarity = pow(max(normalDiff, 0.), normalPhi);
			float lumaDiff = abs(getLuminance(neighborColor) - getLuminance(center));
			float lumaSimilarity = max(1.0 - lumaDiff / lumaPhi, 0.0);
			float depthDiff = abs(dot(viewPos - viewPosSample, viewNormal));
			float depthSimilarity = max(1. - depthDiff / depthPhi, 0.);
			float w = lumaSimilarity * depthSimilarity * normalSimilarity;

			denoised += w * neighborColor;
			totalWeight += w;
		}

		void main() {
			float depth = getDepth(vUv.xy);
			vec3 viewNormal = getViewNormal(vUv);
			if (depth == 1. || dot(viewNormal, viewNormal) == 0.) {
				discard;
				return;
			}
			vec4 texel = textureLod(tDiffuse, vUv, 0.0);
			vec3 center = texel.rgb;
			vec3 viewPos = getViewPosition(vUv, depth);

			vec2 noiseResolution = vec2(textureSize(tNoise, 0));
			vec2 noiseUv = vUv * resolution / noiseResolution;
			vec4 noiseTexel = textureLod(tNoise, noiseUv, 0.0);
      		vec2 noiseVec = vec2(sin(noiseTexel[index % 4] * 2. * PI), cos(noiseTexel[index % 4] * 2. * PI));
    		mat2 rotationMatrix = mat2(noiseVec.x, -noiseVec.y, noiseVec.x, noiseVec.y);

			float totalWeight = 1.0;
			vec3 denoised = texel.rgb;
			for (int i = 0; i < SAMPLES; i++) {
				vec3 sampleDir = poissonDisk[i];
				vec2 offset = rotationMatrix * (sampleDir.xy * (1. + sampleDir.z * (radius - 1.)) / resolution);
				vec2 sampleUv = vUv + offset;
				denoiseSample(center, viewNormal, viewPos, sampleUv, denoised, totalWeight);
			}

			if (totalWeight > 0.) {
				denoised /= totalWeight;
			}
			gl_FragColor = FRAGMENT_OUTPUT;
		}`};function uh(i,e,t){let n=Tx(i,e,t),s="vec3[SAMPLES](";for(let r=0;r<i;r++){let a=n[r];s+=`vec3(${a.x}, ${a.y}, ${a.z})${r<i-1?",":")"}`}return s}function Tx(i,e,t){let n=[];for(let s=0;s<i;s++){let r=2*Math.PI*e*s/i,a=Math.pow(s/(i-1),t);n.push(new D(Math.cos(r),Math.sin(r),a))}return n}var Dl=class{constructor(e=Math){this.grad3=[[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]],this.grad4=[[0,1,1,1],[0,1,1,-1],[0,1,-1,1],[0,1,-1,-1],[0,-1,1,1],[0,-1,1,-1],[0,-1,-1,1],[0,-1,-1,-1],[1,0,1,1],[1,0,1,-1],[1,0,-1,1],[1,0,-1,-1],[-1,0,1,1],[-1,0,1,-1],[-1,0,-1,1],[-1,0,-1,-1],[1,1,0,1],[1,1,0,-1],[1,-1,0,1],[1,-1,0,-1],[-1,1,0,1],[-1,1,0,-1],[-1,-1,0,1],[-1,-1,0,-1],[1,1,1,0],[1,1,-1,0],[1,-1,1,0],[1,-1,-1,0],[-1,1,1,0],[-1,1,-1,0],[-1,-1,1,0],[-1,-1,-1,0]],this.p=[];for(let t=0;t<256;t++)this.p[t]=Math.floor(e.random()*256);this.perm=[];for(let t=0;t<512;t++)this.perm[t]=this.p[t&255];this.simplex=[[0,1,2,3],[0,1,3,2],[0,0,0,0],[0,2,3,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,3,0],[0,2,1,3],[0,0,0,0],[0,3,1,2],[0,3,2,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,3,2,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,0,3],[0,0,0,0],[1,3,0,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,3,0,1],[2,3,1,0],[1,0,2,3],[1,0,3,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,0,3,1],[0,0,0,0],[2,1,3,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,0,1,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,0,1,2],[3,0,2,1],[0,0,0,0],[3,1,2,0],[2,1,0,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,1,0,2],[0,0,0,0],[3,2,0,1],[3,2,1,0]]}noise(e,t){let n,s,r,a=.5*(Math.sqrt(3)-1),o=(e+t)*a,c=Math.floor(e+o),l=Math.floor(t+o),h=(3-Math.sqrt(3))/6,u=(c+l)*h,d=c-u,f=l-u,p=e-d,_=t-f,m,g;p>_?(m=1,g=0):(m=0,g=1);let S=p-m+h,A=_-g+h,M=p-1+2*h,E=_-1+2*h,v=c&255,b=l&255,x=this.perm[v+this.perm[b]]%12,w=this.perm[v+m+this.perm[b+g]]%12,C=this.perm[v+1+this.perm[b+1]]%12,I=.5-p*p-_*_;I<0?n=0:(I*=I,n=I*I*this._dot(this.grad3[x],p,_));let U=.5-S*S-A*A;U<0?s=0:(U*=U,s=U*U*this._dot(this.grad3[w],S,A));let z=.5-M*M-E*E;return z<0?r=0:(z*=z,r=z*z*this._dot(this.grad3[C],M,E)),70*(n+s+r)}noise3d(e,t,n){let s,r,a,o,l=(e+t+n)*.3333333333333333,h=Math.floor(e+l),u=Math.floor(t+l),d=Math.floor(n+l),f=1/6,p=(h+u+d)*f,_=h-p,m=u-p,g=d-p,S=e-_,A=t-m,M=n-g,E,v,b,x,w,C;S>=A?A>=M?(E=1,v=0,b=0,x=1,w=1,C=0):S>=M?(E=1,v=0,b=0,x=1,w=0,C=1):(E=0,v=0,b=1,x=1,w=0,C=1):A<M?(E=0,v=0,b=1,x=0,w=1,C=1):S<M?(E=0,v=1,b=0,x=0,w=1,C=1):(E=0,v=1,b=0,x=1,w=1,C=0);let I=S-E+f,U=A-v+f,z=M-b+f,O=S-x+2*f,k=A-w+2*f,j=M-C+2*f,R=S-1+3*f,F=A-1+3*f,G=M-1+3*f,q=h&255,X=u&255,he=d&255,ge=this.perm[q+this.perm[X+this.perm[he]]]%12,Fe=this.perm[q+E+this.perm[X+v+this.perm[he+b]]]%12,Te=this.perm[q+x+this.perm[X+w+this.perm[he+C]]]%12,Ve=this.perm[q+1+this.perm[X+1+this.perm[he+1]]]%12,ee=.6-S*S-A*A-M*M;ee<0?s=0:(ee*=ee,s=ee*ee*this._dot3(this.grad3[ge],S,A,M));let ie=.6-I*I-U*U-z*z;ie<0?r=0:(ie*=ie,r=ie*ie*this._dot3(this.grad3[Fe],I,U,z));let fe=.6-O*O-k*k-j*j;fe<0?a=0:(fe*=fe,a=fe*fe*this._dot3(this.grad3[Te],O,k,j));let Pe=.6-R*R-F*F-G*G;return Pe<0?o=0:(Pe*=Pe,o=Pe*Pe*this._dot3(this.grad3[Ve],R,F,G)),32*(s+r+a+o)}noise4d(e,t,n,s){let r=this.grad4,a=this.simplex,o=this.perm,c=(Math.sqrt(5)-1)/4,l=(5-Math.sqrt(5))/20,h,u,d,f,p,_=(e+t+n+s)*c,m=Math.floor(e+_),g=Math.floor(t+_),S=Math.floor(n+_),A=Math.floor(s+_),M=(m+g+S+A)*l,E=m-M,v=g-M,b=S-M,x=A-M,w=e-E,C=t-v,I=n-b,U=s-x,z=w>C?32:0,O=w>I?16:0,k=C>I?8:0,j=w>U?4:0,R=C>U?2:0,F=I>U?1:0,G=z+O+k+j+R+F,q=a[G][0]>=3?1:0,X=a[G][1]>=3?1:0,he=a[G][2]>=3?1:0,ge=a[G][3]>=3?1:0,Fe=a[G][0]>=2?1:0,Te=a[G][1]>=2?1:0,Ve=a[G][2]>=2?1:0,ee=a[G][3]>=2?1:0,ie=a[G][0]>=1?1:0,fe=a[G][1]>=1?1:0,Pe=a[G][2]>=1?1:0,ye=a[G][3]>=1?1:0,Oe=w-q+l,Qe=C-X+l,ae=I-he+l,ue=U-ge+l,se=w-Fe+2*l,oe=C-Te+2*l,de=I-Ve+2*l,xe=U-ee+2*l,Me=w-ie+3*l,Q=C-fe+3*l,qe=I-Pe+3*l,B=U-ye+3*l,rt=w-1+4*l,nt=C-1+4*l,P=I-1+4*l,y=U-1+4*l,W=m&255,Y=g&255,te=S&255,me=A&255,ve=o[W+o[Y+o[te+o[me]]]]%32,re=o[W+q+o[Y+X+o[te+he+o[me+ge]]]]%32,le=o[W+Fe+o[Y+Te+o[te+Ve+o[me+ee]]]]%32,Ee=o[W+ie+o[Y+fe+o[te+Pe+o[me+ye]]]]%32,ke=o[W+1+o[Y+1+o[te+1+o[me+1]]]]%32,be=.6-w*w-C*C-I*I-U*U;be<0?h=0:(be*=be,h=be*be*this._dot4(r[ve],w,C,I,U));let _e=.6-Oe*Oe-Qe*Qe-ae*ae-ue*ue;_e<0?u=0:(_e*=_e,u=_e*_e*this._dot4(r[re],Oe,Qe,ae,ue));let ze=.6-se*se-oe*oe-de*de-xe*xe;ze<0?d=0:(ze*=ze,d=ze*ze*this._dot4(r[le],se,oe,de,xe));let Xe=.6-Me*Me-Q*Q-qe*qe-B*B;Xe<0?f=0:(Xe*=Xe,f=Xe*Xe*this._dot4(r[Ee],Me,Q,qe,B));let Ke=.6-rt*rt-nt*nt-P*P-y*y;return Ke<0?p=0:(Ke*=Ke,p=Ke*Ke*this._dot4(r[ke],rt,nt,P,y)),27*(h+u+d+f+p)}_dot(e,t,n){return e[0]*t+e[1]*n}_dot3(e,t,n,s){return e[0]*t+e[1]*n+e[2]*s}_dot4(e,t,n,s,r){return e[0]*t+e[1]*n+e[2]*s+e[3]*r}};var ha=class i extends Mn{constructor(e,t,n=512,s=512,r,a,o){super(),this.width=n,this.height=s,this.clear=!0,this.camera=t,this.scene=e,this.output=0,this._renderGBuffer=!0,this._visibilityCache=[],this.blendIntensity=1,this.pdRings=2,this.pdRadiusExponent=2,this.pdSamples=16,this.gtaoNoiseTexture=Sd(),this.pdNoiseTexture=this._generateNoise(),this.gtaoRenderTarget=new Ct(this.width,this.height,{type:Vt,depthBuffer:!1}),this.pdRenderTarget=this.gtaoRenderTarget.clone(),this.gtaoMaterial=new Pt({defines:Object.assign({},oa.defines),uniforms:Rn.clone(oa.uniforms),vertexShader:oa.vertexShader,fragmentShader:oa.fragmentShader,blending:Nt,depthTest:!1,depthWrite:!1}),this.gtaoMaterial.defines.PERSPECTIVE_CAMERA=this.camera.isPerspectiveCamera?1:0,this.gtaoMaterial.uniforms.tNoise.value=this.gtaoNoiseTexture,this.gtaoMaterial.uniforms.resolution.value.set(this.width,this.height),this.gtaoMaterial.uniforms.cameraNear.value=this.camera.near,this.gtaoMaterial.uniforms.cameraFar.value=this.camera.far,this.normalMaterial=new Ar,this.normalMaterial.blending=Nt,this.pdMaterial=new Pt({defines:Object.assign({},ca.defines),uniforms:Rn.clone(ca.uniforms),vertexShader:ca.vertexShader,fragmentShader:ca.fragmentShader,depthTest:!1,depthWrite:!1}),this.pdMaterial.uniforms.tDiffuse.value=this.gtaoRenderTarget.texture,this.pdMaterial.uniforms.tNoise.value=this.pdNoiseTexture,this.pdMaterial.uniforms.resolution.value.set(this.width,this.height),this.pdMaterial.uniforms.lumaPhi.value=10,this.pdMaterial.uniforms.depthPhi.value=2,this.pdMaterial.uniforms.normalPhi.value=3,this.pdMaterial.uniforms.radius.value=8,this.depthRenderMaterial=new Pt({defines:Object.assign({},la.defines),uniforms:Rn.clone(la.uniforms),vertexShader:la.vertexShader,fragmentShader:la.fragmentShader,blending:Nt}),this.depthRenderMaterial.uniforms.cameraNear.value=this.camera.near,this.depthRenderMaterial.uniforms.cameraFar.value=this.camera.far,this.copyMaterial=new Pt({uniforms:Rn.clone(Xs.uniforms),vertexShader:Xs.vertexShader,fragmentShader:Xs.fragmentShader,transparent:!0,depthTest:!1,depthWrite:!1,blendSrc:kr,blendDst:Gi,blendEquation:An,blendSrcAlpha:Vr,blendDstAlpha:Gi,blendEquationAlpha:An}),this.blendMaterial=new Pt({uniforms:Rn.clone(Il.uniforms),vertexShader:Il.vertexShader,fragmentShader:Il.fragmentShader,transparent:!0,depthTest:!1,depthWrite:!1,blending:Co,blendSrc:kr,blendDst:Gi,blendEquation:An,blendSrcAlpha:Vr,blendDstAlpha:Gi,blendEquationAlpha:An}),this._fsQuad=new Ai(null),this._originalClearColor=new tt,this.setGBuffer(r?r.depthTexture:void 0,r?r.normalTexture:void 0),a!==void 0&&this.updateGtaoMaterial(a),o!==void 0&&this.updatePdMaterial(o)}setSize(e,t){this.width=e,this.height=t,this.gtaoRenderTarget.setSize(e,t),this.normalRenderTarget.setSize(e,t),this.pdRenderTarget.setSize(e,t),this.gtaoMaterial.uniforms.resolution.value.set(e,t),this.gtaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix),this.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this.pdMaterial.uniforms.resolution.value.set(e,t),this.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse)}dispose(){this.gtaoNoiseTexture.dispose(),this.pdNoiseTexture.dispose(),this.normalRenderTarget.dispose(),this.gtaoRenderTarget.dispose(),this.pdRenderTarget.dispose(),this.normalMaterial.dispose(),this.pdMaterial.dispose(),this.copyMaterial.dispose(),this.depthRenderMaterial.dispose(),this._fsQuad.dispose()}get gtaoMap(){return this.pdRenderTarget.texture}setGBuffer(e,t){e!==void 0?(this.depthTexture=e,this.normalTexture=t,this._renderGBuffer=!1):(this.depthTexture=new Wn,this.depthTexture.format=qn,this.depthTexture.type=Ti,this.normalRenderTarget=new Ct(this.width,this.height,{minFilter:Dt,magFilter:Dt,type:Vt,depthTexture:this.depthTexture}),this.normalTexture=this.normalRenderTarget.texture,this._renderGBuffer=!0);let n=this.normalTexture?1:0,s=this.depthTexture===this.normalTexture?"w":"x";this.gtaoMaterial.defines.NORMAL_VECTOR_TYPE=n,this.gtaoMaterial.defines.DEPTH_SWIZZLING=s,this.gtaoMaterial.uniforms.tNormal.value=this.normalTexture,this.gtaoMaterial.uniforms.tDepth.value=this.depthTexture,this.pdMaterial.defines.NORMAL_VECTOR_TYPE=n,this.pdMaterial.defines.DEPTH_SWIZZLING=s,this.pdMaterial.uniforms.tNormal.value=this.normalTexture,this.pdMaterial.uniforms.tDepth.value=this.depthTexture,this.depthRenderMaterial.uniforms.tDepth.value=this.normalRenderTarget.depthTexture}setSceneClipBox(e){e?(this.gtaoMaterial.needsUpdate=this.gtaoMaterial.defines.SCENE_CLIP_BOX!==1,this.gtaoMaterial.defines.SCENE_CLIP_BOX=1,this.gtaoMaterial.uniforms.sceneBoxMin.value.copy(e.min),this.gtaoMaterial.uniforms.sceneBoxMax.value.copy(e.max)):(this.gtaoMaterial.needsUpdate=this.gtaoMaterial.defines.SCENE_CLIP_BOX===0,this.gtaoMaterial.defines.SCENE_CLIP_BOX=0)}updateGtaoMaterial(e){e.radius!==void 0&&(this.gtaoMaterial.uniforms.radius.value=e.radius),e.distanceExponent!==void 0&&(this.gtaoMaterial.uniforms.distanceExponent.value=e.distanceExponent),e.thickness!==void 0&&(this.gtaoMaterial.uniforms.thickness.value=e.thickness),e.distanceFallOff!==void 0&&(this.gtaoMaterial.uniforms.distanceFallOff.value=e.distanceFallOff,this.gtaoMaterial.needsUpdate=!0),e.scale!==void 0&&(this.gtaoMaterial.uniforms.scale.value=e.scale),e.samples!==void 0&&e.samples!==this.gtaoMaterial.defines.SAMPLES&&(this.gtaoMaterial.defines.SAMPLES=e.samples,this.gtaoMaterial.needsUpdate=!0),e.screenSpaceRadius!==void 0&&(e.screenSpaceRadius?1:0)!==this.gtaoMaterial.defines.SCREEN_SPACE_RADIUS&&(this.gtaoMaterial.defines.SCREEN_SPACE_RADIUS=e.screenSpaceRadius?1:0,this.gtaoMaterial.needsUpdate=!0)}updatePdMaterial(e){let t=!1;e.lumaPhi!==void 0&&(this.pdMaterial.uniforms.lumaPhi.value=e.lumaPhi),e.depthPhi!==void 0&&(this.pdMaterial.uniforms.depthPhi.value=e.depthPhi),e.normalPhi!==void 0&&(this.pdMaterial.uniforms.normalPhi.value=e.normalPhi),e.radius!==void 0&&e.radius!==this.radius&&(this.pdMaterial.uniforms.radius.value=e.radius),e.radiusExponent!==void 0&&e.radiusExponent!==this.pdRadiusExponent&&(this.pdRadiusExponent=e.radiusExponent,t=!0),e.rings!==void 0&&e.rings!==this.pdRings&&(this.pdRings=e.rings,t=!0),e.samples!==void 0&&e.samples!==this.pdSamples&&(this.pdSamples=e.samples,t=!0),t&&(this.pdMaterial.defines.SAMPLES=this.pdSamples,this.pdMaterial.defines.SAMPLE_VECTORS=uh(this.pdSamples,this.pdRings,this.pdRadiusExponent),this.pdMaterial.needsUpdate=!0)}render(e,t,n){switch(this._renderGBuffer&&(this._overrideVisibility(),this._renderOverride(e,this.normalMaterial,this.normalRenderTarget,7829503,1),this._restoreVisibility()),this.gtaoMaterial.uniforms.cameraNear.value=this.camera.near,this.gtaoMaterial.uniforms.cameraFar.value=this.camera.far,this.gtaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix),this.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this.gtaoMaterial.uniforms.cameraWorldMatrix.value.copy(this.camera.matrixWorld),this._renderPass(e,this.gtaoMaterial,this.gtaoRenderTarget,16777215,1),this.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this._renderPass(e,this.pdMaterial,this.pdRenderTarget,16777215,1),this.output){case i.OUTPUT.Off:break;case i.OUTPUT.Diffuse:this.copyMaterial.uniforms.tDiffuse.value=n.texture,this.copyMaterial.blending=Nt,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:t);break;case i.OUTPUT.AO:this.copyMaterial.uniforms.tDiffuse.value=this.gtaoRenderTarget.texture,this.copyMaterial.blending=Nt,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:t);break;case i.OUTPUT.Denoise:this.copyMaterial.uniforms.tDiffuse.value=this.pdRenderTarget.texture,this.copyMaterial.blending=Nt,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:t);break;case i.OUTPUT.Depth:this.depthRenderMaterial.uniforms.cameraNear.value=this.camera.near,this.depthRenderMaterial.uniforms.cameraFar.value=this.camera.far,this._renderPass(e,this.depthRenderMaterial,this.renderToScreen?null:t);break;case i.OUTPUT.Normal:this.copyMaterial.uniforms.tDiffuse.value=this.normalRenderTarget.texture,this.copyMaterial.blending=Nt,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:t);break;case i.OUTPUT.Default:this.copyMaterial.uniforms.tDiffuse.value=n.texture,this.copyMaterial.blending=Nt,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:t),this.blendMaterial.uniforms.intensity.value=this.blendIntensity,this.blendMaterial.uniforms.tDiffuse.value=this.pdRenderTarget.texture,this._renderPass(e,this.blendMaterial,this.renderToScreen?null:t);break;default:console.warn("THREE.GTAOPass: Unknown output type.")}}_renderPass(e,t,n,s,r){e.getClearColor(this._originalClearColor);let a=e.getClearAlpha(),o=e.autoClear;e.setRenderTarget(n),e.autoClear=!1,s!=null&&(e.setClearColor(s),e.setClearAlpha(r||0),e.clear()),this._fsQuad.material=t,this._fsQuad.render(e),e.autoClear=o,e.setClearColor(this._originalClearColor),e.setClearAlpha(a)}_renderOverride(e,t,n,s,r){e.getClearColor(this._originalClearColor);let a=e.getClearAlpha(),o=e.autoClear;e.setRenderTarget(n),e.autoClear=!1,s=t.clearColor||s,r=t.clearAlpha||r,s!=null&&(e.setClearColor(s),e.setClearAlpha(r||0),e.clear()),this.scene.overrideMaterial=t,e.render(this.scene,this.camera),this.scene.overrideMaterial=null,e.autoClear=o,e.setClearColor(this._originalClearColor),e.setClearAlpha(a)}_overrideVisibility(){let e=this.scene,t=this._visibilityCache;e.traverse(function(n){(n.isPoints||n.isLine||n.isLine2)&&n.visible&&(n.visible=!1,t.push(n))})}_restoreVisibility(){let e=this._visibilityCache;for(let t=0;t<e.length;t++)e[t].visible=!0;e.length=0}_generateNoise(e=64){let t=new Dl,n=e*e*4,s=new Uint8Array(n);for(let a=0;a<e;a++)for(let o=0;o<e;o++){let c=a,l=o;s[(a*e+o)*4]=(t.noise(c,l)*.5+.5)*255,s[(a*e+o)*4+1]=(t.noise(c+e,l)*.5+.5)*255,s[(a*e+o)*4+2]=(t.noise(c,l+e)*.5+.5)*255,s[(a*e+o)*4+3]=(t.noise(c+e,l+e)*.5+.5)*255}let r=new si(s,e,e,un,tn);return r.wrapS=qt,r.wrapT=qt,r.needsUpdate=!0,r}};ha.OUTPUT={Off:-1,Default:0,Diffuse:1,Depth:2,Normal:3,AO:4,Denoise:5};var ua={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`};var Ll=class extends Mn{constructor(){super(),this.isOutputPass=!0,this.uniforms=Rn.clone(ua.uniforms),this.material=new Ps({name:ua.name,uniforms:this.uniforms,vertexShader:ua.vertexShader,fragmentShader:ua.fragmentShader}),this._fsQuad=new Ai(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,n){this.uniforms.tDiffuse.value=n.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},ct.getTransfer(this._outputColorSpace)===pt&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===Hr?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===Gr?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===Wr?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===Wi?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===qr?this.material.defines.AGX_TONE_MAPPING="":this._toneMapping===Yr?this.material.defines.NEUTRAL_TONE_MAPPING="":this._toneMapping===Xr&&(this.material.defines.CUSTOM_TONE_MAPPING=""),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}};var Nl=class extends Rt{constructor(e=document.createElement("div")){super(),this.isCSS2DObject=!0,this.element=e,this.element.style.position="absolute",this.element.style.userSelect="none",this.element.setAttribute("draggable",!1),this.center=new pe(.5,.5),this.rotation2D=0,this.addEventListener("removed",function(){this.traverse(function(t){t.element&&t.element instanceof t.element.ownerDocument.defaultView.Element&&t.element.parentNode!==null&&t.element.remove()})})}copy(e,t){return super.copy(e,t),this.element=e.element.cloneNode(!0),this.center=e.center,this.rotation2D=e.rotation2D,this}},qs=new D,bd=new Ne,Ed=new Ne,Td=new D,wd=new D,Ul=class{constructor(e={}){let t=this,n,s,r,a,o={objects:new WeakMap},c=e.element!==void 0?e.element:document.createElement("div");c.style.overflow="hidden",this.domElement=c,this.sortObjects=!0,this.getSize=function(){return{width:n,height:s}},this.render=function(p,_){p.matrixWorldAutoUpdate===!0&&p.updateMatrixWorld(),_.parent===null&&_.matrixWorldAutoUpdate===!0&&_.updateMatrixWorld(),bd.copy(_.matrixWorldInverse),Ed.multiplyMatrices(_.projectionMatrix,bd),h(p,p,_),this.sortObjects&&f(p)},this.setSize=function(p,_){n=p,s=_,r=n/2,a=s/2,c.style.width=p+"px",c.style.height=_+"px"};function l(p){p.isCSS2DObject&&(p.element.style.display="none");for(let _=0,m=p.children.length;_<m;_++)l(p.children[_])}function h(p,_,m){if(p.visible===!1){l(p);return}if(p.isCSS2DObject){qs.setFromMatrixPosition(p.matrixWorld),qs.applyMatrix4(Ed);let g=qs.z>=-1&&qs.z<=1&&p.layers.test(m.layers)===!0,S=p.element;if(S.style.display=g===!0?"":"none",g===!0){p.onBeforeRender(t,_,m);let M=100*p.center.x,E=100*p.center.y;S.style.transformOrigin=`${M}% ${E}%`;let v=-p.rotation2D,b=qs.x*r+r,x=-qs.y*a+a;S.style.transform=`translate(${-M}%, ${-E}%) translate(${b}px, ${x}px) rotate(${v}rad)`,S.parentNode!==c&&c.appendChild(S),p.onAfterRender(t,_,m)}let A={distanceToCameraSquared:u(m,p)};o.objects.set(p,A)}for(let g=0,S=p.children.length;g<S;g++)h(p.children[g],_,m)}function u(p,_){return Td.setFromMatrixPosition(p.matrixWorld),wd.setFromMatrixPosition(_.matrixWorld),Td.distanceToSquared(wd)}function d(p){let _=[];return p.traverseVisible(function(m){m.isCSS2DObject&&_.push(m)}),_}function f(p){let _=d(p).sort(function(g,S){if(g.renderOrder!==S.renderOrder)return S.renderOrder-g.renderOrder;let A=o.objects.get(g).distanceToCameraSquared,M=o.objects.get(S).distanceToCameraSquared;return A-M}),m=_.length;for(let g=0,S=_.length;g<S;g++)_[g].element.style.zIndex=m-g}}};var ft={remera:["#F2F0EB","#1E1F22","#E8E1D3","#C9573A","#2B3A55","#8E6F7E","#5E6B4E","#B8C7D9","#D9A066","#7A2E35"],musculosa:["#F2F0EB","#1E1F22","#8C8F94","#2B3A55"],buzo:["#1F2023","#2C3B57","#8E9196","#C98B5B","#E3DED5","#8E6F7E","#3E5F6E","#D27A3E","#B49A78","#6B2E35"],sweater:["#B49A78","#2C3B57","#56604A","#7B5B43","#D8D1C4","#3E5F6E"],campera:["#1C1D20","#26282B","#4D5240","#B08A64","#25324A","#3A3D42","#5A3F2E"],camisa:["#F4F3EF","#AFC6DD","#E6D9CC","#B9C9B5","#2A3B5A","#D8CBB4","#7C8FA6"],jean:["#2B3F5C","#3C5A80","#1E2A3B","#5E7BA0","#46607F","#6F8BAE","#2F3237","#4A4D52"],pantalon:["#2F3237","#C2AE8E","#4D5240","#2A3348","#7D6A52","#8E9196","#6B2E2E","#A9B4A0","#D1C3A6"],bermuda:["#C2AE8E","#2A3348","#4D5240","#8E9196","#5E7BA0","#1F2023"],vestido:["#2B3A55","#7A2E35","#1E1F22","#D9D4CB"],pollera:["#2B3A55","#1E1F22","#C9B79C"],zapatilla:["#F2F0EB","#1E1F22","#E8E4DC","#8C8F94"],gorra:["#1E1F22","#2B3A55","#C9B79C","#F2F0EB","#7A2E35","#5E6B4E","#B8C7D9"],medias:["#F2F0EB","#1E1F22","#8C8F94","#C9573A"],accesorio:["#1E1F22","#2B3A55","#C9573A","#E8E1D3","#5E6B4E","#8E6F7E"],saco:["#2B2D31","#3A3C40","#8C8577","#1E1F22","#55585D","#A39A88","#46484C"],cinto:["#5A3A24","#2A1D16","#7A4A2A","#1C1A19","#8C5A3A","#B0703E"]},fn={remera:["corta",30,1],musculosa:["corta",28,1],buzo:["larga",34,1.4],sweater:["larga",32,1.3],campera:["larga",38,2.3],camisa:["larga",36,1],saco:["larga",36,1.25],vestido:["larga",44,1],pollera:["pantalon",24,1],jean:["pantalon",40,1.3],pantalon:["pantalon",40,1.1],bermuda:["pantalon",22,1.2]},Ki={gorra:1,medias:1,accesorio:1,zapatilla:1};function At(i){let e=i>>>0;return function(){e|=0,e=e+1831565813|0;let t=Math.imul(e^e>>>15,1|e);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}function _t(i,e){return i[Math.floor(e()*i.length)%i.length]}function Ad(i){let e=0;i=String(i||"");for(let t=0;t<i.length;t++)e=e*31+i.charCodeAt(t)>>>0;return e}function Jn(i,e,t){let n=document.createElement("canvas");n.width=i,n.height=e,t(n.getContext("2d"),i,e);let s=new pr(n);return s.colorSpace=Yt,s.anisotropy=4,s}function dh(i,e,t,n){let s=Jn(512,512,r=>{let a=At(n||7);r.fillStyle=i,r.fillRect(0,0,512,512);for(let o=0;o<260;o++){let c=a()*512,l=.04+a()*.1,h=a()<.6;r.strokeStyle=h?e.replace("A",l):t.replace("A",l),r.lineWidth=.6+a()*2.2,r.beginPath(),r.moveTo(0,c);for(let u=0;u<=512;u+=32)r.lineTo(u,c+Math.sin(u/70+o)*3+(a()-.5)*2);r.stroke()}});return s.wrapS=s.wrapT=qt,s}function wx(){let i=Jn(256,256,e=>{let t=At(11);e.fillStyle="#4A362B",e.fillRect(0,0,256,256);for(let n=0;n<420;n++){let s=t()*256,r=t()*256,a=2+t()*14;e.fillStyle=["rgba(122,72,40,","rgba(60,46,40,","rgba(150,96,58,","rgba(38,32,30,"][n%4]+(.15+t()*.35)+")",e.beginPath(),e.ellipse(s,r,a,a*(.3+t()),t()*3,0,7),e.fill()}});return i.wrapS=i.wrapT=qt,i}function Ax(){let i=Jn(256,256,e=>{let t=At(23);e.fillStyle="#5E3B26",e.fillRect(0,0,256,256);for(let n=0;n<2600;n++)e.fillStyle=["rgba(140,82,44,","rgba(52,33,24,","rgba(170,104,58,","rgba(80,52,36,"][n%4]+(.15+t()*.35)+")",e.fillRect(t()*256,t()*256,1+t()*2.2,1+t()*2.2);for(let n=0;n<26;n++){let s=t()*256,r=e.createLinearGradient(0,0,0,256);r.addColorStop(0,"rgba(40,26,18,0)"),r.addColorStop(.5+t()*.4,"rgba(40,26,18,.22)"),r.addColorStop(1,"rgba(40,26,18,0)"),e.fillStyle=r,e.fillRect(s,0,1.5+t()*3,256)}});return i.wrapS=i.wrapT=qt,i}function Cd(i){let e=Jn(128,128,(t,n)=>{let s=At(i?41:37);if(t.fillStyle="#EFEFEF",t.fillRect(0,0,n,n),i)for(let r=-n;r<n*2;r+=3)t.strokeStyle="rgba(0,0,0,"+(.06+s()*.08)+")",t.lineWidth=1.3,t.beginPath(),t.moveTo(r,0),t.lineTo(r+n,n),t.stroke();else{for(let r=0;r<n;r+=2)t.fillStyle="rgba(0,0,0,"+(.03+s()*.05)+")",t.fillRect(0,r,n,1);for(let r=0;r<n;r+=2)t.fillStyle="rgba(255,255,255,"+(.03+s()*.05)+")",t.fillRect(r,0,1,n)}for(let r=0;r<900;r++)t.fillStyle="rgba(0,0,0,"+s()*.05+")",t.fillRect(s()*n,s()*n,1,1)});return e.wrapS=e.wrapT=qt,e}function Cx(i){let e=Jn(64,64,t=>{let n=t.createLinearGradient(0,0,0,64);n.addColorStop(0,"rgba(255,255,255,0)"),n.addColorStop(.5,"rgba(255,255,255,1)"),n.addColorStop(1,"rgba(255,255,255,0)"),t.fillStyle=n,t.fillRect(0,0,64,64)});return e.colorSpace=Bn,i&&(e.center.set(.5,.5),e.rotation=Math.PI/2),e}function Rx(i,e){return Jn(256,320,(t,n,s)=>{if(i===0){let r=t.createLinearGradient(0,0,0,s);r.addColorStop(0,"#0E2233"),r.addColorStop(.55,"#1F4E6B"),r.addColorStop(1,"#BFD7E2"),t.fillStyle=r,t.fillRect(0,0,n,s);for(let a=0;a<40;a++){t.strokeStyle="rgba(230,245,250,"+(.2+e()*.5)+")",t.lineWidth=1+e()*3,t.beginPath();let o=s*.4+e()*s*.6;t.moveTo(0,o),t.bezierCurveTo(n*.3,o-20*e(),n*.6,o+20*e(),n,o-10),t.stroke()}}else if(i===1){let r=t.createLinearGradient(0,0,0,s);r.addColorStop(0,"#E9B17A"),r.addColorStop(.6,"#C9706A"),r.addColorStop(1,"#3B2B3F"),t.fillStyle=r,t.fillRect(0,0,n,s),t.fillStyle="#2B2333",t.beginPath(),t.moveTo(0,s*.75),t.lineTo(n*.35,s*.42),t.lineTo(n*.55,s*.6),t.lineTo(n*.78,s*.35),t.lineTo(n,s*.62),t.lineTo(n,s),t.lineTo(0,s),t.fill(),t.fillStyle="rgba(255,240,220,.8)",t.beginPath(),t.arc(n*.7,s*.2,18,0,7),t.fill()}else{t.fillStyle="#ECE8E1",t.fillRect(0,0,n,s),t.strokeStyle="#1E1F22",t.lineWidth=3,t.beginPath();for(let r=0;r<6;r++)t.arc(n/2+(e()-.5)*60,s/2+(e()-.5)*80,30+e()*60,e()*6,e()*6+2.5);t.stroke(),t.fillStyle="#1E1F22",t.font="700 22px Manrope, sans-serif",t.textAlign="center",t.fillText("VDH",n/2,s-26)}})}function Px(i){return Jn(1024,256,(e,t,n)=>{e.clearRect(0,0,t,n),e.font="800 "+(i.length>4?120:190)+'px Manrope, "Arial Black", sans-serif',e.textAlign="center",e.textBaseline="middle",e.shadowColor="rgba(190,235,255,.95)",e.shadowBlur=30,e.lineWidth=10,e.strokeStyle="rgba(200,240,255,.9)",e.strokeText(i,t/2,n/2+6),e.shadowBlur=10,e.fillStyle="#FFFFFF",e.fillText(i,t/2,n/2+6)})}function Ix(){let i=Jn(128,128,(e,t)=>{e.clearRect(0,0,t,t),e.strokeStyle="#FFFFFF",e.lineWidth=9,e.lineJoin="round";for(let n=-1;n<=2;n++)for(let s=-1;s<=2;s++){let r=n*64+(s%2?32:0),a=s*32;e.beginPath(),e.moveTo(r,a),e.lineTo(r+32,a+32),e.lineTo(r,a+64),e.lineTo(r-32,a+32),e.closePath(),e.stroke()}});return i.wrapS=i.wrapT=qt,i}function gh(i,e,t){let n=Jn(256,256,(s,r)=>{s.fillStyle=i,s.fillRect(0,0,r,r);let a=r/t;for(let o=0;o<t;o++)for(let c=0;c<t;c++)s.fillStyle="rgba(255,255,255,"+(.02+(o*7+c*3)%5*.012)+")",s.fillRect(o*a+1,c*a+1,a-2,a-2);s.strokeStyle=e,s.lineWidth=2;for(let o=0;o<=t;o++)s.beginPath(),s.moveTo(o*a,0),s.lineTo(o*a,r),s.stroke(),s.beginPath(),s.moveTo(0,o*a),s.lineTo(r,o*a),s.stroke()});return n.wrapS=n.wrapT=qt,n}function xh(i,e){let t=new Er(i,{depth:1.4,bevelEnabled:!0,bevelThickness:.8,bevelSize:.6,bevelSegments:2,curveSegments:6});t.translate(0,0,-.7);let n=t.attributes.position;for(let s=0;s<n.count;s++){let r=n.getX(s),a=n.getY(s),o=Math.min(1,Math.max(0,-a/e));n.setZ(s,n.getZ(s)+(Math.sin(r*.9)*.55+Math.sin(r*2.3+1.3)*.22)*o),n.setX(s,r*(1+.05*o))}return t.scale(1,1/e,1),t.computeVertexNormals(),t}function vh(i,e){let t=i.getPoints(6),n=new ri;return t.forEach((s,r)=>{if(!r){n.moveTo(s.x,s.y);return}let a=t[r-1],o=Math.max(1,Math.ceil(a.distanceTo(s)/e));for(let c=1;c<=o;c++)n.lineTo(a.x+(s.x-a.x)*c/o,a.y+(s.y-a.y)*c/o)}),n}function Dx(){let i=new ri;return i.moveTo(-2.8,0),i.quadraticCurveTo(0,-1.6,2.8,0),i.lineTo(9.4,-1.8),i.lineTo(13,-8.5),i.lineTo(9.6,-10.5),i.lineTo(8.4,-8),i.lineTo(8.6,-30),i.lineTo(-8.6,-30),i.lineTo(-8.4,-8),i.lineTo(-9.6,-10.5),i.lineTo(-13,-8.5),i.lineTo(-9.4,-1.8),i.lineTo(-2.8,0),xh(vh(i,1.5),30)}function Lx(){let i=new ri;return i.moveTo(-2.8,0),i.quadraticCurveTo(0,-1.8,2.8,0),i.lineTo(9,-2.2),i.quadraticCurveTo(10.8,-3.2,11.2,-6),i.lineTo(11.6,-36),i.lineTo(8.8,-37),i.lineTo(7.8,-9),i.lineTo(8,-40),i.lineTo(-8,-40),i.lineTo(-7.8,-9),i.lineTo(-8.8,-37),i.lineTo(-11.6,-36),i.lineTo(-11.2,-6),i.quadraticCurveTo(-10.8,-3.2,-9,-2.2),i.lineTo(-2.8,0),xh(vh(i,1.5),40)}function Nx(){let i=new ri;return i.moveTo(-7,0),i.lineTo(7,0),i.lineTo(7.4,-40),i.lineTo(1.4,-40),i.lineTo(0,-9),i.lineTo(-1.4,-40),i.lineTo(-7.4,-40),i.lineTo(-7,0),xh(vh(i,1.5),40)}var Ot={};function Ud(){return Ot.corta||(Ot.corta=Dx(),Ot.larga=Lx(),Ot.pantalon=Nx(),Ot.doblada=new Zn(12,2,14,2,.5),Ot.jeanDoblado=new Zn(13,2.8,15,2,.8),Ot.zapatilla=new Zn(4,3.4,10.5,2,1.5),Ot.percha=new Lt(17,.9,.7),Ot.gancho=new wr(1.2,.18,4,8,Math.PI*1.3),Ot.copa=new ai(3.3,14,8,0,Math.PI*2,0,Math.PI/2),Ot.visera=new cn(3.4,3.4,.4,14,1,!1,-Math.PI/2,Math.PI),Ot.caja=new Zn(5.4,6.8,2.2,1,.3),Ot.media=new cn(1.2,1.2,4.4,10),Ot.cinto=new Lt(1.3,1,.35).translate(0,-.5,0),Ot.bolso=new Zn(9,6,4.5,2,1.2),Ot.cajaZapato=new Lt(10,3.8,6.4),Ot.disco=new cn(2.2,2.2,.3,16).rotateZ(Math.PI/2),Ot.carton=new Zn(10,8,15,1,.3)),Ot}var Zi=class{constructor(){this.por=new Map}add(e,t,n){let s=t.index?t.toNonIndexed():t.clone();s.applyMatrix4(n);for(let r of Object.keys(s.attributes))r!=="position"&&r!=="normal"&&r!=="uv"&&s.deleteAttribute(r);this.por.has(e)||this.por.set(e,[]),this.por.get(e).push(s)}caja(e,t,n,s,r,a,o,c){let l=new Lt(t,n,s);if(e.userData.veta){let h=l.attributes.uv,u=l.attributes.normal,d=e.userData.veta;for(let f=0;f<h.count;f++){let p=Math.abs(u.getX(f)),_=Math.abs(u.getY(f)),m=p>.5?[s,n]:_>.5?[t,s]:[t,n],g=m[1]>m[0]*2.5;h.setXY(f,(g?h.getY(f)*m[1]:h.getX(f)*m[0])/d,(g?h.getX(f)*m[0]:h.getY(f)*m[1])/d)}}this.add(e,l,new Ne().makeRotationY(c||0).setPosition(r,a,o))}cilindro(e,t,n,s,r,a,o,c){this.add(e,new cn(t,n,s,c||16),new Ne().setPosition(r,a,o))}armar(e,t){for(let[n,s]of this.por){let r=new ut(ch(s,!1),n);r.castShadow=t!==!1&&!n.userData.sinSombra,r.receiveShadow=!n.userData.sinSombra,e.add(r)}}},_h=class{constructor(){this.por={}}add(e,t,n){(this.por[e]=this.por[e]||[]).push([t,n])}armar(e){let t=Ud(),n=new tt;for(let s in this.por){let r={percha:L.percha,gancho:L.cano,corta:L.tela,larga:L.tela,pantalon:L.tela,doblada:L.telaDoblada,jeanDoblado:L.denim},a=this.por[s],o=r[s]||L.liso,c=o!==L.percha&&o!==L.cano,l=new zi(t[s],o,a.length);a.forEach((h,u)=>{l.setMatrixAt(u,h[0]),c&&l.setColorAt(u,n.set(h[1]))}),l.castShadow=s!=="gancho",l.receiveShadow=!0,e.add(l)}}},L={};function Ux(i){let e=i||"calle";if(L._estilo===e)return L;L._estilo=e;let t=dh("#7A5236","rgba(40,24,14,A)","rgba(185,130,85,A)",7),n=dh("#C9A47A","rgba(110,78,48,A)","rgba(235,205,165,A)",9);L.estante=new Ye({map:t,roughness:.6}),L.estante.userData.veta=110,L.nogal=L.estante,L.roble=new Ye({map:n,roughness:.55}),L.roble.userData.veta=120,L.hierro=new Ye({map:wx(),roughness:.62,metalness:.55}),L.hierro.userData.veta=40,L.cano=new Ye({color:"#16171A",roughness:.35,metalness:.8}),L.metal=L.cano,L.escalera=new Ye({color:"#141518",roughness:.5,metalness:.6}),L.percha=new Ye({color:"#C77F3E",roughness:.45}),L.pared=new Ye({color:e==="shopping"?"#202125":"#5F6158",roughness:.9}),e==="shopping"?(L.paredFondo=new Ye({map:gh("#17181B","#2E3036",8),roughness:.22,metalness:.15}),L.paredFondo.userData.veta=90):L.paredFondo=L.pared,L.tapaPared=new Ye({color:"#26272A",roughness:.8});let s=Cd(!1),r=s.clone(),a=Cd(!0);return s.repeat.set(.16,.16),r.repeat.set(2.4,2.4),a.repeat.set(3,3),L.tela=new Ye({map:s,bumpMap:s,bumpScale:.5,roughness:.92,metalness:0}),L.telaDoblada=new Ye({map:r,bumpMap:r,bumpScale:.4,roughness:.92,metalness:0}),L.denim=new Ye({map:a,bumpMap:a,bumpScale:.6,roughness:.9,metalness:0}),L.liso=new Ye({roughness:.75,metalness:0}),L.blanco=new Ye({color:"#ECE8E1",roughness:.45}),L.maniqui=new Ye({color:"#B9A58E",roughness:.35,metalness:.1}),L.vidrio=new Ye({color:"#BFD9E8",transparent:!0,opacity:.16,roughness:.05,metalness:.2,depthWrite:!1}),L.vidrio.userData.sinSombra=!0,L.cortina=new Ye({color:"#17181B",roughness:.95,side:yn}),L.hoja=new Ye({color:"#3F7A45",roughness:.7}),L.maceta=new Ye({color:"#2E3034",roughness:.55}),L.vereda=new Ye({color:"#3A3F47",roughness:.95}),L.pantalla=new Ye({color:"#0D0F12",roughness:.25,metalness:.3}),L.espejo=new Ye({color:"#C9D6DE",roughness:.02,metalness:1}),L.panel=new Ye({color:e==="shopping"?"#2A2B2F":"#6A6C64",roughness:.85}),L.puerta=new Ye({color:"#3A2C24",roughness:.7}),L.marco=new Ye({color:"#111214",roughness:.5}),L.carton=new Ye({color:"#B08E66",roughness:.9}),L.chapa=new Ye({color:"#7A7F86",roughness:.45,metalness:.6}),L.chapaOsc=new Ye({color:"#2A2420",roughness:.5,metalness:.6}),L.malla=new Ye({map:Ix(),color:"#8A5536",alphaTest:.45,side:yn,roughness:.6,metalness:.45}),L.malla.userData.veta=7,L.luz=new _n({color:"#FFE7C2",toneMapped:!1}),L.luz.userData.sinSombra=!0,L.cobre=new Ye({color:"#8A5A3C",roughness:.5,metalness:.55}),L.bolsaNegra=new Ye({color:"#1A1B1E",roughness:.55}),L.plastico=new Ye({color:"#0E0F11",roughness:.38,metalness:.05}),L.chapaOxido=new Ye({map:Ax(),roughness:.7,metalness:.45}),L.chapaOxido.userData.veta=60,L.paredDep=new Ye({color:"#E6E2DA",roughness:.92}),L.pino=new Ye({map:dh("#C9A877","rgba(120,88,52,A)","rgba(240,215,170,A)",13),roughness:.7}),L.pino.userData.veta=100,L.negroMate=new Ye({color:"#141518",roughness:.55,metalness:.2}),L.maniquiNegro=new Ye({color:"#111214",roughness:.18,metalness:.35}),L.aluminio=new Ye({color:"#C8CBCF",roughness:.35,metalness:.85}),L.rojo=new Ye({color:"#C8322C",roughness:.5}),L.agua=new Ye({color:"#7FB6E0",transparent:!0,opacity:.55,roughness:.1}),L.agua.userData.sinSombra=!0,L.toque=new _n({visible:!1}),L}function Fx(i){let e=(i.x0+i.x1)/2,t=(i.y0+i.y1)/2;return(n,s)=>[n-e,s-t]}var Ys={izquierda:[1,0],derecha:[-1,0],fondo:[0,1],frente:[0,-1]};function Jt(i,e){let t=e.r,n=e.pared,s=n==="fondo"||n==="frente",r=s?t.w:t.h,a=s?t.h:t.w,[o,c]=i.mundo(t.x+t.w/2,t.y+t.h/2),l=s?n==="frente"?Math.PI:0:n==="izquierda"?Math.PI/2:-Math.PI/2,h=new Ne().makeRotationY(l),u=-a/2,d=(_,m,g)=>{let S=new D(_,m,u+g).applyMatrix4(h);return[o+S.x,m,c+S.z]};return{largo:r,fondo:a,pos:d,caja:(_,m,g,S,A,M,E)=>{let v=d(A,M,E);i.lote.caja(_,m,g,S,v[0],v[1],v[2],l)},matriz:(_,m,g,S,A)=>{let M=d(_,m,g),E=new Ne().makeRotationY(l+(S||0));return A&&E.scale(A),E.setPosition(M[0],M[1],M[2])},ry:l}}function Rd(i){let e=new tt(i);return .3*e.r+.59*e.g+.11*e.b}function Ci(i,e,t,n,s,r,a,o,c,l){let[h,u,d]=fn[t]||fn.remera,f=l?Math.min(u,l):u,p=(ft[t]||ft.remera).slice().sort((g,S)=>Rd(S)-Rd(g)),_=(c?2.2:2.7)*Math.max(1,d*.8),m=Math.max(2,Math.floor((s-n)/_));for(let g=0;g<m;g++){let S=n+(s-n)*(g+.5)/m+(o()-.5)*.5,A=Math.PI/2+(o()-.5)*.18,M=p[Math.min(p.length-1,Math.floor((g+o()*.6)/m*p.length))];i.add(h,e.matriz(S,r-1.6,a,A,new D(.92+o()*.1,f*(.94+o()*.08),d)),M),i.add("percha",e.matriz(S,r-1.2,a,A),null)}}function Sn(i,e,t,n,s,r,a,o,c){let l=ft[t]||ft.remera,h=t==="jean"||t==="pantalon"||t==="bermuda",u=h?14:13,d=Math.max(1,Math.floor((s-n)/u)),f=h?2.85:2.05;for(let p=0;p<d;p++){let _=n+(s-n)*(p+.5)/d,m=_t(l,c),g=Math.max(2,Math.min(Math.floor(o/f),3+Math.floor(c()*3)));for(let S=0;S<g;S++)i.add(h?"jeanDoblado":"doblada",e.matriz(_+(c()-.5)*.6,r+f/2+S*f,a,(c()-.5)*.06),c()<.85?m:_t(l,c))}}function Ji(i,e,t,n,s,r,a,o,c){if(t==="zapatilla"){let h=Math.max(1,Math.floor((s-n)/11));for(let u=0;u<h;u++){let d=n+(s-n)*(u+.5)/h,f=_t(ft.zapatilla,o);for(let p of[-2.3,2.3])i.add("zapatilla",e.matriz(d+p,r+1.7,a,(o()-.5)*.15),f)}return}let l=t==="gorra"?"gorra":t==="medias"?"medias":["gorra","boxer","medias"][c%3];if(l==="gorra"){let h=Math.max(1,Math.floor((s-n)/7.6));for(let u=0;u<h;u++){let d=n+(s-n)*(u+.5)/h,f=_t(ft.gorra,o);i.add("copa",e.matriz(d,r,a,0,new D(1,.8,1)),f),i.add("visera",e.matriz(d,r+.3,a+3.2,Math.PI),f)}}else if(l==="boxer"){let h=Math.max(1,Math.floor((s-n)/6.2));for(let u=0;u<h;u++)for(let d=0;d<2;d++)i.add("caja",e.matriz(n+(s-n)*(u+.5)/h,r+3.4,a-3+d*3,0),_t(ft.accesorio,o))}else{let h=Math.max(1,Math.floor((s-n)/3));for(let u=0;u<h;u++)for(let d=0;d<2;d++){let f=e.matriz(n+(s-n)*(u+.5)/h,r+1.2+d*2.4,a,0);f.multiply(new Ne().makeRotationX(Math.PI/2)),i.add("media",f,_t(ft.medias,o))}}}function Ox(i,e,t,n,s,r){let a=Jt(i,t),o=At(r),c=1.7,l=Math.min(a.fondo-6,19),h=Math.max(1,Math.round(a.largo/52)),u=s.filter(_=>Ki[_]&&_!=="zapatilla").length>1?"accesorio":s[0]||"remera",d=!!Ki[u],f=s[1]&&!Ki[s[1]]?s[1]:u==="campera"?"buzo":u==="camisa"?"remera":u,p=a.largo/h;for(let _=0;_<h;_++){let m=-a.largo/2+p*(_+.5),g=1.4,S=p/2-g;for(let v of[-1,1])for(let b of[c/2,l-c/2])a.caja(L.hierro,c,n,c,m+v*(S-c/2),n/2,b);for(let v of[c/2,n-c/2]){for(let b of[c/2,l-c/2])a.caja(L.hierro,S*2,c,c,m,v,b);for(let b of[-1,1])a.caja(L.hierro,c,c,l,m+b*(S-c/2),v,l/2)}let A=d?n*.3:n*.46,M=S*.46;for(let v of[-1,1])a.caja(L.hierro,c*.8,n-A,c*.8,m+v*(S-M),A+(n-A)/2,l-c/2);for(let v of[-1,1]){let b=m+v*(S-M-3);a.caja(L.escalera,2.2,n-8,.6,b,n/2+2,.4);for(let x=8;x<n-4;x+=5)a.caja(L.escalera,2.2,.5,1.4,b,x,.9)}a.caja(L.estante,S*2-c*2,2.2,l-1,m,A,l/2);let E=[A+(n-A)*.36,A+(n-A)*.7];for(let v of[-1,1]){let b=v<0?m-S+c:m+S-M,x=v<0?m-S+M:m+S-c;E.forEach(w=>a.caja(L.estante,x-b,2,l-1,(b+x)/2,w,l/2)),[A+1.1].concat(E.map(w=>w+1)).forEach((w,C)=>{d?Ji(e,a,u,b+.5,x-.5,w,l/2,o,C+(v>0?1:0)):Sn(e,a,C===0?u:f,b+.5,x-.5,w,l*.55,(n-A)*.34-3,o)})}if(d){let v=A+(n-A)*.5;a.caja(L.estante,(S-M)*2-2,2,l-1,m,v,l/2),Ji(e,a,u,m-(S-M)+1,m+(S-M)-1,A+1.1,l/2,o,0),Ji(e,a,u,m-(S-M)+1,m+(S-M)-1,v+1,l/2,o,2)}else{let[v,b,x]=fn[u]||fn.remera,w=Math.min(b,n-A-14);e.add(v,a.matriz(m,n-7,4,0,new D(1.05,w,x)),_t(ft[u]||ft.remera,o)),e.add("percha",a.matriz(m,n-6.6,4,0),null),e.add("gancho",a.matriz(m,n-5.2,3.2,Math.PI/2),null)}if(d){let v=A*.45;a.caja(L.estante,S*2-c*2,2,l-1,m,v,l/2),Ji(e,a,u,m-S+c+1,m+S-c-1,v+1,l/2,o,1),Ji(e,a,u,m-S+c+1,m+S-c-1,c+.2,l/2,o,2)}else{let v=A-3.2;a.caja(L.cano,S*2-c*2,1,1,m,v,l*.5);for(let b of[-1,1])a.caja(L.cano,.8,2.6,.8,m+b*(S-c-3),v+1.6,l*.5);Ci(e,a,fn[u]?u:"buzo",m-S+c+2,m+S-c-2,v,l*.5,o,u==="jean"||u==="pantalon")}}return{centro:a.pos(0,n,l/2),frente:a.pos(0,0,l+1.5)}}function fh(i,e,t,n){i.caja(L.escalera,.6,n-t,.6,e-1.1,(t+n)/2,.5),i.caja(L.escalera,.6,n-t,.6,e+1.1,(t+n)/2,.5);for(let s=t+3;s<n-1;s+=4.5)i.caja(L.escalera,2.8,.5,.6,e,s,.5)}function da(i,e,t,n,s,r,a,o,c,l){Ki[t]?Ji(i,e,t,n,s,r,a/2,c,l||0):Sn(i,e,t||"remera",n,s,r,a*.55,o,c)}function Bx(i,e,t,n,s,r){let a=Jt(i,t),o=At(r),c=1.6,l=Math.min(a.fondo-6,19),h=a.largo/2-1.2,u=n*(s.hs||.47),d={col:.8,frente:1.1,simple:1,maniqui:.9,libre:1},f=s.bahias,p=f.map(v=>v.w||d[v.k]||1),_=p.reduce((v,b)=>v+b,0),m=2*h-2*c,g=-h+c,S=f.map((v,b)=>{let x=m*p[b]/_,w={b:v,a0:g,a1:g+x,i:b};return g+=x,w});for(let v of[-1,1])for(let b of[c/2,l-c/2])a.caja(L.hierro,c,n,c,v*(h-c/2),n/2,b);for(let v of[c/2,n-c/2]){for(let b of[c/2,l-c/2])a.caja(L.hierro,h*2,c,c,0,v,b);for(let b of[-1,1])a.caja(L.hierro,c,c,l,b*(h-c/2),v,l/2)}S.slice(1).forEach(v=>{for(let b of[c/2,l-c/2])a.caja(L.hierro,c*.8,n-c,c*.8,v.a0,n/2,b);fh(a,v.a0,6,n-4)}),a.caja(L.estante,h*2-c*2,1.2,l-1,0,2,l/2);let A=[],M=s.barral||"remera";S.forEach(v=>{let{b,a0:x,a1:w}=v,C=w-x,I=(x+w)/2,U=s.cintos&&(v.i===0||v.i===f.length-1);if(b.k==="col")[u,u+(n-u)*.36,u+(n-u)*.7].forEach((O,k)=>{a.caja(L.estante,C,2,l-1,I,O,l/2),da(e,a,b.ropa,x+.6,w-.6,O+1,l,(n-u)*.34-3,o,k)}),b.bajo&&[u*.36,u*.7].forEach((O,k)=>{a.caja(L.estante,C,2,l-1,I,O,l/2),da(e,a,b.ropa,x+.6,w-.6,O+1,l,u*.3-2,o,k)}),b.bajo?da(e,a,b.ropa,x+.6,w-.6,2.6,l,u*.3-2,o,2):U?Pd(e,a,x+1,w-1,u-3,l*.5,o):A.push([x,w]);else if(b.k==="frente"){a.caja(L.estante,C,2.2,l-1,I,u,l/2),fh(a,I,u+6,n-3);let z=b.ropa||"remera",[O,k,j]=fn[z]||fn.remera,R=Math.min(k,n-u-14),F=b.piernas?x+C*.36:I,G=_t(ft[z]||ft.remera,o);if(b.colgados)for(let q=0;q<b.colgados;q++){let X=x+C*(q+.5)/b.colgados,he=n-7-q%2*9;e.add("pantalon",a.matriz(X,he,4+q*.6,0,new D(.9,Math.min(30,he-u-4),1.2)),_t(ft[z]||ft.pantalon,o)),e.add("percha",a.matriz(X,he+.4,4+q*.6,0),null)}else e.add(O,a.matriz(F,n-7,4,0,new D(1.05,R,j)),G),e.add("percha",a.matriz(F,n-6.6,4,0),null),e.add("gancho",a.matriz(F,n-5.2,3.2,Math.PI/2),null);b.piernas&&pa(i,a.pos(x+C*.76,u+1.1,l*.5),a.ry,r+v.i,b.piernas),b.cartel&&a.caja(L.blanco,3.4,4.6,.4,I+C*.3,u+3.5,l*.78),U?Pd(e,a,x+1,w-1,u-3,l*.5,o):A.push([x,w])}else if(b.k==="maniqui"){let z=u*.36;a.caja(L.estante,C,2,l-1,I,z,l/2),a.caja(L.bolsaNegra,Math.min(C-3,15),9,6.5,I,2.6+4.5,l*.5),a.caja(L.blanco,Math.min(C-3,15)*.7,1.4,.2,I,8,l*.5+3.3),b.piernas?pa(i,a.pos(I,z+1,l*.5),a.ry,r+5,b.piernas):$i(i,a.pos(I,z+1,l*.5),a.ry,r+5,b.completo||{})}else if(b.k==="libre"){if((b.estantes||[]).forEach(([z,O],k)=>{let j=n*z;if(a.caja(L.estante,C,2,l-1,I,j,l/2),O==="bolso")for(let R=0;R<Math.max(1,Math.floor(C/10));R++)e.add("bolso",a.matriz(x+5.5+R*10,j+4,l*.5,(o()-.5)*.3),_t(["#1E1F22","#2B2D33","#3A3D44"],o));else O&&da(e,a,O,x+.6,w-.6,j+1,l,9,o,k)}),b.largo&&(a.caja(L.estante,C,2.2,l-1,I,u,l/2),(b.sobreLargo||[]).forEach((z,O)=>{let k=w-5-O*7.5;if(z==="bolso")e.add("bolso",a.matriz(k,u+4.1,l*.5,.3),"#1E1F22");else for(let j=0;j<2;j++)e.add("bolso",a.matriz(k-j*4,u+2,l*.5,.2,new D(.45,.35,.8)),_t(ft.cinto,o))})),b.frente){let z=b.frente.ropa||"remera",[O,k,j]=fn[z]||fn.remera,R=n*b.frente.fr,F=b.frente.capas||1;fh(a,I,Math.max(u+4,R-30),Math.min(n-3,R+8));let G=Math.min(k,R-(b.largo?u:n*.3)-4),q=_t(ft[z]||ft.remera,o);for(let X=F-1;X>=0;X--){let he=I+(X-(F-1)/2)*2.2;e.add(O,a.matriz(he,R-.6*X,4+X*.9,0,new D(1.04,G,j)),X?q:b.frente.col||q),e.add("percha",a.matriz(he,R+.4-.6*X,4+X*.9,0),null)}e.add("gancho",a.matriz(I,R+1.8,3.2,Math.PI/2),null)}if(b.piernas){let z=n*b.piernas.fr;a.caja(L.estante,C,2,l-1,I,z,l/2),pa(i,a.pos(I,z+1,l*.5),a.ry,r+v.i,b.piernas.ropa)}if(b.bolsa!=null){let z=b.bolsa>.03?n*b.bolsa:2.6;b.bolsa>.03&&a.caja(L.estante,C,2,l-1,I,z,l/2),a.caja(L.bolsaNegra,Math.min(C-3,15),9,6.5,I,z+4.5,l*.5),a.caja(L.blanco,Math.min(C-3,15)*.7,1.4,.2,I,z+5.4,l*.5+3.3)}b.cartel&&a.caja(L.blanco,3.4,4.6,.4,x+C*.2,u+3.5,l*.78),b.barral&&A.push([x,w])}else b.k==="simple"&&b.niveles.forEach(([z,O,k],j)=>{let R=n*O,F=b.niveles[j+1],G=F?n*F[1]:2;z==="estante"?(a.caja(L.estante,C,2,l-1,I,R,l/2),k&&da(e,a,k,x+.8,w-.8,R+1,l,n*.08,o,j)):(a.caja(L.cano,C-1,1,1,I,R,l*.5),Ci(e,a,k||"remera",x+1.5,w-1.5,R,l*.5,o,k==="pantalon"||k==="jean",R-G-4))})});let E=[];return A.forEach(v=>{let b=E[E.length-1];b&&Math.abs(b[1]-v[0])<.5?b[1]=v[1]:E.push(v.slice())}),E.forEach(([v,b])=>{a.caja(L.cano,b-v,1,1,(v+b)/2,u-3.2,l*.5),Ci(e,a,M,v+1.5,b-1.5,u-3.2,l*.5,o,M==="jean"||M==="pantalon",u-10)}),{centro:a.pos(0,n,l/2),frente:a.pos(0,0,l+1.5)}}function Pd(i,e,t,n,s,r,a){e.caja(L.cano,n-t,.8,.8,(t+n)/2,s,r);let o=Math.max(2,Math.floor((n-t)/1.9));for(let c=0;c<o;c++)i.add("cinto",e.matriz(t+(n-t)*(c+.5)/o,s-.6,r+(a()-.5)*.6,0,new D(1,24+a()*6,1)),_t(ft.cinto,a))}function zx(i,e,t,n,s){let r=Jt(i,t),a=At(s),o=Math.min(r.fondo-6,18),c=r.largo/2-1,l=n+4,h=1.8;for(let d of[-1,1])for(let f of[h/2,o-h/2])r.caja(L.nogal,h,l,h,d*(c-h/2),l/2,f);let u=[2,l*.2,l*.4,l*.58,l*.76,l-1];u.forEach((d,f)=>{if(r.caja(L.nogal,c*2,1.6,o,0,d,o/2),f===u.length-1)return;let p=u[f+1]-d-2,_=Math.max(1,Math.floor(p/4));for(let m=-c+6;m<c-5;m+=10.6)for(let g=0;g<_;g++)a()<.08||e.add("cajaZapato",r.matriz(m,d+1.1+1.9+g*3.9,o/2+(a()-.5),(a()-.5)*.06),a()<.78?"#1B1C1F":"#D8D5CF")});for(let d=-c+6;d<c-5;d+=10.6)for(let f=0;f<3;f++)e.add("cajaZapato",r.matriz(d,l+1+f*3.9,o/2,(a()-.5)*.08),a()<.8?"#1B1C1F":"#D8D5CF");return{centro:r.pos(0,l+12,o/2),frente:r.pos(0,0,o+1.5)}}function Vx(i,e,t,n,s){let r=Jt(i,t),a=At(s),o=1.6,c=Math.min(r.fondo-4,22),l=r.largo/2-1,h=n*.86;for(let m of[-1,1])for(let g of[o/2,c-o/2])r.caja(L.hierro,o,h,o,m*(l-o/2),h/2,g);for(let m of[o/2,h-o/2]){for(let g of[o/2,c-o/2])r.caja(L.hierro,l*2,o,o,0,m,g);for(let g of[-1,1])r.caja(L.hierro,o,o,c,g*(l-o/2),m,c/2)}for(let m of[-1,1])r.caja(L.malla,.3,h-3,c-2*o,m*(l-o/2),h/2,c/2);let u=h*.6,d=h*.82;[u,d].forEach((m,g)=>{r.caja(L.estante,l*2-o*2,1.8,c-1,0,m,c/2);let S=-l+4;for(;S<l-6;){let A=a();if(A<.35)Sn(e,r,g?"pantalon":"remera",S,S+12,m+.9,c*.55,8,a),S+=14;else if(A<.65){for(let M of[-2.3,2.3])e.add("zapatilla",r.matriz(S+5+M,m+2.6,c*.5,(a()-.5)*.2),_t(ft.zapatilla,a));S+=12}else e.add("caja",r.matriz(S+3,m+4.3,c*.5,0),_t(ft.accesorio,a)),e.add("caja",r.matriz(S+7,m+4.3,c*.5,0),_t(ft.accesorio,a)),S+=10}});let f=l*1.25,p=-l+o+f/2+1;r.caja(L.estante,f,1.6,c-5,p,3.2,c/2);for(let m of[-1,1])r.caja(L.negroMate,1.2,u-9,1.2,p+m*(f/2-.6),(u-9)/2+3,c/2);r.caja(L.negroMate,f,1.2,1.2,p,u-6,c/2),Ci(e,r,"bermuda",p-f/2+2,p+f/2-2,u-6,c/2,a,!1,20);for(let m=0;m<4;m++)for(let g of[-2.2,2.2])e.add("zapatilla",r.matriz(p-f/2+6+m*(f-10)/3+g,5.7,c*.6,(a()-.5)*.3),m%2?"#1E1F22":"#E8E4DC");let _=l-o-(l*2-f-o*2)/2;return r.caja(L.estante,l*2-f-o*2-2,8,c-4,_,4,c/2),pa(i,r.pos(_,8,c/2),r.ry,s+2,"bermuda"),{centro:r.pos(0,h+4,c/2),frente:r.pos(0,0,c+1.5)}}function kx(i,e,t,n,s,r){let a=Jt(i,t),o=At(s),c=1.5,l=Math.min(a.fondo-8,16),h=Math.min(a.largo-30,72),u=h/2,d=n*.8;for(let _ of[-1,1])for(let m of[c/2,l-c/2])a.caja(L.pino,c,d,c,_*(u-c/2),d/2,m);a.caja(L.malla,.3,d-2,l-2*c,u-c/2,d/2,l/2);let f=[2,d*.24,d*.44,d*.6,d*.76,d-1];f.forEach(_=>a.caja(L.pino,u*2,1.4,l,0,_,l/2));for(let _ of[-1,1]){let m=a.matriz(_*u*.45,f[4]+6.5,l*.5,0,new D(1.6,1.1,1.4));e.add("caja",m,_<0?"#C9CCD0":"#3A3D44")}for(let _=0;_<4;_++)e.add("caja",a.matriz(-6+_*4,f[4]+4.2,l*.6,0,new D(.55,.55,.9)),"#2E9C88");for(let _=-u+6;_<u-4;_+=9.5)e.add("bolso",a.matriz(_,f[3]+3.7,l*.5,(o()-.5)*.3),_t(["#1E1F22","#2B2D33","#3A3D44"],o));for(let _=-u+4;_<u-3;_+=5.6)for(let m=0;m<2;m++)e.add("caja",a.matriz(_,f[2]+1.6+m*1.4,l*.5,0,new D(.9,.2,2)),m?"#E6E4E0":"#8C8F94");for(let _ of[f[0],f[1]])for(let m=-u+7;m<u-6;m+=13)e.add("caja",a.matriz(m,_+6.6,l*.55,(o()-.5)*.1,new D(2,1.9,2.4)),"#C49A63");let p=Jt({mundo:i.mundo,lote:r||i.lote},t);for(let _ of[-1,1]){for(let m=0;m<3;m++){let g=_t(ft.gorra,o);e.add("copa",a.matriz(_*(u+9),70-m*4.2,3.4,0,new D(1,.8,1)),g),e.add("visera",a.matriz(_*(u+9),70.3-m*4.2,6.4,Math.PI),g)}p.caja(L.cano,.6,.6,3,_*(u+9),74,1.5)}return p.caja(L.blanco,Math.min(a.largo-10,64),9,14,0,d+26,7),p.caja(L.negroMate,Math.min(a.largo-10,64)-6,1.2,.4,0,d+23,14.2),{centro:a.pos(0,d+6,l/2),frente:a.pos(0,0,l+1.5)}}function Hx(i,e,t,n){let s=Jt(i,t),r=At(n),a=Math.min(s.fondo-10,14),o=s.largo/2-3;for(let c of[-1,1])s.caja(L.chapa,1.2,34,a,c*o,17,a/2);[2,12,22,33].forEach((c,l)=>{s.caja(L.chapa,o*2,1.2,a,0,c,a/2),l<3&&Sn(e,s,l===1?"remera":"buzo",-o+1,o-1,c+.6,a,7,r)}),Sn(e,s,"remera",-o+1,0,33.6,a,5,r)}function Gx(i,e,t,n){let s=Jt(i,e),r=Jt({mundo:i.mundo,lote:t},e),a=e.o;if(a.tipo==="espejo"){r.caja(L.pared,s.largo-1,100,2.4,0,50,1.2),r.caja(L.espejo,s.largo-7,76,.4,0,46,2.6);return}let o=a.tipo==="maniquies"?[{base:"carroBajo",ropa:{arriba:"saco",abajo:"pantalon",colArriba:"#3A3C40",colAbajo:"#3A3C40",zapas:"negro"}},{base:"cajaNegra",ropa:Object.assign({negro:!0,arriba:"camisa",abajo:"bermuda",colArriba:"#2A2B2E",colAbajo:"#E6E1D6"})}]:[{base:a.base,ropa:a.ropa}];o.forEach((c,l)=>{let h=o.length>1?(l?1:-1)*s.largo*.26:0,u=12,d=Zx(s,c.base||"cajaNegra",h,u,o.length>1?Math.min(13,s.largo*.4):15);$i(i,s.pos(h,d,u),s.ry,n+l*7,c.ropa||{})})}function Wx(i,e,t,n,s,r){let a=Jt(i,t),o=At(r),c=Math.min(a.fondo-6,18),l=Math.max(1,Math.round(a.largo/52)),h=s.filter(f=>Ki[f]&&f!=="zapatilla").length>1?"accesorio":s[0]||"remera",u=!!Ki[h],d=a.largo/l;for(let f=0;f<l;f++){let p=-a.largo/2+d*(f+.5),_=d/2-3,m=n+4;a.caja(L.roble,_*2,m,1,p,m/2,.5);for(let S of[-1,1])a.caja(L.roble,1.4,m,c,p+S*(_-.7),m/2,c/2);a.caja(L.roble,_*2,1.6,c,p,m-.8,c/2);for(let S of[-.5,.5]){let A=a.pos(p+S*_,m-1.7,c*.55);i.lote.cilindro(L.luz,1.4,1.4,.3,A[0],A[1],A[2],12)}a.caja(L.roble,_*2-2.8,3,c,p,1.5,c/2);let g=n*.62;if(a.caja(L.marco,_*2-2.8,1.6,c-1,p,g,c/2),u)[g+.8,n*.42,n*.22,3].forEach((S,A)=>{A>0&&A<3&&a.caja(L.marco,_*2-2.8,1.6,c-1,p,S,c/2),Ji(e,a,h,p-_+2,p+_-2,S+.8,c/2,o,A)});else{Sn(e,a,h,p-_+2,p+_-2,g+.8,c*.55,n-g-8,o);let S=g-3;a.caja(L.cano,_*2-3,1,1,p,S,c*.5),Ci(e,a,fn[h]?h:"buzo",p-_+2.5,p+_-2.5,S,c*.5,o,!1)}}return{centro:a.pos(0,n+4,c/2),frente:a.pos(0,0,c+1.5)}}function Xx(i,e,t,n,s,r){let a=Jt(i,t),o=At(r),c=Math.min(a.fondo-4,24),l=Math.max(1,Math.round(a.largo/50)),h=a.largo/l,u=[3,n*.25,n*.48,n*.71,n-3],d=s[0]||"buzo";for(let f=0;f<l;f++){let p=-a.largo/2+h*(f+.5),_=h/2-1;for(let m of[-1,1])for(let g of[1,c-1])a.caja(L.chapa,1.6,n,1.6,p+m*(_-.8),n/2,g);u.forEach((m,g)=>{if(g===u.length-1){for(let A of[1,c-1])a.caja(L.chapa,_*2,1.2,1.2,p,m,A);return}a.caja(L.chapa,_*2,.8,c,p,m,c/2);let S=p-_+2;for(;S<p+_-8;){if(o()<.22){Sn(e,a,d,S,S+13,m+.4,c/2,12,o),S+=14;continue}let A=9+o()*5,M=7+o()*6;e.add("carton",a.matriz(S+A/2,m+.4+M/2,c/2+(o()-.5)*2,(o()-.5)*.08,new D(A/10,M/8,1)),_t(["#B08E66","#A88560","#BC9A70","#9E7B57","#C4A57E"],o)),S+=A+1}})}return{centro:a.pos(0,n,c/2),frente:a.pos(0,0,c+1.5)}}function ph(i,e,t,n,s,r,a){let[o,c]=i.mundo(t.x+t.w/2,t.y+t.h/2),l=At(s),h=t.h>t.w,u=t.w-2,d=t.h-2,f=r||30,p=1.6,_=a==="shopping"?L.marco:L.hierro;i.lote.caja(a==="shopping"?L.roble:L.estante,u,3,d,o,f-1.5,c);for(let E of[-1,1])for(let v of[-1,1])i.lote.caja(_,p,f-3,p,o+E*(u/2-2),(f-3)/2,c+v*(d/2-2));for(let E of[-1,1])i.lote.caja(_,u-4,p,p,o,2,c+E*(d/2-2));for(let E of[-1,1])i.lote.caja(_,p,p,d-4,o+E*(u/2-2),2,c);if(!n)return;let m=n[0]||"remera",g=ft[m]||ft.remera,S=m==="jean"||m==="pantalon",A=h?2:Math.max(2,Math.floor(u/16)),M=h?Math.max(2,Math.floor(d/17)):2;for(let E=0;E<A;E++)for(let v=0;v<M;v++){let b=o-u/2+u/A*(E+.5),x=c-d/2+d/M*(v+.5),w=_t(g,l),C=2+Math.floor(l()*4),I=S?2.85:2.05;for(let U=0;U<C;U++)e.add(S?"jeanDoblado":"doblada",new Ne().makeRotationY((h?Math.PI/2:0)+(l()-.5)*.1).setPosition(b,f+I/2+U*I,x),w)}}function Fl(i,e,t,n,s,r,a,o){let[c,l]=i.mundo(t.x+t.w/2,t.y+t.h/2),h=At(s),u=t.h>t.w,d=u?t.h:t.w,f=a||58,p=u?Math.PI/2:0,_=new Ne().makeRotationY(p),m=o||(r==="shopping"?L.marco:L.hierro),g=(C,I)=>{let U=new D(C,I,0).applyMatrix4(_);return[c+U.x,I,l+U.z]};for(let C of[-1,1]){let I=g(C*(d/2-1),f/2);i.lote.caja(m,1.6,f,1.6,I[0],I[1],I[2],p);let U=g(C*(d/2-1),.8);i.lote.caja(m,1.6,1.6,16,U[0],U[1],U[2],p)}let S=g(0,f);i.lote.caja(L.cano,d,1.1,1.1,S[0],S[1],S[2],p);let A=(n||[]).find(C=>fn[C])||"camisa",[M,E,v]=fn[A],b=ft[A]||ft.camisa,x=Math.min(E,f-10),w=Math.floor((d-6)/2.8);for(let C=0;C<w;C++){let I=g(-d/2+3+2.8*(C+.5),f-2.2),U=p+Math.PI/2+(h()-.5)*.15;e.add(M,new Ne().makeRotationY(U).scale(new D(1,x*(.94+h()*.08),v)).setPosition(I[0],I[1]-.4,I[2]),_t(b,h)),e.add("percha",new Ne().makeRotationY(U).setPosition(I[0],I[1],I[2]),null)}}function js(i,e,t,n){let s=new Ne().makeRotationY(n),r=(c,l,h)=>{let u=new D(c,l,h).applyMatrix4(s);return[e+u.x,l,t+u.z]};return{pos:r,caja:(c,l,h,u,d,f,p)=>{let _=r(d,f,p);i.lote.caja(c,l,h,u,_[0],_[1],_[2],n)},matriz:(c,l,h,u,d)=>{let f=r(c,l,h),p=new Ne().makeRotationY(n+(u||0));return d&&p.scale(d),p.setPosition(f[0],f[1],f[2])},ry:n}}function Id(i,e,t,n,s,r,a,o,c,l){let h=At(a),u=1.6,d=7,f=48,p=70,_=n/2,m=s/2;l=l||{};let g=l.colgada||r.find(A=>fn[A]&&fn[A][0]!=="pantalon")||"campera",S=l.doblada||(r[0]&&!Ki[r[0]]?r[0]:"pantalon");t.caja(L.estante,n-2,1.6,s-2,0,d,0),Fd(i,t,_-6,m+.9,4.2);for(let A of[-1,1])for(let M of[-1,1])t.caja(L.hierro,u,p-2,u,A*(_-u/2),(p-2)/2+2,M*(m-u/2));for(let A of[3,d-.6,f,p]){for(let M of[-1,1])t.caja(L.hierro,n,u,u,0,A,M*(m-u/2));for(let M of[-1,1])t.caja(L.hierro,u,u,s,M*(_-u/2),A,0)}for(let A of[-1,1])t.caja(L.malla,.3,f-d-1,s-2*u,A*(_-u/2),(f+d)/2,0);if(o&&t.caja(L.malla,n-2*u,f-d-1,.3,0,(f+d)/2,-(m-u/2)),t.caja(L.malla,n-2*u,.4,s-2*u,0,f,0),c==="busto"?(Sn(e,t,S,-_+3,-2,f+.3,0,8,h),Sn(e,t,"pantalon",_*.45,_-3,f+.3,0,7,h),t.caja(L.bolsaNegra,14,10,7,_*.05,f+5.3,0),t.caja(L.blanco,9,1.4,.2,_*.05,f+6,3.6)):(Sn(e,t,S,-_+3,_-3,f+.3,0,8,h),t.caja(L.blanco,4,5,.4,_*.15,f+3,m-3)),t.caja(L.cano,n-2*u,1,1,0,f-3,0),Ci(e,t,g,-_+3,_-3,f-3,0,h,!0,f-d-8),t.caja(L.malla,n-2*u,.4,s-2*u,0,p,0),c==="piernas")pa(i,t.pos(0,p+.4,0),t.ry,a);else if(c==="bolsos")for(let A=-_+6;A<_-4;A+=11)e.add("bolso",t.matriz(A,p+3.4,(h()-.5)*3,(h()-.5)*.5),_t(["#1E1F22","#2B2D33","#3A3D44","#4D5240"],h));else{c==="busto"&&$i(i,t.pos(-_*.35,p+.4,-2),t.ry,a,{solo:"torso",arriba:"campera",colArriba:"#1E1F22",gorra:!0,colGorra:"#2B2D33"});let A=c==="busto"?_*.1:-_+3,M=Math.max(2,Math.floor((_-3-A)/12));for(let E=0;E<M;E++){let v=A+(_-3-A)*(E+.5)/M,b=_t(ft.gorra,h);t.caja(L.cano,.6,7,.6,v,p+3.7,0),e.add("copa",t.matriz(v,p+7.2,0,0,new D(1,.85,1)),b),e.add("visera",t.matriz(v,p+7.5,3.2,Math.PI),b)}}return{centro:t.pos(0,p+(c==="piernas"?36:12),0),frente:t.pos(0,0,m+1.5)}}function Fd(i,e,t,n,s){let r=new cn(s,s,1.4,14),a=new Lt(1.3,1.3,1.4);for(let o of[-1,1])for(let c of[-1,1]){let l=e.pos(o*t,s+.2,c*n),h=new Ne().makeRotationY(e.ry).multiply(new Ne().makeRotationX(Math.PI/2));i.lote.add(L.hierro,r,h.clone().setPosition(l[0],l[1],l[2]));for(let u=0;u<10;u++){let d=u*Math.PI/5,f=e.pos(o*t+Math.cos(d)*(s+.5),s+.2+Math.sin(d)*(s+.5),c*n);i.lote.add(L.hierro,a,new Ne().makeRotationY(e.ry).multiply(new Ne().makeRotationZ(d)).setPosition(f[0],f[1],f[2]))}}}function pa(i,e,t,n,s){$i(i,e,t,n,{solo:"piernas",abajo:s||"pantalon"})}function qx(i,e,t,n){let[s,r]=i.mundo(t.x+t.w/2,t.y+t.h/2),a=At(n),o=Math.min(t.w-8,120),c=t.h-6,l=12,h=1.4,u=js(i,s,r,0),d=o/2,f=c/2;u.caja(L.estante,o,2,c,0,l-1,0);for(let p of[3,l-2.4]){for(let _ of[-1,1])u.caja(L.hierro,o,h,h,0,p,_*(f-h/2));for(let _ of[-1,1])u.caja(L.hierro,h,h,c,_*(d-h/2),p,0)}for(let p of[-1,1])u.caja(L.malla,o-2,l-6,.3,0,(l-6)/2+3,p*(f-h/2));Fd(i,u,d-6,f+.8,4.4),u.caja(L.estante,16,9,12,d/2,l+4.5,-2),$i(i,[s-d/2,l,r-2],.18,n,{arriba:"camisa",abajo:"pantalon",colArriba:"#E9E2D2",colAbajo:"#E3DCCB"}),$i(i,[s+d/2,l+9,r-2],-.18,n+1,{arriba:"camisa",abajo:"bermuda",colArriba:"#D9CBB0",colAbajo:"#2B2D31",zapas:"negro"}),Sn(e,u,"buzo",-d+4,-d+18,l,f-7,6,a),Sn(e,u,"remera",d-18,d-4,l,f-7,6,a);for(let p=0;p<3;p++)e.add("caja",u.matriz(-6+p*6,l+3.4,f-6,(a()-.5)*.4),_t(["#5A3F2E","#2B2D33","#8C5A3A"],a));return{centro:[s,82,r],frente:[s,0,r-f]}}var mh=new Map;function fa(i,e){let t=i+(e||"");return mh.has(t)||mh.set(t,new Ye({color:i,roughness:e?.5:.88})),mh.get(t)}var Yx=[[4.5,33],[5.5,35.5],[5.6,38],[5.2,41],[4.6,44],[4.55,46],[5,50],[5.6,54],[5.85,57],[5.5,60],[4.3,62.4],[2.3,64]];function Dd(i){let e=Yx;if(i<=e[0][1])return e[0][0];for(let t=1;t<e.length;t++)if(i<=e[t][1]){let n=e[t-1],s=e[t],r=(i-n[1])/(s[1]-n[1]);return n[0]+(s[0]-n[0])*r}return e[e.length-1][0]}function Ld(i,e,t,n,s){let r=[];n&&r.push(new pe(.01,i));for(let a=i;a<e;a+=1)r.push(new pe(Dd(a)*t,a));return r.push(new pe(Dd(e)*t,e)),s&&r.push(new pe(.01,e+.3)),new Tr(r,26).scale(1,1,.64)}function $i(i,e,t,n,s){s=s||{};let r=At(n+17),a=s.negro?L.maniquiNegro:L.maniqui,o=s.arriba||"remera",c=s.abajo||"jean",l=fa(s.colArriba||_t(ft[o]||ft.remera,r),o==="campera"),h=fa(s.colAbajo||_t(ft[c]||ft.jean,r)),u=(E,v,b)=>new D(E,v,b||0),d=new Map,f=(E,v,b)=>{let x=(E.index?E.toNonIndexed():E.clone()).applyMatrix4(b||new Ne);for(let w of Object.keys(x.attributes))w!=="position"&&w!=="normal"&&w!=="uv"&&x.deleteAttribute(w);d.has(v)||d.set(v,[]),d.get(v).push(x)},p=(E,v,b,x,w,C)=>f(new ai(v,16,12),b,new Ne().compose(E,new Bt,u(x||1,w||1,C||1))),_=(E,v,b,x,w)=>{let C=v.clone().sub(E),I=C.length();f(new cn(x,b,I,14,1,!0),w,new Ne().compose(E.clone().add(v).multiplyScalar(.5),new Bt().setFromUnitVectors(u(0,1,0),C.normalize()),u(1,1,1)))},m=o==="campera"||o==="saco",g=m?39:44,S=o==="campera"?1.12:m?1.07:1.04;if(s.solo!=="torso"){let E=c==="bermuda";for(let v of[-1,1]){let b=u(v*2.7,34.5),x=u(v*2.85,18.5,.3),w=u(v*2.9,3.4,0);E?(_(b,x.clone().lerp(b,.12),3.35,2.75,h),_(x.clone().lerp(b,.15),x,2.15,2,a),p(x,2,a),_(x,w,2,1.3,a)):(_(b,x,3.15,2.45,h),p(x,2.45,h),_(x,w,2.45,2.1,h)),f(new Zn(3.6,2.5,7.6,2,1),s.zapas==="negro"?L.negroMate:L.blanco,new Ne().makeTranslation(v*2.9,1.25,1.3))}f(Ld(33,Math.min(g,s.solo==="piernas"?44:g),1.03,!0,s.solo==="piernas"),h)}if(s.solo!=="piernas"){f(Ld(s.solo==="torso"?40:g,64,S,s.solo==="torso",!0),l),m&&f(new Lt(2.6,15,.5),fa(s.colInterior||"#ECE8E1"),new Ne().makeTranslation(0,54,3.9));let E=o==="remera"?"corta":"larga";for(let v of[-1,1]){let b=u(v*6.4,60.4),x=u(v*7.6,47.6,.2),w=u(v*7.9,37.8,1);p(b,2.35*(m?1.1:1),l),E==="larga"?(_(b,x,2*(m?1.12:1),1.7,l),p(x,1.7,l),_(x,w,1.7,1.45,l)):(_(b,b.clone().lerp(x,.6),2.3,2.05,l),_(b,x,1.85,1.5,a),p(x,1.5,a),_(x,w,1.5,1.05,a)),p(u(v*7.95,35.6,1.1),1.25,a,.72,1.55,1)}if(_(u(0,63.2),u(0,67.6,.2),1.6,1.4,a),p(u(0,71.7,.25),3.65,a,.86,1.2,.98),s.gorra){let v=fa(s.colGorra||_t(ft.gorra,r));f(new ai(3.55,16,8,0,Math.PI*2,0,Math.PI/2),v,new Ne().compose(u(0,74.6,.1),new Bt,u(1,.82,1.05))),f(new cn(3.4,3.4,.4,16,1,!1,-Math.PI/2,Math.PI),v,new Ne().makeTranslation(0,74.7,2.3))}s.gorro&&f(new ai(3.85,16,8,0,Math.PI*2,0,Math.PI/1.8),fa("#B9B2A5"),new Ne().makeTranslation(0,74.2,.2)),s.solo==="torso"&&_(u(0,30),u(0,40.5),.6,.6,L.cano)}let A=new Tn;for(let[E,v]of d){let b=new ut(ch(v,!1),E);b.castShadow=!0,b.receiveShadow=!0,A.add(b)}s.solo==="torso"&&(A.position.y-=32);let M=new Tn;M.add(A),M.position.set(e[0],e[1],e[2]),M.rotation.y=t||0,i.escena.add(M)}function jx(i,e,t,n,s,r,a,o){$i(i,[e,r||0,t],s||0,n,Object.assign(a?{arriba:"campera",gorro:!0}:{},o||{}))}function Zx(i,e,t,n,s){let r=s||15;if(e==="carroBajo"){i.caja(L.estante,r+6,2,r,t,11,n);for(let a of[3,9.6])for(let o of[-1,1])i.caja(L.hierro,r+6,1.2,1.2,t,a,n+o*(r/2-.6));for(let a of[-1,1])i.caja(L.malla,r+5,6,.3,t,6.3,n+a*(r/2-.6));return 12}return i.caja(e==="cajaBlanca"?L.blanco:L.negroMate,r,17,r*.8,t,8.5,n),i.caja(L.estante,r+1.5,2,r*.8+1.5,t,18,n),19}function Jx(i,e,t,n,s){let r=At(n),a=s||26;i.lote.cilindro(L.maceta,5.5,4.4,11,e,5.5,t,18);let o=new ai(1,8,6);for(let c=0;c<16;c++){let l=r()*Math.PI*2,h=.35+r()*.75,u=a*(.45+r()*.35),d=new Ne().compose(new D(e+Math.cos(l)*Math.sin(h)*u*.45,11+Math.cos(h)*u*.5,t+Math.sin(l)*Math.sin(h)*u*.45),new Bt().setFromEuler(new gn(0,-l,Math.PI/2-h,"YXZ")),new D(u*.5,1.9,.5));i.lote.add(L.hoja,o,d)}}function Kx(i,e,t,n,s){let[r,a]=i.mundo(e.x+e.w/2,e.y+e.h/2),o=s||78,c=t==="e"||t==="o",l=c?e.h:e.w,h=c?e.w:e.h,u={s:0,n:Math.PI,e:Math.PI/2,o:-Math.PI/2}[t]||0,d=new Ne().makeRotationY(u),f=(x,w,C)=>{let I=new D(x,w,C).applyMatrix4(d);return[r+I.x,w,a+I.z]},p=(x,w,C,I)=>{let U=f(C,o/2,I);n.caja(L.panel,x,o,w,U[0],U[1],U[2],u)};p(l,1.4,0,-h/2+.7),p(1.4,h,-l/2+.7,0),p(1.4,h,l/2-.7,0);let _=f(0,5.5,-h/2+7);n.caja(L.negroMate,10,11,9,_[0],_[1],_[2],u);let m=f(0,45,-h/2+1.6);n.caja(L.espejo,l*.4,50,.4,m[0],m[1],m[2],u);let g=l*.78,S=new hn(g,Math.min(o-10,92),40,1),A=S.attributes.position;for(let x=0;x<A.count;x++)A.setZ(x,Math.sin(A.getX(x)/2.2)*1.3);S.computeVertexNormals();let M=Math.min(o-10,92),E=f(-l/2+g/2+1,M/2+1,h/2-1.5);n.add(L.cortina,S,new Ne().makeRotationY(u).setPosition(E[0],E[1],E[2]));let v=f(0,M+2,h/2-1.5);n.caja(L.cano,l,.8,.8,v[0],v[1],v[2],u);let b=f(0,(o+M+3)/2,h/2-.7);n.caja(L.panel,l,o-M-3,1.4,b[0],b[1],b[2],u)}function $x(i,e,t){let[n,s]=i.mundo(e.x+e.w/2,e.y+e.h/2),r=e.h>e.w,a=e.w-1,o=e.h-1,c=38;i.lote.caja(t==="shopping"?L.roble:L.estante,a,c-2,o,n,(c-2)/2,s),i.lote.caja(L.pantalla,a+1,2,o+1,n,c-1,s);let l=t==="shopping"?L.marco:L.hierro;for(let d of[-1,1])for(let f of[-1,1])i.lote.caja(l,1.8,c-2,1.8,n+d*(a/2-.4),(c-2)/2,s+f*(o/2-.4));for(let d of[-1,1])i.lote.caja(l,a+.6,1.8,1.8,n,.9,s+d*(o/2-.4));for(let d of[-1,1])i.lote.caja(l,1.8,1.8,o+.6,n+d*(a/2-.4),.9,s);let h=r?n:n+a*.2,u=r?s-o*.2:s;i.lote.caja(L.pantalla,r?1:12,8,r?12:1,h,c+6,u),i.lote.caja(L.cano,1,4,1,h,c+2,u),i.lote.caja(L.pantalla,3,1.2,5,n-(r?0:a*.15),c+.6,s+(r?o*.15:0))}function ma(i,e){let[t,n]=i.mundo(e.x+e.w/2,e.y+e.h/2),s=e.h>e.w;return{E:js(i,t,n,s?Math.PI/2:0),largo:s?e.h:e.w,ancho:s?e.w:e.h,cx:t,cz:n}}function Od(i,e,t,n,s,r){for(let a=t+4;a<n-2;a+=11)i.add("disco",e.matriz(a,s-2.4,r,0),"#F2F0EB")}function Qx(i,e,t,n,s){let{E:r,largo:a,ancho:o}=ma(i,t),c=At(s),l=58,h=a/2-1,u=Math.min(o,26)/2;r.caja(L.estante,a,2.6,u*2,0,1.3,0);for(let d of[-1,1]){let f=r.pos(d*(h-3),(l+2.6)/2,0);i.lote.cilindro(L.cano,.7,.7,l-2.6,f[0],f[1],f[2],10)}return r.caja(L.cano,a-4,1.2,1.2,0,l,0),Od(e,r,-h+3,h-3,l,0),Ci(e,r,n||"remera",-h+4,h-4,l,0,c,!1,34),{centro:r.pos(0,l+4,0)}}function ev(i,e,t,n,s,r){let{E:a,largo:o,ancho:c}=ma(i,t),l=At(r),h=46,u=o/2-1,d=Math.min(c-4,30)/2,f=1.4;for(let p of[-1,1])for(let _ of[-1,1])a.caja(L.negroMate,f,h,f,p*(u-2),h/2,_*(d-3));for(let p of[-1,1])a.caja(L.negroMate,u*2-4,f,f,0,1,p*(d-3));for(let p of[-1,1])a.caja(L.negroMate,f,f,d*2-6,p*(u-2),1,0);a.caja(L.estante,u*2,2,d*2,0,h+1,0);for(let p of[-1,1])Sn(e,a,s||"jean",-u+2,u-2,h+2,p*d*.48,9,l);for(let p of[-1,1]){let _=p*(d+2.5);a.caja(L.cano,u*2+4,1,1,0,h-5,_);for(let m of[-1,1])a.caja(L.cano,1,1,5,m*(u-2),h-5,p*(d-.5));Od(e,a,-u,u,h-5,_),Ci(e,a,n||"pantalon",-u+1,u-1,h-5,_,l,!0,34)}return{centro:a.pos(0,h+16,0)}}function tv(i,e,t,n,s){let{E:r,largo:a,ancho:o}=ma(i,t),c=s||37,l=a/2-1,h=o/2-1,u=1.6;r.caja(L.estante,l*2,3,h*2,0,c-1.5,0),r.caja(L.negroMate,l*2+.4,1,h*2+.4,0,c-3.2,0);for(let d of[-1,1])for(let f of[-1,1])r.caja(L.negroMate,u,c-3,u,d*(l-u/2),(c-3)/2,f*(h-u/2));for(let d of[-1,1])r.caja(L.negroMate,l*2,u,u,0,1,d*(h-u/2));for(let d of[-1,1])r.caja(L.negroMate,u,u,h*2,d*(l-u/2),1,0),r.caja(L.malla,.3,c-6,h*2-2*u,d*(l-u/2),(c-3)/2,0);r.caja(L.malla,l*2-2*u,c-6,.3,0,(c-3)/2,-(h-u/2)),r.caja(L.estante,l*2-2*u,1.6,h*2-2*u,0,5,0)}function nv(i,e,t){let{E:n,largo:s,ancho:r}=ma(i,e),a=18,o=s/2-1,c=r/2-1,l=1.4;n.caja(L.estante,o*2,2.4,c*2,0,a-1.2,0);for(let d of[-1,1])for(let f of[-1,1])n.caja(L.negroMate,l,a-2.4,l,d*(o-l/2),(a-2.4)/2,f*(c-l/2));for(let d of[-1,1])n.caja(L.malla,.3,a-4,c*2-2*l,d*(o-l/2),(a-2.4)/2,0);n.caja(L.negroMate,o*.9,a-5,.6,-o*.3,(a-2.4)/2,0);let h=new cn(4.2,4.2,1.2,14),u=new Lt(1.2,1.2,1.2);for(let d of[0,1]){let f=o*.45+d*6.5,p=n.pos(f,5.5,c*.3);i.lote.add(L.hierro,h,new Ne().makeRotationY(n.ry).multiply(new Ne().makeRotationX(Math.PI/2)).setPosition(p[0],p[1],p[2]));for(let _=0;_<10;_++){let m=_*Math.PI/5+d*.3,g=n.pos(f+Math.cos(m)*4.6,5.5+Math.sin(m)*4.6,c*.3);i.lote.add(L.hierro,u,new Ne().makeRotationY(n.ry).multiply(new Ne().makeRotationZ(m)).setPosition(g[0],g[1],g[2]))}}}function iv(i,e){let{E:t,largo:n,ancho:s}=ma(i,e),r=38,a=n/2-.5,o=s/2-.5;t.caja(L.chapaOxido,a*2,r-2,o*2,0,(r-2)/2,0),t.caja(L.chapaOsc,a*2+1,2,o*2+1,0,r-1,0);for(let c of[-1,1])for(let l=-a+a*2/3;l<a-1;l+=a*2/3){t.caja(L.chapaOsc,.8,r-3,.3,l,(r-2)/2,c*(o+.1));for(let h=4;h<r-4;h+=8)t.caja(L.negroMate,.9,.9,.5,l,h,c*(o+.2))}t.caja(L.pantalla,12,8,1,a*.5,r+6,-o*.4),t.caja(L.cano,1,4,1,a*.5,r+2,-o*.4),t.caja(L.pantalla,3,1.2,5,-a*.2,r+.6,0),t.caja(L.rojo,4,6,.4,a*.15,r+3,-o*.1)}function sv(i,e,t,n){let s=Jt(i,t),r=At(n),a=Math.min(s.fondo-6,18),o=s.largo/2-1,c=[12,30,48,66,84,102],l=["#2B3A55","#1E1F22","#5E6B4E","#C2AE8E","#8E9196","#3C5A80","#7A2E35","#E8E1D3","#4D5240","#B8C7D9"];for(let h=-o+8;h<o;h+=32)c.forEach(u=>s.caja(L.negroMate,.8,6,a*.8,h,u-3.4,a*.45));return c.forEach((h,u)=>{if(s.caja(L.pino,o*2,1.4,a,0,h,a/2),u===c.length-1){for(let f=-o+6;f<o-5;f+=11)r()<.55&&e.add("cajaZapato",s.matriz(f,h+2.7,a/2,0),r()<.8?"#1B1C1F":"#D8D5CF");return}let d=-o+1;for(;d<o-9;){let f=3+Math.floor(r()*4),p=_t(l,r);for(let _=0;_<f;_++)e.add("doblada",s.matriz(d+6.5,h+1.7+_*2.05,a*.5,(r()-.5)*.08),r()<.8?p:_t(l,r));d+=13.2+r()*.8}}),{centro:s.pos(0,106,a/2),frente:s.pos(0,0,a+1.5)}}function rv(i,e,t,n){let s=At(n),[r,a]=i.mundo((t.x0+t.x1)/2,(t.y0+t.y1)/2),o=js(i,r,a,0),c=74,l=30,h=32;o.caja(L.negroMate,c,2.4,l,0,h-1.2,0);for(let d of[-1,1])o.caja(L.negroMate,2,h-2.4,l-2,d*(c/2-1),(h-2.4)/2,0);o.caja(L.negroMate,c-4,h-8,1.2,0,(h-2.4)/2,-l/2+4),o.caja(L.negroMate,c-4,9,1,0,h-7,l/2-.5);let u=new ut(new hn(30,7.5),new _n({map:lv("VDH"),transparent:!0,depthWrite:!1}));u.position.set(r+12,h-7,a+l/2+.05),i.escena.add(u);for(let d=0;d<4;d++)e.add("doblada",o.matriz(-22+d*4,h+1+d*2.05,2,.3),_t(ft.buzo,s));o.caja(L.blanco,9,.3,12,-8,h+.2,-3),o.caja(L.negroMate,11,1.6,11,4,18,l/2+10),o.caja(L.negroMate,11,10,1.4,4,24,l/2+15.5);for(let d of[-1,1])for(let f of[-1,1]){let p=o.pos(4+d*4,8.5,l/2+10+f*4);i.lote.cilindro(L.pino,.5,.5,17,p[0],p[1],p[2],6)}return o}function av(i,e,t){i.lote.caja(L.blanco,12,36,12,e,18,t),i.lote.cilindro(L.agua,5.5,5.5,16,e,44,t,16)}function ov(i,e,t,n){let s=js(i,e,t,n||0);for(let r of[-1,1])s.caja(L.aluminio,1,62,1.6,r*6,31,0),s.caja(L.aluminio,1,60,1.6,r*6,30,-4);for(let r=12;r<58;r+=12)s.caja(L.aluminio,12,.8,4,0,r,1);s.caja(L.rojo,12.5,1.6,6,0,61,-1)}function lv(i){return Jn(512,128,(t,n,s)=>{t.clearRect(0,0,n,s),t.font='800 92px "Arial Black", Manrope, sans-serif',t.textAlign="center",t.textBaseline="middle",t.fillStyle="#F2F0EB",t.fillText(i,n/2,s/2+4)})}function cv(i,e,t,n){let s=t*.86,r=new cn(1.5,1.8,3.6,12),a=new cn(1.3,1.3,.3,12);for(let o of[-.27,.27]){let c=e*o;i.lote.caja(L.negroMate,1.8,1.4,s,c,n-.8,0);for(let l=-s/2+18;l<s/2-10;l+=44)for(let h of[-1,1]){let u=new Bt().setFromEuler(new gn(.35*h,0,.2*-Math.sign(o)));i.lote.caja(L.negroMate,.6,2.4,.6,c,n-2.6,l+h*3.5);let d=new D(c,n-5.4,l+h*3.5);i.lote.add(L.negroMate,r,new Ne().compose(d,u,new D(1,1,1))),i.lote.add(L.luz,a,new Ne().compose(d.clone().add(new D(0,-1.85,0).applyQuaternion(u)),u,new D(1,1,1)))}}}function hv(i,e){let t={fondo:[i.x0,i.x1],frente:[i.x0,i.x1],izquierda:[i.y0,i.y1],derecha:[i.y0,i.y1]},n={};return Object.keys(t).forEach(s=>{let r=s==="fondo"||s==="frente",a=[];i.items.forEach(l=>{l.pared===s&&(l.tipo==="modulo"||l.pieza)&&a.push(r?[l.r.x,l.r.x+l.r.w]:[l.r.y,l.r.y+l.r.h])}),e&&e.pared===s&&a.push(r?[e.r.x,e.r.x+e.r.w]:[e.r.y,e.r.y+e.r.h]),a.sort((l,h)=>l[0]-h[0]);let o=t[s][0],c=[];a.forEach(l=>{l[0]-o>0&&c.push([o,l[0]]),o=Math.max(o,l[1])}),t[s][1]-o>0&&c.push([o,t[s][1]]),n[s]=c.map(l=>[l[0]<=t[s][0]+1?l[0]+50:l[0],l[1]>=t[s][1]-1?l[1]-50:l[1]]).filter(l=>l[1]-l[0]>=26)}),n}function uv(i,e){if(!e.ficha&&!e.entre)return{items:i.items,extras:[]};let t=i.items.map(o=>Object.assign({},o)),n=[],s={espejo:.42,maniqui:.5,maniquies:.9},r=o=>String(e.numero(o)),a=o=>e.ficha&&e.ficha(o.m,o)||{};return["izquierda","derecha","fondo","frente"].forEach(o=>{let c=o==="fondo"||o==="frente",l=p=>c?p.x:p.y,h=p=>c?p.w:p.h,u=t.filter(p=>p.pared===o).sort((p,_)=>l(p.r)-l(_.r)),d=[],f=()=>{if(d.length){let p=[];d.forEach((b,x)=>{if(x){let w=r(d[x-1].m),C=r(b.m);(e.entre||[]).forEach(([I,U,z])=>{(String(I)===w&&String(U)===C||String(I)===C&&String(U)===w)&&p.push({o:z})})}p.push({it:b})});let _=d[d.length-1],m=l(d[0].r),g=l(_.r)+h(_.r),S=2.5,A=p.map(b=>b.it?a(b.it).peso||1:s[b.o.tipo]||.5),M=A.reduce((b,x)=>b+x,0),E=(g-m-S*(p.length-1))/M,v=m;p.forEach((b,x)=>{let w=E*A[x],C=b.it?b.it.r:d[0].r,I=c?{x:v,y:C.y,w,h:C.h}:{x:C.x,y:v,w:C.w,h:w};b.it?b.it.r=I:n.push({tipo:"extra",pieza:"extra",pared:o,r:I,o:b.o}),v+=w+S})}d=[]};u.forEach(p=>{p.tipo==="modulo"&&!p.vidriera?d.push(p):f()}),f()}),{items:t,extras:n}}function dv(i,e){let t=e.estilo==="shopping"?"shopping":"calle";Ux(t),Ud();let n=new Oi,s={escena:n,lote:new Zi,mundo:Fx(i)},r=new _h,a=[],o=11,c=128,l=e.altoModulos||90,[h,u]=s.mundo(i.x0,i.y0),[d,f]=s.mundo(i.x1,i.y1),p,_=i.tipo==="deposito"&&t==="calle",{items:m,extras:g}=uv(i,e);if(_){let R=gh("#ECE9E2","#B9B3A8",6);R.repeat.set((d-h)/60,(f-u)/60),p=new Ye({map:R,roughness:.4,metalness:.02})}else if(t==="shopping"){let R=gh("#D9CBBF","#B9AA9C",4);R.repeat.set((d-h)/96,(f-u)/96),p=new Ye({map:R,roughness:.3,metalness:.05})}else{let R=new Pr().load(e.texturaPiso||"croquis-img/textura-cemento.webp",()=>e.alCargar&&e.alCargar());R.colorSpace=Yt,R.wrapS=R.wrapT=qt,R.repeat.set((d-h)/150,(f-u)/150),R.anisotropy=8,p=new Ye({map:R,color:"#C9C6C0",roughness:.58,metalness:.02})}let S=new ut(new hn(d-h,f-u),p);S.rotation.x=-Math.PI/2,S.position.set((h+d)/2,0,(u+f)/2),S.receiveShadow=!0,n.add(S),n.userData.piso=S,n.userData.pisoListo=_||t==="shopping";let A=new ut(new hn(d-h+2*o,f-u+2*o),new Ye({color:_?"#D8D4CC":t==="shopping"?"#1A1B1E":"#24262B",roughness:.95}));A.rotation.x=Math.PI/2,A.position.set((h+d)/2,c+1.6,(u+f)/2),A.visible=!1,n.add(A),n.userData.techo=A;let M=m.find(R=>R.tipo==="puerta"),E={},v=_?L.paredDep:L.pared,b=(R,F,G,q,X,he)=>{let ge=he?s.lote:E[R]=E[R]||new Zi,Fe=[[F,G]];if(M&&M.pared===R){let Te=X?M.r.x:M.r.y,Ve=Te+(X?M.r.w:M.r.h);Fe=[[F,Te],[Ve,G]]}Fe.forEach(([Te,Ve])=>{if(Ve-Te<2)return;let[ee,ie]=X?s.mundo((Te+Ve)/2,q+o/2):s.mundo(q+o/2,(Te+Ve)/2),fe=Ve-Te;he?(s.lote.caja(L.cano,X?fe:o*.5,4,X?o*.5:fe,ee,2,ie),s.lote.caja(L.cano,X?fe:o*.5,3,X?o*.5:fe,ee,92,ie),s.lote.caja(L.vidrio,X?fe:1,86,X?1:fe,ee,47,ie)):(ge.caja(R==="fondo"&&!_?L.paredFondo:v,X?fe:o,c,X?o:fe,ee,c/2,ie),ge.caja(L.tapaPared,X?fe+.2:o+.2,1.5,X?o+.2:fe+.2,ee,c+.75,ie))})};b("fondo",i.x0-o,i.x1+o,i.y0-o,!0,!1),b("izquierda",i.y0,i.y1,i.x0-o,!1,!1),b("derecha",i.y0,i.y1,i.x1,!1,!1),b("frente",i.x0-o,i.x1+o,i.y1,!0,i.tipo==="salon");let x=hv(Object.assign({},i,{items:m.concat(g)}),M),w=At(5),C=!1,I=0,U=(R,F)=>{E[R]=E[R]||new Zi,(E[R].extra=E[R].extra||[]).push(F)};if((i.tipo==="deposito"?[]:["fondo","izquierda","derecha"]).forEach(R=>(x[R]||[]).forEach(([F,G])=>{let q=R==="fondo",X=(F+G)/2,he=Ys[R],[ge,Fe]=q?s.mundo(X,i.y0):s.mundo(R==="izquierda"?i.x0:i.x1,X),Te=R==="fondo"?0:R==="izquierda"?Math.PI/2:-Math.PI/2,Ve=G-F,ee=!1;if(!C&&Ve>=50){C=!0,ee=!0;let fe=Px("VDH"),Pe=Math.min(Ve-10,70),ye=new ut(new hn(Pe,Pe/4),new _n({map:fe,transparent:!0,toneMapped:!1,depthWrite:!1}));ye.position.set(ge+he[0]*.8,96,Fe+he[1]*.8),ye.rotation.y=Te,U(R,ye);let Oe=new Hi("#CDEBFF",2600,120,2);Oe.position.set(ge+he[0]*12,92,Fe+he[1]*12),n.add(Oe)}let ie=Math.min(3,Math.max(1,Math.floor(Ve/34)));for(let fe=0;fe<ie;fe++){let Pe=F+Ve*(fe+.5)/ie,[ye,Oe]=q?s.mundo(Pe,i.y0):s.mundo(R==="izquierda"?i.x0:i.x1,Pe),Qe=Math.min(26,Ve/ie-8),ae=Qe*1.25,ue=ee?50:60,se=new ut(new Lt(Qe+2,ae+2,1.2),L.marco),oe=new ut(new hn(Qe,ae),new Ye({map:Rx(I++%3,w),roughness:.4}));se.position.set(ye+he[0]*.6,ue,Oe+he[1]*.6),se.rotation.y=Te,oe.position.set(ye+he[0]*1.3,ue,Oe+he[1]*1.3),oe.rotation.y=Te,se.castShadow=!0,U(R,se),U(R,oe)}})),i.tipo==="salon"&&t==="calle"){let R=new Zi,F=new Tn;cv({lote:R},d-h,f-u,c),R.armar(F,!1),F.visible=!1,n.add(F),n.userData.rieles=F}if(i.tipo==="salon"){let[R,F]=s.mundo((i.x0+i.x1)/2,i.y1+o+24);s.lote.caja(L.vereda,i.x1-i.x0+60,1,48,R,-.5,F)}if(g.forEach((R,F)=>Gx(s,R,E[R.pared]=E[R.pared]||new Zi,900+F)),_&&e.medioDeposito){rv(s,r,i,31);let[R,F]=s.mundo(i.x0+38,i.y1-50);av(s,R,F);let[G,q]=s.mundo(i.x1-30,i.y1-40);ov(s,G,q,-.4)}let z=[],O=(R,F,G)=>{let q=new ut(new Lt(G,86,8),L.toque),X=F.pos(0,43,2);q.position.set(X[0],X[1],X[2]),q.rotation.y=F.ry,q.userData.puerta=R,n.add(q),R.toque=q};m.forEach(R=>{let F=R.r;if(R.tipo==="puerta"){let se=R.pared==="fondo"||R.pared==="frente",oe=Ys[R.pared]||[0,-1];if(i.tipo==="deposito"){let de=E[R.pared]||s.lote,xe={r:se?{x:F.x,y:R.pared==="fondo"?i.y0-o:i.y1,w:F.w,h:o}:{x:R.pared==="izquierda"?i.x0-o:i.x1,y:F.y,w:o,h:F.h},pared:R.pared},Me=Jt({mundo:s.mundo,lote:de},xe),Q=Me.largo;Me.caja(v,Q,c-86,Me.fondo,0,(c+86)/2,Me.fondo/2);for(let rt of[-1,1])Me.caja(L.blanco,2,86,Me.fondo+1,rt*(Q/2-1),43,Me.fondo/2);Me.caja(L.blanco,Q,2,Me.fondo+1,0,85,Me.fondo/2);let qe=Me.pos(0,0,Me.fondo),B={destino:"salon",x:qe[0],z:qe[2],n:oe};z.push(B),O(B,Jt(s,xe),Q)}else{let[de,xe]=s.mundo(F.x+F.w/2,F.y+F.h/2);z.push({destino:"calle",x:de,z:xe,n:oe})}return}if(R.tipo==="fijo"){let se=R.pieza,oe=Ad("p"+F.x+F.y),[de,xe]=s.mundo(F.x+F.w/2,F.y+F.h/2);if(se==="probador")Kx(s,F,R.frente,R.pared&&E[R.pared]||s.lote,R.pared?c:80);else if(se==="caja")t==="calle"?iv(s,F):$x(s,F,t);else if(se==="mesa"&&R.pared)Hx(s,r,R,oe);else if(se==="mesa")ph(s,r,F,["remera"],oe,30,t);else if(se==="mesalisa")t==="calle"?tv(s,r,F,oe,37):ph(s,r,F,null,oe,37,t);else if(se==="perchero")Fl(s,r,F,[],oe,t);else if(se==="planta")Jx(s,de,xe,oe);else if(se==="maniqui")jx(s,de,xe,oe);else if(se==="banco")t==="calle"?nv(s,F,oe):s.lote.caja(L.estante,F.w-2,14,F.h-2,de,7,xe);else if(se==="columna")s.lote.caja(L.panel,F.w,c,F.h,de,c/2,xe);else if(se==="espejo")s.lote.caja(L.espejo,Math.max(1,F.w-2),70,Math.max(1,F.h-2),de,38,xe);else if(se==="deposito"&&R.pared){let Me=Jt({mundo:s.mundo,lote:E[R.pared]||s.lote},R);Me.caja(L.puerta,Me.largo*.7,82,1.2,0,41,.8),Me.caja(L.marco,Me.largo*.7+3,2,1.6,0,83,.8),Me.caja(L.cano,3,.8,.8,Me.largo*.25,42,1.8);let Q=Me.pos(0,0,0),qe={destino:"deposito",x:Q[0],z:Q[2],n:Ys[R.pared]};z.push(qe),O(qe,Jt(s,R),Me.largo*.7)}else se&&s.lote.caja(L.estante,F.w-2,30,F.h-2,de,15,xe);return}let G=R.m,q=Ad(G.id),X=e.tipos(G),he,ge=e.ficha&&e.ficha(G,R)||{},Fe=X.some(se=>se==="camisa"||se==="campera"||se==="vestido"),Te=ge.tipo||e.mueble&&e.mueble(G,R)||(R.pared?"pared":Fe?"perchero":"mesa"),Ve=t==="calle";if(R.vidriera)he=qx(s,r,F,q);else if(R.pared&&i.tipo==="deposito")he=Ve?sv(s,r,R,q):Xx(s,r,R,Math.max(l,96),X,q);else if(R.pared&&(Te==="malla"||Te==="carro")){let se=Jt(s,R),oe=Math.min(se.largo-10,64),de=Math.min(se.fondo-6,26),xe=se.pos(0,0,de/2+3);he=Id(s,r,js(s,xe[0],xe[2],se.ry),oe,de,X.length?X:["campera"],q,!0,ge.arriba||"gorras",ge)}else if(R.pared&&Ve&&Te==="zapatos")he=zx(s,r,R,l,q);else if(R.pared&&Ve&&Te==="mallaAncho")he=Vx(s,r,R,l,q);else if(R.pared&&Ve&&Te==="accesoriosCaja")he=kx(s,r,R,l,q,E[R.pared]);else if(R.pared&&Ve&&ge.bahias)he=Bx(s,r,R,l,ge,q);else if(R.pared)he=(t==="shopping"?Wx:Ox)(s,r,R,l,X.length?X:["remera"],q);else if(Te==="percheroTubo")he=Qx(s,r,F,ge.ropa,q);else if(Te==="rackDoble")he=ev(s,r,F,ge.ropa,ge.doblada,q);else{let[se,oe]=s.mundo(F.x+F.w/2,F.y+F.h/2),de=F.h>F.w;if(Te==="malla")he=Id(s,r,js(s,se,oe,de?Math.PI/2:0),(de?F.h:F.w)-4,Math.min((de?F.w:F.h)-6,28),X.length?X:["campera"],q,!1,"piernas");else{if(Te==="percheroDoble"){let xe=de?{w:F.w/2,h:F.h}:{w:F.w,h:F.h/2},Me=ge.ropa?[ge.ropa]:X,Q=t==="calle"?L.cobre:null;Fl(s,r,{x:F.x,y:F.y,w:xe.w,h:xe.h},Me,q,t,52,Q),Fl(s,r,de?{x:F.x+F.w/2,y:F.y,w:xe.w,h:xe.h}:{x:F.x,y:F.y+F.h/2,w:xe.w,h:xe.h},ge.ropa2?[ge.ropa2]:Me,q+1,t,52,Q)}else Te==="perchero"?Fl(s,r,F,X,q,t):ph(s,r,F,X.length?X:["remera"],q,30,t);he={centro:[se,Te==="mesa"?44:60,oe],frente:[se,0,oe]}}}let ee=e.color(G),ie=R.pared==="fondo"||R.pared==="frente",fe=null,Pe=null;if(R.pared&&!R.vidriera){let se=(ie?F.w:F.h)-6,oe=Ys[R.pared],de=he.frente[0],xe=he.frente[2];fe=new ut(new hn(ie?se:2.2,ie?2.2:se),new _n({color:ee,toneMapped:!1})),fe.rotation.x=-Math.PI/2,fe.position.set(de+oe[0]*1,.15,xe+oe[1]*1),n.add(fe),Pe=new ut(new hn(ie?se+6:16,ie?16:se+6),new _n({color:ee,map:fv(!ie),transparent:!0,opacity:.5,depthWrite:!1,toneMapped:!1,blending:zr})),Pe.rotation.x=-Math.PI/2,Pe.position.set(de+oe[0]*4.5,.2,xe+oe[1]*4.5),n.add(Pe)}let ye=document.createElement("div");ye.className="c3-rotulo",ye.innerHTML=e.rotulo?e.rotulo(G,ee):'<b style="border-color:'+ee+'">'+e.numero(G)+"</b>";let Oe=new Nl(ye);Oe.position.set(he.centro[0],he.centro[1]+8,he.centro[2]),n.add(Oe);let Qe=new ut(new Lt(Math.max(8,F.w),R.vidriera?60:R.pared?l:40,Math.max(8,F.h)),L.toque),[ae,ue]=s.mundo(F.x+F.w/2,F.y+F.h/2);Qe.position.set(ae,Qe.geometry.parameters.height/2,ue),Qe.userData.m=G,n.add(Qe),a.push({m:G,el:ye,toque:Qe,tira:fe,halo:Pe,pared:R.pared||null})});let k=Object.keys(E).map(R=>{let F=new Tn;return E[R].armar(F),(E[R].extra||[]).forEach(G=>F.add(G)),F.userData={lado:R,n:Ys[R],borde:{fondo:u,frente:f,izquierda:h,derecha:d}[R]},n.add(F),F});s.lote.armar(n),r.armar(n);let j=[];if(m.concat(g).forEach(R=>{if(R.tipo==="puerta"||R.tipo==="fijo"&&(!R.pieza||R.pieza==="deposito"))return;let F=R.r,G=R.pieza==="probador"?999:24,q=F.x,X=F.x+F.w,he=F.y,ge=F.y+F.h;R.pared==="izquierda"?X=Math.min(X,q+G):R.pared==="derecha"?q=Math.max(q,X-G):R.pared==="fondo"?ge=Math.min(ge,he+G):R.pared==="frente"&&!R.vidriera&&(he=Math.max(he,ge-G));let[Fe,Te]=s.mundo(q,he),[Ve,ee]=s.mundo(X,ge);j.push({x0:Fe,z0:Te,x1:Ve,z1:ee})}),i.tipo==="deposito"&&t==="calle"&&e.medioDeposito){let[R,F]=s.mundo((i.x0+i.x1)/2,(i.y0+i.y1)/2);j.push({x0:R-38,z0:F-16,x1:R+38,z1:F+32})}return{escena:n,cajas:a,muros:k,puertas:z,obstaculos:j,ancho:d-h,largo:f-u}}var Nd={};function fv(i){return Nd[i]||(Nd[i]=Cx(i))}function h1(i,e,t,n){let s=i.clientWidth,r=i.clientHeight,a=new Ml({antialias:!0,preserveDrawingBuffer:!!n.paraFoto,powerPreference:"high-performance"});a.setPixelRatio(Math.min(window.devicePixelRatio||1,n.liviano?1:1.5)),a.setSize(s,r),a.shadowMap.enabled=!n.liviano,a.shadowMap.type=Ao,a.shadowMap.autoUpdate=!1,a.shadowMap.needsUpdate=!0,a.toneMapping=Wi,a.toneMappingExposure=n.estilo==="shopping"?1.1:1,a.outputColorSpace=Yt,i.appendChild(a.domElement);let o=new Ul;o.setSize(s,r),o.domElement.className="c3-etiquetas",i.appendChild(o.domElement);let{escena:c,cajas:l,muros:h,puertas:u,obstaculos:d,ancho:f,largo:p}=dv(e,n);c.background=new tt(n.fondo||"#1C222B");let _=new Hs(a);c.environment=_.fromScene(new wl,.04).texture,c.environmentIntensity=.55,c.add(new Ir("#FFF3E2","#3A3530",.55));let m=new Nr("#FFF0DA",2.9);m.position.set(-f*.45,380,p*.55),m.castShadow=!n.liviano;let g=m.shadow.camera,S=Math.max(f,p)*.62;g.left=-S,g.right=S,g.top=S,g.bottom=-S,g.near=50,g.far=900,m.shadow.mapSize.set(2048,2048),m.shadow.radius=5,m.shadow.bias=-4e-4,m.shadow.normalBias=.6,c.add(m);let A=[];if(!n.liviano)for(let[N,Z]of[[-.25,-.3],[.25,-.3],[-.25,.1],[.25,.1],[0,.38]]){let $=new Lr("#FFE2B8",9e3,260,.75,.9,2);$.position.set(N*f,150,Z*p),$.target.position.set(N*f,0,Z*p),c.add($),c.add($.target),A.push($)}let M=!1,E=()=>{let N=c.userData.piso;if(M||n.liviano||!N)return;M=!0;let Z=2048,$=f>=p?Z:Math.round(Z*f/p),Se=f>=p?Math.round(Z*p/f):Z,Le=new Ct($,Se,{type:Vt}),Ze=new Xn(-f/2,f/2,p/2,-p/2,1,2e3);Ze.position.set(N.position.x,600,N.position.z),Ze.up.set(0,0,-1),Ze.lookAt(N.position.x,0,N.position.z),Ze.updateMatrixWorld();let $e=new Set;c.traverse(it=>{(it.isMesh||it.isInstancedMesh)&&it!==N&&[].concat(it.material).forEach(sn=>$e.add(sn))});let et=[...$e].map(it=>[it,it.colorWrite,it.depthWrite]);$e.forEach(it=>{it.colorWrite=!1,it.depthWrite=!1});let Tt=h.map(it=>it.scale.y);h.forEach(it=>{it.scale.y=1}),a.shadowMap.needsUpdate=!0,a.setRenderTarget(Le),a.render(c,Ze),a.setRenderTarget(null),et.forEach(([it,sn,Zs])=>{it.colorWrite=sn,it.depthWrite=Zs}),h.forEach((it,sn)=>{it.scale.y=Tt[sn]}),N.material=new _n({map:Le.texture}),a.shadowMap.enabled=!1,m.castShadow=!1,A.forEach(it=>{c.remove(it),c.remove(it.target)}),$e.forEach(it=>{it.needsUpdate=!0})},v=new Xt(36,s/r,5,5e3),b=new Tl(v,a.domElement);b.enableDamping=!0,b.dampingFactor=.08,b.minPolarAngle=.05,b.maxPolarAngle=1.22,b.screenSpacePanning=!0,b.target.set(0,10,0);let x=[];for(let N of[-f/2-12,f/2+12])for(let Z of[-p/2-12,p/2+14])for(let $ of[0,100])x.push(new D(N,$,Z));let w=(N,Z)=>{let $=Math.max(f,p)*1.6,Se=Math.min(.3,Math.max(0,(n.abajo||0)/Math.max(1,i.clientHeight)));for(let Le=0;Le<12;Le++){v.position.setFromSphericalCoords($,N,Z).add(b.target),v.lookAt(b.target),v.updateMatrixWorld();let Ze=9,$e=-9,et=9,Tt=-9;x.forEach(xa=>{let Ri=xa.clone().project(v);Ze=Math.min(Ze,Ri.x),$e=Math.max($e,Ri.x),et=Math.min(et,Ri.y),Tt=Math.max(Tt,Ri.y)});let it=($e-Ze)/2/.96,sn=(Tt-et)/2/(.94*(1-Se)),Zs=(Ze+$e)/2,ga=(et+Tt)/2-Se,_a=new D().setFromMatrixColumn(v.matrixWorld,0),Kn=new D().setFromMatrixColumn(v.matrixWorld,1),Qi=$*Math.tan(Bs.degToRad(v.fov/2));b.target.addScaledVector(_a,Zs*Qi*v.aspect*.9).addScaledVector(Kn,ga*Qi*.9),b.target.y=10,$*=Math.max(it,sn)}v.position.setFromSphericalCoords($,N,Z).add(b.target),b.update()};w(n.polar||.6,n.azimut||0);let C=null;if(!n.liviano){C=new Rl(a,new Ct(s,r,{samples:4,type:Vt})),C.setPixelRatio(a.getPixelRatio()),C.addPass(new Pl(c,v));let N=new ha(c,v,s,r);N.updateGtaoMaterial({radius:14,distanceExponent:1.6,thickness:6,scale:1.1,samples:12}),N.blendIntensity=.85,C.addPass(N),C.addPass(new Ll)}let I=()=>{h.forEach(N=>{let Z=N.userData,$=v.position,Se=Z.n[0]?($.x-Z.borde)*Z.n[0]<-4:($.z-Z.borde)*Z.n[1]<-4,Le=Se?.12:1;N.scale.y!==Le&&(N.scale.y=Le,a.shadowMap.needsUpdate=!0)})},U=null,z=(N,Z,$)=>{U={t:N.clone(),r:Z,p:$?$.clone():null,ts:performance.now()},Fe()},O=()=>{if(!U)return!1;let N=performance.now(),Z=1-Math.pow(.82,Math.min(30,(N-U.ts)/16.7));if(U.ts=N,U.p)return b.target.lerp(U.t,Z),v.position.lerp(U.p,Z),v.position.distanceTo(U.p)<.5&&(v.position.copy(U.p),b.target.copy(U.t),U=null),!0;let $=v.position.clone().sub(b.target),Se=$.length();return b.target.lerp(U.t,Z),$.setLength(Se+(U.r-Se)*Z),v.position.copy(b.target).add($),b.target.distanceTo(U.t)<.5&&Math.abs($.length()-U.r)<1&&(U=null),!0},k=0,j=0,R=0,F=!1,G=!0,q=!1,X=a.getPixelRatio(),he=[],ge=N=>{if(k=0,!G)return;let Z=Q?P():O(),$=(Q?!1:b.update())||Z;I();let Se=performance.now(),Le=N!==!0&&($||Se-j<160),Ze=he.length>5?he.reduce(($e,et)=>$e+et,0)/he.length:0;if(Le&&!q&&Ze>22&&!n.paraFoto?(q=!0,a.setPixelRatio(Math.max(.5,X*.6))):!Le&&q&&(q=!1,a.setPixelRatio(X)),C&&!Le?C.render():a.render(c,v),o.render(c,v),Le){if(he.push(performance.now()-Se),he.length>30&&he.shift(),he.length===30&&n.alLento&&!F){let $e=he.reduce((et,Tt)=>et+Tt,0)/30;$e>40&&(F=!0,setTimeout(()=>n.alLento($e),0))}clearTimeout(R),R=setTimeout(()=>ge(!0),220)}(Z||$)&&Fe()},Fe=()=>{k||(k=requestAnimationFrame(ge))};n.alCargar=()=>{a.shadowMap.needsUpdate=!0,E(),Fe()},c.userData.pisoListo&&E(),b.addEventListener("change",()=>{j=performance.now(),Fe()});let Te=new Fr,Ve=new pe,ee=l.map(N=>N.toque),ie=new on(new D(0,1,0),0),fe=(N,Z)=>{let $=a.domElement.getBoundingClientRect();Ve.set((N-$.left)/$.width*2-1,-((Z-$.top)/$.height)*2+1),Te.setFromCamera(Ve,v)},Pe=(N,Z)=>{fe(N,Z);let $=Te.intersectObjects(ee,!1)[0],Se=$&&oe.length?Te.intersectObjects(oe,!1)[0]:null;return!$||Se&&Se.distance<$.distance+20?null:$.object.userData.m},ye=(N,Z)=>(fe(N,Z),Te.ray.intersectPlane(ie,new D)),Oe=62,Qe=150,ae=10,ue={x0:-f/2+ae,x1:f/2-ae,z0:-p/2+ae,z1:p/2-ae},se=N=>(N.x=Math.max(ue.x0,Math.min(ue.x1,N.x)),N.z=Math.max(ue.z0,Math.min(ue.z1,N.z)),N),oe=u.filter(N=>N.toque).map(N=>N.toque),de=8,xe=(N,Z)=>!d.some($=>N>$.x0-de&&N<$.x1+de&&Z>$.z0-de&&Z<$.z1+de),Me=(N,Z)=>{let $=Q.pos,Se=$.x,Le=$.z,Ze=!xe(Se,Le),$e=se(new D(N,0,Z));return(Ze||xe($e.x,Le))&&($.x=$e.x),(Ze||xe($.x,$e.z))&&($.z=$e.z),Math.abs($.x-Se)+Math.abs($.z-Le)>.01},Q=null,qe=()=>new D(Math.sin(Q.yaw)*Math.cos(Q.pitch),Math.sin(Q.pitch),Math.cos(Q.yaw)*Math.cos(Q.pitch)),B=N=>{let Z=u.find(Se=>Se.destino===N)||u.find(Se=>Se.destino==="calle")||u[0];if(!Z)return{x:0,z:p/2-40,yaw:Math.PI};let $=null;for(let Se=16;Se<=90&&!$;Se+=4){let Le=se(new D(Z.x+Z.n[0]*Se,0,Z.z+Z.n[1]*Se));xe(Le.x,Le.z)&&($=Le)}return $=$||se(new D(Z.x+Z.n[0]*30,0,Z.z+Z.n[1]*30)),{x:$.x,z:$.z,yaw:Math.atan2(Z.n[0],Z.n[1])}},rt=N=>{N=N||B(e.tipo==="deposito"?"salon":"calle"),U=null,b.enabled=!1,Q={yaw:N.yaw,pitch:-.1,pos:new D(N.x,Oe,N.z),destino:null,teclas:{},t:performance.now()};let Z=v.clone();Z.position.copy(Q.pos),Z.lookAt(Q.pos.clone().add(qe())),N.directo?(v.position.copy(Q.pos),v.quaternion.copy(Z.quaternion),v.fov=62,v.updateProjectionMatrix()):Q.tween={p0:v.position.clone(),q0:v.quaternion.clone(),q1:Z.quaternion.clone(),f0:v.fov,t0:performance.now(),dur:1100},c.userData.techo&&(c.userData.techo.visible=!0),c.userData.rieles&&(c.userData.rieles.visible=!0),n.alCaminar&&n.alCaminar(!0),Fe()},nt=()=>{if(!Q)return;let N=new D(Math.sin(Q.yaw),0,Math.cos(Q.yaw));Q=null,b.enabled=!0,c.userData.techo&&(c.userData.techo.visible=!1),c.userData.rieles&&(c.userData.rieles.visible=!1),v.fov=36,v.updateProjectionMatrix(),b.target.copy(v.position).addScaledVector(N,70).setY(10),z(_e.t,0,_e.p),n.alCaminar&&n.alCaminar(!1)},P=()=>{let N=performance.now(),Z=Math.min(.3,(N-Q.t)/1e3);if(Q.t=N,Q.tween){let et=Q.tween,Tt=Math.min(1,(N-et.t0)/et.dur),it=Tt<.5?2*Tt*Tt:1-Math.pow(-2*Tt+2,2)/2;return v.position.lerpVectors(et.p0,Q.pos,it),v.quaternion.slerpQuaternions(et.q0,et.q1,it),v.fov=et.f0+(62-et.f0)*it,v.updateProjectionMatrix(),Tt>=1&&(Q.tween=null,Q.t=performance.now()),!0}let $=!1,Se=Q.teclas,Le=(Se.arrowup||Se.w?1:0)-(Se.arrowdown||Se.s?1:0),Ze=(Se.d?1:0)-(Se.a?1:0),$e=(Se.arrowleft?1:0)-(Se.arrowright?1:0);if($e&&(Q.yaw+=$e*Z*1.8,$=!0),Le||Ze){let et=new D(Math.sin(Q.yaw),0,Math.cos(Q.yaw)),Tt=new D(-et.z,0,et.x),it=et.multiplyScalar(Le*Qe*Z).addScaledVector(Tt,Ze*Qe*Z);Me(Q.pos.x+it.x,Q.pos.z+it.z),Q.destino=null,$=!0}if(Q.destino){let et=Q.destino.clone().sub(Q.pos);et.y=0;let Tt=et.length(),it=Qe*Z*Math.max(.35,Math.min(2.4,.35+Tt/110));if(Tt<=it){if(Q.pos.x=Q.destino.x,Q.pos.z=Q.destino.z,Q.destino=null,Q.alLlegar){let sn=Q.alLlegar;Q.alLlegar=null,setTimeout(sn,0)}}else if(et.normalize(),!Me(Q.pos.x+et.x*it,Q.pos.z+et.z*it)&&(Q.destino=null,Q.alLlegar)){let sn=Q.alLlegar;Q.alLlegar=null,setTimeout(sn,0)}$=!0}for(let et in Se)Se[et]==="fin"&&delete Se[et];return v.position.copy(Q.pos),v.lookAt(Q.pos.clone().add(qe())),$||!!Q.mirando||Object.keys(Se).length>0},y=(N,Z)=>{fe(N,Z);let $=Te.intersectObjects(oe,!1)[0];if($){let $e=$.object.userData.puerta;Q.destino=se(new D($e.x+$e.n[0]*26,Oe,$e.z+$e.n[1]*26)),Fe();return}let Se=Te.ray.intersectPlane(ie,new D),Le=Te.intersectObjects(ee,!1)[0],Ze=Se;if(Le&&(!Se||Le.distance<v.position.distanceTo(Se))){Ze=Le.point.clone();let $e=Ze.clone().sub(v.position).setY(0).normalize();for(let et=20;et<200&&!xe(Ze.x-$e.x*et,Ze.z-$e.z*et);et+=6);Ze.addScaledVector($e,-Math.min(200,20+[...Array(30).keys()].map(et=>et*6).find(et=>xe(Ze.x-$e.x*(20+et),Ze.z-$e.z*(20+et)))||0))}if(Ze){if(Q.destino=se(new D(Ze.x,Oe,Ze.z)),Le&&Le.object.userData.m&&n.alTocar&&Ze!==Se){let $e=Le.object.userData.m;Q.alLlegar=()=>n.alTocar($e)}Fe()}},W=N=>{if(n.alPuerta){if(!Q){n.alPuerta(N.destino);return}Q.yaw=Math.atan2(N.x-Q.pos.x,N.z-Q.pos.z),Q.pitch=-.05,Q.destino=se(new D(N.x+N.n[0]*12,Oe,N.z+N.n[1]*12)),Q.alLlegar=()=>n.alPuerta(N.destino),Fe()}},Y=a.domElement,te=null,me=null,ve=0;Y.addEventListener("pointerdown",N=>{!Q&&N.button===0&&(me={x:N.clientX,y:N.clientY,t:performance.now()})}),Y.addEventListener("pointerup",N=>{if(Q||!me)return;let Z=me;if(me=null,Math.abs(N.clientX-Z.x)+Math.abs(N.clientY-Z.y)>6||performance.now()-Z.t>600||!n.alTocar)return;let $=Pe(N.clientX,N.clientY);if($){if(clearTimeout(ve),!oe.length||!Te.intersectObjects(oe,!1).length){n.alTocar($);return}ve=setTimeout(()=>{G&&n.alTocar($)},320)}}),Y.addEventListener("pointerdown",N=>{if(Q){te={x:N.clientX,y:N.clientY,x0:N.clientX,y0:N.clientY,id:N.pointerId,movio:!1};try{Y.setPointerCapture(N.pointerId)}catch{}}}),Y.addEventListener("pointermove",N=>{if(!Q||!te||N.pointerId!==te.id)return;let Z=N.clientX-te.x,$=N.clientY-te.y;te.x=N.clientX,te.y=N.clientY,!(!te.movio&&Math.abs(N.clientX-te.x0)+Math.abs(N.clientY-te.y0)<6)&&(te.movio=!0,Q.mirando=!0,j=performance.now(),Q.yaw+=Z*.005,Q.pitch=Math.max(-1,Math.min(1,Q.pitch-$*.004)),Fe())});let re=N=>{if(!Q||!te||N.pointerId!==te.id)return;let Z=!te.movio&&N.type==="pointerup";te=null,Q.mirando=!1,j=performance.now(),Z&&y(N.clientX,N.clientY),Fe()};Y.addEventListener("pointerup",re),Y.addEventListener("pointercancel",re),Y.addEventListener("wheel",N=>{Q&&(N.preventDefault(),v.fov=Math.max(34,Math.min(80,v.fov+Math.sign(N.deltaY)*4)),v.updateProjectionMatrix(),j=performance.now(),Fe())},{passive:!1});let le={arrowup:1,arrowdown:1,arrowleft:1,arrowright:1,w:1,a:1,s:1,d:1},Ee=N=>{let Z=String(N.key||"").toLowerCase(),$=N.target&&N.target.tagName;!Q||!le[Z]||N.altKey||N.ctrlKey||N.metaKey||$==="INPUT"||$==="TEXTAREA"||$==="SELECT"||n.quieto&&n.quieto()||(N.preventDefault(),Q.teclas[Z]=!0,j=performance.now(),Fe())},ke=N=>{let Z=String(N.key||"").toLowerCase();Q&&Q.teclas[Z]&&(Q.teclas[Z]="fin",j=performance.now(),Fe())},be=()=>{Q&&(Q.teclas={})};window.addEventListener("keydown",Ee),window.addEventListener("keyup",ke),window.addEventListener("blur",be),a.domElement.addEventListener("dblclick",N=>{clearTimeout(ve),fe(N.clientX,N.clientY);let Z=Te.intersectObjects(oe,!1)[0];if(Z){W(Z.object.userData.puerta);return}if(Q)return;let $=ye(N.clientX,N.clientY);if(!$)return;let Se=v.position.distanceTo(b.target);z(new D($.x,10,$.z),Math.max(b.minDistance||60,Se*(N.shiftKey?2:.5)))}),b.minDistance=50,b.maxDistance=Math.max(f,p)*4;let _e={t:b.target.clone(),p:v.position.clone()},ze=()=>{Q?nt():z(_e.t,0,_e.p)};return n.caminar==="puerta"?rt(Object.assign(B(e.tipo==="deposito"?"salon":"deposito"),{directo:!0})):n.caminar==="entrada"?rt(Object.assign(B(e.tipo==="deposito"?"salon":"calle"),{directo:!0})):n.caminar&&typeof n.caminar=="object"&&rt(Object.assign({},n.caminar,{directo:!0})),Fe(),{render:Fe,dibujar:ge,camara:v,controles:b,renderer:a,encuadrar:w,cajas:l,escena:c,moduloEn:Pe,pisoEn:ye,viajar:z,vistaInicial:ze,redimensionar:()=>{let N=i.clientWidth,Z=i.clientHeight;!N||!Z||(a.setSize(N,Z),o.setSize(N,Z),C&&C.setSize(N,Z),v.aspect=N/Z,v.updateProjectionMatrix(),Fe())},destruir:()=>{G=!1,clearTimeout(R),cancelAnimationFrame(k),b.dispose(),a.dispose(),a.forceContextLoss(),a.domElement.remove(),o.domElement.remove(),window.removeEventListener("keydown",Ee),window.removeEventListener("keyup",ke),window.removeEventListener("blur",be)},pintar:(N,Z)=>{l.forEach($=>{let Se=N($.m),Le=!Z||Z($.m);$.tira&&($.tira.material.color.set(Se),$.tira.visible=Le),$.halo&&($.halo.material.color.set(Se),$.halo.visible=Le);let Ze=$.el.querySelector("b");Ze&&(Ze.style.borderColor=Se),$.el.classList.toggle("apagado",!Le),$.el.classList.toggle("resaltado",!!Z&&Le)}),Fe()},acercar:N=>{if(Q){v.fov=Math.max(34,Math.min(80,v.fov/N)),v.updateProjectionMatrix(),Fe();return}z(b.target,Math.max(b.minDistance,Math.min(b.maxDistance,v.position.distanceTo(b.target)/N)))},girar:N=>{if(Q){Q.yaw+=N,Fe();return}let Z=v.position.clone().sub(b.target).applyAxisAngle(new D(0,1,0),N);z(b.target,0,b.target.clone().add(Z))},inclinar:N=>{Q&&nt();let Z=b.target,$=v.position.distanceTo(Z),Se=Math.atan2(v.position.x-Z.x,v.position.z-Z.z);z(Z,0,new D().setFromSphericalCoords($,N?.06:.6,Se).add(Z))},mirarModulos:N=>{let Z=l.filter(it=>N.indexOf(it.m.id)>-1);if(!Z.length)return;Q&&nt();let $=new wn;Z.forEach(it=>$.expandByObject(it.toque));let Se=$.getCenter(new D),Le=$.getSize(new D),Ze=Z[0].pared?Ys[Z[0].pared]:[0,1],$e=Math.max(Le.x*Math.abs(Ze[1])+Le.z*Math.abs(Ze[0]),60),et=Math.min(Math.max(f,p),$e/2/Math.tan(Bs.degToRad(v.fov/2))/Math.min(1,v.aspect)*1.1+30),Tt=new D(Se.x,40,Se.z);z(Tt,0,new D(Se.x+Ze[0]*et,40+et*.45,Se.z+Ze[1]*et))},caminar:()=>rt(),dejarDeCaminar:nt,caminando:()=>!!Q,puertas:u,pasarPor:W,moviendo:()=>!!U||!!(Q&&(Q.tween||Q.destino)),dondeEstoy:()=>Q?{x:Q.pos.x,z:Q.pos.z,yaw:Q.yaw}:null}}export{h1 as montarCroquis3D};
/*! Bundled license information:

three/build/three.core.js:
three/build/three.module.js:
  (**
   * @license
   * Copyright 2010-2026 Three.js Authors
   * SPDX-License-Identifier: MIT
   *)
*/
