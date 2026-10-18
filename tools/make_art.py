"""One-time original pixel artwork. Requires draw/draw-sheet; never called by build."""
import math,json,subprocess,os,random
os.makedirs('/tmp/wick-art',exist_ok=True)
random.seed(41)
OUT='assets/'
INK='#0a151d'; DEEP='#142b32'; TEAL='#315459'; MID='#538079'; LIGHT='#a6b5a0'; GOLD='#bc8951'; PALE='#f1d69a'; FIRE='#f0a34d'
class Art:
 def __init__(self,w,h): self.w=w;self.h=h;self.p={}
 def px(self,x,y,c):
  x,y=round(x),round(y)
  if 0<=x<self.w and 0<=y<self.h:self.p[x,y]=c
 def rect(self,x,y,w,h,c):
  for yy in range(round(y),round(y+h)):
   for xx in range(round(x),round(x+w)):self.px(xx,yy,c)
 def ell(self,x,y,rx,ry,c):
  for yy in range(math.floor(y-ry),math.ceil(y+ry)+1):
   for xx in range(math.floor(x-rx),math.ceil(x+rx)+1):
    if ((xx-x)/max(.1,rx))**2+((yy-y)/max(.1,ry))**2<=1:self.px(xx,yy,c)
 def line(self,x,y,xx,yy,c,width=1):
  n=max(1,math.ceil(max(abs(xx-x),abs(yy-y))))
  for i in range(n+1):self.rect(round(x+(xx-x)*i/n),round(y+(yy-y)*i/n),width,width,c)
 def poly(self,pts,c):
  for y in range(self.h):
   for x in range(self.w):
    inside=False;j=len(pts)-1
    for i in range(len(pts)):
     xi,yi=pts[i];xj,yj=pts[j]
     if ((yi>y)!=(yj>y)) and x<(xj-xi)*(y-yi)/(yj-yi)+xi:inside=not inside
     j=i
    if inside:self.px(x,y,c)
 def save(self,path,sheet=False):
  os.makedirs(os.path.dirname(OUT+path),exist_ok=True)
  log='/tmp/wick-art/ops.json';json.dump([{'op':'set_pixel','x':x,'y':y,'color':c} for (x,y),c in self.p.items()],open(log,'w'))
  subprocess.run(['draw-sheet' if sheet else 'draw','render','--actions',log,'--out',OUT+path,'--width',str(self.w),'--height',str(self.h),'--no-layers'],check=True,stdout=subprocess.DEVNULL)
def lamp(f=0):
 a=Art(24,32);step=[0,1,2,0,-1,-2][f];bob=f%2
 a.ell(12,29,9,2,'#09121988');a.line(9,23,8+step,29,INK,3);a.line(14,23,15-step,29,INK,3)
 a.poly([(7,12+bob),(15,12+bob),(17,25),(5,25)],INK);a.poly([(8,13+bob),(14,13+bob),(15,23),(7,24)],TEAL);a.line(8,14,8,22,MID);a.rect(7,23,10,2,GOLD)
 a.rect(9,5+bob,6,8,INK);a.rect(11,7+bob,5,5,'#ba9773');a.rect(15,8+bob,2,3,PALE);a.px(14,8+bob,INK)
 a.rect(8,4+bob,7,3,TEAL);a.rect(5,6+bob,13,2,INK);a.rect(6,6+bob,11,1,GOLD)
 a.line(13,15+bob,19,17+bob,GOLD,2);a.rect(19,13+bob,1,6,PALE);a.rect(17,17+bob,6,7,INK);a.rect(18,18+bob,4,5,GOLD);a.rect(19,18+bob,2,4,PALE);a.px(20,19+bob,'#fff8dc');a.rect(17,24+bob,6,1,GOLD)
 return a
lamp().save('sprites/lamplighter/idle.png')
for f in range(6):lamp(f).save(f'sprites/lamplighter/walk/{f}.png',True)
sizes={'moth':20,'bat':20,'rat':24,'gnat':16,'beetle':28,'wisp':20,'spider':28,'crow':24,'shade':32,'hound':36,'mothwing':56,'owl':72,'dark':80}
for name,n in sizes.items():
 for f in range(4):
  a=Art(n,n);cx=n/2;cy=n/2;b=[-2,0,2,1][f];s=n/24
  def poly(pts,c):a.poly([(x*s,y*s) for x,y in pts],c)
  def ell(x,y,rx,ry,c):a.ell(x*s,y*s,rx*s,ry*s,c)
  def line(x,y,xx,yy,c,w=1):a.line(x*s,y*s,xx*s,yy*s,c,max(1,round(w*s)))
  if name in ['moth','mothwing','bat','owl','crow','gnat']:
   if name in ['moth','mothwing','owl']:
    poly([(11,10),(5,3+b),(1,5+b),(2,15),(8,18),(11,14)],INK);poly([(13,10),(19,3+b),(23,5+b),(22,15),(16,18),(13,14)],INK)
    for side in [-1,1]:
     ell(12+side*7,10+b,4,6,GOLD if name!='owl' else LIGHT);ell(12+side*6,11+b,2,3,TEAL);ell(12+side*6,10+b,1,1,PALE);line(12+side*2,11,12+side*9,6+b,PALE)
    ell(12,13,2.5,7,DEEP);line(11,7,9,3,GOLD);line(13,7,15,3,GOLD)
   else:
    poly([(12,10),(5,2+b),(0,10+b),(5,9),(7,14),(10,13),(12,18),(14,13),(17,14),(19,9),(24,10+b),(19,2+b)],INK)
    poly([(11,11),(5,4+b),(2,8+b),(6,8),(9,12)],MID if name=='gnat' else TEAL);poly([(13,11),(19,4+b),(22,8+b),(18,8),(15,12)],TEAL)
    ell(12,12,2,5,GOLD if name=='gnat' else '#736d7b');poly([(10,9),(10,5),(12,7),(14,5),(14,10)],DEEP)
    if name=='crow':poly([(14,8),(20,10),(14,11)],GOLD)
  elif name in ['rat','hound']:
   poly([(4,12),(8,8),(17,8),(20,11),(23,13),(22,17),(17,17),(14,20),(5,18)],INK);ell(11,13,7,5,'#71666a' if name=='rat' else '#354c56');poly([(17,9),(17,4),(20,8),(22,9),(23,15),(17,16)],TEAL);line(5,14,1,9+b,GOLD);line(7,17,5+b,21,INK,2);line(16,17,19-b,21,INK,2);line(8,10,14,10,MID);a.px(21*s,12*s,FIRE)
  elif name in ['beetle','spider']:
   for side in [-1,1]:
    for j in range(3 if name=='beetle' else 4):line(12+side*4,9+j*2,12+side*(9+j%2),5+j*4+b*(j%2*2-1),GOLD if name=='beetle' else MID)
   ell(12,13,6 if name=='beetle' else 4,8 if name=='beetle' else 4,INK);ell(12,13,5 if name=='beetle' else 3,7 if name=='beetle' else 3,TEAL if name=='beetle' else '#6f5c69');ell(10,11,2 if name=='beetle' else 1,4 if name=='beetle' else 2,MID);line(12,7,12,19,INK);ell(12,5,3,3,INK)
  elif name in ['wisp','shade','dark']:
   poly([(12,1),(18,5),(20,12),(22,22),(17,19+b),(14,23),(10,20),(6,23-b),(2,21),(5,11),(6,5)],INK)
   poly([(12,3),(16,6),(17,13),(19,19),(13,17),(10,20),(6,18),(8,7)],'#25424c' if name!='wisp' else MID);ell(12,9,4,5,DEEP);line(7,16,6+b,20,TEAL);line(16,15,18-b,20,TEAL)
   if name=='dark':
    poly([(5,8),(2,2),(9,5),(12,0),(15,5),(22,2),(19,9)],GOLD);line(12,13,12,20,GOLD);ell(12,17,2,2,PALE)
  # Each creature has its own readable outline, including the smaller flyers.
  if name=='gnat':
   a=Art(n,n)
   for side in [-1,1]:
    ell(12+side*5,10+b,5,2,LIGHT);line(12+side*2,13,12+side*7,18-b,TEAL)
   ell(12,13,1.5,6,INK);line(12,10,12,17,GOLD);line(11,8,8,4,GOLD);line(13,8,16,4,GOLD)
  if name=='wisp':
   a=Art(n,n)
   poly([(13,0),(12,5),(17,7),(19,13),(16,17),(11,18),(7+b,23),(8,17),(4,14),(5,8),(9,5)],TEAL)
   poly([(12,4),(15,8),(16,13),(13,16),(10,15),(7,12),(8,8)],MID)
   ell(12,10,4,5,'#a9cfb4');poly([(9,15),(11,17),(9+b,21),(5+b,23),(8,18)],MID)
  if name=='owl':
   a=Art(n,n)
   for side in [-1,1]:
    poly([(12+side*3,8),(12+side*9,4+b),(12+side*11,8+b),(12+side*9,18),(12+side*6,21),(12+side*4,16)],INK)
    poly([(12+side*4,9),(12+side*9,6+b),(12+side*9,14),(12+side*6,19)],TEAL)
    for j in range(3):line(12+side*(6+j),10+b,12+side*(5+j),17-j,GOLD)
   ell(12,14,5,8,INK);ell(12,14,4,7,GOLD)
   poly([(5,10),(5,2),(10,5),(14,5),(19,2),(19,10)],INK)
   ell(9,9,4,5,LIGHT);ell(15,9,4,5,LIGHT);ell(9,9,2,3,DEEP);ell(15,9,2,3,DEEP)
   poly([(11,11),(14,11),(12,15)],GOLD)
   for yy in [15,17,19]:line(10,yy,14,yy,DEEP)
   line(9,21,8,23,GOLD);line(15,21,16,23,GOLD)
  if name=='mothwing':
   for side in [-1,1]:
    poly([(12+side*7,12),(12+side*11,21+b),(12+side*6,19),(12+side*3,15)],GOLD)
    line(12+side*6,14,12+side*9,19+b,PALE)
   line(11,5,7,1,GOLD);line(13,5,17,1,GOLD);line(8,2,5,3,PALE);line(16,2,19,3,PALE)
  if name=='rat':
   ell(17,8,3,3,INK);ell(17,8,2,2,'#aa7b75');line(4,15,1,18,GOLD);line(1,18,3,22,GOLD)
  if name=='hound':
   poly([(4,12),(5,5),(9,10),(10,5),(14,9),(17,5),(19,10),(20,16),(15,19),(11,17),(6,18)],INK)
   poly([(7,10),(9,8),(12,11),(16,8),(18,12),(15,16),(8,16)],TEAL)
   line(7,17,6+b,23,INK,2);line(16,17,18-b,23,INK,2);poly([(18,12),(24,13),(23,16),(18,16)],'#58706b');line(20,16,23,16,PALE)
  # Eyes are small, clear points of hostile candlelight.
  for x in [10,14]:ell(x,8 if name in ['beetle','spider'] else 10,.65,.65,INK if f==3 else PALE if name=='wisp' else FIRE)
  a.save(f'sprites/enemies/{name}/{f}.png',True)
# Weathered, seamlessly repeating cobbles.
a=Art(64,64);a.rect(0,0,64,64,'#14272d')
for y in range(0,64,16):
 for x in range(-16,64,32):
  x+=(y//16%2)*16;a.rect(x+1,y+1,30,14,'#1b3136');a.line(x+3,y+2,x+28,y+2,'#243c3e');a.line(x+29,y+3,x+29,y+13,'#102329');a.line(x+4,y+13,x+27,y+13,'#11262b')
for i in range(130):
 x=random.randrange(64);y=random.randrange(64);a.px(x,y,random.choice(['#284043','#1d373a','#152b30']))
a.line(18,21,23,24,'#0e252b');a.line(23,24,21,28,'#0e252b');a.rect(45,47,3,1,'#42504a');a.save('sprites/ground.png')
for i,(name,n) in enumerate([('small',8),('medium',12),('large',16)]):
 a=Art(n,n);c=n//2;a.poly([(c,0),(n-1,c),(c,n-1),(0,c)],INK);a.poly([(c,1),(n-2,c),(c,n-2),(1,c)],'#599f9b');a.poly([(c,1),(c,n-3),(2,c)],'#b2ead0');a.line(c,2,n-3,c,'#f1f1bb');a.save(f'sprites/gems/{name}.png')
def icon(name,n=24,f=0,effect=False):
 a=Art(n,n);s=n/24
 def poly(p,c):a.poly([(x*s,y*s) for x,y in p],c)
 def ell(x,y,rx,ry,c):a.ell(x*s,y*s,rx*s,ry*s,c)
 def rect(x,y,w,h,c):a.rect(x*s,y*s,w*s,h*s,c)
 def line(x,y,xx,yy,c,w=1):a.line(x*s,y*s,xx*s,yy*s,c,max(1,round(w*s)))
 base={'pyre':'taper','beacon':'ember','hail':'pin','chandelier':'lantern','corona':'halo','blaze':'oil-splash'}.get(name,name);gold='#b7dad1' if base!=name else GOLD;light='#f4f3c9' if base!=name else PALE
 if base in ['taper','wick','tallow']:
  rect(9,10,6,11,INK);rect(10,10,4,10,light);rect(11,11,1,8,GOLD);poly([(12,1),(16,7),(14,10),(10,10),(9,7)],FIRE);poly([(12,4),(14,8),(11,9)],light);rect(7,21,10,2,gold)
 elif base in ['ember','flare','tinder','spark']:
  poly([(12,1),(16,8),(20,5),(19,14),(22,16),(17,22),(8,22),(3,17),(5,11),(9,13)],'#9f5439');poly([(12,4),(15,11),(18,9),(17,17),(13,21),(7,18),(9,12)],FIRE);poly([(12,11),(15,17),(12,20),(9,17)],light)
  if base=='spark':poly([(15,1),(7,13),(12,13),(8,23),(19,9),(13,9)],light)
 elif base in ['pin','shard','glass']:
  poly([(16,2),(21,7),(10,21),(3,22),(4,15)],INK);poly([(16,3),(20,7),(9,19),(5,20),(6,15)],'#73a4a7');line(16,4,7,18,light);line(10,17,18,8,MID)
 elif base in ['lantern','sconce']:
  ell(12,5,4,4,gold);ell(12,5,2,2,INK);poly([(6,7),(18,7),(20,10),(18,21),(6,21),(4,10)],INK);rect(7,10,10,10,gold);rect(9,11,6,8,light);rect(11,12,2,5,FIRE);line(7,10,8,20,TEAL);rect(5,21,14,2,gold);rect(5,7,14,2,gold)
 elif base in ['halo','mirror','brass','lure']:
  ell(12,12,10,10,INK);ell(12,12,9,9,gold);ell(12,12,7,7,DEEP);ell(12,12,6,6,TEAL if base=='mirror' else INK);line(7,6,5,10,light)
  if base=='mirror':line(14,7,8,15,'#a6c7bd');rect(11,21,3,3,gold)
  if base=='brass':poly([(12,4),(18,8),(17,16),(12,21),(7,16),(6,8)],gold);line(12,7,12,17,light)
  if base=='lure':line(12,1,12,15,light);ell(12,15,3,3,FIRE)
 elif base in ['oil','lamp-oil','oil-splash','soot']:
  if base=='oil-splash':
   ell(12,16,11,6,'#573e35');ell(12,15,9,5,gold);ell(12,14,7,3,DEEP);poly([(11,1),(16,8),(14,12),(10,12),(8,8)],FIRE)
  else:
   rect(9,2,6,4,gold);poly([(8,6),(16,6),(19,12),(18,21),(6,21),(5,12)],INK);poly([(9,7),(15,7),(17,12),(16,20),(8,20),(7,12)],TEAL);rect(8,13,9,6,gold if base!='soot' else '#50495c');line(9,8,8,12,LIGHT);rect(11,14,3,3,light)
 elif base=='bellows':
  poly([(3,17),(7,6),(15,4),(20,9),(17,17),(8,21)],INK);poly([(5,16),(8,8),(14,6),(18,10),(15,16),(8,19)],'#965f48');line(8,7,16,15,gold);line(7,10,14,17,GOLD);line(17,9,22,4,LIGHT,2)
 elif base=='chest':
  rect(3,8,18,13,INK);rect(4,10,16,10,'#72513b');rect(4,7,16,5,gold);rect(6,8,12,2,'#d4a46b');rect(6,11,2,9,GOLD);rect(17,11,2,9,GOLD);rect(11,11,3,5,PALE);a.px(12,13,INK)
 elif base=='bread':
  ell(12,14,10,7,INK);ell(12,13,9,6,GOLD);ell(11,11,7,4,PALE)
  for x in [7,11,15]:line(x,9,x-1,13,'#93623c')
 elif base=='draft':
  for y in [7,12,17]:line(3,y,18,y,MID);ell(18,y-2,3,2,LIGHT);a.px(18, y-2,INK)
 if name=='sconce':
  a=Art(n,n);line(4,17,20,17,gold,2);line(12,17,12,22,gold,2)
  for xx in [5,18]:rect(xx-2,10,5,7,gold);rect(xx-1,11,3,5,light);poly([(xx,3),(xx+3,8),(xx,11),(xx-2,8)],FIRE)
 if name=='lamp-oil':
  rect(3,13,4,7,gold);rect(17,8,5,3,light);poly([(20,9),(23,10),(20,12)],gold);ell(12,16,3,3,PALE);line(12,13,12,18,INK)
 if name=='wick':
  a=Art(n,n)
  for j in range(4):a.ell(12*s,(8+j*3)*s,7*s,2*s,GOLD);a.line(6*s,(8+j*3)*s,14*s,(8+j*3)*s,PALE)
  a.line(13*s,6*s,17*s,2*s,TEAL,2)
 if name=='tallow':
  rect(4,14,5,8,GOLD);rect(5,13,3,8,PALE);rect(16,12,5,10,GOLD);rect(17,11,3,10,PALE);poly([(6,8),(9,12),(5,13)],FIRE);poly([(18,6),(21,10),(17,11)],FIRE)
 if name=='tinder':
  a=Art(n,n);a.line(6*s,20*s,17*s,4*s,GOLD,2);a.line(18*s,20*s,7*s,5*s,PALE,2);a.ell(17*s,4*s,2*s,3*s,FIRE);a.ell(7*s,5*s,2*s,3*s,'#b3563f')
 if name=='flare':
  for j in range(8):
   ang=j*math.pi/4;line(12+math.cos(ang)*8,12+math.sin(ang)*8,12+math.cos(ang)*11,12+math.sin(ang)*11,light)
 if name in ['pin','hail']:
  a=Art(n,n);a.line(2*s,18*s,20*s,4*s,PALE,2);a.poly([(17*s,3*s),(23*s,1*s),(21*s,7*s)],GOLD);a.ell(4*s,17*s,2*s,2*s,TEAL)
  if name=='hail':a.line(2*s,11*s,14*s,2*s,'#a8dbd5');a.line(10*s,23*s,23*s,12*s,'#a8dbd5')
 if name=='glass':
  a=Art(n,n);poly([(4,4),(13,2),(19,9),(16,21),(5,18)],INK);poly([(5,5),(12,3),(17,9),(14,19),(6,16)],TEAL);line(12,4,8,15,PALE);line(15,8,12,17,LIGHT)
 if name in ['pyre','beacon','chandelier','corona','blaze']:
  for x,y in [(3,3),(20,5),(3,20)]:line(x-1,y,x+1,y,light);line(x,y-1,x,y+1,light)
 return a
names='taper ember pin lantern halo oil-splash spark shard sconce flare pyre beacon hail chandelier corona blaze wick oil glass brass mirror bellows tallow tinder soot lure lamp-oil'.split()
for name in names:icon(name).save(f'icons/{name}.png')
for name in ['chest','bread','draft']:icon(name).save(f'sprites/pickups/{name}.png')
for name,n in [('ember',16),('beacon',16),('pin',12),('hail',12),('lantern',28),('chandelier',28),('shard',16)]:icon(name,n).save(f'sprites/effects/{name}.png')
for name in ['taper','pyre']:
 a=Art(120,40);colors=['#e5a45644','#dfa45788',PALE] if name=='taper' else ['#74cfc544','#a0e0d988','#fff4c9']
 for i,c in enumerate(colors):a.poly([(1,19),(30,4+i*3),(80,1+i*4),(119,15+i),(90,34-i*4),(38,38-i*4),(15,30),(65,31-i*5),(106,17),(64,9+i*3)],c)
 a.save(f'sprites/effects/{name}.png')
for name,n in [('halo',160),('corona',160),('oil-splash',100),('blaze',100)]:
 a=Art(n,n);c=n/2
 for y in range(n):
  for x in range(n):
   d=math.hypot(x-c,y-c);ang=math.atan2(y-c,x-c)
   if name in ['halo','corona']:
    if abs(d-(c-3))<1.5:a.px(x,y,'#d5bc6f99' if name=='halo' else '#b5ead3bb')
    elif abs(d-(c-9))<.6:a.px(x,y,'#668d6e55')
    elif d<c-9:a.px(x,y,'#c6aa3410')
    if abs(d-(c-5))<3 and int(ang*24)%6==0:a.px(x,y,PALE)
   elif d<c-4+2*math.sin(ang*9):
    if d>c-7:a.px(x,y,'#db944b99' if name=='oil-splash' else '#b5efbd99')
    else:a.px(x,y,'#b8783033' if (x*7+y*3)%23<4 else '#251e2777')
 a.save(f'sprites/effects/{name}.png')
for name,n,frames in [('spark',80,4),('flare',128,6),('sconce',24,4),('puff',24,4)]:
 for f in range(frames):
  a=Art(n,n);c=n/2
  if name=='sconce':
   for j in range(3):
    ang=f*math.pi/2+j*2*math.pi/3;x=c+math.cos(ang)*7;y=c+math.sin(ang)*7;a.line(c,c,x,y,GOLD,2);a.ell(x,y,3,3,PALE);a.px(x,y,FIRE)
  elif name=='puff':
   for j in range(7):
    ang=j*2*math.pi/7;a.ell(c+math.cos(ang)*(3+f*2),c+math.sin(ang)*(3+f*2),3-f*.5,3-f*.5,['#ded4aabb','#a9b7a888','#73998d66','#53807933'][f])
  else:
   rad=c-3
   for j in range(16):
    ang=j*math.pi/8+f*.1;a.line(c+math.cos(ang)*rad*(.1+f*.1),c+math.sin(ang)*rad*(.1+f*.1),c+math.cos(ang)*rad,c+math.sin(ang)*rad,['#f5deb299','#e6ba7277','#db9b5266','#be7e3844','#be7e3833','#be7e3822'][f],2)
   if name=='spark':a.poly([(c+5,0),(c-14,c),(c+3,c-4),(c-3,n),(c+18,c-9),(c+3,c-10)],PALE)
  a.save(f'sprites/{"puff" if name=="puff" else "effects/"+name}/{f}.png',True)
print('Original sprites rendered.')
# Frontispiece: a hand-drawn lamplit street, made of the same pixel vocabulary.
a=Art(360,360);a.rect(0,0,360,360,'#0c1c25')
# Moon behind a dense silhouette of steep slate roofs.
a.ell(222,70,37,37,'#a7ad8b');a.ell(232,59,36,36,'#0c1c25')
for x,y in [(38,37),(92,18),(148,52),(283,30),(319,97),(175,19)]:a.px(x,y,'#7d9789')
for x,w,h in [(0,52,163),(42,43,210),(78,61,135),(127,45,188),(170,57,125),(223,49,196),(266,54,160),(310,50,230)]:
 y=300-h;a.rect(x,y,w,h,'#132930');a.poly([(x-3,y),(x+w/2,y-36),(x+w+3,y)],'#10222b');a.line(x,y,x+w,y,'#304246')
 for yy in range(y+17,286,31):
  for xx in range(x+10,x+w-5,17):
   a.rect(xx,yy,7,15,'#091820');a.rect(xx+1,yy+2,5,11,random.choice(['#273f42','#47544a','#665c42']));a.line(xx,yy+7,xx+6,yy+7,'#15262c')
 a.line(x+w-1,y,x+w-1,300,'#20373e')
# Perspective pavement, wrought-iron fence and arch.
a.poly([(0,299),(360,299),(360,360),(0,360)],'#1a3034')
for y in range(304,360,9):a.line(0,y,360,y,'#243d3e')
for x in range(-200,600,36):a.line(180+(x-180)*.15,299,x,360,'#10272d')
for x in range(0,150,12):a.line(x,237,x,304,'#091820',2);a.poly([(x-2,239),(x+1,232),(x+4,239)],'#455751')
a.line(0,249,150,249,'#42524b');a.line(0,278,150,278,'#0a1a22',3)
# Ornamental streetlamp and pools of reflected light.
a.ell(240,330,69,12,'#74634333');a.ell(239,330,42,7,'#b98b4933')
a.rect(235,178,6,147,'#081820');a.rect(237,180,2,143,GOLD);a.rect(229,323,18,5,'#101f26');a.rect(226,328,24,4,GOLD)
a.line(239,190,255,179,GOLD,2);a.line(255,179,256,160,GOLD,2);a.line(238,190,222,179,GOLD,2);a.line(222,179,221,160,GOLD,2)
a.poly([(214,132),(263,132),(257,174),(222,174)],'#07171f');a.poly([(220,138),(256,138),(251,169),(225,169)],GOLD);a.poly([(225,141),(252,141),(248,166),(229,166)],PALE)
a.line(237,137,237,172,'#725b3d',2);a.poly([(210,132),(217,125),(226,123),(232,113),(244,113),(251,123),(261,126),(267,132)],'#1e3539');a.line(217,130,260,130,GOLD,2);a.rect(236,105,3,11,GOLD)
# Moths orbit the lamp; silhouette details remain deliberately sparse.
for x,y,scale in [(196,143,2),(273,186,2),(266,106,1),(205,204,1),(289,143,1)]:
 a.poly([(x,y),(x-5*scale,y-3*scale),(x-7*scale,y+scale),(x-2*scale,y+3*scale),(x,y+scale),(x+4*scale,y+3*scale),(x+7*scale,y),(x+5*scale,y-4*scale)],GOLD);a.line(x,y-2,x,y+4,INK)
# A lone traveler, enlarged from the actual produced player.
l=lamp()
for (x,y),c in l.p.items():a.rect(169+x*2,263+y*2,2,2,c)
a.save('sprites/frontispiece.png')
